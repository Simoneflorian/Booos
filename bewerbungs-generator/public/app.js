// Bewerbungs-Generator – Oberfläche. Alle Daten liegen im Browser; der lokale Server wertet nur aus.
import { INTERVIEW, SITUATION, STEUER } from './fragen.js';
import { markdownZuHtml } from './markdown.js';

const SPEICHER_SCHLUESSEL = 'bewerbungs-generator-v1';
const MAX_TEXT = 60000;

const LEER = () => ({
  version: 1,
  einwilligung: { datenschutz: false, speichern: false, ki: false, steuer: false },
  dokumente: [],
  profil: {},
  situation: {},
  steuer: {},
  ergebnisse: {},
  kiEinstellungen: { datensparsam: true, budget: '' },
  kiKosten: {}, // US-Dollar je Monat, z. B. { '2026-10': 0.42 }
});

let zustand = LEER();
let server = { kiVerfuegbar: false, modell: null };
const dateien = new Map(); // Original-Dateien (Base64) nur im Arbeitsspeicher

// ---------------------------------------------------------------- Hilfsfunktionen

const $ = (sel, wurzel = document) => wurzel.querySelector(sel);
const $$ = (sel, wurzel = document) => [...wurzel.querySelectorAll(sel)];

function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v; // nur für bereits bereinigtes HTML (markdownZuHtml)
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const kind of kinder.flat()) {
    if (kind === null || kind === undefined || kind === false) continue;
    e.append(kind instanceof Node ? kind : document.createTextNode(String(kind)));
  }
  return e;
}

// Wie replaceChildren, aber leere Einträge (null/false) werden übersprungen statt als Text „null“ eingefügt.
function ersetzen(ziel, ...kinder) {
  ziel.replaceChildren(...kinder.flat(Infinity).filter((k) => k !== null && k !== undefined && k !== false));
}

function holen(objekt, pfad) {
  return pfad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objekt);
}

function setzen(objekt, pfad, wert) {
  const teile = pfad.split('.');
  let o = objekt;
  for (const k of teile.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[teile.at(-1)] = wert;
}

function gefuellt(v) {
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

function zeilen(text) {
  return String(text || '').split(/\r?\n/).map((z) => z.trim()).filter(Boolean);
}

function monatDe(jjjjmm) {
  const m = /^(\d{4})(?:-(\d{2}))?/.exec(jjjjmm || '');
  if (!m) return '';
  return m[2] ? `${m[2]}/${m[1]}` : m[1];
}

function datumDe(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE');
}

let speicherTimer = null;
function speichern() {
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(() => {
    try {
      if (zustand.einwilligung.speichern) localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(zustand));
      else localStorage.removeItem(SPEICHER_SCHLUESSEL);
    } catch {
      meldung('Speichern im Browser nicht möglich (Speicher voll oder gesperrt). Bitte unter „Meine Daten“ exportieren.');
    }
  }, 300);
}

function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER_SCHLUESSEL);
    if (roh) {
      const daten = JSON.parse(roh);
      if (daten?.version === 1) zustand = { ...LEER(), ...daten };
    }
  } catch {
    /* ohne gespeicherte Daten starten */
  }
}

let toastTimer = null;
function meldung(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5000);
}

async function api(pfad, body, { ki = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (ki) headers['X-KI-Einwilligung'] = zustand.einwilligung.ki ? 'ja' : 'nein';
  const antwort = await fetch(pfad, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let daten = {};
  try {
    daten = await antwort.json();
  } catch {
    /* leer */
  }
  if (!antwort.ok) {
    const fehler = new Error(daten.fehler || `Fehler ${antwort.status}`);
    fehler.code = daten.code;
    throw fehler;
  }
  return daten;
}

// --- KI-Kosten und -Aufrufe ---

function monat() {
  return new Date().toISOString().slice(0, 7);
}

function monatsKosten() {
  return zustand.kiKosten?.[monat()] || 0;
}

function dollar(betrag) {
  return `${Number(betrag || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: betrag < 0.01 ? 4 : 2 })} $`;
}

function kostenText(k) {
  if (!k) return '';
  const teile = [`${k.eingabeToken.toLocaleString('de-DE')} Token Eingabe`, `${k.ausgabeToken.toLocaleString('de-DE')} Ausgabe`];
  if (k.websuchen) teile.push(`${k.websuchen} Websuche${k.websuchen === 1 ? '' : 'n'}`);
  return `Kosten: ${k.usd != null ? `ca. ${dollar(k.usd)}` : 'unbekannt'} (${teile.join(', ')})`;
}

function kostenBuchen(kosten) {
  if (kosten?.usd == null) return;
  zustand.kiKosten ||= {};
  zustand.kiKosten[monat()] = Math.round(((zustand.kiKosten[monat()] || 0) + kosten.usd) * 10000) / 10000;
  speichern();
  statusAnzeigen();
}

// Alle KI-Aufrufe laufen hierüber: Budget-Warnung vorher, Kosten nachher verbuchen.
async function kiAufruf(pfad, body) {
  const budget = parseFloat(String(zustand.kiEinstellungen?.budget ?? '').replace(',', '.'));
  if (budget > 0 && monatsKosten() >= budget
    && !window.confirm(`Dein KI-Budget von ${dollar(budget)} für diesen Monat ist erreicht (bisher ${dollar(monatsKosten())}). Trotzdem fortfahren?`)) {
    throw new Error('Abgebrochen – Monatsbudget erreicht. Das Budget lässt sich unter „Start“ → „KI-Modus“ ändern.');
  }
  const ergebnis = await api(pfad, body, { ki: true });
  kostenBuchen(ergebnis?.kosten);
  return ergebnis;
}

const KI_EINSTELLUNGS_CODES = ['nicht-eingerichtet', 'schluessel', 'guthaben', 'websuche-aus', 'modell', 'berechtigung'];

function zuKiEinstellungen() {
  zeigeBereich('start', false);
  const karte = $('#ki-karte');
  karte.scrollIntoView({ block: 'start' });
  ($('#ki-schluessel') || karte).focus?.();
}

function fehlerElement(e, inKiKarte = false) {
  return el('div', { class: 'fehler', role: 'alert' },
    el('p', { text: e.message }),
    KI_EINSTELLUNGS_CODES.includes(e.code) && !inKiKarte ? el('p', {},
      el('button', { type: 'button', class: 'knopf klein', onclick: zuKiEinstellungen }, 'KI-Einstellungen öffnen'),
      e.code === 'guthaben' || e.code === 'websuche-aus' ? el('a', { href: 'https://platform.claude.com', target: '_blank', rel: 'noopener noreferrer', class: 'knopf zweit klein' }, 'Claude Console öffnen ↗') : null) : null);
}

async function mitLaden(knopf, ziel, fn) {
  if (knopf.getAttribute('aria-busy') === 'true') return;
  const alterText = knopf.textContent;
  knopf.setAttribute('aria-busy', 'true');
  knopf.disabled = true;
  try {
    await fn();
  } catch (e) {
    if (ziel) ersetzen(ziel, fehlerElement(e, Boolean(ziel.closest?.('#ki-karte'))));
    meldung(e.message);
  } finally {
    knopf.removeAttribute('aria-busy');
    knopf.disabled = false;
    knopf.textContent = alterText;
    kiKnoepfeAktualisieren();
  }
}

function kiMoeglich() {
  return zustand.einwilligung.ki && server.kiVerfuegbar;
}

function kiHinweisText() {
  if (!server.kiVerfuegbar) return 'KI-Modus ist noch nicht eingerichtet.';
  if (!zustand.einwilligung.ki) return 'Für KI-Funktionen fehlt noch deine Einwilligung (Haken „KI-Modus“ unter „Start“).';
  return '';
}

function kiKnoepfeAktualisieren() {
  const hinweis = kiHinweisText();
  for (const k of $$('[data-ki]')) {
    if (k.getAttribute('aria-busy') === 'true') continue;
    k.disabled = !kiMoeglich();
    k.title = hinweis;
  }
  // Sichtbarer Hinweis mit Direktlink unter jeder Knopfleiste mit KI-Funktion
  for (const leiste of $$('.aktionen')) {
    if (!leiste.querySelector('[data-ki]') || leiste.closest('#dokument-liste')) continue;
    let p = leiste.nextElementSibling;
    if (!p?.classList.contains('ki-hinweis')) {
      p = el('p', { class: 'ki-hinweis' });
      leiste.after(p);
    }
    ersetzen(p, hinweis ? [hinweis, ' ', el('button', { type: 'button', class: 'link-knopf', onclick: zuKiEinstellungen }, server.kiVerfuegbar ? 'Zu den Einstellungen' : 'Jetzt einrichten')] : null);
    p.hidden = !hinweis;
  }
}

function kiErgebnisKarte(titel, text, quellen = [], kosten = null) {
  return el('div', { class: 'karte ki-rahmen' },
    el('h2', { text: titel }),
    el('div', { class: 'markdown', html: markdownZuHtml(text) }),
    quellen.length ? el('details', {}, el('summary', { text: `Quellen (${quellen.length})` }),
      el('ul', { class: 'quellen' }, quellen.map((q) => el('li', {}, el('a', { href: q.url, target: '_blank', rel: 'noopener noreferrer', text: q.titel || q.url }))))) : null,
    el('p', { class: 'hinweis', text: 'KI-Ergebnisse können Fehler enthalten. Wichtige Angaben (Beträge, Fristen) bitte bei der offiziellen Stelle prüfen.' }),
    kosten ? el('p', { class: 'kosten', text: kostenText(kosten) }) : null);
}

// ---------------------------------------------------------------- Navigation & Status

const BEREICHE = ['start', 'unterlagen', 'interview', 'hr', 'jobs', 'leistungen', 'steuer', 'anschreiben', 'daten'];

function zeigeBereich(id, fokus = true) {
  if (!BEREICHE.includes(id)) id = 'start';
  if (id !== 'start' && !zustand.einwilligung.datenschutz) {
    meldung('Bitte zuerst die Einwilligung unter „Start“ bestätigen.');
    id = 'start';
  }
  for (const b of BEREICHE) $(`#${b}`).hidden = b !== id;
  for (const a of $$('#navigation a')) {
    if (a.dataset.ziel === id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
  if (id === 'interview') interviewRendern();
  if (id === 'jobs') jobVorschlaege();
  if (id === 'steuer') steuerAnzeigen();
  if (id === 'daten') datenuebersicht();
  if (fokus) {
    $('#inhalt').focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }
}

function statusAnzeigen() {
  const s = $('#status');
  const kiText = !server.kiVerfuegbar ? 'KI einrichten'
    : zustand.einwilligung.ki ? `KI an${monatsKosten() ? ` · ${dollar(monatsKosten())} diesen Monat` : ''}` : 'KI aus';
  const ki = el('button', { type: 'button', class: `badge badge-knopf ${server.kiVerfuegbar && zustand.einwilligung.ki ? 'ki' : ''}`, title: 'KI-Einstellungen', onclick: zuKiEinstellungen }, kiText);
  ersetzen(s, 
    el('span', { class: 'badge gruen', text: 'Lokale Verarbeitung' }),
    ki,
    el('span', { class: zustand.einwilligung.speichern ? 'badge' : 'badge warn', text: zustand.einwilligung.speichern ? 'Speichern an' : 'Nicht gespeichert' }),
  );
  $('#ki-status-hinweis').textContent = server.kiVerfuegbar
    ? `KI ist eingerichtet (${server.ki?.modellName || server.modell}).`
    : 'Für den KI-Modus muss zusätzlich oben unter „KI-Modus einrichten“ ein API-Schlüssel hinterlegt werden. Alle anderen Funktionen laufen auch ohne KI.';
  kiKnoepfeAktualisieren();
  kiKarteRendern();
}

// ---------------------------------------------------------------- 1 Start / Einwilligung

function einwilligungAnzeigen() {
  const f = $('#einwilligung-form');
  for (const name of ['datenschutz', 'speichern', 'ki', 'steuer']) f.elements[name].checked = Boolean(zustand.einwilligung[name]);
}

$('#einwilligung-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  if (!f.elements.datenschutz.checked) {
    meldung('Ohne die Pflicht-Einwilligung kann der Generator nicht arbeiten.');
    return;
  }
  for (const name of ['datenschutz', 'speichern', 'ki', 'steuer']) zustand.einwilligung[name] = f.elements[name].checked;
  if (!zustand.einwilligung.steuer) zustand.steuer = {};
  speichern();
  statusAnzeigen();
  if (zustand.einwilligung.ki && !server.kiVerfuegbar) {
    meldung('Gespeichert. Damit die KI-Funktionen laufen, jetzt noch oben den KI-Modus einrichten.');
    zuKiEinstellungen();
    return;
  }
  meldung('Einstellungen gespeichert.');
  zeigeBereich('unterlagen');
});

// ---------------------------------------------------------------- KI-Modus einrichten

let kiFormularOffen = false;
let kiTestMeldung = '';

const KOSTEN_SCHAETZUNG = [
  ['Dokument auswerten (1–2 Seiten)', '0,05–0,10 $'],
  ['HR-Einschätzung', '0,08–0,15 $'],
  ['Anschreiben schreiben', '0,05–0,08 $'],
  ['Job-Websuche (bis 8 Suchen)', '0,20–0,40 $'],
  ['Recherche Sozialleistungen (bis 10 Suchen)', '0,25–0,50 $'],
];

function kiInfoBloecke() {
  return [
    el('details', {},
      el('summary', { text: 'Was kostet das?' }),
      el('p', { class: 'hinweis', text: 'Abgerechnet wird nach Verbrauch direkt bei Anthropic (in US-Dollar). Richtwerte mit Claude Opus 5.5 – mit Sonnet 5.5 etwa die Hälfte. Die echten Kosten zeigt der Generator nach jeder Auswertung an.' }),
      el('table', {}, el('tbody', {}, KOSTEN_SCHAETZUNG.map(([was, wie]) => el('tr', {}, el('td', { text: was }), el('td', { text: wie }))))),
      el('p', { class: 'hinweis', text: 'Ein kompletter Durchlauf mit allen KI-Funktionen kostet grob 1–2 $. Websuchen kosten 1 Cent pro Suche plus die gelesenen Inhalte.' })),
    el('details', {},
      el('summary', { text: 'Datenschutz bei der KI' }),
      el('ul', { class: 'liste-sauber liste-tipp' },
        el('li', { text: 'Anthropic nutzt API-Daten nicht zum Training der Modelle.' }),
        el('li', { text: 'Anfragen werden standardmäßig nach spätestens 30 Tagen gelöscht (Ausnahme: Verstöße gegen die Nutzungsrichtlinien).' }),
        el('li', { text: 'Ein Auftragsverarbeitungsvertrag mit EU-Standardvertragsklauseln ist Teil der API-Bedingungen.' }),
        el('li', { text: 'Eine reine EU-Verarbeitung bietet Anthropic nicht an – deshalb überträgt der Generator so wenig wie möglich: keine Kontaktdaten, Dokumente im Datensparmodus nur als geschwärzter Text.' }),
        el('li', { text: 'Der Schlüssel bleibt auf diesem Rechner (Datei .env) und wird nie an den Browser zurückgegeben.' })),
      el('p', { class: 'hinweis' }, 'Details: ', el('a', { href: 'https://platform.claude.com/docs/en/manage-claude/api-and-data-retention', target: '_blank', rel: 'noopener noreferrer', text: 'Anthropic – API und Datenaufbewahrung' }))),
  ];
}

function modellAuswahl(name, gewaehlt) {
  return el('fieldset', { class: 'modellwahl' },
    el('legend', { text: 'Modell' }),
    (server.modelle || []).map((m) => {
      const input = el('input', { type: 'radio', name, value: m.id });
      input.checked = m.id === (gewaehlt || 'claude-opus-5-5');
      return el('label', { class: 'check' }, input, el('span', {},
        el('strong', { text: m.name }), ` – ${m.beschreibung}`,
        el('span', { class: 'feldhilfe', text: ` Eingabe ${m.eingabe} $ · Ausgabe ${m.ausgabe} $ je 1 Mio. Token` })));
    }));
}

function kiEinrichtungsFormular() {
  const form = el('form', { class: 'ki-formular', autocomplete: 'off' },
    el('label', { for: 'ki-schluessel' }, 'API-Schlüssel',
      el('input', { id: 'ki-schluessel', name: 'apiKey', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'sk-ant-…', required: true })),
    modellAuswahl('modell', server.ki?.modell),
    el('div', { class: 'aktionen' },
      el('button', { type: 'submit', class: 'knopf' }, 'Prüfen & speichern'),
      server.kiVerfuegbar ? el('button', { type: 'button', class: 'knopf zweit', onclick: () => { kiFormularOffen = false; kiKarteRendern(); } }, 'Abbrechen') : null),
    el('p', { class: 'hinweis', text: 'Die Prüfung ist kostenlos. Der Schlüssel wird nur auf diesem Rechner in der Datei .env gespeichert – ein Neustart ist nicht nötig.' }),
    el('div', { class: 'ki-meldung', 'aria-live': 'polite' }));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const knopf = form.querySelector('button[type=submit]');
    mitLaden(knopf, form.querySelector('.ki-meldung'), async () => {
      server = await api('/api/ki/einrichten', { apiKey: form.elements.apiKey.value.trim(), modell: form.elements.modell.value });
      form.elements.apiKey.value = '';
      kiFormularOffen = false;
      kiTestMeldung = '';
      statusAnzeigen();
      meldung(zustand.einwilligung.ki
        ? 'KI-Modus eingerichtet und bereit.'
        : 'Schlüssel gespeichert. Zum Nutzen jetzt noch unten den Haken bei „KI-Modus“ setzen und speichern.');
    });
  });
  return form;
}

function kiKarteRendern() {
  const karte = $('#ki-karte');
  if (!karte) return;
  const k = server.ki || {};

  if (!server.kiVerfuegbar || kiFormularOffen) {
    ersetzen(karte,
      el('h2', { text: server.kiVerfuegbar ? 'API-Schlüssel ändern' : 'KI-Modus einrichten (optional)' }),
      server.kiVerfuegbar ? null : el('p', { class: 'hinweis', text: 'Ohne KI laufen alle anderen Funktionen. Mit KI werden auch Scans gelesen, das Profil tiefer bewertet, das Web nach Stellen und Leistungen durchsucht und Anschreiben geschrieben.' }),
      server.kiVerfuegbar ? null : el('ol', { class: 'schritt-liste' },
        el('li', {}, 'Bei Anthropic in der ', el('a', { href: 'https://platform.claude.com', target: '_blank', rel: 'noopener noreferrer', text: 'Claude Console' }), ' ein Konto anlegen.'),
        el('li', {}, 'Unter ', el('strong', { text: 'Billing' }), ' Guthaben aufladen. Abgerechnet wird nach Verbrauch; ein Claude-Abo (Pro/Max) enthält kein API-Guthaben. Neue Konten bekommen meist ein kleines Startguthaben.'),
        el('li', {}, 'Unter ', el('strong', { text: 'Settings → API Keys' }), ' einen Schlüssel erstellen und hier einfügen.'),
        el('li', {}, 'Empfohlen: Unter ', el('strong', { text: 'Settings → Limits' }), ' ein monatliches Ausgabenlimit festlegen.')),
      kiEinrichtungsFormular(),
      kiInfoBloecke());
    return;
  }

  const testErgebnis = el('div', { class: 'ki-meldung', 'aria-live': 'polite' });
  const testKnopf = el('button', { type: 'button', class: 'knopf zweit', onclick: () => mitLaden(testKnopf, testErgebnis, async () => {
    const r = await api('/api/ki/testen', {});
    server = r.status;
    kiTestMeldung = `Verbindung in Ordnung – Antwort nach ${(r.dauerMs / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s. ${kostenText(r.kosten)}`;
    kostenBuchen(r.kosten); // zeichnet die Karte samt Meldung neu
    kiKarteRendern();
  }) }, 'Verbindung testen (< 1 Cent)');
  if (kiTestMeldung) ersetzen(testErgebnis, el('p', { class: 'info', text: kiTestMeldung }));

  const modellForm = el('form', { class: 'modell-wechsel' }, modellAuswahl('modellWechsel', k.modell),
    el('button', { type: 'submit', class: 'knopf zweit klein' }, 'Modell übernehmen'));
  modellForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const neu = modellForm.elements.modellWechsel.value;
    if (neu === k.modell) return;
    mitLaden(modellForm.querySelector('button'), testErgebnis, async () => {
      server = await api('/api/ki/modell', { modell: neu });
      statusAnzeigen();
      meldung(`Modell gewechselt: ${server.ki.modellName}`);
    });
  });

  const datensparsam = el('input', { type: 'checkbox', id: 'ki-datensparsam' });
  datensparsam.checked = zustand.kiEinstellungen?.datensparsam !== false;
  datensparsam.addEventListener('change', () => { zustand.kiEinstellungen.datensparsam = datensparsam.checked; speichern(); });
  const budget = el('input', { type: 'number', id: 'ki-budget', min: '0', step: '0.5', inputmode: 'decimal', placeholder: 'z. B. 5' });
  budget.value = zustand.kiEinstellungen?.budget ?? '';
  budget.addEventListener('input', () => { zustand.kiEinstellungen.budget = budget.value; speichern(); });

  ersetzen(karte,
    el('div', { class: 'zeile-kopf' }, el('h2', { text: 'KI-Modus' }), el('span', { class: 'badge gruen', text: 'eingerichtet' })),
    el('dl', { class: 'ki-daten' },
      el('dt', { text: 'Modell' }), el('dd', { text: k.modellName }),
      el('dt', { text: 'Schlüssel' }), el('dd', { text: `${k.schluessel}${k.quelle === 'umgebung' ? ' (aus Windows-Umgebungsvariable)' : ' (in .env gespeichert)'}` }),
      el('dt', { text: 'Websuche' }), el('dd', { text: k.websuche === true ? 'verfügbar' : k.websuche === false ? 'für dieses Modell nicht verfügbar' : 'noch nicht geprüft – „Verbindung testen“' }),
      el('dt', { text: 'Diesen Monat' }), el('dd', { text: `${dollar(monatsKosten())} (Schätzung aus den Verbrauchsdaten)` }),
      el('dt', { text: 'Einwilligung' }), el('dd', { text: zustand.einwilligung.ki ? 'erteilt' : 'fehlt noch – unten Haken bei „KI-Modus“ setzen' })),
    el('div', { class: 'aktionen' }, testKnopf,
      el('button', { type: 'button', class: 'knopf zweit', onclick: () => { kiFormularOffen = true; kiKarteRendern(); $('#ki-schluessel')?.focus(); } }, 'Schlüssel ändern'),
      el('button', { type: 'button', class: 'knopf zweit', onclick: (e) => {
        if (!window.confirm('API-Schlüssel von diesem Rechner entfernen? Die KI-Funktionen sind danach aus.')) return;
        mitLaden(e.currentTarget, testErgebnis, async () => {
          const r = await api('/api/ki/entfernen', {});
          server = r;
          kiTestMeldung = '';
          statusAnzeigen();
          meldung(r.hinweis || 'Schlüssel entfernt.');
        });
      } }, 'Schlüssel entfernen')),
    testErgebnis,
    el('details', {}, el('summary', { text: 'Modell wechseln' }), modellForm),
    el('div', { class: 'feldraster ki-optionen' },
      el('label', { class: 'check breit', for: 'ki-datensparsam' }, datensparsam, el('span', {},
        el('strong', { text: 'Datensparmodus (empfohlen): ' }),
        'Dokumente mit Textebene werden nur als Text übertragen, Name, Anschrift, Telefon, E-Mail, Geburtsdatum und IBAN vorher geschwärzt. Scans und Fotos nur nach Rückfrage.')),
      el('label', { for: 'ki-budget' }, 'Monatsbudget-Warnung (US-Dollar, optional)', budget,
        el('span', { class: 'feldhilfe', text: 'Vor jeder KI-Auswertung über diesem Betrag fragt der Generator nach. Eine harte Grenze setzt du in der Claude Console unter „Limits“.' }))),
    kiInfoBloecke());
}

// ---------------------------------------------------------------- 2 Unterlagen

function dateiAlsBase64(datei) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error(`„${datei.name}“ konnte nicht gelesen werden.`));
    r.readAsDataURL(datei);
  });
}

async function dateienHochladen(liste) {
  for (const datei of liste) {
    if (datei.size > 25 * 1024 * 1024) {
      meldung(`„${datei.name}“ ist größer als 25 MB.`);
      continue;
    }
    const id = `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const platzhalter = el('div', { class: 'karte', text: `„${datei.name}“ wird gelesen …` });
    $('#dokument-liste').prepend(platzhalter);
    try {
      const daten = await dateiAlsBase64(datei);
      const ergebnis = await api('/api/dokument', { name: datei.name, mime: datei.type, daten });
      dateien.set(id, daten);
      zustand.dokumente.unshift({
        id,
        name: ergebnis.name,
        mime: ergebnis.mime,
        groesse: datei.size,
        hochgeladen: new Date().toISOString(),
        text: (ergebnis.text || '').slice(0, MAX_TEXT),
        seiten: ergebnis.seiten,
        gescannt: ergebnis.gescannt,
        hinweise: ergebnis.hinweise || [],
        analyse: ergebnis.analyse,
        ki: null,
      });
      speichern();
    } catch (e) {
      meldung(e.message);
    } finally {
      platzhalter.remove();
      dokumenteRendern();
    }
  }
}

const ablage = $('#ablage');
$('#datei-eingabe').addEventListener('change', (e) => {
  dateienHochladen([...e.target.files]);
  e.target.value = '';
});
ablage.addEventListener('dragover', (e) => { e.preventDefault(); ablage.classList.add('ueber'); });
ablage.addEventListener('dragleave', () => ablage.classList.remove('ueber'));
ablage.addEventListener('drop', (e) => {
  e.preventDefault();
  ablage.classList.remove('ueber');
  dateienHochladen([...e.dataTransfer.files]);
});

function notenText(n) {
  return n == null ? '–' : String(n).replace('.', ',');
}

function zeugnisBlock(z) {
  return el('div', {},
    el('div', { class: 'kennzahlen' },
      el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: notenText(z.gesamtnote) }), el('div', { class: 'label', text: 'Gesamteindruck (Note, geschätzt)' })),
      el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: notenText(z.leistung?.note) }), el('div', { class: 'label', text: 'Leistung' }), z.leistung ? el('div', { class: 'zusatz', text: `„${z.leistung.formulierung}“` }) : null),
      el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: notenText(z.verhalten?.note) }), el('div', { class: 'label', text: 'Verhalten' }), z.verhalten ? el('div', { class: 'zusatz', text: `„${z.verhalten.formulierung}“` }) : null),
      z.schlussformel ? el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: z.schlussformel.bewertung }), el('div', { class: 'label', text: 'Schlussformel' })) : null),
    z.austritt ? el('p', {}, el('strong', { text: 'Austritt: ' }), z.austritt) : null,
    [...(z.hinweise || []), ...(z.warnsignale || [])].length
      ? el('ul', { class: 'liste-sauber liste-risiko' }, [...z.hinweise, ...z.warnsignale].map((t) => el('li', { text: t })))
      : el('p', { class: 'hinweis', text: 'Keine typischen Warnsignale gefunden.' }),
    el('p', { class: 'hinweis', text: 'Einschätzung anhand typischer Zeugnisformulierungen – keine Gewissheit. Bei schlechter Bewertung kannst du eine Berichtigung verlangen.' }));
}

function notenBlock(n) {
  return el('div', {},
    n.abschluss ? el('p', {}, el('strong', { text: 'Erkannter Abschluss: ' }), n.abschluss) : null,
    el('p', {}, el('strong', { text: 'Durchschnitt: ' }), n.durchschnittAngegeben != null ? `${notenText(n.durchschnittAngegeben)} (laut Zeugnis)` : n.durchschnittBerechnet != null ? `${notenText(n.durchschnittBerechnet)} (berechnet)` : 'nicht ermittelbar'),
    n.faecher?.length ? el('div', { class: 'tabelle-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Fach' }), el('th', { text: 'Note' }))),
      el('tbody', {}, n.faecher.map((f) => el('tr', {}, el('td', { text: f.fach }), el('td', { text: notenText(f.note) })))))) : null,
    n.staerken?.length ? el('p', {}, el('strong', { text: 'Stärkste Fächer: ' }), n.staerken.join(', ')) : null);
}

function lebenslaufBlock(dok) {
  const a = dok.analyse;
  return el('div', {},
    a.stationen?.length ? el('div', {},
      el('p', {}, el('strong', { text: `${a.stationen.length} Zeiträume erkannt:` })),
      el('ul', { class: 'liste-sauber liste-tipp' }, a.stationen.map((s) => el('li', { text: `${monatDe(s.von)} – ${s.laufend ? 'heute' : monatDe(s.bis)}: ${s.titel}` })))) : el('p', { text: 'Keine Zeiträume erkannt.' }),
    a.kompetenzen?.software?.length ? el('p', {}, el('strong', { text: 'Software/Tools: ' }), a.kompetenzen.software.join(', ')) : null,
    a.kompetenzen?.sprachen?.length ? el('p', {}, el('strong', { text: 'Sprachen: ' }), a.kompetenzen.sprachen.map((s) => `${s.sprache}${s.niveau ? ` (${s.niveau})` : ''}`).join(', ')) : null,
    a.agg?.length ? el('p', { class: 'info' }, `Enthält ${a.agg.join(', ')}. In Deutschland nicht nötig (AGG) – du entscheidest, ob du das angibst.`) : null,
    el('button', { type: 'button', class: 'knopf zweit klein', onclick: () => { lokalUebernehmen(dok); } }, 'Ins Profil übernehmen'));
}

function kiDokumentBlock(dok) {
  const k = dok.ki;
  const z = k.zeugnis || {};
  return el('div', { class: 'karte ki-rahmen' },
    el('h2', { text: 'KI-Auswertung' }),
    el('p', { text: k.zusammenfassung }),
    z.leistungsnote != null || z.verhaltensnote != null ? el('p', {}, el('strong', { text: 'Zeugnis: ' }), `Leistung ≈ ${notenText(z.leistungsnote)}, Verhalten ≈ ${notenText(z.verhaltensnote)}. ${z.begruendung || ''}`) : null,
    z.versteckteHinweise?.length ? el('ul', { class: 'liste-sauber liste-risiko' }, z.versteckteHinweise.map((t) => el('li', { text: t }))) : null,
    k.auffaelligkeiten?.length ? el('div', {}, el('strong', { text: 'Was Personaler bemerken würden:' }), el('ul', { class: 'liste-sauber liste-tipp' }, k.auffaelligkeiten.map((t) => el('li', { text: t })))) : null,
    el('div', { class: 'aktionen' },
      (k.stationen?.length || k.bildung?.length || k.software?.length) ? el('button', { type: 'button', class: 'knopf zweit klein', onclick: () => kiUebernehmen(dok) }, 'Ergebnisse ins Profil übernehmen') : null,
      k.rueckfragen?.length ? el('button', { type: 'button', class: 'knopf zweit klein', onclick: () => zusatzfragenHinzufuegen(k.rueckfragen.map((f) => ({ frage: f, warum: `Aus „${dok.name}“` }))) }, `${k.rueckfragen.length} Rückfragen ins Interview`) : null),
    k.uebertragen || k.kosten ? el('p', { class: 'kosten', text: [
      k.uebertragen ? `Übertragen: ${k.uebertragen.art}${k.uebertragen.zeichen ? `, ${k.uebertragen.zeichen.toLocaleString('de-DE')} Zeichen` : ''}${k.uebertragen.geschwaerzt ? `, ${k.uebertragen.geschwaerzt} Angaben geschwärzt` : ''}` : '',
      kostenText(k.kosten),
    ].filter(Boolean).join(' · ') }) : null);
}

const ARTNAMEN = { lebenslauf: 'Lebenslauf', arbeitszeugnis: 'Arbeitszeugnis', schulzeugnis: 'Schulzeugnis', hochschulzeugnis: 'Hochschulzeugnis', ausbildungszeugnis: 'Ausbildung', zertifikat: 'Zertifikat', sonstiges: 'Sonstiges' };

function dokumenteRendern() {
  const liste = $('#dokument-liste');
  ersetzen(liste);
  if (!zustand.dokumente.length) {
    liste.append(el('p', { class: 'hinweis', text: 'Noch keine Unterlagen hochgeladen.' }));
    return;
  }
  for (const dok of zustand.dokumente) {
    const a = dok.analyse || {};
    const kiKnopf = el('button', { type: 'button', class: 'knopf ki klein', 'data-ki': true }, dok.ki ? 'KI-Auswertung erneuern' : 'Mit KI auswerten');
    const kiZiel = el('div');
    kiKnopf.addEventListener('click', () => mitLaden(kiKnopf, kiZiel, async () => {
      const daten = dateien.get(dok.id);
      const datensparsam = zustand.kiEinstellungen?.datensparsam !== false;
      const hatText = !dok.gescannt && String(dok.text || '').trim().length > 40;
      if (!hatText && !daten) throw new Error('Die Originaldatei ist nach dem Neuladen nicht mehr im Speicher. Bitte erneut hochladen.');
      // Vollständige Datei verlässt den Rechner → vorher ausdrücklich fragen.
      if (!hatText || !datensparsam) {
        const grund = !hatText
          ? 'Dieses Dokument ist ein Scan oder Foto ohne lesbaren Text. Für die KI-Auswertung wird die vollständige Datei – inklusive Name, Anschrift und anderer persönlicher Angaben – an die Claude API (Anthropic, USA) übertragen.'
          : 'Der Datensparmodus ist ausgeschaltet. Die vollständige Datei wird an die Claude API (Anthropic, USA) übertragen.';
        if (!window.confirm(`${grund}\n\nFortfahren?`)) return;
      }
      const body = { name: dok.name, mime: dok.mime, datensparsam, namen: [zustand.profil.persoenlich?.vorname, zustand.profil.persoenlich?.nachname].filter(Boolean) };
      if (hatText && (datensparsam || !daten)) body.text = dok.text;
      else body.daten = daten;
      dok.ki = await kiAufruf('/api/ki/dokument', body);
      speichern();
      dokumenteRendern();
    }));
    const inhalt = [];
    if (a.arbeitszeugnis) inhalt.push(zeugnisBlock(a.arbeitszeugnis));
    if (a.noten) inhalt.push(notenBlock(a.noten));
    if (a.art?.art === 'lebenslauf') inhalt.push(lebenslaufBlock(dok));
    if (!inhalt.length && a.kompetenzen?.software?.length) inhalt.push(el('p', {}, el('strong', { text: 'Erkannte Begriffe: ' }), a.kompetenzen.software.join(', ')));

    liste.append(el('article', { class: 'karte' },
      el('div', { class: 'dok-kopf' },
        el('div', {},
          el('h3', { text: dok.name }),
          el('div', { class: 'dok-meta' },
            el('span', { class: 'badge', text: ARTNAMEN[a.art?.art] || 'Dokument' }),
            dok.seiten ? el('span', { class: 'hinweis', text: `${dok.seiten} Seite(n)` }) : null,
            dok.gescannt ? el('span', { class: 'badge warn', text: 'Scan/Foto' }) : null,
            dateien.has(dok.id) ? null : el('span', { class: 'hinweis', text: '· Original nicht mehr im Speicher' }))),
        el('div', { class: 'aktionen' }, kiKnopf,
          el('button', { type: 'button', class: 'knopf zweit klein', onclick: () => {
            zustand.dokumente = zustand.dokumente.filter((d) => d.id !== dok.id);
            dateien.delete(dok.id);
            speichern();
            dokumenteRendern();
          } }, 'Entfernen'))),
      dok.hinweise?.map((h) => el('p', { class: 'info', text: h })),
      inhalt,
      kiZiel,
      dok.ki ? kiDokumentBlock(dok) : null));
  }
  kiKnoepfeAktualisieren();
}

// Übernahme erkannter Daten ins Profil (ohne Doppelte)
function stationHinzufuegen(neu) {
  zustand.profil.stationen ||= [];
  const schluessel = (s) => `${s.von}|${String(s.position || '').toLowerCase().slice(0, 20)}`;
  if (zustand.profil.stationen.some((s) => schluessel(s) === schluessel(neu))) return false;
  zustand.profil.stationen.push(neu);
  return true;
}

function listeHinzufuegen(pfad, neu, vergleich) {
  const liste = holen(zustand.profil, pfad) || [];
  if (liste.some((e) => vergleich(e) === vergleich(neu))) return false;
  liste.push(neu);
  setzen(zustand.profil, pfad, liste);
  return true;
}

function begriffeErgaenzen(pfad, begriffe) {
  const vorhanden = String(holen(zustand.profil, pfad) || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const neu = begriffe.filter((b) => b && !vorhanden.some((v) => v.toLowerCase() === b.toLowerCase()));
  if (neu.length) setzen(zustand.profil, pfad, [...vorhanden, ...neu].join(', '));
  return neu.length;
}

const NIVEAU_MAP = { 'C1–C2': 'C1', 'A1–A2': 'A2' };

function lokalUebernehmen(dok) {
  const a = dok.analyse;
  let anzahl = 0;
  for (const s of a.stationen || []) {
    const [position, arbeitgeber] = s.titel.split(/,\s*/);
    if (s.art === 'ausbildung') {
      const [beruf, betrieb] = s.titel.replace(/^ausbildung (zum|zur|als)\s*/i, '').split(/,\s*/);
      const abschluss = /\bihk\b/i.test(s.titel) ? 'IHK' : /\bhwk\b|handwerkskammer|gesellen/i.test(s.titel) ? 'HWK' : '';
      anzahl += listeHinzufuegen('bildung.ausbildungen', { beruf, betrieb: (betrieb || '').replace(/\s*\(.*$/, ''), von: s.von, bis: s.bis, abschluss }, (e) => `${e.von}|${e.beruf}`);
    }
    else if (s.art === 'studium') anzahl += listeHinzufuegen('bildung.studium', { fach: s.titel, von: s.von, bis: s.bis }, (e) => `${e.von}|${e.fach}`);
    else if (s.art !== 'schule') anzahl += stationHinzufuegen({ position: position || s.titel, arbeitgeber: arbeitgeber || '', von: s.von, bis: s.bis, art: s.art === 'praktikum' ? 'Praktikum' : 'Vollzeit', aufgaben: s.details || '' });
  }
  if (a.kontakt?.email && !holen(zustand.profil, 'persoenlich.email')) { setzen(zustand.profil, 'persoenlich.email', a.kontakt.email); anzahl++; }
  if (a.kontakt?.telefon && !holen(zustand.profil, 'persoenlich.telefon')) { setzen(zustand.profil, 'persoenlich.telefon', a.kontakt.telefon); anzahl++; }
  anzahl += begriffeErgaenzen('kompetenzen.software', a.kompetenzen?.software || []);
  for (const sp of a.kompetenzen?.sprachen || []) {
    anzahl += listeHinzufuegen('kompetenzen.sprachen', { sprache: sp.sprache, niveau: NIVEAU_MAP[sp.niveau] || sp.niveau }, (e) => String(e.sprache).toLowerCase());
  }
  speichern();
  meldung(anzahl ? `${anzahl} Angaben ins Profil übernommen – bitte im Interview prüfen und ergänzen.` : 'Nichts Neues zu übernehmen.');
}

function kiUebernehmen(dok) {
  const k = dok.ki;
  let anzahl = 0;
  for (const s of k.stationen || []) {
    anzahl += stationHinzufuegen({ position: s.position, arbeitgeber: s.arbeitgeber, von: s.von, bis: s.bis, art: 'Vollzeit', aufgaben: s.aufgaben, erfolge: s.erfolge });
  }
  for (const b of k.bildung || []) {
    const art = `${b.art} ${b.titel}`.toLowerCase();
    if (/ausbildung|gesellen|ihk|hwk/.test(art)) anzahl += listeHinzufuegen('bildung.ausbildungen', { beruf: b.titel, betrieb: b.einrichtung, von: b.von, bis: b.bis, note: b.note }, (e) => `${e.von}|${e.beruf}`);
    else if (/studium|bachelor|master|diplom|promotion|staatsexamen/.test(art)) {
      const abschluss = ['Bachelor', 'Master', 'Diplom', 'Promotion', 'Staatsexamen'].find((x) => art.includes(x.toLowerCase())) || '';
      anzahl += listeHinzufuegen('bildung.studium', { abschluss, fach: b.titel, hochschule: b.einrichtung, von: b.von, bis: b.bis, note: b.note }, (e) => `${e.von}|${e.fach}`);
    } else if (/schul|abitur|reife/.test(art)) {
      continue;
    } else {
      anzahl += listeHinzufuegen('bildung.fortbildungen', { titel: b.titel, anbieter: b.einrichtung, art: /meister/.test(art) ? 'Meister' : /techniker/.test(art) ? 'Techniker' : /fachwirt/.test(art) ? 'Fachwirt' : 'Zertifikat', jahr: parseInt(b.bis || b.von, 10) || '' }, (e) => String(e.titel).toLowerCase());
    }
  }
  anzahl += begriffeErgaenzen('kompetenzen.fachlich', k.fachkenntnisse || []);
  anzahl += begriffeErgaenzen('kompetenzen.software', k.software || []);
  for (const sp of k.sprachen || []) anzahl += listeHinzufuegen('kompetenzen.sprachen', { sprache: sp.sprache, niveau: sp.niveau }, (e) => String(e.sprache).toLowerCase());
  speichern();
  meldung(anzahl ? `${anzahl} Angaben übernommen – bitte im Interview prüfen.` : 'Nichts Neues zu übernehmen.');
}

// ---------------------------------------------------------------- 3 Interview

function feldElement(def, wert, onAenderung, id) {
  const attrs = { id, name: id, autocomplete: def.auto || 'off' };
  let eingabe;
  if (def.typ === 'select') {
    eingabe = el('select', attrs, def.optionen.map(([w, l]) => el('option', { value: w, text: l })));
    eingabe.value = wert ?? '';
  } else if (def.typ === 'textarea') {
    eingabe = el('textarea', { ...attrs, rows: 3 });
    eingabe.value = wert ?? '';
  } else {
    eingabe = el('input', { ...attrs, type: def.typ, inputmode: def.typ === 'number' ? 'decimal' : undefined });
    eingabe.value = wert ?? '';
  }
  eingabe.addEventListener(def.typ === 'select' ? 'change' : 'input', () => onAenderung(eingabe.value));
  return el('label', { class: def.typ === 'textarea' ? 'breit' : undefined, 'data-pfad': id }, def.label, eingabe,
    def.hilfe ? el('span', { class: 'feldhilfe', text: def.hilfe }) : null);
}

function listeRendern(liste, wurzel) {
  const daten = holen(wurzel, liste.pfad) || [];
  const box = el('div', { class: 'breit' });
  const neuZeichnen = () => box.replaceWith(listeRendern(liste, wurzel));
  daten.forEach((eintrag, i) => {
    box.append(el('fieldset', { class: 'eintrag' },
      el('legend', { class: 'visually-hidden', text: `${liste.eintrag} ${i + 1}` }),
      el('div', { class: 'eintrag-kopf' },
        el('span', { text: `${liste.eintrag} ${i + 1}${eintrag.position || eintrag.beruf || eintrag.fach || eintrag.titel || eintrag.sprache ? ` – ${eintrag.position || eintrag.beruf || eintrag.fach || eintrag.titel || eintrag.sprache}` : ''}` }),
        el('button', { type: 'button', class: 'knopf zweit klein', onclick: () => { daten.splice(i, 1); speichern(); neuZeichnen(); interviewFortschritt(); } }, 'Entfernen')),
      el('div', { class: 'feldraster' }, liste.felder.map((f) => feldElement(f, eintrag[f.feld], (v) => { eintrag[f.feld] = v; speichern(); interviewFortschritt(); }, `${liste.pfad}.${i}.${f.feld}`)))));
  });
  box.append(el('button', { type: 'button', class: 'knopf zweit', onclick: () => {
    setzen(wurzel, liste.pfad, [...daten, {}]);
    speichern();
    neuZeichnen();
  } }, `+ ${liste.eintrag} hinzufügen`));
  return box;
}

function modulFortschritt(modul) {
  const felder = (modul.felder || []).map((f) => holen(zustand.profil, f.pfad));
  const listen = [modul.liste, ...(modul.listen || [])].filter(Boolean).map((l) => holen(zustand.profil, l.pfad));
  const alle = [...felder, ...listen];
  if (!alle.length) return 0;
  return Math.round((alle.filter(gefuellt).length / alle.length) * 100);
}

function interviewFortschritt() {
  const werte = INTERVIEW.map(modulFortschritt);
  const gesamt = Math.round(werte.reduce((a, b) => a + b, 0) / werte.length);
  $('#interview-fortschritt').value = gesamt;
  $('#interview-fortschritt-text').textContent = `${gesamt} % ausgefüllt`;
  INTERVIEW.forEach((m, i) => {
    const b = $(`#modul-${m.id} .modul-stand`);
    if (b) b.textContent = `${werte[i]} %`;
  });
}

function interviewRendern() {
  const box = $('#interview-module');
  const offen = new Set($$('details.modul[open]', box).map((d) => d.id));
  ersetzen(box, ...INTERVIEW.map((modul, i) => {
    const inhalt = el('div', { class: 'modul-inhalt' },
      el('p', { class: 'hinweis', text: modul.intro }),
      modul.felder ? el('div', { class: 'feldraster' }, modul.felder.map((f) => feldElement(f, holen(zustand.profil, f.pfad), (v) => { setzen(zustand.profil, f.pfad, v); speichern(); interviewFortschritt(); }, f.pfad))) : null,
      modul.liste ? listeRendern(modul.liste, zustand.profil) : null,
      (modul.listen || []).map((l) => el('div', {}, el('h3', { text: l.titel }), listeRendern(l, zustand.profil))));
    const d = el('details', { class: 'modul', id: `modul-${modul.id}`, open: offen.size ? offen.has(`modul-${modul.id}`) : i === 0 },
      el('summary', {}, el('span', { text: `${i + 1}. ${modul.titel}` }), el('span', { class: 'badge modul-stand', text: '0 %' })),
      inhalt);
    return d;
  }));
  zusatzfragenRendern();
  interviewFortschritt();
}

function zusatzfragenHinzufuegen(fragen) {
  zustand.profil.zusatzfragen ||= [];
  let neu = 0;
  for (const f of fragen) {
    if (!f.frage || zustand.profil.zusatzfragen.some((z) => z.frage === f.frage)) continue;
    zustand.profil.zusatzfragen.push({ frage: f.frage, warum: f.warum || '', antwort: '' });
    neu++;
  }
  speichern();
  meldung(neu ? `${neu} Rückfragen im Profil-Interview ergänzt.` : 'Diese Rückfragen sind schon im Interview.');
}

function zusatzfragenRendern() {
  const fragen = zustand.profil.zusatzfragen || [];
  $('#zusatzfragen-karte').hidden = !fragen.length;
  ersetzen($('#zusatzfragen'), ...fragen.map((f, i) => {
    const t = el('textarea', { rows: 3, id: `zusatzfrage-${i}` });
    t.value = f.antwort || '';
    t.addEventListener('input', () => { f.antwort = t.value; speichern(); });
    return el('div', { class: 'eintrag' },
      el('label', { for: `zusatzfrage-${i}` }, f.frage, f.warum ? el('span', { class: 'feldhilfe', text: f.warum }) : null),
      t,
      el('button', { type: 'button', class: 'knopf zweit klein', onclick: () => { fragen.splice(i, 1); speichern(); zusatzfragenRendern(); } }, 'Frage entfernen'));
  }));
}

function zuFeld(pfad) {
  zeigeBereich('interview', false);
  const modul = INTERVIEW.find((m) => pfad.startsWith(m.liste?.pfad || '§') || (m.felder || []).some((f) => f.pfad === pfad) || pfad.split('.')[0] === m.id);
  if (modul) $(`#modul-${modul.id}`).open = true;
  const ziel = $(`[data-pfad="${CSS.escape(pfad)}"] :is(input, select, textarea)`) || $(`#modul-${modul?.id}`);
  ziel?.scrollIntoView({ block: 'center' });
  if (ziel?.focus) ziel.focus({ preventScroll: true });
}

// ---------------------------------------------------------------- 4 HR-Profil

function dokumenteFuerAnalyse() {
  return zustand.dokumente.map((d) => ({ analyse: d.analyse, gescannt: d.gescannt }));
}

function hrRendern() {
  const r = zustand.ergebnisse.hr;
  const ziel = $('#hr-ergebnis');
  if (!r) { ersetzen(ziel); return; }
  const k = r.kategorisierung;
  ersetzen(ziel, 
    el('div', { class: 'karte' },
      el('h2', { text: 'Einordnung' }),
      el('div', { class: 'kennzahlen' },
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: k.anforderungsniveau.name }), el('div', { class: 'label', text: 'Anforderungsniveau (Raster der Arbeitsagentur)' }), el('div', { class: 'zusatz', text: k.anforderungsniveau.text })),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: k.senioritaet.stufe }), el('div', { class: 'label', text: 'Seniorität' }), el('div', { class: 'zusatz', text: k.senioritaet.fuehrung })),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: `${String(r.erfahrung.jahre).replace('.', ',')} J.` }), el('div', { class: 'label', text: 'Berufserfahrung' }), el('div', { class: 'zusatz', text: r.erfahrung.durchschnittMonate ? `Ø ${r.erfahrung.durchschnittMonate} Monate je Station` : '' })),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: k.hoechsterAbschluss ? `DQR ${k.hoechsterAbschluss.dqr}` : '–' }), el('div', { class: 'label', text: 'Höchster Abschluss' }), el('div', { class: 'zusatz', text: k.hoechsterAbschluss?.titel || 'nicht angegeben' })),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: k.berufsbereiche[0] ? `KldB ${k.berufsbereiche[0].kldb}` : '–' }), el('div', { class: 'label', text: 'Berufsbereich' }), el('div', { class: 'zusatz', text: k.berufsbereiche.map((b) => b.name).join(' · ') || 'unklar – Wunschposition angeben' })),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: r.zeugnisse.durchschnittNote ? `≈ ${notenText(r.zeugnisse.durchschnittNote)}` : '–' }), el('div', { class: 'label', text: `Arbeitszeugnisse (${r.zeugnisse.anzahl})` })),
        el('div', { class: 'kennzahl' }, el('div', { class: 'wert', text: `${r.vollstaendigkeit} %` }), el('div', { class: 'label', text: 'Profil vollständig' }))),
      el('p', { class: 'hinweis', text: k.anforderungsniveau.gruende.join(' · ') })),
    el('div', { class: 'karten zwei' },
      el('div', { class: 'karte' }, el('h2', { text: 'Stärken' }), r.staerken.length ? el('ul', { class: 'liste-sauber liste-ok' }, r.staerken.map((t) => el('li', { text: t }))) : el('p', { class: 'hinweis', text: 'Noch zu wenige Angaben.' })),
      el('div', { class: 'karte' }, el('h2', { text: 'Worauf Personaler achten werden' }), r.risiken.length ? el('ul', { class: 'liste-sauber liste-risiko' }, r.risiken.map((t) => el('li', { text: t }))) : el('p', { class: 'hinweis', text: 'Keine auffälligen Risiken gefunden.' }))),
    r.tipps.length ? el('div', { class: 'karte' }, el('h2', { text: 'Tipps' }), el('ul', { class: 'liste-sauber liste-tipp' }, r.tipps.map((t) => el('li', { text: t })))) : null,
    el('div', { class: 'karte' }, el('h2', { text: 'ATS-Check (Bewerbermanagement-Software)' }), el('ul', { class: 'liste-sauber ats' }, r.ats.map((a) => el('li', { class: a.ok ? 'ok' : 'nein', text: a.text })))),
    r.fehlendeAngaben.length ? el('div', { class: 'karte' },
      el('h2', { text: 'Diese Angaben fehlen noch' }),
      el('p', { class: 'hinweis', text: 'Je vollständiger, desto genauer die Einordnung. Klick führt direkt zur Frage.' }),
      el('ul', { class: 'liste-sauber liste-tipp' }, r.fehlendeAngaben.slice(0, 15).map((f) => el('li', {},
        el('a', { href: '#interview', onclick: (e) => { e.preventDefault(); zuFeld(f.pfad); } }, f.label), ` – ${f.warum}`)))) : null,
    el('p', { class: 'hinweis', text: `Ausgewertet am ${datumDe(r.erstellt)}. Alter, Geschlecht, Herkunft, Religion, Gesundheit und andere geschützte Merkmale fließen nicht ein.` }));
}

function hrKiRendern() {
  const r = zustand.ergebnisse.hrKi;
  const ziel = $('#hr-ki-ergebnis');
  if (!r) { ersetzen(ziel); return; }
  ersetzen(ziel, el('div', { class: 'karte ki-rahmen' },
    el('h2', { text: 'Tiefere Einschätzung' }),
    el('p', { text: r.gesamtbild }),
    r.einordnung?.length ? el('div', { class: 'tabelle-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', { text: 'Merkmal' }), el('th', { text: 'Einschätzung' }), el('th', { text: 'Warum' }))),
      el('tbody', {}, r.einordnung.map((e) => el('tr', {}, el('td', { text: e.merkmal }), el('td', { text: e.einschaetzung }), el('td', { text: e.begruendung })))))) : null,
    el('div', { class: 'karten zwei' },
      el('div', {}, el('h3', { text: 'Stärken' }), el('ul', { class: 'liste-sauber liste-ok' }, (r.staerken || []).map((t) => el('li', { text: t })))),
      el('div', {}, el('h3', { text: 'Risiken' }), el('ul', { class: 'liste-sauber liste-risiko' }, (r.risiken || []).map((t) => el('li', { text: t }))))),
    r.passendeRollen?.length ? el('div', {}, el('h3', { text: 'Passende Rollen' }),
      el('ul', { class: 'liste-sauber liste-tipp' }, r.passendeRollen.map((p) => el('li', {}, el('strong', { text: p.titel }), ` – ${p.begruendung} `,
        el('button', { type: 'button', class: 'chip', onclick: () => { zeigeBereich('jobs'); $('#job-form').elements.was.value = p.suchbegriff || p.titel; } }, `Suchen: ${p.suchbegriff || p.titel}`))))) : null,
    r.gehalt ? el('p', {}, el('strong', { text: 'Gehalt (Schätzung): ' }), r.gehalt) : null,
    r.atsSchluesselwoerter?.length ? el('p', {}, el('strong', { text: 'Schlüsselwörter für Lebenslauf & ATS: ' }), r.atsSchluesselwoerter.join(', ')) : null,
    r.naechsteSchritte?.length ? el('div', {}, el('h3', { text: 'Nächste Schritte' }), el('ol', {}, r.naechsteSchritte.map((t) => el('li', { text: t })))) : null,
    r.rueckfragen?.length ? el('div', { class: 'info' },
      el('p', {}, el('strong', { text: `${r.rueckfragen.length} Rückfragen für ein noch genaueres Bild` })),
      el('ul', {}, r.rueckfragen.map((f) => el('li', { text: f.frage }))),
      el('button', { type: 'button', class: 'knopf klein', onclick: () => { zusatzfragenHinzufuegen(r.rueckfragen); zeigeBereich('interview'); } }, 'Im Interview beantworten')) : null,
    el('p', { class: 'hinweis', text: 'KI-Einschätzung – kann irren. Gehaltsangaben sind grobe Schätzungen.' }),
    r.kosten ? el('p', { class: 'kosten', text: kostenText(r.kosten) }) : null));
}

$('#hr-start').addEventListener('click', (e) => mitLaden(e.currentTarget, $('#hr-ergebnis'), async () => {
  zustand.ergebnisse.hr = await api('/api/hr', { profil: zustand.profil, dokumente: dokumenteFuerAnalyse() });
  speichern();
  hrRendern();
}));

$('#hr-ki').addEventListener('click', (e) => mitLaden(e.currentTarget, $('#hr-ki-ergebnis'), async () => {
  const lokal = zustand.ergebnisse.hr || await api('/api/hr', { profil: zustand.profil, dokumente: dokumenteFuerAnalyse() });
  zustand.ergebnisse.hr = lokal;
  hrRendern();
  zustand.ergebnisse.hrKi = await kiAufruf('/api/ki/hr', {
    profil: zustand.profil,
    lokaleAnalyse: { ...lokal, fehlendeAngaben: undefined },
    dokumentZusammenfassungen: zustand.dokumente.map((d) => ({ art: d.analyse?.art?.name, zusammenfassung: d.ki?.zusammenfassung || '', zeugnisnote: d.analyse?.arbeitszeugnis?.gesamtnote ?? null })),
  });
  speichern();
  hrKiRendern();
}));

// ---------------------------------------------------------------- 5 Jobs

let jobSeite = 1;

function jobVorschlaege() {
  const f = $('#job-form');
  const positionen = zeilen(zustand.profil.wunsch?.positionen);
  if (!f.elements.was.value && positionen[0]) f.elements.was.value = positionen[0];
  if (!f.elements.wo.value) f.elements.wo.value = zustand.profil.persoenlich?.ort || zustand.profil.persoenlich?.plz || '';
  if (zustand.profil.wunsch?.arbeitszeit && ['vollzeit', 'teilzeit', 'minijob'].includes(zustand.profil.wunsch.arbeitszeit) && !f.elements.arbeitszeit.value) f.elements.arbeitszeit.value = zustand.profil.wunsch.arbeitszeit;
  const vorschlaege = [...new Set([...positionen, ...(zustand.ergebnisse.hrKi?.passendeRollen || []).map((r) => r.suchbegriff || r.titel)])].slice(0, 10);
  ersetzen($('#job-vorschlaege'), ...vorschlaege.map((v) => el('button', { type: 'button', class: 'chip', onclick: () => { f.elements.was.value = v; f.requestSubmit(); } }, v)));
  if (zustand.ergebnisse.jobs) jobsRendern(zustand.ergebnisse.jobs);
  if (zustand.ergebnisse.jobsKi) ersetzen($('#job-ki-ergebnis'), kiErgebnisKarte('Weitere Stellen aus dem Web', zustand.ergebnisse.jobsKi.text, zustand.ergebnisse.jobsKi.quellen, zustand.ergebnisse.jobsKi.kosten));
}

function jobParameter() {
  const f = $('#job-form').elements;
  return { was: f.was.value.trim(), wo: f.wo.value.trim(), umkreis: f.umkreis.value, arbeitszeit: f.arbeitszeit.value, angebotsart: f.angebotsart.value, tage: f.tage.value, zeitarbeit: f.ohneZeitarbeit.checked ? false : undefined };
}

function profilFuerPassung() {
  const p = zustand.profil;
  return { wunsch: { positionen: p.wunsch?.positionen }, stationen: (p.stationen || []).map((s) => ({ position: s.position })), kompetenzen: { fachlich: p.kompetenzen?.fachlich, software: p.kompetenzen?.software } };
}

function jobsRendern(ergebnis) {
  const ziel = $('#job-ergebnis');
  const mehr = ergebnis.treffer.length < ergebnis.gesamt
    ? el('button', { type: 'button', class: 'knopf zweit', onclick: (e) => mitLaden(e.currentTarget, null, async () => {
      jobSeite += 1;
      const weitere = await api('/api/jobs', { parameter: { ...jobParameter(), seite: jobSeite }, profil: profilFuerPassung() });
      ergebnis.treffer.push(...weitere.treffer);
      speichern();
      jobsRendern(ergebnis);
    }) }, 'Weitere laden') : null;
  ersetzen(ziel, el('div', { class: 'karte' },
    el('h2', { text: `${ergebnis.gesamt.toLocaleString('de-DE')} Stellen gefunden` }),
    el('p', { class: 'hinweis', text: `Quelle: ${ergebnis.quelle}. „Passung“ vergleicht Stellentitel mit deinem Profil – eine grobe Orientierung.` }),
    ergebnis.treffer.length ? ergebnis.treffer.map((j) => el('article', { class: 'job' },
      el('h3', {}, j.link ? el('a', { href: j.link, target: '_blank', rel: 'noopener noreferrer', text: j.titel }) : j.titel),
      el('div', { class: 'meta', text: [j.arbeitgeber, j.ort, j.entfernung, j.veroeffentlicht ? `seit ${datumDe(j.veroeffentlicht)}` : '', j.eintritt ? `Eintritt ${datumDe(j.eintritt)}` : ''].filter(Boolean).join(' · ') }),
      j.passung != null ? el('div', { class: 'passung' }, 'Passung', el('meter', { min: 0, max: 100, value: j.passung, low: 34, high: 67, optimum: 100 }), `${j.passung} %`) : null,
      el('div', { class: 'aktionen' }, el('button', { type: 'button', class: 'knopf zweit klein', onclick: () => anschreibenVorbereiten(j) }, 'Anschreiben vorbereiten')))) : el('p', { text: 'Keine Treffer – Suchbegriff allgemeiner fassen oder Umkreis vergrößern.' }),
    mehr));
}

$('#job-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const knopf = $('#job-form button[type=submit]');
  mitLaden(knopf, $('#job-ergebnis'), async () => {
    jobSeite = 1;
    zustand.ergebnisse.jobs = await api('/api/jobs', { parameter: jobParameter(), profil: profilFuerPassung() });
    speichern();
    jobsRendern(zustand.ergebnisse.jobs);
  });
});

$('#jobs-ki').addEventListener('click', (e) => mitLaden(e.currentTarget, $('#job-ki-ergebnis'), async () => {
  const p = jobParameter();
  if (!p.was) throw new Error('Bitte eine Wunschposition eintragen.');
  const hr = zustand.ergebnisse.hr;
  const profilKurz = [
    hr ? `${hr.erfahrung.jahre} Jahre Berufserfahrung, ${hr.kategorisierung.anforderungsniveau.name}, ${hr.kategorisierung.senioritaet.stufe}` : '',
    (zustand.profil.stationen || []).slice(0, 3).map((s) => s.position).filter(Boolean).join(', '),
    String(zustand.profil.kompetenzen?.fachlich || '').slice(0, 300),
    zustand.profil.wunsch?.homeoffice ? `Homeoffice: ${zustand.profil.wunsch.homeoffice}` : '',
  ].filter(Boolean).join(' | ');
  zustand.ergebnisse.jobsKi = await kiAufruf('/api/ki/jobs', { was: p.was, wo: p.wo, profilKurz });
  speichern();
  ersetzen($('#job-ki-ergebnis'), kiErgebnisKarte('Weitere Stellen aus dem Web', zustand.ergebnisse.jobsKi.text, zustand.ergebnisse.jobsKi.quellen, zustand.ergebnisse.jobsKi.kosten));
}));

function anschreibenVorbereiten(job) {
  zeigeBereich('anschreiben');
  const t = $('#anschreiben-form').elements.stellenanzeige;
  t.value = `${job.titel}\n${job.arbeitgeber}\n${job.ort}\n${job.link}\n\n[Hier bitte den vollständigen Text der Stellenanzeige einfügen – Aufgaben und Anforderungen.]`;
  t.focus();
}

// ---------------------------------------------------------------- Formular-Raster für Situation & Steuer

function rasterRendern(container, felder, objekt) {
  ersetzen(container, ...felder.map((f) => feldElement(f, objekt[f.pfad], (v) => { objekt[f.pfad] = v; speichern(); }, `${container.id}-${f.pfad}`)));
}

// ---------------------------------------------------------------- 6 Leistungen

const STATUS_TEXT = { dringend: ['Frist beachten', 'rot'], wahrscheinlich: ['Wahrscheinlich', 'gruen'], pruefen: ['Prüfen lohnt sich', ''], 'eher-nicht': ['Eher nicht', 'warn'], hinweis: ['Tipp', 'ki'] };

function leistungenRendern() {
  const r = zustand.ergebnisse.leistungen;
  const ziel = $('#leistungen-ergebnis');
  if (!r) { ersetzen(ziel); return; }
  ersetzen(ziel, 
    r.bedarfSchaetzung ? el('p', { class: 'hinweis', text: `Grob geschätzter monatlicher Bedarf deines Haushalts (Regelbedarfe + Warmmiete): ca. ${r.bedarfSchaetzung.toLocaleString('de-DE')} € – nur zur Orientierung.` }) : null,
    ...r.ergebnisse.map((l) => {
      const [text, farbe] = STATUS_TEXT[l.status] || ['', ''];
      const link = l.link ? el('a', { href: l.link, target: '_blank', rel: 'noopener noreferrer', text: new URL(l.link).hostname.replace(/^www\./, '') })
        : l.portal ? el('span', {}, el('a', { href: l.portal, target: '_blank', rel: 'noopener noreferrer', text: new URL(l.portal).hostname.replace(/^www\./, '') }), ` – dort nach „${l.suchbegriff}“ suchen`) : null;
      return el('article', { class: `karte leistung s-${l.status}` },
        el('div', { class: 'zeile' }, el('h3', { text: l.name }), el('span', { class: `badge ${farbe}`, text })),
        el('p', { text: l.kurz }),
        el('dl', {},
          l.gruende?.length ? [el('dt', { text: 'Warum' }), el('dd', { text: l.gruende.join(' ') })] : null,
          l.frist ? [el('dt', { text: 'Frist' }), el('dd', {}, el('strong', { text: l.frist }))] : null,
          l.wo ? [el('dt', { text: 'Wo' }), el('dd', { text: l.wo })] : null,
          link ? [el('dt', { text: 'Info' }), el('dd', {}, link)] : null));
    }),
    el('p', { class: 'hinweis', text: 'Vorprüfung ohne Gewähr. Den Anspruch prüft die zuständige Stelle – im Zweifel immer beantragen, ein Antrag kostet nichts. Ablehnungen kann man mit Widerspruch anfechten (meist innerhalb eines Monats).' }));
}

$('#situation-form').addEventListener('submit', (e) => {
  e.preventDefault();
  mitLaden($('#situation-form button[type=submit]'), $('#leistungen-ergebnis'), async () => {
    zustand.ergebnisse.leistungen = await api('/api/leistungen', { situation: zustand.situation });
    speichern();
    leistungenRendern();
  });
});

$('#leistungen-ki').addEventListener('click', (e) => mitLaden(e.currentTarget, $('#leistungen-ki-ergebnis'), async () => {
  const lokal = zustand.ergebnisse.leistungen || await api('/api/leistungen', { situation: zustand.situation });
  zustand.ergebnisse.leistungen = lokal;
  leistungenRendern();
  zustand.ergebnisse.leistungenKi = await kiAufruf('/api/ki/leistungen', { situation: zustand.situation, lokaleErgebnisse: lokal.ergebnisse.map((l) => ({ name: l.name })) });
  speichern();
  ersetzen($('#leistungen-ki-ergebnis'), kiErgebnisKarte('Recherche: Leistungen, Beträge & Erfahrungen', zustand.ergebnisse.leistungenKi.text, zustand.ergebnisse.leistungenKi.quellen, zustand.ergebnisse.leistungenKi.kosten));
}));

// ---------------------------------------------------------------- 7 Steuer

function steuerAnzeigen() {
  const frei = zustand.einwilligung.steuer;
  $('#steuer-gesperrt').hidden = frei;
  $('#steuer-bereich').hidden = !frei;
  $('#steuer-freigabe').checked = frei;
  if (frei) {
    rasterRendern($('#steuer-felder'), STEUER, zustand.steuer);
    steuerRendern();
    if (zustand.ergebnisse.steuerKi) ersetzen($('#steuer-ki-ergebnis'), kiErgebnisKarte('Steuer-Check mit aktuellen Werten', zustand.ergebnisse.steuerKi.text, zustand.ergebnisse.steuerKi.quellen, zustand.ergebnisse.steuerKi.kosten));
  }
}

$('#steuer-freigabe').addEventListener('change', (e) => {
  zustand.einwilligung.steuer = e.target.checked;
  einwilligungAnzeigen();
  speichern();
  steuerAnzeigen();
});

function steuerRendern() {
  const r = zustand.ergebnisse.steuer;
  const ziel = $('#steuer-ergebnis');
  if (!r) { ersetzen(ziel); return; }
  const w = r.werbungskosten;
  ersetzen(ziel, 
    el('div', { class: 'karte' },
      el('h2', { text: 'Werbungskosten-Schnellcheck' }),
      w.posten.length ? el('div', { class: 'tabelle-scroll' }, el('table', {},
        el('tbody', {}, w.posten.map((p) => el('tr', {}, el('td', { text: p.name }), el('td', { text: `${p.betrag.toLocaleString('de-DE')} €` }))),
          el('tr', {}, el('th', { text: 'Summe' }), el('th', { text: `${w.summe.toLocaleString('de-DE')} €` }))))) : null,
      el('p', { class: 'info', text: w.fazit })),
    ...r.tipps.map((t) => el('article', { class: `karte leistung ${t.wichtig ? 's-dringend' : 's-pruefen'}` }, el('h3', { text: t.titel }), el('p', { text: t.text }))),
    el('p', { class: 'hinweis', text: `Stand ${r.stand}. Allgemeine Hinweise, keine Steuerberatung.` }));
}

$('#steuer-form').addEventListener('submit', (e) => {
  e.preventDefault();
  mitLaden($('#steuer-form button[type=submit]'), $('#steuer-ergebnis'), async () => {
    zustand.ergebnisse.steuer = await api('/api/steuer', { einwilligung: zustand.einwilligung.steuer, steuer: zustand.steuer, situation: zustand.situation });
    speichern();
    steuerRendern();
  });
});

$('#steuer-ki').addEventListener('click', (e) => mitLaden(e.currentTarget, $('#steuer-ki-ergebnis'), async () => {
  const lokal = zustand.ergebnisse.steuer || await api('/api/steuer', { einwilligung: zustand.einwilligung.steuer, steuer: zustand.steuer, situation: zustand.situation });
  zustand.ergebnisse.steuer = lokal;
  steuerRendern();
  zustand.ergebnisse.steuerKi = await kiAufruf('/api/ki/steuer', { einwilligung: zustand.einwilligung.steuer, steuer: zustand.steuer, situation: { erwerbsstatus: zustand.situation.erwerbsstatus, anzahlKinder: zustand.situation.anzahlKinder }, lokaleTipps: lokal.tipps.map((t) => ({ titel: t.titel })) });
  speichern();
  ersetzen($('#steuer-ki-ergebnis'), kiErgebnisKarte('Steuer-Check mit aktuellen Werten', zustand.ergebnisse.steuerKi.text, zustand.ergebnisse.steuerKi.quellen, zustand.ergebnisse.steuerKi.kosten));
}));

// ---------------------------------------------------------------- 8 Anschreiben & Lebenslauf

function name() {
  return [zustand.profil.persoenlich?.vorname, zustand.profil.persoenlich?.nachname].filter(Boolean).join(' ');
}

function anschreibenRendern() {
  const r = zustand.ergebnisse.anschreiben;
  const ziel = $('#anschreiben-ergebnis');
  if (!r) { ersetzen(ziel); return; }
  const betreff = el('input', { type: 'text', id: 'as-betreff' });
  betreff.value = r.betreff || '';
  const text = el('textarea', { rows: 18, id: 'as-text' });
  text.value = r.anschreiben || '';
  betreff.addEventListener('input', () => { r.betreff = betreff.value; speichern(); });
  text.addEventListener('input', () => { r.anschreiben = text.value; speichern(); });
  ersetzen(ziel, el('div', { class: `karte ${r.quelle === 'ki' ? 'ki-rahmen' : ''}` },
    el('h2', { text: r.quelle === 'ki' ? 'Anschreiben (Entwurf)' : 'Anschreiben-Vorlage' }),
    el('label', { for: 'as-betreff' }, 'Betreff', betreff),
    el('label', { for: 'as-text' }, 'Text (bearbeitbar)', text),
    r.hinweise?.length ? el('ul', { class: 'liste-sauber liste-tipp' }, r.hinweise.map((h) => el('li', { text: h }))) : null,
    r.kosten ? el('p', { class: 'kosten', text: kostenText(r.kosten) }) : null,
    el('div', { class: 'aktionen' },
      el('button', { type: 'button', class: 'knopf zweit', onclick: async () => {
        try {
          await navigator.clipboard.writeText(`${betreff.value}\n\n${text.value}`);
          meldung('In die Zwischenablage kopiert.');
        } catch {
          text.select();
          meldung('Kopieren nicht erlaubt – Text ist markiert, bitte Strg+C drücken.');
        }
      } }, 'Kopieren'),
      el('button', { type: 'button', class: 'knopf zweit', onclick: () => herunterladen(`anschreiben-${new Date().toISOString().slice(0, 10)}.txt`, `${betreff.value}\n\n${text.value}\n`, 'text/plain') }, 'Als Textdatei speichern'))));
}

$('#anschreiben-form').addEventListener('submit', (e) => {
  e.preventDefault();
  mitLaden($('#anschreiben-form button[type=submit]'), $('#anschreiben-ergebnis'), async () => {
    const r = await api('/api/anschreiben', { profil: zustand.profil, stellenanzeige: e.target.elements.stellenanzeige.value });
    zustand.ergebnisse.anschreiben = { ...r, quelle: 'vorlage' };
    speichern();
    anschreibenRendern();
  });
});

$('#anschreiben-ki').addEventListener('click', (e) => mitLaden(e.currentTarget, $('#anschreiben-ergebnis'), async () => {
  const f = $('#anschreiben-form').elements;
  const r = await kiAufruf('/api/ki/anschreiben', { profil: zustand.profil, stellenanzeige: f.stellenanzeige.value, hinweise: f.hinweise.value });
  // Der Name wurde nicht an die KI geschickt – hier lokal einsetzen.
  r.anschreiben = String(r.anschreiben || '').replaceAll('[Name]', name() || '[Name]');
  zustand.ergebnisse.anschreiben = { ...r, quelle: 'ki' };
  speichern();
  anschreibenRendern();
}));

function zeitraum(von, bis) {
  return `${monatDe(von) || '?'} – ${bis ? monatDe(bis) : 'heute'}`;
}

function lebenslaufErzeugen() {
  const p = zustand.profil;
  const pers = p.persoenlich || {};
  const abschnitt = (titel, inhalt) => (inhalt && (!Array.isArray(inhalt) || inhalt.length) ? [el('h2', { text: titel }), inhalt] : null);
  const zeile = (zeit, titel, unter, punkte = []) => el('div', { class: 'cv-zeile' },
    el('div', { class: 'cv-zeit', text: zeit }),
    el('div', {}, el('strong', { text: titel }), unter ? el('div', { text: unter }) : null, punkte.length ? el('ul', {}, punkte.map((t) => el('li', { text: t }))) : null));

  const stationen = [...(p.stationen || [])].sort((a, b) => String(b.von || '').localeCompare(String(a.von || '')));
  const ausbildung = [
    ...(p.bildung?.studium || []).map((s) => ({ von: s.von, bis: s.bis, titel: [s.abschluss, s.fach].filter(Boolean).join(' '), unter: [s.hochschule, s.note ? `Note ${s.note}` : ''].filter(Boolean).join(' · ') })),
    ...(p.bildung?.ausbildungen || []).map((a) => ({ von: a.von, bis: a.bis, titel: `Ausbildung: ${a.beruf || ''}`, unter: [a.betrieb, a.abschluss, a.note ? `Note ${a.note}` : ''].filter(Boolean).join(' · ') })),
  ].sort((a, b) => String(b.von || '').localeCompare(String(a.von || '')));
  const sprachen = (p.kompetenzen?.sprachen || []).filter((s) => s.sprache).map((s) => `${s.sprache}${s.niveau ? ` (${s.niveau})` : ''}`);

  const cv = el('article', { class: 'lebenslauf', 'aria-label': 'Lebenslauf' },
    el('h1', { text: name() || '[Vorname Nachname]' }),
    el('p', { text: [pers.ort ? `${pers.plz || ''} ${pers.ort}`.trim() : '', pers.telefon, pers.email].filter(Boolean).join(' · ') }),
    zeilen(p.wunsch?.positionen)[0] ? el('p', {}, el('strong', { text: zeilen(p.wunsch.positionen)[0] })) : null,
    abschnitt('Berufserfahrung', stationen.map((s) => zeile(zeitraum(s.von, s.bis), s.position || '', [s.arbeitgeber, s.branche].filter(Boolean).join(' · '), [...zeilen(s.aufgaben), ...zeilen(s.erfolge)]))),
    abschnitt('Ausbildung', [
      ...ausbildung.map((a) => zeile(zeitraum(a.von, a.bis), a.titel, a.unter)),
      p.bildung?.schulabschluss && p.bildung.schulabschluss !== 'kein' ? zeile('', p.bildung.schulabschluss, p.bildung.schulnote ? `Note ${p.bildung.schulnote}` : '') : null,
    ].filter(Boolean)),
    abschnitt('Weiterbildung', (p.bildung?.fortbildungen || []).filter((f) => f.titel).map((f) => zeile(String(f.jahr || ''), f.titel, [f.art, f.anbieter].filter(Boolean).join(' · ')))),
    abschnitt('Kenntnisse', el('div', {},
      p.kompetenzen?.fachlich ? el('p', {}, el('strong', { text: 'Fachlich: ' }), p.kompetenzen.fachlich) : null,
      p.kompetenzen?.software ? el('p', {}, el('strong', { text: 'Software: ' }), p.kompetenzen.software) : null,
      sprachen.length ? el('p', {}, el('strong', { text: 'Sprachen: ' }), sprachen.join(', ')) : null,
      pers.fuehrerschein ? el('p', {}, el('strong', { text: 'Führerschein: ' }), pers.fuehrerschein) : null)),
    p.zusatz?.ehrenamt ? abschnitt('Ehrenamt', el('p', { text: p.zusatz.ehrenamt })) : null);
  ersetzen($('#cv-vorschau'), cv);
  $('#cv-drucken').hidden = false;
}

$('#cv-erzeugen').addEventListener('click', lebenslaufErzeugen);
$('#cv-drucken').addEventListener('click', () => {
  document.body.classList.add('druck-cv');
  window.print();
  document.body.classList.remove('druck-cv');
});

// ---------------------------------------------------------------- 9 Daten

function herunterladen(dateiname, inhalt, typ) {
  const url = URL.createObjectURL(new Blob([inhalt], { type: typ }));
  const a = el('a', { href: url, download: dateiname });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function datenuebersicht() {
  const e = zustand.einwilligung;
  ersetzen($('#datenuebersicht'), 
    el('li', { text: `Im Browser gespeichert: ${e.speichern ? 'ja (localStorage dieses Browsers)' : 'nein – nach dem Neuladen ist alles weg'}` }),
    el('li', { text: `Dokumente: ${zustand.dokumente.length} (gespeichert wird nur der ausgelesene Text und die Auswertung, nicht die Originaldatei)` }),
    el('li', { text: `KI-Modus: ${e.ki ? 'eingewilligt – Daten gehen nur bei Klick auf einen KI-Knopf an die Claude API (Anthropic)' : 'aus – nichts verlässt diesen Rechner (außer Suchanfragen an die Jobbörse)'}` }),
    el('li', { text: `Datensparmodus für Dokumente: ${zustand.kiEinstellungen?.datensparsam !== false ? 'an – nur geschwärzter Text wird übertragen, Scans nur nach Rückfrage' : 'aus'}` }),
    el('li', { text: `KI-Kosten: ${Object.entries(zustand.kiKosten || {}).sort().reverse().map(([m, v]) => `${m}: ${dollar(v)}`).join(' · ') || 'noch keine'}` }),
    el('li', { text: `Steuerangaben: ${e.steuer ? 'freigegeben' : 'nicht freigegeben'}` }),
    el('li', { text: 'Jobsuche: Suchbegriff und Ort werden an die Jobbörse der Bundesagentur für Arbeit gesendet.' }));
}

$('#export').addEventListener('click', () => {
  herunterladen(`bewerbungsprofil-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(zustand, null, 2), 'application/json');
});

$('#import').addEventListener('change', async (e) => {
  const datei = e.target.files[0];
  e.target.value = '';
  if (!datei) return;
  try {
    const daten = JSON.parse(await datei.text());
    if (daten?.version !== 1 || typeof daten.profil !== 'object') throw new Error('Keine gültige Export-Datei des Bewerbungs-Generators.');
    zustand = { ...LEER(), ...daten };
    dateien.clear();
    speichern();
    allesRendern();
    meldung('Daten importiert.');
  } catch (err) {
    meldung(err.message.startsWith('Keine') ? err.message : 'Die Datei konnte nicht gelesen werden.');
  }
});

$('#loeschen').addEventListener('click', () => {
  if (!window.confirm('Wirklich alle Angaben, Dokument-Auswertungen und Ergebnisse löschen?')) return;
  try {
    localStorage.removeItem(SPEICHER_SCHLUESSEL);
  } catch {
    /* ignorieren */
  }
  zustand = LEER();
  dateien.clear();
  allesRendern();
  zeigeBereich('start');
  meldung('Alle Daten wurden gelöscht.');
});

// ---------------------------------------------------------------- Start

function allesRendern() {
  einwilligungAnzeigen();
  statusAnzeigen();
  dokumenteRendern();
  interviewRendern();
  rasterRendern($('#situation-felder'), SITUATION, zustand.situation);
  hrRendern();
  hrKiRendern();
  leistungenRendern();
  if (zustand.ergebnisse.leistungenKi) ersetzen($('#leistungen-ki-ergebnis'), kiErgebnisKarte('Recherche: Leistungen, Beträge & Erfahrungen', zustand.ergebnisse.leistungenKi.text, zustand.ergebnisse.leistungenKi.quellen, zustand.ergebnisse.leistungenKi.kosten));
  else ersetzen($('#leistungen-ki-ergebnis'));
  ersetzen($('#job-ergebnis'));
  ersetzen($('#job-ki-ergebnis'));
  anschreibenRendern();
  steuerAnzeigen();
  datenuebersicht();
}

for (const a of $$('a[data-ziel]')) {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    zeigeBereich(a.dataset.ziel);
  });
}
window.addEventListener('hashchange', () => zeigeBereich(location.hash.slice(1), false));

laden();
allesRendern();
zeigeBereich(location.hash.slice(1) || 'start', false);
api('/api/status')
  .then((s) => { server = s; })
  .catch(() => meldung('Der lokale Server antwortet nicht. Läuft „npm start“ noch?'))
  .finally(statusAnzeigen);
