// KI-Einstellungen: unterstützte Modelle mit Preisen, Schlüssel-Prüfung, sicheres Schreiben der .env, Kostenberechnung.
import fs from 'node:fs';
import path from 'node:path';

// Preise in US-Dollar pro 1 Mio. Token (Claude API, Stand Oktober 2026 – https://platform.claude.com/docs/en/about-claude/pricing)
export const MODELLE = {
  'claude-opus-5-5': {
    name: 'Claude Opus 5.5',
    beschreibung: 'Empfohlen – beste Qualität bei Analyse, Zeugnissprache und Texten',
    eingabe: 4,
    ausgabe: 20,
    cacheSchreiben: 5,
    cacheLesen: 0.2,
  },
  'claude-sonnet-5-5': {
    name: 'Claude Sonnet 5.5',
    beschreibung: 'Etwa halb so teuer, schnell, etwas weniger gründlich',
    eingabe: 2,
    ausgabe: 10,
    cacheSchreiben: 2.5,
    cacheLesen: 0.1,
  },
};

export const WEBSUCHE_PRO_SUCHE = 10 / 1000; // 10 $ pro 1.000 Suchen

// Strenges Format: verhindert, dass über das Eingabefeld zusätzliche Zeilen in die .env geschrieben werden.
const SCHLUESSEL_FORMAT = /^sk-ant-[A-Za-z0-9_-]{20,200}$/;

export function schluesselGueltig(schluessel) {
  return typeof schluessel === 'string' && SCHLUESSEL_FORMAT.test(schluessel);
}

export function schluesselHinweis(schluessel) {
  return schluessel ? `sk-ant-…${schluessel.slice(-4)}` : null;
}

// Ändert einzelne Einträge der .env und lässt alle anderen Zeilen (inkl. Kommentare) unverändert.
// Wert null entfernt den Eintrag. Geschrieben wird erst in eine temporäre Datei, dann umbenannt.
export function envAktualisieren(datei, aenderungen) {
  for (const [name, wert] of Object.entries(aenderungen)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) throw new Error(`Ungültiger Name: ${name}`);
    if (wert !== null && /[\r\n"'\\#]/.test(String(wert))) throw new Error(`Ungültiger Wert für ${name}`);
  }
  let zeilen = [];
  try {
    zeilen = fs.readFileSync(datei, 'utf8').split(/\r?\n/);
    if (zeilen.at(-1) === '') zeilen.pop();
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  for (const [name, wert] of Object.entries(aenderungen)) {
    const muster = new RegExp(`^\\s*${name}\\s*=`);
    const index = zeilen.findIndex((z) => muster.test(z));
    if (wert === null) {
      if (index !== -1) zeilen.splice(index, 1);
    } else if (index !== -1) {
      zeilen[index] = `${name}=${wert}`;
    } else {
      zeilen.push(`${name}=${wert}`);
    }
  }
  const temp = path.join(path.dirname(datei), `.env.${process.pid}.tmp`);
  fs.writeFileSync(temp, `${zeilen.join('\n')}\n`, { mode: 0o600 });
  fs.renameSync(temp, datei);
}

export function usageAddieren(summe, usage) {
  if (!usage) return summe;
  return {
    input_tokens: (summe.input_tokens || 0) + (usage.input_tokens || 0),
    output_tokens: (summe.output_tokens || 0) + (usage.output_tokens || 0),
    cache_creation_input_tokens: (summe.cache_creation_input_tokens || 0) + (usage.cache_creation_input_tokens || 0),
    cache_read_input_tokens: (summe.cache_read_input_tokens || 0) + (usage.cache_read_input_tokens || 0),
    // Rohdaten der API (server_tool_use) oder bereits summierte Werte
    web_search_requests: (summe.web_search_requests || 0) + (usage.server_tool_use?.web_search_requests ?? usage.web_search_requests ?? 0),
  };
}

// Kosten einer Anfrage in US-Dollar aus den Verbrauchsdaten der API.
export function kostenBerechnen(usage, modell) {
  const preis = MODELLE[modell];
  const u = usageAddieren({}, usage);
  const ergebnis = {
    modell,
    eingabeToken: u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens,
    ausgabeToken: u.output_tokens,
    websuchen: u.web_search_requests,
    usd: null,
  };
  if (!preis) return ergebnis;
  const usd = (u.input_tokens * preis.eingabe
    + u.cache_creation_input_tokens * preis.cacheSchreiben
    + u.cache_read_input_tokens * preis.cacheLesen
    + u.output_tokens * preis.ausgabe) / 1e6
    + u.web_search_requests * WEBSUCHE_PRO_SUCHE;
  ergebnis.usd = Math.round(usd * 10000) / 10000;
  return ergebnis;
}
