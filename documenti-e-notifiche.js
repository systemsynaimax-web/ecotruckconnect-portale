/* =====================================================================
   EcoTruckConnect — documenti-e-notifiche.js (3/10/2026)
   Caricato in fondo a index.html, DOPO lo script principale.

   1) DOCUMENTI AUTORIZZAZIONI (trasportatore) — obbligatori
      Sotto "Autorizzazioni possedute" compare una riga per ogni
      autorizzazione selezionata con il suo "Carica file". "Salva il mio
      profilo" non salva finche' manca anche un solo documento (riga rossa).
      I file vanno su Airtable tramite la funzione Netlify "documenti".
   2) DOCUMENTI NELLA SCHEDA DEL CARICO PRESO (azienda)
   3) CAMPANELLA AZIENDA piu' veloce: 2 minuti a pagina aperta, 30 secondi
      mentre un trasportatore sta pagando, subito quando si torna sulla
      pagina; ferma quando la pagina e' nascosta (risparmio operazioni Make).
      Avviso a comparsa quando un carico diventa PRESO.
   4) SUGGERIMENTI CITTA' per provincia: prima la provincia dell'utente,
      poi la sua regione, poi i capoluoghi, poi il resto.
   5) CASSA DEL CARICO (trasportatore) precompilata come quella
      dell'iscrizione: nome/cognome o ragione sociale + indirizzo.
   ===================================================================== */
(function () {
  'use strict';

  var FUNZIONE_DOC = '/.netlify/functions/documenti';
  var MAX_BYTE = 4 * 1024 * 1024;
  var TIPI_OK = { 'application/pdf': 1, 'image/jpeg': 1, 'image/png': 1 };

  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function anteprima() { try { return !!modalitaAnteprimaAttiva; } catch (e) { return false; } }
  function tipo() { try { return tipoUtente; } catch (e) { return ''; } }

  async function token() {
    try { if (window.ectTokenAccesso) { var t = await window.ectTokenAccesso(); if (t) return t; } } catch (e) {}
    try { var u = window.netlifyIdentity && window.netlifyIdentity.currentUser(); if (u) return await u.jwt(); } catch (e) {}
    return '';
  }

  /* ---------------- chiamata alla funzione (con simulazione in anteprima) ---------------- */
  var docsAnteprima = [];
  async function chiamaDoc(azione, extra) {
    extra = extra || {};
    if (anteprima()) {
      if (azione === 'carica') {
        docsAnteprima = docsAnteprima.filter(function (d) { return d.autorizzazione !== extra.autorizzazione; });
        docsAnteprima.push({ id: 'ant' + Date.now(), autorizzazione: extra.autorizzazione, nome: extra.nome_file, url: '#', tipo: extra.tipo });
      }
      if (azione === 'allinea') {
        var tenere = extra.autorizzazioni || [];
        docsAnteprima = docsAnteprima.filter(function (d) { return tenere.indexOf(d.autorizzazione) !== -1; });
      }
      if (azione === 'documenti_trasportatore') return { ok: true, documenti: [{ autorizzazione: 'Conto Terzi', nome: 'licenza-esempio.pdf', url: '#' }] };
      await new Promise(function (r) { setTimeout(r, 500); });
      return { ok: true, documenti: docsAnteprima.slice() };
    }
    var tok = await token();
    var r = await fetch(FUNZIONE_DOC, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(Object.assign({ azione: azione }, extra))
    });
    try { return await r.json(); } catch (e) { return { ok: false, errore: 'risposta_non_valida' }; }
  }

  var ERRORI = {
    file_troppo_grande: 'Il file supera 4 MB. Riducilo oppure fotografa il documento.',
    tipo_non_ammesso: 'Va bene solo PDF, JPG o PNG.',
    caricamento_fallito: 'Caricamento non riuscito, riprova tra un momento.',
    accesso_richiesto: 'Sessione scaduta: esci e rientra, poi riprova.',
    token_airtable_mancante: 'Caricamento non ancora attivo: avvisa il supporto.'
  };

  /* =====================================================================
     1) DOCUMENTI AUTORIZZAZIONI — TRASPORTATORE
     ===================================================================== */
  var documenti = [];
  var docsCaricati = false;
  var inCaricamento = {};
  var mostraMancanti = false;

  function autSelezionate() {
    return Array.from(document.querySelectorAll('#checkbox-autorizzazioni input:checked')).map(function (el) { return el.value; });
  }
  function docDi(aut) { return documenti.filter(function (d) { return d.autorizzazione === aut; })[0] || null; }

  async function caricaElenco(forza) {
    if (tipo() !== 'trasportatore') return;
    if (docsCaricati && !forza) return;
    var r = await chiamaDoc('elenco').catch(function () { return null; });
    if (r && r.ok) { documenti = r.documenti || []; docsCaricati = true; }
    renderRighe(); decoraRiepilogo();
  }

  function contenitore() {
    var c = document.getElementById('docs-aut');
    if (c) return c;
    var tags = document.getElementById('tags-aut');
    if (!tags) return null;
    c = document.createElement('div');
    c.id = 'docs-aut';
    c.style.cssText = 'max-width:520px;margin-top:14px;';
    tags.insertAdjacentElement('afterend', c);
    return c;
  }

  function renderRighe() {
    var c = contenitore(); if (!c) return;
    var sel = autSelezionate();
    if (!sel.length) { c.innerHTML = ''; return; }
    var mancanti = sel.filter(function (a) { return !docDi(a); });
    var righe = sel.map(function (a, i) {
      var d = docDi(a);
      var rosso = mostraMancanti && !d && !inCaricamento[a];
      var destra;
      if (inCaricamento[a]) destra = '<span style="font-size:13px;color:#fbbf24;">⏳ Caricamento…</span>';
      else if (d) destra = '<span style="display:flex;align-items:center;gap:10px;">' +
        '<a href="' + esc(d.url) + '" target="_blank" rel="noopener" style="font-size:13px;color:#4ade80;text-decoration:none;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">✅ ' + esc(d.nome) + '</a>' +
        '<button type="button" data-ect-carica="' + i + '" style="background:none;border:1px solid rgba(255,255,255,0.2);color:#cbd5e1;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;">Sostituisci</button></span>';
      else destra = '<button type="button" data-ect-carica="' + i + '" class="btn-cap" style="padding:7px 14px;font-size:13px;">📎 Carica file</button>';
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;margin-bottom:8px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid ' + (rosso ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.12)') + ';">' +
        '<span style="font-size:14px;color:#fff;">' + esc(a) + '</span>' + destra + '</div>';
    }).join('');
    var avviso = '';
    if (mostraMancanti && mancanti.length) {
      avviso = '<div id="docs-aut-avviso" style="color:#f87171;font-size:13px;margin:2px 0 4px;">⚠️ Manca il documento per: ' + esc(mancanti.join(', ')) + '. Caricalo per salvare il profilo.</div>';
    }
    c.innerHTML = '<div style="font-size:13px;color:var(--muted);margin-bottom:8px;">📄 Documenti delle autorizzazioni <b style="color:#fff;">(obbligatori)</b> — PDF, JPG o PNG, max 4 MB</div>' + righe + avviso +
      '<input type="file" id="docs-aut-file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style="display:none;">';
    c.querySelectorAll('[data-ect-carica]').forEach(function (b) {
      b.onclick = function () { scegliFile(sel[Number(b.getAttribute('data-ect-carica'))]); };
    });
  }

  function leggiBase64(blob) {
    return new Promise(function (ok, ko) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); };
      fr.onerror = function () { ko(new Error('lettura')); };
      fr.readAsDataURL(blob);
    });
  }

  function comprimiImmagine(file) {
    return new Promise(function (ok) {
      var img = new Image();
      img.onload = function () {
        var lato = 2200, w = img.width, h = img.height;
        if (Math.max(w, h) > lato) { var k = lato / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
        var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        cv.toBlob(function (b) { URL.revokeObjectURL(img.src); ok(b); }, 'image/jpeg', 0.8);
      };
      img.onerror = function () { ok(null); };
      img.src = URL.createObjectURL(file);
    });
  }

  function scegliFile(aut) {
    var inp = document.getElementById('docs-aut-file'); if (!inp) return;
    inp.value = '';
    inp.onchange = async function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      var tipoFile = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : '');
      if (!TIPI_OK[tipoFile]) { alert(ERRORI.tipo_non_ammesso); return; }
      var blob = f, nome = f.name;
      if (f.size > MAX_BYTE) {
        if (tipoFile === 'application/pdf') { alert(ERRORI.file_troppo_grande); return; }
        blob = await comprimiImmagine(f);
        if (!blob || blob.size > MAX_BYTE) { alert(ERRORI.file_troppo_grande); return; }
        tipoFile = 'image/jpeg'; nome = nome.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
      }
      inCaricamento[aut] = true; renderRighe();
      try {
        var b64 = await leggiBase64(blob);
        var r = await chiamaDoc('carica', { autorizzazione: aut, nome_file: nome, tipo: tipoFile, file: b64, autorizzazioni_selezionate: autSelezionate() });
        if (r && r.ok) {
          documenti = r.documenti || documenti; docsCaricati = true;
          try { registraAttivita('Modifica Dati', 'Documento autorizzazione caricato', 'Autorizzazione: ' + aut + '. File: ' + nome + '.'); } catch (e) {}
        } else alert(ERRORI[(r && r.errore)] || ERRORI.caricamento_fallito);
      } catch (e) { alert(ERRORI.caricamento_fallito); }
      delete inCaricamento[aut];
      renderRighe(); decoraRiepilogo();
    };
    inp.click();
  }

  /* chip del riquadro in alto "Le mie autorizzazioni" con lo stato del documento */
  function decoraRiepilogo() {
    var box = document.getElementById('riepilogo-autorizzazioni');
    if (!box || tipo() !== 'trasportatore') return;
    var aut = []; try { aut = trasportatoreFieldsCorrenti.autorizzazioni || []; } catch (e) {}
    if (!aut.length) return;
    box.innerHTML = aut.map(function (a) {
      var ok = !!docDi(a);
      var stile = ok ? 'background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.35);color:#93c5fd;'
                     : 'background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.5);color:#fca5a5;';
      return '<span title="' + (ok ? 'Documento caricato' : 'Documento mancante') + '" style="font-size:11px;' + stile + 'padding:4px 10px;border-radius:20px;">' + (ok ? '✅ ' : '⚠️ ') + esc(a) + '</span>';
    }).join('') + (aut.some(function (a) { return !docDi(a); }) && docsCaricati ? '<div style="width:100%;font-size:11px;color:#fca5a5;margin-top:6px;">Carica i documenti mancanti</div>' : '');
  }

  /* aggancio alle funzioni esistenti */
  if (typeof window.aggiornaRiepilogoProfiloTrasportatore === 'function') {
    var origRiep = window.aggiornaRiepilogoProfiloTrasportatore;
    window.aggiornaRiepilogoProfiloTrasportatore = function () {
      var r = origRiep.apply(this, arguments);
      decoraRiepilogo();
      if (!docsCaricati) caricaElenco(false);
      return r;
    };
  }
  if (typeof window.apriProfiloTrasportatore === 'function') {
    var origApri = window.apriProfiloTrasportatore;
    window.apriProfiloTrasportatore = function () {
      var r = origApri.apply(this, arguments);
      mostraMancanti = false;
      renderRighe();
      caricaElenco(false);
      return r;
    };
  }
  if (typeof window.salvaProfiloTrasportatore === 'function') {
    var origSalva = window.salvaProfiloTrasportatore;
    window.salvaProfiloTrasportatore = async function () {
      var sel = autSelezionate();
      var mancanti = sel.filter(function (a) { return !docDi(a); });
      if (Object.keys(inCaricamento).length) { alert('Aspetta che finisca il caricamento del documento.'); return; }
      if (mancanti.length) {
        mostraMancanti = true; renderRighe();
        var c = document.getElementById('docs-aut'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      mostraMancanti = false;
      var r = await origSalva.apply(this, arguments);
      var ris = await chiamaDoc('allinea', { autorizzazioni: sel }).catch(function () { return null; });
      if (ris && ris.ok) documenti = ris.documenti || documenti;
      renderRighe(); decoraRiepilogo();
      return r;
    };
  }
  document.addEventListener('change', function (e) {
    if (e.target && e.target.closest && e.target.closest('#checkbox-autorizzazioni')) setTimeout(renderRighe, 0);
  });
  document.addEventListener('DOMContentLoaded', function () {
    var tags = document.getElementById('tags-aut');
    if (tags && window.MutationObserver) new MutationObserver(function () { setTimeout(renderRighe, 0); }).observe(tags, { childList: true, subtree: true });
  });

  /* =====================================================================
     2) DOCUMENTI NELLA SCHEDA DEL CARICO PRESO — AZIENDA
     ===================================================================== */
  window.ectVediDocTrasp = async function (btn) {
    var box = btn.parentNode.querySelector('.ect-doc-lista');
    var email = btn.getAttribute('data-email');
    btn.disabled = true; btn.textContent = '⏳ Carico i documenti…';
    var r = await chiamaDoc('documenti_trasportatore', { email_trasportatore: email }).catch(function () { return null; });
    btn.style.display = 'none';
    if (!r || !r.ok) { box.innerHTML = '<span style="color:#f87171;">Documenti non disponibili in questo momento.</span>'; return; }
    var docs = r.documenti || [];
    box.innerHTML = docs.length ? docs.map(function (d) {
      return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span>' + esc(d.autorizzazione || 'Documento') + '</span>' +
        '<a href="' + esc(d.url) + '" target="_blank" rel="noopener" style="color:#60a5fa;">📄 ' + esc(d.nome) + '</a></div>';
    }).join('') : '<span style="color:var(--muted);">Il trasportatore non ha ancora caricato documenti.</span>';
  };
  if (typeof window.cpScheda === 'function') {
    var origScheda = window.cpScheda;
    window.cpScheda = function (f) {
      var html = origScheda.apply(this, arguments);
      try {
        var email = f && (f.trasportatore_email || f.bloccato_da_id);
        if (tipo() === 'azienda' && f && String(f.stato || '').toUpperCase() === 'PRESO' && email && /@/.test(email)) {
          html += '<div style="padding:14px;border:1px solid var(--border);border-radius:10px;margin-top:12px;font-size:13px;">' +
            '<div style="font-weight:700;color:#fff;margin-bottom:8px;">📎 Documenti autorizzazioni del trasportatore</div>' +
            '<button type="button" class="btn-cap" data-email="' + esc(email) + '" onclick="event.stopPropagation();ectVediDocTrasp(this)" style="padding:6px 14px;font-size:12px;">Vedi documenti</button>' +
            '<div class="ect-doc-lista" style="margin-top:6px;"></div></div>';
        }
      } catch (e) {}
      return html;
    };
  }

  /* =====================================================================
     3) CAMPANELLA AZIENDA PIU' VELOCE + AVVISO "CARICO PRESO"
     ===================================================================== */
  var timerCamp = null;
  function qualcunoStaPagando() {
    try { return (carichiPubblicatiAzienda || []).some(function (c) { return String(c.fields.stato || '').toUpperCase().indexOf('PAGAMENTO') !== -1; }); } catch (e) { return false; }
  }
  function prossimoGiro() {
    clearTimeout(timerCamp);
    if (tipo() !== 'azienda') return;
    var attesa = qualcunoStaPagando() ? 30 * 1000 : 2 * 60 * 1000;
    timerCamp = setTimeout(async function () {
      if (!document.hidden) { try { await aggiornaCampanellino(false); } catch (e) {} }
      prossimoGiro();
    }, attesa);
  }
  if (typeof window.avviaPollingCampanellino === 'function') {
    var origPoll = window.avviaPollingCampanellino;
    window.avviaPollingCampanellino = function () {
      if (tipo() !== 'azienda') return origPoll.apply(this, arguments);
      try { if (campanellinoInterval) { clearInterval(campanellinoInterval); campanellinoInterval = null; } } catch (e) {}
      prossimoGiro();
    };
  }
  document.addEventListener('visibilitychange', async function () {
    if (document.hidden || tipo() !== 'azienda') return;
    try { await aggiornaCampanellino(false); } catch (e) {}
    prossimoGiro();
  });

  var presiVisti = null;
  function avvisoPreso(c) {
    var f = c.fields || {};
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;right:18px;top:80px;z-index:2147483000;max-width:340px;background:#0e1623;border:1px solid rgba(34,197,94,0.6);border-radius:14px;padding:14px 16px;color:#f1f5f9;font-family:inherit;box-shadow:0 14px 36px rgba(0,0,0,.5);cursor:pointer;';
    d.innerHTML = '<div style="font-weight:700;margin-bottom:4px;">🔔 Carico preso</div><div style="font-size:13px;line-height:1.5;">' +
      esc(f.citta_partenza || '') + ' → ' + esc(f.citta_arrivo || '') + '<br>da <b>' + esc(f.assegnato_a_nome || f.bloccato_da_nome || 'un trasportatore') + '</b>. Tocca per vedere i dati.</div>';
    d.onclick = function () { d.remove(); try { apriSchedaCaricoPreso(c.id); } catch (e) {} };
    document.body.appendChild(d);
    setTimeout(function () { if (d.parentNode) d.remove(); }, 15000);
  }
  if (typeof window.renderCampanellino === 'function') {
    var origRender = window.renderCampanellino;
    window.renderCampanellino = function () {
      var r = origRender.apply(this, arguments);
      try {
        if (tipo() === 'azienda' && !anteprima()) {
          var presi = (carichiPubblicatiAzienda || []).filter(function (c) { return String(c.fields.stato || '').toUpperCase() === 'PRESO' && !c.fields.notifica_letta; });
          if (presiVisti === null) presiVisti = {};
          else presi.forEach(function (c) { if (!presiVisti[c.id]) avvisoPreso(c); });
          presi.forEach(function (c) { presiVisti[c.id] = 1; });
        }
      } catch (e) {}
      return r;
    };
  }

  /* =====================================================================
     4) SUGGERIMENTI CITTA' IN BASE ALLA PROVINCIA DELL'UTENTE
     ===================================================================== */
  var REGIONE = {
    AG:'SIC',CL:'SIC',CT:'SIC',EN:'SIC',ME:'SIC',PA:'SIC',RG:'SIC',SR:'SIC',TP:'SIC',
    CA:'SAR',NU:'SAR',OR:'SAR',SS:'SAR',SU:'SAR',
    CS:'CAL',CZ:'CAL',KR:'CAL',RC:'CAL',VV:'CAL',
    MT:'BAS',PZ:'BAS',
    BA:'PUG',BT:'PUG',BR:'PUG',FG:'PUG',LE:'PUG',TA:'PUG',
    AV:'CAM',BN:'CAM',CE:'CAM',NA:'CAM',SA:'CAM',
    CB:'MOL',IS:'MOL',
    AQ:'ABR',CH:'ABR',PE:'ABR',TE:'ABR',
    FR:'LAZ',LT:'LAZ',RI:'LAZ',RM:'LAZ',VT:'LAZ',
    PG:'UMB',TR:'UMB',
    AN:'MAR',AP:'MAR',FM:'MAR',MC:'MAR',PU:'MAR',
    AR:'TOS',FI:'TOS',GR:'TOS',LI:'TOS',LU:'TOS',MS:'TOS',PI:'TOS',PO:'TOS',PT:'TOS',SI:'TOS',
    BO:'EMR',FE:'EMR',FC:'EMR',MO:'EMR',PR:'EMR',PC:'EMR',RA:'EMR',RE:'EMR',RN:'EMR',
    GE:'LIG',IM:'LIG',SP:'LIG',SV:'LIG',
    AL:'PIE',AT:'PIE',BI:'PIE',CN:'PIE',NO:'PIE',TO:'PIE',VB:'PIE',VC:'PIE',
    AO:'VDA',
    BG:'LOM',BS:'LOM',CO:'LOM',CR:'LOM',LC:'LOM',LO:'LOM',MN:'LOM',MI:'LOM',MB:'LOM',PV:'LOM',SO:'LOM',VA:'LOM',
    BZ:'TAA',TN:'TAA',
    BL:'VEN',PD:'VEN',RO:'VEN',TV:'VEN',VE:'VEN',VR:'VEN',VI:'VEN',
    GO:'FVG',PN:'FVG',TS:'FVG',UD:'FVG'
  };
  function provinciaUtente() {
    var p = '';
    try { p = tipo() === 'azienda' ? (profiloAzienda.provincia || '') : (trasportatoreFieldsCorrenti.provincia || ''); } catch (e) {}
    p = String(p || '').trim().toUpperCase();
    var m = p.match(/\b([A-Z]{2})\b/);
    return m ? m[1] : p.slice(0, 2);
  }
  if (typeof window.ectComuni === 'function') {
    var origComuni = window.ectComuni;
    var cacheProv = {};
    window.ectComuni = function () {
      var base = origComuni.apply(this, arguments) || [];
      var prov = provinciaUtente();
      if (!prov || !REGIONE[prov]) return base;
      if (cacheProv[prov]) return cacheProv[prov];
      var reg = REGIONE[prov];
      function peso(x) { var p = String(x.nota || '').toUpperCase(); if (p === prov) return 0; if (REGIONE[p] === reg) return 1; if (x.capo) return 2; return 3; }
      cacheProv[prov] = base.map(function (x, i) { return { x: x, i: i, p: peso(x) }; })
        .sort(function (a, b) { return (a.p - b.p) || (a.i - b.i); })
        .map(function (o) { return o.x; });
      return cacheProv[prov];
    };
  }

  /* =====================================================================
     5) CASSA DEL CARICO PRECOMPILATA (trasportatore)
     ===================================================================== */
  if (typeof window.linkCassaCarico === 'function') {
    window.linkCassaCarico = function (id) {
      var email = ''; try { email = (currentUser && currentUser.email) || ''; } catch (e) {}
      var t = {}; try { t = trasportatoreFieldsCorrenti || {}; } catch (e) {}
      function pulito(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
      var p = [];
      function add(k, v) { v = pulito(v); if (v) p.push(k + '=' + encodeURIComponent(v)); }
      add('checkout[email]', email);
      var rs = pulito(t.ragione_sociale);
      var persona = /individual|familiar/i.test(t.forma_giuridica || '') || !rs;
      var nome, cognome;
      if (persona) { nome = t.nome; cognome = t.cognome; }
      else {
        var m = rs.match(/^(.*\S)\s+(s\.?\s?r\.?\s?l\.?\s?s\.?|s\.?\s?r\.?\s?l\.?|s\.?\s?p\.?\s?a\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?|soc\.?\s?coop\.?.*|cooperativa.*)$/i);
        if (m) { nome = m[1]; cognome = m[2].toUpperCase().replace(/\s+/g, ''); } else { nome = ''; cognome = rs; }
      }
      var via = t.indirizzo || t.via;
      ['shipping_address', 'billing_address'].forEach(function (a) {
        add('checkout[' + a + '][first_name]', nome);
        add('checkout[' + a + '][last_name]', cognome);
        if (!persona) add('checkout[' + a + '][company]', rs);
        add('checkout[' + a + '][address1]', via);
        add('checkout[' + a + '][city]', t.citta);
        add('checkout[' + a + '][zip]', t.cap);
        add('checkout[' + a + '][province]', t.provincia);
        add('checkout[' + a + '][country]', 'IT');
      });
      p.push('attributes[carico_id]=' + encodeURIComponent(id));
      return 'https://shop.synaimaxpro.com/cart/' + ECT_VARIANTE_CARICO + ':1?' + p.join('&');
    };
  }
})();
