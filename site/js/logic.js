/* App-Logik rund um den Rechenkern (engine.js). Nur reine Funktionen ohne DOM und ohne Speicher,
   damit sie in Node getestet werden können (test/engine.test.js).
   Fachliche Grundlage: docs/uebergabe.md (Abschnitte 2, 3, 4, 8). */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./engine.js'));
  else root.LOGIC = factory(root.ENG);
})(this, function (ENG) {
  var ASSETS = ['ftse', 'btc', 'gold'];

  /* Regelparameter, BESCHLOSSEN (2.1, 2.2). Version 1, gültig ab der Woche vom 28.09.2026. */
  var RULESET = {
    version: 1, validFrom: '2026-09-28', smaLength: 50,
    weights: { ftse: 0.5, btc: 0.3, gold: 0.2 },
    rules: { ftse: { type: 'confirm', n: 2 }, btc: { type: 'band', p: 0.03 }, gold: { type: 'confirm', n: 4 } }
  };

  /* FAKT (2.6), Rechtsstand September 2026 */
  var TAX_LAW = { abg: 0.26375, tfs: 0.3, pb: 1000, fg: 1000 };

  /* Kaufmännisch runden auf n Stellen. toPrecision(15) glättet Binärfehler wie 4437.735*100 = 443773.49999999994. */
  function round(x, n) {
    if (typeof x !== 'number' || !isFinite(x)) return x;
    var f = Math.pow(10, n), v = Number((Math.abs(x) * f).toPrecision(15));
    return (x < 0 ? -1 : 1) * Math.round(v) / f;
  }

  /* ---------- Serien und Regeln ---------- */

  function buildSeries(hist, weekly) {
    return {
      ftse: ENG.merge(hist.ftse, (weekly && weekly.ftse) || [], true), /* bereinigte Kurse: reskalieren (6.2) */
      btc: ENG.merge(hist.btc, (weekly && weekly.btc) || [], false),
      gold: ENG.merge(hist.gold, (weekly && weekly.gold) || [], false)
    };
  }

  function evalAll(series) {
    var out = {};
    ASSETS.forEach(function (a) { out[a] = ENG.evalRule(series[a], RULESET.rules[a]); });
    return out;
  }

  /* Wochenschluss-Tag der Folgewoche: FTSE und Gold Freitag, Bitcoin Sonntag (2.4) */
  function nextCloseDate(asset, lastD) {
    return ENG.addDays(ENG.mondayOf(lastD), asset === 'btc' ? 13 : 11);
  }
  /* Handel zur Eröffnung der Folgewoche: Montag nach dem Wochenschluss */
  function tradeDate(closeD) { return ENG.addDays(ENG.mondayOf(closeD), 7); }

  /* Die Regel mit einem angenommenen nächsten Wochenschluss C weiterrechnen (Was-wäre-wenn, Vorwarnung). */
  function hypo(S, rule, C, closeD) {
    var n = S.c.length, k = ENG.addDays(S.k[n - 1], 7);
    var S2 = { k: S.k.concat([k]), d: S.d.concat([closeD || k]), c: S.c.concat([C]) };
    var r = ENG.evalRule(S2, rule), L = r.last;
    return { c: C, sma: L.m, dist: L.dist, st: L.st, prevSt: r.st[n - 1], up: L.up, dn: L.dn,
      signal: L.changed ? (L.st === 1 ? 'kauf' : 'verkauf') : null };
  }

  /* Was sich am nächsten Wochenschluss ändern kann (7.2, Formeln 8.2) */
  function nextStep(res, rule) {
    var L = res.last, nx = res.next, k;
    if (rule.type === 'band') {
      return L.st === 0 ? { signal: true, to: 1, cmp: '>', thr: nx.bandUp, missing: 1 }
                        : { signal: true, to: 0, cmp: '<', thr: nx.bandDown, missing: 1 };
    }
    if (L.st === 1) { k = L.dn + 1; return { signal: k >= rule.n, to: 0, cmp: '<', thr: nx.above, k: k, n: rule.n, missing: rule.n - L.dn }; }
    k = L.up + 1; return { signal: k >= rule.n, to: 1, cmp: '>', thr: nx.above, k: k, n: rule.n, missing: rule.n - L.up };
  }

  /* Relativer Abstand eines Schlusses zur Schwelle, an der die Regel an diesem Schluss wechseln würde */
  function thresholdAt(rule, st, sma) {
    if (rule.type === 'band') return st === 0 ? sma * (1 + rule.p) : sma * (1 - rule.p);
    return sma;
  }

  /* Handlungsmatrix Regel × Bestand (8.4) */
  function recommend(asset, res, held) {
    var rule = RULESET.rules[asset], L = res.last, st = L.st, code;
    if (st === 1) code = held ? 'halten' : 'kaufen';
    else code = held ? 'verkaufen' : 'nichts';
    var out = { code: code, st: st, held: held, fresh: !!L.changed, trade: tradeDate(L.d), since: L.lastSwitch ? L.lastSwitch.d : null };
    /* Ältere Abweichung: beide Wege zeigen, wenn schon der nächste Wochenschluss die Regel drehen kann */
    if ((code === 'kaufen' || code === 'verkaufen') && !out.fresh) {
      var nx = nextStep(res, rule);
      out.nextClose = nextCloseDate(asset, L.d);
      out.nextTrade = tradeDate(out.nextClose);
      if (nx.signal) out.branch = { thr: nx.thr, cmp: nx.cmp, to: nx.to };
    }
    return out;
  }

  /* ---------- Depot ---------- */

  /* Cash je Baustein (A-1). Startstand zum Stichtag cash.date; nur spätere Buchungen verändern ihn.
     Nicht zugeordnetes Cash (O-5) liegt in "frei". Reicht das Cash eines Bausteins für einen Kauf nicht,
     wird der Rest aus dem freien Cash genommen. */
  function cashLedger(tx, cash) {
    var c = { ftse: +cash.ftse || 0, btc: +cash.btc || 0, gold: +cash.gold || 0 }, notes = [];
    c.frei = (+cash.total || 0) - c.ftse - c.btc - c.gold;
    (tx || []).filter(function (t) { return t.d > cash.date && c.hasOwnProperty(t.a) && t.units > 0; })
      .sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; })
      .forEach(function (t) {
        var amt = t.units * t.price;
        if (t.type === 'verkauf') c[t.a] += amt - (t.fee || 0);
        else if (t.type === 'kauf') {
          c[t.a] -= amt + (t.fee || 0);
          if (c[t.a] < 0) { c.frei += c[t.a]; notes.push({ d: t.d, a: t.a, fromFree: -c[t.a] }); c[t.a] = 0; }
        }
      });
    c.total = c.ftse + c.btc + c.gold + c.frei;
    return { cash: c, notes: notes };
  }

  function portfolio(tx, prices, cash) {
    var b = ENG.book(tx), led = cashLedger(tx, cash), pos = {}, totalV = 0, totalCost = 0;
    ASSETS.forEach(function (a) {
      /* Beträge in Cent wie in der Trade-Republic-App: Gewinn = gerundeter Wert − gerundeter Einstand */
      var lots = b.pos[a], u = ENG.units(lots), cost = round(ENG.cost(lots), 2), px = prices[a] && prices[a].px;
      var V = px > 0 ? round(u * px, 2) : (u > 1e-12 ? NaN : 0);
      pos[a] = { lots: lots, units: u, cost: cost, px: px, value: V, gain: V - cost, gainPct: cost > 0 ? V / cost - 1 : NaN,
        held: u > 1e-12, cash: led.cash[a] };
      if (isFinite(V)) totalV += V;
      totalCost += cost;
    });
    var total = totalV + led.cash.total;
    return { pos: pos, real: b.real, cash: led.cash, cashNotes: led.notes, invested: totalV, cost: totalCost, total: total };
  }

  /* Depotverlauf in Euro für den Performance-Chart. eur: {ftse:{d,c}, btc:{d,c}, gold:{d,c}} mit täglichen Schlusskursen.
     value/cost: Positionen ab dem ersten Kauf. total: Depotwert inkl. Cash erst ab dem Cash-Stichtag,
     weil das Cash davor unbekannt ist. Fehlt für eine gehaltene Position noch ein Kurs, bleibt der Tag leer (null).
     twr: zeitgewichtete Rendite der Positionen seit dem ersten Kauf. Käufe und Verkäufe zählen als Zu- und Abfluss,
     r(t) = Wert(t) / (Wert(t−1) + Zufluss(t)) − 1, verkettet. */
  function performance(tx, eur, cash, today) {
    var txs = (tx || []).filter(function (t) { return t.units > 0; }).slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    if (!txs.length || !eur) return null;
    var start = txs[0].d, seen = {};
    ASSETS.forEach(function (a) { var s = eur[a]; if (s) s.d.forEach(function (d) { if (d >= start && d <= today) seen[d] = 1; }); });
    var ds = Object.keys(seen).sort();
    if (!ds.length) return null;
    var idx = {}, px = {}, out = { d: [], value: [], cost: [], total: [], twr: [] }, prevV = 0, prevD = '', growth = 1;
    ASSETS.forEach(function (a) { idx[a] = 0; px[a] = null; });
    ds.forEach(function (d) {
      ASSETS.forEach(function (a) {
        var s = eur[a]; if (!s) return;
        while (idx[a] < s.d.length && s.d[idx[a]] <= d) { px[a] = s.c[idx[a]]; idx[a]++; } /* letzter bekannter Kurs */
      });
      var upto = txs.filter(function (t) { return t.d <= d; }), b = ENG.book(upto), v = 0, c = 0, complete = true;
      ASSETS.forEach(function (a) {
        var u = ENG.units(b.pos[a]);
        if (u <= 1e-12) return;
        if (!(px[a] > 0)) complete = false; else v += u * px[a];
        c += ENG.cost(b.pos[a]);
      });
      var flow = 0;
      txs.forEach(function (t) {
        if (t.d > prevD && t.d <= d) flow += t.type === 'kauf' ? t.units * t.price + (t.fee || 0) : -(t.units * t.price - (t.fee || 0));
      });
      if (complete) {
        var base = prevV + flow;
        if (base > 1e-9) growth *= v / base;
        prevV = v; prevD = d;
      }
      out.twr.push(complete ? growth - 1 : null);
      out.d.push(d);
      out.value.push(complete ? v : null);
      out.cost.push(c);
      out.total.push(complete && d >= cash.date ? v + cashLedger(upto, cash).cash.total : null);
    });
    return out;
  }

  /* ---------- Steuern ---------- */

  function restMonths(date) { return 12 - (+date.slice(5, 7)); }

  /* Steuer-Konfiguration für engine.taxYear/rebalance aus den Einstellungen. */
  function taxCfg(tax, settings, cashTotal, today) {
    var pbUsed = tax.fsaMeaning === 'genutzt' ? tax.fsaShown : tax.pb - tax.fsaShown; /* A-10 / O-3 */
    var interestRest = tax.interestAuto ? cashTotal * tax.interestRate * restMonths(today) / 12 : (+tax.interestRest || 0); /* A-8 */
    var s23Other = tax.o2 === 'erloes' ? 0 : tax.o2Amount; /* O-2: offen wird vorsichtig als Gewinn gerechnet (wie B-8d) */
    return {
      pb: tax.pb, pbUsed: pbUsed, pbUsedDate: tax.pbDate, interestRest: interestRest, lossOther: +tax.lossOther || 0,
      s23Other: s23Other + (+tax.s23Extra || 0), tfs: TAX_LAW.tfs, fg: TAX_LAW.fg, abg: TAX_LAW.abg,
      rate: typeof tax.rate === 'number' && isFinite(tax.rate) ? tax.rate : undefined, /* O-4 */
      fee: settings.fee, buffer: +settings.buffer || 0, minOrder: +settings.minOrder || 0 /* O-8 ohne Vorgabe */
    };
  }

  function tax20(taxable, pbFree, lossOther) {
    return Math.max(0, taxable - Math.max(0, pbFree) - (lossOther || 0)) * TAX_LAW.abg;
  }

  /* Verkauf simulieren: Betrag in EUR → Stück, Gewinn nach FIFO, Steuerwirkung */
  function sellPreview(asset, lots, amount, px, date, cfg, ty) {
    var sm = ENG.simSell(lots, amount, px, date, asset, cfg), out = { units: sm.q, parts: sm.parts };
    if (asset === 'ftse') {
      out.gain = sm.g20; out.taxable = sm.taxable20;
      out.tax = Math.max(0, sm.taxable20 - Math.max(0, ty.pbFree)) * cfg.abg;
      out.pbAfter = Math.max(0, ty.pbFree - sm.taxable20);
    } else {
      out.gain = sm.sg + sm.lg; out.short = sm.sg; out.long = sm.lg;
      out.s23After = ty.s23Before + sm.sg;
      out.tax = ENG.tax23(out.s23After, cfg) - ENG.tax23(ty.s23Before, cfg);
      out.cliff = out.s23After >= cfg.fg && ty.s23Before < cfg.fg;
    }
    return out;
  }

  /* „Pauschbetrag nutzen“ (7.3): wie viele VWCE-Stücke man verkaufen und sofort zurückkaufen kann,
     bis der steuerpflichtige Gewinn den freien Pauschbetrag erreicht. Nur Hinweis. */
  function harvest(lots, px, pbLeft, cfg) {
    if (!(pbLeft > 0.5) || !(px > 0) || !lots.length) return null;
    var val = ENG.taxFreeMax(lots, px, '9999-12-31', 'ftse', cfg, { pbFree: pbLeft });
    if (!(val > 0.5)) return null;
    var sm = ENG.simSell(lots, val, px, '9999-12-31', 'ftse', cfg);
    if (!(sm.g20 > 0.005)) return null;
    return { value: val, units: sm.q, gain: sm.g20, taxable: sm.taxable20, all: val >= ENG.units(lots) * px - 0.005 };
  }

  /* ---------- Rebalancing ---------- */

  /* Eingabe für engine.rebalance aus dem Depot. opt: {date, stOverride:{a:'aktuell'|0|1}, px:{a}, o15:'ja'|'nein'} */
  function rebalanceInput(pf, ruleStates, opt, cfg, ty) {
    var st = {}, px = {}, pos = {}, cash = {};
    ASSETS.forEach(function (a) {
      var ov = opt.stOverride && opt.stOverride[a];
      st[a] = ov === 0 || ov === 1 ? ov : ruleStates[a];
      /* O-15: „nein“ = offene Regel-Verkäufe nicht als erledigt behandeln, Position läuft wie investiert mit */
      if (opt.o15 === 'nein' && st[a] === 0 && pf.pos[a].held) st[a] = 1;
      px[a] = (opt.px && opt.px[a] > 0) ? opt.px[a] : pf.pos[a].px;
      pos[a] = pf.pos[a].lots;
      cash[a] = pf.cash[a];
    });
    return { date: opt.date, w: RULESET.weights, st: st, px: px, pos: pos, cash: cash, cashFree: pf.cash.frei, cfg: cfg, ty: ty };
  }

  function rebalanceBoth(input) {
    return {
      frei: ENG.rebalance(Object.assign({}, input, { variant: 'frei' })),
      voll: ENG.rebalance(Object.assign({}, input, { variant: 'voll' }))
    };
  }

  /* Rechenbeispiele B-9 bis B-11 als feste Eingaben (erfundene Werte aus Abschnitt 9) */
  function exampleCfg(extra) {
    return Object.assign({ tfs: TAX_LAW.tfs, fg: TAX_LAW.fg, abg: TAX_LAW.abg, rate: undefined, fee: 1, buffer: 0, minOrder: 0 }, extra || {});
  }
  var EXAMPLES = {
    'B-9': {
      title: 'B-9: alles im Freibetrag',
      text: 'FTSE 40 Stück zu 190 € (Einstand 175 €), Bitcoin 0,05 BTC zu 80.000 € (Einstand 70.000 €, Kauf 15.06.2026), Gold Cash 2.400 €. Freier Pauschbetrag 900 €.',
      input: {
        date: '2026-12-30', w: RULESET.weights, st: { ftse: 1, btc: 1, gold: 0 }, px: { ftse: 190, btc: 80000, gold: 0 },
        pos: { ftse: [{ d: '2026-01-15', units: 40, cpu: 175 }], btc: [{ d: '2026-06-15', units: 0.05, cpu: 70000 }], gold: [] },
        cash: { ftse: 0, btc: 0, gold: 2400 }, cashFree: 0, cfg: exampleCfg(), ty: { pbFree: 900, s23Before: 0 }
      },
      expect: 'Steuer 0 €, 2 Orders, danach genau 50/30/20, freier Pauschbetrag danach 866,84 €.'
    },
    'B-10': {
      title: 'B-10: Freigrenze begrenzt',
      text: 'FTSE 40 Stück zu 160 € (Einstand 150 €), Bitcoin 0,06 BTC zu 90.000 € (Einstand 50.000 €, Kauf 15.06.2026), Gold Cash 2.200 €. Andere kurzfristige Gewinne 600 €, Steuersatz beispielhaft 25 %.',
      input: {
        date: '2026-12-30', w: RULESET.weights, st: { ftse: 1, btc: 1, gold: 0 }, px: { ftse: 160, btc: 90000, gold: 0 },
        pos: { ftse: [{ d: '2026-01-15', units: 40, cpu: 150 }], btc: [{ d: '2026-06-15', units: 0.06, cpu: 50000 }], gold: [] },
        cash: { ftse: 0, btc: 0, gold: 2200 }, cashFree: 0, cfg: exampleCfg({ rate: 0.25 }), ty: { pbFree: 900, s23Before: 600 }
      },
      expect: 'Voll: Steuer 283,33 € (Klippe der Freigrenze). Steuerfrei: Bitcoin-Verkauf 899,98 €, f = 0,75, Gewichte 48,93 / 32,14 / 18,93 %.'
    },
    'B-11': {
      title: 'B-11: Pauschbetrag begrenzt',
      text: 'FTSE 40 Stück zu 200 € (Einstand 125 €, Kauf 01.03.2025), Bitcoin 0,0475 BTC zu 80.000 € (Kauf 10.01.2025), Gold Cash 2.200 €. Freier Pauschbetrag nur 100 €.',
      input: {
        date: '2026-12-30', w: RULESET.weights, st: { ftse: 1, btc: 1, gold: 0 }, px: { ftse: 200, btc: 80000, gold: 0 },
        pos: { ftse: [{ d: '2025-03-01', units: 40, cpu: 125 }], btc: [{ d: '2025-01-10', units: 0.0475, cpu: 60000 }], gold: [] },
        cash: { ftse: 0, btc: 0, gold: 2200 }, cashFree: 0, cfg: exampleCfg(), ty: { pbFree: 100, s23Before: 0 }
      },
      expect: 'Voll: Steuer 42,86 € (§ 20). Steuerfrei: FTSE-Verkauf 380,95 €, Ziele zu 38,1 % erreicht, Gewichte 54,42 / 28,23 / 17,35 %.'
    }
  };

  return {
    ASSETS: ASSETS, RULESET: RULESET, TAX_LAW: TAX_LAW, EXAMPLES: EXAMPLES,
    round: round, buildSeries: buildSeries, evalAll: evalAll, nextCloseDate: nextCloseDate, tradeDate: tradeDate,
    hypo: hypo, nextStep: nextStep, thresholdAt: thresholdAt, recommend: recommend,
    cashLedger: cashLedger, portfolio: portfolio, performance: performance, restMonths: restMonths, taxCfg: taxCfg, tax20: tax20,
    sellPreview: sellPreview, harvest: harvest, rebalanceInput: rebalanceInput, rebalanceBoth: rebalanceBoth
  };
});
