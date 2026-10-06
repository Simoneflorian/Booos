// Gemeinsame Hilfsfunktionen für Build-Skript und Automatisierung.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function pfad(...teile) {
  return path.join(ROOT, ...teile);
}

function leseJson(relPfad) {
  return JSON.parse(fs.readFileSync(pfad(relPfad), 'utf8'));
}

// Einfacher CSV-Parser (Trennzeichen Komma, Felder optional in Anführungszeichen).
function leseCsv(relPfad) {
  const text = fs.readFileSync(pfad(relPfad), 'utf8').replace(/^﻿/, '');
  const zeilen = [];
  let feld = '';
  let zeile = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else feld += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { zeile.push(feld); feld = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      zeile.push(feld); feld = '';
      if (zeile.some((f) => f.trim() !== '')) zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  zeile.push(feld);
  if (zeile.some((f) => f.trim() !== '')) zeilen.push(zeile);

  const [kopf, ...daten] = zeilen;
  return daten.map((z) => Object.fromEntries(kopf.map((k, i) => [k.trim(), (z[i] || '').trim()])));
}

// --- Datum (immer als UTC-Mitternacht, damit keine Zeitzonen-Verschiebungen entstehen) ---

function parseDatum(iso) {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Ungültiges Datum "${iso}" (erwartet JJJJ-MM-TT)`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

function heute() {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function plusTage(datum, tage) {
  return new Date(datum.getTime() + tage * 86400000);
}

// Monate addieren; der 31.01. + 1 Monat wird zum 28./29.02. (nicht zum 03.03.).
function plusMonate(datum, monate) {
  const j = datum.getUTCFullYear();
  const m = datum.getUTCMonth() + monate;
  const letzterTag = new Date(Date.UTC(j, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(j, m, Math.min(datum.getUTCDate(), letzterTag)));
}

function isoDatum(datum) {
  return datum.toISOString().slice(0, 10);
}

function deDatum(datum) {
  const [j, m, t] = isoDatum(datum).split('-');
  return `${t}.${m}.${j}`;
}

// --- Platzhalter ---

function escapeHtml(wert) {
  return String(wert)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Ersetzt {{name}} durch Werte. Gibt den Text und die Liste nicht gefüllter Platzhalter zurück.
function fuellePlatzhalter(text, werte, { html = true } = {}) {
  const fehlend = new Set();
  const ergebnis = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (treffer, name) => {
    if (werte[name] === undefined || werte[name] === null || werte[name] === '') {
      fehlend.add(name);
      return treffer;
    }
    return html ? escapeHtml(werte[name]) : String(werte[name]);
  });
  return { text: ergebnis, fehlend: [...fehlend] };
}

function findePlatzhalter(text) {
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))];
}

module.exports = {
  ROOT, pfad, leseJson, leseCsv,
  parseDatum, heute, plusTage, plusMonate, isoDatum, deDatum,
  escapeHtml, fuellePlatzhalter, findePlatzhalter,
};
