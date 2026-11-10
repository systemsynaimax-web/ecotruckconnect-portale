/* =====================================================================
   EcoTruckConnect — destinazione-rifiuti.js (8/10/2026)
   Si carica in fondo a index.html (portale) e a dashboard.html, DOPO gli altri script.

   PRODUTTORE, IMPIANTO DI DESTINAZIONE E INTERMEDIARIO dei carichi di RIFIUTI (richiesta di Gerlando; produttore aggiunto il 10/11/2026)
   - Facoltativo. 10/10: l'azienda puo' inserirli GIA' ALLA PUBBLICAZIONE e anche dopo; il trasportatore li vede solo dopo aver preso il carico (PRESO).
   - AZIENDA: scrive i dati (modificabili quando vuole) e allega i file
     (Vedi / Scarica / Rimuovi: rimuove solo lei, i file non si modificano: si rimuovono e si ricaricano).
   - TRASPORTATORE: vede solo (dati + Vedi / Scarica). Niente stampa, niente modifica.
   - DASHBOARD (gestori): Vedi / Scarica / Stampa.
   Tutti i controlli stanno sul server (netlify/functions/destinazione.js).
   Non cambia niente degli altri carichi: se il carico non e' di rifiuti o non e' PRESO
   il riquadro non compare.
   ===================================================================== */
(function () {
  'use strict';

  var FUNZIONE = '/.netlify/functions/destinazione';
  var MAX_BYTE = 4 * 1024 * 1024;
  var TIPI_OK = { 'application/pdf': 1, 'image/jpeg': 1, 'image/png': 1 };
  /* data bianca (e icona calendario bianca) sul fondo scuro */
  (function () {
    try {
      if (document.getElementById('ect-dest-stile-data')) return;
      var st = document.createElement('style'); st.id = 'ect-dest-stile-data';
      st.textContent = 'input[type="date"][data-campo]{color-scheme:dark;color:#fff !important;-webkit-text-fill-color:#fff;}' +
        'input[type="date"][data-campo]::-webkit-calendar-picker-indicator{filter:none;opacity:1;cursor:pointer;}' +
        'input[type="date"][data-campo]::-webkit-datetime-edit,input[type="date"][data-campo]::-webkit-datetime-edit-fields-wrapper,input[type="date"][data-campo]::-webkit-datetime-edit-text{color:#fff;}';
      document.head.appendChild(st);
    } catch (e) {}
  })();
  var DISCLAIMER_AZ = 'Informazioni fornite dall\'azienda. La verifica resta a carico del trasportatore.';
  var DISCLAIMER_TR = 'Informazioni fornite dall\'azienda. La verifica resta a carico tuo.';

  /* 10/11: tre blocchi, sempre in quest'ordine: produttore, impianto di destinazione, intermediario. Tutti facoltativi. */
  var PARTI = ['produttore', 'impianto', 'intermediario'];
  var CAMPI_PARTE = {
    produttore: ['ragione_sociale', 'codice_fiscale', 'indirizzo', 'n_autorizzazione'],
    impianto: ['ragione_sociale', 'indirizzo', 'n_autorizzazione', 'ente_rilascio', 'scadenza'],
    intermediario: ['ragione_sociale', 'n_autorizzazione', 'ente_rilascio', 'scadenza']
  };
  var CAMPI_TUTTI = ['ragione_sociale', 'codice_fiscale', 'indirizzo', 'n_autorizzazione', 'ente_rilascio', 'scadenza'];
  var NOME_PARTE = { produttore: 'Produttore', impianto: 'Impianto di destinazione', intermediario: 'Intermediario' };
  var ETICHETTA_FORM = { ragione_sociale: 'Ragione sociale', codice_fiscale: 'Codice fiscale', indirizzo: 'Indirizzo', n_autorizzazione: 'Numero di autorizzazione / iscrizione', ente_rilascio: 'Ente che l\'ha rilasciata', scadenza: 'Scadenza' };
  var ETICHETTA_LETT = { ragione_sociale: 'Ragione sociale', codice_fiscale: 'Codice fiscale', indirizzo: 'Indirizzo', n_autorizzazione: 'N. autorizzazione', ente_rilascio: 'Ente' };
  function etichettaForm(parte, c) {
    if (parte === 'produttore' && c === 'indirizzo') return 'Indirizzo (dove si ritira)';
    if (parte === 'produttore' && c === 'n_autorizzazione') return 'Numero di autorizzazione / iscrizione';
    return ETICHETTA_FORM[c];
  }
  function parteVuota() { return { produttore: {}, impianto: {}, intermediario: {} }; }
  function haDatiParte(d) { return !!d && CAMPI_TUTTI.some(function (c) { return d[c]; }); }
  function titoloParte(parte, conFacoltativo) { return '♻️ ' + NOME_PARTE[parte] + (conFacoltativo ? ' <span style="font-weight:400;color:var(--muted, rgba(241,245,249,0.5));">(facoltativo)</span>' : ''); }

  var sim = {};   // simulazione in anteprima / demo (solo in memoria)
  var cache = {}; // ultimo pacchetto letto per ogni carico
  var modo = {};  // per ogni carico: 'mod' = l'azienda sta modificando (altrimenti vede il riepilogo)

  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function ruoloPagina() {
    var dash = (typeof window.apriDettaglioCarico === 'function') && (typeof window.cpScheda !== 'function');
    if (dash) return 'gestore';
    try { return typeof tipoUtente !== 'undefined' ? tipoUtente : ''; } catch (e) { return ''; }
  }
  function eAnteprima(ord) {
    try { if (window.__ANTEPRIMA_SCUDO) return true; } catch (e) {}
    try { if (typeof modalitaAnteprimaAttiva !== 'undefined' && modalitaAnteprimaAttiva) return true; } catch (e) {}
    if (/preview/i.test(String(ord || ''))) return true;
    return /demo/i.test(String(location.pathname || ''));
  }
  function eRifiuto(f) {
    if (!f) return false;
    var v = f.tipo_rifiuto;
    var si = v === true || ['true', 'si', 'sì', 'yes', '1'].indexOf(String(Array.isArray(v) ? v[0] : v).toLowerCase().trim()) !== -1;
    return si || String(f.codice_cer || '').trim().length > 0;
  }
  function dataBreve(v) { if (!v) return ''; var s = String(v).slice(0, 10).split('-'); return s.length === 3 ? s[2] + '/' + s[1] + '/' + s[0] : String(v); }
  function dataOra(v) { if (!v) return ''; var d = new Date(v); return isNaN(d) ? '' : d.toLocaleDateString('it-IT') + ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
  function scaduta(v) { if (!v) return false; var s = String(v).slice(0, 10); var oggi = new Date(); var o = oggi.getFullYear() + '-' + ('0' + (oggi.getMonth() + 1)).slice(-2) + '-' + ('0' + oggi.getDate()).slice(-2); return s < o; }

  async function token() {
    try { if (window.ectTokenAccesso) { var t = await window.ectTokenAccesso(); if (t) return t; } } catch (e) {}
    try { var u = window.netlifyIdentity && window.netlifyIdentity.currentUser(); if (u) return await u.jwt(); } catch (e) {}
    return '';
  }

  /* ---------------- chiamata al server (con simulazione in anteprima) ---------------- */
  function simGet(ord) {
    if (!sim[ord]) sim[ord] = { dati: { produttore: { ragione_sociale: '', codice_fiscale: '', indirizzo: '', n_autorizzazione: '' }, impianto: { ragione_sociale: '', indirizzo: '', n_autorizzazione: '', ente_rilascio: '', scadenza: '' }, intermediario: { ragione_sociale: '', n_autorizzazione: '', ente_rilascio: '', scadenza: '' } }, file: [], aggiornato_il: '' };
    return sim[ord];
  }
  function simPacchetto(ord, ruolo) { var s = simGet(ord); return { ok: true, applicabile: true, ruolo: ruolo, numero_ordine: ord, dati: JSON.parse(JSON.stringify(s.dati)), file: s.file.slice(), aggiornato_il: s.aggiornato_il }; }
  async function chiama(azione, extra) {
    extra = extra || {};
    var ord = extra.numero_ordine;
    if (eAnteprima(ord)) {
      var ruolo = ruoloPagina();
      var s = simGet(ord);
      await new Promise(function (r) { setTimeout(r, 250); });
      if (azione === 'dest_salva') { s.dati = JSON.parse(JSON.stringify({ produttore: extra.produttore || {}, impianto: extra.impianto || {}, intermediario: extra.intermediario || {} })); s.aggiornato_il = new Date().toISOString(); }
      if (azione === 'dest_file_carica') { s.file.push({ id: 'sim' + Date.now(), parte: extra.parte, nome: extra.nome_file, tipo: extra.tipo }); s.aggiornato_il = new Date().toISOString(); }
      if (azione === 'dest_file_rimuovi') { s.file = s.file.filter(function (x) { return x.id !== extra.id; }); s.aggiornato_il = new Date().toISOString(); }
      if (azione === 'dest_file_apri') return { ok: false, errore: 'anteprima' };
      return simPacchetto(ord, ruolo);
    }
    var tok = await token();
    var r = await fetch(FUNZIONE, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(Object.assign({ azione: azione }, extra))
    });
    return await r.json();
  }

  /* ---------------- disegno del riquadro ---------------- */
  var STILE_BOX = 'padding:14px;border:1px solid var(--border, rgba(255,255,255,0.12));border-radius:10px;margin-top:12px;font-size:13px;';
  var STILE_IN = 'width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.05);color:inherit;font-size:13px;font-family:inherit;';
  var STILE_LAB = 'display:block;font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin:8px 0 3px;';
  var STILE_BT = 'background:none;border:1px solid rgba(255,255,255,0.2);color:#e2e8f0;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;';

  function campo(parte, nome, etichetta, valore, tipo) {
    return '<label style="' + STILE_LAB + '">' + etichetta + '</label>' +
      '<input type="' + (tipo || 'text') + '"' + ((tipo || 'text') === 'text' ? ' list="ect-dl-' + nome + '" autocomplete="off"' : '') + ' data-parte="' + parte + '" data-campo="' + nome + '" value="' + esc(valore) + '" style="' + STILE_IN + '" maxlength="' + (nome === 'indirizzo' ? 250 : nome === 'codice_fiscale' ? 20 : 200) + '">';
  }
  /* ---------------- suggerimenti mentre si scrive ---------------- */
  var ENTI = ['Albo Nazionale Gestori Ambientali', 'Albo Gestori Ambientali - Sezione regionale', 'Regione', 'Provincia', 'Libero Consorzio Comunale', 'Città Metropolitana', 'Comune', 'SUAP', 'ARPA', 'Ministero dell\'Ambiente e della Sicurezza Energetica', 'Camera di Commercio'];
  var CHIAVE_SUGG = 'ect_dest_suggerimenti';
  function suggLeggi() { try { return JSON.parse(localStorage.getItem(CHIAVE_SUGG) || '{}') || {}; } catch (e) { return {}; } }
  function suggRicorda(dati) {
    try {
      var s = suggLeggi();
      PARTI.forEach(function (parte) {
        var d = (dati && dati[parte]) || {};
        ['ragione_sociale', 'codice_fiscale', 'indirizzo', 'n_autorizzazione', 'ente_rilascio'].forEach(function (c) {
          var v = String(d[c] || '').trim(); if (!v) return;
          var l = (s[c] || []).filter(function (x) { return x.toLowerCase() !== v.toLowerCase(); });
          l.unshift(v); s[c] = l.slice(0, 40);
        });
      });
      localStorage.setItem(CHIAVE_SUGG, JSON.stringify(s));
    } catch (e) {}
  }
  function ordina(lista) { var visti = {}; return lista.filter(function (v) { var k = String(v).toLowerCase(); if (!v || visti[k]) return false; visti[k] = 1; return true; }).sort(function (a, b) { return String(a).localeCompare(String(b), 'it', { sensitivity: 'base' }); }); }
  function optionsDi(lista) { return ordina(lista).map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join(''); }
  function datalists() {
    var s = suggLeggi();
    var enti = (s.ente_rilascio || []).concat(ENTI.filter(function (e) { return (s.ente_rilascio || []).map(function (x) { return x.toLowerCase(); }).indexOf(e.toLowerCase()) === -1; }));
    return '<datalist id="ect-dl-ragione_sociale">' + optionsDi(s.ragione_sociale || []) + '</datalist>' +
      '<datalist id="ect-dl-indirizzo">' + optionsDi(s.indirizzo || []) + '</datalist>' +
      '<datalist id="ect-dl-codice_fiscale">' + optionsDi(s.codice_fiscale || []) + '</datalist>' +
      '<datalist id="ect-dl-n_autorizzazione">' + optionsDi(s.n_autorizzazione || []) + '</datalist>' +
      '<datalist id="ect-dl-ente_rilascio">' + optionsDi(enti) + '</datalist>';
  }
  function righeFile(ord, p, parte, ruolo) {
    var l = (p.file || []).filter(function (x) { return x.parte === parte; });
    if (!l.length) return '<div style="color:var(--muted, rgba(241,245,249,0.5));font-size:12px;margin:6px 0;">Nessun file allegato.</div>';
    var o = esc(ord).replace(/'/g, '&#39;');
    return l.map(function (x) {
      var id = esc(x.id).replace(/'/g, '&#39;');
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);">' +
        '<span style="flex:1;min-width:140px;">📎 ' + esc(x.nome) + '</span><span style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button type="button" style="' + STILE_BT + '" onclick="event.stopPropagation();ectDestApri(\'' + o + '\',\'' + id + '\',\'vedi\')">👁️ Vedi</button>' +
        '<button type="button" style="' + STILE_BT + '" onclick="event.stopPropagation();ectDestApri(\'' + o + '\',\'' + id + '\',\'scarica\')">⬇️ Scarica</button>' +
        (ruolo === 'gestore' ? '<button type="button" style="' + STILE_BT + '" onclick="event.stopPropagation();ectDestApri(\'' + o + '\',\'' + id + '\',\'stampa\')">🖨️ Stampa</button>' : '') +
        (ruolo === 'azienda' ? '<button type="button" style="' + STILE_BT + 'background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);" onclick="event.stopPropagation();ectDestRimuovi(\'' + o + '\',\'' + id + '\')">🗑️ Rimuovi</button>' : '') +
        '</span></div>';
    }).join('');
  }
  function campiModifica(parte, d) {
    d = d || {};
    return CAMPI_PARTE[parte].map(function (c) { return campo(parte, c, etichettaForm(parte, c), d[c], c === 'scadenza' ? 'date' : undefined); }).join('');
  }
  function sezioneModifica(ord, p, parte, titolo) {
    var d = p.dati[parte] || {};
    var o = esc(ord).replace(/'/g, '&#39;');
    return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);"><div style="font-weight:700;color:#fff;">' + titolo + '</div>' +
      campiModifica(parte, d) +
      '<div style="margin-top:10px;font-size:12px;font-weight:600;">Allegati (PDF, JPG o PNG, max 4 MB)</div>' + righeFile(ord, p, parte, 'azienda') +
      '<div style="margin-top:6px;"><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style="display:none;" data-file-parte="' + parte + '" onchange="ectDestCarica(\'' + o + '\',\'' + parte + '\',this)">' +
      '<button type="button" style="' + STILE_BT + '" onclick="event.stopPropagation();this.previousElementSibling.click()">📤 Carica file</button></div></div>';
  }
  function rigaLettura(k, v, extra) { return v ? '<div style="margin:2px 0;"><span style="color:var(--muted, rgba(241,245,249,0.5));">' + k + ':</span> ' + esc(v) + (extra || '') + '</div>' : ''; }
  function sezioneLettura(ord, p, parte, titolo, ruolo) {
    var d = p.dati[parte] || {};
    var haDati = haDatiParte(d);
    var haFile = (p.file || []).some(function (x) { return x.parte === parte; });
    var scad = d.scadenza ? dataBreve(d.scadenza) + (scaduta(d.scadenza) ? ' <b style="color:#f87171;">(scaduta)</b>' : '') : '';
    return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);"><div style="font-weight:700;color:#fff;margin-bottom:4px;">' + titolo + '</div>' +
      (haDati || haFile ? (
        CAMPI_PARTE[parte].filter(function (c) { return c !== 'scadenza'; }).map(function (c) { return rigaLettura(ETICHETTA_LETT[c], d[c]); }).join('') +
        (scad ? '<div style="margin:2px 0;"><span style="color:var(--muted, rgba(241,245,249,0.5));">Scadenza:</span> ' + scad + '</div>' : '') +
        (haFile ? righeFile(ord, p, parte, ruolo) : '')
      ) : '<div style="color:var(--muted, rgba(241,245,249,0.5));font-size:12px;">Nessun dato inserito dall\'azienda.</div>') + '</div>';
  }
  function titoloBox(ruolo) {
    return '<div style="font-weight:700;color:#fff;margin-bottom:4px;">♻️ Produttore, impianto di destinazione e intermediari' + (ruolo === 'azienda' ? ' <span style="font-weight:400;color:var(--muted, rgba(241,245,249,0.5));">(facoltativo)</span>' : '') + '</div>';
  }
  function disegna(box, p) {
    var ord = box.getAttribute('data-ord');
    var ruolo = p.ruolo;
    cache[ord] = p;
    var agg = p.aggiornato_il ? '<div style="font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin-top:8px;">Aggiornato il ' + esc(dataOra(p.aggiornato_il)) + '</div>' : '';
    var html = titoloBox(ruolo);
    if (ruolo === 'azienda') {
      var o = esc(ord).replace(/'/g, '&#39;');
      var haQualcosa = PARTI.some(function (k) { return haDatiParte(p.dati[k]); }) || (p.file || []).length > 0;
      var inModifica = modo[ord] === 'mod' || !haQualcosa;
      if (inModifica) {
        html += '<div style="color:var(--muted, rgba(241,245,249,0.5));font-size:12px;line-height:1.5;">Qui puoi indicare il produttore, l\'impianto di destinazione e l\'eventuale intermediario. Il trasportatore li vede dopo aver preso il carico, per controllare le autorizzazioni e compilare il formulario.</div>' +
          sezioneModifica(ord, p, 'produttore', titoloParte('produttore', true)) +
          sezioneModifica(ord, p, 'impianto', titoloParte('impianto', true)) +
          sezioneModifica(ord, p, 'intermediario', titoloParte('intermediario', true)) + datalists() +
          '<div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><button type="button" class="btn-cap" style="font-size:12px;" onclick="event.stopPropagation();ectDestSalva(\'' + o + '\')">💾 Salva</button>' +
          (haQualcosa ? '<button type="button" style="' + STILE_BT + '" onclick="event.stopPropagation();ectDestAnnulla(\'' + o + '\')">Annulla</button>' : '') +
          '<span data-stato style="font-size:12px;"></span></div>' +
          agg + '<div style="font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin-top:8px;">ℹ️ ' + DISCLAIMER_AZ + '</div>';
      } else {
        html += sezioneLettura(ord, p, 'produttore', titoloParte('produttore'), 'azienda') + sezioneLettura(ord, p, 'impianto', titoloParte('impianto'), 'azienda') + sezioneLettura(ord, p, 'intermediario', titoloParte('intermediario'), 'azienda') +
          '<div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><button type="button" class="btn-cap" style="font-size:12px;" onclick="event.stopPropagation();ectDestModifica(\'' + o + '\')">✏️ Modifica</button><span data-stato style="font-size:12px;"></span></div>' +
          agg + '<div style="font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin-top:8px;">ℹ️ ' + DISCLAIMER_AZ + '</div>';
      }
    } else {
      html += sezioneLettura(ord, p, 'produttore', titoloParte('produttore'), ruolo) + sezioneLettura(ord, p, 'impianto', titoloParte('impianto'), ruolo) + sezioneLettura(ord, p, 'intermediario', titoloParte('intermediario'), ruolo) + agg +
        '<div style="font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin-top:8px;">ℹ️ ' + (ruolo === 'trasportatore' ? DISCLAIMER_TR : DISCLAIMER_AZ) + (ruolo === 'trasportatore' ? ' Utile per controllare l\'autorizzazione dell\'impianto e per compilare il formulario.' : '') + '</div>';
    }
    box.innerHTML = html;
  }
  function trovaBox(ord) { return Array.prototype.filter.call(document.querySelectorAll('.ect-dest-box'), function (b) { return b.getAttribute('data-ord') === ord; }); }
  function ridisegnaTutti(ord, p) { trovaBox(ord).forEach(function (b) { disegna(b, p); }); }
  function stato(ord, testo, colore) { trovaBox(ord).forEach(function (b) { var s = b.querySelector('[data-stato]'); if (s) { s.textContent = testo; s.style.color = colore || ''; } }); }

  /* avviso ben visibile in cima al riquadro + posizione della pagina bloccata */
  function avviso(ord, testo, colore, sparisciMs) {
    trovaBox(ord).forEach(function (b) {
      var a = b.querySelector('[data-avviso]');
      if (!a) {
        a = document.createElement('div'); a.setAttribute('data-avviso', '1');
        a.style.cssText = 'margin:6px 0 8px;padding:9px 12px;border-radius:8px;font-size:13px;font-weight:700;border:1px solid currentColor;';
        b.insertBefore(a, b.firstChild && b.firstChild.nextSibling ? b.firstChild.nextSibling : null);
      }
      a.textContent = testo; a.style.color = colore || '#e2e8f0'; a.style.background = 'rgba(255,255,255,0.06)';
      if (a._t) clearTimeout(a._t);
      if (sparisciMs) a._t = setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, sparisciMs);
    });
  }
  function bloccaPosizione(ord) {
    var b = trovaBox(ord)[0]; var salvati = [{ el: window, x: window.scrollX, y: window.scrollY }];
    for (var el = b; el && el !== document.body; el = el.parentElement) { if (el.scrollHeight > el.clientHeight) salvati.push({ el: el, x: el.scrollLeft, y: el.scrollTop }); }
    return function () { salvati.forEach(function (s) { try { if (s.el === window) window.scrollTo(s.x, s.y); else { s.el.scrollLeft = s.x; s.el.scrollTop = s.y; } } catch (e) {} }); };
  }
  function attesaMinima(t0, ms) { var r = ms - (Date.now() - t0); return new Promise(function (ok) { setTimeout(ok, r > 0 ? r : 0); }); }

  async function riempi() {
    if (inCorso) return; inCorso = true;
    try { await riempiBox(); } finally { inCorso = false; }
  }
  async function riempiBox() {
    var boxes = document.querySelectorAll('.ect-dest-box:not([data-caricato])');
    for (var k = 0; k < boxes.length; k++) {
      var box = boxes[k]; box.setAttribute('data-caricato', '1');
      var ord = box.getAttribute('data-ord');
      box.innerHTML = '<span style="color:var(--muted, rgba(241,245,249,0.5));">⏳ Carico…</span>';
      try {
        var p = await chiama('dest_leggi', { numero_ordine: ord });
        if (!p || !p.ok) { box.innerHTML = '<span style="color:var(--muted, rgba(241,245,249,0.5));">Dati dell\'impianto non disponibili in questo momento.</span>'; box.removeAttribute('data-caricato'); continue; }
        if (!p.applicabile) { box.style.display = 'none'; continue; }
        disegna(box, p);
      } catch (e) { box.innerHTML = '<span style="color:var(--muted, rgba(241,245,249,0.5));">Dati dell\'impianto non disponibili in questo momento.</span>'; box.removeAttribute('data-caricato'); }
    }
  }
  function pianifica() { [0, 250, 900].forEach(function (ms) { setTimeout(riempi, ms); }); }
  var inCorso = false;
  function segnaposto(ord) {
    return '<div class="ect-dest-box" data-ord="' + esc(ord) + '" style="' + STILE_BOX + '"></div>';
  }

  /* ---------------- azioni dell'azienda ---------------- */
  function leggiForm(ord) {
    var box = trovaBox(ord)[0]; var out = parteVuota();
    if (!box) return out;
    box.querySelectorAll('input[data-campo]').forEach(function (i) { out[i.getAttribute('data-parte')][i.getAttribute('data-campo')] = i.value.trim(); });
    return out;
  }
  function stessi(a, b) { try { return JSON.stringify(a) === JSON.stringify(b); } catch (e) { return false; } }
  function logga(titolo, dettaglio) { try { if (typeof registraAttivita === 'function') registraAttivita('Modifica Dati', titolo, dettaglio); } catch (e) {} }

  window.ectDestModifica = function (ord) { modo[ord] = 'mod'; if (cache[ord]) ridisegnaTutti(ord, cache[ord]); };
  window.ectDestAnnulla = function (ord) { modo[ord] = 'vista'; if (cache[ord]) ridisegnaTutti(ord, cache[ord]); };

  window.ectDestSalva = async function (ord) {
    var dati = leggiForm(ord);
    var prima = cache[ord] && cache[ord].dati;
    var t0 = Date.now();
    avviso(ord, '⏳ Salvataggio in corso…', '#fbbf24');
    try {
      var r = await chiama('dest_salva', { numero_ordine: ord, produttore: dati.produttore, impianto: dati.impianto, intermediario: dati.intermediario });
      await attesaMinima(t0, 1500);
      if (r && r.ok && r.applicabile) {
        var ripristina = bloccaPosizione(ord);
        modo[ord] = 'vista';
        suggRicorda(r.dati);
        ridisegnaTutti(ord, r);
        ripristina();
        if (r.produttore_non_salvato) avviso(ord, '⚠️ Impianto e intermediario sono salvati, ma il Produttore no (errore del sistema). Riprova più tardi o avvisaci.', '#fbbf24', 12000);
        else avviso(ord, '✅ Dati salvati.', '#4ade80', 6000);
        var cambiato = !(prima && stessi(prima, r.dati));
        if (cambiato) logga('Produttore, impianto di destinazione e intermediari rifiuti: dati salvati', 'Carico ' + ord + ' · produttore «' + ((r.dati.produttore || {}).ragione_sociale || '—') + '» · impianto «' + (r.dati.impianto.ragione_sociale || '—') + '» · intermediario «' + (r.dati.intermediario.ragione_sociale || '—') + '»');
      } else if (r && r.errore === 'data_non_valida') avviso(ord, '⚠️ Controlla la data di scadenza.', '#f87171', 8000);
      else avviso(ord, '⚠️ Non sono riuscito a salvare. Riprova.', '#f87171', 8000);
    } catch (e) { avviso(ord, '⚠️ Non sono riuscito a salvare. Riprova.', '#f87171', 8000); }
  };

  function base64(file) { return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1] || ''); }; r.onerror = ko; r.readAsDataURL(file); }); }
  window.ectDestCarica = async function (ord, parte, inp) {
    var file = inp && inp.files && inp.files[0]; if (!file) return;
    inp.value = '';
    var tipo = file.type;
    if (!tipo && /\.pdf$/i.test(file.name)) tipo = 'application/pdf';
    if (!TIPI_OK[tipo]) { stato(ord, '⚠️ Sono ammessi solo PDF, JPG e PNG.', '#f87171'); return; }
    if (file.size > MAX_BYTE) { stato(ord, '⚠️ Il file è troppo grande (massimo 4 MB).', '#f87171'); return; }
    var t0 = Date.now();
    avviso(ord, '⏳ Caricamento in corso…', '#fbbf24');
    stato(ord, '', '');
    try {
      var b64 = await base64(file);
      // se nel frattempo l'azienda ha scritto dei dati senza premere Salva, non li perdiamo: restano nel modulo
      var dati = leggiForm(ord);
      var r = await chiama('dest_file_carica', { numero_ordine: ord, parte: parte, nome_file: file.name, tipo: tipo, file: b64 });
      await attesaMinima(t0, 2000);
      if (r && r.ok && r.applicabile) {
        var ripristina = bloccaPosizione(ord);
        modo[ord] = 'mod';
        ridisegnaTutti(ord, r);
        trovaBox(ord).forEach(function (b) { b.querySelectorAll('input[data-campo]').forEach(function (i) { var v = dati[i.getAttribute('data-parte')][i.getAttribute('data-campo')]; if (v != null && v !== '') i.value = v; }); });
        ripristina();
        avviso(ord, '✅ Caricamento inviato: ' + file.name, '#4ade80', 6000);
        logga('Produttore, impianto di destinazione e intermediari rifiuti: file caricato', 'Carico ' + ord + ' · ' + parte + ' · ' + file.name);
      } else if (r && r.errore === 'troppi_file') avviso(ord, '⚠️ Massimo 3 file per voce: rimuovine uno prima.', '#f87171', 8000);
      else if (r && r.errore === 'file_troppo_grande') avviso(ord, '⚠️ Il file è troppo grande (massimo 4 MB).', '#f87171', 8000);
      else avviso(ord, '⚠️ Non sono riuscito a caricare il file. Riprova.', '#f87171', 8000);
    } catch (e) { avviso(ord, '⚠️ Non sono riuscito a caricare il file. Riprova.', '#f87171', 8000); }
  };
  window.ectDestRimuovi = async function (ord, id) {
    var p = cache[ord]; var f = p && (p.file || []).filter(function (x) { return x.id === id; })[0];
    if (!confirm('Vuoi davvero rimuovere il file «' + (f ? f.nome : 'file') + '»? Poi puoi caricarne un altro.')) return;
    var dati = leggiForm(ord);
    var inForm = !!(trovaBox(ord)[0] && trovaBox(ord)[0].querySelector('input[data-campo]'));
    var t0 = Date.now();
    avviso(ord, '⏳ Rimozione in corso…', '#fbbf24');
    try {
      var r = await chiama('dest_file_rimuovi', { numero_ordine: ord, id: id });
      await attesaMinima(t0, 1500);
      if (r && r.ok && r.applicabile) {
        var ripristina = bloccaPosizione(ord);
        if (inForm) modo[ord] = 'mod';
        ridisegnaTutti(ord, r);
        trovaBox(ord).forEach(function (b) { b.querySelectorAll('input[data-campo]').forEach(function (i) { var v = dati[i.getAttribute('data-parte')][i.getAttribute('data-campo')]; if (v != null && v !== '') i.value = v; }); });
        ripristina();
        avviso(ord, '✅ File rimosso.', '#4ade80', 6000);
        logga('Produttore, impianto di destinazione e intermediari rifiuti: file rimosso', 'Carico ' + ord + ' · ' + (r.rimosso || (f && f.nome) || 'file'));
      } else avviso(ord, '⚠️ Non sono riuscito a rimuovere il file. Riprova.', '#f87171', 8000);
    } catch (e) { avviso(ord, '⚠️ Non sono riuscito a rimuovere il file. Riprova.', '#f87171', 8000); }
  };

  /* ---------------- Vedi / Scarica / Stampa (il file passa dal server) ---------------- */
  function blobDa(r) {
    var bin = atob(r.file); var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: r.tipo || 'application/octet-stream' });
  }
  window.ectDestApri = async function (ord, id, modo) {
    if (eAnteprima(ord)) { alert('Anteprima: qui si aprirebbe il file.'); return; }
    var w = null;
    if (modo !== 'scarica') { w = window.open('', '_blank'); if (!w) { alert('Il browser ha bloccato la finestra: consenti i pop-up per questo sito.'); return; } w.document.write('<p style="font-family:Arial;padding:20px;">Carico il file…</p>'); }
    try {
      var r = await chiama('dest_file_apri', { numero_ordine: ord, id: id });
      if (!r || !r.ok) { if (w) w.close(); alert('Non riesco ad aprire il file in questo momento. Riprova.'); return; }
      var blob = blobDa(r); var url = URL.createObjectURL(blob);
      if (modo === 'scarica') {
        var a = document.createElement('a'); a.href = url; a.download = r.nome || 'documento'; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000); return;
      }
      if (modo === 'stampa' && /^image\//.test(r.tipo || '')) {
        w.document.open();
        w.document.write('<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>' + esc(r.nome) + '</title><style>body{margin:0;text-align:center;font-family:Arial,sans-serif;} h1{font-size:14px;margin:10px;} img{max-width:100%;}</style></head><body><h1>' + esc(r.nome) + '</h1><img id="i" src="' + url + '"><script>var i=document.getElementById("i");function p(){setTimeout(function(){window.print();},200);}if(i.complete)p();else i.onload=p;<\/script></body></html>');
        w.document.close(); return;
      }
      w.location.href = url;
      if (modo === 'stampa') setTimeout(function () { alert('Il PDF si è aperto in una nuova scheda: per stamparlo usa la stampante del visualizzatore (oppure Ctrl+P).'); }, 400);
    } catch (e) { if (w) w.close(); alert('Non riesco ad aprire il file in questo momento. Riprova.'); }
  };

  /* ---------------- aggancio al portale: scheda del carico preso ---------------- */
  var stampando = false;
  if (typeof window.cpScheda === 'function') {
    var origScheda = window.cpScheda;
    window.cpScheda = function (f) {
      var html = origScheda.apply(this, arguments);
      try {
        if (!stampando && f && String(f.stato || '').toUpperCase() === 'PRESO' && eRifiuto(f) && f.numero_ordine) {
          var ruolo = ruoloPagina();
          if (ruolo === 'azienda' || ruolo === 'trasportatore') { html += segnaposto(f.numero_ordine); pianifica(); }
        }
      } catch (e) {}
      return html;
    };
  }
  if (typeof window.cpStampa === 'function') {
    var origStampa = window.cpStampa;
    window.cpStampa = async function () {
      stampando = true;
      try { return await origStampa.apply(this, arguments); } finally { stampando = false; }
    };
  }

  /* ---------------- aggancio alla dashboard: dettaglio del carico ---------------- */
  if (typeof window.apriDettaglioCarico === 'function' && typeof window.cpScheda !== 'function') {
    var origDettaglio = window.apriDettaglioCarico;
    window.apriDettaglioCarico = function (id) {
      var r = origDettaglio.apply(this, arguments);
      try {
        var c = (typeof tuttiCarichi !== 'undefined' ? tuttiCarichi : []).filter(function (x) { return x.id === id; })[0];
        var f = c && c.fields;
        if (f && String(f.stato || '').toUpperCase() === 'PRESO' && eRifiuto(f) && f.numero_ordine) {
          var body = document.getElementById('modal-body');
          if (body) { body.insertAdjacentHTML('beforeend', segnaposto(f.numero_ordine)); pianifica(); }
        }
      } catch (e) {}
      return r;
    };
  }

  /* =====================================================================
     10/10 — IMPIANTO E INTERMEDIARIO GIA' ALLA PUBBLICAZIONE (facoltativo)
     - Nel modulo "Pubblica" compare (solo se spunti "Si tratta di rifiuti") il riquadro con gli stessi campi
       e gli allegati. Dati e file partono DOPO la pubblicazione, quando il carico esiste.
     - Si possono inserire / modificare anche dopo: dallo Storico pubblicazioni (pulsante ♻️) e da Trasporti presi.
     - Il trasportatore li vede solo dopo aver preso il carico (lo decide il server).
     ===================================================================== */
  var pubFile = { produttore: [], impianto: [], intermediario: [] };
  var PUB_MAX_FILE = 3;
  function pubRidisegnaFile(parte) {
    PARTI.forEach(function (p) {
      if (parte && p !== parte) return;
      var el = document.querySelector('#ins-rif-nota [data-pf="' + p + '"]'); if (!el) return;
      el.innerHTML = pubFile[p].length ? pubFile[p].map(function (f, i) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="flex:1;">📎 ' + esc(f.name) + '</span>' +
          '<button type="button" style="' + STILE_BT + 'background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.4);" onclick="ectDestPubTogli(\'' + p + '\',' + i + ')">✕ Rimuovi</button></div>';
      }).join('') : '<div style="color:var(--muted, rgba(241,245,249,0.5));font-size:12px;margin:6px 0;">Nessun file allegato.</div>';
    });
  }
  function pubSezione(parte, titolo) {
    return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);"><div style="font-weight:700;color:#fff;">' + titolo + '</div>' +
      campiModifica(parte, {}) +
      '<div style="margin-top:10px;font-size:12px;font-weight:600;">Allegati (PDF, JPG o PNG, max 4 MB, fino a ' + PUB_MAX_FILE + ')</div><div data-pf="' + parte + '"></div>' +
      '<div style="margin-top:6px;"><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style="display:none;" onchange="ectDestPubFile(\'' + parte + '\',this)">' +
      '<button type="button" style="' + STILE_BT + '" onclick="this.previousElementSibling.click()">📤 Carica file</button></div></div>';
  }
  function pubInizializza() {
    var w = document.getElementById('ins-rif-nota');
    if (!w || w.getAttribute('data-dest-pub')) return;
    w.setAttribute('data-dest-pub', '1');
    w.setAttribute('style', STILE_BOX + 'font-size:13px;line-height:1.5;transition:opacity .15s;');
    w.innerHTML = '<div style="font-weight:700;color:#fff;font-size:15px;">Vuoi inserire i dati?</div>' +
      '<ul style="margin:6px 0 0 18px;padding:0;color:var(--muted, rgba(241,245,249,0.8));"><li>Produttore</li><li>Impianto di destinazione</li><li>Eventuali intermediari</li></ul>' +
      '<div style="text-align:center;margin:12px 0;"><button type="button" data-pub-apri class="btn-cap" onclick="ectDestPubApri()" style="padding:10px 22px;">Clicca qui</button></div>' +
      '<div data-pub-dettagli style="display:none;">' +
      pubSezione('produttore', titoloParte('produttore', true)) + pubSezione('impianto', titoloParte('impianto', true)) + pubSezione('intermediario', titoloParte('intermediario', true)) + '<div style="text-align:center;margin:14px 0 4px;"><button type="button" data-pub-chiudi class="btn-cap" onclick="ectDestPubApri(false)" style="padding:10px 22px;">▲ Chiudi</button></div></div>' + datalists();
    pubRidisegnaFile();
    var chk = document.getElementById('ins-rifiuto');
    if (chk) chk.addEventListener('change', window.ectDestPubStato);
    window.ectDestPubStato();
    setInterval(window.ectDestPubStato, 1000);
  }
  /* il riquadro e' sempre visibile; si attiva solo se e' spuntato «Si tratta di rifiuti» */
  window.ectDestPubStato = function () {
    var w = document.getElementById('ins-rif-nota'), c = document.getElementById('ins-rifiuto'); if (!w || !c) return;
    var on = !!c.checked;
    w.style.display = on ? '' : 'none'; if (!on) window.ectDestPubApri(false);
    var campi = w.querySelectorAll('input,button'); campi.forEach(function (e) { e.disabled = !on; });
    
    pubSuggAzienda();
  };
  /* suggerimenti dai dati d'iscrizione dell'azienda (ragione sociale e sede): compaiono mentre scrivi, non vengono scritti da soli */
  var suggAzFatto = false;
  function pubSuggAzienda() {
    if (suggAzFatto) return;
    var p; try { p = (typeof profiloAzienda !== 'undefined') ? profiloAzienda : null; } catch (e) { p = null; }
    if (!p || !p.nome) return;
    var sede = [p.via, [p.cap, p.citta].filter(Boolean).join(' '), p.provincia ? '(' + p.provincia + ')' : ''].filter(Boolean).join(', ').replace(', (', ' (');
    var add = function (id, v) { var dl = document.getElementById(id); if (!dl || !v) return; var o = document.createElement('option'); o.value = v; o.label = 'la tua azienda'; dl.appendChild(o); var l = Array.prototype.slice.call(dl.children).sort(function (a, b) { return a.value.localeCompare(b.value, 'it', { sensitivity: 'base' }); }); l.forEach(function (x) { dl.appendChild(x); }); };
    add('ect-dl-ragione_sociale', p.nome); if (p.via) add('ect-dl-indirizzo', sede);
    suggAzFatto = true;
  }
  window.ectDestPubFile = async function (parte, inp) {
    var file = inp && inp.files && inp.files[0]; if (!file) return;
    inp.value = '';
    var tipo = file.type; if (!tipo && /\.pdf$/i.test(file.name)) tipo = 'application/pdf';
    var es = window.ectEsito ? window.ectEsito('Carico il file «' + file.name + '»…') : null;
    var fine = function (m, ok) { return es ? es.fine(m, ok) : Promise.resolve(); };
    if (!TIPI_OK[tipo]) { await fine('Sono ammessi solo PDF, JPG e PNG.', false); return; }
    if (file.size > MAX_BYTE) { await fine('Il file è troppo grande (massimo 4 MB).', false); return; }
    if (pubFile[parte].length >= PUB_MAX_FILE) { await fine('Massimo ' + PUB_MAX_FILE + ' file per voce: rimuovine uno prima.', false); return; }
    pubFile[parte].push({ name: file.name, tipo: tipo, file: file });
    pubRidisegnaFile(parte);
    await fine('File caricato: ' + file.name + ' (parte con la pubblicazione)', true);
  };
  window.ectDestPubTogli = function (parte, i) { pubFile[parte].splice(i, 1); pubRidisegnaFile(parte); };
  function pause(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  /* chiamata da pubblicaCarico() (index.html) subito dopo la pubblicazione riuscita */
  window.ectDestPubApri = function (apri) {
    var w = document.getElementById('ins-rif-nota'); if (!w) return;
    var d = w.querySelector('[data-pub-dettagli]'), b = w.querySelector('[data-pub-apri]'); if (!d || !b) return;
    var mostra = (typeof apri === 'boolean') ? apri : d.style.display === 'none';
    d.style.display = mostra ? '' : 'none';
    b.textContent = mostra ? '▲ Chiudi' : 'Clicca qui';
  };
  window.ectDestDopoPubblica = function (ord) {
    var w = document.getElementById('ins-rif-nota'); if (!w || !ord) return;
    var dati = parteVuota(), ha = false;
    w.querySelectorAll('input[data-campo]').forEach(function (i) { var v = i.value.trim(); dati[i.getAttribute('data-parte')][i.getAttribute('data-campo')] = v; if (v) ha = true; i.value = ''; });
    var file = { produttore: pubFile.produttore.slice(), impianto: pubFile.impianto.slice(), intermediario: pubFile.intermediario.slice() };
    var nf = file.produttore.length + file.impianto.length + file.intermediario.length;
    pubFile = { produttore: [], impianto: [], intermediario: [] }; pubRidisegnaFile(); window.ectDestPubApri(false); setTimeout(window.ectDestPubStato, 50);
    if (!ha && !nf) return;
    pubInvia(ord, dati, file, ha, nf);
  };
  async function pubInvia(ord, dati, file, ha, nf) {
    var es = window.ectEsito ? window.ectEsito('Salvo produttore, impianto di destinazione e intermediari del carico…') : null;
    var fine = function (m, ok) { return es ? es.fine(m, ok) : Promise.resolve(); };
    var DOVE = 'Il carico è pubblicato, ma produttore, impianto di destinazione e intermediari non sono stati salvati: aprili da Storico pubblicazioni → ♻️ e riprova.';
    var ok = false, dataErrata = false, prodKo = false;
    try {
      // il carico arriva su Airtable da Make: se non c'e' ancora riprovo ogni 3 secondi (fino a ~1 minuto)
      for (var t = 0; t < 20 && !ok; t++) {
        var r = await chiama(ha ? 'dest_salva' : 'dest_leggi', Object.assign({ numero_ordine: ord }, ha ? { produttore: dati.produttore, impianto: dati.impianto, intermediario: dati.intermediario } : {}));
        if (r && r.ok && r.applicabile) { ok = true; if (r.produttore_non_salvato) prodKo = true; break; }
        if (r && r.errore === 'data_non_valida') { dataErrata = true; break; }
        await pause(3000);
      }
      if (dataErrata) { await fine('Carico pubblicato. La data di scadenza non è valida: correggila da Storico pubblicazioni → ♻️.', false); return; }
      if (!ok) { await fine(DOVE, false); return; }
      var falliti = 0;
      for (var parte of PARTI) {
        for (var k = 0; k < file[parte].length; k++) {
          try {
            var b64 = await base64(file[parte][k].file);
            var rf = await chiama('dest_file_carica', { numero_ordine: ord, parte: parte, nome_file: file[parte][k].name, tipo: file[parte][k].tipo, file: b64 });
            if (!(rf && rf.ok)) falliti++;
          } catch (e) { falliti++; }
        }
      }
      if (ha) suggRicorda(dati);
      logga('Produttore, impianto di destinazione e intermediari rifiuti: inseriti alla pubblicazione', 'Carico ' + ord);
      if (falliti) await fine('Dati salvati, ma ' + falliti + ' file non caricati: riprova da Storico pubblicazioni → ♻️.', false);
      else if (prodKo) await fine('Impianto e intermediario salvati, ma il Produttore no (errore del sistema): riprova da Storico pubblicazioni → ♻️.', false);
      else await fine('Produttore, impianto di destinazione e intermediari salvati' + (nf ? ' (' + nf + ' file)' : '') + '.', true);
    } catch (e) { await fine(DOVE, false); }
  }

  /* finestra con il riquadro per un carico (Storico pubblicazioni, qualsiasi stato) */
  window.ectDestApriModale = function (ord) {
    var vecchio = document.getElementById('ect-dest-modale'); if (vecchio) vecchio.remove();
    var ov = document.createElement('div'); ov.id = 'ect-dest-modale';
    ov.style.cssText = 'position:fixed;inset:0;z-index:4500;background:rgba(2,6,23,0.78);overflow:auto;padding:24px 14px;display:flex;justify-content:center;align-items:flex-start;';
    ov.innerHTML = '<div style="width:100%;max-width:680px;background:#0f172a;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:18px;color:#f1f5f9;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;"><div style="font-weight:700;font-size:15px;">Carico ' + esc(ord) + '</div>' +
      '<button type="button" style="' + STILE_BT + '" id="ect-dest-chiudi">✕ Chiudi</button></div>' + segnaposto(ord) + '</div>';
    document.body.appendChild(ov);
    var chiudi = function () { ov.remove(); };
    ov.querySelector('#ect-dest-chiudi').onclick = chiudi;
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) chiudi(); });
    pianifica();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pubInizializza); else pubInizializza();
  setTimeout(pubInizializza, 800);
})();
