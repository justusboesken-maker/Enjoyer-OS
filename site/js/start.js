/* Startdaten aus docs/uebergabe.md, Abschnitt 5 (Stand 24.09.2026) und Abschnitt 2.6.
   Die App übernimmt sie beim ersten Aufruf. Änderungen im Browser werden lokal gespeichert
   und können als JSON exportiert werden. Status je Wert siehe Kommentar. */
var START = {
  version: 2,
  asOf: '2026-09-24',
  repo: 'justusboesken-maker/Enjoyer-OS',

  /* Transaktionen (6.3). Startbestand laut Trade Republic. */
  tx: [
    { id: 'start-ftse', d: '2026-09-18', a: 'ftse', type: 'kauf', units: 41.691483, price: 167.92, fee: 0,
      note: 'Startbestand laut Trade Republic, ein Kauf am 18.09.2026 (Einstandskurs 167,92 €)', src: 'screenshot', est: false },
    { id: 'start-btc', d: '2026-06-30', a: 'btc', type: 'kauf', units: 0.050467, price: 55011.54, fee: 0,
      note: 'Startbestand laut Trade Republic. Kaufdaten fehlen (O-1). Annahme A-11: Kauf im Juni 2026, Tag unbekannt, vorsichtig der 30.06. angesetzt', src: 'screenshot', est: true }
  ],

  /* Cash 3.402 € (FAKT). Verteilung O-5 am 24.09.2026 geklärt: jeder Baustein bis zu seinem Ziel,
     FTSE 44,71 €, Bitcoin 522,39 € und Gold 2.834,90 € (wartet auf das Gold-Kaufsignal). */
  cash: { total: 3402, date: '2026-09-24', ftse: 44.71, btc: 522.39, gold: 2834.90 },

  /* Euro-Kurse für die Bewertung (A-4, O-16). */
  prices: {
    ftse: { px: 168.92, d: '2026-09-24', src: 'VWCE Xetra-Schluss (B-7)' },
    btc: { px: 73908.69, d: '2026-09-24', src: 'aus dem Wert laut Trade-Republic-App (B-7)' },
    gold: { px: null, d: null, src: 'SGBS.MI, noch kein Kurs erfasst' }
  },

  /* Steuerlage 2026 (2.6, 5.1) */
  tax: {
    year: 2026,
    pb: 1000,                  /* Sparer-Pauschbetrag, FAKT */
    fsaShown: 933.63,          /* Anzeige Freistellungsauftrag, FAKT */
    fsaMeaning: 'annahme',     /* O-3 offen; gerechnet nach A-10: 933,63 € sind frei ('frei' | 'genutzt' nach Klärung) */
    pbDate: '2026-09-24',      /* Stichtag des genutzten Pauschbetrags */
    interestRate: 0.025,       /* Zins auf Cash 2,5 %, deine Angabe */
    interestAuto: true,        /* A-8: Zinsen für den Rest des Jahres schätzen */
    interestRest: 0,
    lossOther: 0,              /* Verlusttopf allgemein, FAKT */
    lossStocks: 99.66,         /* Verlusttopf Aktien, FAKT, verrechnet nur Aktiengewinne */
    o2: 'offen',               /* O-2: „+7,44 €“ Gewinn oder Erlös? */
    o2Amount: 7.44,
    s23Extra: 0,               /* weitere § 23-Gewinne des Jahres außerhalb der App */
    rate: null,                /* Grenzsteuersatz OFFEN (O-4), „unter 30 %“ */
    vorabP0: 145.14,           /* VWCE-Schluss 02.01.2026, FAKT */
    basiszins: 0.032           /* Basiszins 2026, FAKT */
  },

  /* Einstellungen. null = OFFEN, ohne Vorgabewert (O-7, O-8, O-9, O-10, O-15, O-16). */
  settings: {
    fee: 1,                    /* A-3: 1 € je Order */
    buffer: null,              /* O-8: Puffer zur Freigrenze */
    minOrder: null,            /* O-8: Mindestbetrag je Order */
    grenzfall: null,           /* O-8: Grenzfall-Abstand in % */
    vorwarnung: null,          /* O-7: Vorwarn-Abstand in % */
    vorwarnZeitFtseGold: '',   /* O-7 */
    vorwarnZeitBtc: '',        /* O-7 */
    btcRebalDay: null,         /* O-9: '30.12.' oder '31.12.' */
    fractional: null,          /* O-10 */
    o15: null,                 /* O-15: null = offen, gerechnet wie der Prototyp */
    priceSource: null,         /* O-16 */
    o6: null,                  /* O-6: Startentscheidung Bitcoin ('regel' | 'halten') */
    o11: 'Telegram über GitHub Actions; Hosting auf GitHub Pages, öffentlich ohne Login (24.09.2026)', /* O-11 */
    o12: null,                 /* O-12: LBMA-Fixing 'PM' | 'AM'; gerechnet wird mit PM (A-5) */
    o13: '',                   /* O-13: neues Geld und Entnahmen (Freitext) */
    o14: null,                 /* O-14: fehlende Kursdaten 'warten' | 'ersatz' | 'hinweis' */
    o17: '',                   /* O-17: Krypto-Neuregelung (Freitext) */
    rebalDate: '2026-12-30'    /* Annahme (2.5): 30.12. für VWCE und Gold-ETC */
  },

  /* Gegenprobe Gold, COMEX GC=F zum Wochenschluss 18.09.2026 (5.2). Nur Anzeige. */
  comex: { d: '2026-09-18', c: 4424.90, m: 4479.44, dist: -0.0122, st: 1, since: '2026-08-28' }
};
if (typeof module !== 'undefined') module.exports = START;
