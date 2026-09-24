// Liest die Testdaten (Anhang A) aus docs/uebergabe.md und schreibt site/js/data.js.
// Aufruf: node scripts/extract-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(root, 'docs/uebergabe.md'), 'utf8');

const blocks = [...md.matchAll(/```csv\n([\s\S]*?)```/g)].map(m => m[1].trim().split('\n').slice(1));
if (blocks.length !== 3) throw new Error('Erwartet 3 CSV-Blöcke in Anhang A, gefunden: ' + blocks.length);

function series(lines) {
  const k = [], d = [], c = [];
  for (const line of lines) {
    const [key, date, close] = line.split(',');
    k.push(key); d.push(date); c.push(Number(close));
  }
  return { k, d, c };
}
const [ftse, btc, gold] = blocks.map(series);
for (const [name, s] of Object.entries({ ftse, btc, gold })) {
  if (s.c.length !== 130) throw new Error(name + ': erwartet 130 Wochenschlüsse, gefunden ' + s.c.length);
}

const out = `/* Automatisch erzeugt aus docs/uebergabe.md, Anhang A (node scripts/extract-data.mjs).
   130 Wochenschlüsse je Reihe in US-Dollar. k = Montag der Woche, d = Tag des Wochenschlusses, c = Schluss. */
var HIST = ${JSON.stringify({ ftse, btc, gold })};
if (typeof module !== 'undefined') module.exports = HIST;
`;
writeFileSync(join(root, 'site/js/data.js'), out);
console.log('site/js/data.js geschrieben:', ftse.c.length, btc.c.length, gold.c.length, 'Wochen');
