# E-Mail-Marketing-Demo für Handwerksbetriebe

Diese Demo zeigt Interessenten (kleinen Handwerksbetrieben), was sie von mir als E-Mail-Marketing-Dienstleister bekommen: ein fertiges System für **automatische Wartungserinnerungen per E-Mail**. Beispiel ist der fiktive SHK-Betrieb **Heizungsbau Mustermann GmbH** aus Musterstadt.

> **Demo – fiktiver Betrieb.** Alle Namen, Adressen, Telefonnummern und Kundendaten sind erfunden. Es wird keine einzige E-Mail verschickt, und es gibt keine Tracking-Dienste.

## Was die Demo zeigt

| Baustein | Datei(en) | Was Interessenten sehen |
|---|---|---|
| **Präsentationsseite** | `index.html` | Nutzen für den Betrieb, Zeitleiste der Mail-Strecke, Vorschau aller 7 Mails (Desktop/Handy, Beispieldaten/Platzhalter) |
| **Anmeldeseite** | `landingpage/index.html` | Formular mit DSGVO-Einwilligung und simuliertem Double-Opt-in |
| **Bestätigungsseite** | `landingpage/bestaetigt.html` | „Anmeldung erfolgreich“ mit berechnetem nächstem Wartungstermin |
| **A5-Aushang** | `landingpage/aushang.html` | Druckvorlage mit QR-Code zur Anmeldeseite |
| **Impressum/Datenschutz** | `landingpage/impressum.html`, `landingpage/datenschutz.html` | Platzhalterseiten, deutlich als Demo gekennzeichnet |
| **7 E-Mails** | `emails/mjml/*.mjml` → `emails/html/*.html` | Responsive HTML-Mails mit Betreff, Preheader und Platzhaltern |
| **Automatisierung** | `automation/plan.js`, `data/kunden.csv` | Wer bekommt wann welche Mail, für 15 Beispielkunden |

### Die Mail-Strecke

| Nr. | Mail | Auslöser |
|---|---|---|
| 1 | Bestätigung (Double-Opt-in) | sofort nach dem Absenden des Formulars |
| 2 | Willkommen | sofort nach Klick auf den Bestätigungslink |
| 3 | Wartungserinnerung „in 4 Wochen fällig“ | Fälligkeit − 28 Tage (Fälligkeit = letzte Wartung + 12 Monate) |
| 4 | Letzte Erinnerung | Fälligkeit − 7 Tage, **nur ohne vereinbarten Termin** |
| 5 | Bewertungsanfrage | 2 Tage nach dem Wartungstermin |
| 6 | Saisonmail Herbst | jedes Jahr am 15. September an alle bestätigten Kontakte |
| 7 | Reaktivierung | letzte Wartung + 18 Monate, **nur ohne vereinbarten Termin** |

## Starten

Voraussetzung: [Node.js](https://nodejs.org) ab Version 18.

```bash
npm install            # einmalig, installiert MJML
npm run build:emails   # MJML-Vorlagen zu HTML kompilieren
npm run preview        # lokaler Server → http://localhost:8080
npm run plan           # Zeitplan in der Konsole + JSON
```

Die kompilierten Mails liegen bereits im Repository. Die Seiten lassen sich deshalb auch ohne Installation öffnen, per Doppelklick auf `index.html`. Mit `npm run preview` passt sich die Höhe der Mail-Vorschau automatisch an.

### Zeitplan und personalisierte Mails

```bash
npm run plan                                  # ab heute, die nächsten 365 Tage
npm run plan -- --stichtag 2026-10-06         # aus Sicht eines bestimmten Tages (Beispieldaten passen dazu)
npm run plan -- --alle                        # auch bereits versendete Mails anzeigen
npm run plan -- --tage 90                     # Vorschau-Zeitraum ändern
npm run plan -- --kunde K001                  # nächste fällige Mail für K001 als HTML erzeugen
npm run plan -- --kunde K001 --mail 5         # bestimmte Mail (1–7) für K001 erzeugen
```

Ausgaben landen in `automation/ausgabe/`: `zeitplan.json` und die personalisierten Mails, z. B. `K001-03-erinnerung-4-wochen.html`. Der Ordner ist nicht im Git.

Die Beispieldaten in `data/kunden.csv` sind auf den **06.10.2026** abgestimmt und zeigen dann alle Fälle: Erinnerung heute, Termin schon vereinbart, Bewertungsanfrage, unbestätigte Anmeldung, fehlendes Wartungsdatum, Abmeldung und Reaktivierung.

### Testen

```bash
npm test
```

Der Test baut die Mails, prüft die Zeitplan-Logik und öffnet alle Seiten und Mails im Browser (Desktop und Handy). Dabei achtet er auf Konsolenfehler, fehlende Dateien und waagrechtes Scrollen. Außerdem spielt er Anmeldung, Mail-Vorschau und QR-Code durch. Für die Browser-Tests wird [Playwright](https://playwright.dev) benötigt (`npm i -D playwright`). Ohne Playwright laufen nur Build und Zeitplan.

## So zeigen Sie die Demo Interessenten

1. `npm run preview` starten und `http://localhost:8080` öffnen. Oder die Ordner auf einen Webspace laden und den Link schicken.
2. Oben beginnen: **Was bringt das Ihrem Betrieb?**
3. **Anmeldeseite** öffnen, einmal ausfüllen, „Bestätigungslink öffnen (Demo)“ klicken. So erlebt der Interessent den Double-Opt-in wie sein Kunde.
4. **Zeitleiste**: zeigt, welche Mail wann kommt und dass niemand mit Mails überschüttet wird.
5. **Mail-Vorschau**: durch die 7 Mails klicken und auf **Handy** umschalten (dort lesen die meisten Kunden). Mit **Platzhalter** zeigen, wie die Personalisierung funktioniert.
6. **A5-Aushang** zeigen: für die Ladentheke, den Firmenwagen oder als Rechnungsbeilage.
7. Optional die Automatik im Terminal zeigen: `npm run plan -- --stichtag 2026-10-06`.

Vorher in `index.html` im Abschnitt „Das möchten Sie auch für Ihren Betrieb?“ die eigenen Kontaktdaten eintragen (markiert mit `ANPASSEN`).

## Für einen echten Betrieb anpassen

### 1. Betriebsdaten: `data/betrieb.json`

Name, Adresse, Telefon, E-Mail, Geschäftsführer, Registergericht, USt-IdNr., Farben, Link zur Terminbuchung, Google-Bewertungslink und Herbst-Angebot stehen an einer Stelle. Danach `npm run build:emails` ausführen, dann übernehmen alle Mails die neuen Werte.

| Feld | Bedeutung |
|---|---|
| `farbe_primaer` | Hauptfarbe (Kopf-/Fußbereich, Überschriften) |
| `farbe_akzent` | Akzentfarbe (Buttons, Linien) |
| `farbe_button_text` | Schriftfarbe auf Buttons. Auf ausreichenden Kontrast achten: Weiß auf Orange ist schlecht lesbar. |
| `termin_link` | Online-Terminbuchung oder Kontaktseite |
| `bewertungs_link` | Google-Bewertungslink (Google Unternehmensprofil → „Nach Rezensionen fragen“) |
| `asset_pfad` | Ort des Logos für Mails. **Für den echten Versand eine absolute URL** eintragen (z. B. `https://www.betrieb.de/mail/`), denn Mailprogramme können keine lokalen Pfade laden. |

### 2. Logo

- Web: `landingpage/assets/logo.svg` und `favicon.svg` ersetzen.
- Mails: `emails/assets/logo-mail.png` ersetzen. Viele Mailprogramme (z. B. Gmail, Outlook) zeigen kein SVG an, deshalb dort PNG verwenden: etwa 536 × 128 px, wird mit 200 px Breite angezeigt (scharf auf Retina-Displays).

### 3. Farben der Webseiten

In `landingpage/style.css` und im `<style>`-Block von `index.html` stehen die Farben oben unter `:root` (`--blau`, `--orange` …). Im Aushang (`landingpage/aushang.html`) ebenfalls unter `:root`.

### 4. Texte

- **Mails:** direkt in `emails/mjml/*.mjml`. Betreff = `<mj-title>`, Preheader = `<mj-preview>`. Kopf, Signatur und Fußzeile sind für alle Mails gemeinsam in `emails/mjml/_partials/`.
- **Anmeldeseite, Aushang, Bestätigungsseite:** direkt in den HTML-Dateien in `landingpage/`.
- **Impressum und Datenschutz:** sind nur Muster und **müssen für einen echten Betrieb individuell erstellt bzw. rechtlich geprüft werden** (inkl. Versanddienstleister und Auftragsverarbeitungsvertrag).
- **Andere Gewerke:** Die Strecke funktioniert genauso für Wartungsverträge (Klima, Lüftung, Enthärtungsanlagen), Kaminkehrer-Termine, TÜV/HU in der Kfz-Werkstatt usw. Dafür nur Texte und das Intervall (`WARTUNGSINTERVALL_MONATE` in `automation/plan.js`) anpassen.

### 5. QR-Code

Im Aushang oben die öffentliche Adresse der Anmeldeseite eintragen und „QR-Code aktualisieren“ klicken. Alternativ `aushang.html?url=https://…` aufrufen. Die QR-Bibliothek wird von cdnjs geladen, dafür ist eine Internetverbindung nötig.

### 6. Versand

Die Demo verschickt nichts. Für den echten Betrieb werden die HTML-Dateien aus `emails/html/` in ein Versandtool übernommen (am besten ein Anbieter mit Servern in der EU und Auftragsverarbeitungsvertrag). Dort werden auch Double-Opt-in, Abmeldung und die Zeitsteuerung eingerichtet. `automation/plan.js` dokumentiert die Regeln, die dort nachgebaut werden. Die `{{Platzhalter}}` werden dabei auf die Feldnamen des Tools umgestellt, z. B. `{{vorname}}` → `*|FNAME|*`.

## Platzhalter

**Empfänger-Platzhalter** (bleiben im HTML stehen und werden pro Empfänger gefüllt):

| Platzhalter | Inhalt | Beispiel |
|---|---|---|
| `{{vorname}}` | Vorname | Anna |
| `{{nachname}}` | Nachname | Beispiel |
| `{{heizungsart}}` | Heizungsart | Gasheizung, Ölheizung, Wärmepumpe, Heizung |
| `{{letzte_wartung}}` | Datum der letzten Wartung | 03.11.2025 |
| `{{faellig_am}}` | nächste fällige Wartung | 03.11.2026 |
| `{{bestaetigungs_link}}` | persönlicher Double-Opt-in-Link (nur Mail 1) | – |
| `{{abmelde_link}}` | persönlicher Abmeldelink (in jeder Mail) | – |

**Betriebs-Platzhalter** `[[name]]` werden beim Build aus `data/betrieb.json` eingesetzt, z. B. `[[firma]]`, `[[telefon]]`, `[[farbe_akzent]]`, `[[termin_link]]`. Der Build bricht mit einer Fehlermeldung ab, wenn ein unbekannter Platzhalter verwendet wird oder `{{abmelde_link}}` in einer Mail fehlt.

## Ordnerstruktur

```
index.html                 Präsentationsseite für Interessenten
landingpage/               Anmeldeseite, Bestätigung, Aushang, Impressum, Datenschutz
  assets/                  Logo und Favicon (SVG)
emails/
  mjml/                    Mail-Vorlagen (Quelle), _partials/ = gemeinsame Bausteine
  html/                    kompilierte Mails mit {{Platzhaltern}}
  html/beispiel/           kompilierte Mails mit Beispieldaten (für die Vorschau)
  assets/                  Logo als PNG für Mails
  strecke.json             Reihenfolge, Auslöser und erlaubte Platzhalter
  build.js                 Build-Skript (npm run build:emails)
automation/
  plan.js                  Zeitplan berechnen, personalisierte Mails erzeugen (npm run plan)
  preview-server.js        lokaler Server (npm run preview)
  test-pages.js            automatische Prüfungen (npm test)
  lib.js                   gemeinsame Hilfsfunktionen
data/
  betrieb.json             Betriebsdaten und Farben
  kunden.csv               15 fiktive Beispielkunden
```

## Datenschutz in der Demo

- Das Anmeldeformular überträgt nichts. Die Eingaben werden nur lokal im Browser an die Bestätigungsseite weitergegeben.
- Keine Cookies, kein Tracking, keine Analyse-Dienste. Einzige externe Ressource ist die QR-Code-Bibliothek von cdnjs (nur im Aushang, mit Integritätsprüfung).
- Alle Beispielkunden verwenden die reservierte Domain `example.com`.

---

*Hinweis: Im selben Repository liegen außerdem separate Projekte: der Quittungsscanner (`app.py`, `excel_export.py`, `templates/`, `static/` …) und der Bewerbungs-Generator im Ordner [`bewerbungs-generator/`](bewerbungs-generator/README.md). Sie haben mit dieser Demo nichts zu tun.*
