/* Tests für den Datenjob (scripts/market.cjs, scripts/update-data.mjs).
   Die Netzantworten werden aus den Testdaten (Anhang A) im Yahoo- bzw. LBMA-Format nachgebaut:
   Jede Woche bekommt mehrere Handelstage, der letzte trägt den Wochenschluss aus Anhang A. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ENG = require('../site/js/engine.js');
const L = require('../site/js/logic.js');
const HIST = require('../site/js/data.js');
const M = require('../scripts/market.cjs');

const JOB = path.join(__dirname, '..', 'scripts', 'update-data.mjs');

test('Wochenschluss-Zeitpunkte: London mit Sommer- und Winterzeit, Bitcoin Sonntag 24:00 UTC', () => {
  assert.equal(new Date(M.londonToUtc('2026-09-25', 16, 30)).toISOString(), '2026-09-25T15:30:00.000Z');
  assert.equal(new Date(M.londonToUtc('2026-12-18', 16, 30)).toISOString(), '2026-12-18T16:30:00.000Z');
  assert.equal(new Date(M.WEEK_CLOSE.gold('2026-09-21')).toISOString(), '2026-09-25T14:00:00.000Z');
  assert.equal(new Date(M.WEEK_CLOSE.btc('2026-09-21')).toISOString(), '2026-09-28T00:00:00.000Z');
});

test('parseYahoo: Ortsdatum, bereinigte Kurse, Lücken und doppelte Tage', () => {
  const t = (d, h) => Date.parse(d + 'T' + h + ':00:00Z') / 1000;
  const json = { chart: { result: [{ meta: { gmtoffset: 3600, symbol: 'VWRD.L', currency: 'USD' },
    timestamp: [t('2026-09-17', '07'), t('2026-09-18', '07'), t('2026-09-18', '15'), t('2026-09-21', '07')],
    indicators: { quote: [{ close: [1, 2, 3, null] }], adjclose: [{ adjclose: [10, 20, 30, null] }] } }], error: null } };
  assert.deepEqual(M.parseYahoo(json, 'adjclose').d, ['2026-09-17', '2026-09-18']);
  assert.deepEqual(M.parseYahoo(json, 'adjclose').c, [10, 30]);
  assert.deepEqual(M.parseYahoo(json, 'close').c, [1, 3]);
  assert.throws(() => M.parseYahoo({ chart: { result: null, error: { code: 'Not Found' } } }, 'close'), /Yahoo/);
});

test('parseLbma: USD-Wert, leere Tage und Startdatum', () => {
  const s = M.parseLbma([{ d: '2011-12-30', v: [1, 2, 3] }, { d: '2026-09-17', v: [4300, 3200, 3700] }, { d: '2026-09-18', v: [4348.15, 3230, 3730] }, { d: '2026-09-19', v: [0, 0, 0] }], '2012-01-01');
  assert.deepEqual(s, { d: ['2026-09-17', '2026-09-18'], c: [4300, 4348.15] });
});

test('toWeekly: letzter Schluss der Woche, laufende Woche erst nach dem Wochenschluss', () => {
  const daily = { d: ['2026-09-14', '2026-09-17', '2026-09-18', '2026-09-21', '2026-09-25'], c: [1, 2, 3, 4, 5] };
  const before = M.toWeekly(daily, M.WEEK_CLOSE.ftse, Date.parse('2026-09-25T15:00:00Z'));
  assert.deepEqual(before, { k: ['2026-09-14'], d: ['2026-09-18'], c: [3] });
  const after = M.toWeekly(daily, M.WEEK_CLOSE.ftse, Date.parse('2026-09-25T17:15:00Z'));
  assert.deepEqual(after.k, ['2026-09-14', '2026-09-21']); assert.deepEqual(after.c, [3, 5]);
  assert.deepEqual(M.weekGaps({ k: ['2026-09-07', '2026-09-21'] }), ['2026-09-07 → 2026-09-21']);
});

/* ---------- Ende-zu-Ende mit nachgebauten Antworten ---------- */

function yahooFromWeeks(S, symbol, offsetHours, days, extra) {
  const ts = [], close = [];
  S.k.forEach((k, i) => {
    const last = S.d[i];
    for (let j = 0; j < days; j++) {
      const d = ENG.addDays(k, j);
      if (d > last) break;
      const v = d === last ? S.c[i] : S.c[i] * (1 + 0.01 * ((j % 3) - 1)); /* Zwischentage weichen ab */
      ts.push(Date.parse(d + 'T00:00:00Z') / 1000 + (8 - offsetHours) * 3600 * (offsetHours ? 1 : 0));
      close.push(v);
    }
  });
  (extra || []).forEach(([d, v]) => { ts.push(Date.parse(d + 'T00:00:00Z') / 1000 + (offsetHours ? 7 * 3600 : 0)); close.push(v); });
  return { chart: { result: [{ meta: { gmtoffset: offsetHours * 3600, symbol }, timestamp: ts,
    indicators: { quote: [{ close }], adjclose: [{ adjclose: close }] } }], error: null } };
}
function lbmaFromWeeks(S) {
  const out = [];
  S.k.forEach((k, i) => {
    for (let j = 0; j < 5; j++) {
      const d = ENG.addDays(k, j);
      if (d > S.d[i]) break;
      out.push({ d, v: [d === S.d[i] ? S.c[i] : S.c[i] - 5, 0, 0] });
    }
  });
  return out;
}
function fixtures(extraBtc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'market-'));
  const w = (name, obj) => fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(obj));
  w('ftse', yahooFromWeeks(HIST.ftse, 'VWRD.L', 1, 5, [['2026-09-21', 186]])); /* laufende Woche */
  w('btc', yahooFromWeeks(HIST.btc, 'BTC-USD', 0, 7, extraBtc || [['2026-09-21', 80000]]));
  w('gold', lbmaFromWeeks(HIST.gold));
  w('comex', yahooFromWeeks({ k: HIST.gold.k, d: HIST.gold.d, c: HIST.gold.c.map((c) => c * 1.01) }, 'GC=F', -4, 5));
  const eurDays = { d: ['2026-09-22', '2026-09-23', '2026-09-24'], c: [168.1, 168.5, 168.92] };
  const ySimple = (s, sym) => ({ chart: { result: [{ meta: { gmtoffset: 7200, symbol: sym }, timestamp: s.d.map((d) => Date.parse(d + 'T07:00:00Z') / 1000),
    indicators: { quote: [{ close: s.c }] } }], error: null } });
  w('eur_ftse', ySimple(eurDays, 'VWCE.DE'));
  w('eur_btc', ySimple({ d: eurDays.d, c: [72000, 73000, 73908.69] }, 'BTC-EUR'));
  /* eur_gold fehlt absichtlich: Abruf schlägt fehl, Job läuft mit Hinweis weiter */
  w('eurusd', ySimple({ d: eurDays.d, c: [1.17, 1.171, 1.1377] }, 'EURUSD=X'));
  return dir;
}
function runJob(dir, out, nowIso) {
  const env = Object.assign({}, process.env, { MARKET_FIXTURES: dir, MARKET_OUT: out, MARKET_NOW: nowIso });
  delete env.TELEGRAM_BOT_TOKEN; delete env.TELEGRAM_CHAT_ID; delete env.TEST_NOTIFICATION;
  execFileSync(process.execPath, [JOB], { env, stdio: 'pipe' });
  delete require.cache[require.resolve(out)];
  return require(out);
}

test('Datenjob: ergibt aus Tageskursen exakt die Wochenschlüsse aus Anhang A und den Regelstand aus B-1', () => {
  const dir = fixtures(), out = path.join(dir, 'market.js');
  const m = runJob(dir, out, '2026-09-24T12:00:00Z');
  for (const a of L.ASSETS) {
    assert.deepEqual(m.series[a].k, HIST[a].k, a + ' Schlüssel');
    assert.deepEqual(m.series[a].d, HIST[a].d, a + ' Schlusstage');
    assert.deepEqual(m.series[a].c, HIST[a].c.map((c) => L.round(c, a === 'ftse' ? 4 : 2)), a + ' Schlüsse');
  }
  assert.equal(L.round(m.rules.ftse.m, 4), 172.3443); assert.equal(m.rules.ftse.st, 1); assert.equal(m.rules.ftse.up, 73);
  assert.equal(L.round(m.rules.btc.next.thr, 4), 80435.875); assert.equal(m.rules.btc.st, 0);
  assert.equal(L.round(m.rules.gold.next.thr, 2), 4469.21); assert.equal(m.rules.gold.dn, 3);
  assert.equal(m.eur.ftse.c[2], 168.92); assert.equal(m.eur.btc.d[2], '2026-09-24');
  assert.ok(m.warnings.some((w) => /eur_gold/.test(w)), 'fehlender Abruf erzeugt Hinweis');
  assert.deepEqual(m.events, [], 'erster Lauf meldet keine alten Signale');
  assert.deepEqual([m.comex.d, m.comex.st], ['2026-09-18', m.rules.gold.st]); /* nachgebaute COMEX-Reihe folgt dem Gold */
});

test('Datenjob: neues Kaufsignal Bitcoin am 27.09. wird einmal erkannt und nicht doppelt gemeldet', () => {
  const week = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
  const extra = week.map((d, i) => [d, i === 6 ? 82000 : 80000]).concat([['2026-09-28', 82500]]);
  const dir = fixtures(extra), out = path.join(dir, 'market.js');
  runJob(dir, out, '2026-09-24T12:00:00Z'); /* erster Lauf, legt die Ereignisliste an */
  const m = runJob(dir, out, '2026-09-28T00:20:00Z');
  assert.equal(m.series.btc.k[m.series.btc.k.length - 1], '2026-09-21');
  assert.equal(m.rules.btc.st, 1); assert.equal(m.rules.btc.changed, true);
  assert.equal(m.events.length, 1);
  assert.deepEqual([m.events[0].id, m.events[0].trade], ['btc:2026-09-21:1', '2026-09-28']);
  assert.match(m.events[0].note, /nicht eingerichtet/);
  const again = runJob(dir, out, '2026-09-28T21:30:00Z');
  assert.equal(again.events.length, 1, 'kein zweites Ereignis für dasselbe Signal');
});

test('Nachrichtentext für Telegram', () => {
  const series = { ftse: HIST.ftse, btc: HIST.btc, gold: HIST.gold };
  const rules = M.ruleSummary(series);
  const txt = M.signalMessage({ a: 'btc', to: 1, d: '2026-09-27', c: 82000, m: 78100, trade: '2026-09-28' }, rules, 'https://example.github.io/x/');
  assert.match(txt, /KAUFSIGNAL Bitcoin \(3-%-Band\)/);
  assert.match(txt, /Montag, 28\.09\.2026/);
  assert.match(txt, /1,03 × SMA50 = 80\.443,00 \$/);
  assert.match(txt, /https:\/\/example\.github\.io\/x\//);
  const st = M.statusMessage(rules, '');
  assert.match(st, /FTSE All-World: investiert/); assert.match(st, /Bitcoin: Cash/);
});
