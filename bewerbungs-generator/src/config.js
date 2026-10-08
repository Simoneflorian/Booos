// Einstellungen aus der Umgebung bzw. aus der Datei .env (wird automatisch geladen, falls vorhanden).
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // keine .env vorhanden – dann gelten Standardwerte bzw. echte Umgebungsvariablen
}

export const config = {
  root: ROOT,
  port: parseInt(process.env.PORT, 10) || 3000,
  // Nur lokal erreichbar: Die App verarbeitet sehr persönliche Daten.
  host: process.env.HOST || '127.0.0.1',
  kiModell: process.env.KI_MODELL || 'claude-opus-5-5',
  kiAktiv: Boolean(process.env.ANTHROPIC_API_KEY),
  jobsucheApiKey: process.env.JOBSUCHE_API_KEY || 'jobboerse-jobsuche',
  maxUploadMb: 25,
};
