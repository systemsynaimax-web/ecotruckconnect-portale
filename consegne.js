/* =====================================================================
   EcoTruckConnect — CONSEGNATO / VERIFICATO (decisione 18/11/2026)
   Un solo file, usato da: portale (index.html) e Dashboard Gestori (dashboard.html).
   - Due puntini per carico PRESO: trasportatore e azienda.
   - ROSSO lampeggiante = non ha ancora premuto. VERDE = ha premuto (scritta + data e ora).
   - Nuvoletta rossa "da N giorni" dopo 1 giorno.
   - Pulsanti: «Clicca 👉 Trasporto consegnato» (trasportatore), «Clicca 👉 Trasporto verificato» (azienda).
   - Accanto a ogni riga verde: Vedi, Scarica, Aggiorna.
   - Pallino rosso lampeggiante col numero nel menu «Presi» / «Trasporti presi» (solo portali).
   - NIENTE «Rimuovi». Nella dashboard nessun pallino nel menu e nessun pulsante.
   Campi Airtable (tabella Carichi): stato_consegna, data_consegnato, data_verificato.
   Azione Make: segna_consegna { carico_id, ruolo: 'trasportatore'|'azienda' }.
   ===================================================================== */
(function () {
  'use strict';
  var GESTORI = !!window.ECT_CONSEGNE_GESTORI;
  var HOOK_CONSEGNE = 'https://hook.eu1.make.com/ttn442j877hfmssv3rwj7qde63oakuhm';

  /* ---------- stile ---------- */
  var css = '' +
    '@keyframes ecLamp{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,.75)}50%{opacity:.35;box-shadow:0 0 0 7px rgba(239,68,68,0)}}' +
    '.ec-ban{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin:0 0 12px;padding:12px 14px;border:1px solid rgba(239,68,68,.5);background:rgba(239,68,68,.1);border-radius:12px;font-size:14px;font-weight:600;text-align:left}.ec-ban button{background:#ef4444;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}' +
    '.ec-blk{margin-top:10px;border-top:1px solid rgba(255,255,255,.08);padding-top:6px}' +
    '.ec-r{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:8px 0}' +
    '.ec-r+.ec-r{border-top:1px solid rgba(255,255,255,.06)}' +
    '.ec-chi{min-width:150px;font-size:13px;line-height:1.3}.ec-chi small{display:block;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;opacity:.55}' +
    '.ec-dot{width:16px;height:16px;border-radius:50%;flex:none}' +
    '.ec-red{background:#ef4444;animation:ecLamp 1s ease-in-out infinite}' +
    '.ec-green{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.2)}' +
    '.ec-nuv{font-size:12px;color:#fca5a5;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.4);border-radius:999px;padding:3px 9px;white-space:nowrap}' +
    '.ec-txt{font-size:13.5px;font-weight:600}' +
    '.ec-go{background:#16a34a;color:#fff;border:0;border-radius:999px;padding:8px 16px;min-height:40px;font-size:13px;font-weight:700;cursor:pointer;touch-action:manipulation}' +
    '.ec-go:active{transform:scale(.97)}.ec-go:disabled{opacity:.6}' +
    '.ec-sec{background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:6px 10px;min-height:38px;font-size:12.5px;font-weight:700;cursor:pointer}' +
    '.ec-rep{display:inline-flex;gap:6px;flex-wrap:wrap}' +
    '.ec-mdot{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;margin-left:8px;border-radius:999px;background:#ef4444;color:#fff;font-size:11.5px;font-weight:800;animation:ecLamp 1s ease-in-out infinite;vertical-align:middle}' +
    '#ec-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '#ec-modal>div{background:#0f172a;color:#f1f5f9;border:1px solid rgba(255,255,255,.18);border-radius:14px;max-width:420px;width:100%;padding:20px}' +
    '#ec-modal h3{margin:0 0 8px;font-size:17px}#ec-modal p{margin:0 0 16px;font-size:14px;opacity:.85;line-height:1.5}' +
    '#ec-modal .ec-bb{display:flex;gap:10px;flex-wrap:wrap}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- utilità ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    var o = { timeZone: 'Europe/Rome' };
    var g = d.toLocaleDateString('it-IT', Object.assign({ day: '2-digit', month: '2-digit', year: 'numeric' }, o));
    var h = d.toLocaleTimeString('it-IT', Object.assign({ hour: '2-digit', minute: '2-digit', hour12: false }, o));
    return g + ' ore ' + h;
  }
  function giorniDa(iso) { var d = new Date(iso); if (isNaN(d)) return 0; return Math.floor((Date.now() - d.getTime()) / 86400000); }
  function nuvola(giorni) {
    if (giorni < 1) return '';
    return '<span class="ec-nuv" title="Da quanto tempo aspettiamo">☁️ da ' + giorni + (giorni === 1 ? ' giorno' : ' giorni') + '</span>';
  }
  function ruoloMio() { return (typeof tipoUtente !== 'undefined' && tipoUtente === 'azienda') ? 'azienda' : 'trasportatore'; }
  function dataPreso(f) { return f.data_assegnato || f.data_candidatura || ''; }

  /* ---------- una riga (trasportatore o azienda) ---------- */
  function riga(f, chi, nome, puoPremere, id, idx) {
    var data = chi === 'trasportatore' ? f.data_consegnato : f.data_verificato;
    var verde = !!data;
    var h = '<div class="ec-r"><div class="ec-chi"><small>' + (chi === 'trasportatore' ? 'Trasportatore' : 'Azienda') + '</small>' + esc(nome || '') + '</div>';
    h += '<span class="ec-dot ' + (verde ? 'ec-green' : 'ec-red') + '"></span>';
    if (verde) {
      h += '<span class="ec-txt">' + (chi === 'trasportatore' ? 'Trasporto consegnato ' : 'Trasporto verificato ') + fmt(data) + '</span>' + report(id, idx);
    } else {
      var base = (chi === 'azienda' && f.data_consegnato) ? f.data_consegnato : dataPreso(f);
      h += nuvola(giorniDa(base));
      if (puoPremere) h += '<button type="button" class="ec-go" data-ec="' + chi + '" data-id="' + esc(id) + '">Clicca 👉 ' + (chi === 'trasportatore' ? 'Trasporto consegnato' : 'Trasporto verificato') + '</button>';
    }
    return h + '</div>';
  }
  function report(id, idx) {
    return '<span class="ec-rep">' +
      '<button type="button" class="ec-sec" data-ecr="vedi" data-id="' + esc(id) + '" data-i="' + idx + '">👁 Vedi</button>' +
      '<button type="button" class="ec-sec" data-ecr="scarica" data-id="' + esc(id) + '" data-i="' + idx + '">⬇ Scarica</button>' +
      '<button type="button" class="ec-sec" data-ecr="agg" data-id="' + esc(id) + '">🔄 Aggiorna</button></span>';
  }
  function blocco(c, idx) {
    var f = c.fields || c.f || {};
    var az = ruoloMio() === 'azienda';
    var nomeTr = GESTORI ? (f.assegnato_a_nome || f.bloccato_da_nome || '') : (az ? (f.assegnato_a_nome || f.bloccato_da_nome || '') : 'Tu');
    var nomeAz = GESTORI ? (f.nome_azienda || '') : (az ? 'Tu' : (f.nome_azienda || ''));
    var preme = !GESTORI;
    return '<div class="ec-blk" id="ec-blk-' + esc(c.id) + '">' +
      riga(f, 'trasportatore', nomeTr, preme && !az, c.id, idx) +
      riga(f, 'azienda', nomeAz, preme && az, c.id, idx) + '</div>';
  }

  /* ---------- finestra di conferma ---------- */
  function chiedi(titolo, testo, ok) {
    var m = document.getElementById('ec-modal'); if (m) m.remove();
    m = document.createElement('div'); m.id = 'ec-modal';
    m.innerHTML = '<div role="dialog" aria-modal="true"><h3>' + esc(titolo) + '</h3><p>' + esc(testo) + '</p><div class="ec-bb">' +
      '<button type="button" class="ec-go" id="ec-si">Sì, confermo</button><button type="button" class="ec-sec" id="ec-no">Annulla</button></div></div>';
    document.body.appendChild(m);
    document.getElementById('ec-no').onclick = function () { m.remove(); };
    document.getElementById('ec-si').onclick = function () { m.remove(); ok(); };
  }

  /* ---------- salvataggio (Make → Airtable) ---------- */
  function trova(id) {
    var l = [];
    try { l = (typeof cpLista === 'function') ? cpLista().base : []; } catch (e) {}
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  async function premi(chi, id) {
    var c = trova(id); if (!c) return;
    var f = c.fields;
    var ora = new Date().toISOString();
    var anteprima = (typeof modalitaAnteprimaAttiva !== 'undefined' && modalitaAnteprimaAttiva);
    if (!anteprima) {
      try {
        var corpo = { action: 'segna_consegna', carico_id: id, ruolo: chi };
        var tok = (typeof window.ectTokenAccesso === 'function') ? await window.ectTokenAccesso() : null;
        if (tok) corpo.token = tok;
        var r = await fetch(HOOK_CONSEGNE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
        var d = await r.json().catch(function () { return {}; });
        if (!r.ok || d.esito !== 'salvato') throw new Error('non salvato');
        if (d.data) ora = d.data;
      } catch (e) {
        alert('⚠️ Non sono riuscito a salvare. Riprova tra qualche secondo.');
        return;
      }
    }
    if (chi === 'trasportatore') f.data_consegnato = ora; else f.data_verificato = ora;
    f.stato_consegna = (f.data_consegnato && f.data_verificato) ? 'COMPLETATO' : (chi === 'trasportatore' ? 'CONSEGNATO' : 'VERIFICATO');
    ridisegna();
  }

  /* ---------- click ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-ec],[data-ecr]'); if (!b) return;
    var id = b.getAttribute('data-id');
    if (b.hasAttribute('data-ec')) {
      var chi = b.getAttribute('data-ec');
      chiedi(chi === 'trasportatore' ? 'Confermi: trasporto consegnato?' : 'Confermi: trasporto verificato?',
        chi === 'trasportatore' ? 'Dichiari che questo trasporto è stato consegnato. Resta registrato con data e ora.' : 'Dichiari di aver verificato la consegna di questo trasporto. Resta registrato con data e ora.',
        function () { premi(chi, id); });
      return;
    }
    var a = b.getAttribute('data-ecr'), i = parseInt(b.getAttribute('data-i'), 10);
    if (a === 'vedi' && typeof cpApri === 'function') cpApri(i);
    else if (a === 'scarica' && typeof cpStampa === 'function') cpStampa([i]);
    else if (a === 'agg') {
      var fn = GESTORI ? (typeof caricaDashboard === 'function' ? caricaDashboard : null) : (typeof aggiornaPresiTutto === 'function' ? function () { return aggiornaPresiTutto().then(function () { ridisegna(); }); } : null);
      if (fn && typeof aggClick === 'function') aggClick(b, fn); else if (fn) fn();
    }
  });

  /* ---------- portali: aggancio alle card dei carichi presi ---------- */
  function inietta() {
    if (GESTORI || typeof cpLista !== 'function') return;
    var body = document.getElementById('cp-body'); if (!body) return;
    var lista = []; try { lista = cpLista().lista; } catch (e) { return; }
    var cards = body.querySelectorAll('.cp-card');
    cards.forEach(function (card, i) {
      var c = lista[i]; if (!c) return;
      var old = card.querySelector('.ec-blk'); if (old) old.remove();
      if (String(c.fields.stato || '').toUpperCase() !== 'PRESO') return;
      var det = card.querySelector('#cp-det-' + i);
      var w = document.createElement('div'); w.innerHTML = blocco(c, i);
      card.insertBefore(w.firstChild, det || null);
    });
  }
  function ridisegna() { if (GESTORI) disegnaGestori(); else { try { inietta(); } catch (e) {} aggiornaPallino(); } }

  /* ---------- pallino lampeggiante nel menu laterale (solo portali) ---------- */
  function daPremere() {
    var n = 0; if (GESTORI) return 0;
    var az = ruoloMio() === 'azienda';
    try {
      cpLista().base.forEach(function (c) {
        var f = c.fields; if (String(f.stato || '').toUpperCase() !== 'PRESO') return;
        if (az ? !f.data_verificato : !f.data_consegnato) n++;
      });
    } catch (e) {}
    return n;
  }
  /* avviso fuori dall'elenco (l'elenco nasconde le righe fuori filtro): "Hai N da confermare non visibili" */
  function avviso() {
    if (GESTORI) return;
    var body = document.getElementById('cp-body'); if (!body) return;
    var old = document.getElementById('ec-ban-presi');
    var n = 0;
    try {
      var lista = cpLista().lista, az = ruoloMio() === 'azienda';
      body.querySelectorAll('.cp-card').forEach(function (card, i) {
        var c = lista[i]; if (!c || !card.classList.contains('ms-off')) return;
        var f = c.fields; if (String(f.stato || '').toUpperCase() !== 'PRESO') return;
        if (az ? !f.data_verificato : !f.data_consegnato) n++;
      });
    } catch (e) {}
    if (!n) { if (old) old.remove(); return; }
    var az2 = ruoloMio() === 'azienda';
    var txt = '\ud83d\udea6 Hai ' + n + (az2 ? (n === 1 ? ' trasporto da verificare' : ' trasporti da verificare') : (n === 1 ? ' consegna da confermare' : ' consegne da confermare')) + ' non visibil' + (n === 1 ? 'e' : 'i') + ' con questo filtro';
    if (!old) {
      old = document.createElement('div'); old.id = 'ec-ban-presi'; old.className = 'ec-ban';
      old.innerHTML = '<span></span><button type="button">Mostra tutti</button>';
      old.querySelector('button').onclick = function () { var ch = document.querySelector('#ms-pg-presi [data-m="tutto"]'); if (ch) ch.click(); setTimeout(avviso, 100); };
      var bar = document.getElementById('ms-pg-presi');
      (bar || body).parentNode.insertBefore(old, bar || body);
    }
    old.firstChild.textContent = txt;
  }
  function aggiornaPallino() {
    if (GESTORI) return;
    var voce = document.querySelector('#ms-voci button[data-v="presi"]'); if (!voce) return;
    var n = daPremere();
    var d = voce.querySelector('.ec-mdot');
    if (!n) { if (d) d.remove(); return; }
    if (!d) { d = document.createElement('span'); d.className = 'ec-mdot'; d.title = 'Ci sono trasporti da confermare'; var tx = voce.querySelector('.ms-tx b'); (tx || voce).appendChild(d); }
    d.textContent = n;
  }

  /* ---------- Dashboard Gestori: elenco con gli stessi puntini, senza pulsanti ---------- */
  function disegnaGestori() {
    if (typeof tuttiCarichi === 'undefined') return;
    var ancora = document.getElementById('storico-sezione'); if (!ancora) return;
    var box = document.getElementById('ec-gestori');
    if (!box) {
      box = document.createElement('div'); box.id = 'ec-gestori';
      box.innerHTML = '<div class="sec-title" id="ec-gestori-t">🚦 Consegne e verifiche</div><div id="ec-gestori-b"></div>';
      ancora.parentNode.insertBefore(box, ancora);
    }
    var l = tuttiCarichi.filter(function (c) { return String(c.fields.stato || '').toUpperCase() === 'PRESO'; });
    l.sort(function (a, b) {
      var ra = (!a.fields.data_consegnato || !a.fields.data_verificato) ? 0 : 1, rb = (!b.fields.data_consegnato || !b.fields.data_verificato) ? 0 : 1;
      return ra - rb || String(dataPreso(a.fields)).localeCompare(dataPreso(b.fields));
    });
    var inSospeso = l.filter(function (c) { return !c.fields.data_consegnato || !c.fields.data_verificato; }).length;
    document.getElementById('ec-gestori-t').textContent = '🚦 Consegne e verifiche — ' + inSospeso + ' da completare';
    document.getElementById('ec-gestori-b').innerHTML = l.length ? l.map(function (c, i) {
      var f = c.fields;
      return '<div class="cp-card" style="border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 16px;margin-bottom:10px;"><div style="font-weight:700;font-size:15px;">' +
        esc(f.citta_partenza || '—') + ' → ' + esc(f.citta_arrivo || '—') + ' <span style="font-weight:400;font-size:12px;opacity:.6;">' + esc(f.numero_ordine || '') + '</span></div>' + blocco(c, i) + '</div>';
    }).join('') : '<div style="font-size:13px;opacity:.6;padding:8px 0;">Nessun carico preso al momento.</div>';
  }

  /* ---------- aggancio ---------- */
  if (!GESTORI) {
    var orig = window.renderCarichiPresi;
    if (typeof orig === 'function') {
      window.renderCarichiPresi = function () { var r = orig.apply(this, arguments); try { inietta(); } catch (e) { console.error('consegne:', e); } aggiornaPallino(); return r; };
    }
    setInterval(function () { aggiornaPallino(); avviso(); }, 1500);
  } else {
    var origD = window.caricaDashboard;
    if (typeof origD === 'function') {
      window.caricaDashboard = async function () { var r = await origD.apply(this, arguments); try { disegnaGestori(); } catch (e) { console.error('consegne:', e); } return r; };
    }
    var ultimaLettura = 0;
    async function leggiConsegne() {
      try {
        if (typeof tuttiCarichi === 'undefined' || !tuttiCarichi.some(function (c) { return /^rec[A-Za-z0-9]{14}$/.test(c.id); })) return;
        ultimaLettura = Date.now();
        var tok = (typeof window.ectTokenAccesso === 'function') ? await window.ectTokenAccesso() : null;
        if (!tok) return;
        var r = await fetch(HOOK_CONSEGNE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_consegne_gestori', token: tok }) });
        var d = await r.json().catch(function () { return null; });
        if (!d || !Array.isArray(d.consegne)) return;
        var m = {}; d.consegne.forEach(function (x) { m[x.id] = x; });
        tuttiCarichi.forEach(function (c) {
          var x = m[c.id]; if (!x) return;
          c.fields.data_consegnato = x.data_consegnato || null;
          c.fields.data_verificato = x.data_verificato || null;
          c.fields.stato_consegna = x.stato_consegna || null;
        });
      } catch (e) {}
    }
    var firma = '';
    setInterval(function () {
      if (Date.now() - ultimaLettura > 30000) leggiConsegne();
      try {
        if (typeof tuttiCarichi === 'undefined' || !document.getElementById('storico-sezione')) return;
        var f = tuttiCarichi.map(function (c) { return c.id + '|' + c.fields.stato + '|' + (c.fields.data_consegnato || '') + '|' + (c.fields.data_verificato || ''); }).join(';');
        if (f !== firma || !document.getElementById('ec-gestori')) { firma = f; disegnaGestori(); }
      } catch (e) {}
    }, 1500);
  }
  window.ectConsegne = { ridisegna: ridisegna, daPremere: daPremere };
})();
