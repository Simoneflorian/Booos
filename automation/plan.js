#!/usr/bin/env node
// Berechnet aus data/kunden.csv, welche Mail der Strecke wann fällig ist.
// Es wird KEINE E-Mail verschickt – das Skript zeigt nur, was ein Versandsystem tun würde.
//
// Aufruf:
//   npm run plan                                   Zeitplan ab heute (nächste 365 Tage)
//   npm run plan -- --stichtag 2026-10-06          Zeitplan aus Sicht eines bestimmten Tages
//   npm run plan -- --alle                         auch bereits versendete Mails anzeigen
//   npm run plan -- --kunde K001                   nächste fällige Mail für K001 als HTML erzeugen
//   npm run plan -- --kunde K001 --mail 3          bestimmte Mail (1–7) für K001 als HTML erzeugen

const fs = require('fs');
const path = require('path');
const {
  pfad, leseJson, leseCsv, parseDatum, heute, plusTage, plusMonate, isoDatum, deDatum, fuellePlatzhalter,
} = require('./lib');

const WARTUNGSINTERVALL_MONATE = 12;
const REAKTIVIERUNG_MONATE = 18;
const ERINNERUNG_TAGE_VORHER = 28;
const LETZTE_ERINNERUNG_TAGE_VORHER = 7;
const BEWERTUNG_TAGE_NACH_TERMIN = 2;
const HERBST = { monat: 9, tag: 15 };

const HEIZUNGSARTEN = {
  gas: 'Gasheizung',
  oel: 'Ölheizung',
  waermepumpe: 'Wärmepumpe',
  sonstige: 'Heizung',
};

// Diese Mails werden am Versandtag nur verschickt, wenn bis dahin kein Termin eingetragen wurde.
const BEDINGUNG = { 4: 'nur ohne Termin', 7: 'nur ohne Termin' };

const AUSGABE_DIR = pfad('automation/ausgabe');

// ---------------------------------------------------------------- Argumente

function leseArgumente(argv) {
  const args = { alle: false, tage: 365 };
  for (let i = 0; i < argv.length; i++) {
    let [name, wert] = argv[i].replace(/^--/, '').split('=');
    const naechster = () => (wert !== undefined ? wert : argv[++i]);
    switch (name) {
      case 'stichtag': args.stichtag = naechster(); break;
      case 'alle': args.alle = true; break;
      case 'tage': args.tage = parseInt(naechster(), 10); break;
      case 'kunde': args.kunde = naechster(); break;
      case 'mail': args.mail = parseInt(naechster(), 10); break;
      case 'hilfe': case 'help': case 'h': args.hilfe = true; break;
      default: throw new Error(`Unbekannte Option "${argv[i]}" (siehe --hilfe)`);
    }
  }
  return args;
}

// ---------------------------------------------------------------- Planungslogik

function planeKunde(k, stichtag, horizont) {
  const ereignisse = [];
  const hinweise = [];
  const add = (nr, datum, details = {}) => ereignisse.push({ nr, datum, ...details });

  const angemeldet = parseDatum(k.angemeldet_am);
  const bestaetigt = parseDatum(k.bestaetigt_am);
  const abgemeldet = parseDatum(k.abgemeldet_am);
  const letzteWartung = parseDatum(k.letzte_wartung);
  const termin = parseDatum(k.naechster_termin);

  if (abgemeldet && abgemeldet <= stichtag) {
    hinweise.push(`abgemeldet am ${deDatum(abgemeldet)} – keine Mails mehr`);
    return { ereignisse, hinweise };
  }

  add(1, angemeldet);
  if (!bestaetigt) {
    const alter = Math.round((stichtag - angemeldet) / 86400000);
    hinweise.push(alter > 30
      ? 'Anmeldung nie bestätigt – Datensatz löschen (älter als 30 Tage)'
      : 'wartet auf Bestätigung (Double-Opt-in) – bis dahin keine weiteren Mails');
    return { ereignisse, hinweise };
  }
  add(2, bestaetigt);

  // Saisonmail: jedes Jahr am 15. September an alle bestätigten Kontakte.
  for (let jahr = bestaetigt.getUTCFullYear(); jahr <= horizont.getUTCFullYear(); jahr++) {
    const d = new Date(Date.UTC(jahr, HERBST.monat - 1, HERBST.tag));
    if (d >= bestaetigt) add(6, d);
  }

  if (!letzteWartung && !termin) {
    hinweise.push('Datum der letzten Wartung fehlt – nachfragen (Antwort auf Willkommensmail)');
  }

  // Wartungszyklen: ausgehend von der letzten Wartung, danach vom vereinbarten Termin.
  const zyklen = [];
  if (letzteWartung) zyklen.push({ basis: letzteWartung, erledigt: letzteWartung <= stichtag, folgetermin: termin });
  if (termin) zyklen.push({ basis: termin, erledigt: termin <= stichtag, folgetermin: null });

  for (const z of zyklen) {
    const faellig = plusMonate(z.basis, WARTUNGSINTERVALL_MONATE);
    const faelligDe = deDatum(faellig);

    // Bewertungsanfrage nach dem (geplanten oder erledigten) Termin.
    const bewertung = plusTage(z.basis, BEWERTUNG_TAGE_NACH_TERMIN);
    if (bewertung >= bestaetigt) add(5, bewertung, { faellig_am: faelligDe, wartung: deDatum(z.basis) });

    // Ist für diesen Zyklus schon ein Folgetermin vereinbart, der vor/um die Fälligkeit liegt?
    const terminGebucht = z.folgetermin && z.folgetermin > z.basis;

    let erinnerung = plusTage(faellig, -ERINNERUNG_TAGE_VORHER);
    if (erinnerung < bestaetigt && faellig > plusTage(bestaetigt, LETZTE_ERINNERUNG_TAGE_VORHER)) {
      erinnerung = plusTage(bestaetigt, 1); // erst nach der Anmeldung möglich → nachholen
    }
    if (erinnerung >= bestaetigt) add(3, erinnerung, { faellig_am: faelligDe, wartung: deDatum(z.basis) });

    const letzte = plusTage(faellig, -LETZTE_ERINNERUNG_TAGE_VORHER);
    // Letzte Erinnerung entfällt, sobald ein Termin vereinbart ist (bereits versendete bleiben in der Historie).
    if (letzte >= bestaetigt && !(terminGebucht && letzte >= stichtag)) {
      add(4, letzte, { faellig_am: faelligDe, wartung: deDatum(z.basis) });
    }

    // Reaktivierung: Wartung über 18 Monate her und kein Termin.
    if (!terminGebucht) {
      let reakt = plusMonate(z.basis, REAKTIVIERUNG_MONATE);
      if (reakt < bestaetigt) reakt = plusTage(bestaetigt, 7); // nicht direkt neben der Willkommensmail
      add(7, reakt, { faellig_am: faelligDe, wartung: deDatum(z.basis) });
    }
  }

  if (termin && termin > stichtag) hinweise.push(`Termin vereinbart am ${deDatum(termin)}`);

  return {
    ereignisse: ereignisse.filter((e) => e.datum <= horizont),
    hinweise,
  };
}

function status(datum, stichtag) {
  if (datum < stichtag) return 'versendet';
  if (+datum === +stichtag) return 'heute senden';
  return 'geplant';
}

function erstellePlan(kunden, mails, stichtag, tage) {
  const horizont = plusTage(stichtag, tage);
  const eintraege = [];
  const hinweise = [];

  for (const k of kunden) {
    const { ereignisse, hinweise: h } = planeKunde(k, stichtag, horizont);
    h.forEach((text) => hinweise.push({ kunden_nr: k.kunden_nr, name: `${k.vorname} ${k.nachname}`, hinweis: text }));
    for (const e of ereignisse) {
      const mail = mails.find((m) => m.nr === e.nr);
      eintraege.push({
        datum: isoDatum(e.datum),
        status: status(e.datum, stichtag),
        kunden_nr: k.kunden_nr,
        name: `${k.vorname} ${k.nachname}`,
        email: k.email,
        mail_nr: e.nr,
        mail: mail.name,
        datei: mail.datei,
        faellig_am: e.faellig_am || null,
        letzte_wartung: e.wartung || null,
        bedingung: BEDINGUNG[e.nr] || null,
      });
    }
  }
  eintraege.sort((a, b) => a.datum.localeCompare(b.datum) || a.kunden_nr.localeCompare(b.kunden_nr) || a.mail_nr - b.mail_nr);
  return { stichtag: isoDatum(stichtag), horizont: isoDatum(horizont), eintraege, hinweise };
}

// ---------------------------------------------------------------- Ausgabe

function tabelle(spalten, zeilen) {
  const breite = spalten.map((s) => Math.max(s.titel.length, ...zeilen.map((z) => String(z[s.feld] ?? '').length)));
  const linie = (l, m, r) => l + breite.map((b) => '─'.repeat(b + 2)).join(m) + r;
  const zeile = (werte) => '│' + werte.map((w, i) => ` ${String(w ?? '').padEnd(breite[i])} `).join('│') + '│';
  return [
    linie('┌', '┬', '┐'),
    zeile(spalten.map((s) => s.titel)),
    linie('├', '┼', '┤'),
    ...zeilen.map((z) => zeile(spalten.map((s) => z[s.feld]))),
    linie('└', '┴', '┘'),
  ].join('\n');
}

function zeigePlan(plan, alle) {
  const sichtbar = plan.eintraege.filter((e) => alle || e.status !== 'versendet');
  const zeilen = sichtbar.map((e) => ({
    ...e,
    datum_de: deDatum(parseDatum(e.datum)),
    mail_text: `${e.mail_nr} · ${e.mail}`,
    status_text: e.status === 'heute senden' ? '▶ heute senden' : e.status,
    faellig_text: e.faellig_am || '',
    bedingung_text: e.status === 'versendet' ? '' : e.bedingung || '',
  }));

  console.log(`\nZeitplan der Mail-Strecke – Stichtag ${deDatum(parseDatum(plan.stichtag))}, Vorschau bis ${deDatum(parseDatum(plan.horizont))}`);
  console.log(alle ? '(inklusive bereits versendeter Mails)\n' : '(bereits versendete Mails ausgeblendet, alle anzeigen mit --alle)\n');
  console.log(tabelle([
    { titel: 'Datum', feld: 'datum_de' },
    { titel: 'Status', feld: 'status_text' },
    { titel: 'Kunde', feld: 'kunden_nr' },
    { titel: 'Name', feld: 'name' },
    { titel: 'Mail', feld: 'mail_text' },
    { titel: 'Wartung fällig', feld: 'faellig_text' },
    { titel: 'Bedingung', feld: 'bedingung_text' },
  ], zeilen));

  const heuteAnzahl = plan.eintraege.filter((e) => e.status === 'heute senden').length;
  const geplant = plan.eintraege.filter((e) => e.status === 'geplant').length;
  console.log(`\nHeute zu senden: ${heuteAnzahl} · geplant: ${geplant} · bereits versendet: ${plan.eintraege.length - heuteAnzahl - geplant}`);

  if (plan.hinweise.length) {
    console.log('\nHinweise:');
    console.log(tabelle([
      { titel: 'Kunde', feld: 'kunden_nr' },
      { titel: 'Name', feld: 'name' },
      { titel: 'Hinweis', feld: 'hinweis' },
    ], plan.hinweise));
  }
}

// ---------------------------------------------------------------- Personalisierte Mail

function erzeugeMail(kunde, mailNr, plan, mails, stichtag) {
  const mail = mails.find((m) => m.nr === mailNr);
  if (!mail) throw new Error(`Mail ${mailNr} gibt es nicht (1–${mails.length})`);

  // Passenden Planeintrag suchen (für das richtige Fälligkeitsdatum); sonst aktueller Zyklus.
  const eintraege = plan.eintraege.filter((e) => e.kunden_nr === kunde.kunden_nr && e.mail_nr === mailNr);
  const eintrag = eintraege.find((e) => e.status !== 'versendet') || eintraege[eintraege.length - 1];
  const wartung = parseDatum(kunde.letzte_wartung);

  const werte = {
    vorname: kunde.vorname,
    nachname: kunde.nachname,
    heizungsart: HEIZUNGSARTEN[kunde.heizungsart] || 'Heizung',
    letzte_wartung: eintrag?.letzte_wartung || (wartung ? deDatum(wartung) : ''),
    faellig_am: eintrag?.faellig_am || (wartung ? deDatum(plusMonate(wartung, WARTUNGSINTERVALL_MONATE)) : ''),
    bestaetigungs_link: `https://www.mustermann-demo.de/bestaetigen?token=DEMO-${kunde.kunden_nr}`,
    abmelde_link: `https://www.mustermann-demo.de/abmelden?token=DEMO-${kunde.kunden_nr}`,
  };

  const vorlage = pfad('emails/html', `${mail.datei}.html`);
  if (!fs.existsSync(vorlage)) throw new Error(`${path.relative(pfad(), vorlage)} fehlt – zuerst "npm run build:emails" ausführen`);

  const betrieb = leseJson('data/betrieb.json');
  let { text: html, fehlend } = fuellePlatzhalter(fs.readFileSync(vorlage, 'utf8'), werte);
  // Bildpfade relativ zum Ausgabeordner korrigieren.
  if (betrieb.asset_pfad.startsWith('../')) {
    html = html.split(`src="${betrieb.asset_pfad}`).join('src="../../emails/assets/');
  }

  const info = leseJson('emails/html/mails.json').mails.find((m) => m.nr === mailNr);
  const betreff = fuellePlatzhalter(info.betreff, werte, { html: false }).text;
  const preheader = fuellePlatzhalter(info.preheader, werte, { html: false }).text;

  fs.mkdirSync(AUSGABE_DIR, { recursive: true });
  const ziel = path.join(AUSGABE_DIR, `${kunde.kunden_nr}-${mail.datei}.html`);
  fs.writeFileSync(ziel, html);

  console.log(`\nPersonalisierte Mail erzeugt (nicht versendet):`);
  console.log(`  An:        ${kunde.vorname} ${kunde.nachname} <${kunde.email}>`);
  console.log(`  Betreff:   ${betreff}`);
  console.log(`  Preheader: ${preheader}`);
  if (eintrag) console.log(`  Geplant:   ${deDatum(parseDatum(eintrag.datum))} (${eintrag.status})`);
  else console.log(`  Hinweis:   Diese Mail ist für ${kunde.kunden_nr} laut Zeitplan aktuell nicht vorgesehen (Stichtag ${deDatum(stichtag)}).`);
  if (fehlend.length) console.log(`  Achtung:   nicht gefüllte Platzhalter: ${fehlend.map((f) => `{{${f}}}`).join(', ')}`);
  console.log(`  Datei:     ${path.relative(pfad(), ziel)}`);
}

// ---------------------------------------------------------------- Start

function main() {
  const args = leseArgumente(process.argv.slice(2));
  if (args.hilfe) {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 11).map((z) => z.replace(/^\/\/ ?/, '')).join('\n'));
    return;
  }
  if (!Number.isInteger(args.tage) || args.tage < 1) throw new Error('--tage muss eine positive Zahl sein');

  const stichtag = args.stichtag ? parseDatum(args.stichtag) : heute();
  const kunden = leseCsv('data/kunden.csv');
  const { mails } = leseJson('emails/strecke.json');
  const plan = erstellePlan(kunden, mails, stichtag, args.tage);

  if (args.kunde) {
    const kunde = kunden.find((k) => k.kunden_nr.toLowerCase() === args.kunde.toLowerCase());
    if (!kunde) throw new Error(`Kunde "${args.kunde}" nicht gefunden (vorhanden: ${kunden.map((k) => k.kunden_nr).join(', ')})`);
    let mailNr = args.mail;
    if (!mailNr) {
      const naechste = plan.eintraege.find((e) => e.kunden_nr === kunde.kunden_nr && e.status !== 'versendet');
      if (!naechste) throw new Error(`Für ${kunde.kunden_nr} ist keine Mail mehr geplant – bitte mit --mail <1–7> wählen`);
      mailNr = naechste.mail_nr;
    }
    erzeugeMail(kunde, mailNr, plan, mails, stichtag);
    return;
  }

  zeigePlan(plan, args.alle);

  fs.mkdirSync(AUSGABE_DIR, { recursive: true });
  const jsonDatei = path.join(AUSGABE_DIR, 'zeitplan.json');
  fs.writeFileSync(jsonDatei, JSON.stringify(plan, null, 2));
  console.log(`\nJSON gespeichert: ${path.relative(pfad(), jsonDatei)} (${plan.eintraege.length} Einträge)`);
}

try {
  main();
} catch (e) {
  console.error(`Fehler: ${e.message}`);
  process.exit(1);
}
