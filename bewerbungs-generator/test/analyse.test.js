import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { analysiereArbeitszeugnis, analysiereSchulzeugnis } from '../src/zeugnis.js';
import { textExtrahieren, lokalAuswerten, dokumentartErkennen, zeitraeumeFinden, aggHinweise } from '../src/dokumente.js';
import { analysiereProfil, lueckenFinden, berufserfahrungMonate, anforderungsniveau } from '../src/hr-analyse.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const beispiel = (name) => fs.readFileSync(path.join(ROOT, 'beispiel', name), 'utf8');

test('Zeugnissprache: Leistungsnoten werden richtig erkannt', () => {
  const faelle = [
    ['Sie erledigte ihre Aufgaben stets zu unserer vollsten Zufriedenheit.', 1],
    ['Er erledigte seine Aufgaben stets zu unserer vollen Zufriedenheit.', 2],
    ['Er erledigte seine Aufgaben zu unserer vollen Zufriedenheit.', 3],
    ['Er erledigte seine Aufgaben zu unserer Zufriedenheit.', 4],
    ['Er erledigte seine Aufgaben im Großen und Ganzen zu unserer Zufriedenheit.', 5],
    ['Er hat sich bemüht, die Aufgaben zu erledigen.', 6],
  ];
  for (const [satz, note] of faelle) {
    assert.equal(analysiereArbeitszeugnis(satz).leistung?.note, note, satz);
  }
});

test('Zeugnissprache: Verhalten, Reihenfolge, Schlussformel und Codes', () => {
  const z = analysiereArbeitszeugnis(`Seine Leistungen waren stets zu unserer vollsten Zufriedenheit.
    Sein Verhalten gegenüber Kollegen und Vorgesetzten war stets vorbildlich. Durch seine Geselligkeit trug er zur Verbesserung des Betriebsklimas bei.
    Das Arbeitsverhältnis endet im gegenseitigen Einvernehmen.`);
  assert.equal(z.verhalten.note, 1);
  assert.ok(z.hinweise.some((h) => h.includes('Kollegen werden vor den Vorgesetzten')));
  assert.ok(z.hinweise.some((h) => h.includes('Schlussformel')));
  assert.ok(z.warnsignale.some((w) => w.includes('Geselligkeit')));
  assert.match(z.austritt, /Einvernehmen/);
});

test('Beispiel-Arbeitszeugnis ergibt Note 2 mit sehr positiver Schlussformel', () => {
  const z = analysiereArbeitszeugnis(beispiel('arbeitszeugnis-beispiel.txt'));
  assert.equal(z.gesamtnote, 2);
  assert.equal(z.schlussformel.bewertung, 'sehr positiv');
  assert.match(z.austritt, /eigenen Wunsch/);
  assert.deepEqual(z.warnsignale, []);
});

test('Schulzeugnis: Fächer, Wortnoten und Durchschnitt', () => {
  const n = analysiereSchulzeugnis(beispiel('schulzeugnis-beispiel.txt'));
  assert.equal(n.abschluss, 'Mittlerer Schulabschluss');
  assert.equal(n.durchschnittAngegeben, 2.3);
  assert.equal(n.faecher.length, 7);
  assert.deepEqual(n.faecher.find((f) => f.fach === 'Wirtschaft'), { fach: 'Wirtschaft', note: 1 });
  assert.ok(!n.faecher.some((f) => /durchschnitt/i.test(f.fach)));
});

test('Dokumentart wird für alle Beispiel-Unterlagen erkannt', () => {
  assert.equal(dokumentartErkennen(beispiel('lebenslauf-beispiel.txt')).art, 'lebenslauf');
  assert.equal(dokumentartErkennen(beispiel('arbeitszeugnis-beispiel.txt')).art, 'arbeitszeugnis');
  assert.equal(dokumentartErkennen(beispiel('schulzeugnis-beispiel.txt')).art, 'schulzeugnis');
  assert.equal(dokumentartErkennen('Einkaufsliste: Milch, Brot').art, 'sonstiges');
});

test('Lebenslauf: Zeiträume, Kontakt, Software und Sprachen', () => {
  const a = lokalAuswerten(beispiel('lebenslauf-beispiel.txt'), 'cv.txt');
  assert.equal(a.stationen.length, 3);
  assert.deepEqual([a.stationen[0].von, a.stationen[0].bis, a.stationen[0].laufend], ['2021-03', '', true]);
  assert.equal(a.stationen[2].art, 'ausbildung');
  assert.equal(a.kontakt.email, 'erika.beispiel@example.com');
  assert.ok(a.kompetenzen.software.includes('DATEV'));
  assert.deepEqual(a.kompetenzen.sprachen.find((s) => s.sprache === 'Englisch'), { sprache: 'Englisch', niveau: 'B2' });
});

test('Zeiträume in verschiedenen Schreibweisen', () => {
  const st = zeitraeumeFinden('2015 - 2018 Studium BWL\n01.2019 bis 06/2020: Praktikum Marketing\nseit 2020 – aktuell Junior Manager');
  assert.equal(st.length, 3);
  assert.deepEqual([st[0].von, st[0].bis], ['2015-01', '2018-12']);
  assert.equal(st[1].art, 'praktikum');
  assert.equal(st[2].laufend, true);
});

test('AGG-relevante Angaben werden erkannt', () => {
  assert.deepEqual(aggHinweise('Geboren am 01.01.1990, verheiratet, Religion: katholisch'), ['Geburtsdatum/Alter', 'Familienstand', 'Religion']);
});

test('PDF-Text wird ausgelesen (Text-PDF, kein Scan)', async () => {
  const buffer = fs.readFileSync(path.join(ROOT, 'test/fixtures/arbeitszeugnis.pdf'));
  const r = await textExtrahieren({ name: 'zeugnis.pdf', mime: 'application/pdf', buffer });
  assert.equal(r.seiten, 1);
  assert.equal(r.gescannt, false);
  assert.match(r.text, /vollen Zufriedenheit/);
});

test('Nicht unterstützte Dateitypen werden abgelehnt', async () => {
  await assert.rejects(textExtrahieren({ name: 'x.exe', mime: 'application/x-msdownload', buffer: Buffer.from('MZ') }), /nicht unterstützt/);
});

const PROFIL = {
  wunsch: { positionen: 'Finanzbuchhalterin\nKreditorenbuchhalterin', arbeitszeit: 'vollzeit' },
  bildung: {
    schulabschluss: 'Mittlerer Schulabschluss',
    ausbildungen: [{ beruf: 'Kauffrau für Büromanagement', von: '2014-08', bis: '2017-06', abschluss: 'IHK' }],
  },
  stationen: [
    { position: 'Sachbearbeiterin Buchhaltung', arbeitgeber: 'Muster Handels GmbH', von: '2021-03', bis: '', art: 'Vollzeit', erfolge: 'Durchlaufzeit -40 %' },
    { position: 'Kauffrau für Büromanagement', arbeitgeber: 'Beispiel Logistik AG', von: '2017-08', bis: '2020-06', art: 'Vollzeit' },
  ],
  kompetenzen: { fachlich: 'Kreditorenbuchhaltung, Monatsabschluss', software: 'DATEV, Excel', sprachen: [{ sprache: 'Englisch', niveau: 'B2' }] },
};
const HEUTE = new Date(2026, 9, 8); // 08.10.2026

test('HR: Berufserfahrung ohne Doppelzählung, Lücken werden gefunden', () => {
  assert.equal(berufserfahrungMonate(PROFIL, HEUTE), 68 + 35);
  const l = lueckenFinden(PROFIL, HEUTE);
  assert.deepEqual(l, [{ von: '07/2020', bis: '02/2021', monate: 8 }]);
});

test('HR: Einordnung als Fachkraft, Senior, Berufsbereich Verwaltung', () => {
  const r = analysiereProfil(PROFIL, [], HEUTE);
  assert.equal(r.kategorisierung.anforderungsniveau.name, 'Fachkraft');
  assert.equal(r.kategorisierung.senioritaet.stufe, 'Senior');
  assert.equal(r.kategorisierung.hoechsterAbschluss.dqr, 4);
  assert.equal(r.kategorisierung.berufsbereiche[0].kldb, 7);
  assert.ok(r.risiken.some((t) => t.includes('07/2020')));
  assert.ok(r.fehlendeAngaben.some((f) => f.pfad === 'wunsch.gehalt'));
  assert.ok(r.fehlendeAngaben.some((f) => f.pfad === 'stationen.1.erfolge'));
  assert.ok(r.vollstaendigkeit > 0 && r.vollstaendigkeit < 100);
});

test('HR: Anforderungsniveau steigt mit Master bzw. langer Erfahrung', () => {
  assert.equal(anforderungsniveau({ bildung: { studium: [{ abschluss: 'Master' }] } }, 1).stufe, 4);
  assert.equal(anforderungsniveau({}, 6).stufe, 2);
  assert.equal(anforderungsniveau({}, 1).stufe, 1);
});

test('HR: Zeugnisnoten und AGG-Treffer aus Dokumenten fließen ein', () => {
  const dok = { analyse: { art: { art: 'lebenslauf' }, arbeitszeugnis: { gesamtnote: 1.5, warnsignale: [] }, agg: ['Familienstand'], kontakt: { email: 'a@b.de', telefon: '0123 4567890' }, stationen: [{}] }, gescannt: false };
  const r = analysiereProfil(PROFIL, [dok], HEUTE);
  assert.equal(r.zeugnisse.durchschnittNote, 1.5);
  assert.ok(r.staerken.some((s) => s.includes('Note 1,5')));
  assert.ok(r.tipps.some((t) => t.includes('Familienstand')));
  assert.ok(r.ats.every((a) => a.ok || a.text.includes('Schlüsselwörter')));
});
