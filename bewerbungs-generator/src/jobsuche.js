// Stellensuche über die öffentliche Jobsuche-Schnittstelle der Bundesagentur für Arbeit
// (größte Jobbörse Deutschlands, enthält auch viele Anzeigen von Unternehmen und Portalen).
import { config } from './config.js';

const BASIS = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs';

export const ARBEITSZEIT = { vollzeit: 'vz', teilzeit: 'tz', minijob: 'mj', homeoffice: 'ho', schicht: 'snw' };
export const ANGEBOTSART = { arbeit: 1, selbststaendigkeit: 2, ausbildung: 4, praktikum: 34 };

export function suchUrl({ was, wo, umkreis, arbeitszeit, angebotsart, seite, tage, zeitarbeit }) {
  const p = new URLSearchParams();
  if (was) p.set('was', was);
  if (wo) p.set('wo', wo);
  if (wo && umkreis) p.set('umkreis', String(Math.min(200, Math.max(0, parseInt(umkreis, 10) || 25))));
  if (arbeitszeit && ARBEITSZEIT[arbeitszeit]) p.set('arbeitszeit', ARBEITSZEIT[arbeitszeit]);
  p.set('angebotsart', String(ANGEBOTSART[angebotsart] || 1));
  if (tage) p.set('veroeffentlichtseit', String(Math.min(100, parseInt(tage, 10) || 30)));
  if (zeitarbeit === false) p.set('zeitarbeit', 'false');
  p.set('page', String(Math.max(1, parseInt(seite, 10) || 1)));
  p.set('size', '25');
  return `${BASIS}?${p}`;
}

function woerter(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-zäöüß0-9+#]+/)
    .filter((w) => w.length > 2);
}

// Einfache Passung: Wie viele Begriffe aus Wunschpositionen und Kompetenzen tauchen im Stellentitel/Beruf auf?
export function passung(stelle, profil) {
  if (!profil) return null;
  const ziel = new Set([
    ...woerter(profil.wunsch?.positionen),
    ...(profil.stationen || []).flatMap((s) => woerter(s.position)),
    ...woerter(profil.kompetenzen?.fachlich),
    ...woerter(profil.kompetenzen?.software),
  ]);
  if (!ziel.size) return null;
  const stellenWoerter = new Set(woerter(`${stelle.titel} ${stelle.beruf}`));
  let treffer = 0;
  for (const w of stellenWoerter) {
    if (ziel.has(w) || [...ziel].some((z) => z.length > 4 && (w.includes(z) || z.includes(w)))) treffer++;
  }
  return Math.min(100, Math.round((treffer / Math.max(1, Math.min(stellenWoerter.size, 4))) * 100));
}

export function stelleNormalisieren(s) {
  const ort = s.arbeitsort || {};
  return {
    refnr: s.refnr,
    titel: s.titel || s.beruf || 'Stellenangebot',
    beruf: s.beruf || '',
    arbeitgeber: s.arbeitgeber || '',
    ort: [ort.plz, ort.ort].filter(Boolean).join(' '),
    region: ort.region || '',
    entfernung: ort.entfernung != null ? `${ort.entfernung} km` : '',
    veroeffentlicht: s.aktuelleVeroeffentlichungsdatum || '',
    eintritt: s.eintrittsdatum || '',
    link: s.externeUrl || (s.refnr ? `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(s.refnr)}` : ''),
  };
}

export async function sucheJobs(parameter, profil, fetchImpl = fetch) {
  if (!parameter?.was && !parameter?.wo) throw new Error('Bitte mindestens eine Wunschposition oder einen Ort angeben.');
  const url = suchUrl(parameter);
  let antwort;
  try {
    antwort = await fetchImpl(url, {
      headers: { 'X-API-Key': config.jobsucheApiKey, Accept: 'application/json', 'User-Agent': 'bewerbungs-generator/0.1' },
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new Error(`Jobbörse nicht erreichbar (${e.name === 'TimeoutError' ? 'Zeitüberschreitung' : e.message}). Internetverbindung prüfen.`);
  }
  if (antwort.status === 204) return { gesamt: 0, seite: 1, treffer: [], quelle: 'Bundesagentur für Arbeit – Jobbörse', url };
  if (!antwort.ok) throw new Error(`Jobbörse antwortet mit Fehler ${antwort.status}. Bitte später erneut versuchen.`);
  const daten = await antwort.json();
  const treffer = (daten.stellenangebote || []).map((s) => {
    const n = stelleNormalisieren(s);
    return { ...n, passung: passung(n, profil) };
  });
  return {
    gesamt: daten.maxErgebnisse ?? treffer.length,
    seite: daten.page ?? 1,
    treffer,
    quelle: 'Bundesagentur für Arbeit – Jobbörse',
    url,
  };
}
