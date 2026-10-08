// Datensparmodus: Personenbezogene Angaben werden geschwärzt, bevor ein Dokumenttext an die KI geht.
// Für die Auswertung von Zeugnissen und Lebensläufen werden Name, Anschrift und Kontaktdaten nicht gebraucht.

function regexEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MUSTER = [
  { art: 'E-Mail', re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, ersatz: '[E-Mail]' },
  { art: 'IBAN', re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g, ersatz: '[IBAN]' },
  // Telefon: führende 0 bzw. +49 mit mindestens zweistelliger Vorwahl – Datumsangaben wie „08/2014 - 06/2017“ bleiben erhalten.
  { art: 'Telefon', re: /(?:\+\d{2}\s?|\b00\d{2}\s?|\b0)\(?\d{2,5}\)?[\s/-]?\d{3,}(?:[\s-]?\d{1,5})*/g, ersatz: '[Telefon]' },
  { art: 'Geburtsdatum', re: /(geboren am|geb\.|geburtsdatum:?)\s*\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}/gi, ersatz: '$1 [Datum]' },
  { art: 'Anschrift', re: /\b[A-ZÄÖÜ][\wäöüß.-]*(?:straße|strasse|str\.|weg|allee|platz|gasse|ring|damm|ufer|chaussee|pfad)\s+\d+\s?[a-zA-Z]?\b/g, ersatz: '[Anschrift]' },
  { art: 'PLZ/Ort', re: /\b\d{5}[ \t]+(?!Euro|EUR|Mitarbeit|Kunden|Stunden|Teilnehm|Buchung|Belege|Rechnung)[A-ZÄÖÜ][a-zäöüß]+(?:[ -][A-ZÄÖÜ][a-zäöüß]+)?/g, ersatz: '[PLZ Ort]' },
  { art: 'Name', re: /\b(Herrn?|Frau)\s+(?:Dr\.\s+)?[A-ZÄÖÜ][a-zäöüß-]+(?:\s+[A-ZÄÖÜ][a-zäöüß-]+)?/g, ersatz: '$1 [Name]' },
];

export function schwaerzen(text, { namen = [] } = {}) {
  let ergebnis = String(text || '');
  const arten = {};
  const zaehlen = (art, n) => {
    if (n) arten[art] = (arten[art] || 0) + n;
  };

  // Kontaktmuster zuerst (sonst zerstört die Namensschwärzung z. B. „vorname.nachname@…“), dann Namen aus dem Profil.
  const [kontakt, rest] = [MUSTER.filter((m) => ['E-Mail', 'IBAN', 'Telefon'].includes(m.art)), MUSTER.filter((m) => !['E-Mail', 'IBAN', 'Telefon'].includes(m.art))];
  for (const { art, re, ersatz } of kontakt) {
    zaehlen(art, (ergebnis.match(re) || []).length);
    ergebnis = ergebnis.replace(re, ersatz);
  }

  for (const name of namen.map((n) => String(n || '').trim()).filter((n) => n.length >= 2)) {
    const re = new RegExp(`(?<![\\wäöüÄÖÜß])${regexEscape(name)}(?![\\wäöüÄÖÜß])`, 'gi');
    zaehlen('Name', (ergebnis.match(re) || []).length);
    ergebnis = ergebnis.replace(re, '[Name]');
  }

  for (const { art, re, ersatz } of rest) {
    zaehlen(art, (ergebnis.match(re) || []).length);
    ergebnis = ergebnis.replace(re, ersatz);
  }

  const anzahl = Object.values(arten).reduce((a, b) => a + b, 0);
  return { text: ergebnis, anzahl, arten };
}
