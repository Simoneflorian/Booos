#!/usr/bin/env node
// Kleiner statischer Webserver für die lokale Vorschau (ohne zusätzliche Pakete).
// Start: npm run preview  →  http://localhost:8080
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib');

const PORT = parseInt(process.env.PORT, 10) || 8080;

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
  '.mjml': 'text/plain; charset=utf-8',
};

// Nur die Demo-Ordner ausliefern, nicht z. B. node_modules oder andere Projektdateien.
const FREIGEGEBEN = ['index.html', 'landingpage', 'emails/html', 'emails/assets', 'automation/ausgabe'];

const server = http.createServer((req, res) => {
  let url;
  try {
    url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400).end('Ungültige Adresse');
    return;
  }
  if (url.endsWith('/')) url += 'index.html';
  const datei = path.normalize(path.join(ROOT, url));
  const rel = path.relative(ROOT, datei).split(path.sep).join('/');

  const erlaubt = !rel.startsWith('..') && FREIGEGEBEN.some((f) => rel === f || rel.startsWith(f + '/'));
  if (!erlaubt) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
    return;
  }

  fs.readFile(datei, (err, inhalt) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(inhalt);
  });
});

server.listen(PORT, () => {
  console.log('Demo läuft lokal:');
  console.log(`  Übersicht:     http://localhost:${PORT}/`);
  console.log(`  Anmeldeseite:  http://localhost:${PORT}/landingpage/`);
  console.log(`  Aushang A5:    http://localhost:${PORT}/landingpage/aushang.html`);
  console.log('Beenden mit Strg+C');
});
