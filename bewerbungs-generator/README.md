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

Öffne die **Eingabeaufforderung**, kopiere die passende Zeile **komplett** und füge sie mit Rechtsklick ein. Mit Enter bestätigen. Das `&&` sorgt dafür, dass die Befehle nacheinander laufen und beim ersten Fehler abbrechen.

**Erstes Mal bzw. nach Updates** (Repository liegt unter `C:\Users\Florian\Booos`):

```
cd /d C:\Users\Florian\Booos && git fetch origin && git checkout claude/admiring-fermi-6dxf84 && git pull && cd bewerbungs-generator && npm install && npm start
```

Dann im Browser öffnen: **http://localhost:3000**. Falls die Seite nicht lädt: **http://127.0.0.1:3000**.

Das Fenster mit `npm start` muss offen bleiben, solange du den Generator nutzt. Beenden mit **Strg + C**.

**Später** reicht:

```
cd /d C:\Users\Florian\Booos\bewerbungs-generator && npm start
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

**Einrichtung direkt in der App – ohne Eingabeaufforderung:**

1. In der [Claude Console](https://platform.claude.com) ein Konto anlegen.
2. Unter **Billing** Guthaben aufladen. Abgerechnet wird nach Verbrauch. Ein Claude-Abo (Pro/Max) enthält **kein** API-Guthaben.
3. Unter **Settings → API Keys** einen Schlüssel erstellen und kopieren.
4. Im Generator unter **Start → „KI-Modus einrichten“** den Schlüssel einfügen, ein Modell wählen und auf **„Prüfen & speichern“** klicken. Die Prüfung ist kostenlos, ein Neustart ist nicht nötig.
5. Unten bei den Einwilligungen den Haken **„KI-Modus“** setzen und speichern.
6. Empfohlen: In der Console unter **Settings → Limits** ein monatliches Ausgabenlimit festlegen.

Der Schlüssel wird nur auf deinem Rechner in der Datei `.env` gespeichert. Er wird nie an den Browser zurückgegeben und nicht ins Git-Repository übernommen. Über „Verbindung testen“ (kostet unter 1 Cent) prüfst du auch das Guthaben. Mit „Schlüssel entfernen“ löschst du ihn wieder.

**Kosten:** Nach jeder KI-Auswertung zeigt der Generator die tatsächlichen Kosten an, berechnet aus den Verbrauchsdaten der API. Oben im Kopfbereich steht die Monatssumme. Optional lässt sich eine **Monatsbudget-Warnung** einstellen. Richtwerte mit Claude Opus 5.5:

| Funktion | ca. |
|---|---|
| Dokument, HR-Einschätzung oder Anschreiben | 0,05–0,15 $ |
| Job-Websuche oder Leistungs-Recherche | 0,20–0,50 $ |

Ein kompletter Durchlauf liegt bei grob 1–2 $. Claude Sonnet 5.5 kostet etwa die Hälfte.

**Datenschutz:** Anthropic nutzt API-Daten nicht zum Training und löscht sie standardmäßig nach spätestens 30 Tagen. Eine reine EU-Verarbeitung gibt es nicht. Deshalb ist der **Datensparmodus** standardmäßig an:
- Dokumente mit Textebene gehen nur als Text an die KI. Name, Anschrift, Telefon, E-Mail, Geburtsdatum und IBAN werden vorher geschwärzt.
- Scans und Fotos werden nur nach ausdrücklicher Rückfrage übertragen.
- Profil-Analysen enthalten nie Kontaktdaten.

Die vollständige Recherche mit Quellen steht in [`docs/KI-Recherche.md`](docs/KI-Recherche.md).

<details>
<summary>Alternative: Einrichtung per Datei</summary>

Statt über die Oberfläche kann man auch die Vorlage kopieren und im Editor öffnen, dort `ANTHROPIC_API_KEY=` sowie optional `KI_MODELL=` eintragen und danach den Server neu starten:

```
cd /d C:\Users\Florian\Booos\bewerbungs-generator && copy .env.example .env && notepad .env
```
</details>

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

51 automatische Tests prüfen:

- Zeugnis-Decoder und Notenauswertung
- Dokumenterkennung, auch für PDF
- HR-Analyse
- Leistungs- und Steuerregeln
- Jobbörsen-Anbindung (simuliert)
- KI-Anbindung und KI-Einrichtung (simulierte Claude API): Schlüsselprüfung, `.env`-Schreiben, Kostenberechnung, Schwärzung, Fehlerbilder wie „kein Guthaben“
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
  einstellungen.js   KI-Modelle, Preise, Kostenberechnung, sicheres Schreiben der .env
  datenschutz.js     Schwärzen persönlicher Angaben (Datensparmodus)
  config.js          Einstellungen (.env)
public/              Weboberfläche (HTML, CSS, JavaScript, Fragenkatalog)
beispiel/            fiktive Beispiel-Unterlagen
docs/                Recherche und Konzept zum KI-Modus
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
| `EADDRINUSE` (Port belegt) | Läuft der Generator schon in einem anderen Fenster? Sonst anderen Port nehmen: `set PORT=3001 && npm start` |
| KI-Knöpfe ausgegraut | Unter „Start“ → „KI-Modus einrichten“ den Schlüssel eintragen und unten den Haken „KI-Modus“ setzen. |
| „Kein Guthaben“ | In der Claude Console unter „Billing“ Guthaben aufladen. Das Claude-Abo zählt nicht. |
| „Websuche deaktiviert“ | In der Claude Console unter „Settings → Capabilities“ die Websuche einschalten. |
| „Jobbörse nicht erreichbar“ | Internetverbindung prüfen, ggf. später erneut versuchen. |
