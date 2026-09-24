/* Datenaufbereitung für den Datenjob (scripts/update-data.mjs). Nur reine Funktionen, getestet in test/market.test.js.
   Regeln aus docs/uebergabe.md 6.1 und 6.2: Wochenpunkte mit Montag als Schlüssel, Wert = letzter Schluss der Woche,
   nur abgeschlossene Wochen. Bitcoin: Woche Montag bis Sonntag in UTC. */
'use strict';
const ENG = require('../site/js/engine.js');
const LOGIC = require('../site/js/logic.js');

const DAY = 864e5;

/* ---------- Zeit ---------- */

/* UTC-Zeitpunkt für eine Londoner Ortszeit an einem Kalendertag (Sommer-/Winterzeit über Intl) */
function londonToUtc(iso, hh, mm) {
  const [y, mo, d] = iso.split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
  const lh = Number(parts.find((p) => p.type === 'hour').value);
  return guess - (lh - hh) * 3600e3;
}

/* Zeitpunkt, ab dem die Woche mit Montag k abgeschlossen ist (2.4, 7.4) */
const WEEK_CLOSE = {
  ftse: (k) => londonToUtc(ENG.addDays(k, 4), 16, 30),     /* Börsenschluss London, Freitag */
  gold: (k) => londonToUtc(ENG.addDays(k, 4), 15, 0),      /* LBMA-PM-Fixing, Freitag */
  btc: (k) => Date.parse(ENG.addDays(k, 7) + 'T00:00:00Z'), /* Sonntag 24:00 UTC */
  comex: (k) => Date.parse(ENG.addDays(k, 4) + 'T22:00:00Z') /* COMEX-Handelsende Freitag */
};

/* ---------- Quellen ---------- */

/* Yahoo-Chart-Antwort (v8/finance/chart, interval=1d) → Tagesreihe {d, c}. field: 'close' oder 'adjclose' */
function parseYahoo(json, field) {
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  if (!r || !Array.isArray(r.timestamp)) throw new Error('Yahoo: keine Daten' + (json && json.chart && json.chart.error ? ' (' + JSON.stringify(json.chart.error) + ')' : ''));
  const off = (r.meta && r.meta.gmtoffset) || 0;
  const vals = field === 'adjclose' ? r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose : r.indicators.quote[0].close;
  if (!Array.isArray(vals)) throw new Error('Yahoo: Feld ' + field + ' fehlt');
  const map = new Map();
  r.timestamp.forEach((t, i) => {
    const v = vals[i];
    if (typeof v !== 'number' || !isFinite(v) || v <= 0) return;
    map.set(new Date((t + off) * 1000).toISOString().slice(0, 10), v); /* Ortsdatum der Börse; doppelte Tage: letzter Wert */
  });
  const d = [...map.keys()].sort();
  return { d, c: d.map((x) => map.get(x)), meta: { symbol: r.meta && r.meta.symbol, currency: r.meta && r.meta.currency } };
}

/* LBMA-JSON (gold_pm.json: [{d, v:[USD, GBP, EUR]}]) → Tagesreihe in USD */
function parseLbma(json, from) {
  if (!Array.isArray(json)) throw new Error('LBMA: unerwartetes Format');
  const map = new Map();
  json.forEach((x) => {
    const v = x && Array.isArray(x.v) ? x.v[0] : null;
    if (!x || typeof x.d !== 'string' || typeof v !== 'number' || !(v > 0)) return;
    if (from && x.d < from) return;
    map.set(x.d, v);
  });
  const d = [...map.keys()].sort();
  return { d, c: d.map((x) => map.get(x)) };
}

/* ---------- Wochenpunkte ---------- */

/* Tagesreihe → Wochenpunkte {k, d, c}; nur Wochen, deren Wochenschluss vor „now“ liegt */
function toWeekly(daily, closeOf, now) {
  const weeks = new Map();
  daily.d.forEach((d, i) => {
    const k = ENG.mondayOf(d);
    const w = weeks.get(k);
    if (!w || d >= w.d) weeks.set(k, { d, c: daily.c[i] });
  });
  const ks = [...weeks.keys()].sort().filter((k) => now >= closeOf(k));
  return { k: ks, d: ks.map((k) => weeks.get(k).d), c: ks.map((k) => weeks.get(k).c) };
}

/* Lücken (fehlende Wochen) finden; die Regel setzt lückenlose Wochen voraus */
function weekGaps(S) {
  const gaps = [];
  for (let i = 1; i < S.k.length; i++) if (ENG.daysBetween(S.k[i - 1], S.k[i]) !== 7) gaps.push(S.k[i - 1] + ' → ' + S.k[i]);
  return gaps;
}

function roundSeries(S, n) { return Object.assign({}, S, { c: S.c.map((v) => LOGIC.round(v, n)) }); }
function tail(S, from) {
  const i = S.d.findIndex((d) => d >= from);
  if (i < 0) return { d: [], c: [] };
  return { d: S.d.slice(i), c: S.c.slice(i) };
}

/* ---------- Signale und Nachrichten ---------- */

const NAMES = { ftse: 'FTSE All-World', btc: 'Bitcoin', gold: 'Gold' };
const RULE_NAMES = { ftse: '2-Wochen-Regel', btc: '3-%-Band', gold: '4-Wochen-Regel' };

function fmtNum(x, d) {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(LOGIC.round(x, d)).replace('-', '−');
}
function fmtDate(iso) { return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4); }
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function wd(iso) { return WD[new Date(iso + 'T00:00:00Z').getUTCDay()] + ' ' + fmtDate(iso); }

/* Regelstand je Baustein für die Anzeige und die Nachricht */
function ruleSummary(series) {
  const R = LOGIC.evalAll(series), out = {};
  LOGIC.ASSETS.forEach((a) => {
    const L = R[a].last, ns = LOGIC.nextStep(R[a], LOGIC.RULESET.rules[a]);
    out[a] = { k: L.k, d: L.d, c: L.c, m: L.m, dist: L.dist, st: L.st, up: L.up, dn: L.dn, changed: !!L.changed,
      next: { cmp: ns.cmp, thr: ns.thr, to: ns.to, signal: ns.signal, missing: ns.missing, k: ns.k || null, n: ns.n || null } };
  });
  return out;
}

/* Neue Signale der jeweils letzten abgeschlossenen Woche, die noch nicht gemeldet wurden.
   Beim allerersten Lauf (keine alten Ereignisse) nur Signale, deren Wochenschluss höchstens 4 Tage zurückliegt. */
function newSignals(summary, prevEvents, now) {
  const known = new Set((prevEvents || []).map((e) => e.id));
  const first = !prevEvents;
  const out = [];
  LOGIC.ASSETS.forEach((a) => {
    const s = summary[a];
    if (!s.changed) return;
    const id = a + ':' + s.k + ':' + s.st;
    if (known.has(id)) return;
    if (first && now - WEEK_CLOSE[a](s.k) > 4 * DAY) return;
    out.push({ id, a, k: s.k, d: s.d, to: s.st, c: s.c, m: s.m, trade: LOGIC.tradeDate(s.d) });
  });
  return out;
}

function signalMessage(ev, summary, pagesUrl) {
  const a = ev.a, s = summary[a], rule = LOGIC.RULESET.rules[a], buy = ev.to === 1;
  const lines = [];
  lines.push((buy ? '▲ KAUFSIGNAL ' : '▼ VERKAUFSSIGNAL ') + NAMES[a] + ' (' + RULE_NAMES[a] + ')');
  lines.push('');
  let why;
  if (rule.type === 'band') {
    why = buy ? 'über 1,03 × SMA50 = ' + fmtNum(ev.m * 1.03, 2) + ' $' : 'unter 0,97 × SMA50 = ' + fmtNum(ev.m * 0.97, 2) + ' $';
  } else {
    why = (buy ? 'der ' + rule.n + '. Schluss in Folge über' : 'der ' + rule.n + '. Schluss in Folge unter') + ' dem SMA50 (' + fmtNum(ev.m, 2) + ' $)';
  }
  lines.push('Wochenschluss ' + wd(ev.d) + ': ' + fmtNum(ev.c, 2) + ' $, ' + why + '.');
  lines.push('');
  lines.push('Handel zur Eröffnung am Montag, ' + fmtDate(ev.trade) + ':');
  lines.push(buy ? '→ Mit dem Cash des Bausteins kaufen. Liegt die Position schon im Depot: halten.'
                 : '→ Ganze Position verkaufen, der Erlös bleibt Cash des Bausteins. Ohne Position: nichts tun.');
  lines.push('');
  const dir = s.next.cmp === '>' ? 'über ' : 'unter ', thr = fmtNum(s.next.thr, 2) + ' $';
  lines.push(s.next.signal ? 'Nächstes ' + (s.next.to === 1 ? 'Kaufsignal' : 'Verkaufssignal') + ' bei Wochenschluss ' + dir + thr + '.'
    : 'Nächste Woche: Ein Schluss ' + dir + thr + ' wäre der ' + s.next.k + '. von ' + s.next.n + ' nötigen Schlüssen ' + (s.next.to === 1 ? 'darüber' : 'darunter') + '.');
  if (pagesUrl) lines.push('Details: ' + pagesUrl);
  lines.push('');
  lines.push('Keine Anlageberatung. Die App führt keine Orders aus.');
  return lines.join('\n');
}

function statusMessage(summary, pagesUrl) {
  const lines = ['Regel-Depot 50/30/20: Testnachricht', '', 'Benachrichtigungen funktionieren. Aktueller Regelstand:'];
  LOGIC.ASSETS.forEach((a) => {
    const s = summary[a];
    lines.push('• ' + NAMES[a] + ': ' + (s.st === 1 ? 'investiert' : 'Cash') + ' (Schluss ' + wd(s.d) + ' ' + fmtNum(s.c, 2) + ' $, SMA50 ' + fmtNum(s.m, 2) + ' $)');
  });
  if (pagesUrl) lines.push('', pagesUrl);
  return lines.join('\n');
}

module.exports = { londonToUtc, WEEK_CLOSE, parseYahoo, parseLbma, toWeekly, weekGaps, roundSeries, tail, ruleSummary, newSignals, signalMessage, statusMessage };
