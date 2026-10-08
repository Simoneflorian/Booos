import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pruefeLeistungen, bedarfSchaetzen } from '../src/leistungen.js';
import { steuerTipps } from '../src/steuer.js';
import { sucheJobs, suchUrl, passung } from '../src/jobsuche.js';
import { anschreibenVorlage } from '../src/anschreiben.js';

const ids = (r) => r.ergebnisse.map((e) => e.id);
const finde = (r, id) => r.ergebnisse.find((e) => e.id === id);

test('Leistungen: Kündigung → Fristen zuerst, ALG I, Bewerbungskosten', () => {
  const r = pruefeLeistungen({ erwerbsstatus: 'gekuendigt', versicherungspflichtigMonate: '28' });
  assert.deepEqual(ids(r).slice(0, 2), ['kuendigungsschutz', 'arbeitsuchend']);
  assert.equal(finde(r, 'alg1').status, 'wahrscheinlich');
  assert.equal(finde(r, 'vermittlungsbudget').status, 'wahrscheinlich');
  assert.ok(ids(r).includes('sozialberatung'));
});

test('Leistungen: zu wenig Versicherungszeit → ALG I eher nicht', () => {
  const r = pruefeLeistungen({ erwerbsstatus: 'arbeitslos', versicherungspflichtigMonate: '7' });
  assert.equal(finde(r, 'alg1').status, 'eher-nicht');
});

test('Leistungen: alleinerziehend mit kleinem Einkommen', () => {
  const s = { erwerbsstatus: 'beschaeftigt', alleinerziehend: 'ja', anzahlKinder: '2', kinderAlter: '1, 6', unterhaltZahltAndererElternteil: 'nein', haushaltsEinkommenNetto: '1700', bruttoEinkommen: '1500', warmmiete: '850' };
  const r = pruefeLeistungen(s);
  for (const id of ['kindergeld', 'unterhaltsvorschuss', 'elterngeld', 'entlastungsbetrag', 'kinderzuschlag', 'wohngeld']) assert.ok(ids(r).includes(id), id);
  assert.equal(bedarfSchaetzen(s), 563 + 2 * 400 + 850);
});

test('Leistungen: geringes Einkommen → Bürgergeld, Rundfunkbefreiung, Beratungshilfe', () => {
  const r = pruefeLeistungen({ erwerbsstatus: 'arbeitslos', haushaltsEinkommenNetto: '400', warmmiete: '600' });
  assert.equal(finde(r, 'buergergeld').status, 'wahrscheinlich');
  assert.ok(ids(r).includes('rundfunk'));
  assert.ok(ids(r).includes('beratungshilfe'));
});

test('Leistungen: Gründungszuschuss braucht 150 Tage Restanspruch', () => {
  assert.equal(finde(pruefeLeistungen({ erwerbsstatus: 'arbeitslos', alg1Bezug: 'ja', selbststaendigkeitGeplant: 'ja', alg1RestTage: '90' }), 'gruendungszuschuss').status, 'eher-nicht');
  assert.equal(finde(pruefeLeistungen({ erwerbsstatus: 'arbeitslos', alg1Bezug: 'ja', selbststaendigkeitGeplant: 'ja', alg1RestTage: '200' }), 'gruendungszuschuss').status, 'pruefen');
});

test('Leistungen: Gesundheit nur bei eigener Angabe, BAB nur ohne Elternwohnung', () => {
  assert.ok(!ids(pruefeLeistungen({ erwerbsstatus: 'beschaeftigt' })).includes('schwerbehinderung'));
  assert.ok(ids(pruefeLeistungen({ gesundheitlicheEinschraenkung: 'gdb50' })).includes('schwerbehinderung'));
  assert.ok(!ids(pruefeLeistungen({ erwerbsstatus: 'ausbildung' })).includes('bab'));
  assert.ok(ids(pruefeLeistungen({ erwerbsstatus: 'ausbildung', wohntBeiEltern: 'nein' })).includes('bab'));
});

test('Steuer: Werbungskosten werden berechnet und mit dem Pauschbetrag verglichen', () => {
  const r = steuerTipps({ entfernungKm: '20', arbeitstageBuero: '200', bewerbungenOnline: '10', vorstellungsgespraecheKm: '100' }, { erwerbsstatus: 'beschaeftigt' });
  const w = r.werbungskosten;
  assert.equal(w.posten.find((p) => p.name.startsWith('Fahrten zur Arbeit')).betrag, 1520);
  assert.equal(w.summe, 1520 + 25 + 30 + 16);
  assert.equal(w.ueberPauschale, w.summe - 1230);
  assert.ok(r.tipps.some((t) => t.titel.includes('Bewerbungskosten')));
});

test('Steuer: Pflichtveranlagung, Abfindung und Arbeitslosigkeit', () => {
  const r = steuerTipps({ lohnersatz: 'ja', abfindung: 'ja' }, { erwerbsstatus: 'arbeitslos' });
  const titel = r.tipps.map((t) => t.titel).join(' | ');
  assert.match(titel, /Pflicht zur Steuererklärung/);
  assert.match(titel, /Fünftelregelung/);
  assert.match(titel, /Auch ohne Einkommen/);
  assert.match(r.werbungskosten.fazit, /Keine Angaben/);
});

test('Jobsuche: URL-Parameter für die Jobbörse', () => {
  const url = new URL(suchUrl({ was: 'Buchhalter', wo: 'Berlin', umkreis: '50', arbeitszeit: 'teilzeit', angebotsart: 'ausbildung', tage: '30', zeitarbeit: false, seite: 2 }));
  assert.equal(url.searchParams.get('was'), 'Buchhalter');
  assert.equal(url.searchParams.get('umkreis'), '50');
  assert.equal(url.searchParams.get('arbeitszeit'), 'tz');
  assert.equal(url.searchParams.get('angebotsart'), '4');
  assert.equal(url.searchParams.get('veroeffentlichtseit'), '30');
  assert.equal(url.searchParams.get('zeitarbeit'), 'false');
  assert.equal(url.searchParams.get('page'), '2');
});

test('Jobsuche: Antwort der Jobbörse wird normalisiert, API-Key wird gesendet', async () => {
  let gesendet;
  const fakeFetch = async (url, optionen) => {
    gesendet = { url, optionen };
    return new Response(JSON.stringify({
      maxErgebnisse: 2,
      page: 1,
      stellenangebote: [
        { refnr: '10000-1234-S', titel: 'Finanzbuchhalter (m/w/d)', beruf: 'Buchhalter/in', arbeitgeber: 'Muster GmbH', aktuelleVeroeffentlichungsdatum: '2026-10-01', arbeitsort: { plz: '10115', ort: 'Berlin', entfernung: '3' } },
        { refnr: '10000-9999-S', titel: 'Lagerhelfer', beruf: 'Lagerhelfer/in', arbeitgeber: 'Lager AG', arbeitsort: { ort: 'Berlin' } },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const profil = { wunsch: { positionen: 'Finanzbuchhalter' }, kompetenzen: { fachlich: 'Buchhaltung' } };
  const r = await sucheJobs({ was: 'Buchhalter', wo: 'Berlin' }, profil, fakeFetch);
  assert.equal(gesendet.optionen.headers['X-API-Key'], 'jobboerse-jobsuche');
  assert.equal(r.gesamt, 2);
  assert.equal(r.treffer[0].ort, '10115 Berlin');
  assert.equal(r.treffer[0].link, 'https://www.arbeitsagentur.de/jobsuche/jobdetail/10000-1234-S');
  assert.ok(r.treffer[0].passung > r.treffer[1].passung);
});

test('Jobsuche: verständliche Fehler bei Ausfall und leerer Antwort', async () => {
  await assert.rejects(sucheJobs({ was: 'X' }, null, async () => { throw new TypeError('fetch failed'); }), /nicht erreichbar/);
  await assert.rejects(sucheJobs({ was: 'X' }, null, async () => new Response('', { status: 503 })), /Fehler 503/);
  const leer = await sucheJobs({ was: 'X' }, null, async () => new Response(null, { status: 204 }));
  assert.equal(leer.gesamt, 0);
  await assert.rejects(sucheJobs({}, null, async () => new Response('{}')), /Wunschposition oder einen Ort/);
});

test('Passung ist ohne Profil nicht berechenbar', () => {
  assert.equal(passung({ titel: 'X', beruf: '' }, null), null);
});

test('Anschreiben-Vorlage setzt Profildaten ein und markiert Lücken', () => {
  const r = anschreibenVorlage({
    persoenlich: { vorname: 'Erika', nachname: 'Beispiel', kuendigungsfrist: '3 Monate' },
    stationen: [{ position: 'Buchhalterin', arbeitgeber: 'Muster GmbH', von: '2018-01', erfolge: 'Monatsabschluss um 3 Tage beschleunigt' }],
    kompetenzen: { fachlich: 'Kreditoren, Debitoren' },
    wunsch: { gehalt: '52000' },
  }, 'Finanzbuchhalter (m/w/d)\nbei der Nordlicht Handel GmbH in Hamburg');
  assert.equal(r.betreff, 'Bewerbung als Finanzbuchhalter (m/w/d)');
  assert.match(r.anschreiben, /Nordlicht Handel GmbH/);
  assert.match(r.anschreiben, /Monatsabschluss um 3 Tage beschleunigt\./);
  assert.match(r.anschreiben, /52\.000 €/);
  assert.match(r.anschreiben, /Erika Beispiel$/);
  assert.match(r.anschreiben, /\[ein konkreter Grund/);
});
