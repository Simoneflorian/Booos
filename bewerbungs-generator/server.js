#!/usr/bin/env node
// Bewerbungs-Generator – lokaler Server. Start: npm start → http://localhost:3000
// Der Server speichert nichts: Alle Daten bleiben im Browser bzw. werden nur für die jeweilige Anfrage verarbeitet.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/config.js';
import { textExtrahieren, lokalAuswerten, mimeAusName } from './src/dokumente.js';
import { analysiereProfil } from './src/hr-analyse.js';
import { pruefeLeistungen } from './src/leistungen.js';
import { steuerTipps } from './src/steuer.js';
import { sucheJobs } from './src/jobsuche.js';
import { anschreibenVorlage } from './src/anschreiben.js';
import * as ki from './src/ki.js';

const PUBLIC = path.join(config.root, 'public');
const TYPEN = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };

class HttpFehler extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function senden(res, status, daten) {
  const body = JSON.stringify(daten);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function jsonLesen(req) {
  const max = config.maxUploadMb * 1024 * 1024 * 1.4; // Base64 ist ca. 33 % größer
  const teile = [];
  let groesse = 0;
  for await (const teil of req) {
    groesse += teil.length;
    if (groesse > max) throw new HttpFehler(413, `Die Datei ist zu groß (maximal ${config.maxUploadMb} MB).`);
    teile.push(teil);
  }
  try {
    return JSON.parse(Buffer.concat(teile).toString('utf8') || '{}');
  } catch {
    throw new HttpFehler(400, 'Ungültige Anfrage (kein JSON).');
  }
}

// Schutz für einen lokalen Server mit sensiblen Daten: nur Anfragen von dieser App selbst annehmen.
function herkunftPruefen(req) {
  const host = String(req.headers.host || '').replace(/:\d+$/, '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) throw new HttpFehler(403, 'Zugriff nur über localhost erlaubt.');
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) throw new HttpFehler(403, 'Fremde Herkunft abgelehnt.');
}

function kiErlaubt(req) {
  if (req.headers['x-ki-einwilligung'] !== 'ja') throw new HttpFehler(403, 'Der KI-Modus wurde nicht freigegeben. Bitte unter „Start“ einwilligen.');
}

function steuerErlaubt(body) {
  if (body?.einwilligung !== true) throw new HttpFehler(403, 'Für Steuertipps ist deine ausdrückliche Einwilligung nötig.');
}

function dateiAusBody(body) {
  if (!body?.name || !body?.daten) throw new HttpFehler(400, 'Datei fehlt.');
  const buffer = Buffer.from(String(body.daten), 'base64');
  if (!buffer.length) throw new HttpFehler(400, 'Die Datei ist leer.');
  return { name: String(body.name).slice(0, 200), mime: mimeAusName(body.name, body.mime), buffer };
}

const ROUTEN = {
  'GET /api/status': async () => ({ kiVerfuegbar: config.kiAktiv, modell: config.kiAktiv ? config.kiModell : null, version: '0.1.0' }),

  'POST /api/dokument': async (body) => {
    const datei = dateiAusBody(body);
    let extrakt;
    try {
      extrakt = await textExtrahieren(datei);
    } catch (e) {
      throw new HttpFehler(422, e.message.startsWith('Dateityp') ? e.message : `Die Datei konnte nicht gelesen werden: ${e.message}`);
    }
    return { name: datei.name, mime: datei.mime, ...extrakt, analyse: lokalAuswerten(extrakt.text, datei.name) };
  },

  'POST /api/ki/dokument': async (body, req) => {
    kiErlaubt(req);
    const datei = body.daten ? dateiAusBody(body) : { name: body.name, mime: body.mime };
    return ki.dokumentAuswerten({ name: datei.name, mime: datei.mime, base64: body.daten, text: body.text });
  },

  'POST /api/hr': async (body) => analysiereProfil(body.profil || {}, body.dokumente || []),

  'POST /api/ki/hr': async (body, req) => {
    kiErlaubt(req);
    return ki.hrEinschaetzung({ profil: body.profil || {}, lokaleAnalyse: body.lokaleAnalyse, dokumentZusammenfassungen: body.dokumentZusammenfassungen });
  },

  'POST /api/jobs': async (body) => {
    try {
      return await sucheJobs(body.parameter || {}, body.profil);
    } catch (e) {
      throw new HttpFehler(502, e.message);
    }
  },

  'POST /api/ki/jobs': async (body, req) => {
    kiErlaubt(req);
    return ki.jobsWebsuche({ was: body.was, wo: body.wo, profilKurz: body.profilKurz });
  },

  'POST /api/leistungen': async (body) => pruefeLeistungen(body.situation || {}),

  'POST /api/ki/leistungen': async (body, req) => {
    kiErlaubt(req);
    return ki.leistungenRecherche({ situation: body.situation || {}, lokaleErgebnisse: body.lokaleErgebnisse || [] });
  },

  'POST /api/steuer': async (body) => {
    steuerErlaubt(body);
    return steuerTipps(body.steuer || {}, body.situation || {});
  },

  'POST /api/ki/steuer': async (body, req) => {
    kiErlaubt(req);
    steuerErlaubt(body);
    return ki.steuerRecherche({ steuer: body.steuer || {}, situation: body.situation || {}, lokaleTipps: body.lokaleTipps || [] });
  },

  'POST /api/anschreiben': async (body) => anschreibenVorlage(body.profil || {}, body.stellenanzeige || ''),

  'POST /api/ki/anschreiben': async (body, req) => {
    kiErlaubt(req);
    if (!String(body.stellenanzeige || '').trim()) throw new HttpFehler(400, 'Bitte den Text der Stellenanzeige einfügen.');
    return ki.anschreibenErstellen({ profil: ki.ohneKontaktdaten(body.profil || {}), stellenanzeige: body.stellenanzeige, hinweise: body.hinweise });
  },
};

async function statischeDatei(req, res) {
  let pfad = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pfad === '/') pfad = '/index.html';
  const datei = path.normalize(path.join(PUBLIC, pfad));
  if (!datei.startsWith(PUBLIC + path.sep)) throw new HttpFehler(404, 'Nicht gefunden');
  let inhalt;
  try {
    inhalt = await fs.readFile(datei);
  } catch {
    throw new HttpFehler(404, 'Nicht gefunden');
  }
  res.writeHead(200, {
    'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(inhalt);
}

export function erstelleServer() {
  return http.createServer(async (req, res) => {
    try {
      herkunftPruefen(req);
      const pfad = new URL(req.url, 'http://localhost').pathname;
      const route = ROUTEN[`${req.method} ${pfad}`];
      if (route) {
        const body = req.method === 'POST' ? await jsonLesen(req) : {};
        senden(res, 200, await route(body, req));
      } else if (pfad.startsWith('/api/')) {
        throw new HttpFehler(404, 'Unbekannte Schnittstelle.');
      } else if (req.method === 'GET') {
        await statischeDatei(req, res);
      } else {
        throw new HttpFehler(405, 'Methode nicht erlaubt.');
      }
    } catch (e) {
      const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
      if (status === 500) console.error(e);
      if (!res.headersSent) senden(res, status, { fehler: status === 500 ? 'Interner Fehler – Details im Terminal.' : e.message });
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  erstelleServer().listen(config.port, config.host, () => {
    console.log('Bewerbungs-Generator läuft:');
    console.log(`  → http://localhost:${config.port}`);
    console.log(config.kiAktiv ? `  KI-Modus verfügbar (Modell: ${config.kiModell})` : '  KI-Modus aus (kein ANTHROPIC_API_KEY in .env) – alle lokalen Funktionen laufen trotzdem.');
    console.log('Beenden mit Strg+C');
  });
}
