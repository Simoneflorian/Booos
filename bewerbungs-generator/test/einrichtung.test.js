// KI-Einrichtung über die Oberfläche: Schlüssel prüfen, in .env speichern, testen, entfernen – mit simulierter Claude API.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import http from 'node:http';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-env-'));
const ENV = path.join(TMP, '.env');
fs.writeFileSync(ENV, '# Kommentar bleibt erhalten\nPORT=3001\n');
process.env.ENV_DATEI = ENV;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.KI_MODELL;

const { config } = await import('../src/config.js');
const ki = await import('../src/ki.js');
const { erstelleServer } = await import('../server.js');
const { envAktualisieren, kostenBerechnen, usageAddieren, schluesselGueltig } = await import('../src/einstellungen.js');
const { schwaerzen } = await import('../src/datenschutz.js');

const SCHLUESSEL = `sk-ant-api03-${'x'.repeat(40)}abcd`;
let modus = 'ok';
const gesendet = [];

ki.setClientFabrik((apiKey) => ({
  models: {
    retrieve: async (id) => {
      if (apiKey.endsWith('FALSCH')) throw new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers());
      return { id, display_name: id, capabilities: { server_tools: { web_search: { supported: true } }, pdf_input: { supported: true } } };
    },
  },
  messages: {
    create: async (params) => {
      gesendet.push(params);
      if (modus === 'guthaben') {
        const text = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.';
        throw new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: text } }, text, new Headers());
      }
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'OK' }], usage: { input_tokens: 20, output_tokens: 30 } };
    },
  },
  beta: {
    messages: {
      create: async (params) => {
        gesendet.push(params);
        if (modus === 'websuche-aus') {
          const text = 'web search is not enabled for this organization';
          throw new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: text } }, text, new Headers());
        }
        return {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: JSON.stringify({ dokumenttyp: 'lebenslauf', zusammenfassung: '', stationen: [], bildung: [], fachkenntnisse: [], software: [], sprachen: [], zeugnis: { leistungsnote: null, verhaltensnote: null, begruendung: '', versteckteHinweise: [], schlussformel: '' }, noten: [], auffaelligkeiten: [], rueckfragen: [] }) }],
          usage: { input_tokens: 10000, output_tokens: 2000, server_tool_use: { web_search_requests: 3 } },
        };
      },
    },
  },
}));

let server;
let port;
before(async () => {
  server = erstelleServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(() => {
  server.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

function anfrage(pfad, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const daten = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, method: body === undefined ? 'GET' : 'POST', path: pfad, headers: { 'Content-Type': 'application/json', ...headers } }, (res) => {
      let roh = '';
      res.on('data', (c) => { roh += c; });
      res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(roh || '{}'), roh }));
    });
    req.on('error', reject);
    if (daten) req.write(daten);
    req.end();
  });
}

test('Einrichtung: Ausgangslage ohne Schlüssel', async () => {
  const r = await anfrage('/api/status');
  assert.equal(r.json.kiVerfuegbar, false);
  assert.equal(r.json.ki.schluessel, null);
  assert.deepEqual(r.json.modelle.map((m) => m.id), ['claude-opus-5-5', 'claude-sonnet-5-5']);
  const hr = await anfrage('/api/ki/hr', { profil: {} }, { 'X-KI-Einwilligung': 'ja' });
  assert.equal(hr.status, 503);
  assert.equal(hr.json.code, 'nicht-eingerichtet');
});

test('Einrichtung: ungültige Schlüssel werden abgelehnt, .env bleibt unverändert', async () => {
  for (const falsch of ['abc', 'sk-ant-kurz', `sk-ant-${'a'.repeat(30)}\nFOO=1`, `sk-ant-${'a'.repeat(30)}"`]) {
    const r = await anfrage('/api/ki/einrichten', { apiKey: falsch });
    assert.equal(r.status, 400, falsch);
    assert.equal(r.json.code, 'schluessel-format');
  }
  const abgelehnt = await anfrage('/api/ki/einrichten', { apiKey: `sk-ant-api03-${'y'.repeat(30)}FALSCH` });
  assert.equal(abgelehnt.status, 401);
  assert.equal(abgelehnt.json.code, 'schluessel');
  assert.equal(fs.readFileSync(ENV, 'utf8'), '# Kommentar bleibt erhalten\nPORT=3001\n');
});

test('Einrichtung: gültiger Schlüssel wird geprüft, gespeichert und sofort genutzt', async () => {
  const r = await anfrage('/api/ki/einrichten', { apiKey: SCHLUESSEL, modell: 'claude-sonnet-5-5' });
  assert.equal(r.status, 200);
  assert.equal(r.json.kiVerfuegbar, true);
  assert.equal(r.json.ki.schluessel, 'sk-ant-…abcd');
  assert.equal(r.json.ki.websuche, true);
  assert.ok(!r.roh.includes(SCHLUESSEL), 'Schlüssel darf nie an den Browser zurück');
  const env = fs.readFileSync(ENV, 'utf8');
  assert.match(env, /^# Kommentar bleibt erhalten$/m);
  assert.match(env, /^PORT=3001$/m);
  assert.ok(env.includes(`ANTHROPIC_API_KEY=${SCHLUESSEL}`));
  assert.match(env, /^KI_MODELL=claude-sonnet-5-5$/m);
  assert.equal(config.kiModell, 'claude-sonnet-5-5');
});

test('Einrichtung: Verbindungstest mit Kosten, Fehler „kein Guthaben“ verständlich', async () => {
  const ok = await anfrage('/api/ki/testen', {});
  assert.equal(ok.status, 200);
  assert.equal(ok.json.ok, true);
  assert.equal(ok.json.kosten.usd, 0.0003); // 20 × 2 $ + 30 × 10 $ pro Mio. Token (Sonnet 5.5)
  assert.equal(gesendet.at(-1).model, 'claude-sonnet-5-5');
  modus = 'guthaben';
  const leer = await anfrage('/api/ki/testen', {});
  assert.equal(leer.status, 402);
  assert.equal(leer.json.code, 'guthaben');
  assert.match(leer.json.fehler, /Guthaben/);
  modus = 'ok';
});

test('Einrichtung: Modell wechseln aktualisiert .env', async () => {
  const r = await anfrage('/api/ki/modell', { modell: 'claude-opus-5-5' });
  assert.equal(r.json.ki.modell, 'claude-opus-5-5');
  assert.match(fs.readFileSync(ENV, 'utf8'), /^KI_MODELL=claude-opus-5-5$/m);
  assert.equal((await anfrage('/api/ki/modell', { modell: 'gpt-irgendwas' })).status, 400);
});

test('Datensparmodus: Dokumenttext wird geschwärzt übertragen, Kosten mit Websuche', async () => {
  const text = 'Lebenslauf\nErika Beispiel\nMusterweg 1, 12345 Musterstadt\nTelefon: 0123 456789\nE-Mail: erika.beispiel@example.com\n08/2017 – 12/2020 Kauffrau';
  const r = await anfrage('/api/ki/dokument', { name: 'Lebenslauf_Erika_Beispiel.pdf', mime: 'application/pdf', text, namen: ['Erika', 'Beispiel'] }, { 'X-KI-Einwilligung': 'ja' });
  assert.equal(r.status, 200);
  assert.equal(r.json.uebertragen.art, 'Text (geschwärzt)');
  assert.ok(r.json.uebertragen.geschwaerzt >= 5);
  const inhalt = JSON.stringify(gesendet.at(-1).messages);
  for (const privat of ['Erika', 'Beispiel', 'Musterweg', '12345', '0123 456789', 'example.com']) assert.ok(!inhalt.includes(privat), privat);
  assert.ok(inhalt.includes('08/2017 – 12/2020 Kauffrau'), 'Zeiträume bleiben erhalten');
  assert.equal(r.json.kosten.usd, 0.11); // 10.000 × 4 $ + 2.000 × 20 $ pro Mio. + 3 Suchen × 0,01 $
});

test('Fehler „Websuche deaktiviert“ wird erkannt', async () => {
  modus = 'websuche-aus';
  const r = await anfrage('/api/ki/jobs', { was: 'Koch' }, { 'X-KI-Einwilligung': 'ja' });
  assert.equal(r.json.code, 'websuche-aus');
  modus = 'ok';
});

test('Einrichtung: Schlüssel entfernen', async () => {
  const r = await anfrage('/api/ki/entfernen', {});
  assert.equal(r.json.kiVerfuegbar, false);
  const env = fs.readFileSync(ENV, 'utf8');
  assert.ok(!env.includes('ANTHROPIC_API_KEY'));
  assert.match(env, /^PORT=3001$/m);
});

test('Server: POST nur als JSON', async () => {
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: '/api/ki/einrichten', headers: { 'Content-Type': 'text/plain' } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end(`apiKey=${SCHLUESSEL}`);
  });
  assert.equal(status, 415);
});

test('Einstellungen: .env-Aktualisierung, Schlüsselformat, Kosten', () => {
  const datei = path.join(TMP, 'test.env');
  envAktualisieren(datei, { A_B: '1' });
  envAktualisieren(datei, { A_B: '2', C: 'x' });
  assert.equal(fs.readFileSync(datei, 'utf8'), 'A_B=2\nC=x\n');
  envAktualisieren(datei, { A_B: null });
  assert.equal(fs.readFileSync(datei, 'utf8'), 'C=x\n');
  assert.throws(() => envAktualisieren(datei, { C: 'a\nB=1' }), /Ungültiger Wert/);
  assert.ok(schluesselGueltig(SCHLUESSEL));
  assert.ok(!schluesselGueltig(`${SCHLUESSEL} `));
  const summe = usageAddieren(usageAddieren({}, { input_tokens: 100, output_tokens: 10, server_tool_use: { web_search_requests: 2 } }), { input_tokens: 50, output_tokens: 5 });
  assert.deepEqual(kostenBerechnen(summe, 'claude-opus-5-5'), { modell: 'claude-opus-5-5', eingabeToken: 150, ausgabeToken: 15, websuchen: 2, usd: 0.0209 });
  assert.equal(kostenBerechnen(summe, 'unbekannt').usd, null);
});

test('Schwärzen: Kontaktdaten weg, Datumsangaben und Fachinhalte bleiben', () => {
  const r = schwaerzen('Herr Dr. Max Muster, geb. 01.02.1990, Hauptstraße 5a, 10115 Berlin, Tel. +49 30 1234567, IBAN DE89 3704 0044 0532 0130 00. Gehalt 45000 Euro. 08/2014 - 06/2017 Ausbildung, 01.08.2017 bis 31.12.2020 bei der Firma.');
  assert.equal(r.text, 'Herr [Name], geb. [Datum], [Anschrift], [PLZ Ort], Tel. [Telefon], IBAN [IBAN]. Gehalt 45000 Euro. 08/2014 - 06/2017 Ausbildung, 01.08.2017 bis 31.12.2020 bei der Firma.');
  assert.equal(r.anzahl, 6);
});
