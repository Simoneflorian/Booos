# Bewerbungs-Generator

Ein persönlicher Assistent für Bewerbung, Jobsuche und Ansprüche, der auf deinem eigenen Rechner läuft:

1. **Unterlagen auswerten:** Lebenslauf, Arbeitszeugnisse, Schul-, Ausbildungs- und Hochschulzeugnisse, Zertifikate (PDF, Word, Text, Fotos).
2. **Tiefeninterview:** Über 70 Fragen in 8 Bereichen zu allem, was für deinen Karriereverlauf zählt. Zu jeder Frage steht, warum Personaler darauf achten.
3. **HR-Profil:** Wie du in Bewerbungsprozessen voraussichtlich eingeordnet wirst. Dazu Stärken, Risiken, Lücken, ATS-Check und fehlende Angaben.
4. **Jobsuche:** Passende Stellen aus der Jobbörse der Bundesagentur für Arbeit, optional per KI-Websuche auch auf weiteren Portalen.
5. **Sozialleistungen:** Vorprüfung von 25 Leistungen und Förderungen, Fristen zuerst. Optional eine KI-Recherche in offiziellen Quellen, bei Beratungsstellen und in Sozialrechts-Foren.
6. **Steuertipps:** Nur mit ausdrücklicher Einwilligung. Werbungskosten-Schnellcheck und Tipps rund um Job, Bewerbung und Jobwechsel.
7. **Anschreiben & Lebenslauf:** Anschreiben als Vorlage oder mit KI, dazu ein ATS-freundlicher tabellarischer Lebenslauf zum Drucken bzw. als PDF.

> **Wichtig:** Die Ergebnisse sind Einschätzungen und ersetzen keine Rechts-, Steuer- oder Sozialberatung. Beträge, Fristen und Ansprüche immer bei der zuständigen Stelle prüfen.

## Datenschutz – so ist der Generator gebaut

- **Lokal zuerst:** Der Server läuft nur auf deinem Rechner (`127.0.0.1`) und nimmt keine Anfragen von außen oder von fremden Webseiten an. Er speichert selbst nichts.
- **Speicherung nur im Browser und nur, wenn du es willst.** Gespeichert werden Profil, Auswertungen und der ausgelesene Text der Dokumente, nicht die Originaldateien. Unter „Meine Daten“ kannst du alles exportieren oder löschen.
- **KI nur mit Einwilligung und nur per Klick.** Jede KI-Auswertung startest du selbst. Für Profil-Analysen werden Name, E-Mail, Telefon und Adresse **nicht** übertragen. Beim Anschreiben setzt der Generator deinen Namen erst lokal ein.
- **Fair:** Alter, Geschlecht, Herkunft, Religion, Gesundheit und andere nach dem AGG geschützte Merkmale fließen nie in die HR-Bewertung ein. Gesundheitliche Angaben (freiwillig) dienen nur der Leistungsprüfung.
- **Jobsuche:** Suchbegriff und Ort gehen an die Jobbörse der Bundesagentur für Arbeit.

## Installation und Start (Windows)

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20.12. Bei dir ist Version 24 installiert, das passt.

Öffne die **Eingabeaufforderung** und gib die Befehle **einzeln** ein. Drück nach jeder Zeile Enter und warte, bis sie fertig ist.

**Erstes Mal** (falls das Repository schon unter `C:\Users\Florian\Booos` liegt):

```
cd C:\Users\Florian\Booos
```
```
git fetch origin
```
```
git checkout claude/admiring-fermi-6dxf84
```
```
git pull
```
```
cd bewerbungs-generator
```
```
npm install
```
```
npm start
```

Dann im Browser öffnen: **http://localhost:3000**. Falls die Seite nicht lädt: **http://127.0.0.1:3000**.

Das Fenster mit `npm start` muss offen bleiben, solange du den Generator nutzt. Beenden mit **Strg + C**.

**Später** reicht:

```
cd C:\Users\Florian\Booos\bewerbungs-generator
```
```
npm start
```

### Zum Ausprobieren

Im Ordner `beispiel/` liegen fiktive Unterlagen: Lebenslauf, Arbeitszeugnis, Schulzeugnis. Diese einfach unter „Unterlagen“ hochladen.

## KI-Modus einrichten (optional)

Ohne KI funktionieren alle Bereiche. Mit KI kommen dazu:

- Scans und Fotos lesen
- tiefere HR-Einschätzung mit passenden Rollen, Gehaltsschätzung und Rückfragen für das Interview
- Websuche nach Stellen
- Recherche zu Sozialleistungen und Steuern mit Quellenangaben
- fertig formulierte Anschreiben

So richtest du ihn ein:

1. Auf https://console.anthropic.com ein Konto anlegen und unter „API Keys“ einen Schlüssel erstellen. Die Nutzung kostet Geld pro Anfrage, Websuchen werden zusätzlich berechnet. Die aktuellen Preise stehen in der Console.
2. Im Ordner `bewerbungs-generator` die Vorlage kopieren und öffnen:
   ```
   copy .env.example .env
   ```
   ```
   notepad .env
   ```
3. Hinter `ANTHROPIC_API_KEY=` den Schlüssel einfügen, speichern und den Server neu starten (Strg + C, dann `npm start`).
4. Im Browser unter „Start“ den Haken bei **KI-Modus** setzen.

Verwendet wird standardmäßig das Modell `claude-opus-5-5`. In `.env` lässt es sich mit `KI_MODELL=…` ändern. Die `.env`-Datei wird nicht ins Git-Repository übernommen.

## So funktioniert die HR-Einordnung

Der Generator nutzt dieselben Raster, mit denen Personalabteilungen und die Arbeitsagentur arbeiten:

| Merkmal | Grundlage |
|---|---|
| **Anforderungsniveau** (Helfer, Fachkraft, Spezialist, Experte) | Klassifikation der Berufe (KldB 2010) der Bundesagentur für Arbeit |
| **Bildungsniveau** | Deutscher Qualifikationsrahmen (DQR 1–8) |
| **Berufsbereich** | Die 10 Berufsbereiche der KldB 2010 |
| **Seniorität und Führung** | Berufserfahrung ohne Doppelzählung, Führungsspanne |
| **Lücken und Jobhopping** | Zeiträume ab 3 Monaten ohne Station, Stationen unter 18 Monaten |
| **Arbeitszeugnisse** | Decoder für Zeugnissprache: Leistungs- und Verhaltensnote, Schlussformel, Austrittsgrund und typische „Geheimcodes“ |
| **ATS-Check** | Lesbarkeit für Bewerbermanagement-Software, Kontaktdaten, Datumsformat, Schlüsselwörter |

Aus fehlenden Angaben macht der Generator eine Liste mit Direktlinks ins Interview. Die KI-Auswertung erzeugt zusätzlich **Rückfragen**. Deine Antworten fließen in die nächste Auswertung ein, so wird das Profil Schritt für Schritt genauer.

## Tests

```
npm test
```

40 automatische Tests prüfen:

- Zeugnis-Decoder und Notenauswertung
- Dokumenterkennung, auch für PDF
- HR-Analyse
- Leistungs- und Steuerregeln
- Jobbörsen-Anbindung (simuliert)
- KI-Anbindung (simulierte Claude API, inkl. Datenminimierung)
- Server-Schutzmechanismen

## Projektstruktur

```
server.js            lokaler Server (Schnittstellen + Weboberfläche)
src/
  dokumente.js       Text aus PDF/DOCX/TXT lesen, Dokumentart erkennen, Lebenslauf-Heuristiken
  zeugnis.js         Zeugnissprache-Decoder, Schulnoten
  hr-analyse.js      HR-Einordnung (KldB, DQR, Lücken, ATS …)
  jobsuche.js        Jobbörse der Bundesagentur für Arbeit
  leistungen.js      Vorprüfung Sozialleistungen & Förderungen
  steuer.js          Steuertipps (Stand 2026)
  anschreiben.js     Anschreiben-Vorlage ohne KI
  ki.js              KI-Funktionen über die Claude API
  config.js          Einstellungen (.env)
public/              Weboberfläche (HTML, CSS, JavaScript, Fragenkatalog)
beispiel/            fiktive Beispiel-Unterlagen
test/                automatische Tests
```

## Grenzen

- **Regeln und Beträge** zu Leistungen und Steuern haben den Stand 2026 und ändern sich regelmäßig. Die Vorprüfung ersetzt keinen Antrag. Im Zweifel beantragen, ein Antrag kostet nichts.
- **Jobbörse:** Die Schnittstelle der Arbeitsagentur ist öffentlich nutzbar, aber nicht offiziell dokumentiert. Wenn sie sich ändert, hilft die KI-Websuche weiter.
- **Fotos und Scans** werden nur im KI-Modus gelesen.
- **Forenbeiträge** in der KI-Recherche sind als `[Forum]` gekennzeichnet. Sie sind nicht verbindlich und können veraltet sein.

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| `npm: Der Befehl ist entweder falsch geschrieben …` | Node.js installieren und die Eingabeaufforderung neu öffnen. |
| `Could not read package.json` | Du bist im falschen Ordner. Zuerst `cd C:\Users\Florian\Booos\bewerbungs-generator`. |
| `EADDRINUSE` (Port belegt) | Läuft der Generator schon in einem anderen Fenster? Sonst anderen Port nehmen: `set PORT=3001` und danach `npm start`. |
| KI-Knöpfe ausgegraut | API-Schlüssel in `.env` eintragen, Server neu starten, unter „Start“ den KI-Modus erlauben. |
| „Jobbörse nicht erreichbar“ | Internetverbindung prüfen, ggf. später erneut versuchen. |
