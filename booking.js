/* Ironside Barbers: salva le prenotazioni su Supabase.
   In questo file va SOLO la chiave pubblica (publishable).
   NON inserire MAI la chiave secret / service_role. */
(function () {
  var SUPABASE_URL = 'https://butpgokfrhazqvjlbebh.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_Egfe3TMqP3J5o737qObtpA_9lgGSGZv';
  var BARBERS = ['Marco', 'Dario', 'Tommaso'];
  var ANY = 'Qualsiasi disponibile';

  var form = document.getElementById('bookingForm');
  var dateEl = document.getElementById('date');
  var timesEl = document.getElementById('times');
  if (!form || !dateEl || !timesEl) return;

  var booked = [];
  var slotReq = 0;

  var css = document.createElement('style');
  css.textContent =
    '.opt input:disabled+span{opacity:.4;text-decoration:line-through;cursor:not-allowed}' +
    '.opt input:disabled+span:hover{border-color:var(--sand)}' +
    '.btn:disabled{opacity:.6;cursor:wait;transform:none}';
  document.head.appendChild(css);

  document.getElementById('name').maxLength = 80;
  document.getElementById('phone').maxLength = 20;

  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(x) { return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); }

  function rpc(fn, args) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify(args)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function applyTaken(prevVal) {
    var inputs = timesEl.querySelectorAll('input[name=time]');
    if (!inputs.length) return;
    var sel = form.querySelector('input[name=barber]:checked');
    var barber = sel ? sel.value : ANY;
    var open = [];
    inputs.forEach(function (inp) {
      var hr = parseInt(inp.value, 10);
      var at = booked
        .filter(function (b) { return parseInt(b.slot_time, 10) === hr; })
        .map(function (b) { return b.barber; });
      var taken = barber === ANY
        ? BARBERS.every(function (n) { return at.indexOf(n) > -1; })
        : at.indexOf(barber) > -1;
      inp.disabled = taken;
      inp.checked = false;
      if (!taken) open.push(inp);
    });
    if (!open.length) {
      timesEl.innerHTML = '<span style="color:var(--muted);font-size:14px">Tutto occupato in questa data</span>';
      return;
    }
    var pick = open.filter(function (i) { return i.value === prevVal; })[0] || open[0];
    pick.checked = true;
  }

  function render() {
    var prev = form.querySelector('input[name=time]:checked');
    var prevVal = prev && prev.value;
    if (typeof buildTimes === 'function') buildTimes();
    applyTaken(prevVal);
  }

  function refresh() {
    var req = ++slotReq;
    var d = dateEl.value;
    if (!d) return;
    rpc('get_booked_slots', { p_date: d })
      .then(function (rows) {
        if (req === slotReq && Array.isArray(rows)) { booked = rows; render(); }
      })
      .catch(function () {});
  }

  var today = iso(new Date());
  dateEl.min = today;
  dateEl.max = iso(new Date(Date.now() + 60 * 864e5));
  if (!dateEl.value || dateEl.value < today) {
    dateEl.value = today;
    dateEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  dateEl.addEventListener('change', function () { booked = []; refresh(); });
  form.addEventListener('change', function (e) {
    if (e.target && e.target.name === 'barber') render();
  });

  document.addEventListener('submit', function (e) {
    if (e.target !== form) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    var err = document.getElementById('err');
    var ok = document.getElementById('confirm');
    ok.classList.remove('show');
    err.textContent = '';

    var svcs = [].slice.call(form.querySelectorAll('input[name=svc]:checked')).map(function (i) { return i.dataset.name; });
    var time = form.querySelector('input[name=time]:checked');
    var name = document.getElementById('name').value.trim();
    var phone = document.getElementById('phone').value.trim();

    if (!svcs.length) { err.textContent = 'Scegli almeno un servizio.'; return; }
    if (!time) { err.textContent = 'Scegli una data e un orario disponibili.'; return; }
    if (!name || !phone) { err.textContent = 'Inserisci nome e numero di telefono per confermare.'; return; }
    if (name.length < 2 || name.length > 80) { err.textContent = 'Inserisci il tuo nome e cognome.'; return; }
    var digits = phone.replace(/\D/g, '');
    if (!/^\+?[0-9][0-9 ()\-]*$/.test(phone) || digits.length < 7 || digits.length > 15) {
      err.textContent = 'Inserisci un numero di telefono valido.'; return;
    }

    var barber = form.querySelector('input[name=barber]:checked').value;
    var when = new Date(dateEl.value + 'T12:00').toLocaleDateString('it-IT', { weekday: 'long', month: 'long', day: 'numeric' });
    var btn = form.querySelector('button[type=submit]');
    var saved = false;
    btn.disabled = true;

    rpc('create_booking', {
      p_name: name, p_phone: phone, p_services: svcs,
      p_barber: barber, p_date: dateEl.value, p_time: time.value
    })
      .then(function (res) {
        if (res && res.ok) {
          saved = true;
          var style = (typeof pickedStyle !== 'undefined') ? pickedStyle : null;
          ok.textContent = 'Prenotazione confermata, ' + name + '. ' +
            svcs.map(function (n) { return n === 'Taglio' && style ? 'Taglio (' + style + ')' : n; }).join(' + ') +
            ' con ' + res.barber + ' ' + when + ' alle ' + time.value + '. Ti aspettiamo.';
          ok.classList.add('show');
          var unlock = function () {
            btn.disabled = false;
            form.removeEventListener('input', unlock);
            form.removeEventListener('change', unlock);
          };
          form.addEventListener('input', unlock);
          form.addEventListener('change', unlock);
          refresh();
        } else {
          err.textContent = (res && res.message) || 'Non è stato possibile salvare la prenotazione. Riprova.';
          if (res && res.error === 'slot_taken') refresh();
        }
      })
      .catch(function () {
        err.textContent = 'Impossibile contattare il sistema di prenotazione. Riprova o chiamaci.';
      })
      .then(function () { if (!saved) btn.disabled = false; });
  }, true);

  refresh();
})();
