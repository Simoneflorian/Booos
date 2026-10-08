// Optionale KI-Funktionen über die Claude API (Anthropic).
// Wird nur genutzt, wenn ANTHROPIC_API_KEY gesetzt ist UND der Nutzer im Browser den KI-Modus erlaubt hat.
// Es werden nur die Daten gesendet, die für die jeweilige Aufgabe nötig sind.
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.js';

export class KiFehler extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

let client = null;
// Für Tests austauschbar.
export function setKiClient(neu) {
  client = neu;
}

function holeClient() {
  if (client) return client;
  if (!config.kiAktiv) throw new KiFehler('Der KI-Modus ist nicht eingerichtet: In der Datei .env fehlt ANTHROPIC_API_KEY (siehe README).', 503);
  client = new Anthropic();
  return client;
}

// Server-seitiger Fallback bei Ablehnungen ist nur für diese Modelle verfügbar.
const MIT_FALLBACK = /^claude-(opus-5|fable-5|sonnet-5-5)/;

const GRUNDREGELN = `Du arbeitest in einem Bewerbungs- und Karriere-Assistenten für Menschen in Deutschland. Antworte immer auf Deutsch, in klarer, freundlicher Sprache ohne Fachchinesisch, in der Du-Form.
Grundsätze:
- Erfinde nichts. Wenn eine Information fehlt oder unsicher ist, sag das ausdrücklich.
- Bewerte niemals geschützte Merkmale nach dem AGG (Alter, Geschlecht, ethnische Herkunft, Religion/Weltanschauung, Behinderung, sexuelle Identität) und leite sie nicht ab.
- Du ersetzt keine Rechts-, Steuer- oder Sozialberatung. Weise bei rechtlichen Fragen auf Fristen und passende Beratungsstellen hin.`;

async function anfrage({ system, content, effort = 'medium', tools, format, maxTokens = 16000 }) {
  const messages = [{ role: 'user', content }];
  let antwort;
  try {
    for (let runde = 0; runde < 6; runde++) {
      antwort = await holeClient().beta.messages.create({
        model: config.kiModell,
        max_tokens: maxTokens,
        system: `${GRUNDREGELN}\n\n${system}`,
        messages,
        output_config: { effort, ...(format ? { format: { type: 'json_schema', schema: format } } : {}) },
        ...(tools ? { tools } : {}),
        ...(MIT_FALLBACK.test(config.kiModell) ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
      });
      // Lange Websuchen werden vom Server pausiert – Verlauf zurückgeben und fortsetzen.
      if (antwort.stop_reason !== 'pause_turn') break;
      messages.push({ role: 'assistant', content: antwort.content });
    }
  } catch (e) {
    throw fehlerUebersetzen(e);
  }
  if (antwort.stop_reason === 'refusal') {
    throw new KiFehler('Die KI hat diese Anfrage aus Sicherheitsgründen nicht beantwortet. Bitte die Eingaben umformulieren.', 422);
  }
  return antwort;
}

function fehlerUebersetzen(e) {
  if (e instanceof KiFehler) return e;
  if (e instanceof Anthropic.AuthenticationError) return new KiFehler('Der API-Schlüssel wurde abgelehnt. Bitte ANTHROPIC_API_KEY in der .env prüfen.', 401);
  if (e instanceof Anthropic.PermissionDeniedError) return new KiFehler('Der API-Schlüssel hat keine Berechtigung für dieses Modell oder diese Funktion.', 403);
  if (e instanceof Anthropic.RateLimitError) return new KiFehler('Zu viele KI-Anfragen in kurzer Zeit. Bitte eine Minute warten.', 429);
  if (e instanceof Anthropic.BadRequestError) return new KiFehler(`Die KI-Anfrage war ungültig: ${e.message}`, 400);
  if (e instanceof Anthropic.APIConnectionError) return new KiFehler('Keine Verbindung zur KI. Internetverbindung prüfen.', 503);
  if (e instanceof Anthropic.APIError) return new KiFehler(`Fehler der KI-Schnittstelle (${e.status ?? 'unbekannt'}). Bitte später erneut versuchen.`, 502);
  return new KiFehler(`Unerwarteter Fehler bei der KI-Anfrage: ${e.message}`, 500);
}

function textAus(antwort) {
  return antwort.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
}

function jsonAus(antwort) {
  const text = textAus(antwort);
  try {
    return JSON.parse(text);
  } catch {
    throw new KiFehler(antwort.stop_reason === 'max_tokens' ? 'Die KI-Antwort war zu lang und wurde abgeschnitten.' : 'Die KI-Antwort konnte nicht gelesen werden.', 502);
  }
}

// Quellen aus Websuche-Ergebnissen und Zitaten einsammeln.
export function quellenAus(antwort) {
  const quellen = new Map();
  for (const block of antwort.content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.url) quellen.set(r.url, r.title || r.url);
    }
    if (block.type === 'text' && Array.isArray(block.citations)) {
      for (const c of block.citations) if (c.url) quellen.set(c.url, c.title || c.url);
    }
  }
  return [...quellen].map(([url, titel]) => ({ url, titel }));
}

function websuche(maxUses, ort) {
  const tool = { type: 'web_search_20260209', name: 'web_search', max_uses: maxUses, user_location: { type: 'approximate', country: 'DE' } };
  if (ort) tool.user_location.city = String(ort).slice(0, 80);
  return [tool];
}

// Kontaktdaten werden für Analysen nicht gebraucht und deshalb nicht übertragen.
export function ohneKontaktdaten(profil = {}) {
  const { persoenlich = {}, ...rest } = profil;
  const { vorname, nachname, email, telefon, strasse, ...uebrig } = persoenlich;
  return { ...rest, persoenlich: uebrig };
}

// --- Schemas für strukturierte Antworten ---

const S = { type: 'string' };
const N_OPT = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const arr = (items) => ({ type: 'array', items });

const DOKUMENT_SCHEMA = obj({
  dokumenttyp: { type: 'string', enum: ['lebenslauf', 'arbeitszeugnis', 'schulzeugnis', 'hochschulzeugnis', 'ausbildungszeugnis', 'zertifikat', 'sonstiges'] },
  zusammenfassung: S,
  stationen: arr(obj({ von: S, bis: S, arbeitgeber: S, position: S, aufgaben: S, erfolge: S })),
  bildung: arr(obj({ art: S, titel: S, einrichtung: S, von: S, bis: S, note: S })),
  fachkenntnisse: arr(S),
  software: arr(S),
  sprachen: arr(obj({ sprache: S, niveau: S })),
  zeugnis: obj({ leistungsnote: N_OPT, verhaltensnote: N_OPT, begruendung: S, versteckteHinweise: arr(S), schlussformel: S }),
  noten: arr(obj({ fach: S, note: S })),
  auffaelligkeiten: arr(S),
  rueckfragen: arr(S),
});

const HR_SCHEMA = obj({
  gesamtbild: S,
  einordnung: arr(obj({ merkmal: S, einschaetzung: S, begruendung: S })),
  staerken: arr(S),
  risiken: arr(S),
  passendeRollen: arr(obj({ titel: S, begruendung: S, suchbegriff: S })),
  gehalt: S,
  atsSchluesselwoerter: arr(S),
  naechsteSchritte: arr(S),
  rueckfragen: arr(obj({ frage: S, warum: S })),
});

const ANSCHREIBEN_SCHEMA = obj({ betreff: S, anschreiben: S, hinweise: arr(S) });

// --- Aufgaben ---

export async function dokumentAuswerten({ name, mime, base64, text }) {
  const inhalt = [];
  if (mime === 'application/pdf' && base64) {
    inhalt.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } });
  } else if (mime?.startsWith('image/') && base64) {
    inhalt.push({ type: 'image', source: { type: 'base64', media_type: mime, data: base64 } });
  } else if (text) {
    inhalt.push({ type: 'text', text: `Inhalt der Datei „${name}“:\n\n${text}` });
  } else {
    throw new KiFehler('Für dieses Dokument liegt kein lesbarer Inhalt vor.', 400);
  }
  inhalt.push({
    type: 'text',
    text: `Werte diese Bewerbungsunterlage („${name}“) aus und fülle das Schema.
- Datumsangaben als JJJJ-MM (unbekannter Monat: nur JJJJ; laufend: leerer String bei „bis“).
- Bei Arbeitszeugnissen: Leistungs- und Verhaltensnote nach deutscher Zeugnissprache (1 = sehr gut … 6), versteckte Botschaften („Geheimcodes“), Schlussformel. Sonst null bzw. leer.
- Bei Schul-/Hochschul-/Ausbildungszeugnissen: Fächer und Noten.
- „auffaelligkeiten“: was Personaler hier bemerken würden (z. B. Lücken, unklare Angaben, fehlende Unterschrift).
- „rueckfragen“: 3–6 konkrete Fragen an die Person, mit denen sich ihr Profil vertiefen lässt (z. B. messbare Erfolge, Verantwortung, Gründe für Wechsel).
Gib keine Angaben zu geschützten Merkmalen (Alter, Herkunft, Religion, Familienstand, Gesundheit) wieder.`,
  });
  const antwort = await anfrage({
    system: 'Du bist eine erfahrene Personalreferentin und liest Bewerbungsunterlagen genau.',
    content: inhalt,
    effort: 'medium',
    format: DOKUMENT_SCHEMA,
  });
  return jsonAus(antwort);
}

export async function hrEinschaetzung({ profil, lokaleAnalyse, dokumentZusammenfassungen = [] }) {
  const daten = {
    profil: ohneKontaktdaten(profil),
    lokaleAnalyse,
    unterlagen: dokumentZusammenfassungen,
  };
  const antwort = await anfrage({
    system: `Du bist eine erfahrene Recruiterin und Karriereberaterin. Du erklärst ehrlich, wie ein Profil in deutschen Bewerbungsprozessen (Personalabteilung, Fachbereich, Bewerbermanagement-Software/ATS, Arbeitsagentur) voraussichtlich eingeordnet wird – und was die Person tun kann, um besser dazustehen.`,
    content: `Hier sind die Profildaten (JSON):\n\n${JSON.stringify(daten, null, 2)}\n\nErstelle eine HR-Einschätzung:
- „einordnung“: z. B. Senioritätsstufe, Anforderungsniveau (Helfer/Fachkraft/Spezialist/Experte), Profiltyp (Spezialist/Generalist), Wechselmotivation, Passung zur Wunschposition, ATS-Tauglichkeit.
- „passendeRollen“: 3–6 realistische Stellenbezeichnungen inkl. naheliegender Alternativen, jeweils mit einem guten Suchbegriff für Jobbörsen.
- „gehalt“: grobe, ehrlich als Schätzung gekennzeichnete Spanne (brutto/Jahr) für die Wunschposition in Deutschland, mit Hinweis auf Unsicherheit.
- „rueckfragen“: 5–8 Fragen, deren Antworten die Einschätzung am meisten verbessern würden (Tiefeninterview).
Bleibe bei den vorliegenden Daten. Keine Bewertung geschützter Merkmale.`,
    effort: 'high',
    format: HR_SCHEMA,
  });
  return jsonAus(antwort);
}

export async function jobsWebsuche({ was, wo, profilKurz }) {
  const antwort = await anfrage({
    system: 'Du bist eine gründliche Job-Rechercheurin. Du suchst aktuelle, echte Stellenanzeigen im Web.',
    content: `Suche aktuelle Stellenanzeigen in Deutschland.
Gesuchte Position(en): ${was || '(keine Angabe)'}
Ort/Region: ${wo || 'Deutschland, auch remote'}
Kurzprofil: ${profilKurz || '(keine Angabe)'}

Durchsuche Karriereseiten von Unternehmen und große Jobportale (z. B. StepStone, Indeed, LinkedIn, XING, regionale Portale).
Liste bis zu 10 passende, aktuelle Stellen als Markdown-Liste: **Titel** – Arbeitgeber – Ort, darunter ein Satz, warum sie passt, und der Link.
Nenne nur Stellen und Links, die du in den Suchergebnissen tatsächlich gefunden hast. Ergänze am Ende 3 alternative Suchbegriffe.`,
    effort: 'medium',
    tools: websuche(8, wo),
  });
  return { text: textAus(antwort), quellen: quellenAus(antwort) };
}

export async function leistungenRecherche({ situation, lokaleErgebnisse }) {
  const antwort = await anfrage({
    system: 'Du bist eine erfahrene Sozialberaterin mit Fachwissen im deutschen Sozialrecht (SGB II, SGB III, BEEG, BKGG, WoGG, BAföG).',
    content: `Diese (anonymisierte) Lebenssituation liegt vor:\n${JSON.stringify(situation, null, 2)}\n
Eine regelbasierte Vorprüfung hat bereits diese Leistungen gefunden: ${lokaleErgebnisse?.map((e) => e.name).join(', ') || 'keine'}.

Recherchiere im Web:
1. Welche weiteren Leistungen, Zuschüsse, Vergünstigungen oder Förderprogramme (Bund, Land, Kommune) in dieser Situation in Frage kommen – auch weniger bekannte.
2. Aktuelle Beträge, Einkommensgrenzen und Fristen (Stand ${new Date().getFullYear()}) zu den wichtigsten Leistungen.
3. Praktische Erfahrungen aus Sozialrechts-Foren und Ratgeberseiten: typische Stolperfallen bei Anträgen, häufige Ablehnungsgründe, wie man Widerspruch einlegt.

Formatiere als Markdown mit Überschriften. Kennzeichne JEDE Aussage mit der Art der Quelle:
- [Offiziell] für Behörden und Gesetze (z. B. arbeitsagentur.de, bmas.de, familienportal.de, gesetze-im-internet.de),
- [Beratung] für Sozialverbände, Verbraucherzentralen und Fachanwälte,
- [Forum] für Foren und Erfahrungsberichte – diese sind NICHT verbindlich und können veraltet oder falsch sein.
Schließe mit den 3 wichtigsten nächsten Schritten und dem Hinweis auf kostenlose Sozialberatung.`,
    effort: 'medium',
    tools: websuche(10),
  });
  return { text: textAus(antwort), quellen: quellenAus(antwort) };
}

export async function steuerRecherche({ steuer, situation, lokaleTipps }) {
  const antwort = await anfrage({
    system: 'Du kennst das deutsche Einkommensteuerrecht für Arbeitnehmerinnen und Arbeitnehmer gut.',
    content: `Steuerlich relevante Angaben (anonymisiert):\n${JSON.stringify({ steuer, erwerbsstatus: situation?.erwerbsstatus, kinder: situation?.anzahlKinder }, null, 2)}\n
Bereits gegebene Tipps: ${lokaleTipps?.map((t) => t.titel).join('; ') || 'keine'}.

Prüfe mit einer Websuche die aktuell geltenden Werte (Stand ${new Date().getFullYear()}) und ergänze weitere, konkret zu dieser Situation passende Steuertipps rund um Job, Jobwechsel, Bewerbung, Arbeitslosigkeit und Familie.
Markdown, kurze Abschnitte, jeweils mit „Was tun?“. Nenne Beträge nur, wenn sie aus einer aktuellen Quelle stammen. Weise darauf hin, dass dies keine Steuerberatung ist.`,
    effort: 'medium',
    tools: websuche(6),
  });
  return { text: textAus(antwort), quellen: quellenAus(antwort) };
}

export async function anschreibenErstellen({ profil, stellenanzeige, hinweise }) {
  const antwort = await anfrage({
    system: 'Du schreibst überzeugende, ehrliche Bewerbungsanschreiben nach deutschen Standards (DIN 5008 als Orientierung, eine Seite, keine Floskeln).',
    content: `Profil der Bewerberin bzw. des Bewerbers (JSON):\n${JSON.stringify(profil, null, 2)}\n\nStellenanzeige:\n${stellenanzeige}\n\nZusätzliche Wünsche: ${hinweise || 'keine'}

Schreibe ein Anschreiben in der Sie-Form an das Unternehmen (die Person selbst spricht in der Ich-Form).
- Einstieg ohne „hiermit bewerbe ich mich“; Bezug zur Stelle und zum Unternehmen.
- 2–3 belegte Stärken, die zu den Anforderungen der Anzeige passen – nur mit Fakten aus dem Profil, nichts erfinden.
- Eintrittstermin und – falls in der Anzeige verlangt und im Profil vorhanden – Gehaltsvorstellung.
- Max. ca. 300 Wörter. Ohne Briefkopf, ohne Datum; beginne mit der Anrede.
- Unterschreibe mit dem Platzhalter [Name] (der Name wird aus Datenschutzgründen erst lokal eingesetzt).
In „hinweise“: was die Person noch prüfen/ergänzen sollte (z. B. Ansprechpartner, fehlende Belege).`,
    effort: 'high',
    format: ANSCHREIBEN_SCHEMA,
  });
  return jsonAus(antwort);
}
