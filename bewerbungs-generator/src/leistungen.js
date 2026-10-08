// Regelbasierte Vorprüfung möglicher Sozialleistungen und Förderungen in Deutschland.
// Ergebnis ist eine ORIENTIERUNG, kein Bescheid: Ob ein Anspruch besteht, entscheidet die zuständige Stelle.
// Beträge werden bewusst nur grob genutzt; sie ändern sich jährlich.

const AA = 'https://www.arbeitsagentur.de';
const FAMILIE = 'https://familienportal.de';

// Grobe Orientierungswerte für die Bedarfsschätzung (Regelbedarfe Stand 2025/2026, ohne Gewähr).
const ORIENTIERUNG = { erwachsen: 563, partner: 506, kind: 400 };

function zahl(v) {
  const n = parseFloat(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function ja(v) {
  return v === true || v === 'ja';
}

export function kinderAlter(situation) {
  const liste = String(situation?.kinderAlter || '')
    .split(/[,;\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && n >= 0 && n < 40);
  const anzahl = Math.max(liste.length, parseInt(situation?.anzahlKinder, 10) || 0);
  return { liste, anzahl };
}

export function bedarfSchaetzen(situation) {
  const kinder = kinderAlter(situation).anzahl;
  const miete = zahl(situation?.warmmiete) || 0;
  return Math.round(ORIENTIERUNG.erwachsen + (ja(situation?.partner) ? ORIENTIERUNG.partner : 0) + kinder * ORIENTIERUNG.kind + miete);
}

export function pruefeLeistungen(situation = {}) {
  const s = situation;
  const ergebnisse = [];
  const add = (eintrag) => ergebnisse.push({ gruende: [], ...eintrag });

  const status = s.erwerbsstatus || '';
  const arbeitslos = status === 'arbeitslos';
  const gekuendigt = status === 'gekuendigt';
  const beschaeftigt = status === 'beschaeftigt' || gekuendigt;
  const kinder = kinderAlter(s);
  const kinderUnter18 = kinder.liste.filter((a) => a < 18).length || (kinder.liste.length ? 0 : kinder.anzahl);
  const kleinkind = kinder.liste.some((a) => a < 2) || ja(s.schwanger);
  const einkommen = zahl(s.haushaltsEinkommenNetto);
  const brutto = zahl(s.bruttoEinkommen);
  const bedarf = bedarfSchaetzen(s);
  const versichert = zahl(s.versicherungspflichtigMonate);
  const alg1 = ja(s.alg1Bezug);
  const vermoegenHoch = s.vermoegen === 'ueber40';

  // --- Fristen zuerst: hier kann man Geld verlieren ---
  if (gekuendigt) {
    add({
      id: 'kuendigungsschutz', name: 'Kündigungsschutzklage – 3-Wochen-Frist', status: 'dringend',
      kurz: 'Gegen eine Kündigung kann man nur innerhalb von 3 Wochen nach Zugang klagen (§ 4 KSchG). Danach gilt sie als wirksam – auch wenn sie es eigentlich nicht war.',
      gruende: ['Du hast angegeben, dass dir gekündigt wurde.'],
      wo: 'Fachanwalt für Arbeitsrecht, Gewerkschaft (für Mitglieder kostenlos) oder Rechtsantragsstelle beim Arbeitsgericht',
      frist: '3 Wochen ab Zugang der Kündigung',
    });
  }
  if (gekuendigt || (beschaeftigt && s.befristetEndet === 'ja')) {
    add({
      id: 'arbeitsuchend', name: 'Arbeitsuchend melden', status: 'dringend',
      kurz: 'Spätestens 3 Monate vor Ende des Arbeitsverhältnisses – oder innerhalb von 3 Tagen, wenn du es kurzfristiger erfährst – bei der Agentur für Arbeit melden. Sonst droht eine Sperrzeit beim Arbeitslosengeld.',
      gruende: ['Dein Arbeitsverhältnis endet.'],
      wo: 'Agentur für Arbeit (online, telefonisch oder vor Ort)', portal: AA, suchbegriff: 'arbeitsuchend melden',
      frist: '3 Monate vor Ende bzw. 3 Tage nach Kenntnis',
    });
  }
  if (ja(s.lohnAusstehend)) {
    add({
      id: 'insolvenzgeld', name: 'Insolvenzgeld', status: 'pruefen',
      kurz: 'Wenn der Arbeitgeber zahlungsunfähig ist, zahlt die Agentur für Arbeit ausstehenden Lohn für bis zu 3 Monate vor dem Insolvenzereignis.',
      gruende: ['Du hast angegeben, dass Lohn aussteht.'],
      wo: 'Agentur für Arbeit', portal: AA, suchbegriff: 'Insolvenzgeld',
      frist: '2 Monate nach dem Insolvenzereignis',
    });
  }

  // --- Arbeitslosigkeit ---
  if (arbeitslos || gekuendigt) {
    const anwartschaft = versichert == null ? null : versichert >= 12;
    add({
      id: 'alg1', name: 'Arbeitslosengeld (ALG I)',
      status: anwartschaft === false ? 'eher-nicht' : anwartschaft ? 'wahrscheinlich' : 'pruefen',
      kurz: 'Versicherungsleistung, in der Regel etwa 60 % (mit Kind 67 %) des pauschalierten Nettolohns. Voraussetzung: mindestens 12 Monate versicherungspflichtige Beschäftigung in den letzten 30 Monaten.',
      gruende: [
        versichert == null ? 'Angabe zu versicherungspflichtigen Monaten fehlt.' : `Du hast ${versichert} versicherungspflichtige Monate angegeben (nötig: 12 in 30 Monaten).`,
      ],
      wo: 'Agentur für Arbeit', portal: AA, suchbegriff: 'Arbeitslosengeld',
      frist: 'Arbeitslos melden spätestens am ersten Tag der Arbeitslosigkeit',
    });
    add({
      id: 'vermittlungsbudget', name: 'Erstattung von Bewerbungskosten (Vermittlungsbudget)', status: 'wahrscheinlich',
      kurz: 'Die Agentur für Arbeit bzw. das Jobcenter kann Kosten für Bewerbungen, Fahrten zu Vorstellungsgesprächen und sogar einen Umzug für eine neue Stelle übernehmen (§ 44 SGB III).',
      gruende: ['Du bist arbeitslos oder von Arbeitslosigkeit bedroht.'],
      wo: 'Agentur für Arbeit oder Jobcenter – VOR Entstehen der Kosten beantragen', portal: AA, suchbegriff: 'Vermittlungsbudget',
      frist: 'Antrag vor den Ausgaben stellen',
    });
    add({
      id: 'avgs', name: 'Bewerbungscoaching mit AVGS (Aktivierungs- und Vermittlungsgutschein)', status: 'pruefen',
      kurz: 'Mit dem Gutschein kannst du ein kostenloses Bewerbungs- oder Karrierecoaching bei einem zugelassenen Träger machen.',
      gruende: ['Wird bei Arbeitslosigkeit oft bewilligt, wenn man danach fragt.'],
      wo: 'Arbeitsvermittler/in bei Agentur oder Jobcenter ansprechen', portal: AA, suchbegriff: 'Aktivierungs- und Vermittlungsgutschein',
    });
  }

  if (alg1 && ja(s.selbststaendigkeitGeplant)) {
    const rest = zahl(s.alg1RestTage);
    add({
      id: 'gruendungszuschuss', name: 'Gründungszuschuss', status: rest != null && rest < 150 ? 'eher-nicht' : 'pruefen',
      kurz: 'Zuschuss für die Gründung aus dem ALG-I-Bezug heraus. Voraussetzung u. a.: noch mindestens 150 Tage Restanspruch auf ALG I und eine fachkundige Stellungnahme zum Businessplan. Ermessensleistung.',
      gruende: [rest == null ? 'Restanspruch nicht angegeben.' : `Restanspruch laut Angabe: ${rest} Tage (nötig: mind. 150).`],
      wo: 'Agentur für Arbeit – vor Beginn der Selbständigkeit beantragen', portal: AA, suchbegriff: 'Gründungszuschuss',
    });
  }

  // --- Grundsicherung, Wohngeld, Kinderzuschlag ---
  if (einkommen != null) {
    const knapp = einkommen < bedarf * 1.15;
    // Mit eigenem Erwerbseinkommen sind Wohngeld + Kinderzuschlag oft günstiger als Bürgergeld – deshalb breiterer Bereich.
    const untergrenze = (brutto || 0) > 0 ? 0.6 : 0.85;
    const mittel = einkommen >= bedarf * untergrenze && einkommen < bedarf * 1.9;
    if (knapp && !vermoegenHoch && status !== 'studium') {
      add({
        id: 'buergergeld', name: 'Bürgergeld / Grundsicherung für Arbeitsuchende', status: einkommen < bedarf * 0.9 ? 'wahrscheinlich' : 'pruefen',
        kurz: 'Sichert den Lebensunterhalt, wenn Einkommen und Vermögen nicht reichen – auch ergänzend („Aufstocken“) zu Lohn oder ALG I. Wohnkosten werden in angemessener Höhe übernommen.',
        gruende: [`Haushaltseinkommen ${einkommen} € liegt unter bzw. nahe dem grob geschätzten Bedarf von ca. ${bedarf} € (Regelbedarf + Warmmiete).`],
        wo: 'Jobcenter (Antrag auch online)', portal: AA, suchbegriff: 'Bürgergeld',
        frist: 'Leistungen gibt es erst ab dem Monat der Antragstellung – nicht abwarten',
      });
    }
    if (mittel && (zahl(s.warmmiete) || 0) > 0 && !(arbeitslos && einkommen < bedarf * 0.9)) {
      add({
        id: 'wohngeld', name: 'Wohngeld', status: 'pruefen',
        kurz: 'Zuschuss zur Miete (oder zu den Kosten von Wohneigentum) für Haushalte mit eigenem, aber geringem Einkommen. Kann günstiger sein als Bürgergeld – man kann nicht beides gleichzeitig bekommen.',
        gruende: [`Einkommen ${einkommen} € bei Warmmiete ${zahl(s.warmmiete)} € – typischer Bereich für Wohngeld.`],
        wo: 'Wohngeldstelle der Stadt/Gemeinde. Online-Rechner des Bundesbauministeriums (bmwsb.bund.de, „Wohngeldrechner“)', portal: 'https://www.bmwsb.bund.de', suchbegriff: 'Wohngeldrechner',
      });
    }
    if (kinderUnter18 > 0 && mittel) {
      const mindest = ja(s.alleinerziehend) || !ja(s.partner) ? 600 : 900;
      add({
        id: 'kinderzuschlag', name: 'Kinderzuschlag (KiZ)', status: brutto != null && brutto < mindest ? 'eher-nicht' : 'pruefen',
        kurz: `Zusätzliches Geld für Familien mit kleinem Einkommen. Voraussetzung u. a.: Bruttoeinkommen mindestens ${mindest} € im Monat, aber nicht genug für die ganze Familie.`,
        gruende: [brutto == null ? 'Bruttoeinkommen nicht angegeben.' : `Bruttoeinkommen laut Angabe: ${brutto} €.`],
        wo: 'Familienkasse – mit dem „KiZ-Lotsen“ vorab prüfen', portal: AA, suchbegriff: 'KiZ-Lotse',
      });
      add({
        id: 'but', name: 'Bildung und Teilhabe', status: 'pruefen',
        kurz: 'Zuschüsse für Klassenfahrten, Schulbedarf, Mittagessen, Nachhilfe oder Sportverein – wenn Bürgergeld, Wohngeld oder Kinderzuschlag bezogen werden.',
        gruende: ['Kinder im Haushalt und möglicher Anspruch auf eine der Grundleistungen.'],
        wo: 'Jobcenter, Wohngeldstelle oder Kommune', portal: FAMILIE, suchbegriff: 'Bildung und Teilhabe',
      });
    }
  }

  // --- Familie ---
  if (kinder.anzahl > 0 || ja(s.schwanger)) {
    if (kinder.anzahl > 0) {
      add({
        id: 'kindergeld', name: 'Kindergeld', status: 'wahrscheinlich',
        kurz: 'Für Kinder bis 18 Jahre, in Ausbildung oder Studium bis 25. Falls noch nicht beantragt: rückwirkend nur für 6 Monate.',
        gruende: [`${kinder.anzahl} Kind(er) angegeben.`],
        wo: 'Familienkasse der Bundesagentur für Arbeit', portal: AA, suchbegriff: 'Kindergeld',
        frist: 'Rückwirkend nur 6 Monate',
      });
    }
    if (kleinkind) {
      add({
        id: 'elterngeld', name: 'Elterngeld', status: 'pruefen',
        kurz: 'Für Eltern, die nach der Geburt weniger oder nicht arbeiten. Tipp: Ein Steuerklassenwechsel muss mindestens 7 Monate vor Beginn des Mutterschutzes erfolgen, um das Elterngeld zu erhöhen.',
        gruende: [ja(s.schwanger) ? 'Schwangerschaft angegeben.' : 'Kind unter 2 Jahren angegeben.'],
        wo: 'Elterngeldstelle des Bundeslandes, in vielen Ländern online über elterngeld-digital.de', link: `${FAMILIE}/familienportal/familienleistungen/elterngeld`,
        frist: 'Rückwirkend nur 3 Lebensmonate',
      });
    }
    if (ja(s.alleinerziehend) && kinderUnter18 > 0 && s.unterhaltZahltAndererElternteil !== 'ja') {
      add({
        id: 'unterhaltsvorschuss', name: 'Unterhaltsvorschuss', status: 'wahrscheinlich',
        kurz: 'Wenn der andere Elternteil keinen oder zu wenig Unterhalt zahlt, springt der Staat ein (für Kinder bis 18; ab 12 mit zusätzlichen Bedingungen).',
        gruende: ['Alleinerziehend und Unterhalt wird nicht (vollständig) gezahlt.'],
        wo: 'Jugendamt bzw. Unterhaltsvorschussstelle', link: `${FAMILIE}/familienportal/familienleistungen/unterhaltsvorschuss`,
      });
    }
    if (ja(s.alleinerziehend)) {
      add({
        id: 'entlastungsbetrag', name: 'Entlastungsbetrag für Alleinerziehende (Steuerklasse II)', status: 'wahrscheinlich',
        kurz: 'Alleinerziehende mit Kind im Haushalt bekommen Steuerklasse II und einen Freibetrag – mehr Netto vom Lohn.',
        gruende: ['Alleinerziehend angegeben.'],
        wo: 'Finanzamt (Antrag auf Steuerklassenwechsel)', portal: 'https://www.elster.de', suchbegriff: 'Steuerklassenwechsel',
      });
    }
  }

  // --- Bildung & Weiterbildung ---
  if (status === 'studium' || status === 'schule' || s.weiterbildungGeplant === 'studium') {
    add({
      id: 'bafoeg', name: 'BAföG', status: 'pruefen',
      kurz: 'Förderung für Studium und bestimmte Schulformen – zur Hälfte Zuschuss, zur Hälfte zinsloses Darlehen (Schüler-BAföG als Vollzuschuss). Altersgrenze bei Beginn: 45 Jahre.',
      gruende: ['Studium oder Schule angegeben bzw. geplant.'],
      wo: 'Amt für Ausbildungsförderung (meist beim Studierendenwerk); Online-Antrag über bafoeg-digital.de', link: 'https://www.bafoeg.de',
      frist: 'Kein rückwirkendes BAföG – Antrag im ersten Monat stellen',
    });
  }
  if (status === 'ausbildung' && s.wohntBeiEltern === 'nein') {
    add({
      id: 'bab', name: 'Berufsausbildungsbeihilfe (BAB)', status: 'pruefen',
      kurz: 'Zuschuss während einer betrieblichen Ausbildung, wenn man nicht bei den Eltern wohnen kann (z. B. weil der Betrieb zu weit weg ist).',
      gruende: ['In Ausbildung und nicht bei den Eltern wohnend.'],
      wo: 'Agentur für Arbeit', portal: AA, suchbegriff: 'Berufsausbildungsbeihilfe',
    });
  }
  if (s.weiterbildungGeplant === 'aufstieg') {
    add({
      id: 'aufstiegsbafoeg', name: 'Aufstiegs-BAföG', status: 'wahrscheinlich',
      kurz: 'Förderung für Meister, Techniker, Fachwirt und vergleichbare Fortbildungen – einkommensunabhängig für Lehrgangs- und Prüfungskosten, teilweise als Zuschuss.',
      gruende: ['Aufstiegsfortbildung geplant.'],
      wo: 'Zuständige Stelle des Bundeslandes', link: 'https://www.aufstiegs-bafoeg.de',
    });
  }
  if ((arbeitslos || gekuendigt || s.weiterbildungGeplant === 'umschulung') && s.weiterbildungGeplant !== 'nein') {
    add({
      id: 'bildungsgutschein', name: 'Bildungsgutschein / Förderung beruflicher Weiterbildung', status: s.weiterbildungGeplant && s.weiterbildungGeplant !== 'nein' ? 'wahrscheinlich' : 'pruefen',
      kurz: 'Übernahme der Kosten für Weiterbildungen und Umschulungen. Wer einen Berufsabschluss nachholt, kann zusätzlich Weiterbildungsgeld und Prämien für bestandene Prüfungen bekommen.',
      gruende: ['Arbeitslos/gekündigt oder Umschulung geplant.'],
      wo: 'Agentur für Arbeit oder Jobcenter', portal: AA, suchbegriff: 'Bildungsgutschein',
    });
  }

  // --- Gesundheit & Pflege (nur, wenn selbst angegeben) ---
  if (['ja', 'gdb30', 'gdb50'].includes(s.gesundheitlicheEinschraenkung)) {
    add({
      id: 'schwerbehinderung', name: 'Schwerbehindertenausweis bzw. Gleichstellung', status: s.gesundheitlicheEinschraenkung === 'ja' ? 'pruefen' : 'wahrscheinlich',
      kurz: 'Ab einem Grad der Behinderung (GdB) von 50 gibt es u. a. Zusatzurlaub, besonderen Kündigungsschutz und steuerliche Pauschbeträge. Bei GdB 30–40 ist eine Gleichstellung bei der Agentur für Arbeit möglich, wenn der Arbeitsplatz sonst gefährdet ist.',
      gruende: ['Gesundheitliche Einschränkung angegeben. Diese Angabe wird nur hier genutzt, nie für das HR-Profil.'],
      wo: 'Versorgungsamt deines Bundeslandes; Gleichstellung bei der Agentur für Arbeit. Beratung: Sozialverband VdK oder SoVD', link: 'https://www.vdk.de',
    });
  }
  if (ja(s.pflegtAngehoerige)) {
    add({
      id: 'pflege', name: 'Pflegezeit, Familienpflegezeit und Pflegeunterstützungsgeld', status: 'pruefen',
      kurz: 'Für eine akute Pflegesituation bis zu 10 Arbeitstage Freistellung mit Lohnersatz (Pflegeunterstützungsgeld). Dazu Freistellung bis 6 Monate (Pflegezeit) bzw. Teilzeit bis 24 Monate (Familienpflegezeit) mit zinslosem Darlehen.',
      gruende: ['Pflege von Angehörigen angegeben.'],
      wo: 'Pflegekasse der gepflegten Person; Darlehen beim Bundesamt für Familie (BAFzA)', link: FAMILIE,
    });
  }

  // --- Allgemeine Entlastungen ---
  if (ergebnisse.some((e) => ['buergergeld', 'bafoeg', 'bab'].includes(e.id))) {
    add({
      id: 'rundfunk', name: 'Befreiung vom Rundfunkbeitrag', status: 'pruefen',
      kurz: 'Wer Bürgergeld, BAföG (nicht bei den Eltern wohnend), Berufsausbildungsbeihilfe oder Grundsicherung bezieht, kann sich befreien lassen.',
      gruende: ['Möglicher Bezug einer passenden Leistung.'],
      wo: 'ARD ZDF Deutschlandradio Beitragsservice', link: 'https://www.rundfunkbeitrag.de',
    });
  }
  if (einkommen != null && einkommen < bedarf * 1.6 && (gekuendigt || arbeitslos || ergebnisse.some((e) => e.id === 'buergergeld'))) {
    add({
      id: 'beratungshilfe', name: 'Beratungshilfe (anwaltliche Beratung für wenig Geld)', status: 'pruefen',
      kurz: 'Bei geringem Einkommen bekommst du über einen Beratungshilfeschein eine Rechtsberatung, z. B. zu Kündigung, Jobcenter-Bescheid oder Widerspruch, für höchstens 15 € Eigenanteil.',
      gruende: ['Geringes Einkommen und mögliche rechtliche Fragen (Kündigung/Sozialrecht).'],
      wo: 'Amtsgericht am Wohnort (Rechtsantragsstelle) oder direkt bei einer Anwaltskanzlei', portal: 'https://www.justiz.de', suchbegriff: 'Beratungshilfe',
    });
  }
  if (ja(s.schulden)) {
    add({
      id: 'schuldnerberatung', name: 'Kostenlose Schuldnerberatung', status: 'wahrscheinlich',
      kurz: 'Anerkannte Schuldnerberatungsstellen (Kommunen, Wohlfahrtsverbände, Verbraucherzentralen) helfen kostenlos – auch beim Pfändungsschutzkonto (P-Konto).',
      gruende: ['Schulden angegeben.'],
      wo: 'Schuldnerberatung der Kommune, Caritas, Diakonie, AWO oder Verbraucherzentrale', link: 'https://www.verbraucherzentrale.de',
    });
  }

  add({
    id: 'sozialberatung', name: 'Unabhängige Sozialberatung', status: 'hinweis',
    kurz: 'Wohlfahrtsverbände (Caritas, Diakonie, AWO, Paritätischer), Sozialverbände (VdK, SoVD) und Erwerbslosenberatungen prüfen kostenlos, welche Leistungen dir zustehen – und helfen bei Anträgen und Widersprüchen.',
    gruende: ['Gilt für alle: Eine persönliche Beratung findet oft Ansprüche, die man selbst übersieht.'],
    wo: 'Beratungsstellen vor Ort', link: 'https://www.vdk.de',
  });

  const reihenfolge = { dringend: 0, wahrscheinlich: 1, pruefen: 2, 'eher-nicht': 3, hinweis: 4 };
  ergebnisse.sort((a, b) => reihenfolge[a.status] - reihenfolge[b.status]);
  return { bedarfSchaetzung: einkommen != null ? bedarf : null, ergebnisse };
}
