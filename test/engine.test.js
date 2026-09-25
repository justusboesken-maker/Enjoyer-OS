/* Abnahmetests aus docs/uebergabe.md, Abschnitt 9 (B-1 bis B-12) und 7.1.
   Aufruf: npm test  (node --test, keine Abhängigkeiten) */
const test = require('node:test');
const assert = require('node:assert/strict');
const ENG = require('../site/js/engine.js');
const L = require('../site/js/logic.js');
const HIST = require('../site/js/data.js');
const START = require('../site/js/start.js');

const r2 = (x) => L.round(x, 2);
const r4 = (x) => L.round(x, 4);
const S = L.buildSeries(HIST, null);
const R = L.evalAll(S);
const at = (a, d) => { const i = S[a].d.indexOf(d); assert.ok(i >= 0, a + ' ' + d + ' fehlt'); return i; };
const row = (a, d) => { const i = at(a, d), r = R[a]; return { c: S[a].c[i], m: r.sma[i], up: r.up[i], dn: r.dn[i], st: r.st[i] }; };

test('Testdaten: 130 Wochenschlüsse je Reihe', () => {
  for (const a of L.ASSETS) assert.equal(S[a].c.length, 130);
});

test('Rundung: kaufmännisch, auch bei Binärfehlern', () => {
  assert.equal(L.round(4437.735, 2), 4437.74);
  assert.equal(L.round(-0.005, 2), -0.01);
  assert.equal(L.round(80435.875, 2), 80435.88);
});

test('B-1: SMA50 und Schwellen zum 18./20.09.2026', () => {
  const f = R.ftse, b = R.btc, g = R.gold;
  assert.equal(r2(f.last.c), 185.13); assert.equal(r4(f.last.m), 172.3443); assert.equal(r2(f.next.above), 172.65);
  assert.equal(f.last.st, 1); assert.equal(f.last.up, 73);

  assert.equal(r2(b.last.c), 81142.61); assert.equal(r4(b.last.m), 78787.7604); assert.equal(r2(b.next.above), 78045.27);
  assert.equal(r2(1.03 * b.last.m), 81151.39);
  assert.equal(r2(b.next.bandUp), 80435.87); /* genau 80.435,8750 (B-6); Binärwert knapp darunter, Anzeige wie im Dokument */
  assert.equal(r4(b.next.bandUp), 80435.875);
  assert.equal(r2(b.next.bandDown), 75657.59);
  assert.equal(b.last.st, 0);

  assert.equal(r2(g.last.c), 4348.15); assert.equal(r4(g.last.m), 4459.312); assert.equal(r2(g.next.above), 4469.21);
  assert.equal(g.last.st, 0); assert.equal(g.last.dn, 3);
});

test('B-2: FTSE, 2-Wochen-Regel April/Mai 2025', () => {
  const exp = [
    ['2025-03-28', 132.77, 131.66, 0.84, null, 0, 1],
    ['2025-04-04', 122.91, 131.77, -6.72, 0, 1, 1],
    ['2025-04-11', 124.69, 131.86, -5.43, 0, 2, 0],
    ['2025-04-17', 127.29, 131.98, -3.55, 0, 3, 0],
    ['2025-04-25', 131.65, 132.14, -0.37, 0, 4, 0],
    ['2025-05-02', 135.84, 132.35, 2.64, 1, 0, 0],
    ['2025-05-09', 135.93, 132.56, 2.54, 2, 0, 1]
  ];
  for (const [d, c, m, dist, up, dn, st] of exp) {
    const x = row('ftse', d);
    assert.equal(r2(x.c), c, d); assert.equal(r2(x.m), m, d); assert.equal(r2((x.c / x.m - 1) * 100), dist, d);
    if (up !== null) assert.equal(x.up, up, d); /* 28.03.: 74 mit voller Historie, mit 130 Wochen kürzer */
    assert.equal(x.dn, dn, d); assert.equal(x.st, st, d);
  }
  const sw = R.ftse.sw.map((s) => [s.d, s.to, L.tradeDate(s.d)]);
  assert.deepEqual(sw, [['2025-04-11', 0, '2025-04-14'], ['2025-05-09', 1, '2025-05-12']]);
});

test('B-3: Bitcoin, 3-%-Band', () => {
  let x = row('btc', '2025-11-09'); assert.equal(r2(x.m), 103010.80); assert.equal(r2(0.97 * x.m), 99920.47); assert.equal(x.st, 1);
  x = row('btc', '2025-11-16'); assert.equal(r2(x.m), 102948.74); assert.equal(r2(0.97 * x.m), 99860.28); assert.equal(x.st, 0);
  assert.equal(L.tradeDate('2025-11-16'), '2025-11-17');
  x = row('btc', '2026-09-06'); assert.equal(r2(x.m), 80340.87); assert.equal(x.st, 0);
  assert.equal(r2(1.03 * r2(x.m)), 82751.10); /* das Dokument rechnet diese Grenze aus dem gerundeten SMA50 */
  assert.equal(r2((x.c / x.m - 1) * 100), 0.01);
  x = row('btc', '2026-09-20'); assert.equal(r2(1.03 * x.m - x.c), 8.78); assert.equal(x.st, 0);
  assert.deepEqual(R.btc.sw.map((s) => [s.d, s.to]), [['2025-11-16', 0]]);
});

test('B-4: Gold, 4-Wochen-Regel', () => {
  const exp = [
    ['2026-06-05', 4224.84, null, 0, 1], ['2026-06-12', 4243.12, 0, 1, 1], ['2026-06-19', 4259.50, 0, 2, 1],
    ['2026-06-26', 4273.90, 0, 3, 1], ['2026-07-03', 4290.08, 0, 4, 0], ['2026-08-28', 4422.69, 3, 0, 0],
    ['2026-09-04', 4437.74, 0, 1, 0], ['2026-09-18', 4459.31, 0, 3, 0]
  ];
  for (const [d, m, up, dn, st] of exp) {
    const x = row('gold', d);
    assert.equal(r2(x.m), m, d); if (up !== null) assert.equal(x.up, up, d); /* 05.06.: 139 mit voller Historie */
    assert.equal(x.dn, dn, d); assert.equal(x.st, st, d);
  }
  assert.deepEqual(R.gold.sw.map((s) => [s.d, s.to, L.tradeDate(s.d)]), [['2026-07-03', 0, '2026-07-06']]);
});

/* B-5: Reihen, deren SMA50 in den Testwochen exakt konstant bleibt: jeder neue Schluss ersetzt denselben Wert im Fenster */
test('B-5: Bestätigungsregel n = 2 und n = 4 mit SMA50 = 100', () => {
  const closes = [99, 101, 98, 97, 100, 103, 104];
  /* 7 Testwerte + 41 × 100 + 97 + 101 = 5.000 → SMA50 = 100; Start investiert (101 > 100) */
  const first = closes.concat(Array(41).fill(100)).concat([97, 101]);
  const c = first.concat(closes);
  const ser = { k: c.map((_, i) => ENG.addDays('2020-01-06', 7 * i)), d: c.map((_, i) => ENG.addDays('2020-01-10', 7 * i)), c };
  const r = ENG.evalRule(ser, { type: 'confirm', n: 2 });
  const got = closes.map((_, j) => { const i = 50 + j; return [r.sma[i], r.up[i], r.dn[i], r.st[i]]; });
  assert.deepEqual(got, [[100, 0, 1, 1], [100, 1, 0, 1], [100, 0, 1, 1], [100, 0, 2, 0], [100, 0, 0, 0], [100, 1, 0, 0], [100, 2, 0, 1]]);
  assert.deepEqual(r.sw.map((s) => [s.i - 50 + 1, s.to]), [[4, 0], [7, 1]]);
  const r4w = ENG.evalRule(ser, { type: 'confirm', n: 4 });
  assert.equal(r4w.sw.length, 0);
});

test('B-5: Bandregel p = 3 % mit SMA50 = 100 (in Cent gerechnet)', () => {
  const closes = [10290, 10300, 10301, 9750, 9700, 9699];
  const first = closes.concat(Array(43).fill(10000)).concat([9960]); /* Summe 500.000 → SMA 10.000; Start nicht investiert */
  const c = first.concat(closes);
  const ser = { k: c.map((_, i) => ENG.addDays('2020-01-06', 7 * i)), d: c.map((_, i) => ENG.addDays('2020-01-12', 7 * i)), c };
  const r = ENG.evalRule(ser, { type: 'band', p: 0.03 });
  assert.deepEqual(closes.map((_, j) => r.sma[50 + j]), Array(6).fill(10000));
  assert.deepEqual(closes.map((_, j) => r.st[50 + j]), [0, 0, 1, 1, 1, 0]);
  assert.deepEqual(r.sw.map((s) => [s.i - 50 + 1, s.to]), [[3, 1], [6, 0]]);
});

test('B-6: Formel der Schwelle', () => {
  const b = S.btc.c; let s49 = 0; for (let i = b.length - 49; i < b.length; i++) s49 += b[i];
  assert.equal(r2(s49), 3824218.25);
  assert.equal(r2(s49 / 49), 78045.27);
  assert.equal(r4(1.03 * s49 / 48.97), 80435.875);
  const lo = L.hypo(S.btc, L.RULESET.rules.btc, 80435.87);
  assert.equal(r4(lo.sma), 78093.0824); assert.equal(lo.signal, null); assert.equal(lo.st, 0);
  const hi = L.hypo(S.btc, L.RULESET.rules.btc, 80435.88);
  assert.equal(r4(hi.sma), 78093.0826); assert.equal(hi.signal, 'kauf'); assert.equal(hi.st, 1);
});

test('5.2: Was sich am nächsten Wochenschluss ändern kann', () => {
  const f = L.nextStep(R.ftse, L.RULESET.rules.ftse);
  assert.deepEqual([f.cmp, r2(f.thr), f.k, f.n, f.signal], ['<', 172.65, 1, 2, false]);
  const b = L.nextStep(R.btc, L.RULESET.rules.btc);
  assert.deepEqual([b.cmp, r4(b.thr), b.signal, b.to], ['>', 80435.875, true, 1]);
  const g = L.nextStep(R.gold, L.RULESET.rules.gold);
  assert.deepEqual([g.cmp, r2(g.thr), g.k, g.n, g.missing], ['>', 4469.21, 1, 4, 4]);
});

test('8.4: Handlungsmatrix zum Start (FTSE halten, Gold nichts, Bitcoin beide Wege)', () => {
  const pf = L.portfolio(START.tx, START.prices, START.cash);
  assert.equal(L.recommend('ftse', R.ftse, pf.pos.ftse.held).code, 'halten');
  assert.equal(L.recommend('gold', R.gold, pf.pos.gold.held).code, 'nichts');
  const b = L.recommend('btc', R.btc, pf.pos.btc.held);
  assert.equal(b.code, 'verkaufen'); assert.equal(b.fresh, false);
  assert.equal(b.nextClose, '2026-09-27'); assert.equal(b.nextTrade, '2026-09-28');
  assert.equal(b.branch.cmp, '>'); assert.equal(r4(b.branch.thr), 80435.875);
});

test('B-7 und Abnahme 7.1: Depotbewertung', () => {
  const pf = L.portfolio(START.tx, START.prices, START.cash);
  assert.equal(r2(pf.pos.ftse.cost), 7000.83);
  assert.equal(r2(pf.pos.ftse.value), 7042.53);
  assert.equal(r2(pf.pos.btc.cost), 2776.27);
  assert.equal(r2(pf.pos.btc.value), 3729.95);
  assert.equal(r2(pf.total), 14174.48);
  assert.deepEqual([pf.pos.ftse.value, pf.pos.btc.value, pf.cash.total].map((v) => L.round(v / pf.total * 100, 1)), [49.7, 26.3, 24.0]);
  assert.deepEqual(['ftse', 'btc', 'gold'].map((a) => r2(pf.total * L.RULESET.weights[a])), [7087.24, 4252.34, 2834.90]);
  assert.equal(r2(pf.pos.ftse.gain), 41.70); assert.equal(r2(pf.pos.btc.gain), 953.68);
});

test('B-8a: FIFO und § 20', () => {
  const b = ENG.book([
    { d: '2026-02-02', a: 'ftse', type: 'kauf', units: 10, price: 150 },
    { d: '2026-09-18', a: 'ftse', type: 'kauf', units: 10, price: 170 },
    { d: '2026-12-30', a: 'ftse', type: 'verkauf', units: 12, price: 180 }
  ]);
  const r = b.real[0];
  assert.equal(r2(r.proceeds), 2160); assert.equal(r2(r.cost), 1840); assert.equal(r2(r.gain), 320);
  assert.equal(r2(r.gain * 0.7), 224);
  assert.equal(r2(L.tax20(r.gain * 0.7, 900, 0)), 0);
  assert.equal(r2(L.tax20(r.gain * 0.7, 0, 0)), 59.08);
  assert.deepEqual(b.pos.ftse.map((l) => [l.units, l.cpu]), [[8, 170]]);
});

test('B-8b: Freigrenze § 23', () => {
  const cfg = { fg: 1000, rate: 0.25 };
  assert.equal(ENG.tax23(999.99, cfg), 0);
  assert.equal(ENG.tax23(1000, cfg), 250);
  assert.ok(Number.isNaN(ENG.tax23(1000, { fg: 1000 }))); /* Grenzsteuersatz offen (O-4) */
});

test('B-8c: Haltefrist', () => {
  assert.equal(ENG.isLongTerm('2026-06-15', '2027-06-15'), false);
  assert.equal(ENG.taxFreeFrom('2026-06-15'), '2027-06-16');
  assert.equal(ENG.taxFreeFrom('2028-02-29'), '2029-03-01');
});

test('B-8d: Bitcoin-Start, Verkauf am 28.09. zu 70.700 €', () => {
  const tx = START.tx.concat([{ id: 'x', d: '2026-09-28', a: 'btc', type: 'verkauf', units: 0.050467, price: 70700, fee: 0 }]);
  const b = ENG.book(tx), r = b.real[0];
  assert.equal(r2(r.proceeds), 3568.02); assert.equal(r2(r.gain), 791.75); assert.equal(r2(r.shortGain), 791.75);
  const cfg = L.taxCfg(START.tax, START.settings, 3402, '2026-09-24');
  const ty = ENG.taxYear(cfg, b.real, 2026);
  assert.equal(r2(ty.s23Before), 799.19);
  assert.equal(ENG.tax23(ty.s23Before, cfg), 0);
  /* Vergleich: Verkauf zum App-Kurs */
  const pf = L.portfolio(START.tx, START.prices, START.cash);
  const sp = L.sellPreview('btc', pf.pos.btc.lots, pf.pos.btc.value, 73908.69, '2026-09-28', cfg, ENG.taxYear(cfg, [], 2026));
  assert.equal(r2(sp.gain), 953.68); assert.equal(r2(sp.s23After), 961.12); assert.equal(r2(1000 - sp.s23After), 38.88);
});

test('B-8e: Vorabpauschale VWCE 2026', () => {
  const pf = L.portfolio(START.tx, START.prices, START.cash);
  const vp = ENG.vorab(pf.pos.ftse.lots, 2026, 145.14, 168.92, 0.032);
  assert.equal(r2(vp), 45.18); assert.equal(r2(vp * 0.7), 31.63);
  assert.equal(r2(145.14 + vp / 41.691483), 146.22);
});

test('B-8f: Zinsen für den Rest von 2026 und freier Pauschbetrag', () => {
  const cfg = L.taxCfg(START.tax, START.settings, 3402, '2026-09-24');
  assert.equal(r2(cfg.interestRest), 21.26);
  assert.equal(r2(ENG.taxYear(cfg, [], 2026).pbFree), 912.37);
});

test('B-9: Rebalancing, alles im Freibetrag', () => {
  const x = L.rebalanceBoth(L.EXAMPLES['B-9'].input);
  for (const v of ['frei', 'voll']) {
    const r = x[v], f = r.rows.ftse;
    assert.equal(r2(f.sell), 600); assert.equal(L.round(f.sellUnits, 3), 3.158);
    assert.equal(r2(f.g20), 47.37); assert.equal(r2(f.t20), 33.16);
    assert.equal(r2(r.rows.btc.buy), 200); assert.equal(r2(r.rows.gold.cashTo), 400);
    assert.equal(r2(r.tax), 0); assert.equal(r.orders, 2); assert.equal(r2(r.pbLeft), 866.84);
    assert.deepEqual(L.ASSETS.map((a) => r2(r.rows[a].wAfter * 100)), [50, 30, 20]);
  }
});

test('B-10: Rebalancing, Freigrenze begrenzt', () => {
  const x = L.rebalanceBoth(L.EXAMPLES['B-10'].input);
  const v = x.voll, f = x.frei;
  assert.equal(r2(v.rows.btc.sell), 1200); assert.equal(r2(v.rows.btc.sg), 533.33); assert.equal(r2(v.s23After), 1133.33);
  assert.equal(r2(v.tax23), 283.33); assert.equal(r2(v.rows.ftse.buy), 600); assert.equal(r2(v.rows.gold.cashTo), 600);
  assert.deepEqual(L.ASSETS.map((a) => r2(v.rows[a].wAfter * 100)), [50, 30, 20]);
  assert.equal(r2(f.rows.btc.sell), 899.98); assert.equal(r2(f.rows.btc.sg), 399.99); assert.equal(r2(f.s23After), 999.99);
  assert.equal(r2(f.tax), 0); assert.equal(r2(f.rows.ftse.buy), 449.99); assert.equal(r2(f.rows.gold.cashTo), 449.99);
  assert.equal(r2(f.fill), 0.75);
  assert.deepEqual(L.ASSETS.map((a) => r2(f.rows[a].wAfter * 100)), [48.93, 32.14, 18.93]);
});

test('B-11: Rebalancing, Pauschbetrag begrenzt', () => {
  const x = L.rebalanceBoth(L.EXAMPLES['B-11'].input);
  const v = x.voll, f = x.frei;
  assert.equal(r2(v.rows.ftse.sell), 1000); assert.equal(r2(v.rows.ftse.sellUnits), 5);
  assert.equal(r2(v.rows.ftse.g20), 375); assert.equal(r2(v.rows.ftse.t20), 262.5); assert.equal(r2(v.tax20), 42.86);
  assert.equal(r2(v.rows.btc.buy), 400); assert.equal(r2(v.rows.gold.cashTo), 600);
  assert.equal(r2(f.rows.ftse.sell), 380.95); assert.equal(L.round(f.rows.ftse.sellUnits, 3), 1.905);
  assert.equal(r2(f.rows.ftse.g20), 142.86); assert.equal(r2(f.rows.ftse.t20), 100); assert.equal(r2(f.tax), 0);
  assert.equal(r2(f.rows.btc.buy), 152.38); assert.equal(r2(f.rows.gold.cashTo), 228.57);
  assert.equal(L.round(f.fill, 3), 0.381);
  assert.deepEqual(L.ASSETS.map((a) => r2(f.rows[a].wAfter * 100)), [54.42, 28.23, 17.35]);
});

function myDepot(extraTx, stOverride) {
  const tx = START.tx.concat(extraTx || []);
  const pf = L.portfolio(tx, START.prices, START.cash);
  const cfg = L.taxCfg(START.tax, START.settings, pf.cash.total, '2026-09-24');
  const ty = ENG.taxYear(cfg, pf.real, 2026);
  const st = { ftse: R.ftse.last.st, btc: R.btc.last.st, gold: R.gold.last.st };
  return L.rebalanceBoth(L.rebalanceInput(pf, st, { date: '2026-12-30', stOverride }, cfg, ty));
}

test('B-12 A: Kaufsignal Bitcoin am 27.09. (Cash bis zum Ziel zugeordnet, O-5)', () => {
  for (const r of Object.values(myDepot([], { btc: 1 }))) {
    assert.equal(r2(r.rows.ftse.buy), 44.71); assert.equal(r2(r.rows.btc.buy), 522.39);
    assert.equal(r2(r.rows.gold.after), 2834.90); assert.equal(r2(r.tax), 0);
  }
});

test('B-12 A: dasselbe Ergebnis mit Cash nur beim Gold (wie im Dokument) oder ganz ohne Zuordnung', () => {
  const unassigned = L.portfolio(START.tx, START.prices, Object.assign({}, START.cash, { ftse: null, btc: null, gold: null }));
  assert.equal(unassigned.cash.frei, 3402);
  const cfgU = L.taxCfg(START.tax, START.settings, 3402, '2026-09-24');
  const ru = ENG.rebalance(Object.assign(L.rebalanceInput(unassigned, { ftse: 1, btc: 1, gold: 0 }, { date: '2026-12-30' }, cfgU, ENG.taxYear(cfgU, [], 2026)), { variant: 'frei' }));
  assert.equal(r2(ru.rows.ftse.buy), 44.71); assert.equal(r2(ru.rows.btc.buy), 522.39); assert.equal(r2(ru.rows.gold.after), 2834.90);
  const pf = L.portfolio(START.tx, START.prices, Object.assign({}, START.cash, { ftse: 0, btc: 0, gold: 3402 }));
  assert.equal(pf.cash.frei, 0);
  const cfg = L.taxCfg(START.tax, START.settings, pf.cash.total, '2026-09-24');
  const r = ENG.rebalance(Object.assign(L.rebalanceInput(pf, { ftse: 1, btc: 1, gold: 0 }, { date: '2026-12-30' }, cfg, ENG.taxYear(cfg, [], 2026)), { variant: 'frei' }));
  assert.equal(r2(r.rows.ftse.buy), 44.71); assert.equal(r2(r.rows.btc.buy), 522.39); assert.equal(r2(r.rows.gold.after), 2834.90);
});

test('B-12 B: Bitcoin am 28.09. zu 70.700 € nach Regel verkauft', () => {
  const sale = { id: 'x', d: '2026-09-28', a: 'btc', type: 'verkauf', units: 0.050467, price: 70700, fee: 0 };
  for (const r of Object.values(myDepot([sale]))) {
    assert.equal(r2(r.rows.ftse.sell), 36.25); assert.equal(r2(r.rows.btc.after), 4203.76);
    assert.equal(r2(r.rows.gold.after), 2802.51); assert.equal(r2(r.tax), 0); assert.equal(r2(r.s23After), 799.19);
  }
});

test('O-5: Ist-Zustand je Baustein mit der Cash-Zuordnung vom 24.09.2026 = genau 50/30/20', () => {
  const pf = L.portfolio(START.tx, START.prices, START.cash);
  assert.equal(r2(pf.cash.frei), 0);
  assert.deepEqual(L.ASSETS.map((a) => r2(pf.pos[a].value + pf.cash[a])), [7087.24, 4252.34, 2834.90]);
});

test('Performance: Positionen ab dem ersten Kauf, Depotwert inkl. Cash ab dem Cash-Stichtag', () => {
  const eur = { ftse: { d: ['2026-09-17', '2026-09-18', '2026-09-24', '2026-09-25'], c: [160, 167.92, 168.92, 170] },
    btc: { d: ['2026-06-29', '2026-06-30', '2026-09-24', '2026-09-26'], c: [50000, 55000, 73908.69, 75000] } };
  const p = L.performance(START.tx, eur, START.cash, '2026-09-26');
  assert.deepEqual(p.d, ['2026-06-30', '2026-09-17', '2026-09-18', '2026-09-24', '2026-09-25', '2026-09-26']);
  assert.equal(r2(p.value[0]), r2(0.050467 * 55000));
  assert.equal(r2(p.cost[1]), 2776.27);
  assert.equal(r2(p.value[3]), 14174.48 - 3402);
  assert.deepEqual(p.total.slice(0, 3), [null, null, null]);
  assert.equal(r2(p.total[3]), 14174.48);
  assert.equal(r2(p.total[5]), r2(41.691483 * 170 + 0.050467 * 75000 + 3402));
  assert.equal(L.performance([], eur, START.cash, '2026-09-26'), null);
  /* Zeitgewichtete Rendite: Käufe sind Zuflüsse, kein Gewinn. Tag 1: Kauf zu 55.011,54 €, Schluss 55.000 € */
  const ub = 0.050467, uf = 41.691483;
  const g0 = (ub * 55000) / (ub * 55011.54);
  assert.equal(L.round(p.twr[0], 10), L.round(g0 - 1, 10));
  const v18 = uf * 167.92 + ub * 55000, v26 = uf * 170 + ub * 75000;
  assert.equal(L.round(p.twr[2], 10), L.round(g0 - 1, 10), 'VWCE-Kauf zum Schlusskurs ändert die Rendite nicht');
  assert.equal(L.round(p.twr[5], 10), L.round(g0 * v26 / v18 - 1, 10));
});

test('A-1: Verkauf schreibt dem Baustein Cash gut, Kauf zieht ab (Rest aus freiem Cash)', () => {
  const cash = { total: 1000, date: '2026-09-24', ftse: null, btc: 200, gold: null };
  const tx = [
    { d: '2026-09-18', a: 'ftse', type: 'kauf', units: 1, price: 100 }, /* vor dem Stichtag: schon im Cash-Stand */
    { d: '2026-10-05', a: 'btc', type: 'verkauf', units: 0.01, price: 70000, fee: 1 },
    { d: '2026-10-12', a: 'gold', type: 'kauf', units: 10, price: 40, fee: 1 }
  ];
  const { cash: c, notes } = L.cashLedger(tx, cash);
  assert.equal(r2(c.btc), 899); assert.equal(r2(c.gold), 0); assert.equal(r2(c.frei), 399);
  assert.equal(r2(c.total), 1298); assert.equal(notes.length, 1);
});

test('6.2: neuer Wochenpunkt mit Reskalierung der bereinigten FTSE-Historie', () => {
  const k = '2026-09-21', p = 185.13 * 0.99;
  const ser = L.buildSeries(HIST, { ftse: [{ k, d: '2026-09-25', c: 184, p }] });
  assert.equal(ser.ftse.c.length, 131);
  assert.equal(r4(ser.ftse.c[129]), r4(p));
  assert.equal(r4(ser.ftse.c[0]), r4(123.45 * 0.99));
});
