# CLAUDE.md

## Fachliche Grundlage

Fachliche Regeln stehen in `docs/uebergabe.md`. Abschnitt 2 ist verbindlich, Abschnitte 3 und 4 sind Annahmen und offene Fragen. Nichts davon ohne Rückfrage ändern oder ergänzen.

- Fehlende Schwellenwerte werden nicht erfunden. Wo das Dokument „OFFEN“ sagt, bleibt das Feld leer (`null` in `site/js/start.js`) oder die App fragt nach.
- Annahmen (A-1 bis A-12) sind umgesetzt, einstellbar und in der Oberfläche gekennzeichnet (`chip('annahme')`, `aref('A-x')`).
- Offene Fragen (O-1 bis O-17) sind in `QUESTIONS` in `site/js/app.js` hinterlegt, jeweils mit Prüfung „geklärt?“ und Eingabefeld.
- Keine automatischen Orders, kein Login bei Trade Republic, keine Steuer-ID oder Kontonummern speichern (7.5).

## Aufbau

Statische Web-App ohne Build-Schritt und ohne Abhängigkeiten. `site/index.html` funktioniert direkt per Doppelklick (klassische Skripte, keine ES-Module).

| Datei | Inhalt |
|---|---|
| `site/js/engine.js` | Rechenkern aus Anhang B (Regeln, FIFO, Steuern, Rebalancing). Abweichungen von der Vorlage sind mit `[App]` markiert |
| `site/js/logic.js` | Reine App-Logik (Regelparameter, Handlungsmatrix, Cash-Buchhaltung, Steuer-Konfiguration, Rechenbeispiele B-9 bis B-11) |
| `site/js/data.js` | Testdaten aus Anhang A, erzeugt mit `npm run extract` – nicht von Hand ändern |
| `site/js/start.js` | Startdepot und Steuerlage vom 24.09.2026 (Abschnitt 5) |
| `site/js/charts.js` | SVG-Chart je Baustein (Schluss, SMA50, Band, Zustandsstreifen, Abstand) |
| `site/js/app.js` | Oberfläche, Zustand (localStorage), Ereignisse |
| `test/engine.test.js` | Abnahmetests B-1 bis B-12 und 7.1 |

## Befehle

- `npm test` – Abnahmetests (node:test, keine Abhängigkeiten). Müssen vor jedem Commit grün sein.
- `npm start` – lokaler Server auf http://localhost:8080
- `npm run build` – eine eigenständige Datei `dist/regel-depot.html`
- `npm run extract` – `site/js/data.js` neu aus `docs/uebergabe.md` erzeugen

## Konventionen

- Oberfläche und Kommentare auf Deutsch, Zahlen im deutschen Format (`num`, `eur`, `usd`, `pct` in `app.js`).
- Fachliche Rechnungen gehören in `engine.js` oder `logic.js` (rein, testbar), nicht in `app.js`.
- Gerundet wird mit `LOGIC.round` (kaufmännisch, robust gegen Binärfehler), nie mit `toFixed`.
- Dynamische Texte in HTML-Strings immer mit `esc()` einsetzen.
- Farben nur über CSS-Tokens in `site/css/styles.css`; Baustein-Farben: FTSE blau, Bitcoin orange, Gold aqua (validierte Palette).
