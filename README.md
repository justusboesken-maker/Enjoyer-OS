# Regel-Depot 50/30/20

Persönliche Portfolio-Web-App für ein Trade-Republic-Depot aus drei Bausteinen: **FTSE All-World (50 %)**, **Bitcoin (30 %)** und **Gold (20 %)**. Jeder Baustein folgt einer eigenen Trendregel auf Basis des 50-Wochen-Durchschnitts (SMA50) und ist entweder investiert oder in Cash. Einmal im Jahr wird auf 50/30/20 zurückgeschichtet, steuerlich so günstig wie möglich.

Grundlage ist das Übergabedokument [`docs/uebergabe.md`](docs/uebergabe.md) (Stand 24.09.2026).

> Keine Anlage- und keine Steuerberatung. Alle Steuerzahlen sind Schätzungen nach Rechtsstand September 2026. Die App führt keine Orders aus und verbindet sich nicht mit Trade Republic.

## Starten

Ohne Installation: `site/index.html` im Browser öffnen.

Oder mit Node.js (ab Version 18):

```bash
npm start          # http://localhost:8080
npm test           # Abnahmetests B-1 bis B-12
npm run build      # eine eigenständige Datei: dist/regel-depot.html
```

## Was die Website kann

| Bereich | Inhalt |
|---|---|
| **Übersicht** | Depotwert, Einstand, Gewinn, Cash. „Was ist zu tun?“ je Baustein nach der Handlungsmatrix (Regel × Bestand), bei Bitcoin beide Wege für den Wochenschluss am 27.09. Ist gegen Ziel 50/30/20, Termine mit Countdown, dringende offene Fragen |
| **Signale** | Je Baustein: Zustand, letzter Wochenschluss, SMA50, Abstand, Zähler, letzter Wechsel, Schwelle für die nächste Woche (Formeln aus 8.2) und fehlende Schlüsse. Interaktiver Chart (1 J/3 J/5 J/Max, Hover und Tastatur), Was-wäre-wenn-Rechner für den nächsten Wochenschluss, Begründung zum Aufklappen, Wochentabelle, Wochenschluss nachtragen, Gegenprobe Gold (COMEX), Verlauf aller Signale |
| **Depot** | Positionen, Cash je Baustein (A-1), Euro-Kurse mit Datum, Kauflose nach FIFO mit steuerlicher Einordnung, Transaktionen erfassen, bearbeiten und löschen, Export/Import als JSON |
| **Rebalancing** | Varianten „steuerfrei“ und „voll auf 50/30/20“ nebeneinander, mit Steuer (§ 20/§ 23), Orders, Gewichten danach, Pauschbetrag und Freigrenze. Stichtag, Regelstand und Kurse frei wählbar. Die Rechenbeispiele B-9 bis B-12 lassen sich laden und werden live gegen die Erwartung geprüft. Hinweis „Pauschbetrag nutzen“ |
| **Steuern** | Pauschbetrag und Freigrenze als Balken, Verkaufssimulator (FIFO, Haltefrist, Klippe der Freigrenze), Haltefristen, Vorabpauschale, Krypto-Entwurf als Szenario |
| **Regeln & Fragen** | Status-Legende, alle 17 offenen Fragen mit Eingabefeldern und Fortschritt, Signalregeln und Zustandsautomaten, Annahmen A-1 bis A-12, Datenquellen, Berichte |

Die Statuskennzeichen aus dem Dokument (BESCHLOSSEN, ANNAHME, OFFEN, FAKT, VORSCHLAG) stehen überall dort, wo ein Wert herkommt. Offene Schwellen (Vorwarnung, Grenzfall, Mindestorder, Puffer) haben keinen Vorgabewert. Die zugehörigen Funktionen greifen erst, wenn du einen Wert einträgst.

## Daten

- **Marktdaten:** die 130 Wochenschlüsse je Reihe aus Anhang A (bis 18./20.09.2026). Neue Wochenschlüsse trägst du unter *Signale → Wochenschluss nachtragen* ein. Beim bereinigten FTSE wird die Historie dabei wie in 6.2 reskaliert.
- **Depot:** die Startdaten aus Abschnitt 5, danach deine Eingaben. Sie liegen nur im `localStorage` dieses Browsers. Sichere sie über *Depot → Daten exportieren*.

## Geprüft

`npm test` rechnet die Beispiele aus Abschnitt 9 exakt nach: SMA50 und Schwellen (B-1, B-6), die Signalfolgen (B-2 bis B-5), Depotbewertung und Abnahme 7.1 (14.174,48 €; 49,7 / 26,3 / 24,0 %), die Steuerbeispiele (B-8) und das Rebalancing (B-9 bis B-12).

## Noch nicht enthalten

Diese Punkte hängen an offenen Fragen oder brauchen einen Server:

- automatischer Datenjob für Yahoo und LBMA (CORS, Vorschlag aus Abschnitt 10)
- Benachrichtigungen, Hosting und Login (O-11)
- Umgang mit fehlenden Kursdaten (O-14): derzeit nur ein Hinweis
