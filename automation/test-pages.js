#!/usr/bin/env node
// Prüft die Demo: Mails bauen, Zeitplan rechnen, alle Seiten im Browser öffnen
// (keine Konsolenfehler, keine fehlenden Dateien) und die wichtigsten Klickwege durchspielen.
//
// Benötigt Playwright (npm i -D playwright). Ohne Playwright laufen nur Build und Zeitplan.
// Optional: QR_LIB_DATEI=/pfad/qrcode.min.js liefert die QR-Bibliothek lokal aus (falls cdnjs nicht erreichbar ist).

const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pfad } = require('./lib');

let fehler = 0;
const ok = (text) => console.log(`  ✔ ${text}`);
const fail = (text) => { fehler++; console.log(`  ✖ ${text}`); };
const pruefe = (bedingung, text) => (bedingung ? ok(text) : fail(text));

function ladePlaywright() {
  try { return require('playwright'); } catch { /* weiter */ }
  try {
    const global = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return require(path.join(global, 'playwright'));
  } catch { return null; }
}

async function main() {
  console.log('1. Mails kompilieren');
  try {
    execFileSync('node', [pfad('emails/build.js')], { stdio: 'pipe' });
    const anzahl = JSON.parse(fs.readFileSync(pfad('emails/html/mails.json'), 'utf8')).mails.length;
    pruefe(anzahl === 7, `${anzahl} Mails fehlerfrei kompiliert`);
  } catch (e) { fail(`Build fehlgeschlagen:\n${e.stdout}${e.stderr}`); }

  console.log('2. Zeitplan berechnen');
  try {
    execFileSync('node', [pfad('automation/plan.js'), '--stichtag', '2026-10-06'], { stdio: 'pipe' });
    const plan = JSON.parse(fs.readFileSync(pfad('automation/ausgabe/zeitplan.json'), 'utf8'));
    pruefe(plan.eintraege.length > 0, `Zeitplan mit ${plan.eintraege.length} Einträgen als JSON gespeichert`);
    const heute = plan.eintraege.filter((e) => e.status === 'heute senden').map((e) => `${e.kunden_nr}/${e.mail_nr}`);
    pruefe(heute.includes('K001/3'), 'K001 bekommt am 06.10.2026 die Wartungserinnerung');
    pruefe(!plan.eintraege.some((e) => e.kunden_nr === 'K011' && e.datum > '2026-05-01'), 'Abgemeldeter Kunde K011 bekommt nichts mehr');
    pruefe(!plan.eintraege.some((e) => e.kunden_nr === 'K007' && e.mail_nr !== 1), 'Unbestätigter Kunde K007 bekommt nur die Bestätigungsmail');
    pruefe(!plan.eintraege.some((e) => e.kunden_nr === 'K013' && e.mail_nr === 4 && e.status !== 'versendet' && e.datum < '2027-01-01'), 'K013 mit Termin bekommt keine letzte Erinnerung');
    execFileSync('node', [pfad('automation/plan.js'), '--stichtag', '2026-10-06', '--kunde', 'K001'], { stdio: 'pipe' });
    const html = fs.readFileSync(pfad('automation/ausgabe/K001-03-erinnerung-4-wochen.html'), 'utf8');
    pruefe(html.includes('Hallo Anna') && !/\{\{\w+\}\}/.test(html), 'Personalisierte Mail für K001 ohne offene Platzhalter erzeugt');
  } catch (e) { fail(`Zeitplan fehlgeschlagen:\n${e.stdout || ''}${e.stderr || e.message}`); }

  const playwright = ladePlaywright();
  if (!playwright) {
    console.log('\n3. Browser-Tests übersprungen (Playwright nicht installiert: npm i -D playwright)');
    return;
  }

  console.log('3. Seiten im Browser prüfen');
  const port = 8000 + Math.floor(Math.random() * 900);
  const server = spawn('node', [pfad('automation/preview-server.js')], { env: { ...process.env, PORT: String(port) }, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 600));
  const basis = `http://localhost:${port}`;

  const browser = await playwright.chromium.launch();
  try {
    const kontext = await browser.newContext();
    if (process.env.QR_LIB_DATEI) {
      const lib = fs.readFileSync(process.env.QR_LIB_DATEI);
      await kontext.route('https://cdnjs.cloudflare.com/**', (r) => r.fulfill({ body: lib, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' } }));
    }

    async function oeffne(url, viewport = { width: 1280, height: 900 }) {
      const seite = await kontext.newPage();
      await seite.setViewportSize(viewport);
      const probleme = [];
      seite.on('console', (m) => { if (m.type() === 'error') probleme.push(`Konsole: ${m.text()}`); });
      seite.on('pageerror', (e) => probleme.push(`JS-Fehler: ${e.message}`));
      seite.on('response', (r) => { if (r.status() >= 400) probleme.push(`HTTP ${r.status()}: ${r.url()}`); });
      seite.on('requestfailed', (r) => probleme.push(`Laden fehlgeschlagen: ${r.url()}`));
      await seite.goto(basis + url, { waitUntil: 'networkidle' });
      return { seite, probleme };
    }

    const mails = JSON.parse(fs.readFileSync(pfad('emails/html/mails.json'), 'utf8')).mails;
    const seiten = [
      '/', '/landingpage/', '/landingpage/bestaetigt.html?vorname=Test&wartung=2026-01-15',
      '/landingpage/aushang.html', '/landingpage/impressum.html', '/landingpage/datenschutz.html',
      '/automation/ausgabe/K001-03-erinnerung-4-wochen.html',
      ...mails.flatMap((m) => [`/emails/html/${m.datei}.html`, `/emails/html/beispiel/${m.datei}.html`]),
    ];
    for (const url of seiten) {
      for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 800 }]) {
        const { seite, probleme } = await oeffne(url, vp);
        const breiter = await seite.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        if (breiter && !url.startsWith('/emails') && !url.startsWith('/automation')) probleme.push('waagrechtes Scrollen auf der Seite');
        pruefe(probleme.length === 0, `${url} (${vp.width}px)${probleme.length ? '\n      ' + probleme.join('\n      ') : ''}`);
        await seite.close();
      }
    }

    console.log('4. Klickwege');
    {
      const { seite, probleme } = await oeffne('/landingpage/', { width: 390, height: 844 });
      await seite.click('button[type=submit]');
      pruefe(await seite.locator('.feld.hat-fehler').count() === 4 && await seite.locator('#einwilligung-box.hat-fehler').count() === 1,
        'Leeres Formular zeigt Fehlermeldungen (4 Felder + Einwilligung)');
      await seite.fill('#vorname', 'Erika');
      await seite.fill('#nachname', 'Test');
      await seite.fill('#email', 'erika@example.com');
      await seite.selectOption('#heizungsart', 'waermepumpe');
      await seite.fill('#letzte_wartung', '2026-03-01');
      await seite.check('#einwilligung');
      await seite.click('button[type=submit]');
      pruefe(await seite.isVisible('#bitte-bestaetigen') && await seite.isHidden('#formular-karte'), 'Nach Absenden: „Bitte bestätigen Sie Ihre E-Mail-Adresse“');
      pruefe((await seite.textContent('#bitte-bestaetigen')).includes('erika@example.com'), 'E-Mail-Adresse wird angezeigt');
      await seite.click('#bestaetigen-link');
      await seite.waitForLoadState('networkidle');
      pruefe((await seite.textContent('h1')) === 'Anmeldung erfolgreich, Erika!', 'Bestätigungsseite „Anmeldung erfolgreich“ mit Vorname');
      pruefe((await seite.textContent('#faellig')) === '01.03.2027', 'Nächste Fälligkeit korrekt berechnet (01.03.2027)');
      pruefe(probleme.length === 0, `Keine Fehler im Anmeldeablauf${probleme.length ? ': ' + probleme.join(', ') : ''}`);
    }
    {
      const { seite, probleme } = await oeffne('/');
      pruefe(await seite.locator('#mail-liste button').count() === 7, 'Übersicht listet 7 Mails');
      pruefe(await seite.locator('#zeitleiste-liste li').count() === 7, 'Zeitleiste zeigt 7 Schritte');
      await seite.click('#mail-liste button[data-nr="3"]');
      await seite.click('[data-ansicht="handy"]');
      await seite.waitForLoadState('networkidle');
      const src = await seite.getAttribute('#mail-frame', 'src');
      pruefe(src.endsWith('beispiel/03-erinnerung-4-wochen.html') && await seite.locator('#rahmen.handy').count() === 1, 'Mail 3 in Handy-Ansicht');
      pruefe((await seite.textContent('#pv-betreff')).startsWith('Anna, Ihre Heizungswartung'), 'Betreffzeile mit Beispieldaten');
      await seite.click('[data-daten="platzhalter"]');
      pruefe((await seite.getAttribute('#mail-frame', 'src')).endsWith('emails/html/03-erinnerung-4-wochen.html'), 'Umschalten auf Platzhalter-Ansicht');
      pruefe(probleme.length === 0, `Keine Fehler in der Übersicht${probleme.length ? ': ' + probleme.join(', ') : ''}`);
    }
    {
      const { seite } = await oeffne('/landingpage/aushang.html');
      const qr = await seite.locator('#qrcode img, #qrcode canvas').count();
      pruefe(qr > 0, qr > 0 ? 'Aushang: QR-Code erzeugt' : 'Aushang: QR-Code fehlt (cdnjs erreichbar? sonst QR_LIB_DATEI setzen)');
      await seite.emulateMedia({ media: 'print' });
      const hoehe = await seite.evaluate(() => document.querySelector('.blatt').getBoundingClientRect().height);
      pruefe(Math.abs(hoehe - 793.7) < 2, `Aushang im Druck exakt A5-hoch (${hoehe.toFixed(1)}px ≈ 210 mm)`);
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

main()
  .catch((e) => { fail(e.stack || e.message); })
  .finally(() => {
    console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nAlle Prüfungen bestanden.');
    process.exitCode = fehler ? 1 : 0;
  });
