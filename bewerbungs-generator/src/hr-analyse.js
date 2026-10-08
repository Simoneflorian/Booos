// Lokale HR-Auswertung: Wie wird dieses Profil in Bewerbungsprozessen voraussichtlich eingeordnet?
// Grundlage sind gängige Raster (Anforderungsniveau der Bundesagentur für Arbeit, DQR, KldB-Berufsbereiche)
// und typische Kriterien von Personalern und Bewerbermanagement-Systemen (ATS).
// Geschützte Merkmale nach AGG (Alter, Geschlecht, Herkunft, Religion, Behinderung …) werden NICHT bewertet.

// --- Hilfsfunktionen für Monate im Format JJJJ-MM ---

function monatIndex(jjjjmm) {
  const m = /^(\d{4})-(\d{2})/.exec(jjjjmm || '');
  return m ? +m[1] * 12 + (+m[2] - 1) : null;
}

function monatText(index) {
  const j = Math.floor(index / 12);
  const m = String((index % 12) + 1).padStart(2, '0');
  return `${m}/${j}`;
}

function heuteIndex(heute) {
  return heute.getFullYear() * 12 + heute.getMonth();
}

function liste(wert) {
  if (Array.isArray(wert)) return wert;
  return String(wert || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
}

// --- Zeiträume ---

export function zeitraeume(profil, heute = new Date()) {
  const jetzt = heuteIndex(heute);
  const eintraege = [];
  for (const s of profil?.stationen || []) {
    const von = monatIndex(s.von);
    if (von == null) continue;
    const bis = monatIndex(s.bis) ?? jetzt;
    eintraege.push({ von, bis: Math.max(von, bis), art: 'beruf', titel: s.position || s.arbeitgeber || 'Station', quelle: s });
  }
  for (const a of profil?.bildung?.ausbildungen || []) {
    const von = monatIndex(a.von);
    if (von == null) continue;
    eintraege.push({ von, bis: monatIndex(a.bis) ?? jetzt, art: 'ausbildung', titel: a.beruf || 'Ausbildung' });
  }
  for (const st of profil?.bildung?.studium || []) {
    const von = monatIndex(st.von);
    if (von == null) continue;
    eintraege.push({ von, bis: monatIndex(st.bis) ?? jetzt, art: 'studium', titel: st.fach || 'Studium' });
  }
  return eintraege.sort((a, b) => a.von - b.von);
}

export function berufserfahrungMonate(profil, heute = new Date()) {
  // Überschneidende Stationen nicht doppelt zählen. Praktika/Minijobs zählen halb.
  const belegt = new Map();
  const jetzt = heuteIndex(heute);
  for (const s of profil?.stationen || []) {
    const von = monatIndex(s.von);
    if (von == null) continue;
    const bis = monatIndex(s.bis) ?? jetzt;
    const gewicht = ['Praktikum', 'Minijob', 'Werkstudent'].includes(s.art) ? 0.5 : 1;
    for (let m = von; m <= bis; m++) belegt.set(m, Math.max(belegt.get(m) || 0, gewicht));
  }
  return [...belegt.values()].reduce((a, b) => a + b, 0);
}

export function lueckenFinden(profil, heute = new Date(), mindestMonate = 3) {
  const z = zeitraeume(profil, heute);
  if (!z.length) return [];
  const luecken = [];
  let ende = z[0].bis;
  for (const e of z.slice(1)) {
    const abstand = e.von - ende - 1;
    if (abstand >= mindestMonate) luecken.push({ von: monatText(ende + 1), bis: monatText(e.von - 1), monate: abstand });
    ende = Math.max(ende, e.bis);
  }
  const offen = heuteIndex(heute) - ende - 1;
  if (offen >= mindestMonate) luecken.push({ von: monatText(ende + 1), bis: 'heute', monate: offen, aktuell: true });
  return luecken;
}

// --- Bildung und Anforderungsniveau ---

const SCHULE_DQR = { kein: 1, 'Hauptschulabschluss': 2, 'Mittlerer Schulabschluss': 3, 'Fachhochschulreife': 4, 'Abitur': 4 };
const STUDIUM_DQR = { Bachelor: 6, Master: 7, Diplom: 7, Magister: 7, Staatsexamen: 7, Promotion: 8 };
const FORTBILDUNG_DQR = { Meister: 6, Techniker: 6, Fachwirt: 6, 'Betriebswirt (IHK/HWK)': 7 };

export function hoechsterAbschluss(profil, heute = new Date()) {
  const kandidaten = [];
  const schule = profil?.bildung?.schulabschluss;
  if (schule && SCHULE_DQR[schule]) kandidaten.push({ titel: schule, dqr: SCHULE_DQR[schule], art: 'schule' });
  const jetzt = heuteIndex(heute);
  for (const a of profil?.bildung?.ausbildungen || []) {
    const beendet = monatIndex(a.bis) != null && monatIndex(a.bis) < jetzt;
    // Ohne Angabe zum Abschluss: beendete Ausbildung als abgeschlossen werten, aber zum Prüfen markieren.
    if ((a.abschluss && !['abgebrochen', 'laufend'].includes(a.abschluss)) || (!a.abschluss && beendet)) {
      kandidaten.push({ titel: `Berufsausbildung${a.beruf ? ` (${a.beruf})` : ''}${a.abschluss ? '' : ' – Abschluss bitte im Interview bestätigen'}`, dqr: 4, art: 'ausbildung' });
    }
  }
  for (const s of profil?.bildung?.studium || []) {
    if (STUDIUM_DQR[s.abschluss]) kandidaten.push({ titel: `${s.abschluss}${s.fach ? ` ${s.fach}` : ''}`, dqr: STUDIUM_DQR[s.abschluss], art: 'studium' });
  }
  for (const f of profil?.bildung?.fortbildungen || []) {
    if (FORTBILDUNG_DQR[f.art]) kandidaten.push({ titel: `${f.art}${f.titel ? ` (${f.titel})` : ''}`, dqr: FORTBILDUNG_DQR[f.art], art: 'fortbildung' });
  }
  kandidaten.sort((a, b) => b.dqr - a.dqr);
  return kandidaten[0] || null;
}

// Anforderungsniveau nach Klassifikation der Berufe (KldB 2010) – so ordnet die Arbeitsagentur Stellen und Bewerber ein.
const NIVEAUS = {
  1: { name: 'Helfer/Anlerntätigkeit', text: 'einfache Tätigkeiten, keine oder kurze Einarbeitung' },
  2: { name: 'Fachkraft', text: 'fachlich ausgerichtete Tätigkeiten, i. d. R. abgeschlossene Berufsausbildung' },
  3: { name: 'Spezialist/in', text: 'komplexe Spezialistentätigkeiten, z. B. Meister, Techniker, Bachelor' },
  4: { name: 'Expert/in', text: 'hoch komplexe Tätigkeiten, i. d. R. mindestens vierjähriges Studium (Master/Diplom)' },
};

export function anforderungsniveau(profil, erfahrungJahre, heute = new Date()) {
  const abschluss = hoechsterAbschluss(profil, heute);
  let stufe = 1;
  const gruende = [];
  if (abschluss) {
    if (abschluss.dqr >= 7) stufe = 4;
    else if (abschluss.dqr === 6) stufe = 3;
    else if (abschluss.art === 'ausbildung') stufe = 2;
    gruende.push(`Höchster Abschluss: ${abschluss.titel} (DQR-Niveau ${abschluss.dqr})`);
  } else {
    gruende.push('Kein beruflicher Abschluss angegeben');
  }
  // Langjährige einschlägige Erfahrung wird oft wie ein formaler Abschluss behandelt.
  if (stufe === 1 && erfahrungJahre >= 5) {
    stufe = 2;
    gruende.push('Über 5 Jahre Berufserfahrung: wird häufig wie eine Fachkraft-Qualifikation gewertet');
  }
  if (stufe === 2 && erfahrungJahre >= 8 && (profil?.stationen || []).some((s) => +s.fuehrungAnzahl > 0)) {
    stufe = 3;
    gruende.push('Lange Erfahrung mit Führungsverantwortung: Einstieg auf Spezialisten-Niveau realistisch');
  }
  return { stufe, ...NIVEAUS[stufe], gruende };
}

export function senioritaet(erfahrungJahre, maxFuehrung) {
  let stufe;
  if (erfahrungJahre < 1) stufe = 'Berufseinsteiger/in';
  else if (erfahrungJahre < 3) stufe = 'Junior';
  else if (erfahrungJahre < 6) stufe = 'Professional';
  else if (erfahrungJahre < 10) stufe = 'Senior';
  else stufe = 'Expert/Lead';
  let fuehrung = 'ohne Führungsverantwortung';
  if (maxFuehrung >= 10) fuehrung = 'Führungskraft (Abteilung/Bereich)';
  else if (maxFuehrung >= 1) fuehrung = 'Teamleitung/fachliche Führung';
  return { stufe, fuehrung };
}

// Grobe Zuordnung zu den Berufsbereichen der KldB 2010 anhand von Schlüsselwörtern.
const BERUFSBEREICHE = [
  { kldb: 1, name: 'Land-, Forst- und Tierwirtschaft, Gartenbau', w: ['landwirt', 'gärtner', 'garten', 'forst', 'tier', 'pferd', 'floristik'] },
  { kldb: 2, name: 'Rohstoffgewinnung, Produktion und Fertigung', w: ['produktion', 'fertigung', 'mechatron', 'mechanik', 'elektron', 'elektriker', 'metall', 'schweiß', 'cnc', 'maschinen', 'industriemechan', 'kfz', 'lackier', 'tischler', 'schreiner', 'koch', 'bäcker', 'konditor', 'fleischer', 'qualitätssicher', 'ingenieur', 'konstrukt', 'technik'] },
  { kldb: 3, name: 'Bau, Architektur, Vermessung, Gebäudetechnik', w: ['bau', 'architekt', 'maurer', 'dachdecker', 'zimmerer', 'maler', 'fliesen', 'installateur', 'shk', 'heizung', 'sanitär', 'gebäude', 'vermess', 'elektroinstall'] },
  { kldb: 4, name: 'Naturwissenschaft, Geografie, Informatik', w: ['informatik', 'software', 'entwickler', 'developer', 'programm', 'it-', ' it ', 'data', 'daten', 'devops', 'admin', 'chemie', 'chemiker', 'labor', 'physik', 'biolog', 'mathemat'] },
  { kldb: 5, name: 'Verkehr, Logistik, Schutz und Sicherheit', w: ['logistik', 'lager', 'fahrer', 'berufskraftfahrer', 'spedition', 'versand', 'kommission', 'sicherheit', 'security', 'zusteller', 'pilot', 'lokführer'] },
  { kldb: 6, name: 'Kaufmännische Dienstleistungen, Handel, Vertrieb, Hotel und Tourismus', w: ['verkauf', 'vertrieb', 'sales', 'einzelhandel', 'handel', 'kassierer', 'einkauf', 'hotel', 'gastro', 'tourismus', 'key account', 'account manager', 'filial'] },
  { kldb: 7, name: 'Unternehmensorganisation, Buchhaltung, Recht, Verwaltung', w: ['buchhalt', 'controlling', 'finanz', 'steuer', 'personal', ' hr ', 'hr-', 'recruit', 'büro', 'sachbearbeit', 'verwaltung', 'assistenz', 'office', 'projektmanag', 'recht', 'jurist', 'kaufmann für büro', 'kauffrau für büro', 'industriekauf'] },
  { kldb: 8, name: 'Gesundheit, Soziales, Lehre und Erziehung', w: ['pflege', 'kranken', 'arzt', 'ärztin', 'medizin', 'therap', 'erzieh', 'sozial', 'lehrer', 'pädagog', 'altenpflege', 'mfa', 'apothek', 'betreuung'] },
  { kldb: 9, name: 'Geistes-, Gesellschafts-, Wirtschaftswissenschaften, Medien, Kunst, Kultur, Gestaltung', w: ['marketing', 'redakt', 'journal', 'design', 'grafik', 'medien', 'kommunikation', 'pr ', 'content', 'social media', 'übersetz', 'kultur', 'künstler', 'fotograf', ' ux', 'werbung'] },
];

export function berufsbereich(profil) {
  const text = ` ${[
    ...liste(profil?.wunsch?.positionen),
    ...(profil?.stationen || []).map((s) => `${s.position} ${s.branche}`),
    ...(profil?.bildung?.ausbildungen || []).map((a) => a.beruf),
    ...(profil?.bildung?.studium || []).map((s) => s.fach),
  ].join(' ').toLowerCase()} `;
  const punkte = BERUFSBEREICHE.map((b) => ({ ...b, treffer: b.w.filter((w) => text.includes(w)) }))
    .filter((b) => b.treffer.length)
    .sort((a, b) => b.treffer.length - a.treffer.length);
  return punkte.slice(0, 2).map(({ kldb, name, treffer }) => ({ kldb, name, treffer }));
}

// --- Hauptauswertung ---

const WICHTIGE_FELDER = [
  ['persoenlich.ort', 'Wohnort', 'Jobsuche und Pendelbereitschaft'],
  ['wunsch.positionen', 'Wunschposition(en)', 'Ohne Zielposition kann niemand dein Profil richtig einordnen'],
  ['wunsch.arbeitszeit', 'Gewünschte Arbeitszeit', 'Filter in fast jedem Bewerbermanagement-System'],
  ['wunsch.gehalt', 'Gehaltsvorstellung', 'Wird in vielen Stellenanzeigen ausdrücklich verlangt'],
  ['persoenlich.verfuegbarAb', 'Verfügbar ab', 'Personaler planen mit dem frühesten Eintrittstermin'],
  ['persoenlich.kuendigungsfrist', 'Kündigungsfrist', 'Entscheidet oft zwischen zwei gleich guten Bewerbern'],
  ['bildung.schulabschluss', 'Schulabschluss', 'Grundlage der formalen Einstufung'],
  ['kompetenzen.fachlich', 'Fachkenntnisse', 'Daraus entstehen die Schlüsselwörter für ATS-Systeme'],
  ['kompetenzen.software', 'Software/Tools', 'Werden von ATS-Systemen gezielt abgefragt'],
  ['arbeitsweise.staerken', 'Stärken mit Beispielen', 'Grundlage für Anschreiben und Vorstellungsgespräch'],
  ['arbeitsweise.erfolgsbeispiel', 'Ein konkretes Erfolgsbeispiel', 'Messbare Erfolge heben dich von anderen ab'],
  ['arbeitsweise.motivation', 'Was dich antreibt', 'Hilft bei der Frage „Warum diese Stelle?“'],
];

function wert(objekt, pfad) {
  return pfad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objekt);
}

function gefuellt(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

export function analysiereProfil(profil = {}, dokumente = [], heute = new Date()) {
  const stationen = profil.stationen || [];
  const erfahrungMonate = berufserfahrungMonate(profil, heute);
  const erfahrungJahre = Math.round((erfahrungMonate / 12) * 10) / 10;
  const maxFuehrung = Math.max(0, ...stationen.map((s) => +s.fuehrungAnzahl || 0));
  const luecken = lueckenFinden(profil, heute);
  const jetzt = heuteIndex(heute);

  const dauern = stationen
    .filter((s) => monatIndex(s.von) != null && !['Praktikum', 'Werkstudent', 'Ausbildung'].includes(s.art))
    .map((s) => (monatIndex(s.bis) ?? jetzt) - monatIndex(s.von) + 1);
  const kurzeStationen = dauern.filter((d) => d < 18).length;
  const durchschnittMonate = dauern.length ? Math.round(dauern.reduce((a, b) => a + b, 0) / dauern.length) : null;

  const zeugnisse = dokumente.map((d) => d?.analyse?.arbeitszeugnis).filter((z) => z?.gesamtnote);
  const zeugnisNote = zeugnisse.length ? Math.round((zeugnisse.reduce((s, z) => s + z.gesamtnote, 0) / zeugnisse.length) * 10) / 10 : null;
  const zeugnisWarnungen = dokumente.flatMap((d) => d?.analyse?.arbeitszeugnis?.warnsignale || []);
  const aggTreffer = [...new Set(dokumente.flatMap((d) => d?.analyse?.agg || []))];

  const niveau = anforderungsniveau(profil, erfahrungJahre, heute);
  const senior = senioritaet(erfahrungJahre, maxFuehrung);
  const bereiche = berufsbereich(profil);
  const abschluss = hoechsterAbschluss(profil, heute);

  const staerken = [];
  const risiken = [];
  const tipps = [];

  if (erfahrungJahre >= 3) staerken.push(`${String(erfahrungJahre).replace('.', ',')} Jahre Berufserfahrung`);
  if (maxFuehrung > 0) staerken.push(`Führungserfahrung (bis zu ${maxFuehrung} Personen)`);
  if (zeugnisNote && zeugnisNote <= 2) staerken.push(`Arbeitszeugnisse im Schnitt etwa Note ${String(zeugnisNote).replace('.', ',')}`);
  if (durchschnittMonate && durchschnittMonate >= 36) staerken.push('Lange Verweildauer bei Arbeitgebern (Loyalität)');
  const sprachen = profil.kompetenzen?.sprachen || [];
  const fremd = sprachen.filter((s) => s.sprache && s.sprache !== 'Deutsch' && /B2|C1|C2|Muttersprache/.test(s.niveau || ''));
  if (fremd.length) staerken.push(`Fremdsprachen auf gutem Niveau: ${fremd.map((s) => s.sprache).join(', ')}`);
  if (stationen.some((s) => gefuellt(s.erfolge))) staerken.push('Konkrete Erfolge benannt – das wirkt auf Personaler stark');
  if ((profil.bildung?.fortbildungen || []).length >= 2) staerken.push('Regelmäßige Weiterbildung');

  if (kurzeStationen >= 3) {
    risiken.push(`${kurzeStationen} Stationen kürzer als 18 Monate – Personaler fragen hier oft nach („Jobhopping“).`);
    tipps.push('Kurze Stationen im Lebenslauf kurz begründen (z. B. Befristung, Projektende, Insolvenz).');
  }
  for (const l of luecken) {
    risiken.push(`Lücke ${l.von} – ${l.bis} (${l.monate} Monate)${l.aktuell ? ' – aktuell' : ''}`);
  }
  if (luecken.length && !gefuellt(profil.luecken?.erklaerungen)) {
    tipps.push('Lücken nicht verstecken: Im Lebenslauf kurz benennen, was du in der Zeit gemacht hast (Weiterbildung, Familie, Pflege, Neuorientierung, Krankheit genügt als „Auszeit“).');
  }
  if (zeugnisNote && zeugnisNote >= 3.5) risiken.push(`Arbeitszeugnisse eher durchschnittlich bis schwach (≈ Note ${String(zeugnisNote).replace('.', ',')}).`);
  if (zeugnisWarnungen.length) tipps.push('In deinen Arbeitszeugnissen stehen Formulierungen mit möglicher Nebenbedeutung – Details unter „Unterlagen“. Du kannst eine Berichtigung verlangen.');
  if (stationen.some((s) => s.zeugnisVorhanden === 'nein' && s.bis)) tipps.push('Für beendete Stellen ohne Zeugnis: Zeugnis schriftlich beim früheren Arbeitgeber anfordern (Anspruch nach § 109 GewO).');
  if (!abschluss || abschluss.art === 'schule') tipps.push('Ohne Berufsabschluss lohnt ein Blick auf geförderte Umschulungen oder die Externenprüfung (siehe „Sozialleistungen“ → Bildungsgutschein).');
  if (aggTreffer.length) tipps.push(`Dein Lebenslauf enthält: ${aggTreffer.join(', ')}. Das ist in Deutschland nicht nötig (AGG) – du entscheidest, ob du es angibst.`);

  // ATS-Check: Was automatische Bewerbermanagement-Systeme erwarten
  const ats = [];
  const lebenslauf = dokumente.find((d) => d?.analyse?.art?.art === 'lebenslauf');
  ats.push({ ok: Boolean(lebenslauf), text: lebenslauf ? 'Lebenslauf hochgeladen' : 'Noch kein Lebenslauf hochgeladen' });
  if (lebenslauf) {
    ats.push({ ok: !lebenslauf.gescannt, text: lebenslauf.gescannt ? 'Lebenslauf ist ein Scan – ATS-Systeme können ihn nicht lesen. Als Text-PDF exportieren.' : 'Lebenslauf ist maschinenlesbar' });
    const k = lebenslauf.analyse?.kontakt || {};
    ats.push({ ok: Boolean(k.email && k.telefon), text: k.email && k.telefon ? 'Kontaktdaten gefunden' : 'E-Mail oder Telefonnummer im Lebenslauf nicht gefunden' });
    const st = lebenslauf.analyse?.stationen || [];
    ats.push({ ok: st.length > 0, text: st.length ? `${st.length} Zeiträume im Format MM/JJJJ erkannt` : 'Keine Zeiträume erkannt – Daten am besten als „MM/JJJJ – MM/JJJJ“ schreiben' });
  }
  const schluesselwoerter = [...new Set([...liste(profil.kompetenzen?.fachlich), ...liste(profil.kompetenzen?.software)])];
  ats.push({ ok: schluesselwoerter.length >= 8, text: `${schluesselwoerter.length} Schlüsselwörter (Fachkenntnisse/Tools) – ATS-Systeme suchen gezielt danach, 8–15 sind ein guter Wert` });

  const fehlend = WICHTIGE_FELDER.filter(([pfad]) => !gefuellt(wert(profil, pfad))).map(([pfad, label, warum]) => ({ pfad, label, warum }));
  if (!stationen.length) fehlend.unshift({ pfad: 'stationen', label: 'Berufliche Stationen', warum: 'Wichtigste Grundlage jeder HR-Einordnung' });
  stationen.forEach((s, i) => {
    if (!gefuellt(s.erfolge)) fehlend.push({ pfad: `stationen.${i}.erfolge`, label: `Erfolge bei „${s.position || s.arbeitgeber || `Station ${i + 1}`}“`, warum: 'Zahlen und Ergebnisse (z. B. „Kosten um 15 % gesenkt“) sind das Stärkste im Lebenslauf' });
  });

  const gesamt = WICHTIGE_FELDER.length + 1;
  const vollstaendigkeit = Math.round(((gesamt - fehlend.filter((f) => !f.pfad.includes('.erfolge')).length) / gesamt) * 100);

  return {
    erstellt: heute.toISOString(),
    vollstaendigkeit,
    kategorisierung: {
      anforderungsniveau: niveau,
      senioritaet: senior,
      berufsbereiche: bereiche,
      hoechsterAbschluss: abschluss,
    },
    erfahrung: { jahre: erfahrungJahre, stationen: stationen.length, durchschnittMonate, kurzeStationen, aktuellBeschaeftigt: stationen.some((s) => !s.bis) },
    luecken,
    zeugnisse: { anzahl: zeugnisse.length, durchschnittNote: zeugnisNote, warnsignale: [...new Set(zeugnisWarnungen)] },
    staerken,
    risiken,
    tipps,
    ats,
    schluesselwoerter,
    fehlendeAngaben: fehlend,
    agg: aggTreffer,
  };
}
