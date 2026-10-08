// Einstellungen aus der Umgebung bzw. aus der Datei .env (wird automatisch geladen, falls vorhanden).
// Der API-Schlüssel kann zur Laufzeit über den Einrichtungsassistenten gesetzt werden (siehe src/einstellungen.js).
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_DATEI = process.env.ENV_DATEI || path.join(ROOT, '.env');

// War der Schlüssel schon vor dem Laden der .env gesetzt, stammt er aus den Windows-/System-Umgebungsvariablen.
const ausSystem = Boolean(process.env.ANTHROPIC_API_KEY);
try {
  process.loadEnvFile(ENV_DATEI);
} catch {
  // keine .env vorhanden – dann gelten Standardwerte bzw. echte Umgebungsvariablen
}

export const config = {
  root: ROOT,
  envDatei: ENV_DATEI,
  port: parseInt(process.env.PORT, 10) || 3000,
  // Nur lokal erreichbar: Die App verarbeitet sehr persönliche Daten.
  host: process.env.HOST || '127.0.0.1',
  kiModell: process.env.KI_MODELL || 'claude-opus-5-5',
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  schluesselQuelle: process.env.ANTHROPIC_API_KEY ? (ausSystem ? 'umgebung' : 'datei') : null,
  // Ergebnis der letzten Schlüsselprüfung (Models-Schnittstelle); null = noch nicht geprüft.
  pruefung: null,
  jobsucheApiKey: process.env.JOBSUCHE_API_KEY || 'jobboerse-jobsuche',
  maxUploadMb: 25,
  get kiAktiv() {
    return Boolean(this.apiKey);
  },
};
