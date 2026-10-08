# KI-Modus: Recherche und Konzept

Stand: 8. Oktober 2026

## 1. Ausgangslage – warum der KI-Modus „nicht eingerichtet“ war

Der KI-Modus hing bisher ausschließlich an der Umgebungsvariable `ANTHROPIC_API_KEY` in einer Datei `.env`. Daraus ergaben sich fünf Probleme:

| Problem | Folge |
|---|---|
| Ohne `.env`-Datei mit Schlüssel bleibt die KI aus | Der Haken „KI-Modus“ unter „Start“ bewirkt nichts, die KI-Knöpfe bleiben grau |
| Die `.env` muss von Hand angelegt werden (Eingabeaufforderung, Editor) | Fehleranfällig, besonders unter Windows |
| Der Schlüssel wird nur beim Start gelesen | Nach dem Eintragen ist ein Neustart nötig |
| Keine Prüfung des Schlüssels | Fehler wie „ungültiger Schlüssel“ oder „kein Guthaben“ zeigen sich erst bei der ersten Auswertung |
| Keine Kostentransparenz | Man sieht nicht, was eine Auswertung kostet |

## 2. Rechercheergebnisse

### 2.1 Zugang zur Claude API

- Die API wird über die **Claude Console** genutzt (platform.claude.com). Dort legt man ein Konto an, erstellt unter *Settings → API Keys* einen Schlüssel (`sk-ant-…`) und lädt unter *Billing* Guthaben auf.
- **Ein Claude-Abo (claude.ai Pro/Max) enthält kein API-Guthaben.** Abo und API werden getrennt abgerechnet.
- Neue Konten erhalten laut Anthropic ein kleines Startguthaben zum Testen. Bezahlt wird in US-Dollar per Kreditkarte, abgerechnet nach Verbrauch. [Quelle: Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- In der Console lassen sich **Ausgabenlimits** festlegen – der wirksamste Schutz vor unerwarteten Kosten.

### 2.2 Schlüssel prüfen, ohne Geld auszugeben

- Die **Models-Schnittstelle** (`GET /v1/models/{id}`) braucht nur den Schlüssel und kostet nichts. Sie bestätigt, dass Schlüssel und Modell funktionieren. Außerdem liefert sie die Fähigkeiten des Modells, z. B. `capabilities.server_tools.web_search.supported` und `pdf_input`. [Quelle: List Models](https://platform.claude.com/docs/en/api/models/list)
- **Fehlendes Guthaben** erkennt erst eine echte Anfrage. Sie scheitert dann mit HTTP 400 und dem Text „Your credit balance is too low to access the Anthropic API“. Eine Mini-Testanfrage kostet weniger als 1 Cent. [Quelle: Fehlerberichte, z. B. GitHub](https://github.com/anthropics/claude-code/issues/867)

### 2.3 Preise (Claude API, Stand Oktober 2026)

| Modell | Eingabe | Ausgabe | Einsatz im Generator |
|---|---|---|---|
| Claude Opus 5.5 | 4 $ / 1 Mio. Token | 20 $ / 1 Mio. Token | Standard – beste Qualität bei Analyse und Texten |
| Claude Sonnet 5.5 | 2 $ / 1 Mio. Token | 10 $ / 1 Mio. Token | halb so teuer, etwas weniger gründlich |

- **Websuche:** 10 $ pro 1.000 Suchen. Die gefundenen Inhalte zählen zusätzlich als Eingabe-Token. Fehlgeschlagene Suchen werden nicht berechnet. [Quelle: Web search tool](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- Die tatsächlichen Verbrauchsdaten liefert jede Antwort im Feld `usage`: `input_tokens`, `output_tokens`, `server_tool_use.web_search_requests`. Daraus lassen sich die Kosten jeder Auswertung genau berechnen.

**Grobe Kostenschätzung je Funktion (Opus 5.5; Sonnet 5.5 etwa die Hälfte):**

| Funktion | Typischer Verbrauch | Kosten ca. |
|---|---|---|
| Dokument auswerten (1–2 Seiten) | 5–8 Tsd. Token Eingabe, 2–3 Tsd. Ausgabe | 0,05–0,10 $ |
| HR-Einschätzung | 6–10 Tsd. Eingabe, 3–5 Tsd. Ausgabe | 0,08–0,15 $ |
| Anschreiben | 4–6 Tsd. Eingabe, 2–3 Tsd. Ausgabe | 0,05–0,08 $ |
| Job-Websuche (bis 8 Suchen) | Suchen + 20–40 Tsd. Eingabe | 0,20–0,40 $ |
| Leistungs-Recherche (bis 10 Suchen) | Suchen + 30–50 Tsd. Eingabe | 0,25–0,50 $ |

Ein kompletter Durchlauf mit allen KI-Funktionen liegt damit grob bei **1–2 $**.

### 2.4 Websuche

- Die Websuche ist standardmäßig erlaubt. Ein Administrator kann sie in der Console abschalten (*Settings → Capabilities*). Dann scheitert jede Anfrage mit Websuche mit HTTP 400 („web search is not enabled“). Diesen Fall muss die App verständlich melden. [Quelle](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- Lange Suchen kann der Server unterbrechen (`pause_turn`). Die App muss dann fortsetzen. Das ist bereits eingebaut.

### 2.5 Datenschutz

| Frage | Ergebnis |
|---|---|
| Training mit meinen Daten? | **Nein.** API-Daten werden ohne ausdrückliche Erlaubnis nicht zum Training genutzt. [Quelle](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention) |
| Wie lange werden Anfragen gespeichert? | Standardmäßig werden Ein- und Ausgaben **innerhalb von 30 Tagen** gelöscht. Ausnahme: Inhalte, die gegen die Nutzungsrichtlinien verstoßen, bis zu 2 Jahre. [Quelle: Anthropic Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) |
| Auftragsverarbeitung (DSGVO Art. 28)? | Der **Auftragsverarbeitungsvertrag (DPA) mit EU-Standardvertragsklauseln** ist automatisch Teil der kommerziellen API-Bedingungen. [Quelle: DPA](https://www.anthropic.com/legal/data-processing-addendum) |
| Verarbeitung in der EU möglich? | **Nein.** `inference_geo` kennt nur `global` (Standard) und `us` (+10 % Aufpreis). Gespeichert wird in den USA. [Quelle: Data residency](https://platform.claude.com/docs/en/manage-claude/data-residency) |
| Zero Data Retention? | Nur mit gesonderter Vereinbarung, praktisch für Unternehmen. Für Privatpersonen nicht realistisch. |

**Konsequenz:** Weil keine EU-Verarbeitung möglich ist, ist **Datensparsamkeit** der wichtigste Hebel. Es sollen so wenige personenbezogene Daten wie möglich die App verlassen.

### 2.6 Geprüfte Alternativen

| Alternative | Bewertung | Entscheidung |
|---|---|---|
| **Lokales Modell (Ollama)** | Läuft komplett offline, kostenlos. Unterstützt strukturierte Ausgaben und Bildmodelle. [Quelle](https://registry.ollama.ai/blog/structured-outputs) Aber: braucht 16 GB RAM oder mehr bzw. eine Grafikkarte, deutlich schwächere Qualität bei deutscher Zeugnissprache und HR-Bewertung, keine Websuche, laut Nutzerberichten unzuverlässige JSON-Ausgaben. | Später als Zusatzoption möglich. Die KI-Funktionen sind in einem Modul gekapselt, damit das nachrüstbar bleibt. |
| **Anmeldung per Claude-Abo statt Schlüssel** | Das Abo deckt keine API-Nutzung ab. Eine Anmeldung per Kommandozeilen-Tool (`ant auth login`) wäre für Endnutzer unter Windows zu kompliziert. | Nicht umgesetzt. |
| **Schlüssel im Browser speichern** | Der Schlüssel läge im localStorage und wäre für jedes Skript auf der Seite lesbar. | Abgelehnt. Der Schlüssel bleibt auf dem lokalen Server in `.env`. |
| **US-Verarbeitung erzwingen** | Kostet 10 % mehr und bringt für Nutzer in der EU keinen Vorteil. | Nicht umgesetzt. |

## 3. Konzept (umgesetzt)

### 3.1 Einrichtungsassistent in der App

Auf der Startseite gibt es eine Karte **„KI-Modus einrichten“**:

1. Schritt-für-Schritt-Anleitung mit Link zur Console: Konto, Guthaben, Schlüssel.
2. Feld für den Schlüssel (verdeckt) und Wahl des Modells (Opus 5.5 empfohlen, Sonnet 5.5 günstiger), jeweils mit Preisen.
3. **„Prüfen & speichern“:**
   - Der lokale Server prüft das Format.
   - Dann ruft er kostenlos die Models-Schnittstelle auf.
   - Er speichert Schlüssel und Modell in `.env` und lädt sie sofort, ohne Neustart.
   - Er meldet, ob die Websuche für das Modell verfügbar ist.
4. **„Verbindung testen“** schickt eine Mini-Anfrage (unter 1 Cent) und prüft damit auch das Guthaben.
5. **„Schlüssel entfernen“** löscht ihn aus `.env` und aus dem Arbeitsspeicher.

**Sicherheit:**
- Der Schlüssel wird nie an den Browser zurückgegeben. Angezeigt wird nur `sk-ant-…abcd`.
- Er wird nie protokolliert und vor dem Speichern streng geprüft, damit niemand über das Eingabefeld zusätzliche Zeilen in die `.env` schreiben kann.
- Die Schnittstelle nimmt wie alle anderen nur Anfragen von `localhost` an (Host- und Origin-Prüfung).
- `.env` steht in `.gitignore`.

### 3.2 Klare Fehlermeldungen mit Lösung

| Fehler der API | Meldung in der App |
|---|---|
| 401 ungültiger Schlüssel | „Schlüssel abgelehnt“ + Link zur Einrichtung |
| 400 „credit balance is too low“ | „Kein Guthaben“ + Hinweis auf *Billing* in der Console |
| 400 „web search is not enabled“ | „Websuche in der Console deaktiviert“ + Link zu *Settings → Capabilities* |
| 404 Modell nicht gefunden | „Modell für diesen Schlüssel nicht verfügbar“ – anderes Modell wählen |
| 429 / 529 | „Zu viele Anfragen bzw. Anthropic überlastet – kurz warten“ |

### 3.3 Kostentransparenz

- Jede KI-Auswertung meldet ihre **tatsächlichen Kosten**, berechnet aus `usage` und der Preistabelle, und zeigt sie an der Ergebniskarte an.
- Die App summiert die Kosten pro Monat und zeigt sie im Kopfbereich.
- Optional lässt sich ein **Monatsbudget** eintragen. Vor einer Auswertung über dem Budget fragt die App nach. Für eine harte Grenze empfiehlt die App zusätzlich das Ausgabenlimit in der Console.

### 3.4 Datensparmodus (Standard: an)

- **Dokumente mit Textebene** (PDF mit Text, DOCX, TXT) werden **als Text statt als Originaldatei** übertragen. Vorher werden Name (aus dem Profil), „Herr/Frau + Name“, E-Mail, Telefonnummern, Anschrift, Geburtsdatum und IBAN **geschwärzt**.
- **Scans und Fotos** müssen als Bild übertragen werden. Die App fragt deshalb vorher ausdrücklich nach.
- Nach jeder Auswertung steht an der Ergebniskarte, **was übertragen wurde**, z. B. „Text, 3.412 Zeichen, 6 Angaben geschwärzt“.
- Profil-, Leistungs-, Steuer- und Anschreiben-Anfragen enthalten wie bisher keine Kontaktdaten. Den Namen im Anschreiben setzt die App erst lokal ein.

### 3.5 Bewusst nicht umgesetzt

- EU-Datenresidenz (nicht verfügbar), lokales Modell (siehe 2.6), Abo-Anmeldung.
