# Regel-Depot 50/30/20

Persönliche Portfolio-Web-App für ein Trade-Republic-Depot aus drei Bausteinen: **FTSE All-World (50 %)**, **Bitcoin (30 %)** und **Gold (20 %)**. Jeder Baustein folgt einer eigenen Trendregel auf Basis des 50-Wochen-Durchschnitts (SMA50) und ist entweder investiert oder in Cash. Einmal im Jahr wird auf 50/30/20 zurückgeschichtet, steuerlich so günstig wie möglich.

Grundlage ist das Übergabedokument [`docs/uebergabe.md`](docs/uebergabe.md) (Stand 24.09.2026).

> Keine Anlage- und keine Steuerberatung. Alle Steuerzahlen sind Schätzungen nach Rechtsstand September 2026. Die App führt keine Orders aus und verbindet sich nicht mit Trade Republic.

## Starten

Ohne Installation: `site/index.html` im Browser öffnen. Online (nach der Einrichtung unten): **https://justusboesken-maker.github.io/Enjoyer-OS/**

Mit Node.js (ab Version 18):

```bash
npm start          # http://localhost:8080
npm test           # Abnahmetests B-1 bis B-12, Datenjob, Performance
npm run build      # eine eigenständige Datei: dist/regel-depot.html
npm run update     # Kursdaten jetzt abrufen (braucht Zugang zu Yahoo und LBMA)
```

## Aufbau der Seite

Eine durchgehende Seite. Die Leiste oben springt zu den Abschnitten:

| Abschnitt | Inhalt |
|---|---|
| **Übersicht** | Depotwert, Einstand, Gewinn, Cash. „Was ist zu tun?“ je Baustein nach der Handlungsmatrix (Regel × Bestand). Termine mit Countdown, Status von Kursdaten und Telegram, dringende offene Fragen |
| **Charts** | **Portfolio-Performance** in drei Ansichten: Depot gesamt, Positionen gegen Einstand, zeitgewichtete Rendite. Darunter die **Signalcharts** je Baustein: SMA50, beim Bitcoin das 3-%-Band, Zustandsstreifen, Signalmarker, Abstand zum SMA50. Dazu Schwelle für die nächste Woche, Was-wäre-wenn-Rechner, Begründung, Wochentabelle und Signalverlauf |
| **Depot** | **Ist und Ziel als Kreisdiagramme** nebeneinander, Ist getrennt nach investiert und Cash je Baustein. Positionen, Cash je Baustein, Euro-Kurse, Kauflose nach FIFO, Transaktionen, Export/Import |
| **Rebalancing** | Varianten „steuerfrei“ und „voll auf 50/30/20“ mit Steuer, Orders und Gewichten. Rechenbeispiele B-9 bis B-12 mit Live-Abgleich |
| **Steuern** | Pauschbetrag, Freigrenze, Verkaufssimulator, Haltefristen, Vorabpauschale, Krypto-Entwurf |
| **Regeln & Fragen** | Statuskennzeichen, offene Fragen mit Eingabefeldern, Regeln, Annahmen, Datenquellen, Berichte |

Die Statuskennzeichen aus dem Dokument (BESCHLOSSEN, ANNAHME, OFFEN, FAKT, VORSCHLAG) stehen überall dort, wo ein Wert herkommt. Offene Schwellen (Vorwarnung, Grenzfall, Mindestorder, Puffer) haben keinen Vorgabewert.

Entscheidungen vom 24.09.2026:
- **O-5:** Das Cash ist bis zum Ziel verteilt: FTSE 44,71 €, Bitcoin 522,39 €, Gold 2.834,90 €.
- **O-11:** Benachrichtigung per Telegram, Hosting auf GitHub Pages, öffentlich ohne Login.

## Daten und Benachrichtigungen

Der Workflow [`.github/workflows/daten.yml`](.github/workflows/daten.yml) läuft auf GitHub:

| Zeit (UTC) | Zweck |
|---|---|
| Freitag 17:15 | Wochenschluss FTSE (Börsenschluss London) und Gold (LBMA-PM-Fixing) |
| Montag 00:20 | Wochenschluss Bitcoin (Sonntag 24:00 UTC) |
| täglich 21:40 | Euro-Kurse für Bewertung und Performance |

Jeder Lauf macht nacheinander:

1. die Tests laufen lassen
2. Yahoo (VWRD.L bereinigt, BTC-USD, GC=F, VWCE.DE, BTC-EUR, SGBS.MI, EURUSD=X) und LBMA (Gold PM) abrufen
3. daraus Wochenpunkte bilden, nur abgeschlossene Wochen
4. den Regelstand rechnen und `site/data/market.js` committen
5. die Seite auf GitHub Pages veröffentlichen

Bei einem **neuen Kauf- oder Verkaufssignal** schickt er eine Telegram-Nachricht mit Begründung, Handelstag und nächster Schwelle. Jedes Signal wird nur einmal gemeldet. Fällt eine Quelle aus, bleiben die alten Daten stehen, und die Übersicht zeigt einen Hinweis (O-14 ist noch offen).

## Betrieb einrichten (einmalig)

1. **Diesen Stand nach `main` bringen.** GitHub führt geplante Workflows nur auf dem Standard-Branch aus.
2. **GitHub Pages einschalten:** Repo → *Settings* → *Pages* → *Build and deployment* → *Source*: **GitHub Actions**.
3. **Telegram-Bot anlegen:**
   1. In Telegram **@BotFather** öffnen, `/newbot` senden, Namen vergeben. Du bekommst ein **Token**.
   2. Deinem neuen Bot eine beliebige Nachricht schicken, z. B. `/start`.
   3. Im Browser `https://api.telegram.org/bot<TOKEN>/getUpdates` öffnen und die Zahl bei `"chat":{"id": …}` notieren. Das ist die **Chat-ID**.
4. **Secrets hinterlegen:** Repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*:
   - `TELEGRAM_BOT_TOKEN` = Token
   - `TELEGRAM_CHAT_ID` = Chat-ID

   Die Werte stehen nie im Code und nie in `market.js`.
5. **Testen:** Repo → *Actions* → „Kursdaten, Signale und Website“ → *Run workflow*, Häkchen bei „Telegram-Testnachricht“ setzen. Du bekommst den aktuellen Regelstand aufs Handy, und die Seite ist unter der Pages-Adresse erreichbar.

Hinweise:

- **Öffentlich:** Die Seite ist öffentlich wie das Repo.
- **Deine Eingaben:** Transaktionen, Cash und Steuerlage speichert die Seite im jeweiligen Browser. Exportiere sie über *Depot → Daten exportieren*.
- **Verzögerungen:** GitHub startet geplante Läufe manchmal einige Minuten später. Der Job zählt trotzdem nur abgeschlossene Wochen.

## Geprüft

`npm test` rechnet die Beispiele aus Abschnitt 9 exakt nach:
- SMA50 und Schwellen (B-1, B-6)
- die Signalfolgen (B-2 bis B-5)
- Depotbewertung und Abnahme 7.1 (14.174,48 €)
- die Steuerbeispiele (B-8)
- das Rebalancing (B-9 bis B-12)

Außerdem prüft er den Datenjob mit nachgebauten Yahoo- und LBMA-Antworten:
- Aus Tageskursen entstehen exakt die Wochenschlüsse aus Anhang A.
- Ein neues Signal wird genau einmal gemeldet.

Und den Performance-Verlauf einschließlich der zeitgewichteten Rendite.

## Noch offen

- Vorwarnungen vor dem Wochenschluss (beschlossen, aber Abstand und Zeiten fehlen, O-7)
- Umgang mit fehlenden Kursdaten über den Hinweis hinaus (O-14)
- Login (nicht gewünscht, Seite ist öffentlich)
