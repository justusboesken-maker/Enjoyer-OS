# CLAUDE.md

## Fachliche Grundlage

Fachliche Regeln stehen in `docs/uebergabe.md`. Abschnitt 2 ist verbindlich, Abschnitte 3 und 4 sind Annahmen und offene Fragen. Nichts davon ohne Rückfrage ändern oder ergänzen.

- Fehlende Schwellenwerte werden nicht erfunden. Wo das Dokument „OFFEN“ sagt, bleibt das Feld leer (`null` in `site/js/start.js`) oder die App fragt nach.
- Annahmen (A-1 bis A-12) sind umgesetzt, einstellbar und in der Oberfläche gekennzeichnet (`chip('annahme')`, `aref('A-x')`).
- Offene Fragen (O-1 bis O-17) sind in `QUESTIONS` in `site/js/app.js` hinterlegt, jeweils mit Prüfung „geklärt?“ und Eingabefeld.
- Keine automatischen Orders, kein Login bei Trade Republic, keine Steuer-ID oder Kontonummern speichern (7.5).

## Aufbau

Statische Web-App ohne Build-Schritt und ohne Abhängigkeiten, eine durchgehende Seite (Übersicht, Charts, Depot, Rebalancing, Steuern, Regeln & Fragen). `site/index.html` funktioniert direkt per Doppelklick (klassische Skripte, keine ES-Module). Kursdaten holt ein Datenjob (GitHub Actions) von Yahoo und LBMA; er meldet neue Signale per Telegram und veröffentlicht die Seite auf GitHub Pages.

| Datei | Inhalt |
|---|---|
| `site/js/engine.js` | Rechenkern aus Anhang B (Regeln, FIFO, Steuern, Rebalancing). Abweichungen von der Vorlage sind mit `[App]` markiert |
| `site/js/logic.js` | Reine App-Logik (Regelparameter, Handlungsmatrix, Cash-Buchhaltung, Steuer-Konfiguration, Rechenbeispiele B-9 bis B-11) |
| `site/js/data.js` | Testdaten aus Anhang A, erzeugt mit `npm run extract` – nicht von Hand ändern |
| `site/js/start.js` | Startdepot und Steuerlage vom 24.09.2026 (Abschnitt 5) |
| `site/js/charts.js` | SVG-Chart je Baustein (Schluss, SMA50, Band, Zustandsstreifen, Abstand) |
| `site/js/app.js` | Oberfläche, Zustand (localStorage), Ereignisse |
| `site/data/market.js` | Kursdaten des Datenjobs (`MARKET`), automatisch erzeugt – nicht von Hand ändern. Fehlt sie, gelten die Testdaten |
| `scripts/market.cjs` | Reine Funktionen des Datenjobs: Yahoo/LBMA parsen, Wochenpunkte, neue Signale, Telegram-Text |
| `scripts/update-data.mjs` | Datenjob: abrufen, rechnen, `market.js` schreiben, Telegram senden (Secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) |
| `.github/workflows/daten.yml` | Zeitplan Fr 17:15 / Mo 00:20 / täglich 21:40 UTC, Tests, Datenjob, Commit, Pages |
| `test/engine.test.js` | Abnahmetests B-1 bis B-12, 7.1, Performance |
| `test/market.test.js` | Datenjob mit nachgebauten Yahoo-/LBMA-Antworten |

## Befehle

- `npm test` – Abnahmetests (node:test, keine Abhängigkeiten). Müssen vor jedem Commit grün sein.
- `npm start` – lokaler Server auf http://localhost:8080
- `npm run build` – eine eigenständige Datei `dist/regel-depot.html`
- `npm run extract` – `site/js/data.js` neu aus `docs/uebergabe.md` erzeugen
- `npm run update` – Datenjob lokal (braucht Netz zu Yahoo und LBMA; `--seed` schreibt die Startdatei aus Anhang A)

## Konventionen

- Oberfläche und Kommentare auf Deutsch, Zahlen im deutschen Format (`num`, `eur`, `usd`, `pct` in `app.js`).
- Fachliche Rechnungen gehören in `engine.js` oder `logic.js` (rein, testbar), nicht in `app.js`.
- Gerundet wird mit `LOGIC.round` (kaufmännisch, robust gegen Binärfehler), nie mit `toFixed`.
- Dynamische Texte in HTML-Strings immer mit `esc()` einsetzen.
- Farben nur über CSS-Tokens in `site/css/styles.css`; Baustein-Farben: FTSE blau, Bitcoin orange, Gold aqua (validierte Palette).
- Entscheidungen des Nutzers (z. B. O-5, O-11 am 24.09.2026) stehen in `site/js/start.js`; ältere Browser-Speicherstände hebt `migrate()` in `app.js` an.
- Der Datenjob zählt nur abgeschlossene Wochen und meldet jedes Signal genau einmal (`events` in `market.js`). Keine Tokens loggen.
