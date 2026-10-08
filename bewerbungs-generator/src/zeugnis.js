// Auswertung von Arbeitszeugnissen (Zeugnissprache) und Schul-/Hochschulzeugnissen (Noten).
// Alle Ergebnisse sind Einschätzungen anhand typischer Formulierungen – keine Gewissheit.

export function normalisieren(text) {
  return String(text || '')
    .replace(/­/g, '') // weiches Trennzeichen
    .replace(/-\s*\n\s*/g, '') // Silbentrennung am Zeilenende
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

// Reihenfolge = Priorität: die erste passende Formel bestimmt die Note.
const LEISTUNG = [
  { note: 1, re: /stets zu unserer (vollsten|vollen und uneingeschränkten|uneingeschränkten) zufriedenheit/ },
  { note: 1, re: /(unsere|die) erwartungen (stets|immer|jederzeit) (in (jeder|allerbester) (hinsicht|weise) )?(weit )?übertroffen/ },
  { note: 1, re: /(stets|immer|jederzeit) (in jeder hinsicht )?(außerordentlich|äußerst|ganz besonders) zufrieden/ },
  { note: 5, re: /(im (großen und )?ganzen|im wesentlichen|insgesamt) zu unserer zufriedenheit/ },
  { note: 6, re: /(hat sich|war stets|war) (stets |sehr )?bemüht/ },
  { note: 2, re: /stets zu unserer vollen zufriedenheit/ },
  { note: 2, re: /zu unserer vollsten zufriedenheit/ },
  { note: 2, re: /(stets|immer) (sehr )?zufrieden/ },
  { note: 3, re: /zu unserer vollen zufriedenheit/ },
  { note: 3, re: /stets zu unserer zufriedenheit/ },
  { note: 4, re: /zu unserer zufriedenheit/ },
];

const VERHALTEN = [
  { note: 1, re: /(stets|jederzeit|immer) vorbildlich/ },
  { note: 2, re: /vorbildlich|(stets|jederzeit|immer) einwandfrei/ },
  { note: 3, re: /einwandfrei|(stets|jederzeit|immer) (korrekt|tadellos)/ },
  { note: 4, re: /ohne tadel|korrekt|tadellos|zufriedenstellend/ },
];

// Typische versteckte Botschaften. Treffer sind Hinweise, keine Beweise.
const WARNSIGNALE = [
  { re: /gesellig(keit)?/, text: '„Geselligkeit“ wird oft als Anspielung auf Alkohol im Dienst gelesen.' },
  { re: /(verständnis|einsatz|engagement) für die (interessen|belange) der (kollegen|kolleginnen|belegschaft|mitarbeiter)/, text: 'Kann auf Betriebsrats- oder Gewerkschaftsarbeit hinweisen (ein solcher Hinweis ist eigentlich unzulässig).' },
  { re: /im rahmen (seiner|ihrer) (fähigkeiten|möglichkeiten)/, text: '„Im Rahmen seiner/ihrer Fähigkeiten“ bedeutet meist: Leistung eher schwach.' },
  { re: /(bemüht|bemühte sich)/, text: '„Bemüht“ heißt in der Zeugnissprache: Die Bemühungen hatten wenig Erfolg.' },
  { re: /ordnungsgemäß/, text: '„Ordnungsgemäß erledigt“ deutet auf Dienst nach Vorschrift ohne Eigeninitiative hin.' },
  { re: /(wir (haben )?(ihn|sie|herrn \S+|frau \S+) als [^.]{0,80}kennen ?gelernt|lernten wir (ihn|sie|herrn \S+|frau \S+) als)/, text: '„Wir lernten … als … kennen“ wird oft so verstanden, dass sich der Eindruck später nicht bestätigt hat.' },
  { re: /(war|erschien) (stets |immer )?pünktlich/, text: 'Die besondere Betonung von Pünktlichkeit (eine Selbstverständlichkeit) kann auf fehlende echte Stärken hindeuten.' },
  { re: /mit (großem |viel )?(fleiß|interesse) /, text: 'Fleiß und Interesse ohne Erwähnung von Ergebnissen können bedeuten: viel Einsatz, wenig Erfolg.' },
];

function ersteNote(tabelle, text) {
  for (const eintrag of tabelle) {
    const m = eintrag.re.exec(text);
    if (m) return { note: eintrag.note, formulierung: m[0] };
  }
  return null;
}

function verhaltensSatz(text) {
  const saetze = text.split(/(?<=[.!?])\s/);
  return saetze.find((s) => /verhalten/.test(s)) || '';
}

export function analysiereArbeitszeugnis(rohtext) {
  const text = normalisieren(rohtext);
  const ergebnis = {
    art: /zwischenzeugnis/.test(text) ? 'Zwischenzeugnis' : 'Arbeitszeugnis',
    qualifiziert: null,
    leistung: ersteNote(LEISTUNG, text),
    verhalten: null,
    schlussformel: null,
    austritt: null,
    warnsignale: [],
    gesamtnote: null,
    hinweise: [],
  };

  const vSatz = verhaltensSatz(text);
  ergebnis.verhalten = ersteNote(VERHALTEN, vSatz || text);
  if (vSatz) {
    const posVorg = vSatz.search(/vorgesetzt/);
    const posKoll = vSatz.search(/kolleg/);
    if (posVorg === -1 && posKoll !== -1) {
      ergebnis.hinweise.push('Im Verhaltenssatz fehlen die Vorgesetzten – das kann auf Spannungen mit Vorgesetzten hindeuten.');
    } else if (posVorg !== -1 && posKoll !== -1 && posKoll < posVorg) {
      ergebnis.hinweise.push('Kollegen werden vor den Vorgesetzten genannt – diese Reihenfolge gilt als ungünstiges Signal.');
    }
  }

  ergebnis.qualifiziert = Boolean(ergebnis.leistung || ergebnis.verhalten);
  if (!ergebnis.qualifiziert) {
    ergebnis.hinweise.push('Keine typische Leistungs- oder Verhaltensbeurteilung gefunden. Es könnte ein „einfaches“ Zeugnis sein – du hast Anspruch auf ein qualifiziertes Zeugnis (§ 109 GewO).');
  }

  const dank = /(danken|dank für|bedanken)/.test(text);
  const bedauern = /bedauern/.test(text);
  const zukunft = /(wünschen|alles gute|viel erfolg|weiterhin erfolg|beruflich und privat)/.test(text);
  if (ergebnis.art === 'Arbeitszeugnis') {
    const punkte = [dank, bedauern, zukunft].filter(Boolean).length;
    ergebnis.schlussformel = {
      dank, bedauern, zukunft,
      bewertung: punkte === 3 ? 'sehr positiv' : punkte === 2 ? 'positiv' : punkte === 1 ? 'zurückhaltend' : 'fehlt',
    };
    if (punkte === 0) ergebnis.hinweise.push('Die Schlussformel (Dank, Bedauern, gute Wünsche) fehlt. Personaler lesen das oft als negatives Signal.');
  }

  if (/auf (seinen |ihren )?eigenen wunsch/.test(text)) ergebnis.austritt = 'auf eigenen Wunsch (gutes Signal)';
  else if (/(gegenseitigen|beiderseitigen) einvernehmen/.test(text)) ergebnis.austritt = 'im gegenseitigen Einvernehmen (oft vom Arbeitgeber ausgegangen)';
  else if (/betriebsbedingt|aus betrieblichen gründen|umstrukturierung|standortschließung|insolvenz/.test(text)) ergebnis.austritt = 'betriebsbedingt (neutral, nicht deine Leistung)';
  else if (/befristet|befristung|vertragsende|projektende/.test(text)) ergebnis.austritt = 'Befristung/Projektende (neutral)';
  else if (ergebnis.art === 'Arbeitszeugnis' && /endet|verlässt|scheidet/.test(text)) ergebnis.austritt = 'ohne Grund genannt (neutral bis leicht ungünstig)';

  for (const w of WARNSIGNALE) {
    if (w.re.test(text) && !ergebnis.warnsignale.includes(w.text)) ergebnis.warnsignale.push(w.text);
  }

  const noten = [ergebnis.leistung?.note, ergebnis.verhalten?.note].filter(Boolean);
  if (noten.length) {
    // Die Leistung zählt im HR-Alltag stärker als das Verhalten.
    const gewichtet = noten.length === 2 ? ergebnis.leistung.note * 0.65 + ergebnis.verhalten.note * 0.35 : noten[0];
    ergebnis.gesamtnote = Math.round(gewichtet * 10) / 10;
  }
  return ergebnis;
}

const NOTENWORTE = { 'sehr gut': 1, gut: 2, befriedigend: 3, ausreichend: 4, mangelhaft: 5, ungenügend: 6 };
const KEINE_FAECHER = /^(note|noten|datum|klasse|schuljahr|zeugnis|name|geboren|bemerkung|unterschrift|versäumte|fehltage|ort|stempel|seite|durchschnitt|durchschnittsnote|notendurchschnitt|gesamtnote|abschlussnote|punkte|leistungen|fach|fächer|pflichtfächer|wahlpflichtfächer)$/i;

function zahl(s) {
  return parseFloat(String(s).replace(',', '.'));
}

export function analysiereSchulzeugnis(rohtext) {
  const zeilen = String(rohtext || '').split(/\r?\n/);
  const faecher = [];
  const gesehen = new Set();
  const zeilenMuster = /^\s*([A-ZÄÖÜa-zäöüß][A-Za-zÄÖÜäöüß .\-/&]{2,40}?)\s*[:.\s]\s*(sehr gut|gut|befriedigend|ausreichend|mangelhaft|ungenügend|[1-6](?:[,.][0-9])?)(?:\s*\(?([1-6])\)?)?\s*$/i;

  for (const zeile of zeilen) {
    const m = zeilenMuster.exec(zeile);
    if (!m) continue;
    const fach = m[1].trim().replace(/[.:]+$/, '');
    if (KEINE_FAECHER.test(fach) || gesehen.has(fach.toLowerCase())) continue;
    const wert = m[2].toLowerCase();
    const note = NOTENWORTE[wert] ?? (m[3] ? zahl(m[3]) : zahl(wert));
    if (!(note >= 1 && note <= 6)) continue;
    gesehen.add(fach.toLowerCase());
    faecher.push({ fach, note });
  }

  const text = normalisieren(rohtext);
  const dm = /(durchschnittsnote|gesamtnote|notendurchschnitt|durchschnitt)[^0-9]{0,30}([1-4][,.][0-9])/.exec(text);
  const angegeben = dm ? zahl(dm[2]) : null;
  const berechnet = faecher.length ? Math.round((faecher.reduce((s, f) => s + f.note, 0) / faecher.length) * 10) / 10 : null;

  let abschluss = null;
  if (/allgemeine[n]? hochschulreife|abitur/.test(text)) abschluss = 'Abitur';
  else if (/fachhochschulreife|fachabitur/.test(text)) abschluss = 'Fachhochschulreife';
  else if (/mittlere[nr]? (schulabschluss|reife)|realschulabschluss|fachoberschulreife/.test(text)) abschluss = 'Mittlerer Schulabschluss';
  else if (/hauptschulabschluss|berufsbildungsreife|erster allgemeinbildender/.test(text)) abschluss = 'Hauptschulabschluss';
  else if (/bachelor|master|diplom|magister|staatsexamen/.test(text)) abschluss = 'Hochschulabschluss';

  const staerken = faecher.filter((f) => f.note <= 2).map((f) => f.fach);
  const schwaechen = faecher.filter((f) => f.note >= 4).map((f) => f.fach);
  return { abschluss, faecher, durchschnittAngegeben: angegeben, durchschnittBerechnet: berechnet, staerken, schwaechen };
}
