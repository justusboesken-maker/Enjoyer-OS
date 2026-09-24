/* Oberfläche des Regel-Depots. Rechnet nichts Fachliches selbst, sondern nutzt engine.js und logic.js.
   Zustand: START (start.js) als Vorgabe, Änderungen lokal im Browser (localStorage), Export/Import als JSON. */
(function () {
  'use strict';

  var A = LOGIC.ASSETS, RS = LOGIC.RULESET, TAX = LOGIC.TAX_LAW;
  var KEY = 'regeldepot.v1', UIKEY = 'regeldepot.ui', THEMEKEY = 'regeldepot.theme';
  var META = {
    ftse: { name: 'FTSE All-World', instr: 'VWCE', instrLong: 'Vanguard FTSE All-World UCITS ETF USD Acc (VWCE)', isin: 'IE00BK5BQT80',
      signal: 'VWRD bereinigt, USD', ruleName: '2-Wochen-Regel', unit: 'Stück', uDec: 6, eurSym: 'VWCE.DE', closeLabel: 'Freitag, Börsenschluss London' },
    btc: { name: 'Bitcoin', instr: 'Bitcoin', instrLong: 'Bitcoin direkt bei Trade Republic', isin: '',
      signal: 'BTC-USD (Yahoo)', ruleName: '3-%-Band', unit: 'BTC', uDec: 6, eurSym: 'BTC-EUR', closeLabel: 'Sonntag 24:00 UTC' },
    gold: { name: 'Gold', instr: 'Gold-ETC', instrLong: 'WisdomTree Physical Swiss Gold (ETC)', isin: 'JE00B588CD74',
      signal: 'LBMA Gold PM, USD', ruleName: '4-Wochen-Regel', unit: 'Stück', uDec: 4, eurSym: 'SGBS.MI', closeLabel: 'Freitag, LBMA-PM-Fixing' }
  };

  /* ================= Formatierung ================= */
  var NF = {};
  function nf(d) { return NF[d] || (NF[d] = new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })); }
  function ok(x) { return typeof x === 'number' && isFinite(x); }
  function num(x, d) {
    if (!ok(x)) return '–';
    var r = LOGIC.round(x, d == null ? 2 : d); if (r === 0) r = 0;
    return nf(d == null ? 2 : d).format(r).replace('-', '−');
  }
  function eur(x, d) { return ok(x) ? num(x, d == null ? 2 : d) + ' €' : '–'; }
  function usd(x, d) { return ok(x) ? num(x, d == null ? 2 : d) + ' $' : '–'; }
  function sgn(x, d) { return ok(x) && LOGIC.round(x, d) > 0 ? '+' : ''; }
  function eurS(x, d) { return ok(x) ? sgn(x, d == null ? 2 : d) + eur(x, d) : '–'; }
  function pct(x, d, sign) {
    if (!ok(x)) return '–';
    d = d == null ? 2 : d;
    return (sign ? sgn(x * 100, d) : '') + num(x * 100, d) + ' %';
  }
  function units(a, u) { return ok(u) ? num(u, META[a].uDec) + ' ' + META[a].unit : '–'; }
  function fdate(iso) { return iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '–'; }
  function fdm(iso) { return iso ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' : '–'; }
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  function dow(iso) { return new Date(iso + 'T00:00:00Z').getUTCDay(); }
  function wd(iso) { return WD[dow(iso)] + ' ' + fdm(iso); }
  function wdl(iso) { return WDL[dow(iso)] + ', ' + fdm(iso); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function yAxis(v) { return new Intl.NumberFormat('de-DE', { maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 1 }).format(v); }
  function yShort(v) { return Math.abs(v) >= 10000 ? num(v, 0) : num(v, 2); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function chip(kind, label, title) {
    var names = { beschlossen: 'Beschlossen', annahme: 'Annahme', offen: 'Offen', fakt: 'Fakt', vorschlag: 'Vorschlag', geklaert: 'Geklärt' };
    return '<span class="chip ' + kind + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(label || names[kind]) + '</span>';
  }
  function qref(id) { return '<a class="chip ' + (questionDone(id) ? 'geklaert' : 'offen') + '" href="#regeln" data-goto-q="' + id + '">' + id + '</a>'; }
  function aref(id) { return '<a class="chip annahme" href="#regeln" data-goto-a="' + id + '" title="' + esc(ASSUMPTIONS_BY_ID[id] ? ASSUMPTIONS_BY_ID[id].text : '') + '">' + id + '</a>'; }

  /* Zeit bis zum Wochenschluss: FTSE 16:30 London, Gold 15:00 London (PM-Fixing), Bitcoin Sonntag 24:00 UTC */
  function londonToUtc(iso, hh, mm) {
    var y = +iso.slice(0, 4), mo = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10);
    var guess = Date.UTC(y, mo, d, hh, mm);
    try {
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
      var lh = +parts.find(function (p) { return p.type === 'hour'; }).value;
      return guess - (lh - hh) * 3600e3;
    } catch (e) { return guess; }
  }
  function closeMoment(a, iso) {
    if (a === 'btc') return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) + 864e5;
    return a === 'gold' ? londonToUtc(iso, 15, 0) : londonToUtc(iso, 16, 30);
  }
  function countdown(ms) {
    var diff = ms - Date.now();
    if (diff <= 0) return 'vorbei';
    var mins = Math.floor(diff / 6e4), d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    if (d > 0) return 'in ' + d + (d === 1 ? ' Tag ' : ' Tagen ') + h + ' Std';
    if (h > 0) return 'in ' + h + ' Std ' + m + ' Min';
    return 'in ' + m + ' Min';
  }
  function daysUntil(iso, today) { var n = ENG.daysBetween(today, iso); return n === 0 ? 'heute' : n === 1 ? 'morgen' : n > 0 ? 'in ' + n + ' Tagen' : 'vor ' + (-n) + ' Tagen'; }

  /* ================= Zustand ================= */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function defaults() { var s = clone(START); delete s.comex; delete s.repo; s.weekly = { ftse: [], btc: [], gold: [] }; return s; }
  /* Ältere Speicherstände anheben: Version 2 bringt die Cash-Zuordnung O-5 und die Entscheidung O-11 vom 24.09.2026 */
  function migrate(s) {
    if (!(s.version >= 2)) {
      if (A.every(function (a) { return s.cash[a] == null; })) A.forEach(function (a) { s.cash[a] = START.cash[a]; });
      if (!s.settings.o11) s.settings.o11 = START.settings.o11;
      s.version = 2;
    }
    return s;
  }
  function fillMissing(def, obj) {
    Object.keys(def).forEach(function (k) {
      if (!(k in obj)) obj[k] = clone(def[k]);
      else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && obj[k] && typeof obj[k] === 'object') fillMissing(def[k], obj[k]);
    });
    return obj;
  }
  /* Gespeicherte oder importierte Daten prüfen: nur bekannte Bausteine, gültige Daten und Zahlen */
  var ISO = /^\d{4}-\d{2}-\d{2}$/;
  function sanitize(s) {
    s.tx = (Array.isArray(s.tx) ? s.tx : []).filter(function (t) {
      return t && A.indexOf(t.a) >= 0 && (t.type === 'kauf' || t.type === 'verkauf') && ISO.test(t.d) && ok(t.units) && ok(t.price);
    }).map(function (t) { t.id = String(t.id || 'tx-' + Math.random().toString(36).slice(2)); t.fee = ok(t.fee) ? t.fee : 0; return t; });
    var w = s.weekly && typeof s.weekly === 'object' ? s.weekly : {};
    s.weekly = {};
    A.forEach(function (a) {
      s.weekly[a] = (Array.isArray(w[a]) ? w[a] : []).filter(function (x) { return x && ISO.test(x.k) && ISO.test(x.d) && ok(x.c) && x.c > 0; });
    });
    A.forEach(function (a) { if (s.cash[a] != null && !ok(s.cash[a])) s.cash[a] = null; });
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return migrate(sanitize(fillMissing(defaults(), JSON.parse(raw)))); } catch (e) { /* privater Modus o. Ä. */ }
    return defaults();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ } }
  function saveUi() { try { localStorage.setItem(UIKEY, JSON.stringify({ range: ui.range, perfRange: ui.perfRange, perfMode: ui.perfMode })); } catch (e) { /* ignorieren */ } }

  var state = load();
  var ui = { range: 'max', perfRange: 'max', perfMode: null, hypo: {}, reb: { scen: 'depot', st: {}, px: {} }, sim: { a: 'btc', amount: null, px: null, date: null } };
  try {
    var su = JSON.parse(localStorage.getItem(UIKEY) || '{}');
    ['range', 'perfRange', 'perfMode'].forEach(function (k) { if (su[k]) ui[k] = su[k]; });
  } catch (e) { /* ignorieren */ }

  /* Kursdaten des Datenjobs (site/data/market.js). Fehlen sie, rechnet die App mit den Testdaten aus Anhang A. */
  var MK = typeof MARKET !== 'undefined' && MARKET && MARKET.series ? MARKET : null;
  var LIVE = !!(MK && MK.source !== 'anhang-a');
  var BASE = MK ? MK.series : HIST;
  var REPO = START.repo;
  function autoPrice(a) {
    var s = MK && MK.eur && MK.eur[a];
    return s && s.d.length ? { px: s.c[s.c.length - 1], d: s.d[s.d.length - 1], src: 'Yahoo ' + META[a].eurSym + ', automatisch', auto: true } : null;
  }
  /* Bewertungskurs je Anlage: der neueste Wert aus automatischem Abruf und manueller Eingabe */
  function effPrices() {
    var out = {};
    A.forEach(function (a) {
      var man = state.prices[a], au = autoPrice(a);
      out[a] = au && (!(man.px > 0) || !man.d || au.d >= man.d) ? au : Object.assign({ auto: false }, man);
    });
    return out;
  }
  var M = null;

  function getPath(obj, path) { return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj); }
  function setPath(obj, path, v) { var ks = path.split('.'), last = ks.pop(); var o = ks.reduce(function (o, k) { return o[k]; }, obj); o[last] = v; }

  /* ================= Berechnung ================= */
  function compute() {
    var today = todayIso();
    /* Manuell nachgetragene Wochen nur, solange der Datenjob sie noch nicht geliefert hat */
    var weekly = {};
    A.forEach(function (a) { var lastK = BASE[a].k[BASE[a].k.length - 1]; weekly[a] = (state.weekly[a] || []).filter(function (w) { return w.k > lastK; }); });
    var S = LOGIC.buildSeries(BASE, weekly), R = LOGIC.evalAll(S);
    var prices = effPrices();
    var pf = LOGIC.portfolio(state.tx, prices, state.cash);
    var perf = MK && MK.eur ? LOGIC.performance(state.tx, MK.eur, state.cash, today) : null;
    var cfg = LOGIC.taxCfg(state.tax, state.settings, pf.cash.total, today);
    var ty = ENG.taxYear(cfg, pf.real, state.tax.year);
    var rec = {};
    A.forEach(function (a) { rec[a] = LOGIC.recommend(a, R[a], pf.pos[a].held); });
    return { today: today, S: S, R: R, pf: pf, cfg: cfg, ty: ty, rec: rec, prices: prices, perf: perf, weekly: weekly };
  }

  /* ================= Fachtexte ================= */
  var ASSUMPTIONS = [
    { id: 'A-1', text: 'Baustein-Buchhaltung: Verkaufssignal = ganze Position verkaufen, Erlös bleibt Cash des Bausteins; Kaufsignal legt genau dieses Cash wieder an. Zwischen den Rebalancings kein Umschichten.', app: 'Cash je Baustein im Depot, Kauf/Verkauf buchen das Cash um, Rebalancing-Vorschau.' },
    { id: 'A-2', text: 'Beim Rebalancing bekommt ein nicht investierter Baustein sein Zielgewicht als Cash.', app: 'Rebalancing-Vorschau („Cash +x €, keine Order“).' },
    { id: 'A-3', text: 'Kosten 1 € je Order, Spread beim Bitcoin nicht berücksichtigt (Backtests: 0,1 % je Trade, Bitcoin 0,2 %).', app: 'Gebühr je Order in den Einstellungen und im Transaktionsformular.', setting: 'settings.fee' },
    { id: 'A-4', text: 'Bewertung in Euro über Yahoo: VWCE.DE, BTC-EUR, SGBS.MI. Lang & Schwarz weicht leicht ab.', app: 'Euro-Kurse im Depot, mit Datum und Quelle.' },
    { id: 'A-5', text: 'Gold-Signal aus dem LBMA-Nachmittagsfixing (PM), Gegenprobe mit COMEX GC=F.', app: 'Gold-Reihe der Signale (PM), Gegenprobe im Gold-Signal.' },
    { id: 'A-6', text: 'Gleichstand (Schluss genau auf dem SMA50) setzt beide Zähler zurück. Alle Vergleiche streng.', app: 'Regel-Engine.' },
    { id: 'A-7', text: 'Startzustand beim ersten SMA50: investiert, wenn der Schluss darüber liegt. Mindestens 2 Jahre Historie vorab.', app: 'Regel-Engine; die Testdaten beginnen 03/2024, erster SMA50 im März 2025.' },
    { id: 'A-8', text: 'Zinsen auf das Cash zählen zum Pauschbetrag und werden für den Rest des Jahres geschätzt (Cash × 2,5 % × Restmonate ÷ 12).', app: 'Steuerlage: „Zinsen Rest des Jahres automatisch schätzen“.', setting: 'tax.interestAuto' },
    { id: 'A-9', text: 'Vorabpauschale = Kurs Jahresbeginn × Basiszins × 70 %, im Kaufjahr zeitanteilig, höchstens der Wertzuwachs; 30 % steuerfrei; zählt zum Pauschbetrag des Folgejahres.', app: 'Steuern → Vorabpauschale.' },
    { id: 'A-10', text: 'Die Anzeige „Freistellungsauftrag 1.000,00 € / 933,63 €“ heißt: 933,63 € frei, 66,37 € genutzt.', app: 'Steuerlage, solange O-3 offen ist.', setting: 'tax.fsaMeaning' },
    { id: 'A-11', text: 'Der Bitcoin-Bestand wurde im Juni 2026 gekauft und ist bis Juni 2027 kurzfristig (§ 23).', app: 'Start-Kauflos Bitcoin, als „geschätzt“ markiert (Tag vorsichtig 30.06.).' },
    { id: 'A-12', text: 'Platzhalter im Prototyp, nicht beschlossen: Puffer 25 €, Mindestorder 25 €, Grenzfall < 0,5 %, Vorwarnung < 1,5 %, Vorwarnzeiten Fr 13:15 UTC / So 19:15 UTC.', app: 'Nicht übernommen: Die Felder in den Einstellungen bleiben leer, bis du sie festlegst (O-7, O-8).' }
  ];
  var ASSUMPTIONS_BY_ID = {}; ASSUMPTIONS.forEach(function (x) { ASSUMPTIONS_BY_ID[x.id] = x; });

  var QUESTIONS = [
    { id: 'O-1', q: 'Aus welchen Käufen (Datum, Menge, Kurs) besteht der Bitcoin-Bestand von 0,050467 BTC?', why: 'Haltefrist und FIFO entscheiden, ob ein Verkauf steuerfrei ist.', due: 'Vor dem ersten Bitcoin-Verkauf',
      done: function () { return !state.tx.some(function (t) { return t.a === 'btc' && t.type === 'kauf' && t.est; }); },
      control: function () { return '<a class="btn small" href="#depot" data-goto="tx">Bitcoin-Kauflose im Depot bearbeiten</a> <span class="small muted">Geklärt, sobald kein Bitcoin-Kauf mehr als „geschätzt“ markiert ist.</span>'; } },
    { id: 'O-2', q: 'Sind die „+7,44 €“ der Verkaufsorder vom 05.06.2026 Gewinn oder Erlös?', why: 'Ein kurzfristiger Gewinn zählt zur Freigrenze 2026.', due: 'Vor Dezember',
      done: function () { return state.tax.o2 !== 'offen'; },
      control: function () { return sel('tax.o2', [['offen', 'offen: vorsichtig als Gewinn rechnen'], ['gewinn', 'Gewinn (zählt zur Freigrenze)'], ['erloes', 'Erlös (kein Gewinn)']]); } },
    { id: 'O-3', q: 'Ist 933,63 € der freie oder der genutzte Teil des Freistellungsauftrags?', why: 'Grundlage für steuerfreies Rebalancing.', due: 'Vor Dezember',
      done: function () { return state.tax.fsaMeaning !== 'annahme'; },
      control: function () { return sel('tax.fsaMeaning', [['annahme', 'offen: nach A-10 als frei rechnen'], ['frei', '933,63 € sind frei'], ['genutzt', '933,63 € sind genutzt']]); } },
    { id: 'O-4', q: 'Wie hoch ist dein persönlicher Grenzsteuersatz genau? Bisher nur „unter 30 %“.', why: 'Steuer, wenn die Freigrenze überschritten wird.', due: 'Vor Dezember',
      done: function () { return ok(state.tax.rate); },
      control: function () { return field('tax.rate', 'Grenzsteuersatz in %', 'pct', 'z. B. 28'); } },
    { id: 'O-5', q: 'Wie verteilt sich das Cash von 3.402 € auf die Bausteine?', why: 'Baustein-Buchhaltung (A-1), Betrag beim nächsten Kaufsignal.', due: 'Start am 28.09.2026',
      done: function () { return A.every(function (a) { return state.cash[a] != null; }); },
      control: function () { return '<a class="btn small" href="#depot" data-goto="cash">Cash im Depot zuordnen</a> <span class="small muted">Geklärt, wenn alle drei Bausteine einen Betrag haben (auch 0 €).</span>'; } },
    { id: 'O-6', q: 'Startentscheidung Bitcoin: Die Regel ist seit dem 16.11.2025 draußen, du hältst aber Bitcoin. Handelst du am 28.09. nach der Regel?', why: 'Mögliche Steuer (Beispiel B-8d).', due: '27.09.2026',
      done: function () { return !!state.settings.o6; },
      control: function () { return sel('settings.o6', [['', 'noch offen'], ['regel', 'Ja, nach Regel handeln'], ['halten', 'Nein, Bitcoin vorerst halten']]); } },
    { id: 'O-7', q: 'Ab welchem Abstand zur Schwelle kommt eine Vorwarnung, und wann genau vor dem Wochenschluss?', why: 'Vorwarnung ist beschlossen, die Schwelle nicht.', due: 'Vor der Umsetzung',
      done: function () { var s = state.settings; return ok(s.vorwarnung) && !!s.vorwarnZeitFtseGold && !!s.vorwarnZeitBtc; },
      control: function () { return field('settings.vorwarnung', 'Vorwarn-Abstand in %', 'num', 'leer') + field('settings.vorwarnZeitFtseGold', 'Zeit Fr (FTSE, Gold), UTC', 'time') + field('settings.vorwarnZeitBtc', 'Zeit So (Bitcoin), UTC', 'time'); } },
    { id: 'O-8', q: 'Mindestbetrag je Rebalancing-Order? Sicherheitsabstand zur Freigrenze? Ab welchem Abstand gilt ein Wochenschluss als Grenzfall?', why: 'Kleine Orders vermeiden, Kursschwankung am Handelstag abfedern.', due: 'Vor Dezember',
      done: function () { var s = state.settings; return ok(s.minOrder) && ok(s.buffer) && ok(s.grenzfall); },
      control: function () { return field('settings.minOrder', 'Mindestbetrag je Order in €', 'num', 'leer') + field('settings.buffer', 'Puffer zur Freigrenze in €', 'num', 'leer') + field('settings.grenzfall', 'Grenzfall-Abstand in %', 'num', 'leer'); } },
    { id: 'O-9', q: 'Bitcoin-Rebalancing am 30.12. oder am 31.12.?', why: 'Handelstag.', due: 'Dezember',
      done: function () { return !!state.settings.btcRebalDay; },
      control: function () { return sel('settings.btcRebalDay', [['', 'noch offen'], ['30.12.', 'am 30.12.'], ['31.12.', 'am 31.12.']]); } },
    { id: 'O-10', q: 'Handelt Trade Republic VWCE und den Gold-ETC per Einzelorder auch in Bruchstücken?', why: 'Exakte Beträge beim Rebalancing, sonst auf ganze Stück runden.', due: 'Vor Dezember',
      done: function () { return !!state.settings.fractional; },
      control: function () { return sel('settings.fractional', [['', 'noch offen'], ['ja', 'Ja, Bruchstücke möglich'], ['nein', 'Nein, nur ganze Stück']]); } },
    { id: 'O-11', q: 'Kanal für Benachrichtigungen (Web-Push, E-Mail, Telegram oder anderes), Hosting und Login?', why: 'Technik. Diese Website ist statisch und verschickt noch keine Benachrichtigungen.', due: 'Vor der Umsetzung',
      done: function () { return !!state.settings.o11; },
      control: function () { return field('settings.o11', 'Entscheidung (Notiz)', 'text', 'z. B. Telegram, Vercel, Passkey'); } },
    { id: 'O-12', q: 'Gold-Signal aus dem Vormittags- (AM) oder Nachmittagsfixing (PM) der LBMA?', why: 'Signal kann sich an Grenztagen unterscheiden. Die Daten der App sind PM (A-5).', due: 'Vor der Umsetzung',
      done: function () { return !!state.settings.o12; },
      control: function () { return sel('settings.o12', [['', 'noch offen (PM wird verwendet)'], ['PM', 'PM (Nachmittag)'], ['AM', 'AM (Vormittag), Daten fehlen noch']]); } },
    { id: 'O-13', q: 'Wohin geht neues Geld, woher kommen Entnahmen?', why: 'Baustein-Buchhaltung.', due: 'Später',
      done: function () { return !!state.settings.o13; },
      control: function () { return field('settings.o13', 'Entscheidung (Notiz)', 'text', 'z. B. nach Zielgewicht'); } },
    { id: 'O-14', q: 'Was passiert, wenn Kursdaten fehlen (Feiertag, Quelle nicht erreichbar)?', why: 'Robustheit. Die App zeigt fehlende Wochenschlüsse derzeit als Hinweis an.', due: 'Vor der Umsetzung',
      done: function () { return !!state.settings.o14; },
      control: function () { return sel('settings.o14', [['', 'noch offen'], ['warten', 'Warten'], ['ersatz', 'Ersatzquelle (Alpha Vantage, FMP)'], ['hinweis', 'Nur Hinweis']]); } },
    { id: 'O-15', q: 'Soll die Rebalancing-Vorschau einen offenen Regel-Verkauf (Position gehalten, Regel draußen) als schon erledigt behandeln?', why: 'Vorschau. Der Prototyp tut das; die App rechnet so, bis du entscheidest.', due: 'Vor der Umsetzung',
      done: function () { return !!state.settings.o15; },
      control: function () { return sel('settings.o15', [['', 'noch offen (wie Prototyp: ja)'], ['ja', 'Ja, als erledigt behandeln'], ['nein', 'Nein, Position bleibt wie gehalten']]); } },
    { id: 'O-16', q: 'Mit welchen Kursen bewertet die App das Depot: Yahoo-Börsenkurse oder Kurse von Lang & Schwarz?', why: 'Anzeige.', due: 'Vor der Umsetzung',
      done: function () { return !!state.settings.priceSource; },
      control: function () { return sel('settings.priceSource', [['', 'noch offen'], ['yahoo', 'Yahoo-Börsenkurse (A-4)'], ['ls', 'Lang & Schwarz']]); } },
    { id: 'O-17', q: 'Wie wird die Krypto-Neuregelung berücksichtigt, falls sie Gesetz wird?', why: 'Steuer auf Bitcoin ab 2027.', due: '2027',
      done: function () { return !!state.settings.o17; },
      control: function () { return field('settings.o17', 'Entscheidung (Notiz)', 'text', ''); } }
  ];
  var QBYID = {}; QUESTIONS.forEach(function (q) { QBYID[q.id] = q; });
  function questionDone(id) { return QBYID[id] ? QBYID[id].done() : false; }
  function openCount() { return QUESTIONS.filter(function (q) { return !q.done(); }).length; }

  /* ================= Eingabe-Bausteine ================= */
  var ID_SCOPE = ''; /* Abschnitt, der gerade gerendert wird: macht Feld-IDs seitenweit eindeutig */
  function fid(path) { return 'f-' + (ID_SCOPE ? ID_SCOPE + '-' : '') + path.replace(/\./g, '-'); }
  function field(path, label, type, placeholder, hint) {
    var v = getPath(state, path), id = fid(path);
    var val = v == null ? '' : type === 'pct' ? (ok(v) ? LOGIC.round(v * 100, 4) : '') : v;
    var itype = type === 'pct' || type === 'num' ? 'number' : type === 'date' ? 'date' : type === 'time' ? 'time' : 'text';
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" type="' + itype + '"' +
      (itype === 'number' ? ' step="any"' : '') + ' data-set="' + path + '" data-type="' + type + '" value="' + esc(val) + '"' +
      (placeholder ? ' placeholder="' + esc(placeholder) + '"' : '') + (val === '' ? ' class="empty"' : '') + '>' +
      (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }
  function sel(path, opts, label) {
    var v = getPath(state, path); v = v == null ? '' : String(v);
    var id = fid(path);
    return '<div class="field">' + (label ? '<label for="' + id + '">' + esc(label) + '</label>' : '') + '<select id="' + id + '" data-set="' + path + '" data-type="str"' + (label ? '' : ' aria-label="Antwort"') + '>' +
      opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function parseVal(el) {
    var t = el.getAttribute('data-type'), raw = el.type === 'checkbox' ? el.checked : el.value;
    if (t === 'bool') return !!raw;
    if (t === 'num' || t === 'pct') {
      if (raw === '' || raw == null) return null;
      var x = parseFloat(String(raw).replace(',', '.'));
      if (!isFinite(x)) return null;
      return t === 'pct' ? x / 100 : x;
    }
    if (t === 'str') return raw === '' ? null : raw;
    return raw;
  }

  /* ================= Ansicht: Übersicht ================= */
  function recText(a, rec, pf) {
    var p = pf.pos[a], cash = pf.cash[a];
    var t = { verdict: '', sub: '', branches: [] };
    var holdTxt = p.held ? META[a].instr + ' im Depot (' + eur(p.value) + ')' : 'keine Position im Depot';
    if (rec.code === 'halten') { t.verdict = 'Halten'; t.sub = 'Regel investiert · ' + holdTxt; }
    else if (rec.code === 'nichts') { t.verdict = 'Nichts tun'; t.sub = 'Regel draußen · ' + holdTxt + ' · Geld bleibt Cash'; }
    else if (rec.code === 'kaufen') {
      t.verdict = 'Kaufen';
      t.sub = 'Regel investiert, aber ' + holdTxt + '. Kauf mit dem Cash des Bausteins (' + eur(cash) + ').';
      if (rec.fresh) t.sub += ' Zur Eröffnung am Montag, ' + fdate(rec.trade) + '.';
    } else {
      t.verdict = 'Ganze Position verkaufen';
      t.sub = 'Regel draußen' + (rec.since ? ' seit ' + fdate(rec.since) : '') + ', aber ' + holdTxt + '.';
      if (rec.fresh) t.sub += ' Zur Eröffnung am Montag, ' + fdate(rec.trade) + '.';
    }
    if (rec.branch) {
      var sym = ' $';
      if (rec.code === 'verkaufen') {
        t.verdict = 'Wochenschluss entscheidet';
        t.branches.push(['Schluss über ' + num(rec.branch.thr, 2) + sym, 'Kaufsignal: halten.']);
        t.branches.push(['Sonst', 'Verkaufen am Montag, ' + fdate(rec.nextTrade) + '.']);
      } else {
        t.verdict = 'Wochenschluss entscheidet';
        t.branches.push(['Schluss unter ' + num(rec.branch.thr, 2) + sym, 'Verkaufssignal: nichts kaufen.']);
        t.branches.push(['Sonst', 'Kaufen am Montag, ' + fdate(rec.nextTrade) + '.']);
      }
    } else if (!rec.fresh && (rec.code === 'kaufen' || rec.code === 'verkaufen')) {
      var td = LOGIC.tradeDate(M.today);
      if (td < RS.validFrom) td = RS.validFrom;
      t.sub += ' Umsetzen zur Eröffnung am Montag, ' + fdate(td) + '.';
    }
    return t;
  }

  function nextStepText(a, res) {
    var ns = LOGIC.nextStep(res, RS.rules[a]), thr = usd(ns.thr), dir = ns.cmp === '>' ? 'über' : 'unter';
    if (RS.rules[a].type === 'band') return (ns.to === 1 ? 'Kaufsignal' : 'Verkaufssignal') + ' bei Schluss ' + dir + ' ' + thr;
    if (ns.signal) return 'Schluss ' + dir + ' ' + thr + ' ergibt das ' + (ns.to === 1 ? 'Kaufsignal' : 'Verkaufssignal');
    return 'Schluss ' + dir + ' ' + thr + ' wäre der ' + ns.k + '. von ' + ns.n + ' nötigen Schlüssen ' + (ns.to === 1 ? 'darüber' : 'darunter');
  }
  function counterText(a, L) {
    if (RS.rules[a].type === 'band') return 'Bandregel, kein Zähler';
    if (L.up > 0) return L.up + '. Schluss darüber';
    if (L.dn > 0) return L.dn + '. Schluss darunter';
    return 'Gleichstand, Zähler zurückgesetzt';
  }

  function viewOverview() {
    var pf = M.pf, today = M.today, gain = pf.invested - pf.cost;
    var h = '';
    var stale = A.filter(function (a) { var p = M.prices[a]; return pf.pos[a].held && p && p.d && ENG.daysBetween(p.d, today) > 7; });
    var missingPx = A.filter(function (a) { return pf.pos[a].held && !(M.prices[a] && M.prices[a].px > 0); });

    h += '<h2 class="sr-only">Übersicht</h2><div class="card"><div class="hero"><div><div class="hero-label">Depotwert</div>' +
      '<div class="hero-value">' + eur(pf.total) + '</div>' +
      '<div class="hero-meta">Positionen ' + eur(pf.invested) + ' · Cash ' + eur(pf.cash.total) + ' · Kurse: ' + A.filter(function (a) { return pf.pos[a].held; }).map(function (a) { return META[a].instr + ' ' + fdate(M.prices[a].d); }).join(', ') + (LIVE ? ' (Yahoo)' : '') + '</div></div>' +
      '<div class="tiles" style="flex:1;min-width:280px;max-width:640px">' +
      tile('Einstand der Positionen', eur(pf.cost), 'FIFO, inklusive Gebühren') +
      tile('Gewinn / Verlust', '<span class="' + (gain >= 0 ? 'pos' : 'neg') + '">' + eurS(gain) + '</span>', pct(pf.cost > 0 ? gain / pf.cost : NaN, 2, true) + ' auf den Einstand') +
      tile('Cash', eur(pf.cash.total), pct(pf.cash.total / pf.total, 1) + ' des Depots · Zins ' + pct(state.tax.interestRate, 1)) +
      '</div></div>';
    if (stale.length || missingPx.length) {
      h += '<div class="notes" style="margin-top:12px">' + stale.map(function (a) { return '<div class="note warn">Kurs für ' + META[a].instr + ' ist vom ' + fdate(M.prices[a].d) + ' und damit veraltet. ' + (LIVE ? 'Der Datenjob hat keinen neueren Kurs geliefert.' : 'Aktualisieren unter Depot → Euro-Kurse.') + '</div>'; }).join('') +
        missingPx.map(function (a) { return '<div class="note crit">Für ' + META[a].instr + ' fehlt ein Euro-Kurs. Der Depotwert ist unvollständig.</div>'; }).join('') + '</div>';
    }
    h += '</div>';

    /* Diese Woche */
    h += '<div class="section-title"><h2>Was ist zu tun?</h2>' + chip('beschlossen', 'Regeln ab 28.09.2026', 'Umsetzung der Regeln ab der Woche vom 28.09.2026') + '</div>';
    h += '<div class="grid grid-3">';
    A.forEach(function (a) {
      var rec = M.rec[a], res = M.R[a], L = res.last, t = recText(a, rec, pf), nd = LOGIC.nextCloseDate(a, L.d);
      h += '<div class="card asset-card todo ' + a + '">' +
        '<div class="todo-head"><h3><span class="key ' + a + '"></span>' + META[a].name + '</h3>' + stateBadge(a, L.st) + '</div>' +
        '<div class="verdict">' + esc(t.verdict) + '<small>' + esc(t.sub) + '</small></div>';
      if (t.branches.length) {
        h += '<div class="branches">' + t.branches.map(function (b) { return '<div class="branch"><b>' + esc(b[0]) + '</b><span>' + esc(b[1]) + '</span></div>'; }).join('') + '</div>';
      }
      if (a === 'btc' && rec.code === 'verkaufen') h += btcStartBox();
      h += '<div class="small ink2">Nächster Wochenschluss: <b>' + wd(nd) + '</b> ' + (a === 'btc' ? '24:00 UTC' : a === 'gold' ? '(PM-Fixing 15:00 London)' : '(Börsenschluss London)') +
        ' · ' + countdown(closeMoment(a, nd)) + '<br>' + esc(nextStepText(a, res)) + '.</div>' +
        missingCloseNote(a) +
        '<div><a href="#charts" data-goto="sig-' + a + '" class="small">Signal im Detail →</a></div></div>';
    });
    h += '</div>';

    /* Termine + Daten und Benachrichtigungen */
    h += '<div class="grid grid-2" style="margin-top:16px">' + timelineCard() + statusCard() + '</div>';

    /* Offene Punkte */
    var open = QUESTIONS.filter(function (q) { return !q.done(); });
    var urgent = open.filter(function (q) { return ['O-5', 'O-6', 'O-2', 'O-3', 'O-4'].indexOf(q.id) >= 0; });
    h += '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Offene Fragen aus der Übergabe</h3><a class="btn small" href="#regeln">Alle ansehen</a></div>' +
      '<div class="progress" role="img" aria-label="' + (17 - open.length) + ' von 17 geklärt"><div style="width:' + ((17 - open.length) / 17 * 100) + '%"></div></div>' +
      '<p class="small ink2" style="margin-top:6px">' + (17 - open.length) + ' von 17 geklärt. Die App rät bei offenen Punkten nicht, sondern lässt die Felder leer oder rechnet sichtbar mit der dokumentierten Annahme.</p>' +
      (urgent.length ? '<div class="questions">' + urgent.map(questionHtml).join('') + '</div>' : '') + '</div>';
    return h;
  }

  function statusCard() {
    var h = '<div class="card" id="status"><div class="card-head"><h3>Kursdaten und Benachrichtigungen</h3>' + chip('geklaert', 'O-11') + '</div><div class="notes">';
    if (LIVE) {
      var age = (Date.now() - Date.parse(MK.updated)) / 864e5;
      h += '<div class="note' + (age > 3 ? ' warn' : ' good') + '"><div><b>Kursdaten automatisch</b> von Yahoo Finance und LBMA, zuletzt abgerufen am ' + fdate(MK.updated.slice(0, 10)) + ' um ' + MK.updated.slice(11, 16) + ' UTC' +
        (age > 3 ? '. <b>Seit über drei Tagen kein Abruf</b>: Workflow prüfen.' : '.') + '</div></div>';
    } else {
      h += '<div class="note warn"><div><b>Noch keine automatischen Kursdaten.</b> Die Signale beruhen auf den Testdaten aus Anhang A (bis 18./20.09.2026). Der Datenjob läuft, sobald dieser Stand auf <code>main</code> liegt (siehe README, „Betrieb“).</div></div>';
    }
    (MK && MK.warnings || []).slice(0, 4).forEach(function (w) { if (LIVE) h += '<div class="note"><div>' + esc(w) + ' ' + qref('O-14') + '</div></div>'; });
    var nt = MK && MK.notify, tg;
    if (!nt || nt.configured == null) tg = 'Telegram: Status unbekannt, der Datenjob ist noch nicht gelaufen.';
    else if (!nt.configured) tg = '<b>Telegram ist noch nicht eingerichtet</b>: Die Secrets TELEGRAM_BOT_TOKEN und TELEGRAM_CHAT_ID fehlen im Repo.';
    else tg = '<b>Telegram eingerichtet.</b> ' + (nt.lastSent ? 'Zuletzt gesendet am ' + fdate(nt.lastSent.slice(0, 10)) + '.' : 'Noch keine Nachricht gesendet.');
    h += '<div class="note' + (nt && nt.configured ? ' good' : '') + '"><div>' + tg + (nt && nt.lastError ? '<br><span class="neg">Letzter Fehler: ' + esc(nt.lastError) + '</span>' : '') +
      '<br>Nachricht bei jedem neuen Kauf- oder Verkaufssignal ' + chip('beschlossen') + '. Vorwarnungen folgen, sobald Abstand und Zeiten festgelegt sind ' + qref('O-7') + '.</div></div>';
    h += '</div>';
    var ev = (MK && MK.events) || [];
    h += '<h4 style="margin:14px 0 6px">Gemeldete Signale</h4>' + (ev.length ? '<ul class="timeline">' + ev.slice(0, 5).map(function (e) {
      return '<li><span class="when">' + fdm(e.d) + '<small>' + e.d.slice(0, 4) + '</small></span><span><b>' + (e.to === 1 ? '▲ Kaufsignal ' : '▼ Verkaufssignal ') + META[e.a].name + '</b><br><span class="small ink2">Handel Mo ' + fdate(e.trade) + ' · ' + esc(e.note || '') + '</span></span><span></span></li>';
    }).join('') + '</ul>' : '<p class="small muted">Noch keine. Der Datenjob meldet nur Signale, die nach seinem ersten Lauf entstehen.</p>');
    h += '<p class="small muted" style="margin-top:10px">Zeitplan: Freitag 17:15 UTC (FTSE, Gold), Montag 00:20 UTC (Bitcoin), täglich 21:40 UTC (Euro-Kurse). ' +
      '<a href="https://github.com/' + REPO + '/actions/workflows/daten.yml" target="_blank" rel="noopener">Workflow öffnen</a>: dort unter „Run workflow“ auch eine Testnachricht senden.</p></div>';
    return h;
  }

  function tile(label, value, delta) {
    return '<div class="tile"><div class="label">' + label + '</div><div class="value">' + value + '</div>' + (delta ? '<div class="delta">' + delta + '</div>' : '') + '</div>';
  }
  function stateBadge(a, st) {
    return st === 1 ? '<span class="state in ' + a + '">Regel: investiert</span>' : '<span class="state out">Regel: Cash</span>';
  }

  function btcStartBox() {
    var pf = M.pf, p = pf.pos.btc;
    if (!p.held || !(p.px > 0)) return '';
    var sp = LOGIC.sellPreview('btc', p.lots, p.value, p.px, LOGIC.tradeDate(LOGIC.nextCloseDate('btc', M.R.btc.last.d)), M.cfg, M.ty);
    var dec = state.settings.o6;
    return '<div class="note' + (dec ? '' : ' warn') + '"><div><b>Startentscheidung ' + qref('O-6') + '</b> ' +
      (dec === 'regel' ? 'Du handelst nach der Regel.' : dec === 'halten' ? 'Du hältst Bitcoin vorerst, auch wenn die Regel „verkaufen“ sagt.' : 'Noch offen, spätestens am 27.09.2026.') +
      '<br>Verkauf zum aktuellen Kurs (' + eur(p.px) + '): Gewinn ' + eur(sp.gain) + ', kurzfristige Gewinne 2026 dann ' + eur(sp.s23After) +
      (sp.s23After < TAX.fg ? ', ' + eur(TAX.fg - sp.s23After) + ' unter der Freigrenze: <b>0 € Steuer</b>' : ': <b>über der Freigrenze</b>, alles steuerpflichtig') +
      '. ' + aref('A-11') + ' ' + qref('O-1') + ' ' + qref('O-2') + '</div></div>';
  }

  function missingCloseNote(a) {
    var L = M.R[a].last, nd = LOGIC.nextCloseDate(a, L.d);
    if (Date.now() < closeMoment(a, nd) + 2 * 3600e3) return '';
    return '<div class="note warn">Der Wochenschluss vom ' + wd(nd) + ' fehlt noch. Unter Signale → „Wochenschluss nachtragen“ eintragen. ' + qref('O-14') + '</div>';
  }

  var DONUTS = {};
  function piesCard() {
    var pf = M.pf, T = pf.total, ist = [], ziel = [], rows = '', legIst = [], legZiel = [];
    function tint(a) { return 'color-mix(in srgb, var(--' + a + ') 40%, var(--tint-base))'; }
    A.forEach(function (a) {
      var v = ok(pf.pos[a].value) ? pf.pos[a].value : 0, c = pf.cash[a], tot = v + c, target = RS.weights[a];
      if (v > 0.005) { ist.push({ label: META[a].name + ' investiert', value: v, fill: 'var(--' + a + ')' }); legIst.push(['var(--' + a + ')', META[a].name + ' investiert', v]); }
      if (c > 0.005) { ist.push({ label: META[a].name + ' Cash', value: c, fill: tint(a) }); legIst.push([tint(a), META[a].name + ' Cash', c]); }
      ziel.push({ label: META[a].name, value: T * target, fill: 'var(--' + a + ')' }); legZiel.push(['var(--' + a + ')', META[a].name, T * target]);
      rows += '<tr><td><span class="cell-asset"><span class="key ' + a + '"></span>' + META[a].name + '</span><br><span class="muted small nowrap">Ziel ' + pct(target, 0) + ' = ' + eur(T * target) + '</span></td>' +
        '<td class="r">' + pct(tot / T, 1) + '<br><span class="muted small">' + eur(tot) + '</span></td>' +
        '<td class="r hide-s">' + eur(c) + '<br><span class="muted small">' + (tot > 0 ? pct(c / tot, 0) + ' des Bausteins' : '') + '</span></td>' +
        '<td class="r">' + eurS(tot - T * target) + '<br><span class="muted small">' + sgn((tot / T - target) * 100, 1) + num((tot / T - target) * 100, 1) + ' Pp.</span></td></tr>';
    });
    if (Math.abs(pf.cash.frei) > 0.005) {
      ist.push({ label: 'Cash, nicht zugeordnet', value: pf.cash.frei, fill: 'var(--cash)' }); legIst.push(['var(--cash)', 'Cash, nicht zugeordnet', pf.cash.frei]);
      rows += '<tr><td><span class="cell-asset"><span class="key cash"></span>Cash, nicht zugeordnet</span></td><td class="r">' + pct(pf.cash.frei / T, 1) + '<br><span class="muted small">' + eur(pf.cash.frei) + '</span></td><td class="r hide-s">' + eur(pf.cash.frei) + '</td><td class="r">–</td></tr>';
    }
    DONUTS = { ist: { segments: ist, title: eur(T, 0), sub: 'Ist' }, ziel: { segments: ziel, title: '50 / 30 / 20', sub: 'Ziel' } };
    function legend(items) {
      return '<ul class="pie-legend">' + items.map(function (x) {
        return '<li><i style="background:' + x[0] + '"></i><span>' + esc(x[1]) + '</span><b>' + pct(x[2] / T, 1) + '</b><span class="muted">' + eur(x[2]) + '</span></li>';
      }).join('') + '</ul>';
    }
    return '<div class="card" id="ist-ziel"><div class="card-head"><h3>Ist und Ziel</h3><span>' + chip('beschlossen', 'Ziel 50/30/20') + ' ' + chip('geklaert', 'Cash O-5') + '</span></div>' +
      '<div class="pies"><figure class="pie"><figcaption>Ist</figcaption><div class="donut" data-donut="ist"></div>' + legend(legIst) + '</figure>' +
      '<figure class="pie"><figcaption>Ziel</figcaption><div class="donut" data-donut="ziel"></div>' + legend(legZiel) + '</figure></div>' +
      '<div class="table-wrap" style="margin-top:12px"><table class="compact"><thead><tr><th>Baustein und Ziel</th><th class="r">Ist</th><th class="r hide-s">davon Cash</th><th class="r" title="Abweichung vom Ziel">Abw.</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:8px">Ist je Baustein = Position + Cash des Bausteins ' + aref('A-1') + '. Das Cash ist noch nicht investiert: FTSE und Bitcoin warten auf die Umsetzung ab 28.09., Gold auf sein Kaufsignal. Zuordnung ändern unter „Cash je Baustein“.</p></div>';
  }
  function renderDonuts() {
    var tip = document.getElementById('tooltip'), T = M.pf.total;
    document.querySelectorAll('[data-donut]').forEach(function (el) {
      var d = DONUTS[el.getAttribute('data-donut')]; if (!d) return;
      var size = Math.max(150, Math.min(230, Math.round(el.clientWidth || 220)));
      CHART.donut(el, { segments: d.segments, title: d.title, sub: d.sub, size: size, tip: tip, label: d.sub + ': Aufteilung des Depots',
        fmt: function (v) { return pct(v / T, 1) + ' · ' + eur(v); } });
    });
  }
  function stackbar(parts) {
    return '<div class="stackbar">' + parts.filter(function (p) { return p.w > 0.0005; }).map(function (p) {
      var label = pct(p.w, 1);
      return '<div class="' + p.c + (p.w < 0.12 ? ' tight' : '') + '" style="flex:' + p.w + ' 1 0" title="' + esc(p.label + ': ' + label + ' (' + eur(p.v) + ')') + '">' + label + '</div>';
    }).join('') + '</div>';
  }

  function timelineCard() {
    var today = M.today, items = [];
    var ndF = LOGIC.nextCloseDate('ftse', M.R.ftse.last.d), ndG = LOGIC.nextCloseDate('gold', M.R.gold.last.d), ndB = LOGIC.nextCloseDate('btc', M.R.btc.last.d);
    if (ndF === ndG) items.push({ d: ndF, t: 'Wochenschluss FTSE und Gold', s: 'Börsenschluss London 16:30, LBMA-PM-Fixing 15:00 (Ortszeit)', ms: closeMoment('gold', ndG) });
    else { items.push({ d: ndF, t: 'Wochenschluss FTSE', s: 'Börsenschluss London', ms: closeMoment('ftse', ndF) }); items.push({ d: ndG, t: 'Wochenschluss Gold', s: 'LBMA-PM-Fixing', ms: closeMoment('gold', ndG) }); }
    items.push({ d: ndB, t: 'Wochenschluss Bitcoin', s: 'Sonntag 24:00 UTC', ms: closeMoment('btc', ndB) });
    if (!state.settings.o6 && today <= '2026-09-27') items.push({ d: '2026-09-27', t: 'Startentscheidung Bitcoin', s: qref('O-6'), html: true });
    items.push({ d: RS.validFrom, t: 'Umsetzung der Regeln beginnt', s: chip('beschlossen') + (questionDone('O-5') ? '' : ' Cash-Verteilung ' + qref('O-5')), html: true });
    var rd = state.settings.rebalDate || '2026-12-30';
    items.push({ d: rd, t: 'Rebalancing auf 50/30/20', s: 'Lang & Schwarz: 24.12. und 31.12. kein Handel, 30.12. nur bis 14 Uhr', ms: Date.parse(rd + 'T12:00:00Z') });
    items.push({ d: (state.tax.year + 1) + '-01-02', t: 'Jahreswechsel', s: 'Vorabpauschale wird abgerechnet; Basiszins und VWCE-Jahresanfangskurs eintragen, Pauschbetrag und Freigrenze starten neu' });
    M.pf.pos.btc.lots.concat(M.pf.pos.gold.lots).forEach(function (l) {
      var f = ENG.taxFreeFrom(l.d);
      if (f >= today) items.push({ d: f, t: 'Haltefrist endet (§ 23)', s: 'Kauf vom ' + fdate(l.d) + (l.est ? ', Datum geschätzt' : '') + ': ab diesem Tag steuerfrei' });
    });
    items.sort(function (x, y) { return x.d < y.d ? -1 : x.d > y.d ? 1 : 0; });
    return '<div class="card"><div class="card-head"><h3>Termine</h3></div><ul class="timeline">' + items.map(function (it) {
      return '<li class="' + (it.d < today ? 'past' : '') + '"><span class="when">' + fdm(it.d) + '<small>' + WD[dow(it.d)] + ' ' + it.d.slice(0, 4) + '</small></span>' +
        '<span><b>' + esc(it.t) + '</b><br><span class="small ink2">' + (it.html ? it.s : esc(it.s)) + '</span></span>' +
        '<span class="in">' + (it.ms ? countdown(it.ms) : daysUntil(it.d, today)) + '</span></li>';
    }).join('') + '</ul></div>';
  }

  /* ================= Ansicht: Signale ================= */
  var RANGES = [['1j', '1 J', 52], ['3j', '3 J', 156], ['5j', '5 J', 260], ['max', 'Max', Infinity]];

  var PRANGES = [['1m', '1 M', 31], ['3m', '3 M', 92], ['6m', '6 M', 183], ['1j', '1 J', 366], ['max', 'Max', Infinity]];
  var PERF = null;

  function perfHtml() {
    var p = M.perf, h = '<div class="view-head"><div><h2>Charts</h2><p>Oben die Entwicklung deines Depots in Euro, darunter die Signalcharts je Baustein.</p></div></div>';
    h += '<div class="section-title" style="margin-top:0"><h3>Portfolio-Performance</h3>' + (LIVE ? chip('fakt', 'Yahoo, täglich') : '') + '</div>';
    PERF = null;
    var totalN = p ? p.total.filter(function (v) { return v != null; }).length : 0;
    if (!p || !p.d.length) {
      return h + '<div class="card"><div class="note"><div><b>Der Performance-Chart braucht tägliche Euro-Kurse.</b> Sie kommen mit dem ersten Lauf des Datenjobs von Yahoo (VWCE.DE, BTC-EUR, SGBS.MI) und werden danach täglich ergänzt. ' +
        'Stand heute: Depotwert ' + eur(M.pf.total) + ', Gewinn der Positionen ' + eurS(M.pf.invested - M.pf.cost) + ' (' + pct(M.pf.cost > 0 ? (M.pf.invested - M.pf.cost) / M.pf.cost : NaN, 2, true) + ').</div></div></div>';
    }
    var mode = ui.perfMode || (totalN >= 10 ? 'total' : 'pos');
    if (mode === 'total' && totalN < 2) mode = 'pos';
    var r = PRANGES.filter(function (x) { return x[0] === ui.perfRange; })[0] || PRANGES[4];
    var fromD = r[2] === Infinity ? p.d[0] : ENG.addDays(M.today, -r[2]);
    var i0 = Math.max(0, p.d.findIndex(function (d) { return d >= fromD; }));
    if (mode === 'total') { var ft = p.total.findIndex(function (v, i) { return i >= i0 && v != null; }); if (ft > i0) i0 = ft; }
    var sl = function (arr) { return arr.slice(i0); };
    var d = sl(p.d), val = sl(p.value), cost = sl(p.cost), tot = sl(p.total), last = d.length - 1;
    var kpi, fmtY = null;
    if (mode === 'total') {
      var t0 = tot.find(function (v) { return v != null; }), t1 = tot[last];
      PERF = { d: d, series: [{ label: 'Depotwert inkl. Cash', values: tot, color: 'var(--ink)', area: 'color-mix(in srgb, var(--ink) 6%, transparent)' }],
        extra: function (i) { return tot[i] == null ? [] : [['seit ' + fdate(d[tot.indexOf(t0)]), eurS(tot[i] - t0) + ' (' + pct(tot[i] / t0 - 1, 2, true) + ')']]; } };
      kpi = tile('Depotwert', eur(t1), 'am ' + fdate(d[last])) + tile('Veränderung im Zeitraum', '<span class="' + (t1 - t0 >= 0 ? 'pos' : 'neg') + '">' + eurS(t1 - t0) + '</span>', pct(t1 / t0 - 1, 2, true) + ' seit ' + fdate(d[tot.indexOf(t0)]));
    } else if (mode === 'twr') {
      /* Rendite im Zeitraum: auf den ersten Tag des Zeitraums normiert */
      var tw = sl(p.twr), b0 = tw.find(function (v) { return v != null; }), rel = tw.map(function (v) { return v == null ? null : (1 + v) / (1 + b0) - 1; });
      PERF = { d: d, series: [{ label: 'Rendite der Positionen (zeitgewichtet)', values: rel, color: 'var(--violet)', area: 'color-mix(in srgb, var(--violet) 10%, transparent)' }],
        extra: function (i) { return val[i] == null ? [] : [['Wert der Positionen', eur(val[i])]]; }, pct: true };
      kpi = tile('Rendite im Zeitraum', '<span class="' + (rel[last] >= 0 ? 'pos' : 'neg') + '">' + pct(rel[last], 2, true) + '</span>', 'zeitgewichtet, ohne Einfluss von Käufen') +
        tile('Seit dem ersten Kauf', '<span class="' + (p.twr[p.twr.length - 1] >= 0 ? 'pos' : 'neg') + '">' + pct(p.twr[p.twr.length - 1], 2, true) + '</span>', 'ab ' + fdate(p.d[0]));
    } else {
      PERF = { d: d, series: [{ label: 'Wert der Positionen', values: val, color: 'var(--violet)', area: 'color-mix(in srgb, var(--violet) 10%, transparent)' }, { label: 'Einstand', values: cost, color: 'var(--ink-2)' }],
        extra: function (i) { return val[i] == null ? [] : [['Gewinn', eurS(val[i] - cost[i]) + ' (' + pct(cost[i] > 0 ? val[i] / cost[i] - 1 : NaN, 2, true) + ')']]; } };
      var g = LOGIC.round(val[last], 2) - LOGIC.round(cost[last], 2); /* in Cent wie in der Übersicht */
      kpi = tile('Wert der Positionen', eur(val[last]), 'am ' + fdate(d[last])) + tile('Gewinn auf den Einstand', '<span class="' + (g >= 0 ? 'pos' : 'neg') + '">' + eurS(g) + '</span>', pct(cost[last] > 0 ? val[last] / cost[last] - 1 : NaN, 2, true));
    }
    h += '<div class="filter-row"><span><span class="lbl">Ansicht</span><span class="seg" role="group" aria-label="Ansicht">' +
      '<button type="button" data-perf-mode="total" aria-pressed="' + (mode === 'total') + '"' + (totalN < 2 ? ' disabled title="Depotwert inkl. Cash gibt es erst ab dem Cash-Stichtag ' + fdate(state.cash.date) + '"' : '') + '>Depot gesamt</button>' +
      '<button type="button" data-perf-mode="pos" aria-pressed="' + (mode === 'pos') + '">Positionen</button>' +
      '<button type="button" data-perf-mode="twr" aria-pressed="' + (mode === 'twr') + '">Rendite %</button></span></span>' +
      '<span><span class="lbl">Zeitraum</span><span class="seg" role="group" aria-label="Zeitraum Performance">' + PRANGES.map(function (x) {
        return '<button type="button" data-perf-range="' + x[0] + '" aria-pressed="' + (r[0] === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</span></span></div>';
    h += '<div class="card"><div class="tiles" style="margin-bottom:14px">' + kpi + '</div>' +
      '<div class="legend">' + PERF.series.map(function (x) { return '<span><i class="key line" style="background:' + x.color + '"></i>' + x.label + '</span>'; }).join('') + '</div>' +
      '<div class="chart" data-perf></div>' +
      '<p class="small muted" style="margin:8px 0 0">' + (mode === 'total' ? 'Positionen zu Yahoo-Schlusskursen plus Cash. Das Cash ist erst ab dem Cash-Stichtag ' + fdate(state.cash.date) + ' bekannt; davor zeigt die Ansicht „Positionen“ den Verlauf.'
        : mode === 'twr' ? 'Zeitgewichtete Rendite: Käufe und Verkäufe zählen als Zu- und Abflüsse, nicht als Gewinn. So bleibt die Kurve vergleichbar, auch wenn du nachkaufst. '
        : 'Positionen zu Yahoo-Schlusskursen gegen den FIFO-Einstand. Sprünge sind Käufe oder Verkäufe, keine Kursgewinne. ' + (state.tx.some(function (t) { return t.est; }) ? 'Mindestens ein Kaufdatum ist geschätzt ' + qref('O-1') + '.' : '')) + '</p></div>';
    return h;
  }

  function viewCharts() {
    var n = M.S.ftse.c.length, h = perfHtml();
    h += '<div class="section-title"><h3>Signale</h3><span class="small ink2">Regelstand zum letzten Wochenschluss, US-Dollar-Kurse ' + chip('beschlossen') + ', SMA50 = Durchschnitt der letzten 50 Wochenschlüsse, nur abgeschlossene Wochen.</span></div>';
    h += '<div class="filter-row"><span><span class="lbl">Zeitraum</span><span class="seg" role="group" aria-label="Zeitraum">' + RANGES.map(function (r) {
      var dis = r[2] !== Infinity && r[2] >= n;
      return '<button type="button" data-range="' + r[0] + '" aria-pressed="' + (ui.range === r[0]) + '"' + (dis ? ' disabled title="Die Historie reicht erst bis ' + fdate(M.S.ftse.d[0]) + ' zurück"' : '') + '>' + r[1] + '</button>';
    }).join('') + '</span></span><span class="small muted">' + (LIVE ? 'Yahoo und LBMA, Stand ' + fdate(MK.updated.slice(0, 10)) : 'Testdaten aus Anhang A') + ', Historie ab ' + fdate(M.S.ftse.d[0]) + '.</span></div>';
    A.forEach(function (a) { h += signalCard(a); });
    h += historyCard();
    return h;
  }

  function signalCard(a) {
    var res = M.R[a], L = res.last, S = M.S[a], rule = RS.rules[a], rec = M.rec[a], pf = M.pf;
    var ns = LOGIC.nextStep(res, rule), nd = LOGIC.nextCloseDate(a, L.d);
    var prevSt = res.st[L.i - 1], thrNow = LOGIC.thresholdAt(rule, prevSt, L.m), distThr = L.c / thrNow - 1;
    var sw = L.lastSwitch;
    var h = '<div class="card asset-card ' + a + '" id="sig-' + a + '" style="margin-bottom:16px">';
    h += '<div class="card-head"><h3><span class="key ' + a + '"></span>' + META[a].name + ' <span class="muted small" style="font-weight:400">' + META[a].ruleName + ' · ' + META[a].signal + '</span></h3>' + stateBadge(a, L.st) + '</div>';
    h += '<dl class="facts">' +
      fact('Letzter Wochenschluss', wd(L.d) + ' ' + L.d.slice(0, 4)) +
      fact('Schluss', usd(L.c)) +
      fact('SMA50', usd(L.m)) +
      fact('Abstand zum SMA50', pct(L.dist, 2, true)) +
      fact('Zähler', counterText(a, L)) +
      fact('Letzter Wechsel', sw ? (sw.to === 1 ? 'Kauf ' : 'Verkauf ') + fdate(sw.d) : 'Startzustand (A-7)') +
      fact('Schwelle nächste Woche', (ns.cmp === '>' ? '&gt; ' : '&lt; ') + usd(ns.thr), rule.type === 'band' ? (ns.to === 1 ? '1,03 × S49 / 48,97' : '0,97 × S49 / 49,03') : 'S49 / 49') +
      fact('Bis zum Wechsel', ns.missing + (ns.missing === 1 ? ' Schluss ' : ' Schlüsse ') + (ns.cmp === '>' ? 'darüber' : 'darunter'), rule.type === 'band' ? 'ein Schluss jenseits des Bands' : 'in Folge') +
      '</dl>';
    h += '<div class="notes" style="margin-top:12px">';
    h += '<div class="note"><div><b>Nächster Wochenschluss ' + wd(nd) + '</b> (' + countdown(closeMoment(a, nd)) + '): ' + esc(nextStepText(a, res)) + '. ' +
      'Handlung jetzt: <b>' + { halten: 'Halten', kaufen: 'Kaufen', verkaufen: 'Ganze Position verkaufen', nichts: 'Nichts tun' }[rec.code] + '</b> (Regel ' + (L.st ? 'investiert' : 'draußen') + ', ' + (pf.pos[a].held ? 'Position im Depot' : 'keine Position') + ').</div></div>';
    var gf = state.settings.grenzfall;
    var thrName = rule.type === 'band' ? (prevSt === 0 ? 'Einstiegsschwelle 1,03 × SMA50' : 'Ausstiegsschwelle 0,97 × SMA50') : 'SMA50';
    if (ok(gf) && Math.abs(distThr) * 100 < gf) {
      h += '<div class="note warn"><div><b>Grenzfall</b>: Der letzte Schluss lag nur ' + pct(Math.abs(distThr), 3) + ' (' + usd(Math.abs(L.c - thrNow)) + ') ' + (distThr < 0 ? 'unter' : 'über') + ' der ' + thrName + ' (' + usd(thrNow) + '). Grenze für Grenzfälle: ' + num(gf, 2) + ' % ' + qref('O-8') + '</div></div>';
    } else if (Math.abs(distThr) < 0.01) {
      h += '<div class="note"><div>Der letzte Schluss lag ' + pct(Math.abs(distThr), 3) + ' (' + usd(Math.abs(L.c - thrNow)) + ') ' + (distThr < 0 ? 'unter' : 'über') + ' der ' + thrName + ' (' + usd(thrNow) + '). Ab welchem Abstand das als Grenzfall gilt, ist offen ' + qref('O-8') + '.</div></div>';
    }
    if (a === 'btc' && L.d === '2026-09-20') {
      h += '<div class="note"><div><b>Die Quelle ist Teil der Regel</b>: Yahoo meldet 81.142,61 $ (knapp unter der Schwelle 81.151,39 $), FMP und Alpha Vantage 81.159,64 $ (knapp darüber). Maßgeblich ist Yahoo ' + chip('beschlossen') + '.</div></div>';
    }
    if (a === 'gold') h += comexNote();
    h += missingCloseNote(a) + '</div>';

    h += whatIfHtml(a, ns, nd);

    h += '<div class="legend" style="margin-top:14px"><span><i class="key line ' + a + '" style="background:var(--' + a + ')"></i>Wochenschluss (USD)</span><span><i class="key line" style="background:var(--ink-2)"></i>SMA50</span>' +
      (rule.type === 'band' ? '<span><i class="key" style="background:var(--' + a + '-wash);box-shadow:inset 0 0 0 1px var(--' + a + ')"></i>Band ±3 %</span>' : '') +
      '<span><i class="key ' + a + '"></i>investiert</span><span><i class="key cash"></i>Cash</span><span><span class="tri">▲</span>Kauf</span><span><span class="tri">▼</span>Verkauf</span></div>';
    h += '<div class="chart" data-chart="' + a + '"></div>';
    h += '<p class="small muted" style="margin:6px 0 0">Tipp: Mit der Maus oder dem Finger über das Diagramm fahren; mit Tab fokussieren und mit den Pfeiltasten wochenweise wandern.</p>';

    h += '<details id="d-reason-' + a + '"><summary>Begründung zum letzten Wechsel</summary><div class="details-body">' + reasonHtml(a) + '</div></details>';
    h += '<details id="d-weeks-' + a + '"><summary>Tabelle der letzten Wochen</summary><div class="details-body">' + weeksTable(a, Math.max(49, S.c.length - 12), S.c.length - 1) + '</div></details>';
    h += '<details id="d-weekly-' + a + '"><summary>Wochenschluss von Hand nachtragen</summary><div class="details-body">' + weeklyForm(a) + '</div></details>';
    h += '</div>';
    return h;
  }
  function fact(label, value, small) {
    return '<div><dt>' + label + '</dt><dd>' + value + (small ? '<br><small>' + small + '</small>' : '') + '</dd></div>';
  }

  function comexNote() {
    var c = (MK && MK.comex) || START.comex, L = M.R.gold.last;
    var differs = c.st !== L.st;
    var current = L.d === c.d;
    return '<div class="note' + (differs && current ? ' warn' : '') + '"><div><b>Gegenprobe COMEX GC=F</b> ' + aref('A-5') + ' zum ' + fdate(c.d) + ': Schluss ' + usd(c.c) + ', SMA50 ' + usd(c.m) + ', Abstand ' + pct(c.dist, 2, true) +
      ', Regel ' + (c.st ? 'investiert' : 'Cash') + (c.since ? ' seit ' + fdate(c.since) : '') + '. ' + (differs ? '<b>Weicht vom LBMA-Stand ab</b> (LBMA: ' + (L.st ? 'investiert' : 'Cash') + '). Maßgeblich ist LBMA.' : 'Stimmt mit LBMA überein.') +
      (current ? '' : ' Die Gegenprobe ist nicht auf dem Stand des letzten LBMA-Wochenschlusses.') + ' Welches LBMA-Fixing gilt, ist offen ' + qref('O-12') + '.</div></div>';
  }

  function stateTextAt(a, i) {
    var R = M.R[a], S = M.S[a], rule = RS.rules[a];
    if (R.st[i] == null) return 'Noch kein SMA50 (erst ab dem 50. Wochenschluss)';
    var t = R.st[i] === 1 ? 'Regel investiert' : 'Regel Cash';
    if (rule.type !== 'band') t += R.up[i] > 0 ? ' · ' + R.up[i] + '. Schluss darüber' : R.dn[i] > 0 ? ' · ' + R.dn[i] + '. Schluss darunter' : ' · Gleichstand';
    var sw = (R.sw || []).filter(function (s) { return s.i === i; })[0];
    if (sw) t += ' · ' + (sw.to === 1 ? 'KAUFSIGNAL' : 'VERKAUFSSIGNAL') + ', Handel ' + wd(LOGIC.tradeDate(S.d[i]));
    else if (i > 0 && R.st[i - 1] == null) t += ' · Startzustand (A-7)';
    return t;
  }

  function weeksTable(a, i0, i1, hlIdx) {
    var S = M.S[a], R = M.R[a], rule = RS.rules[a], rows = '';
    for (var i = i1; i >= i0; i--) {
      var M50 = R.sma[i], sw = (R.sw || []).filter(function (s) { return s.i === i; })[0];
      var manual = (state.weekly[a] || []).some(function (w) { return w.k === S.k[i]; });
      rows += '<tr class="' + (sw ? 'signal-row ' + a : '') + (i === hlIdx ? ' hl' : '') + '"><td class="nowrap">' + wd(S.d[i]) + ' ' + S.d[i].slice(0, 4) + (manual ? ' <span class="chip vorschlag" title="manuell nachgetragen">manuell</span>' : '') + '</td>' +
        '<td class="r">' + usd(S.c[i]) + '</td><td class="r">' + usd(M50) + '</td>' +
        (rule.type === 'band' ? '<td class="r">' + usd(M50 * (1 - rule.p)) + ' – ' + usd(M50 * (1 + rule.p)) + '</td>' : '') +
        '<td class="r">' + pct(S.c[i] / M50 - 1, 2, true) + '</td>' +
        (rule.type === 'band' ? '' : '<td class="r">' + R.up[i] + ' / ' + R.dn[i] + '</td>') +
        '<td>' + (R.st[i] === 1 ? 'investiert' : R.st[i] === 0 ? 'Cash' : '–') + '</td>' +
        '<td>' + (sw ? '<b>' + (sw.to === 1 ? 'Kaufsignal' : 'Verkaufssignal') + '</b> → ' + wd(LOGIC.tradeDate(S.d[i])) : '') + '</td></tr>';
    }
    return '<div class="table-wrap"><table><thead><tr><th>Wochenschluss</th><th class="r">Schluss</th><th class="r">SMA50</th>' +
      (rule.type === 'band' ? '<th class="r">Band</th>' : '') + '<th class="r">Abstand</th>' + (rule.type === 'band' ? '' : '<th class="r">über / unter</th>') +
      '<th>Zustand</th><th>Signal</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }

  function reasonHtml(a) {
    var R = M.R[a], S = M.S[a], rule = RS.rules[a], sw = R.last.lastSwitch;
    if (!sw) return '<p class="ink2">In den vorhandenen Daten gab es noch keinen Wechsel. Der Zustand stammt aus dem Startzustand beim ersten SMA50 am ' + fdate(S.d[49]) + ' ' + aref('A-7') + '.</p>';
    var span = rule.type === 'band' ? 2 : rule.n + 1, i0 = Math.max(49, sw.i - span), i1 = Math.min(S.c.length - 1, sw.i + 1);
    var txt;
    if (rule.type === 'band') {
      txt = sw.to === 1 ? 'Der Schluss von ' + usd(sw.c) + ' lag über 1,03 × SMA50 = ' + usd(sw.m * 1.03) + '. Die Bandregel verlangt einen einzigen Schluss über dem oberen Band.'
                        : 'Der Schluss von ' + usd(sw.c) + ' lag unter 0,97 × SMA50 = ' + usd(sw.m * 0.97) + '. Ein einziger Schluss unter dem unteren Band genügt.';
    } else {
      txt = 'Am ' + fdate(sw.d) + ' lag der ' + rule.n + '. Schluss in Folge ' + (sw.to === 1 ? 'über' : 'unter') + ' dem SMA50 (' + usd(sw.c) + ' gegen ' + usd(sw.m) + '). ' +
        'Die ' + META[a].ruleName + ' verlangt ' + rule.n + ' Schlüsse in Folge; ein einzelner Schluss reicht nicht.';
    }
    return '<p class="ink2">' + (sw.to === 1 ? '<b>Kaufsignal</b>' : '<b>Verkaufssignal</b>') + ' am ' + wdl(sw.d) + sw.d.slice(0, 4) + ', Handel zur Eröffnung am Montag, ' + fdate(LOGIC.tradeDate(sw.d)) + '. ' + txt + '</p>' +
      weeksTable(a, i0, i1, sw.i);
  }

  function whatIfHtml(a, ns, nd) {
    var L = M.R[a].last, thr = ns.thr;
    var lo = Math.min(L.c, thr) * 0.92, hi = Math.max(L.c, thr) * 1.08;
    var step = a === 'btc' ? 1 : 0.01;
    var v = ok(ui.hypo[a]) ? ui.hypo[a] : LOGIC.round(L.c, 2);
    function posPct(x) { return Math.max(0, Math.min(100, (x - lo) / (hi - lo) * 100)); }
    return '<div class="whatif" style="margin-top:12px"><div class="small ink2" style="margin-bottom:6px"><b>Was wäre, wenn</b> die Woche am ' + wd(nd) + ' bei diesem Kurs schließt? ' +
      '<span class="muted">Auch als Vorwarnung nutzbar: aktuellen Kurs eintragen.</span></div>' +
      '<div class="whatif-grid"><div><input type="range" min="' + lo.toFixed(2) + '" max="' + hi.toFixed(2) + '" step="' + step + '" value="' + v + '" data-hypo="' + a + '" aria-label="Angenommener Wochenschluss ' + META[a].name + '">' +
      '<div class="scale"><span class="tick thr" style="left:' + posPct(thr) + '%">Schwelle ' + yShort(thr) + '</span>' +
      (Math.abs(posPct(L.c) - posPct(thr)) > 18 ? '<span class="tick" style="left:' + posPct(L.c) + '%">letzter ' + yShort(L.c) + '</span>' : '') + '</div></div>' +
      '<div class="field"><label for="hypo-' + a + '">Schluss in USD</label><input type="number" id="hypo-' + a + '" step="any" value="' + v + '" data-hypo-num="' + a + '"></div></div>' +
      '<div class="whatif-out" id="hypo-out-' + a + '">' + hypoOut(a, v) + '</div></div>';
  }

  function hypoOut(a, C) {
    if (!ok(C) || C <= 0) return '<span class="muted">Bitte einen Kurs eingeben.</span>';
    var res = M.R[a], rule = RS.rules[a], L = res.last, nd = LOGIC.nextCloseDate(a, L.d), ns = LOGIC.nextStep(res, rule);
    var hy = LOGIC.hypo(M.S[a], rule, C, nd), held = M.pf.pos[a].held;
    var dThr = C / ns.thr - 1;
    var cnt = rule.type === 'band' ? '' : (hy.up > 0 ? hy.up + '. Schluss darüber' : hy.dn > 0 ? hy.dn + '. Schluss darunter' : 'Gleichstand, Zähler zurückgesetzt') + ' · ';
    var result, action;
    if (hy.signal) {
      result = hy.signal === 'kauf' ? 'Kaufsignal' : 'Verkaufssignal';
      if (hy.st === 1) action = held ? 'Position halten (liegt schon im Depot).' : 'Kaufen mit dem Cash des Bausteins zur Eröffnung am Montag, ' + fdate(LOGIC.tradeDate(nd)) + '.';
      else action = held ? 'Ganze Position verkaufen zur Eröffnung am Montag, ' + fdate(LOGIC.tradeDate(nd)) + '.' : 'Nichts tun, Geld bleibt Cash.';
    } else {
      result = 'Kein Wechsel, Regel bleibt ' + (hy.st === 1 ? 'investiert' : 'Cash');
      action = hy.st === 1 ? (held ? 'Halten.' : 'Kaufen (ältere Abweichung).') : (held ? 'Ganze Position verkaufen (ältere Abweichung).' : 'Nichts tun.');
    }
    var vw = state.settings.vorwarnung, warn = ok(vw) && Math.abs(dThr) * 100 < vw;
    return '<div>Neuer SMA50 <b>' + usd(hy.sma) + '</b> · Abstand ' + pct(hy.dist, 2, true) + ' · ' + cnt + 'Abstand zur Schwelle ' + pct(dThr, 2, true) + '</div>' +
      '<div style="margin-top:4px"><span class="result">' + result + '.</span> ' + esc(action) +
      (warn ? ' <span class="chip annahme" title="Vorwarn-Abstand ' + esc(num(vw, 2)) + ' %">Vorwarnung</span>' : '') +
      (!ok(vw) ? ' <span class="small muted">Vorwarnschwelle nicht festgelegt ' + qref('O-7') + '</span>' : '') + '</div>';
  }

  function weeklyForm(a) {
    var S = M.S[a], n = S.c.length, lastK = S.k[n - 1], nextK = ENG.addDays(lastK, 7), nd = LOGIC.nextCloseDate(a, S.d[n - 1]);
    var list = (state.weekly[a] || []).slice().sort(function (x, y) { return x.k < y.k ? 1 : -1; });
    return '<p class="small ink2">' + (LIVE ? 'Normalerweise liefert der Datenjob jeden Wochenschluss automatisch. Nur falls er ausfällt: ' : '') + 'Trage den Schlusskurs der nächsten abgeschlossenen Woche ein (Woche ab ' + wd(nextK) + ', Wochenschluss normalerweise ' + wd(nd) + '). ' +
      'Quelle: ' + esc(META[a].signal) + '. Die laufende Woche erst nach ihrem Wochenschluss eintragen.' +
      (a === 'ftse' ? ' Bei bereinigten Kursen skaliert Yahoo nach jeder Ausschüttung die ganze Historie neu: Trage dann zusätzlich den Vorwochenschluss auf der neuen Basis ein, die ältere Historie wird mit dem Verhältnis reskaliert (6.2).' : '') + '</p>' +
      '<div class="fields" data-weekly-form="' + a + '">' +
      '<div class="field"><label for="wk-d-' + a + '">Tag des Wochenschlusses</label><input type="date" id="wk-d-' + a + '" value="' + nd + '"></div>' +
      '<div class="field"><label for="wk-c-' + a + '">Schluss in USD</label><input type="number" step="any" min="0" id="wk-c-' + a + '"></div>' +
      (a === 'ftse' ? '<div class="field"><label for="wk-p-' + a + '">Vorwochenschluss, neue Basis (optional)</label><input type="number" step="any" min="0" id="wk-p-' + a + '"></div>' : '') +
      '<div class="field"><button class="btn primary" type="button" data-act="add-weekly" data-a="' + a + '">Übernehmen</button></div></div>' +
      (list.length ? '<div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Woche ab</th><th>Wochenschluss</th><th class="r">Schluss</th>' + (a === 'ftse' ? '<th class="r">Vorwoche neu</th>' : '') + '<th></th></tr></thead><tbody>' +
        list.map(function (w) {
          return '<tr><td>' + fdate(w.k) + '</td><td>' + wd(w.d) + '</td><td class="r">' + usd(w.c) + '</td>' + (a === 'ftse' ? '<td class="r">' + (w.p ? usd(w.p, 4) : '–') + '</td>' : '') +
            '<td class="r"><button class="btn small danger" type="button" data-act="del-weekly" data-a="' + a + '" data-k="' + w.k + '">Entfernen</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '');
  }

  function historyCard() {
    var all = [];
    A.forEach(function (a) { (M.R[a].sw || []).forEach(function (s) { all.push({ a: a, s: s }); }); });
    all.sort(function (x, y) { return x.s.d < y.s.d ? 1 : -1; });
    return '<div class="card"><div class="card-head"><h3>Verlauf aller Signale</h3><span class="small muted">seit dem ersten SMA50 im März 2025</span></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Wochenschluss</th><th>Baustein</th><th>Signal</th><th class="r">Schluss</th><th class="r">SMA50</th><th class="r">Abstand</th><th>Handel</th></tr></thead><tbody>' +
      all.map(function (x) {
        return '<tr><td class="nowrap">' + wd(x.s.d) + ' ' + x.s.d.slice(0, 4) + '</td><td><span class="cell-asset"><span class="key ' + x.a + '"></span>' + META[x.a].name + '</span></td>' +
          '<td><b>' + (x.s.to === 1 ? '▲ Kauf' : '▼ Verkauf') + '</b></td><td class="r">' + usd(x.s.c) + '</td><td class="r">' + usd(x.s.m) + '</td><td class="r">' + pct(x.s.c / x.s.m - 1, 2, true) + '</td>' +
          '<td class="nowrap">Mo ' + fdate(LOGIC.tradeDate(x.s.d)) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:8px">Startzustände beim ersten SMA50 (' + aref('A-7') + '): ' + A.map(function (a) { return META[a].name + ' ' + (M.R[a].st[49] ? 'investiert' : 'Cash'); }).join(', ') + '.</p></div>';
  }

  function renderCharts() {
    var tip = document.getElementById('tooltip');
    document.querySelectorAll('[data-chart]').forEach(function (el) {
      var a = el.getAttribute('data-chart'), S = M.S[a], n = S.c.length;
      var r = RANGES.filter(function (x) { return x[0] === ui.range; })[0] || RANGES[3];
      var from = r[2] === Infinity ? 0 : Math.max(0, n - 1 - r[2]);
      CHART.signal(el, {
        S: S, R: M.R[a], rule: RS.rules[a], asset: a, from: from, tip: tip,
        label: META[a].name + ': Wochenschlüsse, SMA50 und Regelzustand',
        fmt: { y: function (v) { return usd(v); }, yShort: yShort, yAxis: yAxis, pct: function (v, d, s) { return pct(v, d == null ? 0 : d, s); }, date: fdate, dateShort: fdm },
        stateText: function (i) { return stateTextAt(a, i); }
      });
    });
    var pe = document.querySelector('[data-perf]');
    if (pe && PERF) CHART.lines(pe, { d: PERF.d, series: PERF.series, extra: PERF.extra, tip: tip, label: 'Portfolio-Performance', zero: !!PERF.pct,
      fmt: PERF.pct ? { y: function (v) { return pct(v, 2, true); }, yShort: function (v) { return pct(v, 1, true); }, yAxis: function (v) { return pct(v, Math.abs(v) < 0.1 && v !== 0 ? 1 : 0); }, date: fdate, dateShort: fdm }
        : { y: function (v) { return eur(v); }, yShort: function (v) { return eur(v, 0); }, yAxis: yAxis, date: fdate, dateShort: fdm } });
  }

  /* ================= Ansicht: Depot ================= */
  function viewDepot() {
    var pf = M.pf, today = M.today, h = '';
    h += '<div class="view-head"><div><h2>Depot</h2><p>Bestände nach FIFO, Cash je Baustein ' + aref('A-1') + ' und alle Käufe und Verkäufe. Startdaten laut Trade Republic vom ' + fdate(START.asOf) + ' ' + chip('fakt') + '.</p></div>' +
      '<div class="btn-row"><button class="btn primary" type="button" data-act="tx-new">+ Transaktion erfassen</button></div></div>';
    h += piesCard();

    /* Positionen */
    var rows = '';
    A.forEach(function (a) {
      var p = pf.pos[a], px = M.prices[a];
      if (!p.held) return;
      var ageOld = px && px.d && ENG.daysBetween(px.d, today) > 7;
      rows += '<tr><td><span class="cell-asset"><span class="key ' + a + '"></span>' + esc(META[a].instr) + '</span><br><span class="small muted">' + esc(META[a].isin || META[a].instrLong) + '</span></td>' +
        '<td class="r">' + units(a, p.units) + '</td><td class="r">' + eur(p.cost) + '<br><span class="small muted">' + (p.units > 0 ? eur(ENG.cost(p.lots) / p.units) + ' je ' + (a === 'btc' ? 'BTC' : 'Stück') : '') + '</span></td>' +
        '<td class="r">' + (px && px.px > 0 ? eur(px.px) : '–') + '<br><span class="small ' + (ageOld ? 'neg' : 'muted') + '">' + (px && px.d ? fdate(px.d) + (ageOld ? ' veraltet' : '') : 'kein Kurs') + '</span></td>' +
        '<td class="r">' + eur(p.value) + '</td><td class="r"><span class="' + (p.gain >= 0 ? 'pos' : 'neg') + '">' + eurS(p.gain) + '</span><br><span class="small muted">' + pct(p.gainPct, 2, true) + '</span></td>' +
        '<td class="r">' + pct(p.value / pf.total, 1) + '</td></tr>';
    });
    rows += '<tr><td><span class="cell-asset"><span class="key cash"></span>Cash</span><br><span class="small muted">Zins ' + pct(state.tax.interestRate, 1) + '</span></td><td></td><td></td><td></td><td class="r">' + eur(pf.cash.total) + '</td><td></td><td class="r">' + pct(pf.cash.total / pf.total, 1) + '</td></tr>';
    h += '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Positionen</h3>' + chip('annahme', 'Bewertung A-4', 'Euro-Kurse laut Yahoo; Lang & Schwarz weicht leicht ab. Welche Kurse gelten, ist offen (O-16).') + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Position</th><th class="r">Menge</th><th class="r">Einstand</th><th class="r">Kurs</th><th class="r">Wert</th><th class="r">Gewinn</th><th class="r">Gewicht</th></tr></thead><tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td>Summe</td><td></td><td class="r">' + eur(pf.cost) + '</td><td></td><td class="r">' + eur(pf.total) + '</td><td class="r">' + eurS(pf.invested - pf.cost) + '</td><td class="r">100 %</td></tr></tfoot></table></div></div>';

    h += '<div class="grid grid-2" style="margin-top:16px">' + cashCard() + pricesCard() + '</div>';
    h += lotsCard();
    h += txCard();
    h += dataCard();
    return h;
  }

  function cashCard() {
    var pf = M.pf, c = state.cash;
    var inputs = A.map(function (a) {
      return '<div class="field"><label for="cash-' + a + '"><span class="key ' + a + '"></span> ' + META[a].name + '</label>' +
        '<input type="number" step="any" id="cash-' + a + '" data-set="cash.' + a + '" data-type="num" value="' + (c[a] == null ? '' : c[a]) + '" placeholder="nicht zugeordnet"' + (c[a] == null ? ' class="empty"' : '') + '>' +
        '<span class="hint">aktuell ' + eur(pf.cash[a]) + '</span></div>';
    }).join('');
    return '<div class="card" id="cash"><div class="card-head"><h3>Cash je Baustein</h3>' + qref('O-5') + '</div>' +
      '<p class="small ink2">Nach ' + aref('A-1') + ' gehört jedes Cash zu einem Baustein: Ein Verkauf schreibt ihm den Erlös gut, ein Kauf zieht ihn ab. Das Start-Cash vom 24.09.2026 ist bis zum Ziel verteilt: FTSE 44,71 €, Bitcoin 522,39 €, Gold 2.834,90 €. Nicht zugeordnetes Cash verteilt die Rebalancing-Vorschau nach den Zielgewichten.</p>' +
      '<div class="fields">' + field('cash.total', 'Cash gesamt am Stichtag (€)', 'num') + field('cash.date', 'Stichtag des Cash-Stands', 'date', '', 'Spätere Buchungen verändern das Cash') + '</div>' +
      '<div class="fields" style="margin-top:12px">' + inputs + '</div>' +
      '<div class="kv" style="margin-top:12px"><dt>Nicht zugeordnet</dt><dd>' + eur(pf.cash.frei) + '</dd><dt>Cash gesamt heute</dt><dd>' + eur(pf.cash.total) + '</dd></div>' +
      (pf.cash.frei < -0.005 ? '<div class="note crit" style="margin-top:8px">Die Zuordnung übersteigt das Cash. Bitte Beträge prüfen.</div>' : '') +
      (pf.cashNotes.length ? '<div class="note" style="margin-top:8px">' + pf.cashNotes.map(function (x) { return 'Kauf ' + META[x.a].name + ' am ' + fdate(x.d) + ': ' + eur(x.fromFree) + ' aus nicht zugeordnetem Cash genommen.'; }).join('<br>') + '</div>' : '') +
      '<div class="btn-row" style="margin-top:10px"><button class="btn small" type="button" data-act="cash-fill">Bis zum Ziel auffüllen (O-5)</button><button class="btn small" type="button" data-act="cash-clear">Zuordnung leeren</button></div></div>';
  }

  function pricesCard() {
    var today = M.today;
    return '<div class="card"><div class="card-head"><h3>Euro-Kurse für die Bewertung</h3><span>' + aref('A-4') + ' ' + qref('O-16') + '</span></div>' +
      '<p class="small ink2">Nur für Bewertung, Rebalancing und Performance, nicht für die Signale. ' + (LIVE ? 'Der Datenjob holt sie täglich von Yahoo. Ein manueller Kurs gilt nur, wenn er neuer ist als der automatische.' : 'Bis der Datenjob läuft, gelten die Kurse vom 24.09.2026 oder deine Eingaben.') + '</p>' +
      A.map(function (a) {
        var e = M.prices[a], p = state.prices[a], old = e.d && ENG.daysBetween(e.d, today) > 7;
        return '<div style="margin-top:12px"><div class="kv"><dt><span class="key ' + a + '"></span> ' + META[a].instr + ' <span class="muted">(' + META[a].eurSym + ')</span></dt><dd>' + (e.px > 0 ? eur(e.px) : '–') + '</dd></div>' +
          '<div class="small ' + (old ? 'neg' : 'muted') + '">' + (e.px > 0 ? 'vom ' + fdate(e.d) + (old ? ', veraltet' : '') + ' · ' + esc(e.src || '') : 'noch kein Kurs') + '</div>' +
          '<details id="d-px-' + a + '"><summary class="small">Manuell überschreiben</summary><div class="details-body"><div class="fields">' +
          '<div class="field"><label for="px-' + a + '">Kurs in €</label><input type="number" step="any" min="0" id="px-' + a + '" data-set="prices.' + a + '.px" data-type="num" value="' + (p.px == null ? '' : p.px) + '" placeholder="kein Kurs"' + (p.px == null ? ' class="empty"' : '') + '></div>' +
          '<div class="field"><label for="pxd-' + a + '">Kursdatum</label><input type="date" id="pxd-' + a + '" data-set="prices.' + a + '.d" data-type="date" value="' + (p.d || '') + '"></div>' +
          '<div class="field"><label for="pxs-' + a + '">Quelle</label><input type="text" id="pxs-' + a + '" data-set="prices.' + a + '.src" data-type="text" value="' + esc(p.src || '') + '"></div></div></div></details></div>';
      }).join('') + '</div>';
  }

  function lotsCard() {
    var pf = M.pf, today = M.today, rows = '';
    A.forEach(function (a) {
      var px = pf.pos[a].px;
      pf.pos[a].lots.forEach(function (l) {
        var cls, freeFrom = a === 'ftse' ? null : ENG.taxFreeFrom(l.d);
        if (a === 'ftse') cls = '§ 20, 30 % Teilfreistellung';
        else cls = (freeFrom <= today ? 'steuerfrei seit ' : 'steuerfrei ab ') + fdate(freeFrom) + (freeFrom > today ? ' <span class="muted">(' + daysUntil(freeFrom, today) + ')</span>' : '');
        var v = px > 0 ? l.units * px : NaN;
        rows += '<tr><td><span class="cell-asset"><span class="key ' + a + '"></span>' + META[a].instr + '</span></td><td class="nowrap">' + fdate(l.d) + (l.est ? ' ' + chip('annahme', 'geschätzt') : '') + '</td>' +
          '<td class="r">' + units(a, l.units) + '</td><td class="r">' + eur(l.cpu) + '</td><td class="r">' + eur(l.units * l.cpu) + '</td><td class="r">' + eur(v) + '</td>' +
          '<td class="r"><span class="' + (v - l.units * l.cpu >= 0 ? 'pos' : 'neg') + '">' + eurS(v - l.units * l.cpu) + '</span></td><td>' + cls + '</td></tr>';
      });
    });
    return '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Kauflose nach FIFO</h3>' + chip('fakt', 'FIFO ist Pflicht') + '</div>' +
      '<div class="table-wrap"><table><thead><tr><th>Baustein</th><th>Kaufdatum</th><th class="r">Restmenge</th><th class="r">Einstand je Stück</th><th class="r">Einstand</th><th class="r">Wert</th><th class="r">Gewinn</th><th>Steuerliche Einordnung</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="8" class="muted">Keine Bestände.</td></tr>') + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:8px">Einstand je Stück inklusive Gebühr. Bitcoin und Gold-ETC (§ 23): Jahresfrist endet am gleichen Kalendertag des Folgejahres, steuerfrei ab dem Tag danach.</p></div>';
  }

  function txCard() {
    var realById = {};
    M.pf.real.forEach(function (r) { if (r.id) realById[r.id] = r; });
    var list = state.tx.slice().sort(function (x, y) { return x.d < y.d ? 1 : x.d > y.d ? -1 : 0; });
    return '<div class="card" style="margin-top:16px" id="tx"><div class="card-head"><h3>Transaktionen</h3><button class="btn small" type="button" data-act="tx-new">+ Erfassen</button></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Datum</th><th>Baustein</th><th>Art</th><th class="r">Menge</th><th class="r">Kurs</th><th class="r">Gebühr</th><th class="r">Betrag</th><th>Notiz</th><th></th></tr></thead><tbody>' +
      list.map(function (t) {
        var r = realById[t.id];
        return '<tr><td class="nowrap">' + fdate(t.d) + (t.est ? ' ' + chip('annahme', 'geschätzt') : '') + '</td><td><span class="cell-asset"><span class="key ' + t.a + '"></span>' + META[t.a].instr + '</span></td>' +
          '<td>' + (t.type === 'kauf' ? 'Kauf' : 'Verkauf') + '</td><td class="r">' + units(t.a, t.units) + '</td><td class="r">' + eur(t.price) + '</td><td class="r">' + eur(t.fee || 0) + '</td>' +
          '<td class="r">' + eur(t.units * t.price + (t.type === 'kauf' ? 1 : -1) * (t.fee || 0)) + (r ? '<br><span class="small ' + (r.gain >= 0 ? 'pos' : 'neg') + '">Gewinn ' + eurS(r.gain) + '</span>' : '') + '</td>' +
          '<td class="small">' + esc(t.note || '') + '<br><span class="muted">' + (t.src === 'screenshot' ? 'Screenshot/PDF' : 'manuell') + '</span></td>' +
          '<td class="r nowrap"><button class="btn small" type="button" data-act="tx-edit" data-id="' + esc(t.id) + '">Bearbeiten</button> <button class="btn small danger" type="button" data-act="tx-del" data-id="' + esc(t.id) + '">Löschen</button></td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="small muted" style="margin-top:8px">Buchungen nach dem Stichtag des Cash-Stands (' + fdate(state.cash.date) + ') verändern das Cash des Bausteins ' + aref('A-1') + '. Die App führt keine Orders aus.</p></div>';
  }

  function dataCard() {
    return '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Daten sichern</h3></div>' +
      '<p class="small ink2">Alle Eingaben liegen nur in diesem Browser. Exportiere sie regelmäßig als Datei; der Import ersetzt den aktuellen Stand.</p>' +
      '<div class="btn-row"><button class="btn" type="button" data-act="export">Daten exportieren (JSON)</button>' +
      '<label class="btn" for="import-file">Daten importieren</label><input type="file" id="import-file" accept="application/json,.json" class="hidden">' +
      '<button class="btn danger" type="button" data-act="reset">Auf Startdaten zurücksetzen</button></div></div>';
  }

  /* ================= Ansicht: Rebalancing ================= */
  var SCENARIOS = [['depot', 'Mein Depot'], ['B-12A', 'B-12 A'], ['B-12B', 'B-12 B'], ['B-9', 'B-9'], ['B-10', 'B-10'], ['B-11', 'B-11']];

  function rebInput() {
    var sc = ui.reb.scen, date = state.settings.rebalDate || '2026-12-30';
    if (LOGIC.EXAMPLES[sc]) return { input: clone(LOGIC.EXAMPLES[sc].input), example: LOGIC.EXAMPLES[sc] };
    var tx = state.tx, stOv = {}, pxOv = {};
    A.forEach(function (a) { var v = ui.reb.st[a]; if (v === '1' || v === '0') stOv[a] = +v; if (ok(ui.reb.px[a])) pxOv[a] = ui.reb.px[a]; });
    var prices = M.prices, cash = state.cash;
    if (sc === 'B-12A' || sc === 'B-12B') {
      tx = START.tx.slice(); prices = START.prices; cash = START.cash; stOv = { btc: 1 }; pxOv = {};
      if (sc === 'B-12B') { stOv = {}; tx = tx.concat([{ id: 'b12b', d: '2026-09-28', a: 'btc', type: 'verkauf', units: 0.050467, price: 70700, fee: 0 }]); }
    }
    var pf = LOGIC.portfolio(tx, prices, cash);
    var cfg = LOGIC.taxCfg(sc === 'depot' ? state.tax : START.tax, sc === 'depot' ? state.settings : START.settings, pf.cash.total, sc === 'depot' ? M.today : START.asOf);
    if (sc !== 'depot') cfg.minOrder = 0;
    var ty = ENG.taxYear(cfg, pf.real, state.tax.year);
    var st = {}; A.forEach(function (a) { st[a] = M.R[a].last.st; });
    if (sc !== 'depot') st = { ftse: 1, btc: 0, gold: 0 }; /* Regelstand vom 18./20.09.2026 (5.2) */
    return { input: LOGIC.rebalanceInput(pf, st, { date: date, stOverride: stOv, px: pxOv, o15: sc === 'depot' ? state.settings.o15 : null }, cfg, ty), pf: pf };
  }

  function viewRebal() {
    var sc = ui.reb.scen, today = M.today, rd = state.settings.rebalDate || '2026-12-30';
    var h = '<div class="view-head"><div><h2>Rebalancing-Vorschau</h2><p>Einmal im Jahr zum Jahresende zurück auf 50/30/20 ' + chip('beschlossen') + '. Beide Varianten nebeneinander: steuerfrei und voll. Du entscheidest jedes Jahr im Dezember.</p></div></div>';
    h += '<div class="filter-row"><span><span class="lbl">Grundlage</span><span class="seg" role="group" aria-label="Szenario">' + SCENARIOS.map(function (s) {
      return '<button type="button" data-scen="' + s[0] + '" aria-pressed="' + (sc === s[0]) + '">' + s[1] + '</button>';
    }).join('') + '</span></span></div>';

    var ri = rebInput(), inp = ri.input, res = LOGIC.rebalanceBoth(inp);
    if (ri.example) {
      h += '<div class="card"><h3>' + esc(ri.example.title) + ' <span class="chip fakt">Rechenbeispiel, erfundene Werte</span></h3><p class="ink2" style="margin-top:6px">' + esc(ri.example.text) + '</p>' +
        '<div class="note"><div><b>Erwartung laut Übergabe:</b> ' + esc(ri.example.expect) + '</div></div>' + examplesCheck(sc, res) + '</div>';
    } else if (sc === 'B-12A' || sc === 'B-12B') {
      h += '<div class="card"><h3>' + (sc === 'B-12A' ? 'B-12 A: Kaufsignal Bitcoin am 27.09.' : 'B-12 B: Bitcoin am 28.09. zu 70.700 € nach Regel verkauft') + ' <span class="chip fakt">Startdepot, nur zur Veranschaulichung</span></h3>' +
        '<p class="ink2" style="margin-top:6px">Startdepot vom 24.09.2026 mit Kursen VWCE 168,92 € und Bitcoin 73.908,69 €. Das Cash ist keinem Baustein zugeordnet ' + qref('O-5') + ' und wird nach Zielgewichten verteilt; das ergibt dieselben Orders wie die Rechnung im Dokument, die es ganz dem Gold zuordnet.</p>' +
        '<div class="note"><div><b>Erwartung laut Übergabe:</b> ' + (sc === 'B-12A' ? 'FTSE Kauf 44,71 €, Bitcoin Kauf 522,39 €, Gold Cash 2.834,90 €, Steuer 0 €.' : 'FTSE Verkauf 36,25 €, Bitcoin Cash 4.203,76 €, Gold Cash 2.802,51 €, Steuer 0 € (kurzfristige Gewinne 2026: 799,19 €).') + '</div></div>' + examplesCheck(sc, res) + '</div>';
    } else {
      h += '<div class="card"><div class="card-head"><h3>Annahmen der Vorschau</h3><span class="small ink2">Stichtag ' + wd(rd) + ' ' + rd.slice(0, 4) + ' · ' + daysUntil(rd, today) + '</span></div><div class="fields">' +
        field('settings.rebalDate', 'Stichtag', 'date', '', 'Annahme: 30.12. (L&S 31.12. geschlossen); Bitcoin 30. oder 31.12. ' + qref('O-9')) +
        A.map(function (a) {
          var cur = M.R[a].last.st, v = ui.reb.st[a] || 'aktuell';
          return '<div class="field"><label for="rst-' + a + '"><span class="key ' + a + '"></span> Regelstand ' + META[a].name + '</label><select id="rst-' + a + '" data-reb-st="' + a + '">' +
            '<option value="aktuell"' + (v === 'aktuell' ? ' selected' : '') + '>wie heute (' + (cur ? 'investiert' : 'Cash') + ')</option>' +
            '<option value="1"' + (v === '1' ? ' selected' : '') + '>investiert</option><option value="0"' + (v === '0' ? ' selected' : '') + '>Cash</option></select></div>';
        }).join('') + '</div><div class="fields" style="margin-top:12px">' +
        A.map(function (a) {
          var cur = M.pf.pos[a].px;
          return '<div class="field"><label for="rpx-' + a + '">Kurs ' + META[a].instr + ' am Stichtag (€)</label><input type="number" step="any" min="0" id="rpx-' + a + '" data-reb-px="' + a + '" value="' + (ok(ui.reb.px[a]) ? ui.reb.px[a] : '') + '" placeholder="' + (cur > 0 ? 'aktuell ' + num(cur, 2) : 'kein Kurs') + '"></div>';
        }).join('') +
        '<div class="field"><label for="f-settings-o15">Offener Regel-Verkauf ' + qref('O-15') + '</label><select id="f-settings-o15" data-set="settings.o15" data-type="str">' +
        [['', 'offen (wie Prototyp)'], ['ja', 'als erledigt behandeln'], ['nein', 'Position bleibt']].map(function (o) { return '<option value="' + o[0] + '"' + ((state.settings.o15 || '') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '</div><p class="small muted" style="margin-top:8px">Grundlage: aktueller Regelstand, Euro-Kurse, FIFO-Lose und die Steuerlage ' + state.tax.year + ' (Steuern-Tab). Die Vorschau rechnet nach jedem Wochenschluss neu. Die echte Rechnung hängt von Kursen und Regelständen am Stichtag ab.</p></div>';
    }

    h += '<div class="grid grid-2" style="margin-top:16px">' + variantCard('frei', res.frei, inp) + variantCard('voll', res.voll, inp) + '</div>';
    h += rebalHints(inp, res);
    return h;
  }

  function variantCard(v, r, inp) {
    var rows = '';
    A.forEach(function (a) {
      var x = r.rows[a], lines = [], gain = '–', cls = '';
      function line(badge, amount, sub) { lines.push('<div class="act-line">' + badge + ' <b class="num">' + amount + '</b>' + (sub ? '<div class="small muted">' + sub + '</div>' : '') + '</div>'); }
      if (x.ruleSale) line('<span class="action verkauf">Verkauf (Regel)</span>', eur(x.sell), units(a, x.sellUnits));
      else if (x.sell > 0.5) line('<span class="action verkauf">Verkauf</span>' + (x.capped ? '<span class="opt" title="durch Pauschbetrag bzw. Freigrenze gedeckelt">gedeckelt</span>' : '') + (x.sellOptional ? '<span class="opt">optional</span>' : ''), eur(x.sell), units(a, x.sellUnits));
      if (x.buy > 0.5) line('<span class="action kauf">Kauf</span>' + (x.buyOptional ? '<span class="opt">optional</span>' : ''), eur(x.buy), x.buyUnits == null ? 'Kurs fehlt, Stück unbekannt' : units(a, x.buyUnits));
      if (x.st === 0 && Math.abs(x.cashTo) > 0.005) line('<span class="action cash">Cash ' + (x.cashTo > 0 ? '+' : '−') + '</span>', eur(Math.abs(x.cashTo)), 'keine Order');
      if (!lines.length) lines.push('<span class="action none">keine Änderung</span>');
      if (x.sell > 0.5) {
        gain = eurS(a === 'ftse' ? x.g20 : x.sg + x.lg);
        if (a === 'ftse') cls = '§ 20: ' + eur(x.t20) + ' steuerpflichtig';
        else cls = '§ 23: ' + [Math.abs(x.sg) > 0.005 ? eur(x.sg) + ' kurzfristig' : '', Math.abs(x.lg) > 0.005 ? eur(x.lg) + ' steuerfrei' : ''].filter(Boolean).join(', ');
      }
      rows += '<tr><td><span class="cell-asset"><span class="key ' + a + '"></span>' + META[a].name + '</span><div class="small muted">Ziel ' + eur(x.G) + '<br>Regel ' + (x.st ? 'investiert' : 'Cash') + '</div></td>' +
        '<td>' + lines.join('') + '</td><td class="r">' + gain + (cls ? '<div class="small muted" style="white-space:normal">' + cls + '</div>' : '') + '</td>' +
        '<td class="r">' + eur(x.after) + '<div class="small muted">' + pct(x.wAfter, 2) + '</div></td></tr>';
    });
    if (r.cashFree > 0.005) rows += '<tr><td colspan="4" class="small ink2"><span class="key cash"></span> Nicht zugeordnetes Cash ' + eur(r.cashFree) + ' wird auf die Bausteine verteilt ' + qref('O-5') + '.</td></tr>';

    var taxTxt = ok(r.tax) ? eur(r.tax) : 'offen';
    var t23 = ok(r.tax23) ? eur(r.tax23) : eur(r.s23After) + ' × Grenzsteuersatz';
    var weights = A.map(function (a) { return { c: a, w: r.rows[a].wAfter, label: META[a].name, v: r.rows[a].after }; });
    var fillTxt = r.fill > 0 ? pct(Math.min(1, r.fill), 1) : '100 %';
    var pbMax = Math.max(r.free20, 1);
    return '<div class="card variant"><div class="v-head"><h3>' + (v === 'frei' ? 'Steuerfrei' : 'Voll auf 50/30/20') + '</h3><span class="small muted">' + (v === 'frei' ? 'Verkäufe gedeckelt durch Pauschbetrag und Freigrenze' : 'Ziele vollständig, Steuer möglich') + '</span></div>' +
      '<div><div class="small ink2">Geschätzte Steuer</div><div class="v-tax">' + taxTxt + '</div><div class="small ink2">§ 20: ' + eur(r.tax20) + ' · § 23: ' + t23 + ' · ' + r.orders + (r.orders === 1 ? ' Order' : ' Orders') + ' (Gebühren ' + eur(r.fees) + ')</div>' +
      (!ok(r.tax) ? '<div class="note warn" style="margin-top:6px">Die Summe der kurzfristigen Gewinne erreicht die Freigrenze. Die ganze Summe ist steuerpflichtig; dein Grenzsteuersatz fehlt noch ' + qref('O-4') + '.</div>' : '') + '</div>' +
      '<div class="table-wrap"><table class="reb-table"><thead><tr><th>Baustein</th><th>Aktion</th><th class="r">Gewinn</th><th class="r">Danach</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div><div class="small ink2" style="margin-bottom:6px">Gewichte danach</div>' + stackbar(weights) + '</div>' +
      '<dl class="kv"><dt>Ziele erreicht zu</dt><dd>' + fillTxt + (r.fill > 0 && r.fill < 0.9995 ? ' <span class="small muted">(f = ' + num(r.fill, 3) + ')</span>' : '') + '</dd>' +
      '<dt>Freier Pauschbetrag danach</dt><dd>' + eur(r.pbLeft) + ' <span class="small muted">von ' + eur(r.free20) + '</span></dd>' +
      '<dt>Kurzfristige Gewinne § 23 im Jahr</dt><dd>' + eur(r.s23After) + ' <span class="small muted">Freigrenze ' + eur(TAX.fg, 0) + '</span></dd></dl>' +
      meterHtml([{ v: Math.min(r.new20, pbMax), c: 'm-new', l: 'dieses Rebalancing (steuerpflichtig § 20)' }], pbMax, null, 'Pauschbetrag') +
      meterHtml([{ v: Math.max(0, r.s23After), c: r.s23After >= TAX.fg ? 'm-over' : 'm-new', l: 'kurzfristige Gewinne' }], Math.max(TAX.fg * 1.2, r.s23After), TAX.fg, 'Freigrenze (Klippe bei 1.000 €)') +
      '</div>';
  }

  function meterHtml(segs, max, mark, label) {
    return '<div><div class="small ink2" style="margin-bottom:4px">' + esc(label) + '</div><div class="meter-wrap"><div class="meter">' +
      segs.map(function (s) { return s.v > 0 ? '<div class="' + s.c + '" style="width:' + Math.min(100, s.v / max * 100) + '%" title="' + esc(s.l + ': ' + eur(s.v)) + '"></div>' : ''; }).join('') + '</div>' +
      (mark != null ? '<div class="meter-mark" style="left:' + (mark / max * 100) + '%" title="Freigrenze ' + eur(mark, 0) + '"></div>' : '') + '</div>' +
      '<div class="meter-legend">' + segs.map(function (s) { return '<span><i class="' + s.c + '"></i>' + esc(s.l) + ' ' + eur(s.v) + '</span>'; }).join('') + (mark != null ? '<span><i style="background:var(--crit);width:2px"></i>Freigrenze</span>' : '') + '</div></div>';
  }

  function examplesCheck(sc, res) {
    var c = [];
    function chk(label, got, want, d) { c.push([label + ': ' + num(got, d == null ? 2 : d) + (Math.abs(LOGIC.round(got, d == null ? 2 : d) - want) < 1e-9 ? '' : ' (erwartet ' + num(want, d == null ? 2 : d) + ')'), Math.abs(LOGIC.round(got, d == null ? 2 : d) - want) < 1e-9]); }
    var f = res.frei, v = res.voll;
    if (sc === 'B-9') { chk('Steuer', f.tax, 0); chk('Orders', f.orders, 2, 0); chk('Freier Pauschbetrag danach', f.pbLeft, 866.84); chk('FTSE-Verkauf', f.rows.ftse.sell, 600); chk('Bitcoin-Kauf', f.rows.btc.buy, 200); }
    if (sc === 'B-10') { chk('Voll: Steuer (25 %)', v.tax, 283.33); chk('Steuerfrei: Bitcoin-Verkauf', f.rows.btc.sell, 899.98); chk('Steuerfrei: f', f.fill, 0.75); chk('Steuerfrei: Gewicht FTSE %', f.rows.ftse.wAfter * 100, 48.93); }
    if (sc === 'B-11') { chk('Voll: Steuer § 20', v.tax20, 42.86); chk('Steuerfrei: FTSE-Verkauf', f.rows.ftse.sell, 380.95); chk('Steuerfrei: f', f.fill, 0.381, 3); chk('Steuerfrei: Gewicht FTSE %', f.rows.ftse.wAfter * 100, 54.42); }
    if (sc === 'B-12A') { chk('FTSE-Kauf', f.rows.ftse.buy, 44.71); chk('Bitcoin-Kauf', f.rows.btc.buy, 522.39); chk('Gold-Cash', f.rows.gold.after, 2834.90); chk('Steuer', f.tax, 0); }
    if (sc === 'B-12B') { chk('FTSE-Verkauf', f.rows.ftse.sell, 36.25); chk('Bitcoin-Cash', f.rows.btc.after, 4203.76); chk('Gold-Cash', f.rows.gold.after, 2802.51); chk('Kurzfristige Gewinne 2026', f.s23After, 799.19); }
    return '<ul class="check-list" style="margin-top:10px">' + c.map(function (x) { return '<li class="' + (x[1] ? '' : 'fail') + '">' + esc(x[0]) + '</li>'; }).join('') + '</ul>';
  }

  function rebalHints(inp, res) {
    var lots = [];
    ['btc', 'gold'].forEach(function (a) { (inp.pos[a] || []).forEach(function (l) { lots.push(META[a].name + ' vom ' + fdate(l.d) + (l.est ? ' (geschätzt)' : '') + ': ' + (ENG.isLongTerm(l.d, inp.date) ? 'am Stichtag steuerfrei' : 'am Stichtag kurzfristig, steuerfrei ab ' + fdate(ENG.taxFreeFrom(l.d)))); }); });
    var hv = [];
    ['frei', 'voll'].forEach(function (v) {
      var r = res[v], ftseLots = remainingLots(inp.pos.ftse, r.rows.ftse.sellUnits || 0);
      var x = LOGIC.harvest(ftseLots, inp.px.ftse, r.pbLeft, inp.cfg);
      if (x) hv.push('<b>' + (v === 'frei' ? 'Steuerfrei' : 'Voll') + ':</b> ' + num(x.units, 3) + ' Stück VWCE (' + eur(x.value) + ') verkaufen und sofort zurückkaufen realisiert ' + eur(x.gain) + ' Gewinn (' + eur(x.taxable) + ' steuerpflichtig, im Pauschbetrag) und hebt den Einstand um ' + eur(x.gain) + ' steuerfrei an. Kosten 2 Orders.');
    });
    var vp = null;
    if ((inp.pos.ftse || []).length && ok(inp.px.ftse)) vp = ENG.vorab(inp.pos.ftse, +inp.date.slice(0, 4), state.tax.vorabP0, inp.px.ftse, state.tax.basiszins);
    return '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Hinweise</h3></div><div class="notes">' +
      '<div class="note"><div><b>Handelstage</b> ' + chip('fakt') + ': Lang & Schwarz handelt am 24.12. und 31.12. nicht, am 30.12. nur bis 14 Uhr. Bitcoin: 30. oder 31.12. ' + qref('O-9') + '. Handelt Trade Republic Bruchstücke per Einzelorder? ' + qref('O-10') + '</div></div>' +
      '<div class="note"><div><b>FIFO</b>: Verkäufe verbrauchen immer die ältesten Käufe zuerst. Die steuerfreie Variante deckelt, ohne Lose zu überspringen.</div></div>' +
      '<div class="note warn"><div><b>Klippe der Freigrenze</b> (§ 23): Unter 1.000 € kurzfristiger Gewinne im Jahr 0 € Steuer, ab 1.000 € ist der ganze Betrag steuerpflichtig, auch andere § 23-Gewinne des Jahres.' + (ok(state.settings.buffer) ? ' Puffer zur Freigrenze: ' + eur(state.settings.buffer) + '.' : ' Ein Sicherheitsabstand ist noch nicht festgelegt ' + qref('O-8') + '.') + '</div></div>' +
      (lots.length ? '<div class="note"><div><b>Haltefristen je Los</b>: ' + lots.map(esc).join('; ') + '.</div></div>' : '') +
      '<div class="note"><div><b>Vorabpauschale</b> ' + aref('A-9') + ': wird im Januar ' + (+inp.date.slice(0, 4) + 1) + ' abgerechnet und zählt zum Pauschbetrag des neuen Jahres' + (vp != null ? ', geschätzt ' + eur(vp) + ' (steuerpflichtig ' + eur(vp * 0.7) + ')' : '') + '.</div></div>' +
      '<div class="note"><div><b>Krypto-Entwurf als Szenario</b> ' + chip('fakt', 'Entwurf') + ': Nach dem BMF-Referentenentwurf sollen Bitcoin-Käufe ab 01.01.2027 unter die Abgeltungsteuer fallen; Bestände bis 31.12.2026 behalten die Haltefrist. Noch kein Gesetz ' + qref('O-17') + '.</div></div>' +
      (hv.length ? '<div class="note good"><div><b>Pauschbetrag nutzen</b> (nur Hinweis, keine Automatik): ' + hv.join('<br>') + '</div></div>' : '') +
      '</div></div>';
  }
  function remainingLots(lots, sold) {
    var out = [], left = sold;
    (lots || []).forEach(function (l) { var q = Math.min(left, l.units); left -= q; if (l.units - q > 1e-12) out.push({ d: l.d, units: l.units - q, cpu: l.cpu }); });
    return out;
  }

  /* ================= Ansicht: Steuern ================= */
  function viewTax() {
    var cfg = M.cfg, ty = M.ty, pf = M.pf, today = M.today, t = state.tax, h = '';
    h += '<div class="view-head"><div><h2>Steuern ' + t.year + '</h2><p>Ledig, keine Kirchensteuer ' + chip('beschlossen') + '. Abgeltungsteuer 26,375 %, Sparer-Pauschbetrag 1.000 €, Teilfreistellung 30 %, Freigrenze § 23 unter 1.000 € ' + chip('fakt', 'Rechtsstand 09/2026') + '. Alle Steuerzahlen sind Schätzungen.</p></div></div>';
    if (today.slice(0, 4) !== String(t.year)) h += '<div class="note warn" style="margin-bottom:16px">Das Steuerjahr ' + t.year + ' ist vorbei. Zum Jahreswechsel Basiszins und VWCE-Jahresanfangskurs eintragen und Pauschbetrag und Freigrenze neu starten ' + chip('vorschlag') + '.</div>';

    var pbUsed = cfg.pbUsed, interest = cfg.interestRest, r20 = ty.r20, free = Math.max(0, ty.pbFree);
    h += '<div class="grid grid-2">';
    h += '<div class="card"><div class="card-head"><h3>Sparer-Pauschbetrag (§ 20)</h3></div>' +
      meterHtml([{ v: pbUsed, c: 'm-used', l: 'genutzt laut Trade Republic' }, { v: interest, c: 'm-plan', l: 'Zinsen Rest des Jahres' }, { v: r20, c: 'm-new', l: 'Verkäufe in der App' }], t.pb, null, 'Freier Pauschbetrag: ' + eur(free)) +
      '<div class="fields" style="margin-top:14px">' + field('tax.fsaShown', 'Anzeige Freistellungsauftrag (€)', 'num') +
      '<div class="field"><label for="f-tax-fsaMeaning">Bedeutung ' + qref('O-3') + '</label><select id="f-tax-fsaMeaning" data-set="tax.fsaMeaning" data-type="str">' +
      [['annahme', 'offen (A-10: frei)'], ['frei', 'ist frei'], ['genutzt', 'ist genutzt']].map(function (o) { return '<option value="' + o[0] + '"' + (t.fsaMeaning === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      field('tax.pbDate', 'Stand vom', 'date', '', 'Verkäufe danach werden abgezogen') + '</div>' +
      '<div style="margin-top:14px"><label class="check"><input type="checkbox" data-set="tax.interestAuto" data-type="bool"' + (t.interestAuto ? ' checked' : '') + '> Zinsen für den Rest des Jahres schätzen</label> ' + aref('A-8') + '</div>' +
      '<div class="fields" style="margin-top:10px">' +
      (t.interestAuto ? field('tax.interestRate', 'Zinssatz auf Cash in %', 'pct', '', eur(pf.cash.total) + ' × ' + pct(t.interestRate, 2) + ' × ' + LOGIC.restMonths(today) + ' ÷ 12 = ' + eur(interest)) : field('tax.interestRest', 'Erwartete Zinsen bis Jahresende (€)', 'num')) +
      field('tax.lossOther', 'Verlusttopf allgemein (€)', 'num') + '</div>' +
      '<p class="small muted" style="margin-top:8px">Verlusttopf Aktien ' + eur(t.lossStocks) + ' ' + chip('fakt') + ': verrechnet nur Gewinne aus Aktien, nicht aus ETF oder Bitcoin.</p></div>';

    var s23 = ty.s23Before;
    h += '<div class="card"><div class="card-head"><h3>Freigrenze private Veräußerungen (§ 23)</h3></div>' +
      meterHtml([{ v: Math.max(0, s23), c: s23 >= TAX.fg ? 'm-over' : 'm-new', l: 'kurzfristige Gewinne ' + t.year }], Math.max(TAX.fg * 1.2, s23), TAX.fg, s23 < TAX.fg ? 'Noch ' + eur(TAX.fg - s23) + ' bis zur Freigrenze' : 'Freigrenze überschritten: alles steuerpflichtig') +
      '<div class="fields" style="margin-top:14px"><div class="field"><label for="f-tax-o2">„+7,44 €“ vom 05.06.2026 ' + qref('O-2') + '</label><select id="f-tax-o2" data-set="tax.o2" data-type="str">' +
      [['offen', 'offen (als Gewinn)'], ['gewinn', 'Gewinn'], ['erloes', 'Erlös']].map(function (o) { return '<option value="' + o[0] + '"' + (t.o2 === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      field('tax.s23Extra', 'Weitere § 23-Gewinne ' + t.year + ' (€)', 'num', '0', 'außerhalb dieser App') +
      field('tax.rate', 'Grenzsteuersatz in % ', 'pct', 'offen (unter 30 %)', 'O-4: nur „unter 30 %“ bekannt') + '</div>' +
      '<p class="small muted" style="margin-top:8px">Zusammensetzung: ' + eur(cfg.s23Other) + ' aus Einstellungen + ' + eur(ty.r23) + ' aus Verkäufen in der App. Bitcoin direkt und Gold-ETC mit Lieferanspruch sind nach mehr als einem Jahr steuerfrei (Gold-ETC laut Emittent; Bankpraxis teils uneinheitlich).</p></div>';
    h += '</div>';

    h += '<div class="grid grid-2" style="margin-top:16px">' + sellSimCard() + '<div class="stack">' + holdingCard() + vorabCard() + '</div></div>';
    h += '<div class="card" style="margin-top:16px"><div class="card-head"><h3>Krypto-Neuregelung (Szenario)</h3><span>' + chip('fakt', 'Entwurf 09/2026') + ' ' + qref('O-17') + '</span></div>' +
      '<p class="ink2">Referentenentwurf des BMF (September 2026): Bitcoin-Käufe ab 01.01.2027 sollen unter die Abgeltungsteuer fallen, Bestände bis 31.12.2026 behalten die Haltefrist. Noch kein Gesetz. Die App rechnet deshalb weiter nach § 23. ' +
      'Folge für die Planung, falls es Gesetz wird: Ein Bitcoin-Kauf beim Rebalancing im Dezember 2026 hätte noch die Haltefrist, ein Kauf im Januar 2027 nicht mehr.</p></div>';
    return h;
  }

  function sellSimCard() {
    var s = ui.sim, a = s.a, p = M.pf.pos[a], px = ok(s.px) ? s.px : p.px, date = s.date || M.today;
    var amount = ok(s.amount) ? s.amount : (ok(p.value) ? LOGIC.round(p.value, 2) : 0);
    var out = '';
    if (!p.held) out = '<div class="note">Keine Position in ' + META[a].name + '.</div>';
    else if (!(px > 0)) out = '<div class="note warn">Kein Kurs vorhanden.</div>';
    else {
      var maxV = p.units * px, amt = Math.min(amount, maxV);
      var sp = LOGIC.sellPreview(a, p.lots, amt, px, date, M.cfg, M.ty);
      if (a === 'ftse') {
        out = '<dl class="kv"><dt>Stück</dt><dd>' + units(a, sp.units) + '</dd><dt>Gewinn nach FIFO</dt><dd>' + eurS(sp.gain) + '</dd><dt>Steuerpflichtig (70 %)</dt><dd>' + eur(sp.taxable) + '</dd>' +
          '<dt>Freier Pauschbetrag vorher / danach</dt><dd>' + eur(Math.max(0, M.ty.pbFree)) + ' / ' + eur(sp.pbAfter) + '</dd><dt>Geschätzte Steuer</dt><dd>' + eur(sp.tax) + '</dd></dl>';
      } else {
        out = '<dl class="kv"><dt>Menge</dt><dd>' + units(a, sp.units) + '</dd><dt>Gewinn kurzfristig</dt><dd>' + eurS(sp.short) + '</dd><dt>Gewinn steuerfrei (> 1 Jahr)</dt><dd>' + eurS(sp.long) + '</dd>' +
          '<dt>Kurzfristige Gewinne im Jahr danach</dt><dd>' + eur(sp.s23After) + '</dd><dt>Geschätzte Steuer</dt><dd>' + (ok(sp.tax) ? eur(sp.tax) : eur(sp.s23After) + ' × Grenzsteuersatz') + '</dd></dl>' +
          (sp.s23After >= TAX.fg ? '<div class="note crit" style="margin-top:8px">Über der Freigrenze: Die ganze Summe von ' + eur(sp.s23After) + ' ist steuerpflichtig.' + (ok(sp.tax) ? '' : ' Grenzsteuersatz fehlt ' + qref('O-4') + '.') + '</div>'
            : '<div class="note good" style="margin-top:8px">' + eur(TAX.fg - sp.s23After) + ' unter der Freigrenze: 0 € Steuer.</div>');
      }
      out += '<p class="small muted" style="margin-top:8px">Lose: ' + sp.parts.map(function (x) { return fdate(x.d) + ' ' + units(a, x.q) + (a === 'ftse' ? '' : x.long ? ' steuerfrei' : ' kurzfristig'); }).join('; ') + '</p>';
    }
    return '<div class="card"><div class="card-head"><h3>Verkauf simulieren</h3></div>' +
      '<p class="small ink2">Was würde ein Verkauf steuerlich bedeuten? FIFO, Teilfreistellung, Haltefrist und Freigrenze werden berücksichtigt.</p>' +
      '<div class="fields"><div class="field"><label for="sim-a">Baustein</label><select id="sim-a" data-sim="a">' + A.map(function (x) { return '<option value="' + x + '"' + (x === a ? ' selected' : '') + '>' + META[x].name + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="sim-amount">Betrag in €</label><input type="number" step="any" min="0" id="sim-amount" data-sim="amount" value="' + (ok(s.amount) ? s.amount : '') + '" placeholder="ganze Position ' + (ok(p.value) ? num(p.value, 2) : '') + '"></div>' +
      '<div class="field"><label for="sim-px">Kurs in €</label><input type="number" step="any" min="0" id="sim-px" data-sim="px" value="' + (ok(s.px) ? s.px : '') + '" placeholder="' + (p.px > 0 ? 'aktuell ' + num(p.px, 2) : '') + '"></div>' +
      '<div class="field"><label for="sim-date">Verkaufsdatum</label><input type="date" id="sim-date" data-sim="date" value="' + date + '"></div></div>' +
      '<div style="margin-top:12px" id="sim-out">' + out + '</div></div>';
  }

  function holdingCard() {
    var today = M.today, rows = '';
    ['btc', 'gold'].forEach(function (a) {
      M.pf.pos[a].lots.forEach(function (l) {
        var f = ENG.taxFreeFrom(l.d), done = f <= today;
        rows += '<tr><td><span class="cell-asset"><span class="key ' + a + '"></span>' + META[a].name + '</span></td><td>' + fdate(l.d) + (l.est ? ' ' + chip('annahme', 'geschätzt') : '') + '</td><td>' + units(a, l.units) + '</td><td>' + (done ? '<b class="pos">steuerfrei</b>' : fdate(f) + ' <span class="small muted">(' + daysUntil(f, today) + ')</span>') + '</td></tr>';
      });
    });
    return '<div class="card"><div class="card-head"><h3>Haltefristen (§ 23)</h3></div>' + (rows ? '<div class="table-wrap"><table><thead><tr><th>Baustein</th><th>Kauf</th><th>Menge</th><th>Steuerfrei ab</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<p class="muted">Keine Bitcoin- oder Gold-Lose.</p>') +
      '<p class="small muted" style="margin-top:8px">Die Jahresfrist endet am gleichen Kalendertag des Folgejahres; steuerfrei ab dem Tag danach (29.02. → 28.02.). Kaufdaten des Bitcoin-Bestands fehlen ' + qref('O-1') + '.</p></div>';
  }

  function vorabCard() {
    var t = state.tax, lots = M.pf.pos.ftse.lots, px = M.pf.pos.ftse.px, y = t.year;
    var vp = lots.length && px > 0 ? ENG.vorab(lots, y, t.vorabP0, px, t.basiszins) : 0;
    var u = ENG.units(lots), capAt = u > 0 ? t.vorabP0 + (lots.length ? ENG.vorab(lots, y, t.vorabP0, 1e9, t.basiszins) / u : 0) : NaN;
    return '<div class="card"><div class="card-head"><h3>Vorabpauschale VWCE ' + y + '</h3>' + aref('A-9') + '</div>' +
      '<div class="fields">' + field('tax.vorabP0', 'VWCE-Kurs Jahresbeginn (€)', 'num', '', 'Schluss 02.01.2026: 145,14 €') + field('tax.basiszins', 'Basiszins in %', 'pct', '', 'BMF, jedes Jahr im Januar') + '</div>' +
      '<dl class="kv" style="margin-top:12px"><dt>Vorabpauschale (Schätzung mit aktuellem Kurs)</dt><dd>' + eur(vp) + '</dd><dt>Steuerpflichtig nach Teilfreistellung</dt><dd>' + eur(vp * 0.7) + '</dd>' +
      '<dt>Abrechnung</dt><dd>Januar ' + (y + 1) + '</dd></dl>' +
      '<p class="small muted" style="margin-top:8px">Zählt zum Pauschbetrag ' + (y + 1) + '. Im Kaufjahr zeitanteilig (Kauf im September: 4/12). Der Deckel greift nur, wenn VWCE das Jahr unter ' + eur(capAt) + ' beendet.</p></div>';
  }

  /* ================= Ansicht: Regeln & Fragen ================= */
  function questionHtml(q) {
    var done = q.done();
    return '<div class="q' + (done ? ' done' : '') + '"' + (ID_SCOPE === 'regeln' ? ' id="q-' + q.id + '"' : '') + '><div class="q-head"><div><span class="q-id">' + q.id + '</span>' + esc(q.q) + '</div>' +
      (done ? chip('geklaert') : chip('offen')) + '</div><div class="q-meta">' + esc(q.why) + ' · Spätestens: ' + esc(q.due) + '</div>' +
      (q.control ? '<div class="q-control">' + q.control() + '</div>' : '') + '</div>';
  }

  function viewRules() {
    var open = openCount(), h = '';
    h += '<div class="view-head"><div><h2>Regeln, Annahmen und offene Fragen</h2><p>Fachliche Grundlage ist <code>docs/uebergabe.md</code>. Abschnitt 2 ist verbindlich, Abschnitte 3 und 4 sind Annahmen und offene Fragen. Jede Aussage trägt einen Status:</p></div></div>';
    h += '<div class="card"><div class="table-wrap"><table><thead><tr><th>Status</th><th>Bedeutung</th><th>Umgang in der App</th></tr></thead><tbody>' +
      [['beschlossen', 'Von dir ausdrücklich festgelegt oder fester Teil der Regel', 'So umgesetzt'],
       ['annahme', 'In Backtests oder im Prototyp so gerechnet, nicht ausdrücklich beschlossen', 'Umgesetzt, einstellbar und gekennzeichnet'],
       ['offen', 'Entscheidung oder Daten fehlen', 'Nicht geraten: Feld bleibt leer oder die App fragt nach'],
       ['fakt', 'Recht, Kontodaten oder Marktdaten mit Stand', 'Als Parameter mit Datum hinterlegt'],
       ['vorschlag', 'Technische Empfehlung', 'Frei entscheidbar']].map(function (r) { return '<tr><td>' + chip(r[0]) + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';

    h += '<div class="section-title"><h2>Offene Fragen</h2><span class="small ink2">' + (17 - open) + ' von 17 geklärt</span></div>';
    h += '<div class="progress" style="margin-bottom:12px"><div style="width:' + ((17 - open) / 17 * 100) + '%"></div></div>';
    h += '<div class="questions">' + QUESTIONS.map(questionHtml).join('') + '</div>';

    h += '<div class="section-title"><h2>Signalregeln</h2>' + chip('beschlossen') + '</div>';
    h += '<div class="grid grid-3">' + A.map(function (a) {
      var r = RS.rules[a];
      return '<div class="card asset-card ' + a + '"><h3><span class="key ' + a + '"></span> ' + META[a].name + ' · ' + pct(RS.weights[a], 0) + '</h3>' +
        '<p class="ink2" style="margin-top:8px"><b>' + META[a].ruleName + '</b>. ' + (r.type === 'band'
          ? 'Kaufsignal bei Wochenschluss über 1,03 × SMA50, Verkaufssignal unter 0,97 × SMA50. Innerhalb des Bands ändert sich nichts (am 23.09. korrigiert: 3 %, nicht 1 %).'
          : 'Kaufsignal nach ' + r.n + ' Wochenschlüssen in Folge über dem SMA50, Verkaufssignal nach ' + r.n + ' in Folge darunter.') + '</p>' +
        '<p class="small muted">Instrument: ' + esc(META[a].instrLong) + (META[a].isin ? ' (ISIN ' + META[a].isin + ')' : '') + '. Signalreihe: ' + esc(META[a].signal) + '. Wochenschluss: ' + esc(META[a].closeLabel) + '.</p></div>';
    }).join('') + '</div>';
    h += '<div class="card" style="margin-top:16px"><h3>Zustandsautomaten (8.3)</h3><pre style="overflow-x:auto;font:13px/1.5 var(--mono);background:var(--surface-2);padding:12px;border-radius:8px;margin:10px 0 0">' + esc(
      'Bestätigungsregel (FTSE n = 2, Gold n = 4):\n  für jede Woche t mit SMA50:\n    wenn C > SMA:  über += 1; unter = 0\n    wenn C < SMA:  unter += 1; über = 0\n    wenn C = SMA:  über = 0; unter = 0                 (A-6)\n' +
      '    Zustand 0 und über ≥ n  → Zustand 1   (Kaufsignal)\n    Zustand 1 und unter ≥ n → Zustand 0   (Verkaufssignal)\n\nBandregel (Bitcoin, p = 0,03):\n    Zustand 0 und C > (1+p)·SMA → Zustand 1   (Kaufsignal)\n' +
      '    Zustand 1 und C < (1−p)·SMA → Zustand 0   (Verkaufssignal)\n\nSchwelle nächste Woche mit S49 = Summe der letzten 49 Schlüsse:\n    über dem neuen SMA50:  C > S49 / 49\n    Bitcoin-Einstieg:      C > 1,03 × S49 / 48,97\n    Bitcoin-Ausstieg:      C < 0,97 × S49 / 49,03\n\n' +
      'Signal an Woche t → Handel zur Eröffnung der Woche t+1') + '</pre>' +
      '<div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Regel</th><th>Position im Depot</th><th>Empfehlung (8.4)</th></tr></thead><tbody>' +
      '<tr><td>investiert</td><td>ja</td><td>Halten</td></tr><tr><td>investiert</td><td>nein</td><td>Kaufen mit dem Cash des Bausteins</td></tr><tr><td>nicht investiert</td><td>ja</td><td>Ganze Position verkaufen</td></tr><tr><td>nicht investiert</td><td>nein</td><td>Nichts tun, Geld bleibt Cash</td></tr>' +
      '</tbody></table></div></div>';

    h += '<div class="section-title"><h2>Annahmen</h2>' + chip('annahme') + '</div>';
    h += '<div class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Annahme</th><th>In der App</th></tr></thead><tbody>' +
      ASSUMPTIONS.map(function (x) { return '<tr id="a-' + x.id + '"><td class="nowrap"><b>' + x.id + '</b></td><td>' + esc(x.text) + '</td><td class="small ink2">' + esc(x.app) + '</td></tr>'; }).join('') +
      '</tbody></table></div><div class="fields" style="margin-top:12px">' + field('settings.fee', 'Gebühr je Order in € (A-3)', 'num') + '</div></div>';

    h += '<div class="section-title"><h2>Datenquellen</h2></div>';
    h += '<div class="card"><div class="table-wrap"><table><thead><tr><th>Zweck</th><th>Reihe</th><th>Quelle</th><th>Status</th></tr></thead><tbody>' +
      [['Signal FTSE', 'VWRD.L bereinigter Schluss (adjclose), USD', 'Yahoo Finance', chip('beschlossen')], ['Signal Bitcoin', 'BTC-USD, Woche Mo–So UTC', 'Yahoo Finance', chip('beschlossen')],
       ['Signal Gold', 'LBMA Gold PM, USD', 'LBMA', chip('beschlossen') + ' Fixing ' + qref('O-12')], ['Gegenprobe Gold', 'COMEX GC=F', 'Yahoo Finance', chip('annahme', 'A-5')],
       ['Bewertung', 'VWCE.DE, BTC-EUR, SGBS.MI', 'Yahoo Finance', chip('annahme', 'A-4')], ['Vorabpauschale', 'VWCE-Kurs Jahresbeginn, Basiszins', 'Yahoo, BMF', chip('fakt')]]
        .map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small muted" style="margin-top:8px">Der Datenjob (GitHub Actions) holt die Reihen serverseitig, weil Yahoo und LBMA keinen Abruf aus dem Browser erlauben. Er lädt die bereinigte FTSE-Reihe bei jedem Lauf komplett neu (6.2). ' + (LIVE ? 'Letzter Abruf: ' + fdate(MK.updated.slice(0, 10)) + '.' : 'Bis zum ersten Lauf gelten die Testdaten aus Anhang A.') + '</p></div>';

    h += '<div class="section-title"><h2>Berichte und Einordnung</h2></div>';
    h += '<div class="grid grid-2"><div class="card"><h3>Berichte im Projekt „Enjoyer OS“</h3><ul style="margin:10px 0 0;padding-left:18px">' +
      [['Teil 1: Backtest-Check', 'https://claude.ai/artifact/5Qg2HfCobJNbKdoiCYbTLg'], ['Teil 2: All-World vs. S&P 500', 'https://claude.ai/artifact/AUp5PzADBkJoT3Eo8MHihv'],
       ['Teil 3: Steuer-Check 50/30/20', 'https://claude.ai/artifact/2BspkHKPtExMzmsMHo6UmU'], ['Prototyp „Regel-Depot 50/30/20“', 'https://claude.ai/artifact/Aog6uQBDFD1UKouvuPQJxY']]
        .map(function (l) { return '<li><a href="' + l[1] + '" target="_blank" rel="noopener">' + esc(l[0]) + '</a></li>'; }).join('') + '</ul>' +
      '<p class="small muted" style="margin-top:10px">Rechtsgrundlagen: § 20 und § 23 EStG, §§ 18 und 20 InvStG, BMF-Referentenentwurf Kryptowerte (kein Gesetz).</p></div>' +
      '<div class="card"><h3>Backtest-Kennzahlen (keine Anforderung)</h3><div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>Rechnung</th><th class="r">Mit Regel</th><th class="r">Buy &amp; Hold</th></tr></thead><tbody>' +
      [['FTSE All-World, 2-Wochen-Regel, 05/2013–09/2026', '8,5 % p. a., −19,9 %', '11,7 % p. a., −29,3 %'], ['MSCI ACWI, 12/2001–09/2026', '7,91 % p. a., −21,9 %', '7,94 % p. a., −52,3 %'],
       ['Bitcoin, 3-%-Band, seit 2015', '71,0 % p. a., −66 %', '69,7 % p. a., −82 %'], ['Gold, 4-Wochen-Regel, seit 2015', '8,0 % p. a.', '12,7 % p. a.'],
       ['Depot 50/30/20, Median 3-Jahres-Fenster', '27,4 % p. a., −30 %', '27,5 % p. a., −37 %']].map(function (r) { return '<tr><td>' + r[0] + '</td><td class="r">' + r[1] + '</td><td class="r">' + r[2] + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small muted" style="margin-top:8px">Das 3-%-Band schlägt die einfache 50-Wochen-Regel nur bei genau 50 Wochen. Das spricht für Vorsicht bei Änderungen an den Parametern.</p></div></div>';
    return h;
  }

  /* ================= Rendern und Navigation ================= */
  /* Eine durchgehende Seite: Übersicht, Charts, Depot, danach Rebalancing, Steuern, Regeln & Fragen */
  var SECTIONS = [['uebersicht', viewOverview], ['charts', viewCharts], ['depot', viewDepot], ['rebalancing', viewRebal], ['steuern', viewTax], ['regeln', viewRules]];
  var OLD_HASH = { signale: 'charts' };

  function renderSection(id) {
    var body = document.querySelector('[data-sec="' + id + '"]'), sec = SECTIONS.filter(function (x) { return x[0] === id; })[0];
    if (!body || !sec) return;
    var open = {};
    body.querySelectorAll('details[id]').forEach(function (d) { open[d.id] = d.open; });
    ID_SCOPE = id;
    body.innerHTML = sec[1]();
    ID_SCOPE = '';
    body.querySelectorAll('details[id]').forEach(function (d) { if (d.id in open) d.open = open[d.id]; });
    if (id === 'charts') renderCharts();
    if (id === 'depot') renderDonuts();
  }
  function render(only) {
    M = compute();
    var y = window.scrollY;
    (only ? [].concat(only) : SECTIONS.map(function (x) { return x[0]; })).forEach(renderSection);
    var oc = openCount(), el = document.getElementById('open-count');
    el.textContent = oc ? oc + ' offen' : '';
    el.hidden = !oc;
    window.scrollTo(0, y);
  }

  function goTo(id, instant) {
    var el = document.getElementById(OLD_HASH[id] || id);
    if (!el) return;
    if (el.tagName === 'DETAILS') el.open = true;
    else if (el.closest('details')) el.closest('details').open = true;
    el.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
  }

  /* Navigation markiert den Abschnitt, der gerade im Blick ist */
  var nav = document.querySelector('.tabs'), navLinks = [].slice.call(document.querySelectorAll('.tabs a'));
  function setCurrent(id) {
    navLinks.forEach(function (a) {
      if (a.getAttribute('href') === '#' + id) {
        a.setAttribute('aria-current', 'true');
        if (a.offsetLeft < nav.scrollLeft || a.offsetLeft + a.offsetWidth > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = a.offsetLeft - 16;
      } else a.removeAttribute('aria-current');
    });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setCurrent(en.target.id); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    SECTIONS.forEach(function (x) { var el = document.getElementById(x[0]); if (el) io.observe(el); });
  }

  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }

  function commit() { save(); render(); }

  /* ---------- Ereignisse ---------- */
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.hasAttribute('data-set')) {
      var path = el.getAttribute('data-set'), v = parseVal(el);
      if (/^prices\.\w+\.px$/.test(path) && ok(v)) setPath(state, path.replace('.px', '.d'), M.today); /* neuer Kurs = Stand heute */
      setPath(state, path, v); commit(); return;
    }
    if (el.hasAttribute('data-reb-st')) { ui.reb.st[el.getAttribute('data-reb-st')] = el.value; render('rebalancing'); return; }
    if (el.hasAttribute('data-reb-px')) { var x = parseFloat(el.value); ui.reb.px[el.getAttribute('data-reb-px')] = isFinite(x) && x > 0 ? x : null; render('rebalancing'); return; }
    if (el.hasAttribute('data-sim')) {
      var k = el.getAttribute('data-sim');
      if (k === 'a') { ui.sim.a = el.value; ui.sim.amount = null; ui.sim.px = null; }
      else if (k === 'date') ui.sim.date = el.value || null;
      else { var n = parseFloat(el.value); ui.sim[k] = isFinite(n) && n >= 0 ? n : null; }
      render('steuern'); return;
    }
    if (el.id === 'import-file' && el.files && el.files[0]) {
      var fr = new FileReader();
      fr.onload = function () {
        try {
          var obj = JSON.parse(fr.result);
          if (!obj || !Array.isArray(obj.tx) || !obj.cash || !obj.tax) throw new Error('Format');
          state = migrate(sanitize(fillMissing(defaults(), obj))); commit(); toast('Daten importiert.');
        } catch (err) { toast('Import fehlgeschlagen: keine gültige Export-Datei.'); }
      };
      fr.readAsText(el.files[0]);
    }
  });

  document.addEventListener('input', function (e) {
    var el = e.target, a = el.getAttribute('data-hypo') || el.getAttribute('data-hypo-num');
    if (!a) return;
    var v = parseFloat(el.value);
    ui.hypo[a] = isFinite(v) ? v : null;
    var other = el.hasAttribute('data-hypo') ? document.querySelector('[data-hypo-num="' + a + '"]') : document.querySelector('[data-hypo="' + a + '"]');
    if (other && isFinite(v)) other.value = el.hasAttribute('data-hypo') ? LOGIC.round(v, 2) : v;
    var out = document.getElementById('hypo-out-' + a);
    if (out) out.innerHTML = hypoOut(a, ui.hypo[a]);
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-range],[data-perf-range],[data-perf-mode],[data-scen],[data-act],[data-goto],[data-goto-q],[data-goto-a]');
    if (!t) return;
    if (t.hasAttribute('data-range')) { ui.range = t.getAttribute('data-range'); saveUi(); render('charts'); return; }
    if (t.hasAttribute('data-perf-range')) { ui.perfRange = t.getAttribute('data-perf-range'); saveUi(); render('charts'); return; }
    if (t.hasAttribute('data-perf-mode')) { ui.perfMode = t.getAttribute('data-perf-mode'); saveUi(); render('charts'); return; }
    if (t.hasAttribute('data-scen')) { ui.reb.scen = t.getAttribute('data-scen'); render('rebalancing'); return; }
    if (t.hasAttribute('data-goto-q') || t.hasAttribute('data-goto-a')) {
      e.preventDefault();
      goTo(t.hasAttribute('data-goto-q') ? 'q-' + t.getAttribute('data-goto-q') : 'a-' + t.getAttribute('data-goto-a')); return;
    }
    if (t.hasAttribute('data-goto')) { e.preventDefault(); goTo(t.getAttribute('data-goto')); return; }
    var act = t.getAttribute('data-act');
    if (act === 'tx-new') openTx(null);
    else if (act === 'tx-edit') openTx(t.getAttribute('data-id'));
    else if (act === 'tx-del') {
      var tx = state.tx.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0];
      if (tx && confirm('Transaktion vom ' + fdate(tx.d) + ' (' + META[tx.a].instr + ', ' + (tx.type === 'kauf' ? 'Kauf' : 'Verkauf') + ') löschen?')) {
        state.tx = state.tx.filter(function (x) { return x !== tx; }); commit(); toast('Transaktion gelöscht.');
      }
    } else if (act === 'add-weekly') addWeekly(t.getAttribute('data-a'));
    else if (act === 'del-weekly') {
      var a = t.getAttribute('data-a'), k = t.getAttribute('data-k');
      state.weekly[a] = state.weekly[a].filter(function (w) { return w.k !== k; }); commit();
    } else if (act === 'cash-fill') {
      /* O-5 wie am 24.09.2026 entschieden: jeder Baustein bis zu seinem Ziel, soweit das Cash reicht */
      var left = M.pf.cash.total;
      A.forEach(function (x) {
        var need = Math.max(0, LOGIC.round(M.pf.total * RS.weights[x] - (ok(M.pf.pos[x].value) ? M.pf.pos[x].value : 0), 2));
        state.cash[x] = LOGIC.round(Math.min(need, Math.max(0, left)), 2); left -= state.cash[x];
      });
      commit(); toast('Cash bis zum Ziel je Baustein verteilt.');
    } else if (act === 'cash-clear') { A.forEach(function (x) { state.cash[x] = null; }); commit(); }
    else if (act === 'export') exportData();
    else if (act === 'reset') { if (confirm('Alle Eingaben verwerfen und die Startdaten vom 24.09.2026 wiederherstellen?')) { state = defaults(); commit(); toast('Startdaten wiederhergestellt.'); } }
  });

  function addWeekly(a) {
    var d = document.getElementById('wk-d-' + a).value, c = parseFloat(document.getElementById('wk-c-' + a).value);
    var pEl = document.getElementById('wk-p-' + a), p = pEl ? parseFloat(pEl.value) : NaN;
    if (!d || !(c > 0)) { toast('Bitte Datum und Schlusskurs eintragen.'); return; }
    var S = M.S[a], lastK = S.k[S.c.length - 1], k = ENG.mondayOf(d);
    var existing = (state.weekly[a] || []).some(function (w) { return w.k === k; });
    if (!existing && k !== ENG.addDays(lastK, 7)) {
      toast(k <= lastK ? 'Diese Woche ist schon in den Daten. Nur die nächste Woche (ab ' + fdate(ENG.addDays(lastK, 7)) + ') kann nachgetragen werden.' : 'Lücke: Zuerst die Woche ab ' + fdate(ENG.addDays(lastK, 7)) + ' eintragen.');
      return;
    }
    var closeD = a === 'btc' ? ENG.addDays(k, 6) : d;
    if (Date.now() < closeMoment(a, closeD)) { toast('Diese Woche ist noch nicht abgeschlossen. Nur abgeschlossene Wochen zählen.'); return; }
    state.weekly[a] = (state.weekly[a] || []).filter(function (w) { return w.k !== k; }).concat([{ k: k, d: d, c: c, p: p > 0 ? p : undefined, src: 'manuell', t: new Date().toISOString() }]);
    ui.hypo[a] = null; commit();
    var r = M.R[a];
    toast(r.last.changed ? (r.last.st === 1 ? 'KAUFSIGNAL ' : 'VERKAUFSSIGNAL ') + META[a].name + ': Handel am Montag, ' + fdate(LOGIC.tradeDate(r.last.d)) : 'Wochenschluss übernommen, kein Signalwechsel.');
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = 'regel-depot-' + M.today + '.json'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  /* ---------- Transaktionsdialog ---------- */
  var dlg = document.getElementById('tx-dialog'), editing = null;
  function openTx(id) {
    editing = id ? state.tx.filter(function (x) { return x.id === id; })[0] : null;
    var t = editing || { d: M.today, a: 'ftse', type: 'kauf', units: '', price: '', fee: state.settings.fee, note: '', src: 'manuell', est: false };
    document.getElementById('tx-title').textContent = editing ? 'Transaktion bearbeiten' : 'Transaktion erfassen';
    document.getElementById('tx-d').value = t.d; document.getElementById('tx-a').value = t.a; document.getElementById('tx-type').value = t.type;
    document.getElementById('tx-units').value = t.units; document.getElementById('tx-price').value = t.price; document.getElementById('tx-fee').value = t.fee == null ? '' : t.fee;
    document.getElementById('tx-note').value = t.note || ''; document.getElementById('tx-src').value = t.src || 'manuell'; document.getElementById('tx-est').checked = !!t.est;
    document.getElementById('tx-hint').textContent = 'Ein Verkauf schreibt den Erlös dem Cash des Bausteins gut, ein Kauf zieht ihn ab (A-1), sofern das Datum nach dem Cash-Stichtag ' + fdate(state.cash.date) + ' liegt.';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  dlg.addEventListener('close', function () {
    if (dlg.returnValue !== 'save') return;
    var t = {
      id: editing ? editing.id : 'tx-' + Date.now().toString(36), d: document.getElementById('tx-d').value, a: document.getElementById('tx-a').value,
      type: document.getElementById('tx-type').value, units: parseFloat(document.getElementById('tx-units').value), price: parseFloat(document.getElementById('tx-price').value),
      fee: parseFloat(document.getElementById('tx-fee').value) || 0, note: document.getElementById('tx-note').value.trim(), src: document.getElementById('tx-src').value,
      est: document.getElementById('tx-est').checked, ts: editing ? editing.ts : Date.now()
    };
    if (!t.d || !(t.units > 0) || !(t.price > 0)) { toast('Bitte Datum, Menge und Kurs angeben.'); return; }
    if (t.type === 'verkauf') {
      var held = ENG.units(ENG.book(state.tx.filter(function (x) { return x !== editing && x.d <= t.d; })).pos[t.a]);
      if (t.units > held + 1e-9) { toast('Verkauf größer als der Bestand am ' + fdate(t.d) + ' (' + units(t.a, held) + ').'); return; }
    }
    if (editing) state.tx = state.tx.map(function (x) { return x === editing ? t : x; });
    else state.tx.push(t);
    commit(); toast(editing ? 'Transaktion geändert.' : 'Transaktion erfasst.');
  });

  /* ---------- Theme ---------- */
  function applyTheme(t) { if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
  try { applyTheme(localStorage.getItem(THEMEKEY)); } catch (e) { /* ignorieren */ }
  document.getElementById('theme-toggle').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme') || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next); try { localStorage.setItem(THEMEKEY, next); } catch (e) { /* ignorieren */ }
    renderCharts(); renderDonuts();
  });

  var rt, lastW = window.innerWidth;
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastW) return; /* mobile Adressleiste ändert nur die Höhe */
    lastW = window.innerWidth; clearTimeout(rt); rt = setTimeout(function () { renderCharts(); renderDonuts(); }, 150);
  });
  window.addEventListener('hashchange', function () { var h = location.hash.slice(1); if (OLD_HASH[h]) goTo(h); });
  setInterval(function () {
    var ov = document.getElementById('uebersicht');
    if (!ov.contains(document.activeElement)) render('uebersicht'); /* Countdowns aktualisieren */
  }, 60000);
  render();
  if (location.hash.length > 1) goTo(location.hash.slice(1), true);
})();
