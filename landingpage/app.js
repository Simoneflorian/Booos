// Anmeldeformular mit simuliertem Double-Opt-in. Es werden KEINE Daten übertragen:
// Die Eingaben werden nur an die Bestätigungsseite (als URL-Parameter, lokal im Browser) weitergereicht.
(function () {
  'use strict';

  var form = document.getElementById('anmeldeformular');
  if (!form) return;

  var formularKarte = document.getElementById('formular-karte');
  var bestaetigenKarte = document.getElementById('bitte-bestaetigen');
  var datum = document.getElementById('letzte_wartung');

  function heuteIso() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var t = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + t;
  }
  datum.max = heuteIso();

  var EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  var pruefungen = {
    vorname: function (f) { return f.value.trim().length > 0; },
    nachname: function (f) { return f.value.trim().length > 0; },
    email: function (f) { return EMAIL_MUSTER.test(f.value.trim()); },
    heizungsart: function (f) { return f.value !== ''; },
    letzte_wartung: function (f) { return f.value === '' || f.value <= heuteIso(); }
  };

  function setzeFehler(feld, fehler) {
    var huelle = feld.type === 'checkbox' ? document.getElementById('einwilligung-box') : feld.closest('.feld');
    huelle.classList.toggle('hat-fehler', fehler);
    feld.setAttribute('aria-invalid', fehler ? 'true' : 'false');
  }

  function pruefeFeld(feld) {
    var ok = feld.type === 'checkbox' ? feld.checked : pruefungen[feld.name](feld);
    setzeFehler(feld, !ok);
    return ok;
  }

  // Fehler erst nach dem ersten Verlassen des Feldes bzw. Absenden anzeigen.
  Array.prototype.forEach.call(form.elements, function (feld) {
    if (!feld.name) return;
    feld.addEventListener('blur', function () { if (feld.value !== '' || feld.dataset.beruehrt) pruefeFeld(feld); });
    feld.addEventListener('change', function () { feld.dataset.beruehrt = '1'; pruefeFeld(feld); });
    feld.addEventListener('input', function () {
      if (feld.getAttribute('aria-invalid') === 'true') pruefeFeld(feld);
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var erstesFehlerfeld = null;
    Array.prototype.forEach.call(form.elements, function (feld) {
      if (!feld.name) return;
      if (!pruefeFeld(feld) && !erstesFehlerfeld) erstesFehlerfeld = feld;
    });
    if (erstesFehlerfeld) {
      erstesFehlerfeld.focus();
      return;
    }

    var daten = {
      vorname: form.vorname.value.trim(),
      email: form.email.value.trim(),
      heizungsart: form.heizungsart.value,
      wartung: form.letzte_wartung.value
    };

    bestaetigenKarte.querySelectorAll('[data-feld]').forEach(function (el) {
      el.textContent = daten[el.getAttribute('data-feld')];
    });

    var params = new URLSearchParams({ vorname: daten.vorname, heizung: daten.heizungsart });
    if (daten.wartung) params.set('wartung', daten.wartung);
    document.getElementById('bestaetigen-link').href = 'bestaetigt.html?' + params.toString();

    formularKarte.hidden = true;
    bestaetigenKarte.hidden = false;
    bestaetigenKarte.focus();
    bestaetigenKarte.scrollIntoView({ block: 'start' });
  });
})();
