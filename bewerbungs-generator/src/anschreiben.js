// Anschreiben-Vorlage ohne KI: setzt die Profildaten in ein solides Grundgerüst ein.
// Das Ergebnis ist ein Entwurf zum Weiterschreiben – Lücken sind mit [eckigen Klammern] markiert.

function erste(liste) {
  return String(liste || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean)[0] || '';
}

function unternehmenAusAnzeige(text) {
  const m = /(?:bei der|bei|für die|für) ([A-ZÄÖÜ][\w&.\- ]{2,50}?(?:GmbH|AG|KG|SE|e\.V\.|mbH|GmbH & Co\. KG|Gruppe|Group))/.exec(text || '');
  return m ? m[1].trim() : '';
}

function stelleAusAnzeige(text) {
  const zeile = String(text || '').split(/\r?\n/).map((z) => z.trim()).find((z) => z.length > 4 && z.length < 90);
  return zeile || '';
}

export function anschreibenVorlage(profil = {}, stellenanzeige = '') {
  const p = profil.persoenlich || {};
  const stationen = [...(profil.stationen || [])].sort((a, b) => String(b.von).localeCompare(String(a.von)));
  const aktuell = stationen[0];
  const position = stelleAusAnzeige(stellenanzeige) || erste(profil.wunsch?.positionen) || '[Stellenbezeichnung]';
  const firma = unternehmenAusAnzeige(stellenanzeige) || '[Unternehmen]';
  const jahre = stationen.length ? new Date().getFullYear() - parseInt(stationen[stationen.length - 1].von, 10) : 0;
  const staerke = erste(profil.arbeitsweise?.staerken) || '[Ihre wichtigste Stärke]';
  const erfolg = aktuell?.erfolge ? String(aktuell.erfolge).split(/\r?\n/)[0] : '[ein konkreter, messbarer Erfolg]';
  const fachlich = String(profil.kompetenzen?.fachlich || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 3).join(', ') || '[2–3 Fachkenntnisse aus der Anzeige]';
  const eintritt = p.verfuegbarAb ? `ab ${p.verfuegbarAb.split('-').reverse().join('.')}` : p.kuendigungsfrist ? `unter Berücksichtigung meiner Kündigungsfrist (${p.kuendigungsfrist})` : '[ab wann]';

  const betreff = `Bewerbung als ${position}`;
  const absaetze = [
    'Sehr geehrte Damen und Herren,',
    `${aktuell ? `als ${aktuell.position || '[aktuelle Position]'}${aktuell.arbeitgeber ? ` bei ${aktuell.arbeitgeber}` : ''}` : 'mit meiner Ausbildung und meinen bisherigen Erfahrungen'} bringe ich genau das mit, was Sie für die Position „${position}“ suchen. Was mich an ${firma} besonders anspricht: [ein konkreter Grund – Produkt, Werte, Region, Entwicklungsmöglichkeiten].`,
    `${jahre > 0 ? `In ${jahre} Jahren Berufserfahrung` : 'In meiner bisherigen Laufbahn'} habe ich vor allem in ${fachlich} gearbeitet. ${erfolg.endsWith('.') ? erfolg : `${erfolg}.`}`,
    `Meine Kolleginnen und Kollegen schätzen an mir besonders: ${staerke}. [Ein kurzes Beispiel, das diese Stärke belegt.]`,
    `Ich kann die Stelle ${eintritt} antreten.${profil.wunsch?.gehalt ? ` Meine Gehaltsvorstellung liegt bei ${Number(profil.wunsch.gehalt).toLocaleString('de-DE')} € brutto im Jahr.` : ''} Über die Einladung zu einem persönlichen Gespräch freue ich mich.`,
    'Mit freundlichen Grüßen',
    [p.vorname, p.nachname].filter(Boolean).join(' ') || '[Vorname Nachname]',
  ];
  return {
    betreff,
    anschreiben: absaetze.join('\n\n'),
    hinweise: [
      'Alles in [eckigen Klammern] durch eigene Angaben ersetzen.',
      'Ansprechperson aus der Anzeige verwenden statt „Sehr geehrte Damen und Herren“.',
      'Die zwei wichtigsten Anforderungen der Anzeige aufgreifen und mit je einem Beispiel belegen.',
    ],
  };
}
