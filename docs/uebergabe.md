# Übergabe: Portfolio-Web-App „Regel-Depot 50/30/20“

**Stand:** 24.09.2026
**Zweck:** fachliche Grundlage für die Entwicklung einer persönlichen Portfolio-Web-App mit Claude Code
**Herkunft:** Planungs-, Backtest- und Steuerrunden im Claude-Projekt „Enjoyer OS“ (22.–24.09.2026), Kontodaten aus Trade-Republic-Screenshots vom 24.09.2026

> Das Dokument beschreibt die Regeln, die du für dein Depot festgelegt hast, und wie eine App sie abbilden soll. Es ist keine Anlage- und keine Steuerberatung. Steuerwerte sind Schätzungen nach Rechtsstand September 2026.

---

## 0. So benutzt du dieses Dokument

Lege die Datei ins Website-Projekt, zum Beispiel als `docs/uebergabe.md`, und verweise in der `CLAUDE.md` darauf, etwa so: „Fachliche Regeln stehen in docs/uebergabe.md. Abschnitt 2 ist verbindlich, Abschnitte 3 und 4 sind Annahmen und offene Fragen. Nichts davon ohne Rückfrage ändern oder ergänzen.“

Jede fachliche Aussage trägt einen Status:

| Status | Bedeutung | Umgang in der App |
|---|---|---|
| **BESCHLOSSEN** | Von dir ausdrücklich festgelegt, oder fester Teil der Regel, die du übernommen hast | So umsetzen |
| **ANNAHME** | In Backtests oder im Prototyp so gerechnet, aber nicht ausdrücklich beschlossen | Umsetzen, konfigurierbar machen und in der Oberfläche als Annahme kennzeichnen |
| **OFFEN** | Entscheidung oder Daten fehlen | Nicht raten. Als Einstellung ohne Vorgabewert anlegen oder beim Nutzer nachfragen |
| **FAKT** | Recht, Kontodaten oder Marktdaten mit Stand | Als Parameter mit Datum hinterlegen |
| **VORSCHLAG** | Technische Empfehlung von Claude | Frei entscheidbar |

Für Claude Code gilt: Fehlende Schwellenwerte werden nicht erfunden. Wo dieses Dokument „OFFEN“ sagt, bleibt das Feld leer oder die App fragt nach.

---

## 1. Kurzfassung

Ein Depot bei Trade Republic aus drei Bausteinen: FTSE All-World (50 %), Bitcoin (30 %) und Gold (20 %). Jeder Baustein folgt einer eigenen Trendregel auf Basis des 50-Wochen-Durchschnitts und ist entweder investiert oder in Cash. Einmal im Jahr, zum Jahresende, wird auf 50/30/20 zurückgeschichtet, steuerlich so günstig wie möglich.

Die App soll drei Dinge leisten:

1. **Portfolioübersicht:** was im Depot liegt, was es wert ist, wie weit es von 50/30/20 entfernt ist.
2. **Nachvollziehbare Signale:** was jede Regel zum letzten Wochenschluss sagt, warum, was du deshalb tun musst und ab welchem Kurs sich nächste Woche etwas ändert.
3. **Rebalancing-Vorschau:** welche Umschichtung zum Jahresende nötig wäre, einmal steuerfrei und einmal voll auf 50/30/20, jeweils mit Steuerwirkung.

---

## 2. Beschlossene Strategie

### 2.1 Bausteine und Zielgewichte

| Baustein | Zielgewicht | Gehandeltes Instrument | Status |
|---|---|---|---|
| FTSE All-World (Total Return) | 50 % | Vanguard FTSE All-World UCITS ETF USD Acc (VWCE, ISIN IE00BK5BQT80), thesaurierend | BESCHLOSSEN |
| Bitcoin | 30 % | Bitcoin direkt bei Trade Republic | BESCHLOSSEN |
| Gold | 20 % | WisdomTree Physical Swiss Gold (ETC mit Lieferanspruch, ISIN JE00B588CD74) | BESCHLOSSEN |

Weitere Festlegungen:

- Broker ist Trade Republic, das Konto läuft in Euro. **BESCHLOSSEN**
- FTSE All-World statt S&P 500. **BESCHLOSSEN**
- Ziel: möglichst wenig Steuern zahlen. **BESCHLOSSEN**
- Umsetzung der Regeln ab der Woche vom 28.09.2026. **BESCHLOSSEN**

### 2.2 Signalregeln

Alle Regeln arbeiten mit Wochenschlusskursen und dem **SMA50**, dem einfachen Durchschnitt der letzten 50 Wochenschlüsse einschließlich der aktuellen Woche.

| Baustein | Regel | Kaufsignal (Einstieg) | Verkaufssignal (Ausstieg) | Status |
|---|---|---|---|---|
| FTSE All-World | 2-Wochen-Regel | 2 Wochenschlüsse in Folge über dem SMA50 | 2 Wochenschlüsse in Folge unter dem SMA50 | BESCHLOSSEN |
| Bitcoin | 3-%-Band | Wochenschluss über 1,03 × SMA50 | Wochenschluss unter 0,97 × SMA50 | BESCHLOSSEN (am 23.09. korrigiert: 3 %, nicht 1 %) |
| Gold | 4-Wochen-Regel | 4 Wochenschlüsse in Folge über dem SMA50 | 4 Wochenschlüsse in Folge unter dem SMA50 | BESCHLOSSEN |

- Jeder Baustein ist entweder **investiert** oder **nicht investiert (Cash)**. **BESCHLOSSEN**
- Beim Bitcoin ändert sich innerhalb des Bands (zwischen 0,97 und 1,03 × SMA50) nichts. **BESCHLOSSEN** (Teil der Bandregel)
- Die Regeln stammen aus dem Kurs „Enjoyer OS“ (Market Enjoyers). Alle Backtests, auf denen deine Entscheidungen beruhen, rechnen genau diese Definitionen.

### 2.3 Signalbasis und Datenquellen

| Punkt | Festlegung | Status |
|---|---|---|
| Währung der Signale | Immer die US-Dollar-Kurse, obwohl das Konto in Euro läuft | BESCHLOSSEN |
| FTSE-Signalreihe | Total-Return-Reihe: VWRD (London, USD) mit bereinigten Schlusskursen, Ausschüttungen wieder angelegt | BESCHLOSSEN (Total Return); VWRD bereinigt ist geprüft, siehe 6.2 |
| Bitcoin-Signalreihe | BTC-USD | BESCHLOSSEN |
| Gold-Signalreihe | LBMA-Goldpreis in USD | BESCHLOSSEN (LBMA); welches Fixing: OFFEN (O-12) |
| Datenquellen | Yahoo Finance und LBMA | BESCHLOSSEN |
| Aktualisierung | Jede Anlage zu ihrem eigenen Wochenschluss | BESCHLOSSEN |

### 2.4 Wochenschluss und Ausführung

| Punkt | Festlegung | Status |
|---|---|---|
| Wochenschluss FTSE und Gold | Letzter Handelstag der Kalenderwoche, normalerweise Freitag | BESCHLOSSEN (Konvention aus Enjoyer OS, in allen Backtests so) |
| Wochenschluss Bitcoin | Sonntag 24:00 UTC, Woche Montag bis Sonntag in UTC | BESCHLOSSEN (dito) |
| Signalzeitpunkt | Am Wochenschluss | BESCHLOSSEN (dito) |
| Handelszeitpunkt | Zur Eröffnung der Folgewoche | BESCHLOSSEN (dito) |
| Praktische Ausführung | Montag früh über Lang & Schwarz (ab 7:30 Uhr), Bitcoin jederzeit am Montag | ANNAHME |
| Umsetzung eines Signals | Verkaufssignal: ganze Position verkaufen, der Erlös bleibt Cash dieses Bausteins. Kaufsignal: das Cash dieses Bausteins wieder anlegen | ANNAHME (A-1) |

### 2.5 Rebalancing

| Punkt | Festlegung | Status |
|---|---|---|
| Häufigkeit | Einmal jährlich zum Jahresende (31.12.) | BESCHLOSSEN |
| Umfang | „Mindestens in der Form, wie es die Freibeträge zulassen“ | BESCHLOSSEN |
| Darstellung | Beide Varianten zeigen: steuerfrei und voll auf 50/30/20. Du entscheidest jedes Jahr im Dezember | BESCHLOSSEN |
| Handelstag Fonds und ETC | Lang & Schwarz handelt am 24.12. und 31.12. nicht, am 30.12. nur bis 14 Uhr | FAKT (Handelskalender 2026) |
| Konkreter Rebalancing-Tag | 30.12. für VWCE und Gold-ETC; Bitcoin am 30. oder 31.12. | ANNAHME, für Bitcoin OFFEN (O-9) |
| Zwischen zwei Rebalancings | Kein Umschichten zwischen den Bausteinen, nur Regelsignale | ANNAHME (A-1) |
| Nicht investierte Bausteine | Bekommen beim Rebalancing ihr Zielgewicht als Cash | ANNAHME (A-2) |

### 2.6 Steuerliche Ausgangslage

| Punkt | Wert | Status |
|---|---|---|
| Familienstand, Kirchensteuer | Ledig, keine Kirchensteuer | BESCHLOSSEN (deine Angabe) |
| Abgeltungsteuer | 26,375 % (25 % plus Solidaritätszuschlag) | FAKT |
| Sparer-Pauschbetrag | 1.000 € pro Jahr (Freibetrag) | FAKT |
| Teilfreistellung Aktien-ETF (VWCE) | 30 % der Erträge steuerfrei | FAKT |
| Bitcoin direkt und Gold-ETC mit Lieferanspruch (§ 23 EStG) | Nach mehr als einem Jahr Haltedauer steuerfrei. Innerhalb eines Jahres gilt eine Freigrenze: Die Summe aller kurzfristigen Gewinne des Jahres bleibt steuerfrei, solange sie **unter 1.000 €** liegt. Ab 1.000 € ist der ganze Betrag steuerpflichtig, nicht nur der Teil darüber | FAKT (Gold-ETC: laut Emittent; Bankpraxis teils uneinheitlich) |
| Verbrauchsfolge beim Verkauf | FIFO, der älteste Kauf zuerst | FAKT |
| Persönlicher Grenzsteuersatz | „Unter 30 %“ | BESCHLOSSEN (deine Angabe), genauer Wert OFFEN (O-4) |
| Vorabpauschale VWCE | Basiszins 2026: 3,20 % | FAKT |
| Krypto-Neuregelung | Referentenentwurf des BMF (September 2026): Bitcoin-Käufe ab 01.01.2027 sollen unter die Abgeltungsteuer fallen, Bestände bis 31.12.2026 behalten die Haltefrist. Noch kein Gesetz | FAKT (Entwurf), in der App nur als Szenario |
| Zinsen auf Cash | 2,5 % laut dir, zählen zum Pauschbetrag | FAKT (deine Angabe) |
| Verlusttopf Aktien 99,66 € | Verrechnet nur Gewinne aus Aktien, nicht aus ETF oder Bitcoin | FAKT (Konto am 24.09.2026) |

### 2.7 Benachrichtigungen und Betrieb

| Punkt | Festlegung | Status |
|---|---|---|
| Kauf- und Verkaufssignale | Benachrichtigung bei jedem Signalwechsel | BESCHLOSSEN |
| Vorwarnung | Vor dem Wochenschluss, wenn ein Kurs nahe an einer Schwelle liegt | BESCHLOSSEN. Was „nahe“ heißt, ist OFFEN (O-7) |
| Portfoliodaten | Aus Trade Republic per Screenshot oder PDF übernehmen, danach Käufe und Verkäufe von Hand erfassen | BESCHLOSSEN |
| Erreichbarkeit | Website im Internet abrufbar | BESCHLOSSEN |
| Keine automatischen Orders | Die App führt keine Trades aus und loggt sich nicht bei Trade Republic ein | ANNAHME (nie anders besprochen, dringend empfohlen) |

---

## 3. Annahmen

In Backtests oder im Prototyp so gerechnet, aber nicht ausdrücklich beschlossen. Die App soll sie als Einstellung führen und in der Oberfläche als Annahme erkennbar machen.

| ID | Annahme | Wo bisher verwendet | Wirkung |
|---|---|---|---|
| A-1 | Baustein-Buchhaltung: Beim Verkaufssignal wird die ganze Position verkauft, der Erlös bleibt Cash dieses Bausteins. Beim Kaufsignal wird genau dieses Cash wieder angelegt. Zwischen den Rebalancings wird nicht zwischen Bausteinen umgeschichtet | Alle Backtests, Prototyp | Gewichte driften übers Jahr |
| A-2 | Beim Rebalancing bekommt ein nicht investierter Baustein sein Zielgewicht als Cash | Steuer-Check, Prototyp | Cash bleibt für den späteren Einstieg reserviert |
| A-3 | Kosten: 1 € je Order bei Trade Republic, Spread beim Bitcoin nicht berücksichtigt. Die Backtests rechneten stattdessen 0,1 % je Trade (Bitcoin 0,2 %) | Prototyp, Backtests | Klein, vor Umsetzung prüfen |
| A-4 | Bewertung in Euro über Yahoo: VWCE.DE (Xetra), BTC-EUR, SGBS.MI (Borsa Italiana) für den Gold-ETC. Die Kurse bei Lang & Schwarz weichen leicht ab | Prototyp | Anzeige, nicht die Signale |
| A-5 | Gold-Signal aus dem LBMA-Nachmittagsfixing (PM), Gegenprobe mit dem COMEX-Future GC=F | Backtests Teil 2 und 3, Prototyp | Siehe O-12 |
| A-6 | Gleichstand (Schluss genau auf dem SMA50) setzt beide Zähler zurück. Alle Vergleiche sind streng (größer, kleiner), auch an den Bandgrenzen | Prototyp-Engine | Sehr selten relevant |
| A-7 | Startzustand einer Regel: Beim ersten verfügbaren SMA50 gilt „investiert“, wenn der Schluss darüber liegt. Mindestens 2 Jahre Historie vorab rechnen, damit der Zustand eingeschwungen ist | Prototyp-Engine | Nur bei zu kurzer Historie |
| A-8 | Zinsen auf das Cash zählen zum Pauschbetrag und werden für den Rest des Jahres geschätzt (Cash × 2,5 % × Restmonate ÷ 12) | Prototyp | Freier Pauschbetrag |
| A-9 | Vorabpauschale = Kurs zu Jahresbeginn × Basiszins × 70 %, im Kaufjahr um 1/12 je vollem Monat vor dem Kaufmonat gekürzt, höchstens der Wertzuwachs des Jahres. Davon 30 % steuerfrei (Teilfreistellung). Wird im Januar des Folgejahres abgerechnet und zählt zum Pauschbetrag des neuen Jahres | Prototyp | Pauschbetrag im Januar |
| A-10 | Die Trade-Republic-Anzeige „Freistellungsauftrag 1.000,00 € / 933,63 €“ bedeutet: 933,63 € sind noch frei, 66,37 € genutzt | Beispiele in Abschnitt 9 | Siehe O-3 |
| A-11 | Der Bitcoin-Bestand wurde im Juni 2026 gekauft und ist damit bis Juni 2027 kurzfristig (§ 23) | Beispiele in Abschnitt 9 | Siehe O-1 |
| A-12 | Platzhalter im Prototyp, **nicht beschlossen**: Puffer zur Freigrenze 25 €, Mindestbetrag je Order 25 €, „Grenzfall“ bei weniger als 0,5 % Abstand, Vorwarnung bei weniger als 1,5 % Abstand, Vorwarnzeiten Freitag 13:15 UTC und Sonntag 19:15 UTC | Prototyp | In der App als Einstellung ohne festen Wert (O-7, O-8) |

---

## 4. Offene Fragen

| ID | Frage | Warum wichtig | Spätestens |
|---|---|---|---|
| O-1 | Aus welchen Käufen (Datum, Menge, Kurs) besteht der Bitcoin-Bestand von 0,050467 BTC? Die Krypto-Jahresaufstellungen 2024 und 2025 deuten auf frühere Käufe hin | Haltefrist und FIFO entscheiden, ob ein Verkauf steuerfrei ist | Vor dem ersten Bitcoin-Verkauf |
| O-2 | Sind die „+7,44 €“ der Verkaufsorder vom 05.06.2026 Gewinn oder Erlös? | Ein kurzfristiger Gewinn zählt zur Freigrenze 2026 | Vor Dezember |
| O-3 | Ist 933,63 € der freie oder der genutzte Teil des Freistellungsauftrags? | Grundlage für steuerfreies Rebalancing | Vor Dezember |
| O-4 | Wie hoch ist dein persönlicher Grenzsteuersatz genau? Bisher nur „unter 30 %“ | Steuer, wenn die Freigrenze überschritten wird | Vor Dezember |
| O-5 | Wie verteilt sich das Cash von 3.402 € auf die Bausteine? Zum Beispiel 20 % des Depots als Gold-Cash und der Rest? | Baustein-Buchhaltung (A-1), Betrag beim nächsten Kaufsignal | Start am 28.09.2026 |
| O-6 | Startentscheidung Bitcoin: Die Regel ist seit dem 16.11.2025 draußen, du hältst aber Bitcoin. Am Wochenschluss 27.09.2026 gilt: Schluss über 80.435,87 $ ergibt ein Kaufsignal (halten), darunter sagt die Regel „verkaufen“ am 28.09. Handelst du so? | Mögliche Steuer (Beispiel B-8d) | 27.09.2026 |
| O-7 | Ab welchem Abstand zur Schwelle kommt eine Vorwarnung, und wann genau vor dem Wochenschluss? | Vorwarnung ist beschlossen, die Schwelle nicht | Vor der Umsetzung |
| O-8 | Mindestbetrag je Rebalancing-Order? Sicherheitsabstand zur Freigrenze? Ab welchem Abstand gilt ein Wochenschluss als Grenzfall? | Kleine Orders vermeiden, Kursschwankung am Handelstag abfedern | Vor Dezember |
| O-9 | Bitcoin-Rebalancing am 30.12. oder am 31.12.? | Handelstag | Dezember |
| O-10 | Handelt Trade Republic VWCE und den Gold-ETC per Einzelorder auch in Bruchstücken? | Exakte Beträge beim Rebalancing, sonst auf ganze Stück runden | Vor Dezember |
| O-11 | Kanal für Benachrichtigungen (Web-Push, E-Mail, Telegram oder anderes), Hosting und Login | Technik | Vor der Umsetzung |
| O-12 | Gold-Signal aus dem Vormittags- (AM) oder Nachmittagsfixing (PM) der LBMA? Enjoyer OS nutzt vermutlich AM, deine Backtests PM | Signal kann sich an Grenztagen unterscheiden | Vor der Umsetzung |
| O-13 | Wohin geht neues Geld, woher kommen Entnahmen? | Baustein-Buchhaltung | Später |
| O-14 | Was passiert, wenn Kursdaten fehlen (Feiertag, Quelle nicht erreichbar)? Warten, Ersatzquelle (Alpha Vantage, FMP) oder Hinweis? | Robustheit | Vor der Umsetzung |
| O-15 | Soll die Rebalancing-Vorschau einen offenen Regel-Verkauf (Position gehalten, Regel draußen) als schon erledigt behandeln? Der Prototyp tut das | Vorschau | Vor der Umsetzung |
| O-16 | Mit welchen Kursen bewertet die App das Depot: Yahoo-Börsenkurse oder Kurse von Lang & Schwarz? | Anzeige | Vor der Umsetzung |
| O-17 | Wie wird die Krypto-Neuregelung berücksichtigt, falls sie Gesetz wird? | Steuer auf Bitcoin ab 2027 | 2027 |

---

## 5. Ausgangslage am 24.09.2026

### 5.1 Depot laut Trade Republic

| Position | Menge | Einstandskurs | Einstand gesamt | Wert laut App | Gewinn |
|---|---|---|---|---|---|
| VWCE | 41,691483 Stück | 167,92 € | 7.000,83 € | 7.042,53 € | +41,70 € (+0,59 %) |
| Bitcoin | 0,050467 BTC | 55.011,54 € | 2.776,27 € | 3.729,95 € | +953,68 € (+34,4 %) |
| Cash | – | – | – | 3.402,00 € | Zins 2,5 % |
| **Summe** | | | | **14.174,48 €** | |

- VWCE: ein Kauf am 18.09.2026.
- Bitcoin: Kaufdaten fehlen (O-1). Verkaufsorder am 05.06.2026 mit „+7,44 €“ (O-2).
- Steuern: Freistellungsauftrag 1.000 €, Anzeige „933,63 €“ (O-3). Verlusttopf Aktien 99,66 €, Verlusttopf allgemein 0 €, Quellensteuertopf 0 €.
- Ist-Gewichte: VWCE 49,7 %, Bitcoin 26,3 %, Cash 24,0 %.

### 5.2 Regelstand zum letzten Wochenschluss

Wochenschluss 18.09.2026 (FTSE, Gold) und 20.09.2026 (Bitcoin), Kurse in US-Dollar:

| Baustein | Schluss | SMA50 | Abstand | Zähler | Zustand | Letzter Wechsel | Was sich am nächsten Wochenschluss ändern kann |
|---|---|---|---|---|---|---|---|
| FTSE (VWRD bereinigt) | 185,13 | 172,34 | +7,42 % | 73. Schluss darüber | investiert | Kauf 09.05.2025 | Schluss unter 172,65 wäre der 1. von 2 nötigen Schlüssen darunter |
| Bitcoin | 81.142,61 | 78.787,76 | +2,99 % | – | nicht investiert | Verkauf 16.11.2025 | Kaufsignal bei Schluss über 80.435,87 |
| Gold (LBMA PM) | 4.348,15 | 4.459,31 | −2,49 % | 3. Schluss darunter | nicht investiert | Verkauf 03.07.2026 | Schluss über 4.469,21 wäre der 1. von 4 nötigen Schlüssen darüber |
| Gegenprobe Gold (COMEX GC=F) | 4.424,90 | 4.479,44 | −1,22 % | – | investiert seit 28.08.2026 | – | weicht vom LBMA-Stand ab |

Was das zum Start heißt:

- **FTSE:** Regel investiert, VWCE im Depot, also halten.
- **Gold:** Regel draußen, kein Gold im Depot, also nichts tun.
- **Bitcoin:** Regel draußen, Bitcoin aber im Depot. Der Wochenschluss am 27.09. entscheidet (O-6).

---

## 6. Benötigte Daten

### 6.1 Marktdaten

| Zweck | Reihe | Quelle | Symbol oder Endpunkt | Historie | Hinweis |
|---|---|---|---|---|---|
| Signal FTSE | VWRD, bereinigter Schluss, USD | Yahoo Finance | `VWRD.L`, Feld `adjclose` | ab 05/2012 | Bereinigte Werte ändern sich rückwirkend bei jeder Ausschüttung (6.2) |
| Signal Bitcoin | BTC-USD | Yahoo Finance | `BTC-USD` | ab 09/2014 | Tageskerzen in UTC |
| Signal Gold | LBMA Gold PM, USD | LBMA | `https://prices.lbma.org.uk/json/gold_pm.json`, Felder `d` (Datum) und `v` = [USD, GBP, EUR] | ab 1968 | Serverseitig abrufen (CORS) |
| Gegenprobe Gold | COMEX-Future | Yahoo Finance | `GC=F` | | Nur zur Anzeige |
| Vorwarnung Gold, optional | LBMA Gold AM | LBMA | `gold_am.json` | | Endpunkt nicht geprüft |
| Bewertung FTSE | VWCE in EUR | Yahoo Finance | `VWCE.DE` | | |
| Bewertung Bitcoin | BTC-EUR | Yahoo Finance | `BTC-EUR` | | |
| Bewertung Gold-ETC | WisdomTree Physical Swiss Gold in EUR | Yahoo Finance | `SGBS.MI` | | Die Stuttgart-Notiz `JE00B588CD74.SG` lieferte keine Daten |
| Umrechnung | EUR/USD | Yahoo Finance | `EURUSD=X` | | Tageskerzen tragen den Zeitstempel 23:00 UTC des Vortags |
| Vorabpauschale | VWCE-Kurs zu Jahresbeginn | Yahoo Finance | `VWCE.DE` | jährlich | 2026: 145,14 € (Schluss 02.01.2026) |
| Vorabpauschale | Basiszins | BMF, jedes Jahr im Januar | – | jährlich | 2026: 3,20 % |

### 6.2 Aufbereitung und geprüfte Stolpersteine

- **Wochenpunkte:** Schlüssel ist der Montag der Woche, Wert ist der letzte Schluss der Woche. Bitcoin: Woche Montag bis Sonntag in UTC.
- **Nur abgeschlossene Wochen** gehen in die Regel ein. Die laufende Woche erst nach ihrem Wochenschluss.
- **Yahoo `range=max`** liefert nur Monatswerte. Für Tagesdaten `period1`/`period2` mit `interval=1d` verwenden.
- **Bereinigte Kurse (VWRD):** Nach jeder Ausschüttung skaliert Yahoo die ganze Historie neu. Entweder jede Woche die Reihe komplett neu laden oder gespeicherte Historie mit dem Verhältnis „Vorwochenschluss neu ÷ Vorwochenschluss alt“ reskalieren. Der Prototyp macht Letzteres: Jeder neue Wochenpunkt trägt den Vorwochenschluss auf aktueller Basis mit.
- **VWRL.AS (Amsterdam) nicht verwenden:** Die Kurse stehen dort bis 03.06.2013 in US-Dollar, das erzeugt einen künstlichen Sprung von −25 %.
- **Geprüft:** VWRD bereinigt läuft wie die thesaurierende VWRA. Vom 02.08.2019 bis 18.09.2026 kamen 13,54 % gegen 13,56 % pro Jahr heraus, an 14 geprüften Wochenschlüssen lagen beide weniger als 0,25 % auseinander. Unbereinigt wären es nur 11,62 % pro Jahr. Für Signale nie unbereinigte Kurse verwenden.
- **Zweitquellen (geprüft):** Alpha Vantage `VWRD.LON` bereinigt ergibt dieselben 2-Wochen-Signale (18 von 18 Wechseln). FMP liefert Bitcoin und den Gold-Future. Crypto.com liefert nur 50 Kerzen und taugt nicht.
- **Die Quelle ist Teil der Regel:** Bitcoin-Schluss am 20.09.2026 laut Yahoo 81.142,61 $ (knapp unter der Einstiegsschwelle 81.151,39 $), laut FMP und Alpha Vantage 81.159,64 $ (knapp darüber). Maßgeblich ist Yahoo (beschlossen).
- **Feiertage:** Ohne Handel oder Fixing ist der letzte vorhandene Tag der Woche der Wochenschluss (zum Beispiel Gründonnerstag).

### 6.3 Portfoliodaten

| Objekt | Felder | Status |
|---|---|---|
| Transaktion | Datum, Baustein (`ftse`, `btc`, `gold`), Art (Kauf, Verkauf), Menge, Kurs je Stück in EUR, Gebühr in EUR, Notiz, Herkunft (Screenshot, manuell), Kennzeichen „geschätzt“ | BESCHLOSSEN (Erfassung per Screenshot, danach manuell) |
| Kauflos (abgeleitet) | Kaufdatum, Restmenge, Einstand je Stück inklusive Gebühr, FIFO | FAKT (FIFO ist Pflicht) |
| Cash je Baustein | Betrag in EUR je Baustein | ANNAHME (A-1), Startwerte OFFEN (O-5) |
| Steuerlage je Jahr | Genutzter Pauschbetrag mit Stichtag, erwartete weitere Zinsen, Verlusttopf allgemein, andere § 23-Gewinne des Jahres, Grenzsteuersatz | Werte teils OFFEN (O-2 bis O-4) |
| Einstellungen ohne Vorgabe | Puffer zur Freigrenze, Mindestbetrag je Order, Grenzfall-Abstand, Vorwarn-Abstand und -Zeiten | OFFEN (O-7, O-8) |
| Regelparameter (versioniert) | Gewichte 50/30/20, SMA-Länge 50, Bestätigungen 2 und 4, Band 3 % | BESCHLOSSEN |
| Wochenpunkt je Anlage | Montag-Schlüssel, Schlussdatum, Schluss, Quelle, Abrufzeit, Vorwochenschluss auf aktueller Basis | VORSCHLAG |
| Ereignis | Signalwechsel und Vorwarnungen mit Begründung (Schlüsse, SMA50, Zählerstand) | VORSCHLAG |

---

## 7. Gewünschte Funktionen

### 7.1 Portfolioübersicht

Muss:

- Gesamtwert, Einstand, Gewinn und Verlust in Euro und Prozent, je Position und gesamt.
- Cash je Baustein und gesamt.
- Ist- gegen Zielgewicht (50/30/20), Abweichung in Euro und Prozentpunkten.
- Kauflose nach FIFO mit steuerlicher Einordnung: VWCE „§ 20, 30 % Teilfreistellung“, Bitcoin und Gold „steuerfrei ab TT.MM.JJJJ“.
- Datum der verwendeten Kurse je Anlage. Geschätzte oder veraltete Werte sichtbar kennzeichnen.
- Käufe und Verkäufe erfassen, korrigieren und löschen. Ein Verkauf schreibt den Erlös dem Cash des Bausteins gut, ein Kauf zieht ihn ab (A-1).

Abnahme: Mit den Daten aus 5.1 zeigt die Übersicht 14.174,48 € und die Gewichte 49,7 % / 26,3 % / 24,0 %.

### 7.2 Nachvollziehbare Kauf- und Verkaufssignale

Muss:

- Je Baustein: Zustand (investiert oder Cash), letzter Wochenschluss, SMA50, Abstand in Prozent, Zählerstand („3. Schluss unter dem SMA50“), letzter Wechsel.
- Die Schwelle für den nächsten Wochenschluss mit den Formeln aus 8.2, dazu wie viele Schlüsse bis zum Wechsel fehlen.
- Handlungsempfehlung aus Regel und Bestand nach 8.4, mit Termin („zur Eröffnung am Montag, TT.MM.“).
- Begründung zum Aufklappen: die Wochenschlüsse, der SMA50 und die Zählerstände, die zum Signal geführt haben.
- Verlauf aller Signale.
- Charts je Baustein: Wochenschlüsse, SMA50, beim Bitcoin das Band, ein Streifen für „investiert/Cash“, Marker für Kauf- und Verkaufssignale, darunter der Abstand zum SMA50. Zeiträume 1, 3, 5 Jahre und Maximum. Tabellenansicht der letzten Wochen.
- Gold: Gegenprobe mit dem COMEX-Future anzeigen, wenn sie abweicht.
- Grenzfall-Hinweis, wenn ein Schluss sehr nah an einer Schwelle liegt. Der Abstand ist OFFEN (O-8).
- Vorwarnung vor dem Wochenschluss. Abstand und Zeiten sind OFFEN (O-7).

Abnahme: Beispiele B-1 bis B-6 werden exakt reproduziert.

### 7.3 Rebalancing-Vorschau

Muss:

- Stichtag konfigurierbar, Vorgabe 30.12. (A, O-9), mit Countdown.
- Zwei Varianten nebeneinander: „steuerfrei“ und „voll auf 50/30/20“.
- Je Baustein: Aktion (kaufen, verkaufen, Cash anpassen), Betrag, Stück, realisierter Gewinn, steuerliche Einordnung.
- Summen: Steuer (getrennt nach § 20 und § 23), Anzahl Orders, Gewichte danach, freier Pauschbetrag danach, Summe der kurzfristigen Gewinne gegen die Freigrenze.
- Grundlage: aktueller Regelstand, aktuelle Euro-Kurse, FIFO-Lose, Steuerlage des Jahres. Rechnet nach jedem Wochenschluss neu.
- Hinweise: Handelstage bei Lang & Schwarz, FIFO, Klippe der Freigrenze, Haltefristen je Los, Vorabpauschale im Januar, Krypto-Entwurf als Szenario.
- Optionaler Hinweis „Pauschbetrag nutzen“: VWCE-Stücke verkaufen und sofort zurückkaufen, bis der freie Pauschbetrag erreicht ist. Das hebt den Einstand steuerfrei an. Nur als Hinweis, keine Automatik.

Abnahme: Beispiele B-9 bis B-11 werden exakt reproduziert.

### 7.4 Aktualisierung und Benachrichtigung

| Aufgabe | Zeitpunkt | Inhalt | Status |
|---|---|---|---|
| Wochenschluss FTSE und Gold | Freitag nach Börsenschluss London (16:30 Ortszeit) und LBMA-PM-Fixing (15:00 Ortszeit); Prototyp 17:15 UTC | Wochenpunkte, Regelstand, Euro-Kurse. Benachrichtigung nur bei Wechsel | Pflicht BESCHLOSSEN, Uhrzeit ANNAHME |
| Wochenschluss Bitcoin | Montag kurz nach 00:00 UTC; Prototyp 00:20 UTC | Wie oben | Pflicht BESCHLOSSEN, Uhrzeit ANNAHME |
| Vorwarnung FTSE und Gold | Freitag vor Fixing und Börsenschluss | Aktueller Kurs gegen die Schwelle: Würde die Woche so schließen, gäbe es ein Signal? | BESCHLOSSEN, Abstand und Zeit OFFEN (O-7) |
| Vorwarnung Bitcoin | Sonntag vor 24:00 UTC | Wie oben | BESCHLOSSEN, Abstand und Zeit OFFEN (O-7) |
| Jahreswechsel | Anfang Januar | Basiszins und VWCE-Jahresanfangskurs eintragen, Pauschbetrag und Freigrenze neu starten | VORSCHLAG |

### 7.5 Nicht-Ziele

- Keine automatische Orderausführung, kein Login bei Trade Republic, keine gespeicherten Zugangsdaten.
- Keine Anlage- oder Steuerberatung. Alle Steuerzahlen als Schätzung kennzeichnen.
- Keine sensiblen Kennungen speichern (Steuer-ID, Kontonummern).

---

## 8. Rechenregeln

### 8.1 SMA50

`SMA50(t) = (C(t-49) + … + C(t)) / 50`, erst ab dem 50. Wochenschluss definiert. `C` ist der Wochenschluss in US-Dollar.

### 8.2 Schwellen für den nächsten Wochenschluss

Mit `S49` = Summe der letzten 49 Wochenschlüsse (die im nächsten SMA50 bleiben) und dem noch unbekannten nächsten Schluss `C`:

| Bedingung | Gleichwertige Schwelle |
|---|---|
| `C` liegt über dem neuen SMA50 | `C > S49 / 49` |
| Bitcoin-Einstieg: `C > 1,03 × SMA50` | `C > 1,03 × S49 / (49 − 0,03)` |
| Bitcoin-Ausstieg: `C < 0,97 × SMA50` | `C < 0,97 × S49 / (49 + 0,03)` |

Herleitung am Einstieg: `C > (1+p)(S49 + C)/50` ⇔ `C(50 − 1 − p) > (1+p) S49`.

### 8.3 Zustandsautomaten

```
Bestätigungsregel (FTSE n = 2, Gold n = 4):
  für jede Woche t mit SMA50:
    wenn C > SMA:  über += 1; unter = 0
    wenn C < SMA:  unter += 1; über = 0
    wenn C = SMA:  über = 0; unter = 0                      (ANNAHME A-6)
    Zustand 0 und über ≥ n  → Zustand 1   (Kaufsignal)
    Zustand 1 und unter ≥ n → Zustand 0   (Verkaufssignal)

Bandregel (Bitcoin, p = 0,03):
    Zustand 0 und C > (1+p)·SMA → Zustand 1   (Kaufsignal)
    Zustand 1 und C < (1−p)·SMA → Zustand 0   (Verkaufssignal)
    sonst unverändert

Startzustand beim ersten SMA50: 1, wenn C > SMA, sonst 0     (ANNAHME A-7)
Signal an Woche t → Handel zur Eröffnung der Woche t+1
```

### 8.4 Handlungsmatrix Regel × Bestand

| Regel | Position im Depot | Empfehlung |
|---|---|---|
| investiert | ja | Halten |
| investiert | nein | Kaufen mit dem Cash des Bausteins |
| nicht investiert | ja | Ganze Position verkaufen |
| nicht investiert | nein | Nichts tun, Geld bleibt Cash |

Termin: Nach einem frischen Signal gilt die Eröffnung am Montag nach dem Wochenschluss. Bei einer älteren Abweichung (wie beim Bitcoin zum Start) zeigt die App beide Wege, wenn schon der nächste Wochenschluss die Regel drehen kann: „Schluss über X: halten. Sonst verkaufen am Montag, TT.MM.“

### 8.5 Steuern

- **VWCE (§ 20 EStG):** Gewinn = Erlös − FIFO-Einstand. Steuerpflichtig = Gewinn × 0,7. Steuer = max(0, steuerpflichtig − freier Pauschbetrag − Verlusttopf allgemein) × 26,375 %. Der Verlusttopf Aktien zählt hier nicht.
- **Bitcoin und Gold-ETC (§ 23 EStG):** Je Los: länger als ein Jahr gehalten, dann steuerfrei. Sonst kurzfristiger Gewinn oder Verlust. Jahressumme G aller kurzfristigen Gewinne und Verluste (auch aus anderen § 23-Geschäften): G < 1.000 € ergibt 0 € Steuer, G ≥ 1.000 € ergibt G × persönlicher Steuersatz.
- **Haltefrist:** Die Jahresfrist endet am gleichen Kalendertag des Folgejahres, steuerfrei ist der Verkauf ab dem Tag danach. Kaufdatum 29.02. endet am 28.02. des Folgejahres.
- **Vorabpauschale:** siehe A-9.

### 8.6 Rebalancing-Algorithmus (Prototyp, beruht auf A-1 und A-2)

1. Wert je Baustein S = Positionswert + Cash des Bausteins, Gesamtwert T = Summe aller S, Ziel G = Zielgewicht × T.
2. Ist die Regel draußen, die Position aber noch da, gilt das als Regel-Verkauf. Er wird nicht gedeckelt, sein Gewinn zählt zur Steuer (O-15).
3. Bausteine über dem Ziel geben die Differenz ab: zuerst ihr Cash, dann über einen Verkauf (nur investierte Bausteine).
4. Variante „steuerfrei“ deckelt diesen Verkauf nach FIFO, ohne Lose zu überspringen:
   - VWCE: steuerpflichtiger Gewinn höchstens bis zum freien Pauschbetrag.
   - Bitcoin und Gold: Lose über einem Jahr unbegrenzt, kurzfristige Gewinne nur so weit, dass die Jahressumme unter 1.000 € bleibt, abzüglich eines Puffers (O-8).
5. Bausteine unter dem Ziel bekommen ihren Fehlbetrag: investierte Bausteine kaufen, nicht investierte bekommen Cash zugewiesen. Reicht das Geld aus Schritt 3 nicht, wird jeder Fehlbetrag mit demselben Faktor f = Angebot ÷ Bedarf gekürzt.
6. Steuer der Variante = Steuer nachher − Steuer vorher, getrennt nach § 20 und § 23.
7. Ausgabe: Orders mit Betrag und Stück, realisierte Gewinne, Steuer, Gewichte danach. Orders unter dem Mindestbetrag als optional markieren (Mindestbetrag OFFEN, O-8).

---

## 9. Rechenbeispiele mit erwarteten Ergebnissen

Alle Marktwerte stammen aus Yahoo Finance und LBMA, Stand 24.09.2026. Die Beispiele B-1 bis B-4 lassen sich mit den Testdaten aus Anhang A exakt nachrechnen (130 Wochenschlüsse je Reihe). B-5 bis B-11 brauchen keine Marktdaten.

### B-1 SMA50 und Schwellen zum 18./20.09.2026

| Reihe | Letzter Schluss | SMA50 | S49 / 49 | 1,03 × SMA50 | Bandgrenzen nächste Woche | Zustand |
|---|---|---|---|---|---|---|
| FTSE (VWRD bereinigt) | 185,13 | 172,3443 | 172,65 | – | – | investiert, 73. Schluss darüber |
| Bitcoin | 81.142,61 | 78.787,7604 | 78.045,27 | 81.151,39 | Einstieg > 80.435,87, Ausstieg < 75.657,59 | nicht investiert |
| Gold (LBMA PM) | 4.348,15 | 4.459,3120 | 4.469,21 | – | – | nicht investiert, 3. Schluss darunter |

Erwartung: Die Engine liefert genau diese Werte (auf 2 Nachkommastellen gerundet, SMA50 auf 4).

### B-2 FTSE, 2-Wochen-Regel im April und Mai 2025

| Wochenschluss | Schluss | SMA50 | Abstand | über / unter | Zustand |
|---|---|---|---|---|---|
| 28.03.2025 | 132,77 | 131,66 | +0,84 % | 74 / 0 | investiert |
| 04.04.2025 | 122,91 | 131,77 | −6,72 % | 0 / 1 | investiert |
| 11.04.2025 | 124,69 | 131,86 | −5,43 % | 0 / 2 | **Verkaufssignal** → Handel Montag, 14.04.2025 |
| 17.04.2025 (Gründonnerstag) | 127,29 | 131,98 | −3,55 % | 0 / 3 | Cash |
| 25.04.2025 | 131,65 | 132,14 | −0,37 % | 0 / 4 | Cash |
| 02.05.2025 | 135,84 | 132,35 | +2,64 % | 1 / 0 | Cash |
| 09.05.2025 | 135,93 | 132,56 | +2,54 % | 2 / 0 | **Kaufsignal** → Handel Montag, 12.05.2025 |

Erwartung: Verkauf am 14.04.2025, nicht am 07.04.2025. Der erste Schluss darunter (04.04.) reicht bei der 2-Wochen-Regel nicht.

### B-3 Bitcoin, 3-%-Band

| Wochenschluss | Schluss | SMA50 | Grenze | Ergebnis |
|---|---|---|---|---|
| 09.11.2025 | 104.719,64 | 103.010,80 | Ausstieg < 99.920,47 | bleibt investiert |
| 16.11.2025 | 94.177,08 | 102.948,74 | Ausstieg < 99.860,28 | **Verkaufssignal** → Handel Montag, 17.11.2025 |
| 06.09.2026 | 80.350,05 | 80.340,87 | Einstieg > 82.751,10 | bleibt draußen (Schluss nur +0,01 % über dem SMA50) |
| 20.09.2026 | 81.142,61 | 78.787,76 | Einstieg > 81.151,39 | bleibt draußen, 8,78 $ zu wenig |

### B-4 Gold, 4-Wochen-Regel

| Wochenschluss | Schluss | SMA50 | über / unter | Zustand |
|---|---|---|---|---|
| 05.06.2026 | 4.365,15 | 4.224,84 | 139 / 0 | investiert |
| 12.06.2026 | 4.185,95 | 4.243,12 | 0 / 1 | investiert |
| 19.06.2026 | 4.150,90 | 4.259,50 | 0 / 2 | investiert |
| 26.06.2026 | 4.072,05 | 4.273,90 | 0 / 3 | investiert |
| 03.07.2026 | 4.164,15 | 4.290,08 | 0 / 4 | **Verkaufssignal** → Handel Montag, 06.07.2026 |
| 28.08.2026 | 4.562,75 | 4.422,69 | 3 / 0 | Cash (3 von 4 nötigen Schlüssen) |
| 04.09.2026 | 4.415,40 | 4.437,74 | 0 / 1 | Cash, Zähler zurückgesetzt |
| 18.09.2026 | 4.348,15 | 4.459,31 | 0 / 3 | Cash |

### B-5 Zustandsautomaten mit vorgegebenem SMA50 (Unit-Tests ohne Marktdaten)

Bestätigungsregel n = 2, Start: investiert, über = 5, unter = 0, SMA50 in jeder Woche 100:

| Woche | Schluss | über / unter danach | Zustand danach | Signal |
|---|---|---|---|---|
| 1 | 99 | 0 / 1 | 1 | – |
| 2 | 101 | 1 / 0 | 1 | – |
| 3 | 98 | 0 / 1 | 1 | – |
| 4 | 97 | 0 / 2 | 0 | Verkauf |
| 5 | 100 | 0 / 0 | 0 | – (Gleichstand, A-6) |
| 6 | 103 | 1 / 0 | 0 | – |
| 7 | 104 | 2 / 0 | 1 | Kauf |

Mit n = 4 (Gold) gibt es in derselben Folge kein Signal.

Bandregel p = 3 %, Start: nicht investiert, SMA50 in jeder Woche 100:

| Woche | Schluss | Zustand danach | Signal |
|---|---|---|---|
| 1 | 102,90 | 0 | – |
| 2 | 103,00 | 0 | – (nicht größer als 103, A-6) |
| 3 | 103,01 | 1 | Kauf |
| 4 | 97,50 | 1 | – |
| 5 | 97,00 | 1 | – (nicht kleiner als 97, A-6) |
| 6 | 96,99 | 0 | Verkauf |

### B-6 Formel der Schwelle prüfen

Aus Anhang A: Die Summe der letzten 49 Bitcoin-Schlüsse bis 20.09.2026 ist S49 = 3.824.218,25 $. Erwartung: `S49 / 49 = 78.045,27` und `1,03 × S49 / 48,97 = 80.435,87` (genau 80.435,8750, gerundet).

Gegenprobe: Ein Schluss von 80.435,87 $ ergäbe einen neuen SMA50 von 78.093,0824 $. 1,03 × SMA50 wären dann 80.435,8749 $, der Schluss läge also knapp darunter: kein Signal. Ab 80.435,88 $ gibt es das Kaufsignal (neuer SMA50 78.093,0826 $, Grenze 80.435,8751 $).

### B-7 Depotbewertung mit den echten Positionen

| Position | Rechnung | Ergebnis |
|---|---|---|
| VWCE Einstand | 41,691483 × 167,92 € | 7.000,83 € |
| VWCE Wert | 41,691483 × 168,92 € (Schluss Xetra 24.09.2026) | 7.042,53 € (wie in der App) |
| Bitcoin Einstand | 0,050467 × 55.011,54 € | 2.776,27 € |
| Bitcoin Wert laut App | 3.729,95 € | entspricht 73.908,69 € je BTC |
| Summe mit Cash | 7.042,53 + 3.729,95 + 3.402,00 | 14.174,48 € |
| Ziel 50/30/20 | × 0,5 / 0,3 / 0,2 | 7.087,24 € / 4.252,34 € / 2.834,90 € |

### B-8 Steuerbeispiele

**a) FIFO und § 20 (VWCE, erfundene Lose):** Kauf 10 Stück zu 150 € (02.02.2026) und 10 Stück zu 170 € (18.09.2026). Verkauf 12 Stück zu 180 € am 30.12.2026.

| Größe | Erwartung |
|---|---|
| Erlös | 2.160,00 € |
| FIFO-Einstand (10 × 150 + 2 × 170) | 1.840,00 € |
| Gewinn | 320,00 € |
| Steuerpflichtig nach Teilfreistellung | 224,00 € |
| Steuer bei 900 € freiem Pauschbetrag | 0,00 € |
| Steuer ohne freien Pauschbetrag | 59,08 € (224 × 26,375 %) |
| Restbestand | 8 Stück zu 170 € |

**b) Freigrenze (§ 23):** Kurzfristige Gewinne des Jahres 999,99 € ergeben 0 € Steuer. Bei 1.000,00 € ist der ganze Betrag steuerpflichtig: 1.000 € × persönlicher Steuersatz (O-4).

**c) Haltefrist:** Kauf am 15.06.2026: Ein Verkauf am 15.06.2027 ist noch kurzfristig, ab 16.06.2027 steuerfrei. Kauf am 29.02.2028: steuerfrei ab 01.03.2029.

**d) Bitcoin-Start (O-6), unter den Annahmen A-11 und „+7,44 € ist Gewinn“ (O-2):** Schließt Bitcoin am 27.09.2026 knapp unter 80.435,87 $ und wird am 28.09. zu rund 70.700 € je BTC verkauft (EUR/USD 1,1377):

| Größe | Erwartung |
|---|---|
| Erlös | 0,050467 × 70.700 € = 3.568,02 € |
| Gewinn | 3.568,02 − 2.776,27 = 791,75 € |
| Kurzfristige Gewinne 2026 insgesamt | 791,75 + 7,44 = 799,19 € |
| Steuer | 0 €, weil unter 1.000 € und keine weiteren § 23-Gewinne |
| Zum Vergleich: Verkauf zum App-Kurs 73.908,69 € | Gewinn 953,68 €, insgesamt 961,12 €, noch 38,88 € unter der Freigrenze |

**e) Vorabpauschale VWCE für 2026 (A-9):** 41,691483 Stück, Kauf im September, Kurs zu Jahresbeginn 145,14 €, Basiszins 3,20 %:

| Größe | Erwartung |
|---|---|
| Vorabpauschale | 41,691483 × 145,14 € × 3,20 % × 0,7 × 4/12 = 45,18 € |
| Steuerpflichtig nach Teilfreistellung | 31,63 € |
| Abrechnung | Januar 2027, zählt zum Pauschbetrag 2027 |
| Deckel greift nur | wenn VWCE das Jahr unter 146,22 € beendet |

**f) Zinsen für den Rest von 2026 (A-8):** 3.402 € × 2,5 % × 3/12 = 21,26 €. Unter A-10 bleiben damit 933,63 − 21,26 = 912,37 € Pauschbetrag für das Rebalancing.

### B-9 Rebalancing, alles im Freibetrag (erfundene Werte)

Ausgangslage: FTSE investiert, 40 Stück zu 190 € = 7.600 € (Einstand 175 € je Stück). Bitcoin investiert, 0,05 BTC zu 80.000 € = 4.000 € (Einstand 70.000 €, Kauf 15.06.2026). Gold nicht investiert, Cash 2.400 €. Gesamt 14.000 €. Freier Pauschbetrag 900 €, keine § 23-Gewinne.

| Baustein | Ziel | Aktion (beide Varianten gleich) | Gewinn | Steuerpflichtig |
|---|---|---|---|---|
| FTSE | 7.000 € | Verkauf 600,00 € (3,158 Stück) | 47,37 € | 33,16 € (im Pauschbetrag) |
| Bitcoin | 4.200 € | Kauf 200,00 € | – | – |
| Gold | 2.800 € | Cash +400,00 € (keine Order) | – | – |

Erwartung: Steuer 0 €, 2 Orders, danach genau 50/30/20. Freier Pauschbetrag danach 866,84 €.

### B-10 Rebalancing, Freigrenze begrenzt (erfundene Werte)

Ausgangslage: FTSE investiert, 40 Stück zu 160 € = 6.400 € (Einstand 150 €). Bitcoin investiert, 0,06 BTC zu 90.000 € = 5.400 € (Einstand 50.000 €, Kauf 15.06.2026, also kurzfristig). Gold nicht investiert, Cash 2.200 €. Andere kurzfristige Gewinne 2026: 600 €. Freier Pauschbetrag 900 €.

| Größe | Voll auf 50/30/20 | Steuerfrei |
|---|---|---|
| Bitcoin verkaufen | 1.200,00 € | 899,98 € (gedeckelt) |
| Kurzfristiger Gewinn daraus | 533,33 € | 399,99 € |
| Kurzfristige Gewinne 2026 insgesamt | 1.133,33 € (über der Freigrenze) | 999,99 € |
| Steuer | 1.133,33 € × persönlicher Satz, bei beispielhaft 25 %: 283,33 € | 0 € |
| FTSE kaufen | 600,00 € | 449,99 € |
| Gold Cash | +600,00 € | +449,99 € |
| Gewichte danach (FTSE/BTC/Gold) | 50,00 / 30,00 / 20,00 % | 48,93 / 32,14 / 18,93 % |

Erwartung: In der vollen Variante werden auch die 600 € anderer Gewinne steuerpflichtig (Klippe der Freigrenze). Die steuerfreie Variante kürzt alle Fehlbeträge mit f = 0,75.

### B-11 Rebalancing, Pauschbetrag begrenzt (erfundene Werte)

Ausgangslage: FTSE investiert, 40 Stück zu 200 € = 8.000 € (Einstand 125 €, Kauf 01.03.2025). Bitcoin investiert, 0,0475 BTC zu 80.000 € = 3.800 € (Kauf 10.01.2025, also über ein Jahr). Gold nicht investiert, Cash 2.200 €. Freier Pauschbetrag nur 100 €.

| Größe | Voll auf 50/30/20 | Steuerfrei |
|---|---|---|
| FTSE verkaufen | 1.000,00 € (5 Stück) | 380,95 € (1,905 Stück) |
| Gewinn / steuerpflichtig | 375,00 € / 262,50 € | 142,86 € / 100,00 € |
| Steuer (§ 20) | (262,50 − 100) × 26,375 % = 42,86 € | 0 € |
| Bitcoin kaufen | 400,00 € | 152,38 € |
| Gold Cash | +600,00 € | +228,57 € |
| Gewichte danach (FTSE/BTC/Gold) | 50,00 / 30,00 / 20,00 % | 54,42 / 28,23 / 17,35 % |

Erwartung: Die steuerfreie Variante erreicht die Ziele nur zu 38,1 % (f = 0,381).

### B-12 Dein Depot, Rebalancing-Vorschau mit Kursen vom 24.09.2026 (nur zur Veranschaulichung)

Beruht auf A-1, A-2, A-4, A-10, A-11 und O-5. Kurse: VWCE 168,92 €, Bitcoin 73.908,69 €. Das Cash wird für die Rechnung ganz dem Gold-Baustein zugeordnet. Auf die Ziele hat das keinen Einfluss, weil sie sich aus dem Gesamtwert ergeben.

| Szenario | FTSE | Bitcoin | Gold | Steuer |
|---|---|---|---|---|
| A: Kaufsignal Bitcoin am 27.09. | Kauf 44,71 € (optional) | Kauf 522,39 € | Cash 2.834,90 € | 0 € |
| B: Bitcoin am 28.09. zu 70.700 € nach Regel verkauft | Verkauf 36,25 € (optional) | Cash 4.203,76 € | Cash 2.802,51 € | 0 € (kurzfristige Gewinne 2026: 799,19 €) |

Die echte Vorschau im Dezember hängt von Kursen und Regelständen am 30.12. ab.

---

## 10. Vorschlag für die Umsetzung

Alles in diesem Abschnitt ist **VORSCHLAG**.

- **Aufbau:** Die Rechenlogik (Wochenpunkte, SMA50, Regeln, FIFO, Steuern, Rebalancing) als reine Funktionen ohne Seiteneffekte, mit Unit-Tests aus Abschnitt 9 und den Testdaten aus Anhang A. Darum herum: Datenjobs, Datenbank, Oberfläche, Benachrichtigung.
- **Daten serverseitig abrufen:** Yahoo und LBMA erlauben keinen direkten Abruf aus dem Browser (CORS). Also als geplanter Serverjob.
- **Zugang:** Die Seite soll im Internet erreichbar sein, enthält aber persönliche Finanzdaten. Deshalb Login für eine Person, zum Beispiel Passkey oder Magic Link.
- **Hosting:** Zum Beispiel ein Framework wie Next.js oder SvelteKit mit geplanten Funktionen (Cron) bei Vercel oder Netlify, oder ein kleiner Server mit Cron. Datenbank SQLite oder Postgres.
- **Benachrichtigung:** Web-Push, E-Mail oder ein Telegram-Bot (O-11).
- **Reihenfolge:**
  1. Rechenkern mit Tests (B-1 bis B-11)
  2. Datenjobs für Wochenpunkte und Euro-Kurse
  3. Transaktionen erfassen und Portfolioübersicht
  4. Signalansicht mit Charts und Begründung
  5. Rebalancing-Vorschau
  6. Benachrichtigungen und Vorwarnungen
  7. Login, Backups, Fehlerfälle (O-14)
- **Vorlage:** Der Prototyp „Regel-Depot 50/30/20“ (Claude-Artifact) zeigt Aufbau und Oberfläche. Seine Rechenlogik steht in Anhang B. Der Prototyp selbst bekommt keine automatischen Aktualisierungen.

---

## Anhang A: Testdaten

130 Wochenschlüsse je Reihe bis zum Wochenschluss 18.09.2026 (FTSE, Gold) bzw. 20.09.2026 (Bitcoin), in US-Dollar. Damit lassen sich B-1 bis B-4 und B-6 exakt nachrechnen: Der erste SMA50 entsteht in Zeile 50, der Startzustand nach A-7 schwingt vor den Beispielen ein. Mit diesen Daten und der Engine aus Anhang B ergeben sich dieselben Zustände und Wechsel wie mit der vollen Historie.

Hinweis zu VWRD: Die bereinigten Werte stehen auf der Basis vom 24.09.2026, also nach der Ausschüttung vom September 2026. Neu geladene Daten liegen nach der nächsten Ausschüttung um einen konstanten Faktor niedriger. Für Tests diese Datei verwenden, nicht neu laden.

### A.1 FTSE: VWRD.L, bereinigter Schluss (Yahoo)

```csv
woche_montag,wochenschluss,schluss_usd
2024-03-25,2024-03-28,123.4500
2024-04-01,2024-04-05,122.2186
2024-04-08,2024-04-12,120.9342
2024-04-15,2024-04-19,117.7258
2024-04-22,2024-04-26,120.1983
2024-04-29,2024-05-03,121.2806
2024-05-06,2024-05-10,123.4885
2024-05-13,2024-05-17,125.5473
2024-05-20,2024-05-24,125.2298
2024-05-27,2024-05-31,123.1277
2024-06-03,2024-06-07,125.7878
2024-06-10,2024-06-14,125.7880
2024-06-17,2024-06-21,126.5913
2024-06-24,2024-06-28,127.5301
2024-07-01,2024-07-05,129.0496
2024-07-08,2024-07-12,131.5610
2024-07-15,2024-07-19,128.4301
2024-07-22,2024-07-26,127.2397
2024-07-29,2024-08-02,123.9297
2024-08-05,2024-08-09,124.5782
2024-08-12,2024-08-16,129.3302
2024-08-19,2024-08-23,132.0014
2024-08-26,2024-08-30,131.4014
2024-09-02,2024-09-06,127.2591
2024-09-09,2024-09-13,131.3336
2024-09-16,2024-09-20,132.6936
2024-09-23,2024-09-27,135.5204
2024-09-30,2024-10-04,134.0487
2024-10-07,2024-10-11,135.6467
2024-10-14,2024-10-18,136.0449
2024-10-21,2024-10-25,134.8307
2024-10-28,2024-11-01,133.2376
2024-11-04,2024-11-08,136.7783
2024-11-11,2024-11-15,133.9176
2024-11-18,2024-11-22,135.4475
2024-11-25,2024-11-29,137.1961
2024-12-02,2024-12-06,138.8280
2024-12-09,2024-12-13,137.6415
2024-12-16,2024-12-20,134.7376
2024-12-23,2024-12-27,135.3028
2024-12-30,2025-01-03,134.4843
2025-01-06,2025-01-10,132.2138
2025-01-13,2025-01-17,136.3260
2025-01-20,2025-01-24,139.2542
2025-01-27,2025-01-31,139.5417
2025-02-03,2025-02-07,138.4893
2025-02-10,2025-02-14,140.7110
2025-02-17,2025-02-21,140.3602
2025-02-24,2025-02-28,136.4624
2025-03-03,2025-03-07,134.5476
2025-03-10,2025-03-14,133.5390
2025-03-17,2025-03-21,134.2715
2025-03-24,2025-03-28,132.7658
2025-03-31,2025-04-04,122.9103
2025-04-07,2025-04-11,124.6947
2025-04-14,2025-04-17,127.2905
2025-04-21,2025-04-25,131.6512
2025-04-28,2025-05-02,135.8359
2025-05-05,2025-05-09,135.9337
2025-05-12,2025-05-16,140.7930
2025-05-19,2025-05-23,139.2873
2025-05-26,2025-05-30,140.8321
2025-06-02,2025-06-06,143.3057
2025-06-09,2025-06-13,143.6577
2025-06-16,2025-06-20,142.3500
2025-06-23,2025-06-27,147.2579
2025-06-30,2025-07-04,148.2710
2025-07-07,2025-07-11,148.3103
2025-07-14,2025-07-18,149.3037
2025-07-21,2025-07-25,151.2315
2025-07-28,2025-08-01,147.1596
2025-08-04,2025-08-08,151.2905
2025-08-11,2025-08-15,153.2330
2025-08-18,2025-08-22,154.3395
2025-08-25,2025-08-29,153.1396
2025-09-01,2025-09-05,153.6904
2025-09-08,2025-09-12,156.6312
2025-09-15,2025-09-19,157.6866
2025-09-22,2025-09-26,157.2034
2025-09-29,2025-10-03,160.6550
2025-10-06,2025-10-10,157.4302
2025-10-13,2025-10-17,158.0712
2025-10-20,2025-10-23,160.4085
2025-10-27,2025-10-31,162.1539
2025-11-03,2025-11-07,158.5052
2025-11-10,2025-11-14,161.2861
2025-11-17,2025-11-21,156.2666
2025-11-24,2025-11-28,162.1835
2025-12-01,2025-12-05,163.1598
2025-12-08,2025-12-12,162.3413
2025-12-15,2025-12-19,163.1729
2025-12-22,2025-12-24,164.8748
2025-12-29,2026-01-02,164.6670
2026-01-05,2026-01-09,167.2792
2026-01-12,2026-01-16,167.9025
2026-01-19,2026-01-23,167.7640
2026-01-26,2026-01-30,168.8227
2026-02-02,2026-02-06,168.7733
2026-02-09,2026-02-13,169.3669
2026-02-16,2026-02-20,170.4356
2026-02-23,2026-02-27,171.1777
2026-03-02,2026-03-06,164.4988
2026-03-09,2026-03-13,162.1142
2026-03-16,2026-03-20,159.2708
2026-03-23,2026-03-27,156.8696
2026-03-30,2026-04-02,161.4239
2026-04-06,2026-04-10,168.3694
2026-04-13,2026-04-17,175.2951
2026-04-20,2026-04-24,173.6777
2026-04-27,2026-05-01,176.2575
2026-05-04,2026-05-08,179.8791
2026-05-11,2026-05-15,178.9365
2026-05-18,2026-05-22,181.0202
2026-05-25,2026-05-29,184.0067
2026-06-01,2026-06-05,181.0301
2026-06-08,2026-06-12,181.6651
2026-06-15,2026-06-19,183.2328
2026-06-22,2026-06-26,180.3214
2026-06-29,2026-07-03,183.3226
2026-07-06,2026-07-10,183.6017
2026-07-13,2026-07-17,180.7701
2026-07-20,2026-07-24,180.6205
2026-07-27,2026-07-31,181.0293
2026-08-03,2026-08-07,187.9490
2026-08-10,2026-08-14,188.9261
2026-08-17,2026-08-21,187.5801
2026-08-24,2026-08-28,188.8962
2026-08-31,2026-09-04,188.3977
2026-09-07,2026-09-11,187.0815
2026-09-14,2026-09-18,185.1300
```

### A.2 Bitcoin: BTC-USD (Yahoo), Woche Montag bis Sonntag UTC

```csv
woche_montag,wochenschluss,schluss_usd
2024-03-25,2024-03-31,71333.65
2024-04-01,2024-04-07,69362.55
2024-04-08,2024-04-14,65738.73
2024-04-15,2024-04-21,64926.64
2024-04-22,2024-04-28,63113.23
2024-04-29,2024-05-05,64031.13
2024-05-06,2024-05-12,61448.39
2024-05-13,2024-05-19,66278.37
2024-05-20,2024-05-26,68518.09
2024-05-27,2024-06-02,67751.60
2024-06-03,2024-06-09,69647.99
2024-06-10,2024-06-16,66639.05
2024-06-17,2024-06-23,63180.80
2024-06-24,2024-06-30,62678.29
2024-07-01,2024-07-07,55849.11
2024-07-08,2024-07-14,60787.79
2024-07-15,2024-07-21,68154.52
2024-07-22,2024-07-28,68255.87
2024-07-29,2024-08-04,58116.98
2024-08-05,2024-08-11,58719.48
2024-08-12,2024-08-18,58483.96
2024-08-19,2024-08-25,64333.54
2024-08-26,2024-09-01,57325.49
2024-09-02,2024-09-08,54841.57
2024-09-09,2024-09-15,59182.84
2024-09-16,2024-09-22,63648.71
2024-09-23,2024-09-29,65635.30
2024-09-30,2024-10-06,62818.95
2024-10-07,2024-10-13,62851.38
2024-10-14,2024-10-20,69001.70
2024-10-21,2024-10-27,67929.30
2024-10-28,2024-11-03,68741.12
2024-11-04,2024-11-10,80474.19
2024-11-11,2024-11-17,89845.85
2024-11-18,2024-11-24,98013.82
2024-11-25,2024-12-01,97279.79
2024-12-02,2024-12-08,101236.02
2024-12-09,2024-12-15,104298.70
2024-12-16,2024-12-22,95104.94
2024-12-23,2024-12-29,93530.23
2024-12-30,2025-01-05,98314.96
2025-01-06,2025-01-12,94488.44
2025-01-13,2025-01-19,101089.61
2025-01-20,2025-01-26,102682.50
2025-01-27,2025-02-02,97688.98
2025-02-03,2025-02-09,96500.09
2025-02-10,2025-02-16,96175.03
2025-02-17,2025-02-23,96273.92
2025-02-24,2025-03-02,94248.35
2025-03-03,2025-03-09,80601.04
2025-03-10,2025-03-16,82579.69
2025-03-17,2025-03-23,86054.38
2025-03-24,2025-03-30,82334.52
2025-03-31,2025-04-06,78214.48
2025-04-07,2025-04-13,83684.98
2025-04-14,2025-04-20,85174.30
2025-04-21,2025-04-27,93754.84
2025-04-28,2025-05-04,94315.98
2025-05-05,2025-05-11,104106.36
2025-05-12,2025-05-18,106446.01
2025-05-19,2025-05-25,109035.39
2025-05-26,2025-06-01,105652.10
2025-06-02,2025-06-08,105793.65
2025-06-09,2025-06-15,105552.02
2025-06-16,2025-06-22,100987.14
2025-06-23,2025-06-29,108385.57
2025-06-30,2025-07-06,109232.07
2025-07-07,2025-07-13,119116.12
2025-07-14,2025-07-20,117300.79
2025-07-21,2025-07-27,119448.49
2025-07-28,2025-08-03,114217.67
2025-08-04,2025-08-10,119306.76
2025-08-11,2025-08-17,117453.06
2025-08-18,2025-08-24,113458.43
2025-08-25,2025-08-31,108236.71
2025-09-01,2025-09-07,111167.62
2025-09-08,2025-09-14,115407.66
2025-09-15,2025-09-21,115306.09
2025-09-22,2025-09-28,112122.64
2025-09-29,2025-10-05,123513.48
2025-10-06,2025-10-12,115169.77
2025-10-13,2025-10-19,108666.71
2025-10-20,2025-10-26,114472.45
2025-10-27,2025-11-02,110639.63
2025-11-03,2025-11-09,104719.64
2025-11-10,2025-11-16,94177.08
2025-11-17,2025-11-23,86805.01
2025-11-24,2025-11-30,90394.31
2025-12-01,2025-12-07,90405.64
2025-12-08,2025-12-14,88175.18
2025-12-15,2025-12-21,88621.75
2025-12-22,2025-12-28,87835.84
2025-12-29,2026-01-04,91413.49
2026-01-05,2026-01-11,90827.46
2026-01-12,2026-01-18,93634.43
2026-01-19,2026-01-25,86572.22
2026-01-26,2026-02-01,76974.45
2026-02-02,2026-02-08,70264.73
2026-02-09,2026-02-15,68788.19
2026-02-16,2026-02-22,67659.39
2026-02-23,2026-03-01,65738.10
2026-03-02,2026-03-08,65969.78
2026-03-09,2026-03-15,72789.91
2026-03-16,2026-03-22,67845.21
2026-03-23,2026-03-29,65954.92
2026-03-30,2026-04-05,68981.90
2026-04-06,2026-04-12,70753.41
2026-04-13,2026-04-19,73856.35
2026-04-20,2026-04-26,78657.54
2026-04-27,2026-05-03,78538.23
2026-05-04,2026-05-10,82138.93
2026-05-11,2026-05-17,77429.35
2026-05-18,2026-05-24,76981.13
2026-05-25,2026-05-31,73579.69
2026-06-01,2026-06-07,63239.52
2026-06-08,2026-06-14,65710.40
2026-06-15,2026-06-21,63237.54
2026-06-22,2026-06-28,59532.34
2026-06-29,2026-07-05,63547.88
2026-07-06,2026-07-12,63758.22
2026-07-13,2026-07-19,64690.80
2026-07-20,2026-07-26,65340.30
2026-07-27,2026-08-02,63482.00
2026-08-03,2026-08-09,64844.89
2026-08-10,2026-08-16,62818.65
2026-08-17,2026-08-23,77755.27
2026-08-24,2026-08-30,77667.57
2026-08-31,2026-09-06,80350.05
2026-09-07,2026-09-13,76838.16
2026-09-14,2026-09-20,81142.61
```

### A.3 Gold: LBMA Gold PM in USD

```csv
woche_montag,wochenschluss,schluss_usd
2024-03-25,2024-03-28,2214.35
2024-04-01,2024-04-05,2298.55
2024-04-08,2024-04-12,2401.50
2024-04-15,2024-04-19,2379.70
2024-04-22,2024-04-26,2343.10
2024-04-29,2024-05-03,2294.45
2024-05-06,2024-05-10,2372.45
2024-05-13,2024-05-17,2402.60
2024-05-20,2024-05-24,2342.70
2024-05-27,2024-05-31,2348.25
2024-06-03,2024-06-07,2310.80
2024-06-10,2024-06-14,2330.45
2024-06-17,2024-06-21,2335.05
2024-06-24,2024-06-28,2330.90
2024-07-01,2024-07-05,2379.05
2024-07-08,2024-07-12,2406.85
2024-07-15,2024-07-19,2403.50
2024-07-22,2024-07-26,2386.10
2024-07-29,2024-08-02,2469.85
2024-08-05,2024-08-09,2427.35
2024-08-12,2024-08-16,2485.80
2024-08-19,2024-08-23,2511.20
2024-08-26,2024-08-30,2513.35
2024-09-02,2024-09-06,2506.15
2024-09-09,2024-09-13,2575.10
2024-09-16,2024-09-20,2605.85
2024-09-23,2024-09-27,2661.85
2024-09-30,2024-10-04,2650.05
2024-10-07,2024-10-11,2648.80
2024-10-14,2024-10-18,2712.50
2024-10-21,2024-10-25,2731.45
2024-10-28,2024-11-01,2744.30
2024-11-04,2024-11-08,2691.15
2024-11-11,2024-11-15,2571.80
2024-11-18,2024-11-22,2694.95
2024-11-25,2024-11-29,2651.05
2024-12-02,2024-12-06,2637.30
2024-12-09,2024-12-13,2659.05
2024-12-16,2024-12-20,2616.45
2024-12-23,2024-12-27,2615.95
2024-12-30,2025-01-03,2646.80
2025-01-06,2025-01-10,2687.45
2025-01-13,2025-01-17,2715.20
2025-01-20,2025-01-24,2776.80
2025-01-27,2025-01-31,2812.05
2025-02-03,2025-02-07,2874.65
2025-02-10,2025-02-14,2921.25
2025-02-17,2025-02-21,2934.15
2025-02-24,2025-02-28,2834.55
2025-03-03,2025-03-07,2931.15
2025-03-10,2025-03-14,2978.05
2025-03-17,2025-03-21,3013.70
2025-03-24,2025-03-28,3071.60
2025-03-31,2025-04-04,3054.50
2025-04-07,2025-04-11,3230.50
2025-04-14,2025-04-17,3305.65
2025-04-21,2025-04-25,3277.30
2025-04-28,2025-05-02,3249.70
2025-05-05,2025-05-09,3324.55
2025-05-12,2025-05-16,3182.95
2025-05-19,2025-05-23,3342.65
2025-05-26,2025-05-30,3277.55
2025-06-02,2025-06-06,3339.90
2025-06-09,2025-06-13,3435.35
2025-06-16,2025-06-20,3368.25
2025-06-23,2025-06-27,3271.75
2025-06-30,2025-07-04,3331.90
2025-07-07,2025-07-11,3352.10
2025-07-14,2025-07-18,3355.10
2025-07-21,2025-07-25,3343.50
2025-07-28,2025-08-01,3346.85
2025-08-04,2025-08-08,3394.15
2025-08-11,2025-08-15,3335.50
2025-08-18,2025-08-22,3334.25
2025-08-25,2025-08-29,3429.15
2025-09-01,2025-09-05,3594.55
2025-09-08,2025-09-12,3651.10
2025-09-15,2025-09-19,3663.15
2025-09-22,2025-09-26,3769.85
2025-09-29,2025-10-03,3885.70
2025-10-06,2025-10-10,3974.50
2025-10-13,2025-10-17,4224.75
2025-10-20,2025-10-24,4104.40
2025-10-27,2025-10-31,4011.50
2025-11-03,2025-11-07,3994.10
2025-11-10,2025-11-14,4071.10
2025-11-17,2025-11-21,4072.85
2025-11-24,2025-11-28,4191.05
2025-12-01,2025-12-05,4243.00
2025-12-08,2025-12-12,4346.95
2025-12-15,2025-12-19,4337.60
2025-12-22,2025-12-23,4449.40
2025-12-29,2026-01-02,4352.95
2026-01-05,2026-01-09,4493.85
2026-01-12,2026-01-16,4611.05
2026-01-19,2026-01-23,4946.25
2026-01-26,2026-01-30,4981.85
2026-02-02,2026-02-06,4948.00
2026-02-09,2026-02-13,4994.95
2026-02-16,2026-02-20,5053.20
2026-02-23,2026-02-27,5222.30
2026-03-02,2026-03-06,5127.55
2026-03-09,2026-03-13,5044.60
2026-03-16,2026-03-20,4562.55
2026-03-23,2026-03-27,4504.15
2026-03-30,2026-04-02,4639.35
2026-04-06,2026-04-10,4773.75
2026-04-13,2026-04-17,4870.50
2026-04-20,2026-04-24,4711.65
2026-04-27,2026-05-01,4636.90
2026-05-04,2026-05-08,4741.40
2026-05-11,2026-05-15,4528.00
2026-05-18,2026-05-22,4506.15
2026-05-25,2026-05-29,4545.95
2026-06-01,2026-06-05,4365.15
2026-06-08,2026-06-12,4185.95
2026-06-15,2026-06-19,4150.90
2026-06-22,2026-06-26,4072.05
2026-06-29,2026-07-03,4164.15
2026-07-06,2026-07-10,4099.15
2026-07-13,2026-07-17,3995.35
2026-07-20,2026-07-24,4067.30
2026-07-27,2026-07-31,4026.60
2026-08-03,2026-08-07,4335.55
2026-08-10,2026-08-14,4390.70
2026-08-17,2026-08-21,4582.10
2026-08-24,2026-08-28,4562.75
2026-08-31,2026-09-04,4415.40
2026-09-07,2026-09-11,4386.25
2026-09-14,2026-09-18,4348.15
```

## Anhang B: Referenzimplementierung (Prototyp, JavaScript)

Das ist die Rechenlogik des Prototyps „Regel-Depot 50/30/20“. Sie reproduziert alle Beispiele aus Abschnitt 9. Sie ist eine Vorlage, keine Vorgabe.

- Enthaltene Annahmen: A-1 und A-2 (`rebalance`), A-6 und A-7 (`evalRule`), A-9 (`vorab`), O-15 (Regel-Verkauf in `rebalance`).
- `decodeHist` und `merge` gehören zur Datenhaltung des Prototyps (eingebettete Historie plus neue Wochenpunkte mit Reskalierung für bereinigte Kurse, siehe 6.2).
- `cfg.buffer` (Puffer zur Freigrenze) und `cfg.minOrder` sind im Prototyp Platzhalter (A-12). In den Beispielen B-9 bis B-11 ist der Puffer 0.
- `taxFreeMax` hält die Summe der kurzfristigen Gewinne 1 Cent unter der Freigrenze, weil „unter 1.000 €“ gilt.

```js
/* ===== Regel-Engine: Serien, Regeln, Depot (FIFO), Steuern, Rebalancing ===== */
var ENG = (function(){
  var DAY = 864e5;
  function iso(t){ return new Date(t).toISOString().slice(0,10); }
  function addDays(d,n){ return iso(new Date(d+'T00:00:00Z').getTime()+n*DAY); }
  function mondayOf(d){ var dt=new Date(d+'T00:00:00Z'); var dow=(dt.getUTCDay()+6)%7; return iso(dt.getTime()-dow*DAY); }
  function daysBetween(a,b){ return Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/DAY); }
  /* Ende der Jahresfrist (§ 23): gleicher Kalendertag im Folgejahr; 29.02. -> 28.02. */
  function oneYearAfter(d){ var y=+d.slice(0,4)+1, md=d.slice(5); if(md==='02-29') md='02-28'; return y+'-'+md; }
  function isLongTerm(buy, sell){ return sell > oneYearAfter(buy); }
  function taxFreeFrom(buy){ return addDays(oneYearAfter(buy),1); }

  /* eingebettete Historie: {k0, s(scale), c:"int,int,..", o:"4444.."(Wochentag-Offset des Schlusses ab Montag)} */
  function decodeHist(H){
    var cs=H.c.split(','), k=[], d=[], c=[], t0=new Date(H.k0+'T00:00:00Z').getTime();
    for(var i=0;i<cs.length;i++){ var key=iso(t0+i*7*DAY); k.push(key); d.push(addDays(key, H.o ? +H.o.charAt(i) : H.off)); c.push(+cs[i]/H.s); }
    return {k:k, d:d, c:c};
  }

  /* Wochenpunkte aus der Datenbank einmischen. p = Vorwochenschluss auf aktueller Basis:
     bei bereinigten Kursen (FTSE) wird die ältere Historie mit p/alt skaliert (Ausschüttungen),
     sonst wird der Vorwochenwert korrigiert. */
  function merge(hist, docs, rescale){
    var map={}, i;
    for(i=0;i<hist.k.length;i++) map[hist.k[i]]={d:hist.d[i], c:hist.c[i]};
    (docs||[]).filter(function(w){ return w && w.k && w.c>0; }).sort(function(a,b){ return a.k<b.k?-1:a.k>b.k?1:0; }).forEach(function(w){
      var pk=addDays(w.k,-7);
      if(w.p>0 && map[pk]){
        var r=w.p/map[pk].c;
        if(Math.abs(r-1)>1e-9){
          if(rescale){ for(var key in map){ if(key<w.k) map[key].c*=r; } }
          else map[pk].c=w.p;
        }
      }
      map[w.k]={d:w.d||addDays(w.k,4), c:w.c};
    });
    var ks=Object.keys(map).sort();
    return {k:ks, d:ks.map(function(x){return map[x].d;}), c:ks.map(function(x){return map[x].c;})};
  }

  /* Regel über die ganze Serie. rule: {type:'confirm', n} oder {type:'band', p} */
  function evalRule(S, rule){
    var n=S.c.length, sma=new Array(n), st=new Array(n), up=new Array(n), dn=new Array(n), sum=0, i;
    for(i=0;i<n;i++){ sum+=S.c[i]; if(i>=50) sum-=S.c[i-50]; sma[i]= i>=49 ? sum/50 : null; }
    var s=null, u=0, dw=0, sw=[];
    for(i=0;i<n;i++){
      if(sma[i]==null){ st[i]=null; up[i]=0; dn[i]=0; continue; }
      var c=S.c[i], M=sma[i];
      if(c>M){u++; dw=0;} else if(c<M){dw++; u=0;} else {u=0; dw=0;}
      var prev=s;
      if(rule.type==='band'){ if(s===null) s=c>M?1:0; else if(s===0&&c>M*(1+rule.p)) s=1; else if(s===1&&c<M*(1-rule.p)) s=0; }
      else { if(s===null) s=c>M?1:0; else if(s===0&&u>=rule.n) s=1; else if(s===1&&dw>=rule.n) s=0; }
      st[i]=s; up[i]=u; dn[i]=dw;
      if(prev!==null && prev!==s) sw.push({i:i, k:S.k[i], d:S.d[i], to:s, c:c, m:M});
    }
    var L=n-1, S49=0; for(i=n-49;i<n;i++) S49+=S.c[i];
    var p=rule.type==='band'?rule.p:0.03;
    var lastSw=sw.length?sw[sw.length-1]:null;
    return {sma:sma, st:st, up:up, dn:dn, sw:sw,
      last:{i:L, k:S.k[L], d:S.d[L], c:S.c[L], m:sma[L], dist:S.c[L]/sma[L]-1, st:st[L], up:up[L], dn:dn[L],
            changed: L>0 && st[L-1]!=null && st[L-1]!==st[L], lastSwitch:lastSw},
      next:{above:S49/49, bandUp:(1+p)*S49/(49-p), bandDown:(1-p)*S49/(49+p)}};
  }

  /* Buchungen -> FIFO-Bestände und realisierte Gewinne */
  function book(tx){
    var pos={ftse:[], btc:[], gold:[]}, real=[];
    (tx||[]).slice().sort(function(a,b){ return a.d<b.d?-1:a.d>b.d?1:((a.ts||0)-(b.ts||0)); }).forEach(function(t){
      if(!pos[t.a] || !(t.units>0)) return;
      if(t.type==='kauf'){ pos[t.a].push({d:t.d, units:t.units, cpu:(t.units*t.price+(t.fee||0))/t.units, id:t.id, est:!!t.est}); }
      else if(t.type==='verkauf'){
        var left=t.units, per=(t.units*t.price-(t.fee||0))/t.units, cost=0, sg=0, lg=0;
        while(left>1e-12 && pos[t.a].length){
          var lot=pos[t.a][0], q=Math.min(left, lot.units), g=q*(per-lot.cpu);
          cost+=q*lot.cpu; if(isLongTerm(lot.d, t.d)) lg+=g; else sg+=g;
          lot.units-=q; left-=q; if(lot.units<=1e-12) pos[t.a].shift();
        }
        real.push({a:t.a, d:t.d, units:t.units, proceeds:t.units*per, cost:cost, gain:t.units*per-cost, shortGain:sg, longGain:lg, open:left, id:t.id});
      }
    });
    return {pos:pos, real:real};
  }
  function units(lots){ return lots.reduce(function(s,l){return s+l.units;},0); }
  function cost(lots){ return lots.reduce(function(s,l){return s+l.units*l.cpu;},0); }

  /* Steuerlage des Jahres aus Einstellungen + erfassten Verkäufen */
  function taxYear(cfg, real, year){
    var r20=0, r23=0;
    (real||[]).forEach(function(r){
      if(r.d.slice(0,4)!==String(year)) return;
      if(r.a==='ftse'){ if(!cfg.pbUsedDate || r.d>cfg.pbUsedDate) r20+=r.gain*(1-cfg.tfs); }
      else r23+=r.shortGain;
    });
    var pbFree=(cfg.pb||0)-(cfg.pbUsed||0)-(cfg.interestRest||0)-r20+(cfg.lossOther||0);
    var s23Before=(cfg.s23Other||0)+r23;
    return {pbFree:pbFree, r20:r20, r23:r23, s23Before:s23Before};
  }
  function tax23(x, cfg){ return x>=cfg.fg ? x*cfg.rate : 0; }

  /* FIFO-Verkauf simulieren: wie viel Wert v bringt welchen Gewinn */
  function simSell(lots, v, px, date, a, cfg){
    var q=v/px, left=q, g20=0, sg=0, lg=0, parts=[];
    for(var i=0;i<lots.length && left>1e-12;i++){
      var l=lots[i], take=Math.min(left,l.units), g=take*(px-l.cpu);
      parts.push({d:l.d, q:take, g:g, long: a!=='ftse' && isLongTerm(l.d,date)});
      if(a==='ftse') g20+=g; else if(isLongTerm(l.d,date)) lg+=g; else sg+=g;
      left-=take;
    }
    return {q:q, g20:g20, taxable20:g20*(1-cfg.tfs), sg:sg, lg:lg, parts:parts};
  }
  /* größter steuerfreier Verkaufswert (FIFO, ohne Lose zu überspringen) */
  function taxFreeMax(lots, px, date, a, cfg, ty){
    var val=0;
    if(a==='ftse'){
      var room=Math.max(0, ty.pbFree);
      for(var i=0;i<lots.length;i++){ var l=lots[i], gpu=(px-l.cpu)*(1-cfg.tfs);
        if(gpu<=0){ val+=l.units*px; room+=-gpu*l.units; continue; }
        var q=Math.min(l.units, room/gpu); val+=q*px; room-=q*gpu; if(q<l.units-1e-12) break; }
      return val;
    }
    var limit=cfg.fg-(cfg.buffer||0)-0.01, acc=ty.s23Before; /* Freigrenze: Summe muss unter 1.000 € bleiben */
    for(var j=0;j<lots.length;j++){ var L=lots[j];
      if(isLongTerm(L.d,date)){ val+=L.units*px; continue; }
      var g=px-L.cpu;
      if(g<=0){ val+=L.units*px; acc+=g*L.units; continue; }
      var roomS=limit-acc; if(roomS<=0) break;
      var qq=Math.min(L.units, roomS/g); val+=qq*px; acc+=qq*g; if(qq<L.units-1e-12) break; }
    return val;
  }

  /* Rebalancing. o: {date, w, st, px, pos, cash, cfg, ty, variant} */
  function rebalance(o){
    var A=['ftse','btc','gold'], cfg=o.cfg, ty=o.ty, rows={}, T=0;
    A.forEach(function(a){
      var lots=o.pos[a]||[], u=units(lots), V=u*(o.px[a]||0), C=o.cash[a]||0;
      rows[a]={a:a, st:o.st[a], units:u, V:V, C:C, S:V+C, sell:0, buy:0, cashTo:0, ruleSale:false, g20:0, t20:0, sg:0, lg:0};
      T+=V+C;
    });
    A.forEach(function(a){ rows[a].G=T*o.w[a]; });
    /* Regel-Verkauf: Position laut Regel draußen, aber noch gehalten */
    A.forEach(function(a){ var r=rows[a]; if(r.st===0 && r.V>0){ r.ruleSale=true; r.sell=r.V; } });
    var supply=0, demand=0;
    A.forEach(function(a){
      var r=rows[a], desired=r.S-r.G;
      if(desired>0){
        var fromCash=Math.min(desired, r.C + (r.ruleSale? r.V:0));
        var rest=desired-fromCash;
        if(r.st===1 && rest>0){
          var cap = o.variant==='frei' ? taxFreeMax(o.pos[a], o.px[a], o.date, a, cfg, ty) : Infinity;
          r.sellWanted=rest; r.sell=Math.min(rest, cap); r.capped=r.sell<rest-0.5;
        }
        r.give=fromCash+(r.st===1? r.sell:0);
        supply+=r.give;
        if(r.st===1) r.buyOwn=Math.max(0, r.C-fromCash); /* Rest-Cash der Position investieren */
      } else {
        r.want=-desired; demand+=r.want;
        if(r.st===1) r.buyOwn=r.C;
      }
    });
    var f = demand>0 ? Math.min(1, supply/demand) : 0;
    A.forEach(function(a){
      var r=rows[a];
      if(r.want){ r.get=r.want*f; if(r.st===1) r.buy=(r.buyOwn||0)+r.get; else r.cashTo=r.get; }
      else if(r.st===1 && r.buyOwn) r.buy=r.buyOwn;
      if(r.st===0 && !r.want){ r.cashTo=-(r.give||0) + (r.ruleSale? r.V:0); }
      if(r.sell>0){ var sm=simSell(o.pos[a], r.sell, o.px[a], o.date, a, cfg); r.sellUnits=sm.q; r.g20=sm.g20; r.t20=sm.taxable20; r.sg=sm.sg; r.lg=sm.lg; }
      if(r.buy>0) r.buyUnits=r.buy/(o.px[a]||1);
      r.after = r.st===1 ? (r.V - r.sell + r.buy) : (r.C + (r.ruleSale? r.V:0) + (r.want? r.get : -(r.give||0)));
    });
    /* Steuern */
    var new20=A.reduce(function(s,a){return s+rows[a].t20;},0);
    var free20=Math.max(0, ty.pbFree);
    var tax20 = Math.max(0, new20 - free20) * cfg.abg;
    var sgNew=A.reduce(function(s,a){return s+(a==='ftse'?0:rows[a].sg);},0);
    var tax23v = tax23(ty.s23Before+sgNew, cfg) - tax23(ty.s23Before, cfg);
    var orders=A.reduce(function(s,a){return s+(rows[a].sell>0.5?1:0)+(rows[a].buy>0.5?1:0);},0);
    var afterT=A.reduce(function(s,a){return s+rows[a].after;},0);
    A.forEach(function(a){ rows[a].wAfter = afterT>0 ? rows[a].after/afterT : 0; });
    return {rows:rows, T:T, tax20:tax20, tax23:tax23v, tax:tax20+tax23v, new20:new20, free20:free20, s23After:ty.s23Before+sgNew, orders:orders, fees:orders*(cfg.fee||0), fill:f,
            pbLeft: Math.max(0, free20-new20)};
  }

  /* Vorabpauschale des Jahres (fällig im Januar des Folgejahres) für die FTSE-Lose */
  function vorab(lots, year, p0, pEnd, basiszins){
    if(!(p0>0) || !(pEnd>p0)) return 0;
    var vp=0;
    lots.forEach(function(l){
      var y=+l.d.slice(0,4), m=+l.d.slice(5,7);
      var f = y<year ? 1 : (y===year ? (13-m)/12 : 0);
      var base = l.units*p0*basiszins*0.7*f;
      vp += Math.min(base, l.units*(pEnd-p0));
    });
    return vp;
  }

  return {iso:iso, addDays:addDays, mondayOf:mondayOf, daysBetween:daysBetween, oneYearAfter:oneYearAfter, isLongTerm:isLongTerm, taxFreeFrom:taxFreeFrom,
          decodeHist:decodeHist, merge:merge, evalRule:evalRule, book:book, units:units, cost:cost, taxYear:taxYear, tax23:tax23,
          simSell:simSell, taxFreeMax:taxFreeMax, rebalance:rebalance, vorab:vorab};
})();
if(typeof module!=='undefined') module.exports=ENG;
```

## Anhang C: Quellen und Einordnung

### Berichte im Projekt „Enjoyer OS“

| Bericht | Inhalt | Link |
|---|---|---|
| Teil 1: Backtest-Check | Kursaussagen und Regeln von Enjoyer OS nachgerechnet | https://claude.ai/artifact/5Qg2HfCobJNbKdoiCYbTLg |
| Teil 2: All-World vs. S&P 500 | 2-Wochen-Regel auf FTSE All-World und S&P 500, 50/30/20-Depot | https://claude.ai/artifact/AUp5PzADBkJoT3Eo8MHihv |
| Teil 3: Steuer-Check 50/30/20 | Steuern und Rebalancing zum Jahresende, Krypto-Entwurf | https://claude.ai/artifact/2BspkHKPtExMzmsMHo6UmU |
| Prototyp „Regel-Depot 50/30/20“ | Oberfläche und Rechenlogik als Vorlage | https://claude.ai/artifact/Aog6uQBDFD1UKouvuPQJxY |

### Backtest-Kennzahlen zur Einordnung (keine Anforderung)

| Rechnung | Mit Regel | Buy & Hold |
|---|---|---|
| FTSE All-World, 2-Wochen-Regel, Euro, ETF 05/2013–09/2026 | 8,5 % p. a., größter Rückgang −19,9 % | 11,7 % p. a., −29,3 % |
| FTSE-Stellvertreter MSCI ACWI, Euro, 12/2001–09/2026 | 7,91 % p. a., −21,9 % | 7,94 % p. a., −52,3 % |
| Bitcoin, 3-%-Band, Euro, seit 2015 | 71,0 % p. a., −66 % | 69,7 % p. a., −82 % |
| Gold, 4-Wochen-Regel, Euro, seit 2015 | 8,0 % p. a. | 12,7 % p. a. |
| Depot 50/30/20 ohne Rebalancing, Median aller 3-Jahres-Fenster | 27,4 % p. a., Median-Rückgang −30 % | 27,5 % p. a., −37 % |

Einschränkung aus Teil 1: Das 3-%-Band schlägt die einfache 50-Wochen-Regel nur bei genau 50 Wochen, bei 40, 45, 55 und 60 Wochen nicht. Das spricht für Vorsicht bei Änderungen an den Parametern.

### Rechtsgrundlagen (Stand September 2026)

- § 20 EStG (Kapitalerträge, Abgeltungsteuer, Sparer-Pauschbetrag)
- § 23 EStG (private Veräußerungsgeschäfte, Haltefrist, Freigrenze 1.000 €)
- §§ 18 und 20 InvStG (Vorabpauschale, Teilfreistellung)
- BMF-Referentenentwurf zur Besteuerung von Kryptowerten (Berichte ab September 2026, kein Gesetz)
