#!/usr/bin/env node
// Kompiliert alle MJML-Mails aus emails/mjml/ zu HTML in emails/html/.
//
// Zwei Arten von Platzhaltern:
//   [[name]]    Betriebsdaten aus data/betrieb.json – werden HIER beim Build eingesetzt.
//   {{name}}    Empfängerdaten (Vorname, Fälligkeit …) – bleiben im HTML stehen und werden
//               erst beim Versand (bzw. von automation/plan.js) pro Kunde gefüllt.
//
// Ausgabe:
//   emails/html/<mail>.html            Vorlage mit {{Platzhaltern}}
//   emails/html/beispiel/<mail>.html   Vorschau mit Beispieldaten
//   emails/html/mails.json / mails.js  Übersicht (Betreff, Preheader, Auslöser) für Präsentation & Skript

const fs = require('fs');
const path = require('path');
const mjml2html = require('mjml');
const { pfad, leseJson, fuellePlatzhalter, findePlatzhalter } = require('../automation/lib');

const MJML_DIR = pfad('emails/mjml');
const HTML_DIR = pfad('emails/html');
const BEISPIEL_DIR = path.join(HTML_DIR, 'beispiel');

const betrieb = leseJson('data/betrieb.json');
const strecke = leseJson('emails/strecke.json');
const erlaubtePlatzhalter = Object.keys(strecke.platzhalter);

// Beispieldaten für die Vorschau. Einzelne Mails überschreiben Werte, damit die Daten zur Situation passen.
const BEISPIEL = {
  vorname: 'Anna',
  nachname: 'Beispiel',
  heizungsart: 'Gasheizung',
  letzte_wartung: '03.11.2025',
  faellig_am: '03.11.2026',
  bestaetigungs_link: '../../../landingpage/bestaetigt.html?vorname=Anna',
  abmelde_link: '#demo-abmelden',
};
const BEISPIEL_JE_MAIL = {
  '05-bewertung': { letzte_wartung: '06.10.2026', faellig_am: '06.10.2027' },
  '07-reaktivierung': { heizungsart: 'Ölheizung', letzte_wartung: '18.02.2025', faellig_am: '18.02.2026' },
};

function includesAufloesen(quelle, verzeichnis, tiefe = 0) {
  if (tiefe > 5) throw new Error('mj-include ist zu tief verschachtelt');
  return quelle.replace(/<mj-include\s+path="([^"]+)"\s*\/>/g, (_, rel) => {
    const datei = path.resolve(verzeichnis, rel);
    const inhalt = fs.readFileSync(datei, 'utf8');
    return includesAufloesen(inhalt, path.dirname(datei), tiefe + 1);
  });
}

function betriebsdatenEinsetzen(quelle, datei) {
  const ergebnis = quelle.replace(/\[\[(\w+)\]\]/g, (_, name) => {
    if (!(name in betrieb)) throw new Error(`${datei}: unbekannter Betriebs-Platzhalter [[${name}]]`);
    return betrieb[name];
  });
  if (/\[\[|\]\]/.test(ergebnis)) throw new Error(`${datei}: fehlerhafter [[Platzhalter]] gefunden`);
  return ergebnis;
}

function zwischenTags(quelle, tag) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(quelle);
  return m ? m[1].trim() : '';
}

function baueMail(eintrag) {
  const datei = `${eintrag.datei}.mjml`;
  const roh = fs.readFileSync(path.join(MJML_DIR, datei), 'utf8');
  const quelle = betriebsdatenEinsetzen(includesAufloesen(roh, MJML_DIR), datei);

  const { html, errors } = mjml2html(quelle, { validationLevel: 'strict', filePath: path.join(MJML_DIR, datei) });
  if (errors.length) {
    const details = errors.map((e) => `  Zeile ${e.line}: ${e.message}`).join('\n');
    throw new Error(`${datei}: MJML-Fehler\n${details}`);
  }

  const platzhalter = findePlatzhalter(html);
  const unbekannt = platzhalter.filter((p) => !erlaubtePlatzhalter.includes(p));
  if (unbekannt.length) throw new Error(`${datei}: unbekannte Platzhalter ${unbekannt.map((p) => `{{${p}}}`).join(', ')}`);
  if (!platzhalter.includes('abmelde_link')) throw new Error(`${datei}: {{abmelde_link}} fehlt`);

  fs.writeFileSync(path.join(HTML_DIR, `${eintrag.datei}.html`), html);

  // Beispiel-Vorschau: Bildpfade liegen eine Ebene tiefer.
  const werte = { ...BEISPIEL, ...(BEISPIEL_JE_MAIL[eintrag.datei] || {}) };
  let beispiel = fuellePlatzhalter(html, werte).text;
  if (betrieb.asset_pfad.startsWith('../')) {
    beispiel = beispiel.split(`src="${betrieb.asset_pfad}`).join(`src="../${betrieb.asset_pfad}`);
  }
  fs.writeFileSync(path.join(BEISPIEL_DIR, `${eintrag.datei}.html`), beispiel);

  const betreff = zwischenTags(quelle, 'mj-title');
  const preheader = zwischenTags(quelle, 'mj-preview');
  return {
    ...eintrag,
    betreff,
    preheader,
    betreff_beispiel: fuellePlatzhalter(betreff, werte, { html: false }).text,
    preheader_beispiel: fuellePlatzhalter(preheader, werte, { html: false }).text,
    platzhalter,
    groesse_kb: Math.round(Buffer.byteLength(html) / 102.4) / 10,
  };
}

function main() {
  fs.mkdirSync(BEISPIEL_DIR, { recursive: true });
  const uebersicht = [];
  let fehler = 0;

  for (const eintrag of strecke.mails) {
    try {
      const info = baueMail(eintrag);
      uebersicht.push(info);
      console.log(`✔ ${eintrag.datei}.html  (${info.groesse_kb} KB)  Betreff: ${info.betreff}`);
    } catch (e) {
      fehler++;
      console.error(`✖ ${e.message}`);
    }
  }

  const vorhanden = fs.readdirSync(MJML_DIR).filter((f) => f.endsWith('.mjml')).map((f) => f.replace('.mjml', ''));
  const ohneEintrag = vorhanden.filter((f) => !strecke.mails.some((m) => m.datei === f));
  if (ohneEintrag.length) console.warn(`Hinweis: nicht in emails/strecke.json eingetragen: ${ohneEintrag.join(', ')}`);

  const daten = { erstellt: new Date().toISOString(), firma: betrieb.firma, platzhalter: strecke.platzhalter, mails: uebersicht };
  fs.writeFileSync(path.join(HTML_DIR, 'mails.json'), JSON.stringify(daten, null, 2));
  // Als Skript, damit index.html die Daten auch per Doppelklick (file://) ohne Server lesen kann.
  fs.writeFileSync(path.join(HTML_DIR, 'mails.js'), `window.MAIL_STRECKE = ${JSON.stringify(daten, null, 2)};\n`);

  if (fehler) {
    console.error(`\n${fehler} Mail(s) mit Fehlern.`);
    process.exit(1);
  }
  console.log(`\n${uebersicht.length} Mails kompiliert → emails/html/ (Vorschau mit Beispieldaten: emails/html/beispiel/)`);
}

main();
