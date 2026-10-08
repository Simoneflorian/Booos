// Steuertipps rund um Job, Bewerbung und Jobwechsel (Deutschland, Stand 2026).
// Nur mit ausdrücklicher Einwilligung. Keine Steuerberatung – Beträge sind Orientierung.

const WERTE = {
  arbeitnehmerPauschbetrag: 1230,
  entfernungspauschaleKm: 0.38, // ab 2026 ab dem ersten Kilometer
  homeofficeTag: 6,
  homeofficeMaxTage: 210,
  dienstreiseKm: 0.3,
  bewerbungOnline: 2.5, // gängige, von vielen Finanzämtern akzeptierte Erfahrungswerte – keine gesetzlichen Pauschalen
  bewerbungPost: 8.5,
  kontofuehrung: 16,
};

function zahl(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function euro(n) {
  return `${Math.round(n).toLocaleString('de-DE')} €`;
}

export function steuerTipps(steuer = {}, situation = {}) {
  const posten = [];
  const tipps = [];

  const km = zahl(steuer.entfernungKm);
  const buerotage = zahl(steuer.arbeitstageBuero);
  if (km && buerotage) {
    posten.push({ name: `Fahrten zur Arbeit (${buerotage} Tage × ${km} km × ${WERTE.entfernungspauschaleKm.toFixed(2).replace('.', ',')} €)`, betrag: km * buerotage * WERTE.entfernungspauschaleKm });
  }
  const hoTage = Math.min(zahl(steuer.homeofficeTage), WERTE.homeofficeMaxTage);
  if (hoTage) posten.push({ name: `Homeoffice-Pauschale (${hoTage} Tage × 6 €)`, betrag: hoTage * WERTE.homeofficeTag });

  const online = zahl(steuer.bewerbungenOnline);
  const post = zahl(steuer.bewerbungenPost);
  if (online || post) {
    posten.push({ name: `Bewerbungskosten (${online} online, ${post} per Post – Erfahrungswerte)`, betrag: online * WERTE.bewerbungOnline + post * WERTE.bewerbungPost });
  }
  const vgKm = zahl(steuer.vorstellungsgespraecheKm);
  if (vgKm) posten.push({ name: `Fahrten zu Vorstellungsgesprächen (${vgKm} km × 0,30 €)`, betrag: vgKm * WERTE.dienstreiseKm });
  if (zahl(steuer.fortbildungskosten)) posten.push({ name: 'Fort- und Weiterbildung', betrag: zahl(steuer.fortbildungskosten) });
  if (zahl(steuer.arbeitsmittel)) posten.push({ name: 'Arbeitsmittel (Laptop, Fachliteratur, Werkzeug …)', betrag: zahl(steuer.arbeitsmittel) });
  if (zahl(steuer.gewerkschaftBeitrag)) posten.push({ name: 'Gewerkschaftsbeiträge', betrag: zahl(steuer.gewerkschaftBeitrag) });
  if (posten.length) posten.push({ name: 'Kontoführungsgebühren (pauschal, von Finanzämtern meist akzeptiert)', betrag: WERTE.kontofuehrung });

  const summe = posten.reduce((s, p) => s + p.betrag, 0);
  const ueberPauschale = Math.max(0, summe - WERTE.arbeitnehmerPauschbetrag);

  const arbeitslos = ['arbeitslos', 'gekuendigt'].includes(situation?.erwerbsstatus);

  if (zahl(steuer.bewerbungenOnline) || zahl(steuer.bewerbungenPost) || vgKm) {
    tipps.push({
      titel: 'Bewerbungskosten sind Werbungskosten',
      text: 'Mappen, Fotos, Porto, Druck, Fahrten zu Vorstellungsgesprächen (0,30 €/km) und ggf. Übernachtungen kannst du in der Anlage N angeben – auch wenn die Bewerbung erfolglos war. Belege oder eine Liste der Bewerbungen aufheben.',
    });
  }
  if (arbeitslos) {
    tipps.push({
      titel: 'Auch ohne Einkommen eine Steuererklärung machen',
      text: 'Bewerbungs- und Weiterbildungskosten während der Arbeitslosigkeit sind „vorweggenommene Werbungskosten“. Ohne Einkommen entsteht ein Verlust, den das Finanzamt feststellt und in Jahre mit Einkommen vorträgt.',
    });
  }
  if (steuer.lohnersatz === 'ja') {
    tipps.push({
      titel: 'Pflicht zur Steuererklärung bei Lohnersatzleistungen',
      text: 'Wer mehr als 410 € Arbeitslosengeld, Kurzarbeitergeld, Krankengeld oder Elterngeld im Jahr bekommen hat, muss eine Steuererklärung abgeben (Progressionsvorbehalt). Die Leistung selbst ist steuerfrei, erhöht aber den Steuersatz aufs übrige Einkommen – Nachzahlungen sind möglich, Rücklagen sinnvoll.',
      wichtig: true,
    });
  }
  if (steuer.abfindung === 'ja') {
    tipps.push({
      titel: 'Abfindung: Fünftelregelung in der Steuererklärung beantragen',
      text: 'Seit 2025 berücksichtigt der Arbeitgeber die Fünftelregelung nicht mehr beim Lohnsteuerabzug. Die Steuerermäßigung gibt es nur über die Steuererklärung – sie kann einen großen Unterschied machen.',
      wichtig: true,
    });
  }
  if (steuer.umzugBeruflich === 'ja') {
    tipps.push({
      titel: 'Umzugskosten für den neuen Job',
      text: 'Ein beruflich veranlasster Umzug (z. B. neuer Arbeitgeber, Fahrzeit deutlich kürzer) ist als Werbungskosten absetzbar: Transport, Maklerkosten für eine Mietwohnung, doppelte Miete sowie eine Pauschale für sonstige Umzugsauslagen. Erstattet der Arbeitgeber, entfällt der Abzug.',
    });
  }
  if (zahl(steuer.kinderbetreuungskosten)) {
    tipps.push({
      titel: 'Kinderbetreuungskosten',
      text: `80 % der Kosten für Kita, Tagesmutter oder Hort (für Kinder unter 14), höchstens 4.800 € je Kind, sind als Sonderausgaben absetzbar. Bei deiner Angabe wären das bis zu ${euro(Math.min(zahl(steuer.kinderbetreuungskosten) * 0.8, 4800))} je Kind.`,
    });
  }
  if (steuer.haushaltsnaheDL === 'ja' || zahl(steuer.handwerkerkosten)) {
    tipps.push({
      titel: 'Haushaltsnahe Dienstleistungen und Handwerker',
      text: '20 % der Arbeitskosten (nicht Material) werden direkt von der Steuer abgezogen: bei haushaltsnahen Dienstleistungen bis 4.000 €, bei Handwerkerleistungen bis 1.200 € Steuerermäßigung im Jahr. Auch Nebenkostenabrechnung (Hausmeister, Treppenreinigung) prüfen. Nur bei Überweisung, nicht bei Barzahlung.',
    });
  }
  if (steuer.verheiratet === 'ja') {
    tipps.push({
      titel: 'Steuerklassen bei Jobwechsel oder drohender Arbeitslosigkeit prüfen',
      text: 'Arbeitslosengeld und Elterngeld richten sich nach dem Netto. Ein rechtzeitiger Steuerklassenwechsel (bei Elterngeld mindestens 7 Monate vor Beginn des Mutterschutzes) kann die Leistung erhöhen. Die Agentur für Arbeit prüft bei ALG, ob der Wechsel „zweckmäßig“ ist – vorher beraten lassen.',
    });
  }
  if (steuer.nebenjob === 'ja') {
    tipps.push({
      titel: 'Nebenjob neben der Hauptstelle',
      text: 'Ein Minijob bleibt für dich in der Regel steuer- und abgabenfrei, solange er unter der Minijob-Grenze bleibt. Ein zweiter regulärer Job läuft über Steuerklasse VI – zu viel gezahlte Steuer holst du über die Steuererklärung zurück.',
    });
  }
  if (steuer.steuererklaerung !== 'jaehrlich') {
    tipps.push({
      titel: 'Steuererklärung bis zu 4 Jahre rückwirkend',
      text: 'Wer nicht zur Abgabe verpflichtet ist, kann freiwillig 4 Jahre rückwirkend eine Erklärung abgeben (im Jahr 2026 noch für 2022). Im Schnitt erstattet das Finanzamt Arbeitnehmern einen mittleren dreistelligen Betrag. Kostenlos über ELSTER.',
    });
  }
  tipps.push({
    titel: 'Hilfe bei der Steuererklärung',
    text: 'Arbeitnehmer können sich günstig von einem Lohnsteuerhilfeverein beraten lassen (Jahresbeitrag nach Einkommen). Für komplexe Fälle (Abfindung, Selbständigkeit, Immobilien) lohnt sich eine Steuerberaterin bzw. ein Steuerberater.',
  });

  return {
    stand: '2026',
    werbungskosten: {
      posten: posten.map((p) => ({ ...p, betrag: Math.round(p.betrag) })),
      summe: Math.round(summe),
      pauschbetrag: WERTE.arbeitnehmerPauschbetrag,
      ueberPauschale: Math.round(ueberPauschale),
      fazit: !posten.length
        ? 'Keine Angaben zu Werbungskosten gemacht.'
        : ueberPauschale > 0
          ? `Deine Werbungskosten liegen ca. ${euro(ueberPauschale)} über dem Arbeitnehmer-Pauschbetrag von 1.230 €. Einzeln angeben lohnt sich – bei 25–35 % Grenzsteuersatz grob ${euro(ueberPauschale * 0.25)} bis ${euro(ueberPauschale * 0.35)} Erstattung.`
          : `Deine Werbungskosten liegen unter dem Pauschbetrag von 1.230 €, den das Finanzamt ohnehin automatisch abzieht. Fehlende Posten (z. B. Fahrten, Homeoffice, Arbeitsmittel) ergänzen – vielleicht kommst du darüber.`,
    },
    tipps,
  };
}
