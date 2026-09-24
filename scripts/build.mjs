// Baut eine einzelne, eigenständige HTML-Datei (dist/regel-depot.html) aus site/:
// CSS und alle Skripte werden eingebettet. Praktisch zum Weitergeben oder Öffnen ohne Ordnerstruktur.
// Aufruf: npm run build
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
let html = readFileSync(join(site, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
  '<style>\n' + readFileSync(join(site, href), 'utf8') + '</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => {
  const js = readFileSync(join(site, src), 'utf8');
  if (/<\/script/i.test(js)) throw new Error(src + ' enthält </script> und kann nicht eingebettet werden');
  return '<script>\n' + js + '</script>';
});

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'regel-depot.html'), html);
console.log('dist/regel-depot.html geschrieben (' + Math.round(html.length / 1024) + ' KB)');
