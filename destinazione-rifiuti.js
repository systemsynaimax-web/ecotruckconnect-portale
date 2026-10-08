/* =====================================================================
   EcoTruckConnect — destinazione-rifiuti.js (8/10/2026)
   Si carica in fondo a index.html (portale) e a dashboard.html, DOPO gli altri script.

   IMPIANTO DI DESTINAZIONE E INTERMEDIARIO dei carichi di RIFIUTI (richiesta di Gerlando)
   - Facoltativo. Compare solo sui carichi di rifiuti GIA' ACCETTATI (stato PRESO).
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
  var DISCLAIMER_AZ = 'Informazioni fornite dall\'azienda. La verifica resta a carico del trasportatore.';
  var DISCLAIMER_TR = 'Informazioni fornite dall\'azienda. La verifica resta a carico tuo.';

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
    if (!sim[ord]) sim[ord] = { dati: { impianto: { ragione_sociale: '', indirizzo: '', n_autorizzazione: '', ente_rilascio: '', scadenza: '' }, intermediario: { ragione_sociale: '', n_autorizzazione: '', ente_rilascio: '', scadenza: '' } }, file: [], aggiornato_il: '' };
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
      if (azione === 'dest_salva') { s.dati = JSON.parse(JSON.stringify({ impianto: extra.impianto || {}, intermediario: extra.intermediario || {} })); s.aggiornato_il = new Date().toISOString(); }
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
      '<input type="' + (tipo || 'text') + '"' + ((tipo || 'text') === 'text' ? ' list="ect-dl-' + nome + '" autocomplete="off"' : '') + ' data-parte="' + parte + '" data-campo="' + nome + '" value="' + esc(valore) + '" style="' + STILE_IN + '" maxlength="' + (nome === 'indirizzo' ? 250 : 200) + '">';
  }
  /* ---------------- suggerimenti mentre si scrive ---------------- */
  var ENTI = ['Albo Nazionale Gestori Ambientali', 'Albo Gestori Ambientali - Sezione regionale', 'Regione', 'Provincia', 'Libero Consorzio Comunale', 'Città Metropolitana', 'Comune', 'SUAP', 'ARPA', 'Ministero dell\'Ambiente e della Sicurezza Energetica', 'Camera di Commercio'];
  var CHIAVE_SUGG = 'ect_dest_suggerimenti';
  function suggLeggi() { try { return JSON.parse(localStorage.getItem(CHIAVE_SUGG) || '{}') || {}; } catch (e) { return {}; } }
  function suggRicorda(dati) {
    try {
      var s = suggLeggi();
      ['impianto', 'intermediario'].forEach(function (parte) {
        var d = (dati && dati[parte]) || {};
        ['ragione_sociale', 'indirizzo', 'n_autorizzazione', 'ente_rilascio'].forEach(function (c) {
          var v = String(d[c] || '').trim(); if (!v) return;
          var l = (s[c] || []).filter(function (x) { return x.toLowerCase() !== v.toLowerCase(); });
          l.unshift(v); s[c] = l.slice(0, 40);
        });
      });
      localStorage.setItem(CHIAVE_SUGG, JSON.stringify(s));
    } catch (e) {}
  }
  function optionsDi(lista) { return lista.map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join(''); }
  function datalists() {
    var s = suggLeggi();
    var enti = (s.ente_rilascio || []).concat(ENTI.filter(function (e) { return (s.ente_rilascio || []).map(function (x) { return x.toLowerCase(); }).indexOf(e.toLowerCase()) === -1; }));
    return '<datalist id="ect-dl-ragione_sociale">' + optionsDi(s.ragione_sociale || []) + '</datalist>' +
      '<datalist id="ect-dl-indirizzo">' + optionsDi(s.indirizzo || []) + '</datalist>' +
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
  function sezioneModifica(ord, p, parte, titolo) {
    var d = p.dati[parte] || {};
    var o = esc(ord).replace(/'/g, '&#39;');
    return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);"><div style="font-weight:700;color:#fff;">' + titolo + '</div>' +
      campo(parte, 'ragione_sociale', 'Ragione sociale', d.ragione_sociale) +
      (parte === 'impianto' ? campo(parte, 'indirizzo', 'Indirizzo', d.indirizzo) : '') +
      campo(parte, 'n_autorizzazione', 'Numero di autorizzazione / iscrizione', d.n_autorizzazione) +
      campo(parte, 'ente_rilascio', 'Ente che l\'ha rilasciata', d.ente_rilascio) +
      campo(parte, 'scadenza', 'Scadenza', d.scadenza, 'date') +
      '<div style="margin-top:10px;font-size:12px;font-weight:600;">Allegati (PDF, JPG o PNG, max 4 MB)</div>' + righeFile(ord, p, parte, 'azienda') +
      '<div style="margin-top:6px;"><input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style="display:none;" data-file-parte="' + parte + '" onchange="ectDestCarica(\'' + o + '\',\'' + parte + '\',this)">' +
      '<button type="button" style="' + STILE_BT + '" onclick="event.stopPropagation();this.previousElementSibling.click()">📤 Carica file</button></div></div>';
  }
  function rigaLettura(k, v, extra) { return v ? '<div style="margin:2px 0;"><span style="color:var(--muted, rgba(241,245,249,0.5));">' + k + ':</span> ' + esc(v) + (extra || '') + '</div>' : ''; }
  function sezioneLettura(ord, p, parte, titolo, ruolo) {
    var d = p.dati[parte] || {};
    var haDati = d.ragione_sociale || d.indirizzo || d.n_autorizzazione || d.ente_rilascio || d.scadenza;
    var haFile = (p.file || []).some(function (x) { return x.parte === parte; });
    var scad = d.scadenza ? dataBreve(d.scadenza) + (scaduta(d.scadenza) ? ' <b style="color:#f87171;">(scaduta)</b>' : '') : '';
    return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);"><div style="font-weight:700;color:#fff;margin-bottom:4px;">' + titolo + '</div>' +
      (haDati || haFile ? (
        rigaLettura('Ragione sociale', d.ragione_sociale) + (parte === 'impianto' ? rigaLettura('Indirizzo', d.indirizzo) : '') +
        rigaLettura('N. autorizzazione', d.n_autorizzazione) + rigaLettura('Ente', d.ente_rilascio) +
        (scad ? '<div style="margin:2px 0;"><span style="color:var(--muted, rgba(241,245,249,0.5));">Scadenza:</span> ' + scad + '</div>' : '') +
        (haFile ? righeFile(ord, p, parte, ruolo) : '')
      ) : '<div style="color:var(--muted, rgba(241,245,249,0.5));font-size:12px;">Nessun dato inserito dall\'azienda.</div>') + '</div>';
  }
  function titoloBox(ruolo) {
    return '<div style="font-weight:700;color:#fff;margin-bottom:4px;">♻️ Impianto di destinazione e intermediario' + (ruolo === 'azienda' ? ' <span style="font-weight:400;color:var(--muted, rgba(241,245,249,0.5));">(facoltativo)</span>' : '') + '</div>';
  }
  function disegna(box, p) {
    var ord = box.getAttribute('data-ord');
    var ruolo = p.ruolo;
    cache[ord] = p;
    var agg = p.aggiornato_il ? '<div style="font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin-top:8px;">Aggiornato il ' + esc(dataOra(p.aggiornato_il)) + '</div>' : '';
    var html = titoloBox(ruolo);
    if (ruolo === 'azienda') {
      var o = esc(ord).replace(/'/g, '&#39;');
      var haQualcosa = ['impianto', 'intermediario'].some(function (k) { var d = p.dati[k] || {}; return d.ragione_sociale || d.indirizzo || d.n_autorizzazione || d.ente_rilascio || d.scadenza; }) || (p.file || []).length > 0;
      var inModifica = modo[ord] === 'mod' || !haQualcosa;
      if (inModifica) {
        html += '<div style="color:var(--muted, rgba(241,245,249,0.5));font-size:12px;line-height:1.5;">Per i carichi di rifiuti puoi indicare l\'impianto dove vanno i rifiuti e un eventuale intermediario. Il trasportatore li vede per controllare le autorizzazioni e per compilare il formulario.</div>' +
          sezioneModifica(ord, p, 'impianto', '🏭 Impianto di destinazione') +
          sezioneModifica(ord, p, 'intermediario', '🔁 Intermediario (se c\'è)') + datalists() +
          '<div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><button type="button" class="btn-cap" style="font-size:12px;" onclick="event.stopPropagation();ectDestSalva(\'' + o + '\')">💾 Salva</button>' +
          (haQualcosa ? '<button type="button" style="' + STILE_BT + '" onclick="event.stopPropagation();ectDestAnnulla(\'' + o + '\')">Annulla</button>' : '') +
          '<span data-stato style="font-size:12px;"></span></div>' +
          agg + '<div style="font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin-top:8px;">ℹ️ ' + DISCLAIMER_AZ + '</div>';
      } else {
        html += sezioneLettura(ord, p, 'impianto', '🏭 Impianto di destinazione', 'azienda') + sezioneLettura(ord, p, 'intermediario', '🔁 Intermediario', 'azienda') +
          '<div style="margin-top:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;"><button type="button" class="btn-cap" style="font-size:12px;" onclick="event.stopPropagation();ectDestModifica(\'' + o + '\')">✏️ Modifica</button><span data-stato style="font-size:12px;"></span></div>' +
          agg + '<div style="font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin-top:8px;">ℹ️ ' + DISCLAIMER_AZ + '</div>';
      }
    } else {
      html += sezioneLettura(ord, p, 'impianto', '🏭 Impianto di destinazione', ruolo) + sezioneLettura(ord, p, 'intermediario', '🔁 Intermediario', ruolo) + agg +
        '<div style="font-size:11px;color:var(--muted, rgba(241,245,249,0.5));margin-top:8px;">ℹ️ ' + (ruolo === 'trasportatore' ? DISCLAIMER_TR : DISCLAIMER_AZ) + (ruolo === 'trasportatore' ? ' Utile per controllare l\'autorizzazione dell\'impianto e per compilare il formulario.' : '') + '</div>';
    }
    box.innerHTML = html;
  }
  function trovaBox(ord) { return Array.prototype.filter.call(document.querySelectorAll('.ect-dest-box'), function (b) { return b.getAttribute('data-ord') === ord; }); }
  function ridisegnaTutti(ord, p) { trovaBox(ord).forEach(function (b) { disegna(b, p); }); }
  function stato(ord, testo, colore) { trovaBox(ord).forEach(function (b) { var s = b.querySelector('[data-stato]'); if (s) { s.textContent = testo; s.style.color = colore || ''; } }); }

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
    var box = trovaBox(ord)[0]; var out = { impianto: {}, intermediario: {} };
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
    stato(ord, 'Salvataggio…', '');
    try {
      var r = await chiama('dest_salva', { numero_ordine: ord, impianto: dati.impianto, intermediario: dati.intermediario });
      if (r && r.ok && r.applicabile) {
        modo[ord] = 'vista';
        suggRicorda(r.dati);
        ridisegnaTutti(ord, r);
        stato(ord, '✅ Salvato.', '#4ade80');
        var cambiato = !(prima && stessi(prima, r.dati));
        if (cambiato) logga('Impianto e intermediario rifiuti: dati salvati', 'Carico ' + ord + ' · impianto «' + (r.dati.impianto.ragione_sociale || '—') + '» · intermediario «' + (r.dati.intermediario.ragione_sociale || '—') + '»');
      } else if (r && r.errore === 'data_non_valida') stato(ord, '⚠️ Controlla la data di scadenza.', '#f87171');
      else stato(ord, '⚠️ Non sono riuscito a salvare. Riprova.', '#f87171');
    } catch (e) { stato(ord, '⚠️ Non sono riuscito a salvare. Riprova.', '#f87171'); }
  };

  function base64(file) { return new Promise(function (ok, ko) { var r = new FileReader(); r.onload = function () { ok(String(r.result).split(',')[1] || ''); }; r.onerror = ko; r.readAsDataURL(file); }); }
  window.ectDestCarica = async function (ord, parte, inp) {
    var file = inp && inp.files && inp.files[0]; if (!file) return;
    inp.value = '';
    var tipo = file.type;
    if (!tipo && /\.pdf$/i.test(file.name)) tipo = 'application/pdf';
    if (!TIPI_OK[tipo]) { stato(ord, '⚠️ Sono ammessi solo PDF, JPG e PNG.', '#f87171'); return; }
    if (file.size > MAX_BYTE) { stato(ord, '⚠️ Il file è troppo grande (massimo 4 MB).', '#f87171'); return; }
    stato(ord, 'Carico il file…', '');
    try {
      var b64 = await base64(file);
      // se nel frattempo l'azienda ha scritto dei dati senza premere Salva, non li perdiamo: restano nel modulo
      var dati = leggiForm(ord);
      var r = await chiama('dest_file_carica', { numero_ordine: ord, parte: parte, nome_file: file.name, tipo: tipo, file: b64 });
      if (r && r.ok && r.applicabile) {
        modo[ord] = 'mod';
        ridisegnaTutti(ord, r);
        trovaBox(ord).forEach(function (b) { b.querySelectorAll('input[data-campo]').forEach(function (i) { var v = dati[i.getAttribute('data-parte')][i.getAttribute('data-campo')]; if (v != null && v !== '') i.value = v; }); });
        stato(ord, '✅ File caricato.', '#4ade80');
        logga('Impianto e intermediario rifiuti: file caricato', 'Carico ' + ord + ' · ' + (parte === 'impianto' ? 'impianto' : 'intermediario') + ' · ' + file.name);
      } else if (r && r.errore === 'troppi_file') stato(ord, '⚠️ Massimo 3 file per voce: rimuovine uno prima.', '#f87171');
      else if (r && r.errore === 'file_troppo_grande') stato(ord, '⚠️ Il file è troppo grande (massimo 4 MB).', '#f87171');
      else stato(ord, '⚠️ Non sono riuscito a caricare il file. Riprova.', '#f87171');
    } catch (e) { stato(ord, '⚠️ Non sono riuscito a caricare il file. Riprova.', '#f87171'); }
  };
  window.ectDestRimuovi = async function (ord, id) {
    var p = cache[ord]; var f = p && (p.file || []).filter(function (x) { return x.id === id; })[0];
    if (!confirm('Vuoi davvero rimuovere il file «' + (f ? f.nome : 'file') + '»? Poi puoi caricarne un altro.')) return;
    var dati = leggiForm(ord);
    var inForm = !!(trovaBox(ord)[0] && trovaBox(ord)[0].querySelector('input[data-campo]'));
    stato(ord, 'Rimozione…', '');
    try {
      var r = await chiama('dest_file_rimuovi', { numero_ordine: ord, id: id });
      if (r && r.ok && r.applicabile) {
        if (inForm) modo[ord] = 'mod';
        ridisegnaTutti(ord, r);
        trovaBox(ord).forEach(function (b) { b.querySelectorAll('input[data-campo]').forEach(function (i) { var v = dati[i.getAttribute('data-parte')][i.getAttribute('data-campo')]; if (v != null && v !== '') i.value = v; }); });
        stato(ord, '✅ File rimosso.', '#4ade80');
        logga('Impianto e intermediario rifiuti: file rimosso', 'Carico ' + ord + ' · ' + (r.rimosso || (f && f.nome) || 'file'));
      } else stato(ord, '⚠️ Non sono riuscito a rimuovere il file. Riprova.', '#f87171');
    } catch (e) { stato(ord, '⚠️ Non sono riuscito a rimuovere il file. Riprova.', '#f87171'); }
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
})();
