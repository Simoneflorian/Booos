// Text aus hochgeladenen Unterlagen lesen, Dokumentart erkennen und lokal auswerten.
// Alles hier läuft auf dem eigenen Rechner – nichts wird verschickt.
import { extractText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { analysiereArbeitszeugnis, analysiereSchulzeugnis, normalisieren } from './zeugnis.js';

export const BILDTYPEN = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function mimeAusName(name, mime) {
  if (mime && mime !== 'application/octet-stream') return mime;
  const endung = String(name).toLowerCase().split('.').pop();
  return {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    md: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
  }[endung] || 'application/octet-stream';
}

function textDekodieren(buffer) {
  const utf8 = buffer.toString('utf8');
  // Viele Ersatzzeichen → vermutlich Windows-1252/Latin-1 (alte Word-/Notepad-Dateien)
  return (utf8.match(/�/g) || []).length > 3 ? buffer.toString('latin1') : utf8;
}

export async function textExtrahieren({ name, mime, buffer }) {
  const typ = mimeAusName(name, mime);
  const hinweise = [];

  if (typ === 'application/pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const sauber = String(text || '').trim();
    if (sauber.length < 80 * totalPages) {
      hinweise.push('Die PDF enthält kaum lesbaren Text – vermutlich ein Scan oder Foto. Mit dem KI-Modus kann sie trotzdem gelesen werden.');
    }
    return { typ, text: sauber, seiten: totalPages, methode: 'pdf', hinweise, gescannt: sauber.length < 80 * totalPages };
  }

  if (typ.includes('wordprocessingml')) {
    const { value } = await mammoth.extractRawText({ buffer });
    return { typ, text: value.trim(), seiten: null, methode: 'docx', hinweise, gescannt: false };
  }

  if (typ.startsWith('text/')) {
    return { typ, text: textDekodieren(buffer).trim(), seiten: null, methode: 'text', hinweise, gescannt: false };
  }

  if (BILDTYPEN.includes(typ)) {
    hinweise.push('Bilder (Fotos/Scans) können nur im KI-Modus gelesen werden.');
    return { typ, text: '', seiten: 1, methode: 'bild', hinweise, gescannt: true };
  }

  throw new Error(`Dateityp wird nicht unterstützt: ${name}. Erlaubt sind PDF, DOCX, TXT sowie Fotos (PNG, JPG, WEBP).`);
}

// --- Dokumentart erkennen ---

const ARTEN = [
  { art: 'arbeitszeugnis', name: 'Arbeitszeugnis', muster: [/arbeitszeugnis|zwischenzeugnis/, /zu unserer (vollsten |vollen )?zufriedenheit/, /(war|ist) (vom|seit dem) .{0,40}(bei uns|in unserem unternehmen)/, /(verhalten|auftreten) gegenüber (vorgesetzten|kollegen)/, /wünschen (ihm|ihr) /] },
  { art: 'lebenslauf', name: 'Lebenslauf', muster: [/lebenslauf|curriculum vitae|\bcv\b/, /berufserfahrung|beruflicher werdegang|berufliche stationen/, /kenntnisse|fähigkeiten|skills/, /(seit|bis) (heute|dato)|heute\b/, /sprachen/] },
  { art: 'schulzeugnis', name: 'Schulzeugnis', muster: [/hochschulreife|mittlerer schulabschluss|hauptschulabschluss|realschul|abschlusszeugnis|halbjahreszeugnis|jahreszeugnis/, /schuljahr|klasse \d/, /mathematik/, /deutsch/, /(sehr gut|befriedigend|ausreichend)/] },
  { art: 'hochschulzeugnis', name: 'Hochschulzeugnis', muster: [/bachelor|master|diplom|magister|staatsexamen|promotion/, /hochschule|universität|fachhochschule/, /ects|leistungspunkte|credit points/, /gesamtnote|abschlussnote/, /transcript of records|prüfungszeugnis/] },
  { art: 'ausbildungszeugnis', name: 'Ausbildungs-/Berufsabschluss', muster: [/abschlussprüfung|gesellenprüfung|facharbeiter|gesellenbrief|kaufmannsgehilfenbrief/, /industrie- und handelskammer|\bihk\b|handwerkskammer|\bhwk\b/, /ausbildungsberuf|berufsausbildung/, /berufsschule/] },
  { art: 'zertifikat', name: 'Zertifikat/Weiterbildung', muster: [/zertifikat|certificate|teilnahmebestätigung|teilnahmebescheinigung/, /hat (erfolgreich )?(an .{0,80})?teilgenommen|erfolgreich abgeschlossen/, /lehrgang|seminar|schulung|kurs|weiterbildung|fortbildung/, /unterrichtseinheiten|stunden/] },
];

export function dokumentartErkennen(text, dateiname = '') {
  const t = normalisieren(`${dateiname} ${text}`);
  const punkte = ARTEN.map((a) => ({ ...a, punkte: a.muster.filter((re) => re.test(t)).length }));
  punkte.sort((a, b) => b.punkte - a.punkte);
  const beste = punkte[0];
  if (!beste || beste.punkte === 0) return { art: 'sonstiges', name: 'Sonstiges Dokument', sicherheit: 0 };
  return { art: beste.art, name: beste.name, sicherheit: Math.min(1, beste.punkte / 3) };
}

// --- Lebenslauf-Heuristiken ---

const MONAT = '(?:(?:0?[1-9]|1[0-2])[./]\\s?)';
const ZEITRAUM = new RegExp(
  `(${MONAT}?(?:19|20)\\d{2})\\s*(?:-|–|—|bis)\\s*(${MONAT}?(?:19|20)\\d{2}|heute|jetzt|aktuell|dato|laufend)`,
  'i',
);

const ABSCHNITT = /^(berufserfahrung|beruflicher werdegang|ausbildung|schulbildung|schulische ausbildung|bildung|studium|kenntnisse|fähigkeiten|sprachen|sprachkenntnisse|weiterbildung(en)?|fortbildung(en)?|praktika|ehrenamt|hobbys|interessen|persönliche daten|zertifikate)\s*:?$/i;

function monatAusAngabe(angabe, istEnde) {
  if (!angabe) return '';
  if (/heute|jetzt|aktuell|dato|laufend/i.test(angabe)) return '';
  const m = /(?:(\d{1,2})[./]\s?)?(\d{4})/.exec(angabe);
  if (!m) return '';
  const monat = m[1] ? m[1].padStart(2, '0') : istEnde ? '12' : '01';
  return `${m[2]}-${monat}`;
}

export function zeitraeumeFinden(text) {
  const zeilen = String(text || '').split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
  const stationen = [];
  zeilen.forEach((zeile, i) => {
    const m = ZEITRAUM.exec(zeile);
    if (!m) return;
    const rest = zeile.replace(m[0], '').replace(/^[\s:|,–-]+/, '').trim();
    const folgezeilen = [];
    for (let j = i + 1; j < zeilen.length && folgezeilen.length < 3; j++) {
      if (ZEITRAUM.test(zeilen[j]) || ABSCHNITT.test(zeilen[j])) break;
      folgezeilen.push(zeilen[j]);
    }
    const titel = rest || folgezeilen.shift() || '';
    let art = 'beruf';
    if (/ausbildung|auszubildende|azubi/i.test(titel)) art = 'ausbildung';
    else if (/studium|bachelor|master|diplom|universität|hochschule/i.test(titel)) art = 'studium';
    else if (/praktikum|praktikant/i.test(titel)) art = 'praktikum';
    else if (/schule|schulabschluss|abitur/i.test(titel)) art = 'schule';
    stationen.push({
      art,
      von: monatAusAngabe(m[1], false),
      bis: monatAusAngabe(m[2], true),
      laufend: /heute|jetzt|aktuell|dato|laufend/i.test(m[2]),
      titel: titel.slice(0, 140),
      details: folgezeilen.join(' ').slice(0, 300),
    });
  });
  return stationen;
}

const SOFTWARE = ['Excel', 'Word', 'PowerPoint', 'Outlook', 'MS Office', 'Microsoft 365', 'SAP', 'DATEV', 'Lexware', 'Salesforce', 'HubSpot', 'Jira', 'Confluence', 'Python', 'Java', 'JavaScript', 'TypeScript', 'C#', 'C++', 'SQL', 'PHP', 'React', 'Angular', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Linux', 'Git', 'Power BI', 'Tableau', 'Photoshop', 'InDesign', 'Illustrator', 'Figma', 'AutoCAD', 'SolidWorks', 'CATIA', 'Revit', 'SPS', 'CNC', 'WordPress', 'Shopify', 'Google Ads', 'SEO'];
const SPRACHEN = ['Deutsch', 'Englisch', 'Französisch', 'Spanisch', 'Italienisch', 'Portugiesisch', 'Niederländisch', 'Polnisch', 'Russisch', 'Ukrainisch', 'Türkisch', 'Arabisch', 'Chinesisch', 'Japanisch', 'Rumänisch', 'Kroatisch', 'Serbisch', 'Griechisch', 'Persisch', 'Kurdisch', 'Vietnamesisch'];
const NIVEAU_WORTE = [
  [/muttersprache|native/, 'Muttersprache'],
  [/verhandlungssicher|fließend|sehr gut|c2/, 'C1–C2'],
  [/\bc1\b/, 'C1'],
  [/\bb2\b|gut(e)? kenntnisse|gut\b/, 'B2'],
  [/\bb1\b/, 'B1'],
  [/\ba[12]\b|grundkenntnisse|basis/, 'A1–A2'],
];

function wortRegex(wort) {
  const sicher = wort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-zÄÖÜäöü])${sicher}([^A-Za-zÄÖÜäöü#+]|$)`, 'i');
}

export function kompetenzenFinden(text) {
  const software = SOFTWARE.filter((s) => wortRegex(s).test(text));
  const sprachen = [];
  for (const sprache of SPRACHEN) {
    const m = new RegExp(`${sprache}[^\\n]{0,40}`, 'i').exec(text);
    if (!m) continue;
    const umgebung = m[0].toLowerCase();
    const niveau = NIVEAU_WORTE.find(([re]) => re.test(umgebung));
    sprachen.push({ sprache, niveau: niveau ? niveau[1] : '' });
  }
  const fuehrerschein = /führerschein[^\n]{0,30}/i.exec(text)?.[0] || '';
  return { software, sprachen, fuehrerschein };
}

// Angaben, die in Deutschland nicht in eine Bewerbung gehören müssen (AGG) – nur Hinweis, Entscheidung liegt beim Nutzer.
export function aggHinweise(text) {
  const t = normalisieren(text);
  const treffer = [];
  if (/geboren am|geburtsdatum|geb\.\s*(am\s*)?\d/.test(t)) treffer.push('Geburtsdatum/Alter');
  if (/familienstand|verheiratet|ledig|geschieden|verwitwet/.test(t)) treffer.push('Familienstand');
  if (/religion|konfession|römisch-katholisch|evangelisch|muslimisch|jüdisch/.test(t)) treffer.push('Religion');
  if (/staatsangehörigkeit|nationalität/.test(t)) treffer.push('Staatsangehörigkeit');
  if (/\bkinder\s*:/.test(t)) treffer.push('Kinder');
  return treffer;
}

export function kontaktdatenFinden(text) {
  return {
    email: /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text)?.[0] || '',
    telefon: /(\+49|0)[\d\s/()-]{7,18}\d/.exec(text)?.[0]?.trim() || '',
  };
}

export function lokalAuswerten(text, dateiname) {
  const art = dokumentartErkennen(text, dateiname);
  const ergebnis = { art, zeichen: text.length };
  if (!text) return ergebnis;

  if (art.art === 'arbeitszeugnis') ergebnis.arbeitszeugnis = analysiereArbeitszeugnis(text);
  if (['schulzeugnis', 'hochschulzeugnis', 'ausbildungszeugnis'].includes(art.art)) ergebnis.noten = analysiereSchulzeugnis(text);
  if (art.art === 'lebenslauf') {
    ergebnis.stationen = zeitraeumeFinden(text);
    ergebnis.kontakt = kontaktdatenFinden(text);
    ergebnis.agg = aggHinweise(text);
  }
  if (['lebenslauf', 'zertifikat', 'sonstiges'].includes(art.art)) ergebnis.kompetenzen = kompetenzenFinden(text);
  return ergebnis;
}
