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
      if (azione === 'documenti_trasportatore') return { ok: true, documenti: [
        { autorizzazione: 'Conto Terzi', nome: 'licenza-esempio.png', url: docEsempio('Conto Terzi'), tipo: 'image/png' },
        { autorizzazione: 'Frigorifero (0°C)', nome: 'atp-esempio.png', url: docEsempio('Frigorifero (0°C) - ATP'), tipo: 'image/png' }] };
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

  window.ectChiamaDoc = chiamaDoc; // 3/10: usata dallo storico movimenti del portale

  function docEsempio(t) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="420"><rect width="595" height="420" fill="#fff" stroke="#333" stroke-width="4"/>' +
      '<text x="297" y="90" font-family="Arial" font-size="28" text-anchor="middle" fill="#111">DOCUMENTO DI ESEMPIO</text>' +
      '<text x="297" y="160" font-family="Arial" font-size="22" text-anchor="middle" fill="#1d4ed8">Autorizzazione: ' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>' +
      '<text x="297" y="220" font-family="Arial" font-size="18" text-anchor="middle" fill="#444">Trasportatore: Mario Rossi</text>' +
      '<text x="297" y="330" font-family="Arial" font-size="14" text-anchor="middle" fill="#888">Anteprima EcoTruckConnect - non e un documento reale</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* popup di conferma, stesso stile degli altri del portale */
  function conferma(o) {
    return new Promise(function (fine) {
      var vecchio = document.getElementById('ect-conferma'); if (vecchio) vecchio.remove();
      var blu = o.colore === 'blu';
      var ov = document.createElement('div');
      ov.className = 'confirm-overlay'; ov.id = 'ect-conferma';
      ov.innerHTML = '<div class="confirm-box">' +
        '<div class="confirm-icon"' + (blu ? ' style="background:rgba(59,130,246,0.15);"' : '') + '>' + (o.icona || '⚠️') + '</div>' +
        '<div class="confirm-title">' + esc(o.titolo) + '</div>' +
        '<div class="confirm-text">' + o.testo + '</div>' +
        '<div class="confirm-actions">' +
        '<button type="button" class="confirm-btn confirm-btn-cancel" data-r="0">' + esc(o.no || 'Annulla') + '</button>' +
        '<button type="button" class="confirm-btn confirm-btn-remove" data-r="1"' + (blu ? ' style="background:#3b82f6;"' : '') + '>' + esc(o.si) + '</button>' +
        '</div></div>';
      function chiudi(v) { ov.remove(); document.removeEventListener('keydown', tasto); fine(v); }
      function tasto(e) { if (e.key === 'Escape') chiudi(false); }
      ov.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-r]');
        if (b) chiudi(b.getAttribute('data-r') === '1');
        else if (e.target === ov) chiudi(false);
      });
      document.addEventListener('keydown', tasto);
      document.body.appendChild(ov);
    });
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


  /* =====================================================================
     ESITO FILE (10/10/2026): per ogni file che si carica o si riceve compare
     una clessidra per almeno 2 secondi, poi "File caricato" (o l'errore).
     Uso:  var es = window.ectEsito('Caricamento…');  ...  await es.fine('File caricato', true);
     ===================================================================== */
  (function () {
    if (window.ectEsito) return;
    var st = document.createElement('style');
    st.textContent = '#ect-esito{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:5000;max-width:min(92vw,520px);padding:14px 20px;border-radius:14px;font:600 15px/1.4 var(--font-b,Arial);color:#fff;background:#0e1623;border:1px solid rgba(251,191,36,.6);box-shadow:0 14px 40px rgba(0,0,0,.55);display:none;align-items:center;gap:12px;}' +
      '#ect-esito.ok{background:#0b3b22;border-color:#22c55e;color:#dcfce7;}#ect-esito.ko{border-color:rgba(248,113,113,.8);}' +
      '#ect-esito .cl{font-size:22px;display:inline-block;animation:ectclessidra 1.2s ease-in-out infinite;}@keyframes ectclessidra{0%,100%{transform:rotate(0)}50%{transform:rotate(180deg)}}';
    (document.head || document.documentElement).appendChild(st);
    var tmr = null;
    function box() { var b = document.getElementById('ect-esito'); if (!b) { b = document.createElement('div'); b.id = 'ect-esito'; b.setAttribute('role', 'status'); document.body.appendChild(b); } return b; }
    function mostra(html, classe, ms) {
      var b = box(); clearTimeout(tmr); b.className = classe || ''; b.innerHTML = html; b.style.display = 'flex';
      if (ms) tmr = setTimeout(function () { b.style.display = 'none'; }, ms);
    }
    window.ectEsito = function (testo) {
      var t0 = Date.now();
      mostra('<span class="cl">⏳</span><span>' + esc(testo || 'Un attimo…') + '</span>', '', 0);
      return {
        fine: function (msg, ok) {
          var resto = 2000 - (Date.now() - t0); if (resto < 0) resto = 0;
          return new Promise(function (r) {
            setTimeout(function () {
              if (ok === false) mostra('<span>⚠️</span><span>' + esc(msg) + '</span>', 'ko', 5000);
              else mostra('<span>✅</span><span>' + esc(msg) + '</span>', 'ok', 3500);
              r();
            }, resto);
          });
        }
      };
    };
  })();


  /* =====================================================================
     SCARICA (10/10/2026): scarica un PDF vero (non apre la stampa).
     ectScarica(titolo, [nodi della pagina], 'html extra con tabelle')
     ===================================================================== */
  window.ectScarica = async function (titolo, nodi, htmlExtra) {
    var es = window.ectEsito('Preparo il file «' + titolo + '»…');
    var nomeFile = String(titolo || 'documento').toLowerCase().replace(/[^a-z0-9àèéìòù]+/g, '-').replace(/^-+|-+$/g, '') || 'documento';
    try {
      if (!(window.jspdf && window.jspdf.jsPDF)) throw new Error('jspdf');
      var cont = document.createElement('div'); cont.innerHTML = htmlExtra || '';
      (nodi || []).forEach(function (n) {
        if (!n) return;
        var c = n.cloneNode(true);
        c.querySelectorAll('button, input, select, textarea, script, style, .ect-stampa-bar, .feed-actions, .spiega-apri').forEach(function (x) { x.remove(); });
        cont.appendChild(c);
      });
      var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
      var W = doc.internal.pageSize.getWidth(), Hh = doc.internal.pageSize.getHeight(), M = 40, y = 52;
      doc.setFontSize(16); doc.text('EcoTruckConnect — ' + titolo, M, y); y += 18;
      doc.setFontSize(9); doc.setTextColor(110); doc.text('Scaricato il ' + new Date().toLocaleString('it-IT'), M, y); y += 18; doc.setTextColor(20);
      function testoDi(n) {
        if (n.nodeType === 3) return n.nodeValue;
        if (n.nodeType !== 1) return '';
        var t = n.tagName; if (t === 'BR') return '\n';
        var s = ''; n.childNodes.forEach(function (c) { s += testoDi(c); });
        if (/^(DIV|P|H[1-6]|LI|TR|SECTION|DETAILS|SUMMARY|UL|OL)$/.test(t)) s = '\n' + s + '\n';
        else if (t === 'TD' || t === 'TH') s += '  ';
        return s;
      }
      function scrivi(n) {
        if (n.nodeType !== 1) return;
        if (n.tagName === 'TABLE') {
          doc.autoTable({ html: n, startY: y, margin: { left: M, right: M }, styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [29, 78, 216] } });
          y = doc.lastAutoTable.finalY + 12; return;
        }
        if (n.querySelector('table')) { Array.prototype.forEach.call(n.children, scrivi); return; }
        var t = testoDi(n).replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim();
        if (!t) return;
        doc.setFontSize(9.5);
        doc.splitTextToSize(t, W - 2 * M).forEach(function (riga) {
          if (y > Hh - 50) { doc.addPage(); y = 50; }
          doc.text(riga, M, y); y += 13;
        });
        y += 6;
      }
      Array.prototype.forEach.call(cont.children, scrivi);
      var pagine = doc.internal.getNumberOfPages();
      for (var i = 1; i <= pagine; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text('Documento di riepilogo EcoTruckConnect — SynAIMAX S.R.L.S. Non sostituisce la fattura fiscale. · pag. ' + i + '/' + pagine, M, Hh - 24); }
      await es.fine('File scaricato: ' + nomeFile + '.pdf', true);
      doc.save(nomeFile + '.pdf');
    } catch (e) {
      console.error('ectScarica', e);
      await es.fine('Non sono riuscito a preparare il file. Riprova tra un momento.', false);
    }
  };


  /* =====================================================================
     SALVATAGGI (10/10/2026): ogni "Salva" mostra la clessidra per almeno 2 secondi
     e poi "Salvato" in verde (oppure l'errore). Non cambia il salvataggio: lo avvolge.
     ===================================================================== */
  (function () {
    var LISTA = [
      ['salvaProfiloTrasportatore', 'profilo-salvato-msg', 'Salvataggio di mezzi e autorizzazioni…', 'Salvato: mezzi e autorizzazioni'],
      ['salvaDashDati', 'dd-salvato-msg', 'Salvataggio dei tuoi dati…', 'Salvato: i tuoi dati'],
      ['salvaNotifiche', 'notif-salvato-msg', 'Salvataggio delle notifiche…', 'Salvato: preferenze notifiche'],
      ['rigeneraPassword', 'rigenera-pw-msg', 'Creo la nuova password…', 'Nuova password creata'],
      ['salvaNuovaPassword', 'cpw-ok', 'Salvataggio della password…', 'Salvata: la tua nuova password'],
      ['pubblicaCarico', 'ins-ok', 'Pubblicazione del carico…', 'Carico pubblicato']
    ];
    function visibile(id) { var e = document.getElementById(id); if (!e) return true; return getComputedStyle(e).display !== 'none'; }
    function avvolgi(v) {
      var o = window[v[0]]; if (typeof o !== 'function' || o.__esito) return !!(o && o.__esito);
      var w = async function () {
        var es = window.ectEsito(v[2]), r;
        try { r = await o.apply(this, arguments); }
        catch (e) { await es.fine('Non salvato: riprova tra un momento.', false); throw e; }
        var ok = visibile(v[1]);
        await es.fine(ok ? v[3] : 'Non salvato: controlla i messaggi in pagina.', ok);
        return r;
      };
      w.__esito = true; window[v[0]] = w; return true;
    }
    var giri = 0, t = setInterval(function () {
      giri++; var tutte = LISTA.map(avvolgi).every(Boolean);
      if (tutte || giri > 60) clearInterval(t);
    }, 500);
  })();

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
        '<button type="button" data-ect-carica="' + i + '" style="background:none;border:1px solid rgba(255,255,255,0.2);color:#cbd5e1;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;">Sostituisci</button>' +
        '<button type="button" data-ect-rimuovi="' + i + '" style="background:none;border:1px solid rgba(239,68,68,0.5);color:#fca5a5;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;">Rimuovi</button></span>';
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
      b.onclick = async function () {
        var aut = sel[Number(b.getAttribute('data-ect-carica'))];
        var d = docDi(aut);
        if (d) {
          var ok = await conferma({ icona: '🔄', colore: 'blu', titolo: 'Vuoi sostituire il documento?',
            testo: 'Per <strong>"' + esc(aut) + '"</strong> hai già caricato <strong>' + esc(d.nome) + '</strong>.<br>Se vai avanti, il file attuale viene cancellato e al suo posto va quello nuovo che scegli adesso.',
            si: 'Sì, sostituisci', no: 'No, lascia così' });
          if (!ok) return;
        }
        scegliFile(aut);
      };
    });
    c.querySelectorAll('[data-ect-rimuovi]').forEach(function (b) {
      b.onclick = function () { rimuoviFile(sel[Number(b.getAttribute('data-ect-rimuovi'))]); };
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
      var __vecchio = docDi(aut);
      var __es = window.ectEsito('Caricamento di «' + nome + '»…');
      inCaricamento[aut] = true; renderRighe();
      try {
        var b64 = await leggiBase64(blob);
        var r = await chiamaDoc('carica', { autorizzazione: aut, nome_file: nome, tipo: tipoFile, file: b64, autorizzazioni_selezionate: autSelezionate() });
        await __es.fine(r && r.ok ? 'File caricato: ' + nome : (ERRORI[(r && r.errore)] || ERRORI.caricamento_fallito), !!(r && r.ok));
        if (r && r.ok) {
          documenti = r.documenti || documenti; docsCaricati = true;
          try { registraAttivita('Modifica Dati', 'Cambio dati: Documento ' + aut, 'prima: ' + (__vecchio ? __vecchio.nome : '(nessun documento)') + ' | dopo: ' + nome); } catch (e) {}
        }
      } catch (e) { await __es.fine(ERRORI.caricamento_fallito, false); }
      delete inCaricamento[aut];
      renderRighe(); decoraRiepilogo();
    };
    inp.click();
  }

  async function rimuoviFile(aut) {
    var d = docDi(aut);
    var ok = await conferma({ icona: '🗑️', titolo: 'Sei sicuro di voler rimuovere il documento?',
      testo: 'Stai per cancellare <strong>' + esc(d ? d.nome : 'il documento') + '</strong> dell\'autorizzazione <strong>"' + esc(aut) + '"</strong>.<br>Non si può annullare. Per salvare il profilo dovrai caricarne un altro, oppure togliere questa autorizzazione.',
      si: 'Sì, sono sicuro', no: 'No, annulla' });
    if (!ok) return;
    var __er = window.ectEsito('Rimozione del documento…');
    inCaricamento[aut] = true; renderRighe();
    var tenere = documenti.map(function (d) { return d.autorizzazione; }).filter(function (a) { return a !== aut; });
    var r = await chiamaDoc('allinea', { autorizzazioni: tenere }).catch(function () { return null; });
    await __er.fine(r && r.ok ? 'Documento rimosso' : 'Non sono riuscito a togliere il documento, riprova tra un momento.', !!(r && r.ok));
    if (r && r.ok) {
      documenti = r.documenti || [];
      try { registraAttivita('Modifica Dati', 'Cambio dati: Documento ' + aut, 'prima: ' + (d ? d.nome : 'documento') + ' | dopo: (rimosso)'); } catch (e) {}
    }
    delete inCaricamento[aut];
    renderRighe(); decoraRiepilogo();
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
  var cacheDocAz = {};
  function eImmagine(d) { return /^image\//.test(d.tipo || '') || /\.(png|jpe?g|gif|webp|svg)$/i.test(d.nome || '') || /^data:image\//.test(d.url || ''); }
  function apriBloccato() { alert('Il browser ha bloccato la finestra: consenti i pop-up per questo sito.'); }
  function finestraDoc(d, stampa) {
    if (!eImmagine(d)) {
      var w0 = window.open(d.url, '_blank');
      if (!w0) { apriBloccato(); return; }
      if (stampa) setTimeout(function () { alert('Il PDF si è aperto in una nuova scheda: per stamparlo usa il pulsante della stampante del visualizzatore (oppure Ctrl+P).'); }, 300);
      return;
    }
    var w = window.open('', '_blank');
    if (!w) { apriBloccato(); return; }
    w.document.write('<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>' + esc(d.autorizzazione + ' - ' + d.nome) + '</title>' +
      '<style>body{margin:0;font-family:Arial,sans-serif;text-align:center;} h1{font-size:14px;margin:12px;} img{max-width:100%;max-height:92vh;} @media print{h1{margin:4px;} img{max-height:none;}}</style></head><body>' +
      '<h1>EcoTruckConnect - ' + esc(d.autorizzazione) + ' - ' + esc(d.nome) + '</h1><img id="i" src="' + esc(d.url) + '">' +
      (stampa ? '<script>var i=document.getElementById("i");function p(){setTimeout(function(){window.print();},200);}if(i.complete)p();else i.onload=p;<\/script>' : '') + '</body></html>');
    w.document.close();
  }
  window.ectApriDocAz = function (email, i, stampa) {
    var c = cacheDocAz[email]; if (!c || !c.docs[i]) return;
    finestraDoc(c.docs[i], !!stampa);
  };
  window.ectStampaTuttiDocAz = function (email) {
    var c = cacheDocAz[email]; if (!c || !c.docs.length) return;
    var imm = c.docs.filter(eImmagine), pdf = c.docs.filter(function (d) { return !eImmagine(d); });
    if (imm.length) {
      var w = window.open('', '_blank');
      if (!w) { apriBloccato(); return; }
      w.document.write('<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Documenti autorizzazioni</title><style>body{font-family:Arial,sans-serif;margin:16px;} .p{page-break-after:always;text-align:center;} img{max-width:100%;} h1{font-size:14px;}</style></head><body>' +
        imm.map(function (d) { return '<div class="p"><h1>' + esc(d.autorizzazione + ' - ' + d.nome) + '</h1><img src="' + esc(d.url) + '"></div>'; }).join('') +
        '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script></body></html>');
      w.document.close();
    }
    pdf.forEach(function (d) { window.open(d.url, '_blank'); });
    if (pdf.length) setTimeout(function () { alert('I documenti PDF si sono aperti in nuove schede: stampali dal visualizzatore (Ctrl+P).'); }, 400);
  };
  /* SCARICA (8/10/2026): al posto di Stampa nelle autorizzazioni del trasportatore. Se il browser non permette il download diretto, apre il file in una nuova scheda. */
  window.ectScaricaUrl = async function (url, nome) {
    var __ed = window.ectEsito('Preparo il file «' + (nome || 'documento') + '»…');
    if (!url || url === '#') { await __ed.fine('Anteprima: qui si scaricherebbe «' + (nome || 'documento') + '»', true); return; }
    try {
      var r = await fetch(url); if (!r.ok) throw new Error('http');
      var b = await r.blob(); var u = URL.createObjectURL(b);
      await __ed.fine('File ricevuto: ' + (nome || 'documento'), true);
      var a = document.createElement('a'); a.href = u; a.download = nome || 'documento'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 60000);
    } catch (e) {
      await __ed.fine('Apro il file in una nuova scheda', true);
      var w = window.open(url, '_blank'); if (!w) apriBloccato();
    }
  };
  window.ectScaricaDocAz = function (email, i) {
    var c = cacheDocAz[email]; if (!c || !c.docs[i]) return;
    window.ectScaricaUrl(c.docs[i].url, c.docs[i].nome);
  };
  window.ectScaricaTuttiDocAz = async function (email) {
    var c = cacheDocAz[email]; if (!c || !c.docs.length) return;
    for (var k = 0; k < c.docs.length; k++) { await window.ectScaricaUrl(c.docs[k].url, c.docs[k].nome); await new Promise(function (r) { setTimeout(r, 400); }); }
  };
  function htmlListaDoc(email, docs) {
    if (!docs.length) return '<span style="color:var(--muted);">' + (email === '__mio__' ? 'Non hai ancora caricato documenti: aggiungili in «Le mie autorizzazioni».' : 'Il trasportatore non ha ancora caricato documenti.') + '</span>';
    var bt = 'background:none;border:1px solid rgba(255,255,255,0.2);color:#e2e8f0;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;';
    var e = esc(email).replace(/'/g, '&#39;');
    return docs.map(function (d, i) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;">' +
        '<span><b style="color:#fff;">' + esc(d.autorizzazione || 'Documento') + '</b><br><span style="color:var(--muted);font-size:12px;">' + esc(d.nome) + '</span></span>' +
        '<span style="display:flex;gap:6px;">' +
        '<button type="button" style="' + bt + '" onclick="event.stopPropagation();ectApriDocAz(\'' + e + '\',' + i + ',false)">👁️ Vedi</button>' +
        '<button type="button" style="' + bt + '" onclick="event.stopPropagation();ectScaricaDocAz(\'' + e + '\',' + i + ')">⬇️ Scarica</button></span></div>';
    }).join('') + (docs.length > 1 ? '<button type="button" class="btn-cap" style="margin-top:10px;padding:6px 14px;font-size:12px;" onclick="event.stopPropagation();ectScaricaTuttiDocAz(\'' + e + '\')">⬇️ Scarica tutti i documenti</button>' : '') +
      '<div style="font-size:11px;color:var(--muted);margin-top:8px;">' + (email === '__mio__' ? 'Sono i documenti del tuo profilo: li vede anche l\'azienda di questo carico.' : 'Documenti caricati dal trasportatore: controllali prima di affidare il trasporto.') + '</div>';
  }
  async function caricaDocPer(email) {
    if (email === '__mio__') {
      var r0 = await chiamaDoc('elenco').catch(function () { return null; });
      if (r0 && r0.ok) { documenti = r0.documenti || []; docsCaricati = true; }
      if (anteprima() && r0 && r0.ok && !r0.documenti.length) return { ok: true, documenti: [{ autorizzazione: 'Conto Terzi', nome: 'licenza-esempio.png', url: docEsempio('Conto Terzi'), tipo: 'image/png' }] };
      return r0;
    }
    return await chiamaDoc('documenti_trasportatore', { email_trasportatore: email }).catch(function () { return null; });
  }
  function emailBox(f) {
    if (!f || String(f.stato || '').toUpperCase() !== 'PRESO') return '';
    if (tipo() === 'trasportatore') return '__mio__';
    var e = tipo() === 'azienda' && (f.trasportatore_email || f.bloccato_da_id);
    return e && /@/.test(e) ? e : '';
  }
  function htmlStampaDoc(email) {
    var c = cacheDocAz[email];
    var titolo = email === '__mio__' ? 'Le mie autorizzazioni' : 'Autorizzazioni del trasportatore';
    if (!c) return '';
    var corpo = c.docs.length ? c.docs.map(function (d) {
      return '<div style="margin:8px 0;page-break-inside:avoid;"><b>' + esc(d.autorizzazione || 'Documento') + '</b> - ' + esc(d.nome) +
        (eImmagine(d) ? '<br><img src="' + esc(d.url) + '" style="max-width:100%;max-height:340px;margin-top:6px;border:1px solid #ccc;">' : ' <i>(PDF: si stampa a parte dal portale)</i>') + '</div>';
    }).join('') : '<i>Nessun documento caricato.</i>';
    return '<div style="padding:10px;border:1px solid #ccc;border-radius:8px;margin-top:10px;"><b>📎 ' + titolo + '</b>' + corpo + '</div>';
  }
  async function riempiBoxDoc() {
    var boxes = document.querySelectorAll('.ect-doc-box:not([data-caricato])');
    for (var k = 0; k < boxes.length; k++) {
      var box = boxes[k]; box.setAttribute('data-caricato', '1');
      var email = box.getAttribute('data-email');
      var lista = box.querySelector('.ect-doc-lista');
      var c = cacheDocAz[email];
      if (!c || Date.now() - c.quando > 30 * 60 * 1000) {
        lista.innerHTML = '<span style="color:var(--muted);">⏳ Carico i documenti…</span>';
        var r = await caricaDocPer(email);
        if (!r || !r.ok) { lista.innerHTML = '<span style="color:#f87171;">Documenti non disponibili in questo momento.</span>'; box.removeAttribute('data-caricato'); continue; }
        c = cacheDocAz[email] = { docs: r.documenti || [], quando: Date.now() };
      }
      document.querySelectorAll('.ect-doc-box').forEach(function (b) {
        if (b.getAttribute('data-email') === email) { b.setAttribute('data-caricato', '1'); b.querySelector('.ect-doc-lista').innerHTML = htmlListaDoc(email, c.docs); }
      });
    }
  }
  var inStampa = false;
  if (typeof window.cpScheda === 'function') {
    var origScheda = window.cpScheda;
    window.cpScheda = function (f) {
      var html = origScheda.apply(this, arguments);
      try {
        var email = emailBox(f);
        if (email) {
          if (inStampa) return html + htmlStampaDoc(email);
          html += '<div class="ect-doc-box" data-email="' + esc(email) + '" style="padding:14px;border:1px solid var(--border);border-radius:10px;margin-top:12px;font-size:13px;">' +
            '<div style="font-weight:700;color:#fff;margin-bottom:6px;">📎 ' + (email === '__mio__' ? 'Le tue autorizzazioni per questo trasporto' : 'Autorizzazioni del trasportatore') + '</div>' +
            '<div class="ect-doc-lista"></div></div>';
          setTimeout(riempiBoxDoc, 0);
        }
      } catch (e) {}
      return html;
    };
  }
  /* la stampa dei carichi presi include anche le autorizzazioni */
  if (typeof window.cpStampa === 'function') {
    var origStampa = window.cpStampa;
    window.cpStampa = async function (indici) {
      try {
        var lista = cpLista().lista;
        var scelti = (indici && indici.length) ? indici.map(function (i) { return lista[i]; }).filter(Boolean) : lista;
        var email = {};
        scelti.forEach(function (c) { var e = emailBox(c.fields); if (e) email[e] = 1; });
        var daCaricare = Object.keys(email).filter(function (e) { var c = cacheDocAz[e]; return !c || Date.now() - c.quando > 30 * 60 * 1000; });
        for (var k = 0; k < daCaricare.length; k++) {
          var r = await caricaDocPer(daCaricare[k]);
          if (r && r.ok) cacheDocAz[daCaricare[k]] = { docs: r.documenti || [], quando: Date.now() };
        }
      } catch (e) {}
      inStampa = true;
      try { return origStampa.apply(this, arguments); } finally { inStampa = false; }
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
  /* =====================================================================
     6) SUGGERIMENTI SU TUTTI I CAMPI (7/10/2026)
     Aggiunge i suggerimenti dove mancavano: CAP, indirizzi (completati con
     CAP e citta'), provincia, destinatario, telefono, specifica, note.
     Non toglie nulla di quello che c'era. Riusa la stessa tendina di index.html.
     ===================================================================== */
  (function () {
    if (typeof ECT_SUGG === 'undefined') return;
    var capLista = null;
    function peso(prov) {
      var p = provinciaUtente(); if (!p || !prov) return 3;
      if (prov === p) return 0; return REGIONE[prov] && REGIONE[prov] === REGIONE[p] ? 1 : 2;
    }
    function elencoCap() {
      if (capLista) return capLista;
      var tab = window.ECT_CAP; if (!tab) return [];
      var out = [];
      Object.keys(tab).forEach(function (cap) {
        var v = Array.isArray(tab[cap]) ? tab[cap] : [tab[cap]];
        var p = v.map(function (x) { return String(x).split('|'); });
        out.push({ testo: cap, nota: p.slice(0, 2).map(function (x) { return x[0] + (x[1] ? ' ' + x[1] : ''); }).join(', ') + (p.length > 2 ? '…' : ''),
                   citta: p[0][0], prov: p[0][1] || '', w: Math.min.apply(null, p.map(function (x) { return peso(x[1]); })) });
      });
      out.sort(function (a, b) { return (a.w - b.w) || (a.testo < b.testo ? -1 : 1); });
      return (capLista = out);
    }
    function val(id) { var e = document.getElementById(id); return e ? String(e.value || '').trim() : ''; }
    function provDa(cap, citta) {
      var v = window.ECT_CAP && window.ECT_CAP[cap]; if (!v) return '';
      v = Array.isArray(v) ? v : [v];
      var m = v.map(function (x) { return String(x).split('|'); });
      var g = m.filter(function (x) { return x[0].toLowerCase() === String(citta || '').toLowerCase(); })[0] || m[0];
      return g[1] || '';
    }
    var TIPI_VIA = ['Via', 'Viale', 'Piazza', 'Piazzale', 'Corso', 'Largo', 'Strada', 'Strada Statale', 'Contrada', 'Località', 'Zona Industriale'];
    function indirizzo(idCampo, idCap, idCitta, storico) {
      return function () {
        var q = val(idCampo), out = [];
        var cap = val(idCap), citta = val(idCitta), prov = provDa(cap, citta);
        var coda = [cap, citta].filter(Boolean).join(' ') + (prov && citta ? ' (' + prov + ')' : '');
        if (q.length >= 3 && /\d/.test(q) && coda && q.toLowerCase().indexOf(String(citta || cap).toLowerCase()) === -1) {
          out.push({ testo: q.replace(/[,\s]+$/, '') + ', ' + coda, nota: 'completa con CAP e città' });
        }
        if (q.length <= 9 && !/\s/.test(q)) TIPI_VIA.forEach(function (t) { out.push({ testo: t + ' ', nota: 'tipo di via' }); });
        var base = []; try { base = storico() || []; } catch (e) {}
        return out.concat(base);
      };
    }
    var vecchioRitiro = ECT_SUGG['ins-indirizzo-ritiro'] && ECT_SUGG['ins-indirizzo-ritiro'].fonte;
    var vecchioConsegna = ECT_SUGG['ins-indirizzo-consegna'] && ECT_SUGG['ins-indirizzo-consegna'].fonte;
    ECT_SUGG['ins-indirizzo-ritiro'] = { min: 2, fonte: indirizzo('ins-indirizzo-ritiro', 'ins-cap-part', 'ins-citta-part', vecchioRitiro || function () { return []; }) };
    ECT_SUGG['ins-indirizzo-consegna'] = { min: 2, fonte: indirizzo('ins-indirizzo-consegna', 'ins-cap-arr', 'ins-citta-arr', vecchioConsegna || function () { return []; }) };
    ECT_SUGG['dd-via'] = { min: 2, fonte: indirizzo('dd-via', 'dd-cap', 'dd-citta', function () { return []; }) };

    function sceltoCap(idCitta, idProv) {
      return function (s) {
        var c = document.getElementById(idCitta); if (c && s.citta) c.value = s.citta;
        var p = idProv && document.getElementById(idProv); if (p && s.prov) p.value = s.prov;
      };
    }
    ECT_SUGG['ins-cap-part'] = { min: 2, fonte: elencoCap, scelto: sceltoCap('ins-citta-part') };
    ECT_SUGG['ins-cap-arr'] = { min: 2, fonte: elencoCap, scelto: sceltoCap('ins-citta-arr') };
    ECT_SUGG['dd-cap'] = { min: 2, fonte: elencoCap, scelto: sceltoCap('dd-citta', 'dd-provincia') };
    ECT_SUGG['cap-temp-input'] = { min: 2, fonte: elencoCap };
    ECT_SUGG['dd-provincia'] = { min: 1, fonte: function () { return Object.keys(REGIONE).sort().map(function (p) { return { testo: p, nota: '' }; }); },
      scelto: function () {} };

    var vecchioDest = ECT_SUGG['ins-destinatario-nome'] && ECT_SUGG['ins-destinatario-nome'].fonte;
    if (vecchioDest) ECT_SUGG['ins-destinatario-nome'].fonte = function () {
      var base = []; try { base = vecchioDest() || []; } catch (e) {}
      var nome = ''; try { nome = profiloAzienda && profiloAzienda.nome; } catch (e) {}
      return base.concat(nome ? [{ testo: nome, nota: 'la tua azienda', tel: (profiloAzienda && profiloAzienda.telefono) || '' }] : []);
    };
    ECT_SUGG['ins-destinatario-telefono'] = { min: 3, fonte: function () {
      var lista = [];
      try { (typeof ectMieiCarichi === 'function' ? ectMieiCarichi() : []).forEach(function (c) { if (c.fields.destinatario_telefono) lista.push({ testo: c.fields.destinatario_telefono, nota: c.fields.destinatario_nome || 'già usato' }); }); } catch (e) {}
      try { if (profiloAzienda && profiloAzienda.telefono) lista.push({ testo: profiloAzienda.telefono, nota: 'il tuo numero' }); } catch (e) {}
      return ectUnici(lista);
    } };
    var vecchioSpec = ECT_SUGG['ins-specifica'] && ECT_SUGG['ins-specifica'].fonte;
    ECT_SUGG['ins-specifica'] = { min: 2, fonte: function () {
      var base = []; try { base = vecchioSpec ? vecchioSpec() : []; } catch (e) {}
      return base.concat(['Pallet 120x80', 'Colli su pallet', 'Merce sfusa', 'Big bag', 'Rotoli', 'Cassette', 'Materiale in cassone', 'Container'].map(function (t) { return { testo: t, nota: 'esempio' }; }));
    } };
    ECT_SUGG['ins-note'] = { min: 3, fonte: function () {
      return ['Ritiro solo la mattina', 'Ritiro solo il pomeriggio', 'Serve sponda idraulica', 'Merce da non capovolgere', 'Peso approssimativo: '].map(function (t) { return { testo: t, nota: 'esempio' }; });
    } };

    function attiva() { try { ectAttivaSuggerimenti(); } catch (e) {} }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attiva); else attiva();
  })();
  /* =====================================================================
     7) DOCUMENTI DELL'AZIENDA PER IL TRASPORTATORE — SOLO ANTEPRIMA AZIENDA (7/10/2026)
     Nella scheda del carico PRESO (azienda finta) compare "Documenti vari e
     autorizzazioni" con "Carica". Facoltativo. Nel portale vero NON compare
     niente. In anteprima i file restano solo nel browser (nessuna chiamata).
     ===================================================================== */
  var DOC_AZ_CHIAVE = 'ect_prev_docs_azienda_v1';
  var docAz = {};
  try { docAz = JSON.parse(localStorage.getItem(DOC_AZ_CHIAVE) || '{}') || {}; } catch (e) { docAz = {}; }
  function docAzSalva() {
    try {
      var leggero = {};
      Object.keys(docAz).forEach(function (k) { leggero[k] = (docAz[k] || []).filter(function (d) { return String(d.url || '').length < 1200000; }); });
      localStorage.setItem(DOC_AZ_CHIAVE, JSON.stringify(leggero));
    } catch (e) {}
  }
  function docAzChiave(f) { return String(f.numero_ordine || f.richiesta_id || ((f.citta_partenza || '') + '>' + (f.citta_arrivo || ''))); }
  var BT_DOC = 'background:none;border:1px solid rgba(255,255,255,0.2);color:#cbd5e1;border-radius:8px;padding:5px 10px;font-size:12px;cursor:pointer;';
  var CHIAVE_FORM = 'nuovo-carico', CHIAVE_PUBBLICATI = 'pubblicati';
  function docAzHtml(key) {
    var docs = docAz[key] || [];
    var righe = docs.map(function (d, i) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;">' +
        '<span style="color:#4ade80;font-size:13px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">✅ ' + esc(d.nome) + '</span>' +
        '<span style="display:flex;gap:6px;flex-wrap:wrap;">' +
        '<button type="button" style="' + BT_DOC + '" data-az-vedi="' + i + '">👁️ Vedi</button>' +
        '<button type="button" style="' + BT_DOC + '" data-az-sost="' + i + '">Sostituisci</button>' +
        '<button type="button" style="' + BT_DOC + 'border-color:rgba(239,68,68,0.5);color:#fca5a5;" data-az-rim="' + i + '">Rimuovi</button></span></div>';
    }).join('');
    return '<div class="ect-az-docs" data-key="' + esc(key) + '" style="max-width:520px;margin-top:6px;font-size:13px;">' +
      righe +
      '<button type="button" class="btn-cap" data-az-carica style="margin-top:10px;padding:8px 18px;font-size:13px;">\ud83d\udcce Carica file</button>' +
      '<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" style="display:none;"></div>';
  }
  var docTrasp = [];
  function docTraspHtml() {
    var tutti = [];
    (docAz[CHIAVE_PUBBLICATI] || []).forEach(function (d) { tutti.push(d); });
    if (!tutti.length) tutti = [{ nome: 'autorizzazione-trasporto-esempio.png', tipo: 'image/png', url: docEsempio('Autorizzazione di trasporto') }];
    docTrasp = tutti;
    return '<div class="ect-tr-docs" style="padding:14px;border:1px solid var(--border);border-radius:10px;margin-top:12px;font-size:13px;">' +
      '<div style="font-weight:700;color:#fff;margin-bottom:6px;">📎 Documenti dell\'azienda</div>' +
      tutti.map(function (d, i) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;">' +
          '<span style="color:#4ade80;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">✅ ' + esc(d.nome) + '</span>' +
          '<button type="button" style="' + BT_DOC + '" data-tr-vedi="' + i + '">👁️ Vedi</button></div>';
      }).join('') + '</div>';
  }
  function docAzLeggi(blob) {
    return new Promise(function (ok, ko) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result)); }; fr.onerror = function () { ko(new Error('lettura')); }; fr.readAsDataURL(blob); });
  }
  function docAzScegli(box, key, indice) {
    var inp = box.querySelector('input[type=file]'); if (!inp) return;
    inp.value = ''; inp.multiple = indice < 0; inp.setAttribute('data-indice', String(indice));
    inp.click();
  }
  document.addEventListener('change', async function (e) {
    var inp = e.target; if (!inp || !inp.closest || inp.type !== 'file') return;
    var box = inp.closest('.ect-az-docs'); if (!box) return;
    var key = box.getAttribute('data-key'), indice = Number(inp.getAttribute('data-indice') || -1);
    var files = Array.from(inp.files || []); if (!files.length) return;
    var lista = docAz[key] = docAz[key] || [];
    var __ea = window.ectEsito(files.length > 1 ? 'Caricamento di ' + files.length + ' file…' : 'Caricamento di «' + files[0].name + '»…');
    var __n = 0;
    for (var k = 0; k < files.length; k++) {
      var f = files[k];
      var tipoFile = f.type || (/\.pdf$/i.test(f.name) ? 'application/pdf' : '');
      if (!TIPI_OK[tipoFile]) { alert(ERRORI.tipo_non_ammesso); continue; }
      var blob = f, nome = f.name;
      if (f.size > MAX_BYTE) {
        if (tipoFile === 'application/pdf') { alert(ERRORI.file_troppo_grande); continue; }
        blob = await comprimiImmagine(f);
        if (!blob || blob.size > MAX_BYTE) { alert(ERRORI.file_troppo_grande); continue; }
        tipoFile = 'image/jpeg'; nome = nome.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
      }
      var url = '';
      try { url = await docAzLeggi(blob); } catch (er) { alert(ERRORI.caricamento_fallito); continue; }
      var nuovo = { nome: nome, tipo: tipoFile, url: url };
      if (indice >= 0 && lista[indice]) lista[indice] = nuovo; else lista.push(nuovo);
      __n++;
    }
    await __ea.fine(__n ? (__n > 1 ? __n + ' file caricati' : 'File caricato: ' + files[0].name) : 'Nessun file caricato', __n > 0);
    docAzSalva();
    var vivo = document.querySelector('.ect-az-docs[data-key="' + key.replace(/"/g, '\\"') + '"]');
    if (vivo) vivo.outerHTML = docAzHtml(key);
  });
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var box = t.closest('.ect-az-docs'), trb = t.closest('.ect-tr-docs');
    if (!box && !trb) return;
    e.stopPropagation();
    var b = t.closest('button'); if (!b) return;
    if (trb) {
      var d0 = docTrasp[Number(b.getAttribute('data-tr-vedi'))];
      if (d0) finestraDoc({ url: d0.url, tipo: d0.tipo, nome: d0.nome, autorizzazione: 'Documenti dell\'azienda' }, false);
      return;
    }
    e.preventDefault();
    var key = box.getAttribute('data-key'), lista = docAz[key] = docAz[key] || [];
    if (b.hasAttribute('data-az-carica')) return docAzScegli(box, key, -1);
    if (b.hasAttribute('data-az-vedi')) {
      var d = lista[Number(b.getAttribute('data-az-vedi'))];
      if (d) finestraDoc({ url: d.url, tipo: d.tipo, nome: d.nome, autorizzazione: 'Documenti vari e autorizzazioni' }, false);
      return;
    }
    if (b.hasAttribute('data-az-sost')) {
      var i = Number(b.getAttribute('data-az-sost')), dd = lista[i]; if (!dd) return;
      conferma({ icona: '🔄', colore: 'blu', titolo: 'Vuoi sostituire il documento?',
        testo: 'Hai già caricato <strong>' + esc(dd.nome) + '</strong>.<br>Se vai avanti, il file attuale viene cancellato e al suo posto va quello nuovo che scegli adesso.',
        si: 'Sì, sostituisci', no: 'No, lascia così' }).then(function (ok) { if (ok) docAzScegli(box, key, i); });
      return;
    }
    if (b.hasAttribute('data-az-rim')) {
      var j = Number(b.getAttribute('data-az-rim')), dr = lista[j]; if (!dr) return;
      conferma({ icona: '🗑️', titolo: 'Sei sicuro di voler rimuovere il documento?',
        testo: 'Stai per cancellare <strong>' + esc(dr.nome) + '</strong>. Non si può annullare.', si: 'Sì, sono sicuro', no: 'No, annulla' }).then(function (ok) {
        if (!ok) return;
        lista.splice(j, 1); docAzSalva();
        var vivo = document.querySelector('.ect-az-docs[data-key="' + key.replace(/"/g, '\\"') + '"]'); if (vivo) vivo.outerHTML = docAzHtml(key);
      });
    }
  }, true);
  /* aggancio alla scheda del carico preso (solo anteprima) */
  if (typeof window.cpScheda === 'function') {
    var cpSchedaPrimaDocAz = window.cpScheda;
    window.cpScheda = function (f) {
      var html = cpSchedaPrimaDocAz.apply(this, arguments);
      try {
        if (!inStampa && anteprima() && f && String(f.stato || '').toUpperCase() === 'PRESO') {
          if (tipo() === 'trasportatore') html += docTraspHtml();
        }
      } catch (e) {}
      return html;
    };
  }
  /* box nel modulo "Pubblica un trasporto", sotto "Autorizzazione richiesta al trasportatore" (solo anteprima azienda) */
  function docAzNelModulo() {
    if (!anteprima() || tipo() !== 'azienda') return;
    var tags = document.getElementById('tags-autRichiesta');
    if (!tags || document.getElementById('docs-az-modulo')) return;
    var w = document.createElement('div');
    w.id = 'docs-az-modulo';
    w.innerHTML = '<h4 style="margin-top:20px;color:#fff;font-family:var(--font-h);">Documenti e autorizzazioni <span style="font-weight:400;font-size:13px;color:var(--muted);">(facoltativo)</span></h4>' + docAzHtml(CHIAVE_FORM);
    tags.insertAdjacentElement('afterend', w);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(docAzNelModulo, 0); });
  else setTimeout(docAzNelModulo, 0);
  /* dopo "Pubblica" riuscita i file passano al carico pubblicato e il modulo si svuota */
  if (typeof window.pubblicaCarico === 'function') {
    var pubblicaPrimaDocAz = window.pubblicaCarico;
    window.pubblicaCarico = async function () {
      var r = await pubblicaPrimaDocAz.apply(this, arguments);
      try {
        if (anteprima() && tipo() === 'azienda') {
          var campo = document.getElementById('ins-citta-part');
          if (campo && !campo.value && (docAz[CHIAVE_FORM] || []).length) {
            docAz[CHIAVE_PUBBLICATI] = (docAz[CHIAVE_PUBBLICATI] || []).concat(docAz[CHIAVE_FORM]);
            docAz[CHIAVE_FORM] = []; docAzSalva();
            var vivo = document.querySelector('.ect-az-docs[data-key="' + CHIAVE_FORM + '"]'); if (vivo) vivo.outerHTML = docAzHtml(CHIAVE_FORM);
          }
        }
      } catch (e) {}
      return r;
    };
  }
})();
