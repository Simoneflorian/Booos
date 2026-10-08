import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import * as ki from '../src/ki.js';
import { config } from '../src/config.js';
import { erstelleServer } from '../server.js';

const ROOT = path.resolve(import.meta.dirname, '..');

// --- Simulierte Claude API ---

function fakeClient(antworten) {
  const aufrufe = [];
  return {
    aufrufe,
    beta: {
      messages: {
        create: async (params) => {
          aufrufe.push(structuredClone(params));
          const naechste = antworten.shift();
          if (naechste instanceof Error) throw naechste;
          return naechste;
        },
      },
    },
  };
}

const textAntwort = (text, extra = {}) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }], ...extra });

function pruefeSchema(schema, pfad = 'schema') {
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false, `${pfad}: additionalProperties muss false sein`);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(), `${pfad}: alle Felder müssen required sein`);
    for (const [k, v] of Object.entries(schema.properties)) pruefeSchema(v, `${pfad}.${k}`);
  }
  if (schema.type === 'array') pruefeSchema(schema.items, `${pfad}[]`);
}

test('KI: Dokumentauswertung sendet PDF, strukturiertes Schema, Modell und Fallback', async () => {
  const ergebnis = { dokumenttyp: 'arbeitszeugnis', zusammenfassung: 'Gutes Zeugnis', stationen: [], bildung: [], fachkenntnisse: [], software: [], sprachen: [], zeugnis: { leistungsnote: 2, verhaltensnote: 2, begruendung: '', versteckteHinweise: [], schlussformel: 'vollständig' }, noten: [], auffaelligkeiten: [], rueckfragen: ['Welche Erfolge?'] };
  const client = fakeClient([textAntwort(JSON.stringify(ergebnis))]);
  ki.setKiClient(client);
  const r = await ki.dokumentAuswerten({ name: 'z.pdf', mime: 'application/pdf', base64: 'JVBERi0=' });
  const { kosten, uebertragen, ...rest } = r;
  assert.deepEqual(rest, ergebnis);
  assert.equal(uebertragen.art, 'PDF-Datei (vollständig)');
  assert.equal(kosten.modell, config.kiModell);
  const p = client.aufrufe[0];
  assert.equal(p.model, config.kiModell);
  assert.equal(p.content, undefined);
  assert.equal(p.messages[0].content[0].type, 'document');
  assert.equal(p.messages[0].content[0].source.media_type, 'application/pdf');
  assert.equal(p.output_config.format.type, 'json_schema');
  assert.equal(p.output_config.effort, 'medium');
  assert.equal(p.thinking, undefined);
  pruefeSchema(p.output_config.format.schema);
  if (config.kiModell.startsWith('claude-opus-5')) {
    assert.equal(p.fallbacks, 'default');
    assert.deepEqual(p.betas, ['server-side-fallback-2026-07-01']);
  }
  assert.match(p.system, /AGG/);
});

test('KI: Fotos werden als Bild, DOCX-Text als Text gesendet', async () => {
  const leer = JSON.stringify({ dokumenttyp: 'sonstiges', zusammenfassung: '', stationen: [], bildung: [], fachkenntnisse: [], software: [], sprachen: [], zeugnis: { leistungsnote: null, verhaltensnote: null, begruendung: '', versteckteHinweise: [], schlussformel: '' }, noten: [], auffaelligkeiten: [], rueckfragen: [] });
  const client = fakeClient([textAntwort(leer), textAntwort(leer)]);
  ki.setKiClient(client);
  await ki.dokumentAuswerten({ name: 'scan.jpg', mime: 'image/jpeg', base64: '/9j/' });
  await ki.dokumentAuswerten({ name: 'cv.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text: 'Lebenslauf …' });
  assert.equal(client.aufrufe[0].messages[0].content[0].type, 'image');
  assert.equal(client.aufrufe[1].messages[0].content[0].type, 'text');
});

test('KI: HR- und Anschreiben-Schemas sind gültig, Kontaktdaten gehen nicht raus', async () => {
  const hr = { gesamtbild: '', einordnung: [], staerken: [], risiken: [], passendeRollen: [], gehalt: '', atsSchluesselwoerter: [], naechsteSchritte: [], rueckfragen: [] };
  const client = fakeClient([textAntwort(JSON.stringify(hr)), textAntwort(JSON.stringify({ betreff: 'B', anschreiben: 'A [Name]', hinweise: [] }))]);
  ki.setKiClient(client);
  const profil = { persoenlich: { vorname: 'Erika', nachname: 'Beispiel', email: 'e@example.com', telefon: '0123', ort: 'Musterstadt' }, wunsch: { positionen: 'Buchhalterin' } };
  await ki.hrEinschaetzung({ profil, lokaleAnalyse: {} });
  await ki.anschreibenErstellen({ profil: ki.ohneKontaktdaten(profil), stellenanzeige: 'Buchhalter gesucht' });
  for (const aufruf of client.aufrufe) {
    pruefeSchema(aufruf.output_config.format.schema);
    const gesendet = JSON.stringify(aufruf.messages);
    assert.ok(!gesendet.includes('Erika') && !gesendet.includes('e@example.com') && !gesendet.includes('0123'), 'Kontaktdaten dürfen nicht gesendet werden');
    assert.ok(gesendet.includes('Musterstadt'));
  }
  assert.equal(client.aufrufe[0].output_config.effort, 'high');
});

test('KI: Websuche fortsetzen bei pause_turn und Quellen sammeln', async () => {
  const pausiert = { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 'srv_1', name: 'web_search', input: { query: 'Wohngeld 2026' } }] };
  const fertig = {
    stop_reason: 'end_turn',
    content: [
      { type: 'web_search_tool_result', tool_use_id: 'srv_1', content: [{ type: 'web_search_result', url: 'https://www.arbeitsagentur.de/a', title: 'BA' }, { type: 'web_search_result', url: 'https://forum.example/b', title: 'Forum' }] },
      { type: 'text', text: '## Ergebnis\n[Offiziell] Text', citations: [{ type: 'web_search_result_location', url: 'https://www.arbeitsagentur.de/a', title: 'BA', cited_text: '…' }] },
    ],
  };
  const client = fakeClient([pausiert, fertig]);
  ki.setKiClient(client);
  const r = await ki.leistungenRecherche({ situation: { erwerbsstatus: 'arbeitslos' }, lokaleErgebnisse: [{ name: 'Wohngeld' }] });
  assert.equal(client.aufrufe.length, 2);
  assert.equal(client.aufrufe[1].messages.at(-1).role, 'assistant');
  assert.equal(client.aufrufe[0].tools[0].type, 'web_search_20260209');
  assert.equal(client.aufrufe[0].output_config.format, undefined, 'Websuche nicht mit strukturierter Ausgabe kombinieren');
  assert.match(r.text, /Ergebnis/);
  assert.deepEqual(r.quellen.map((q) => q.url), ['https://www.arbeitsagentur.de/a', 'https://forum.example/b']);
});

test('KI: Job-Websuche nutzt den Ort für die Suche', async () => {
  const client = fakeClient([textAntwort('- **Stelle** – Firma – Ort')]);
  ki.setKiClient(client);
  await ki.jobsWebsuche({ was: 'Buchhalter', wo: 'Hamburg' });
  assert.deepEqual(client.aufrufe[0].tools[0].user_location, { type: 'approximate', country: 'DE', city: 'Hamburg' });
});

test('KI: Ablehnung und API-Fehler werden verständlich gemeldet', async () => {
  ki.setKiClient(fakeClient([{ stop_reason: 'refusal', stop_details: { type: 'refusal', category: null }, content: [] }]));
  await assert.rejects(ki.jobsWebsuche({ was: 'x' }), (e) => e instanceof ki.KiFehler && e.status === 422);

  ki.setKiClient(fakeClient([new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }, 'invalid x-api-key', new Headers())]));
  await assert.rejects(ki.jobsWebsuche({ was: 'x' }), (e) => e.status === 401 && /API-Schlüssel/.test(e.message));

  ki.setKiClient(fakeClient([new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, 'slow down', new Headers())]));
  await assert.rejects(ki.jobsWebsuche({ was: 'x' }), (e) => e.status === 429);

  ki.setKiClient(fakeClient([textAntwort('kein json')]));
  await assert.rejects(ki.hrEinschaetzung({ profil: {} }), /nicht gelesen/);
});

// --- Server ---

let server;
let port;

before(async () => {
  server = erstelleServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});

after(() => server.close());

function anfrage(methode, pfad, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const daten = body === undefined ? undefined : JSON.stringify(body);
    const req = http.request({ host: '127.0.0.1', port, method: methode, path: pfad, headers: { 'Content-Type': 'application/json', ...(daten ? { 'Content-Length': Buffer.byteLength(daten) } : {}), ...headers } }, (res) => {
      let roh = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { roh += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(roh); } catch { /* HTML */ }
        resolve({ status: res.statusCode, headers: res.headers, json, roh });
      });
    });
    req.on('error', reject);
    if (daten) req.write(daten);
    req.end();
  });
}

const datei = (name) => fs.readFileSync(path.join(ROOT, name)).toString('base64');

test('Server: Startseite mit Sicherheits-Headern, Status-Schnittstelle', async () => {
  const seite = await anfrage('GET', '/');
  assert.equal(seite.status, 200);
  assert.match(seite.roh, /Bewerbungs-Generator/);
  assert.match(seite.headers['content-security-policy'], /default-src 'self'/);
  const status = await anfrage('GET', '/api/status');
  assert.equal(typeof status.json.kiVerfuegbar, 'boolean');
});

test('Server: Schutz vor Pfad-Tricks und fremden Seiten', async () => {
  assert.equal((await anfrage('GET', '/%2e%2e/server.js')).status, 404);
  assert.equal((await anfrage('GET', '/api/status', undefined, { Host: 'evil.example' })).status, 403);
  assert.equal((await anfrage('POST', '/api/hr', {}, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await anfrage('GET', '/api/gibtsnicht')).status, 404);
});

test('Server: Dokumente (TXT und PDF) werden gelesen und ausgewertet', async () => {
  const txt = await anfrage('POST', '/api/dokument', { name: 'lebenslauf.txt', mime: 'text/plain', daten: datei('beispiel/lebenslauf-beispiel.txt') });
  assert.equal(txt.status, 200);
  assert.equal(txt.json.analyse.art.art, 'lebenslauf');
  const pdf = await anfrage('POST', '/api/dokument', { name: 'zeugnis.pdf', daten: datei('test/fixtures/arbeitszeugnis.pdf') });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.json.analyse.arbeitszeugnis.gesamtnote, 2);
  const falsch = await anfrage('POST', '/api/dokument', { name: 'x.exe', daten: Buffer.from('MZ').toString('base64') });
  assert.equal(falsch.status, 422);
  assert.equal((await anfrage('POST', '/api/dokument', { name: 'leer.txt' })).status, 400);
});

test('Server: HR, Leistungen und Anschreiben ohne KI', async () => {
  const hr = await anfrage('POST', '/api/hr', { profil: { stationen: [{ position: 'Buchhalterin', von: '2020-01' }] }, dokumente: [] });
  assert.equal(hr.status, 200);
  assert.ok(hr.json.kategorisierung.anforderungsniveau.name);
  const l = await anfrage('POST', '/api/leistungen', { situation: { erwerbsstatus: 'gekuendigt' } });
  assert.equal(l.json.ergebnisse[0].id, 'kuendigungsschutz');
  const a = await anfrage('POST', '/api/anschreiben', { profil: {}, stellenanzeige: 'Koch (m/w/d)' });
  assert.equal(a.json.betreff, 'Bewerbung als Koch (m/w/d)');
});

test('Server: Steuertipps nur mit Einwilligung', async () => {
  assert.equal((await anfrage('POST', '/api/steuer', { steuer: {} })).status, 403);
  const ok = await anfrage('POST', '/api/steuer', { einwilligung: true, steuer: { homeofficeTage: '100' } });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.werbungskosten.posten[0].betrag, 600);
});

test('Server: KI-Schnittstellen nur mit Einwilligung des Nutzers', async () => {
  for (const pfad of ['/api/ki/hr', '/api/ki/jobs', '/api/ki/leistungen', '/api/ki/dokument', '/api/ki/anschreiben']) {
    assert.equal((await anfrage('POST', pfad, {})).status, 403, pfad);
  }
  assert.equal((await anfrage('POST', '/api/ki/steuer', { steuer: {} }, { 'X-KI-Einwilligung': 'ja' })).status, 403);
  assert.equal((await anfrage('POST', '/api/ki/anschreiben', { profil: {} }, { 'X-KI-Einwilligung': 'ja' })).status, 400);
});

test('Server: KI-Anfrage läuft durch und entfernt Kontaktdaten', async () => {
  const client = fakeClient([textAntwort(JSON.stringify({ betreff: 'B', anschreiben: 'Text\n\n[Name]', hinweise: [] }))]);
  ki.setKiClient(client);
  const r = await anfrage('POST', '/api/ki/anschreiben', { profil: { persoenlich: { vorname: 'Erika', email: 'e@example.com' } }, stellenanzeige: 'Koch' }, { 'X-KI-Einwilligung': 'ja' });
  assert.equal(r.status, 200);
  assert.equal(r.json.betreff, 'B');
  assert.ok(!JSON.stringify(client.aufrufe[0].messages).includes('Erika'));
});
