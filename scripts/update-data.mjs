// Datenjob: Kursdaten von Yahoo Finance und LBMA abrufen, Wochenpunkte und Regelstand berechnen,
// site/data/market.js schreiben und bei neuen Kauf- oder Verkaufssignalen per Telegram benachrichtigen.
// Läuft als GitHub Action (.github/workflows/daten.yml), Grundlage: docs/uebergabe.md 6.1, 6.2, 7.4.
//
// Aufruf:  node scripts/update-data.mjs            Daten abrufen und schreiben
//          node scripts/update-data.mjs --seed     Startdatei aus den Testdaten (Anhang A), ohne Netz
// Umgebung: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  (GitHub-Secrets; ohne sie wird nichts gesendet)
//          TEST_NOTIFICATION=true                  Testnachricht mit dem aktuellen Regelstand senden
//          MARKET_FIXTURES=<Ordner>                Antworten aus Dateien statt aus dem Netz (Tests)
//          MARKET_NOW=<ISO-Zeit>                   Zeitpunkt überschreiben (Tests)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const M = require('./market.cjs');
const ENG = require('../site/js/engine.js');
const LOGIC = require('../site/js/logic.js');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.MARKET_OUT || join(root, 'site/data/market.js');
const now = process.env.MARKET_NOW ? Date.parse(process.env.MARKET_NOW) : Date.now();
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const yearsAgo = (n) => iso(now - n * 365.25 * 864e5);

/* Quellen (6.1). Signale in USD, Bewertung in EUR (A-4). */
const SOURCES = {
  ftse: { kind: 'yahoo', symbol: 'VWRD.L', field: 'adjclose', from: '2012-01-01' },
  btc: { kind: 'yahoo', symbol: 'BTC-USD', field: 'close', from: '2014-09-01' },
  gold: { kind: 'lbma', url: 'https://prices.lbma.org.uk/json/gold_pm.json', from: '2012-01-01' },
  comex: { kind: 'yahoo', symbol: 'GC=F', field: 'close', from: yearsAgo(3) },
  eur_ftse: { kind: 'yahoo', symbol: 'VWCE.DE', field: 'close', from: yearsAgo(3) },
  eur_btc: { kind: 'yahoo', symbol: 'BTC-EUR', field: 'close', from: yearsAgo(3) },
  eur_gold: { kind: 'yahoo', symbol: 'SGBS.MI', field: 'close', from: yearsAgo(3) },
  eurusd: { kind: 'yahoo', symbol: 'EURUSD=X', field: 'close', from: yearsAgo(3) }
};

function readPrev() {
  if (!existsSync(OUT)) return null;
  const m = readFileSync(OUT, 'utf8').match(/^var MARKET = (.*);$/m);
  try { return m ? JSON.parse(m[1]) : null; } catch { return null; }
}

function writeMarket(market) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, '/* Automatisch erzeugt von scripts/update-data.mjs – nicht von Hand ändern. */\n' +
    'var MARKET = ' + JSON.stringify(market) + ';\n' +
    "if (typeof module !== 'undefined') module.exports = MARKET;\n");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(name, url) {
  if (process.env.MARKET_FIXTURES) {
    const f = join(process.env.MARKET_FIXTURES, name + '.json');
    if (!existsSync(f)) throw new Error('keine Testdatei ' + name);
    return JSON.parse(readFileSync(f, 'utf8'));
  }
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Regel-Depot Datenjob)', Accept: 'application/json' } });
      if (r.ok) return await r.json();
      err = new Error('HTTP ' + r.status);
    } catch (e) { err = e; }
    await sleep(2000 * 2 ** i);
  }
  throw err;
}
function yahooUrl(src) {
  const p1 = Math.floor(Date.parse(src.from + 'T00:00:00Z') / 1000), p2 = Math.floor(now / 1000) + 86400;
  return 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(src.symbol) +
    '?period1=' + p1 + '&period2=' + p2 + '&interval=1d&events=div%7Csplit&includeAdjustedClose=true';
}
async function load(name) {
  const src = SOURCES[name];
  if (src.kind === 'lbma') return M.parseLbma(await getJson(name, src.url), src.from);
  return M.parseYahoo(await getJson(name, yahooUrl(src)), src.field);
}

async function telegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { sent: false, reason: 'nicht eingerichtet' };
  if (process.env.MARKET_FIXTURES) return { sent: false, reason: 'Testlauf' };
  const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error('Telegram: ' + String(j.description || 'HTTP ' + r.status).split(token).join('***'));
  return { sent: true };
}

function pagesUrl() {
  if (process.env.PAGES_URL) return process.env.PAGES_URL;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) return '';
  const [owner, name] = repo.split('/');
  return 'https://' + owner.toLowerCase() + '.github.io/' + name + '/';
}

function seed() {
  const HIST = require('../site/js/data.js');
  const series = { ftse: HIST.ftse, btc: HIST.btc, gold: HIST.gold };
  writeMarket({
    version: 1, source: 'anhang-a', updated: null, series, comex: null,
    eur: {}, rules: M.ruleSummary(series), events: null,
    notify: { channel: 'telegram', configured: null, lastSent: null, lastError: null },
    warnings: ['Noch kein Datenabruf: Signale aus den Testdaten (Anhang A, bis 18./20.09.2026), keine täglichen Euro-Kurse.']
  });
  console.log('Startdatei geschrieben:', OUT);
}

async function main() {
  if (process.argv.includes('--seed')) return seed();
  const prev = readPrev();
  const warnings = [], raw = {};
  for (const name of Object.keys(SOURCES)) {
    try { raw[name] = await load(name); console.log('✓', name, raw[name].d.length, 'Tage bis', raw[name].d[raw[name].d.length - 1]); }
    catch (e) { warnings.push('Abruf ' + name + ' fehlgeschlagen: ' + e.message + '. Vorherige Daten bleiben.'); console.warn('✗', name, e.message); }
  }
  if (!raw.ftse && !raw.btc && !raw.gold && !raw.eur_ftse) { console.error('Keine Quelle erreichbar – nichts geschrieben.'); process.exit(1); }

  /* Wochenpunkte der Signalreihen, nur abgeschlossene Wochen */
  const series = {}, prevSeries = (prev && prev.source !== 'anhang-a' && prev.series) || {};
  for (const a of LOGIC.ASSETS) {
    const W = raw[a] ? M.toWeekly(raw[a], M.WEEK_CLOSE[a], now) : null;
    if (W && W.k.length < 60) warnings.push(a + ': nur ' + W.k.length + ' Wochen geliefert, zu wenig für den SMA50. Vorherige Daten bleiben.');
    if (W && W.k.length >= 60) {
      const gaps = M.weekGaps(W);
      if (gaps.length) warnings.push(a + ': Wochen ohne Kurs: ' + gaps.slice(-3).join(', '));
      series[a] = M.roundSeries(W, a === 'ftse' ? 4 : 2);
    } else if (prevSeries[a]) series[a] = prevSeries[a];
    else series[a] = require('../site/js/data.js')[a];
    /* Fehlt der zuletzt fällige Wochenschluss? (O-14: vorerst nur Hinweis) */
    let due = ENG.mondayOf(iso(now));
    while (now < M.WEEK_CLOSE[a](due)) due = ENG.addDays(due, -7);
    const last = series[a].k[series[a].k.length - 1];
    if (last < due) warnings.push(a + ': Wochenschluss der Woche ab ' + due + ' fehlt noch (letzter: ' + last + ').');
  }

  /* Gegenprobe Gold mit COMEX (A-5), gleiche 4-Wochen-Regel */
  let comex = prev && prev.comex || null;
  if (raw.comex) {
    const W = M.toWeekly(raw.comex, M.WEEK_CLOSE.comex, now), r = ENG.evalRule(W, LOGIC.RULESET.rules.gold), L = r.last;
    const since = L.lastSwitch ? L.lastSwitch.d : null;
    comex = { d: L.d, c: LOGIC.round(L.c, 2), m: LOGIC.round(L.m, 2), dist: L.dist, st: L.st, since };
  }

  /* Tägliche Euro-Kurse für Bewertung und Performance */
  const eur = {};
  for (const [key, name] of [['ftse', 'eur_ftse'], ['btc', 'eur_btc'], ['gold', 'eur_gold'], ['eurusd', 'eurusd']]) {
    if (raw[name]) eur[key] = M.roundSeries({ d: raw[name].d, c: raw[name].c }, key === 'eurusd' ? 5 : 2);
    else if (prev && prev.eur && prev.eur[key]) eur[key] = prev.eur[key];
  }

  const rules = M.ruleSummary(series);
  const prevEvents = prev && Array.isArray(prev.events) ? prev.events : null;
  const fresh = M.newSignals(rules, prevEvents, now);
  const notify = Object.assign({ channel: 'telegram', lastSent: null, lastError: null }, prev && prev.notify, {
    configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  });
  const url = pagesUrl();
  for (const ev of fresh) {
    try {
      const res = await telegram(M.signalMessage(ev, rules, url));
      ev.notified = res.sent ? new Date(now).toISOString() : null;
      ev.note = res.sent ? 'per Telegram gemeldet' : 'nicht gemeldet: ' + res.reason;
      if (res.sent) { notify.lastSent = ev.notified; notify.lastError = null; }
      console.log('Signal', ev.id, '→', ev.note);
    } catch (e) {
      ev.notified = null; ev.note = 'Fehler: ' + e.message; notify.lastError = e.message;
      console.error('Signal', ev.id, e.message);
    }
  }
  if (process.env.TEST_NOTIFICATION === 'true') {
    try {
      const res = await telegram(M.statusMessage(rules, url));
      console.log('Testnachricht:', res.sent ? 'gesendet' : res.reason);
      if (res.sent) { notify.lastSent = new Date(now).toISOString(); notify.lastError = null; }
    } catch (e) { notify.lastError = e.message; console.error('Testnachricht:', e.message); }
  }

  writeMarket({
    version: 1, source: 'yahoo+lbma', updated: new Date(now).toISOString(), series, comex, eur, rules,
    events: fresh.concat(prevEvents || []).slice(0, 100), notify, warnings
  });
  console.log('Geschrieben:', OUT, warnings.length ? '(' + warnings.length + ' Hinweise)' : '');
  warnings.forEach((w) => console.warn('Hinweis:', w));
}

main().catch((e) => { console.error(e); process.exit(1); });
