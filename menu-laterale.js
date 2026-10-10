/* =====================================================================
   EcoTruckConnect — menu-laterale.js (10/10/2026)
   Menu a sinistra del portale (trasportatore e azienda), valido sia per
   l'anteprima finta (?preview=...) sia per il portale reale.

   COME FUNZIONA (non riscrive nulla di esistente):
   - Una voce del menu = una pagina. La pagina mostra SOLO i blocchi che
     gia' esistono nel portale (carichi, calendario, storico, dati, ...).
   - Per aprire le sezioni della vecchia Dashboard chiama apriDashSezione().
   - Barra in alto, campanella, Esci: NON toccati.
   - Il vecchio menu "Dashboard ▾" in alto viene solo nascosto.
   - Interruttore di sicurezza: aggiungi ?menu=classico all'indirizzo
     (oppure scrivi nella console: localStorage.ect_menu_classico='1')
     e torna il menu di prima.
   Caricato in fondo a index.html, DOPO tutti gli altri script.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__ECT_MENU_LATERALE__) return;
  window.__ECT_MENU_LATERALE__ = true;

  /* ---------- interruttore di sicurezza ---------- */
  try {
    var q = new URLSearchParams(location.search).get('menu');
    if (q === 'classico') localStorage.setItem('ect_menu_classico', '1');
    if (q === 'laterale') localStorage.removeItem('ect_menu_classico');
    if (localStorage.getItem('ect_menu_classico') === '1') return;
  } catch (e) {}

  /* ---------- utilita' ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function tipo() { try { return tipoUtente || ''; } catch (e) { return ''; } }
  function memoria(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }

  /* ---------- blocchi gestiti (nascosti/mostrati con la classe ms-off) ---------- */
  var CONTENITORI = ['hero-personale', 'riquadro-profilo-trasp', 'cap-bar-section', 'sezione-dashboard',
    'sezione-profilo-trasportatore', 'sezione-azienda', 'contenuto-normale-portale', 'ms-tg', 'ms-isc'];
  var BLOCCHI = ['carichi-disponibili-wrap', 'calendario-carichi-wrap', 'cards-riepilogo-wrap', 'cards-riepilogo-azienda',
    'carichi-presi-wrap', 'rs-wrap', 'report-trasportatore-wrap', 'storico-sec-head', 'ms-storico-box', 'faq-box', 'ms-assist'];

  /* ---------- le pagine ----------
     c: 'home' | 'normale' | 'dash' | 'profilo' | 'azienda' | 'tg'
     blocchi: quali blocchi di contenuto-normale-portale mostrare
     dash: quale sezione della vecchia Dashboard aprire
     part: 'mezzi' | 'aut' (la scheda profilo e' una sola: la divido in due pagine)  */
  var PAG = {
    home:     { c: 'home', t: 'Dashboard', d: 'La tua pagina iniziale: i numeri di oggi e cosa fare adesso.' },
    dati:     { c: 'dash', dash: 'dati', t: 'I miei dati (modifica)', d: 'I tuoi dati di anagrafica (nome, indirizzo, telefono, P.IVA). Scrivi solo quello che vuoi cambiare. Qui puoi anche caricare i tuoi file facoltativi.' },
    mezzi:    { c: 'profilo', part: 'tutto', t: 'Mezzi e autorizzazioni', d: 'Indica i mezzi che possiedi e le autorizzazioni che hai: è la prima cosa da fare. Perché? Quando un’azienda pubblica un carico indica il mezzo e le autorizzazioni che servono, e il carico lo vedi solo se hai proprio quel mezzo e quelle autorizzazioni: così non perdi tempo con carichi che non puoi fare. Per ogni autorizzazione puoi caricare il documento (PDF, JPG o PNG, max 4 MB), scaricarlo o rimuoverlo. Puoi modificare tutto quando vuoi.' },
    tg:       { c: 'tg', t: 'Telegram', d: 'Collega il tuo Telegram per ricevere i nuovi carichi sul telefono, in privato. Si fa una volta sola.' },
    carichi:  { c: 'normale', blocchi: ['carichi-disponibili-wrap'], cap: true, t: 'Carichi disponibili', d: 'I carichi liberi nella tua zona, pronti da prendere. Premi «Vedi dettagli» per tutti i dati prima di decidere.' },
    presi:    { c: 'normale', dl: 1, blocchi: ['carichi-presi-wrap'], t: 'Carichi presi', d: 'I carichi che hai preso, con la scheda completa: azienda, indirizzi, orari e documenti ricevuti dall’azienda (che puoi scaricare).' },
    cal:      { c: 'normale', blocchi: ['calendario-carichi-wrap'], t: 'Calendario', d: 'I carichi giorno per giorno. Blu = disponibile, arancione = in pagamento, rosso = preso. Clicca un giorno per vedere i carichi.' },
    inc:      { c: 'normale', dl: 1, blocchi: ['rs-wrap'], t: 'Da incassare', d: 'Quanto devi ancora incassare dalle aziende, diviso per azienda e per giorno. Puoi scaricare il PDF e il CSV.' },
    fatture:  { c: 'dash', dl: 1, dash: 'fatture', t: 'Commissioni da €20', d: 'Una riga per ogni carico preso, con data, ora e commissione da €20. È un riepilogo: non sostituisce la fattura fiscale.' },
    isc:      { c: 'isc', dl: 1, t: 'Iscrizione annuale €150', d: 'La quota annuale è separata dalle commissioni: qui trovi quando inizia e quando scade.' },
    storico:  { c: 'normale', dl: 1, blocchi: ['storico-sec-head', 'ms-storico-box'], t: 'Storico carichi', d: 'Tutti i carichi dall’inizio, con stato e commissione. Filtra per periodo e scarica.' },
    movimenti:{ c: 'dash', dl: 1, dash: 'storico', t: 'Il mio storico movimenti', d: 'Tutto quello che hai fatto sulla piattaforma con data e ora: cambi dati, documenti, password, carichi.' },
    report:   { c: 'dash', dl: 1, dash: 'report', t: 'I miei report', d: 'I tuoi numeri riassunti: carichi, periodi e totali.' },
    notifiche:{ c: 'dash', dash: 'notifiche', t: 'Notifiche e suoni', d: 'Scegli cosa ricevere, in quali orari e con quale tono. Qui colleghi anche Telegram.' },
    faq:      { c: 'normale', blocchi: ['faq-box'], t: 'Domande frequenti', d: 'Le risposte alle domande più comuni. Clicca una domanda per aprirla.' },
    scrivici: { c: 'normale', blocchi: ['ms-assist'], t: 'Scrivici', d: 'Hai bisogno di una persona? Scrivi qui, ti rispondiamo entro 24 ore. Oppure usa il bot 🤖 in basso a destra per una risposta subito.' },
    sicurezza:{ c: 'dash', dash: 'sicurezza', t: 'Sicurezza', d: 'Password e accesso: puoi rigenerare la password, attivare Google Authenticator o chiedere la cancellazione dell’account.' },
    /* solo azienda */
    pubblica: { c: 'azienda', part: 'tutto', t: 'Pubblica un trasporto', d: 'Tutto in un’unica pagina: carico, mezzo che serve, autorizzazioni che deve avere il trasportatore, ritiro e consegna, importo. Pubblicare è gratis. Impianto di destinazione e intermediario (solo rifiuti) li inserisci dopo, in Trasporti presi.' },
    azcal:    { c: 'dash', dash: 'overview', t: 'Calendario', d: 'Le tue pubblicazioni giorno per giorno. Clicca un giorno per vedere o inserire un carico.' },
    azpagare: { c: 'normale', dl: 1, blocchi: ['rs-wrap'], t: 'Da pagare', d: 'Quanto devi ai trasportatori, diviso per trasportatore e per giorno. Scarica per la fattura o il CSV.' },
    azreptr:  { c: 'normale', dl: 1, blocchi: ['report-trasportatore-wrap'], t: 'Report per trasportatore', d: 'Un riquadro per ogni trasportatore, con i trasporti presi e l’importo pattuito.' },
    azstorico:{ c: 'normale', dl: 1, blocchi: ['storico-sec-head', 'ms-storico-box'], t: 'Storico pubblicazioni', d: 'Tutto quello che hai pubblicato, con stato e dettagli. Filtra per periodo e scarica.' }
  };

  /* testi diversi per l'azienda */
  var PAZ = {
    presi: { t: 'Trasporti presi', d: 'Chi ha preso i tuoi carichi: scheda completa del trasportatore, indirizzi e documenti che hai allegato.' },
    notifiche: { d: 'Scegli cosa ricevere (campanella ed email), in quali orari e con quale tono.' },
    dati: { d: 'I dati della tua azienda (ragione sociale, P.IVA, PEC, sede, telefono). Scrivi solo quello che vuoi cambiare. Qui puoi anche caricare i tuoi file facoltativi.' },
    report: { d: 'I tuoi numeri riassunti: pubblicazioni, trasporti presi e totali da pagare.' },
    fatture: { t: 'Riepilogo movimenti', d: 'Ogni tua pubblicazione con data, stato e trasportatore. È un riepilogo: non sostituisce la fattura fiscale.' }
  };
  function testo(nome) {
    var p = PAG[nome], o = (tipo() === 'azienda' && PAZ[nome]) || {};
    return { t: o.t || p.t, d: o.d || p.d };
  }

  /* ---------- il menu ---------- */
  var MENU = {
    trasportatore: [
      { id: 'home', t: 'Dashboard', i: '🏠', c: '148,163,184', e: 'La tua pagina iniziale' },
      { id: 'profilo', t: 'Profilo', i: '👤', c: '251,146,60', e: 'Mezzi, autorizzazioni, dati, Telegram', s: [['mezzi', 'Mezzi e autorizzazioni'], ['dati', 'I miei dati'], ['tg', 'Telegram']] },
      { id: 'carichi', t: 'Carichi', i: '🚛', c: '59,130,246', e: 'I carichi liberi da prendere', p: 'carichi' },
      { id: 'presi', t: 'Presi', i: '✅', c: '74,222,128', e: 'I carichi che hai già preso', p: 'presi' },
      { id: 'cal', t: 'Calendario', i: '📅', c: '244,114,182', e: 'I carichi giorno per giorno', p: 'cal' },
      { id: 'pag', t: 'Pagamenti', i: '💶', c: '251,191,36', e: 'Quanto incassare e commissioni', s: [['inc', 'Da incassare'], ['fatture', 'Commissioni da €20'], ['isc', 'Iscrizione €150']] },
      { id: 'arch', t: 'Archivio storico', i: '🗂️', c: '168,85,247', e: 'Tutto quello che è già successo', s: [['storico', 'Storico carichi'], ['movimenti', 'Il mio storico movimenti']] },
      { id: 'rep', t: 'Report', i: '📈', c: '45,212,191', e: 'I tuoi numeri riassunti', p: 'report' },
      { id: 'not', t: 'Avvisi e suoni', i: '📣', c: '250,204,21', e: 'Cosa ricevere e come', p: 'notifiche' },
      { id: 'aiuto', t: 'Aiuto', i: '❓', c: '125,211,252', e: 'Domande e assistenza', s: [['faq', 'Domande frequenti'], ['scrivici', 'Scrivici']] },
      { id: 'sic', t: 'Sicurezza', i: '🔒', c: '248,113,113', e: 'Password e accesso', p: 'sicurezza' }
    ],
    azienda: [
      { id: 'home', t: 'Dashboard', i: '🏠', c: '148,163,184', e: 'La tua pagina iniziale' },
      { id: 'pubblica', t: 'Pubblica', i: '📦', c: '59,130,246', e: 'Inserisci un nuovo carico', p: 'pubblica' },
      { id: 'profilo', t: 'Profilo', i: '👤', c: '251,146,60', e: 'I tuoi dati aziendali e i tuoi file', p: 'dati' },
      { id: 'cal', t: 'Calendario', i: '📅', c: '244,114,182', e: 'Le pubblicazioni giorno per giorno', p: 'azcal' },
      { id: 'presi', t: 'Trasporti presi', i: '✅', c: '74,222,128', e: 'Chi ha preso i tuoi carichi', p: 'presi' },
      { id: 'pag', t: 'Pagamenti', i: '💶', c: '251,191,36', e: 'Quanto pagare ai trasportatori', s: [['azpagare', 'Da pagare'], ['azreptr', 'Report per trasportatore'], ['isc', 'Iscrizione €150']] },
      { id: 'arch', t: 'Archivio storico', i: '🗂️', c: '168,85,247', e: 'Tutto quello che è già successo', s: [['azstorico', 'Storico pubblicazioni'], ['fatture', 'Riepilogo movimenti'], ['movimenti', 'Il mio storico movimenti']] },
      { id: 'rep', t: 'Report', i: '📈', c: '45,212,191', e: 'I tuoi numeri riassunti', p: 'report' },
      { id: 'not', t: 'Avvisi e suoni', i: '📣', c: '250,204,21', e: 'Cosa ricevere e come', p: 'notifiche' },
      { id: 'aiuto', t: 'Aiuto', i: '❓', c: '125,211,252', e: 'Domande e assistenza', s: [['faq', 'Domande frequenti'], ['scrivici', 'Scrivici']] },
      { id: 'sic', t: 'Sicurezza', i: '🔒', c: '248,113,113', e: 'Password e accesso', p: 'sicurezza' }
    ]
  };

  /* ---------- stato ---------- */
  var cur = null;            // pagina corrente
  var inGo = false;          // sto aprendo io una pagina (evita giri a vuoto)
  var pronto = false;
  var aperto = memoria('ect_menu_aperto') !== '0';   // desktop: aperto o stretto
  var drawer = false;        // tablet/telefono: cassetto aperto
  var voceAperta = null;     // voce con sotto-voci espansa

  function larghezza() { return window.innerWidth || document.documentElement.clientWidth || 1200; }
  function overlay() { return larghezza() <= 1100; }

  /* ---------- CSS ---------- */
  function stile() {
    if ($('ms-css')) return;
    var s = document.createElement('style'); s.id = 'ms-css';
    s.textContent = [
      '.ms-off{display:none!important;}',
      'body.ms-on #dash-nav-wrap{display:none!important;}',
      'body.ms-on #sezione-dashboard>div:first-child{display:none!important;}',
      'body.ms-on #app>.hero,body.ms-on #app>.main{margin-left:var(--ms-w,280px);transition:margin-left .2s;}',
      'body.ms-on.ms-overlay #app>.hero,body.ms-on.ms-overlay #app>.main{margin-left:0;}',
      '#ms-side{position:fixed;left:0;top:var(--ms-top,60px);bottom:0;width:var(--ms-w,280px);background:#0a111d;border-right:1px solid rgba(255,255,255,.09);z-index:150;display:none;flex-direction:column;transition:width .2s,transform .2s;overflow:hidden;}',
      'body.ms-on #ms-side{display:flex;}',
      'body.ms-on.ms-overlay #ms-side{width:min(86vw,320px);transform:translateX(-102%);box-shadow:0 0 60px rgba(0,0,0,.6);z-index:260;}',
      'body.ms-on.ms-overlay.ms-drawer #ms-side{transform:none;}',
      '#ms-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:255;display:none;}',
      'body.ms-on.ms-overlay.ms-drawer #ms-bg{display:block;}',
      '#ms-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px 8px;}',
      '#ms-top b{font-family:var(--font-h);font-size:12px;letter-spacing:.14em;color:rgba(241,245,249,.55);}',
      '#ms-tog{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:10px;width:36px;height:36px;font-size:16px;cursor:pointer;flex:none;}',
      '#ms-tog:hover{background:rgba(59,130,246,.25);}',
      '#ms-voci{flex:1;overflow-y:auto;padding:6px 10px 18px;}',
      '.ms-v{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;border:1px solid transparent;color:#e2e8f0;border-radius:14px;padding:11px 10px;cursor:pointer;font-family:var(--font-b);margin-bottom:3px;}',
      '.ms-v:hover{background:rgba(255,255,255,.06);}',
      '.ms-v.on{background:rgba(59,130,246,.16);border-color:rgba(59,130,246,.45);}',
      '.ms-ic{flex:none;width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:21px;}',
      '.ms-tx{min-width:0;flex:1;}',
      '.ms-tx b{display:block;font-size:15px;font-weight:700;color:#fff;line-height:1.2;}',
      '.ms-tx small{display:block;font-size:11.5px;color:rgba(241,245,249,.5);line-height:1.3;margin-top:2px;}',
      '.ms-ch{flex:none;font-size:11px;color:rgba(241,245,249,.5);transition:transform .15s;}',
      '.ms-v.open .ms-ch{transform:rotate(90deg);}',
      '.ms-subs{margin:2px 0 8px 26px;padding-left:14px;border-left:2px solid rgba(255,255,255,.1);}',
      '.ms-s{display:block;width:100%;text-align:left;background:transparent;border:0;color:#cbd5e1;font-family:var(--font-b);font-size:14px;padding:9px 10px;border-radius:9px;cursor:pointer;}',
      '.ms-s:hover{background:rgba(255,255,255,.06);}',
      '.ms-s.on{background:rgba(59,130,246,.2);color:#fff;font-weight:700;}',
      /* menu stretto (solo icone) su computer */
      'body.ms-on:not(.ms-overlay).ms-stretto{--ms-w:76px;}',
      'body.ms-on:not(.ms-overlay).ms-stretto .ms-tx,body.ms-on:not(.ms-overlay).ms-stretto .ms-ch,body.ms-on:not(.ms-overlay).ms-stretto .ms-subs,body.ms-on:not(.ms-overlay).ms-stretto #ms-top b{display:none;}',
      'body.ms-on:not(.ms-overlay).ms-stretto .ms-v{justify-content:center;padding:8px 0;}',
      'body.ms-on:not(.ms-overlay).ms-stretto #ms-top{justify-content:center;}',
      /* pulsante "Menu" per tablet e telefono */
      '#ms-fab{position:fixed;left:12px;top:calc(var(--ms-top,60px) + 10px);z-index:140;display:none;align-items:center;gap:8px;background:#1d4ed8;color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:14px;padding:10px 16px;font-family:var(--font-b);font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45);}',
      'body.ms-on.ms-overlay #ms-fab{display:flex;}',
      'body.ms-on.ms-overlay #app>.main{padding-top:64px;}',
      'body.ms-on.ms-overlay #app>.hero{padding-top:84px;}',
      /* riga titolo pagina */
      '#ms-intro{display:none;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:0 0 20px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09);}',
      'body.ms-on #ms-intro{display:flex;}',
      '#ms-intro h2{font-family:var(--font-h);font-size:22px;color:#fff;margin:0 0 4px;}',
      '#ms-intro p{font-size:13.5px;line-height:1.55;color:rgba(241,245,249,.65);max-width:760px;margin:0;}',
      '#ms-intro .ms-st{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.15);color:#fff;border-radius:10px;padding:8px 14px;font-size:13px;cursor:pointer;font-family:var(--font-b);}',
      /* pagina Telegram */
      'body[data-ms-part="mezzi"] #docs-aut{display:none!important;}',
      'body[data-ms-azpart]:not([data-ms-azpart="aut"]):not([data-ms-azpart="tutto"]) #docs-az-modulo{display:none!important;}',
      '#ms-rapide{display:none;margin:0 0 22px;}',
      'body.ms-on #ms-rapide{display:block;}',
      '#ms-rapide .ms-rt{font-family:var(--font-h);font-size:16px;color:#fff;margin-bottom:10px;}',
      '#ms-rapide .ms-rb{display:flex;gap:12px;flex-wrap:wrap;}',
      '#ms-rapide button{display:flex;align-items:center;gap:10px;background:rgba(59,130,246,.14);border:1px solid rgba(59,130,246,.45);color:#fff;border-radius:14px;padding:14px 20px;font-size:15px;font-weight:700;cursor:pointer;font-family:var(--font-b);}',
      '#ms-rapide button span{font-size:22px;}',
      '#ms-rapide button:hover{background:rgba(59,130,246,.28);}',
      '#ms-tg #ect-qr-tg{display:none!important;}',
      '#ms-tg,#ms-isc{display:none;}',
      '.ms-isc-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0;}',
      '.ms-isc-c{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;}',
      '.ms-isc-c small{display:block;color:rgba(241,245,249,.6);font-size:12px;margin-bottom:4px;}',
      '.ms-isc-c b{font-size:18px;color:#fff;}',
      '.ms-pg{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 14px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);font-size:13px;color:#e2e8f0;}',
      '.ms-pg .ms-sp{flex:1 1 10px;}',
      '.ms-pg .ms-info{flex:1 1 100%;color:rgba(241,245,249,.65);font-size:12px;}',
      '.ms-pg label{display:inline-flex;align-items:center;gap:6px;}',
      '.ms-pg input,.ms-pg select{background:#0f172a;color:#f1f5f9;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px;font-size:13px;}',
      '.ms-ch2{background:rgba(255,255,255,.07);color:#f1f5f9;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 13px;font-size:13px;cursor:pointer;}',
      '.ms-ch2.on{background:#16a34a;border-color:#16a34a;color:#fff;font-weight:700;}',
      '#ms-tg .ms-tgbox{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;}',
      '#ms-tg ol{margin:0 0 14px 18px;color:#e2e8f0;font-size:14px;line-height:1.8;}',
      '#ms-tg .ms-qr{background:#fff;padding:10px;border-radius:12px;display:inline-block;}',
      '@media print{#ms-side,#ms-fab,#ms-bg,#ms-intro .ms-st{display:none!important;}body.ms-on #app>.hero,body.ms-on #app>.main{margin-left:0!important;}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- costruzione ---------- */
  function preparaDom() {
    // etichette (id) su blocchi che non ce l'hanno: non cambia nulla per il resto del portale
    var tb = document.querySelector('#contenuto-normale-portale > .table-box'); if (tb && !tb.id) tb.id = 'ms-storico-box';
    var as = document.querySelector('#contenuto-normale-portale > .assist-grid'); if (as && !as.id) as.id = 'ms-assist';
    var main = document.querySelector('#app > .main'); if (!main) return false;

    // titolo pagina
    if (!$('ms-intro')) {
      var intro = document.createElement('div'); intro.id = 'ms-intro';
      intro.innerHTML = '<div><h2 id="ms-t"></h2><p id="ms-d"></p></div><button type="button" class="ms-st" id="ms-dl" onclick="ectMenu.scarica()">⬇️ Scarica questa pagina</button>';
      main.insertBefore(intro, main.firstChild);
    }
    // azioni rapide della Dashboard
    if (!$('ms-rapide')) {
      var rp = document.createElement('div'); rp.id = 'ms-rapide';
      var az0 = tipo() === 'azienda';
      var R = az0 ? [['pubblica', '📦', 'Pubblica un trasporto'], ['presi', '✅', 'Trasporti presi'], ['azpagare', '💶', 'Da pagare']] : [['carichi', '🚛', 'Carichi disponibili'], ['presi', '✅', 'Carichi presi'], ['cal', '📅', 'Calendario']];
      rp.innerHTML = '<div class="ms-rt">Cosa vuoi fare adesso?</div><div class="ms-rb">' + R.map(function (r) { return '<button type="button" data-p="' + r[0] + '"><span>' + r[1] + '</span>' + r[2] + '</button>'; }).join('') + '</div>';
      rp.onclick = function (e) { var b = e.target.closest('button[data-p]'); if (b) vai(b.getAttribute('data-p')); };
      main.insertBefore(rp, main.firstChild);
    }
    // pagina Telegram (solo trasportatore); messa PRIMA di sezione-dashboard cosi' il QR di accesso-sicuro.js la trova per prima
    if (tipo() === 'trasportatore' && !$('ms-tg')) {
      var tg = document.createElement('div'); tg.id = 'ms-tg'; tg.className = 'ins-box';
      tg.innerHTML = '<div class="ins-title">📲 Collega Telegram</div>' +
        '<div class="ins-sub">Con Telegram ricevi in privato, sul telefono, i nuovi carichi e gli aggiornamenti. Nessuno vede nessun altro.</div>' +
        '<div class="ms-tgbox"><div><ol><li>Premi il pulsante qui sotto (o inquadra il codice con il telefono).</li><li>Si apre Telegram: premi <b>Avvia</b> (o <b>Start</b>).</li><li>Fatto: il bot ti scrive che il collegamento è attivo.</li></ol>' +
        '<a href="https://t.me/SynAIMAX_EcoTruck_bot" target="_blank" rel="noopener" class="btn-cap" style="display:inline-flex;text-decoration:none;">🔗 Apri Telegram e collega</a></div></div>';
      var sd = $('sezione-dashboard'); sd.parentNode.insertBefore(tg, sd);
    }
    if (!$('ms-isc')) {
      var isc = document.createElement('div'); isc.id = 'ms-isc'; isc.className = 'ins-box';
      var sd2 = $('sezione-dashboard'); if (sd2) sd2.parentNode.insertBefore(isc, sd2);
    }
    return true;
  }

  function costruisciMenu() {
    var voci = MENU[tipo()]; if (!voci) return false;
    var side = $('ms-side');
    if (!side) {
      side = document.createElement('aside'); side.id = 'ms-side'; side.setAttribute('aria-label', 'Menu del portale');
      document.body.appendChild(side);
      var bg = document.createElement('div'); bg.id = 'ms-bg'; bg.onclick = function () { chiudiDrawer(); }; document.body.appendChild(bg);
      var fab = document.createElement('button'); fab.id = 'ms-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Apri il menu');
      fab.innerHTML = '<span style="font-size:20px">☰</span> Menu'; fab.onclick = function () { drawer = true; applicaClassi(); }; document.body.appendChild(fab);
    }
    var h = '<div id="ms-top"><b>MENU</b><button type="button" id="ms-tog" title="Apri / chiudi il menu" aria-label="Apri o chiudi il menu">◀</button></div><nav id="ms-voci">';
    voci.forEach(function (v) {
      var sub = !!v.s;
      var on = cur && (cur === v.p || cur === v.id && !sub || (v.s && v.s.some(function (x) { return x[0] === cur; })) || (v.id === 'home' && cur === 'home'));
      var apertaV = sub && (voceAperta === v.id || (v.s.some(function (x) { return x[0] === cur; })));
      h += '<button type="button" class="ms-v' + (on ? ' on' : '') + (apertaV ? ' open' : '') + '" data-v="' + v.id + '" title="' + esc(v.t + ' — ' + v.e) + '">' +
        '<span class="ms-ic" style="background:rgba(' + v.c + ',.26)">' + v.i + '</span>' +
        '<span class="ms-tx"><b>' + esc(v.t) + '</b><small>' + esc(v.e) + '</small></span>' + (sub ? '<span class="ms-ch">▶</span>' : '') + '</button>';
      if (sub && apertaV) {
        h += '<div class="ms-subs">' + v.s.map(function (x) { return '<button type="button" class="ms-s' + (cur === x[0] ? ' on' : '') + '" data-p="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div>';
      }
    });
    h += '</nav>';
    side.innerHTML = h;
    $('ms-tog').onclick = function () { if (overlay()) chiudiDrawer(); else { aperto = !aperto; memoria('ect_menu_aperto', aperto ? '1' : '0'); applicaClassi(); } };
    side.querySelectorAll('.ms-v').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-v'); var v = voci.filter(function (x) { return x.id === id; })[0];
        if (v.s) {
          if (!overlay() && !aperto) { aperto = true; memoria('ect_menu_aperto', '1'); applicaClassi(); }
          if (voceAperta === id) voceAperta = null; else { voceAperta = id; }
          // sulla prima apertura entra subito nella prima sotto-voce
          // su computer entra subito nella prima sotto-voce; su tablet/telefono apre solo l'elenco, cosi' scegli tu
          if (!overlay() && voceAperta === id && !v.s.some(function (x) { return x[0] === cur; })) { vai(v.s[0][0]); return; }
          costruisciMenu(); return;
        }
        voceAperta = null;
        vai(v.p || 'home');
      };
    });
    side.querySelectorAll('.ms-s').forEach(function (b) { b.onclick = function () { vai(b.getAttribute('data-p')); }; });
    aggiornaToggle();
    return true;
  }

  function aggiornaToggle() {
    var t = $('ms-tog'); if (!t) return;
    t.textContent = overlay() ? '✕' : (aperto ? '◀' : '▶');
  }
  function applicaClassi() {
    var b = document.body;
    b.classList.add('ms-on');
    b.classList.toggle('ms-overlay', overlay());
    b.classList.toggle('ms-stretto', !overlay() && !aperto);
    b.classList.toggle('ms-drawer', overlay() && drawer);
    var nav = document.querySelector('#app > .navbar');
    var top = nav ? Math.round(nav.getBoundingClientRect().bottom) : 60;
    if (top < 40) top = nav ? nav.offsetHeight : 60;
    b.style.setProperty('--ms-top', top + 'px');
    b.style.setProperty('--ms-w', (!overlay() && !aperto) ? '76px' : '280px');
    aggiornaToggle();
  }
  function chiudiDrawer() { drawer = false; applicaClassi(); }

  /* ---------- aprire una pagina ---------- */
  function mostra(id, si) { var e = $(id); if (e) e.classList[si ? 'remove' : 'add']('ms-off'); }
  function tuttoSpento() { CONTENITORI.concat(BLOCCHI).forEach(function (id) { mostra(id, false); }); }

  function vai(nome, opzioni) {
    var p = PAG[nome]; if (!p) return;
    opzioni = opzioni || {};
    inGo = true;
    cur = nome;
    try {
      tuttoSpento();
      var az = tipo() === 'azienda';
      if (p.c === 'home') {
        mostra('contenuto-normale-portale', true); mostra('hero-personale', true);
        if (!az) { mostra('riquadro-profilo-trasp', true); mostra('cards-riepilogo-wrap', true); }
        else { mostra('cards-riepilogo-azienda', true); }
        hideBlocchiVecchi();
        try { if (!az && typeof aggiornaRiepilogoProfiloTrasportatore === 'function') aggiornaRiepilogoProfiloTrasportatore(); } catch (e) {}
      } else if (p.c === 'normale') {
        hideBlocchiVecchi();
        mostra('contenuto-normale-portale', true);
        p.blocchi.forEach(function (b) { mostra(b, true); });
        if (p.cap) mostra('cap-bar-section', true);
        try {
          if (nome === 'presi' && typeof renderCarichiPresi === 'function') renderCarichiPresi();
          if ((nome === 'inc' || nome === 'azpagare') && typeof renderResoconto === 'function') renderResoconto();
          if (nome === 'cal' && typeof renderCalendarioMensile === 'function') renderCalendarioMensile();
          if ((nome === 'faq') && typeof mostraFAQ === 'function') mostraFAQ();
          if (nome === 'carichi' && typeof renderCarichiContenuto === 'function') renderCarichiContenuto();
        } catch (e) { console.error('menu-laterale:', e); }
        // "Carichi presi" e "Da incassare": mostro solo il blocco che serve
        if (nome === 'presi') mostra('rs-wrap', false);
        if (nome === 'inc' || nome === 'azpagare') mostra('carichi-presi-wrap', false);
      } else if (p.c === 'dash') {
        mostra('sezione-dashboard', true);
        apriDashSezioneOriginale(p.dash);
        if (p.dash === 'overview') { var sa = $('sezione-azienda'); if (sa) sa.style.display = 'none'; }
      } else if (p.c === 'profilo') {
        mostra('sezione-profilo-trasportatore', true);
        if (typeof apriProfiloTrasportatore === 'function') apriProfiloTrasportatore();
        dividiProfilo(p.part);
      } else if (p.c === 'azienda') {
        mostra('sezione-azienda', true);
        var s2 = $('sezione-azienda'); if (s2) s2.style.display = 'block';
        dividiPubblica(p.part);
        var sd = $('sezione-dashboard'); if (sd) sd.style.display = 'none';
        var cn = $('contenuto-normale-portale'); if (cn) cn.style.display = 'block';
      } else if (p.c === 'isc') {
        mostra('ms-isc', true); var ii = $('ms-isc'); if (ii) ii.style.display = 'block';
        disegnaIscrizione();
      } else if (p.c === 'tg') {
        mostra('ms-tg', true);
        var t = $('ms-tg'); if (t) t.style.display = 'block';
        disegnaQrTelegram();
      }
      // contenitori che il vecchio codice ha lasciato "aperti" e che qui non servono restano spenti da ms-off
      var tx = testo(nome), ti = $('ms-t'), de = $('ms-d'); if (ti) ti.textContent = tx.t; if (de) de.textContent = tx.d;
      try { mostraBarre(nome); } catch (e) { console.error('menu-laterale barre:', e); }
      var mi = $('ms-intro'); if (mi) mi.classList[p.c === 'home' ? 'add' : 'remove']('ms-off');
      var dl = $('ms-dl'); if (dl) dl.style.display = p.dl ? '' : 'none';
      var mr = $('ms-rapide'); if (mr) mr.classList[p.c === 'home' ? 'remove' : 'add']('ms-off');
    } finally { inGo = false; }
    // il gruppo della voce resta aperto
    var voci = MENU[tipo()] || [];
    voceAperta = null;
    voci.forEach(function (v) { if (v.s && v.s.some(function (x) { return x[0] === nome; })) voceAperta = v.id; });
    costruisciMenu();
    if (overlay()) { drawer = false; applicaClassi(); }
    if (!opzioni.senzaScroll) { try { window.scrollTo(0, 0); } catch (e) { window.scroll(0, 0); } }
  }
  function hideBlocchiVecchi() {
    var sd = $('sezione-dashboard'); if (sd) sd.style.display = 'none';
    var pf = $('sezione-profilo-trasportatore'); if (pf) pf.style.display = 'none';
    var cn = $('contenuto-normale-portale'); if (cn) cn.style.display = 'block';
    var sa = $('sezione-azienda'); if (sa) sa.style.display = 'none';
  }

  /* La scheda "mezzi + autorizzazioni" e' una sola: la mostro in due pagine, mezzi per primi */
  function dividiProfilo(part) {
    var box = $('sezione-profilo-trasportatore'); if (!box) return;
    var kids = Array.prototype.slice.call(box.children);
    var h4 = kids.filter(function (k) { return k.tagName === 'H4'; });
    var idxAut = kids.indexOf(h4[1]);
    var idxMezzi = kids.indexOf(h4[0]);
    var idxBtn = -1; kids.forEach(function (k, i) { if (k.tagName === 'BUTTON' && /salvaProfiloTrasportatore/.test(k.getAttribute('onclick') || '')) idxBtn = i; });
    kids.forEach(function (k, i) {
      var daMezzi = i >= idxMezzi && i < idxAut;
      var daAut = i >= idxAut && i < idxBtn;
      var resto = !(daMezzi || daAut);       // titolo, sottotitolo, pulsante Salva, messaggio
      var vis = part === 'tutto' || resto || (part === 'mezzi' ? daMezzi : daAut);
      k.classList[vis ? 'remove' : 'add']('ms-off');
    });
    var t = box.querySelector('.ins-title'), s = box.querySelector('.ins-sub');
    if (t) t.classList.add('ms-off'); if (s) s.classList.add('ms-off');   // titolo e spiegazione sono nel riquadro in cima alla pagina
    // il blocco documenti delle autorizzazioni (#docs-aut) nasce dopo: lo gestisce la regola CSS su data-ms-part
    document.body.setAttribute('data-ms-part', part);
  }

  /* Il modulo "Pubblica un trasporto" e' uno solo: lo mostro in 4 pagine (carico, mezzo, autorizzazione, indirizzi).
     Contatore, pulsante Pubblica e messaggi restano su tutte le pagine. */
  function dividiPubblica(part) {
    var box = $('sezione-azienda'); if (!box) return;
    var kids = Array.prototype.slice.call(box.children);
    var h4 = kids.filter(function (k) { return k.tagName === 'H4'; });
    var iMezzi = kids.indexOf(h4[1]), iAut = kids.indexOf(h4[2]), iInd = kids.indexOf(h4[3]);
    var iFine = kids.indexOf($('box-contatore-trasportatori'));
    kids.forEach(function (k, i) {
      var zona;
      if (i < 2) zona = 'titolo';
      else if (i < iMezzi) zona = 'carico';
      else if (i < iAut) zona = 'mezzi';
      else if (i < iInd) zona = 'aut';
      else if (i < iFine) zona = 'indirizzi';
      else zona = 'sempre';
      var vis = part === 'tutto' ? zona !== 'titolo' : (zona === 'sempre' || zona === part);
      k.classList[vis ? 'remove' : 'add']('ms-off');
    });
    document.body.setAttribute('data-ms-azpart', part);
    kids.forEach(function (k) {
      if (k.tagName === 'DIV' && /Hai sbagliato qualcosa/.test(k.textContent) && !k.__ms) {
        k.__ms = true;
        var w = document.createTreeWalker(k, NodeFilter.SHOW_TEXT, null), n;
        while ((n = w.nextNode())) n.nodeValue = n.nodeValue.replace('nello Storico qui sotto', 'in Archivio storico → Storico pubblicazioni');
      }
    });
  }


  /* ---------- Iscrizione annuale €150 ---------- */
  function dataIt(v) { if (!v) return null; var d = new Date(v); if (isNaN(d)) return null; return d; }
  function fmtData(d) { return d ? d.toLocaleDateString('it-IT') : '—'; }
  function disegnaIscrizione() {
    var box = $('ms-isc'); if (!box) return;
    var az = tipo() === 'azienda', f = {}, esempio = false;
    try { f = az ? (window.__ectAziendaFields || {}) : (trasportatoreFieldsCorrenti || {}); } catch (e) {}
    var anteprima = false; try { anteprima = !!modalitaAnteprimaAttiva; } catch (e) {}
    var reg = dataIt(f.data_registrazione), sca = dataIt(f.data_scadenza_accesso);
    if (anteprima && !sca) { esempio = true; reg = new Date(Date.now() - 28 * 86400000); sca = new Date(reg.getTime()); sca.setFullYear(sca.getFullYear() + 1); }
    var giorni = sca ? Math.ceil((sca.getTime() - Date.now()) / 86400000) : null;
    var stato = !sca ? '—' : (giorni < 0 ? 'Scaduta' : 'Attiva');
    var col = !sca ? '#fff' : (giorni < 0 ? '#f87171' : giorni <= 30 ? '#fbbf24' : '#4ade80');
    box.innerHTML = '<div class="ins-title">🎫 Iscrizione annuale — €150 all’anno</div>' +
      '<div class="ins-sub">' + (az ? 'Per le aziende pubblicare i carichi è gratis; la quota annuale è di €150.' : 'La quota annuale dà accesso alla piattaforma. Per ogni carico che prendi si paga a parte la commissione da €20 (la trovi in «Commissioni da €20»).') + '</div>' +
      (esempio ? '<div style="margin:10px 0;color:#fbbf24;font-size:13px;">🎭 Anteprima: date di esempio.</div>' : '') +
      '<div class="ms-isc-g">' +
      '<div class="ms-isc-c"><small>Stato</small><b style="color:' + col + '">' + stato + '</b></div>' +
      '<div class="ms-isc-c"><small>Iscritto dal</small><b>' + fmtData(reg) + '</b></div>' +
      '<div class="ms-isc-c"><small>Valida fino al</small><b>' + fmtData(sca) + '</b></div>' +
      '<div class="ms-isc-c"><small>Giorni rimasti</small><b style="color:' + col + '">' + (giorni == null ? '—' : (giorni < 0 ? 'scaduta da ' + (-giorni) : giorni)) + '</b></div>' +
      '<div class="ms-isc-c"><small>Importo annuale</small><b>€ 150,00</b></div></div>' +
      '<div style="font-size:13px;color:rgba(241,245,249,.65);line-height:1.6;">Prima della scadenza ricevi un promemoria per email con il link di pagamento (pagina sicura Shopify). ' +
      (sca ? '' : 'La data di scadenza non è ancora registrata sul tuo profilo. ') + 'Qui compaiono la data di iscrizione e la scadenza; i singoli pagamenti li gestiamo noi.</div>';
  }

  /* ---------- elenchi: pagine da 25/50/100 + ultima giornata + calendario ---------- */
  var LISTE = {
    storico:   { id: 'storico-body', ancora: 'ms-storico-box' },
    fatture:   { id: 'dash-fatture-body', ancora: null },
    movimenti: { id: 'sm-lista', ancora: null },
    presi:     { id: 'cp-body', ancora: null },
    rs:        { id: 'rs-giorni', ancora: null }
  };
  var PAGINA_LISTA = { storico: 'storico', azstorico: 'storico', fatture: 'fatture', movimenti: 'movimenti', presi: 'presi', inc: 'rs', azpagare: 'rs' };
  var statoL = {};
  function stL(k) { return statoL[k] || (statoL[k] = { modo: 'ultimo', dal: '', al: '', per: 25, pag: 1 }); }
  function dataRiga(el) {
    var m = (el.textContent || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); if (!m) return null;
    return m[3] + '-' + m[2] + '-' + m[1];
  }
  function giorniFaISO(n) { var d = new Date(Date.now() - n * 86400000); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function itIso(iso) { return iso ? iso.split('-').reverse().join('/') : '—'; }
  function barra(k) {
    var cfg = LISTE[k], cont = $(cfg.id); if (!cont) return null;
    var b = $('ms-pg-' + k);
    if (b) return b;
    b = document.createElement('div'); b.id = 'ms-pg-' + k; b.className = 'ms-pg ms-off';
    var ancora = (cfg.ancora && $(cfg.ancora)) || (cont.closest('.table-box')) || cont;
    ancora.parentNode.insertBefore(b, ancora);
    return b;
  }
  function righe(k) {
    var cont = $(LISTE[k].id); if (!cont) return [];
    return Array.prototype.slice.call(cont.children).filter(function (e) { return !(e.querySelector && e.querySelector('td.empty')) && !e.classList.contains('empty'); });
  }
  function disegnaBarra(k, tot, filtrate, da, a, ultima) {
    var b = barra(k); if (!b) return;
    var s = stL(k), pagine = Math.max(1, Math.ceil(filtrate / s.per));
    var chip = function (m, t) { return '<button type="button" class="ms-ch2' + (s.modo === m ? ' on' : '') + '" data-m="' + m + '">' + t + '</button>'; };
    b.innerHTML = chip('ultimo', 'Ultima giornata') + chip('7', 'Ultimi 7 giorni') + chip('tutto', 'Tutto') +
      '<span class="ms-sp"></span><label>Dal <input type="date" data-r="dal" value="' + s.dal + '"></label><label>Al <input type="date" data-r="al" value="' + s.al + '"></label>' +
      '<label>Per pagina <select data-per>' + [25, 50, 100].map(function (n) { return '<option' + (s.per === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="ms-ch2" data-p="-1"' + (s.pag <= 1 ? ' disabled style="opacity:.4"' : '') + '>◀</button><span>Pagina ' + s.pag + ' di ' + pagine + '</span>' +
      '<button type="button" class="ms-ch2" data-p="1"' + (s.pag >= pagine ? ' disabled style="opacity:.4"' : '') + '>▶</button>' +
      '<div class="ms-info">' + (filtrate ? 'Mostro ' + (da + 1) + '–' + a + ' di ' + filtrate : 'Nessun elemento in questo periodo') + (filtrate !== tot ? ' (su ' + tot + ' totali)' : '') +
      (s.modo === 'ultimo' && ultima ? ' · ultima giornata: ' + itIso(ultima) : '') + '</div>';
    b.onclick = function (e) {
      var t = e.target.closest('button'); if (!t || t.disabled) return;
      if (t.hasAttribute('data-m')) { s.modo = t.getAttribute('data-m'); s.dal = s.al = ''; s.pag = 1; }
      else if (t.hasAttribute('data-p')) { s.pag += Number(t.getAttribute('data-p')); }
      applicaLista(k);
    };
    b.onchange = function (e) {
      var t = e.target;
      if (t.hasAttribute('data-per')) { s.per = Number(t.value); s.pag = 1; }
      else if (t.hasAttribute('data-r')) { s[t.getAttribute('data-r')] = t.value; s.modo = 'range'; s.pag = 1; }
      applicaLista(k);
    };
  }
  function applicaLista(k) {
    var cont = $(LISTE[k].id); if (!cont) return;
    var s = stL(k), rr = righe(k);
    var date = rr.map(dataRiga), conData = date.filter(Boolean);
    var ultima = conData.length ? conData.slice().sort().pop() : null;
    var visibili = [];
    rr.forEach(function (el, i) {
      var d = date[i], ok = true;
      if (conData.length) {
        if (s.modo === 'ultimo') ok = d === ultima;
        else if (s.modo === '7') ok = !!d && d >= giorniFaISO(6);
        else if (s.modo === 'range') ok = !!d && (!s.dal || d >= s.dal) && (!s.al || d <= s.al);
      }
      if (ok) visibili.push(el); else el.classList.add('ms-off');
    });
    var pagine = Math.max(1, Math.ceil(visibili.length / s.per));
    if (s.pag > pagine) s.pag = pagine;
    if (s.pag < 1) s.pag = 1;
    var da = (s.pag - 1) * s.per, a = Math.min(visibili.length, da + s.per);
    visibili.forEach(function (el, i) { el.classList[i >= da && i < a ? 'remove' : 'add']('ms-off'); });
    disegnaBarra(k, rr.length, visibili.length, da, a, ultima);
  }
  var timerL = {};
  function osservaListe() {
    Object.keys(LISTE).forEach(function (k) {
      var cont = $(LISTE[k].id); if (!cont || cont.__msOss) return;
      cont.__msOss = true;
      new MutationObserver(function () { clearTimeout(timerL[k]); timerL[k] = setTimeout(function () { applicaLista(k); }, 60); }).observe(cont, { childList: true });
      applicaLista(k);
    });
  }
  function mostraBarre(nome) {
    var kk = PAGINA_LISTA[nome];
    Object.keys(LISTE).forEach(function (k) { var b = $('ms-pg-' + k); if (b) b.classList[k === kk ? 'remove' : 'add']('ms-off'); });
    if (kk) { osservaListe(); applicaLista(kk); var b2 = $('ms-pg-' + kk); if (b2) b2.classList.remove('ms-off'); }
  }

  /* ---------- QR Telegram ---------- */

  function disegnaQrTelegram() {
    var tg = $('ms-tg'); if (!tg) return;
    var a = tg.querySelector('a[href^="https://t.me/"]');
    var cont = $('ms-qr-box');
    if (!cont) {
      cont = document.createElement('div'); cont.id = 'ms-qr-box';
      cont.innerHTML = '<div class="ms-qr" id="ms-qr-img"></div><div style="font-size:12px;color:rgba(241,245,249,.7);margin-top:8px;max-width:190px;line-height:1.5;">📱 Inquadra il codice con la fotocamera del telefono: si apre Telegram.</div>';
      tg.querySelector('.ms-tgbox').appendChild(cont);
    }
    function disegna() {
      var img = $('ms-qr-img'); if (!img || !a) return;
      img.innerHTML = '';
      try { new QRCode(img, { text: a.href, width: 150, height: 150 }); } catch (e) { img.textContent = 'Codice non disponibile: usa il pulsante.'; }
    }
    if (window.QRCode) disegna();
    else {
      var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      sc.onload = disegna; sc.onerror = function () { var i = $('ms-qr-img'); if (i) i.textContent = 'Codice non disponibile: usa il pulsante.'; };
      document.head.appendChild(sc);
    }
    // il link con il tuo codice personale viene aggiornato da accesso-sicuro.js: ridisegno dopo un attimo
    setTimeout(disegna, 1800);
  }

  /* ---------- aggancio al codice esistente (senza riscriverlo) ---------- */
  var apriDashOrig = null;
  function apriDashSezioneOriginale(n) { if (apriDashOrig) apriDashOrig(n); }

  function agganciaFunzioni() {
    // 1) chiamate esterne alla vecchia Dashboard -> pagina giusta del menu
    if (typeof window.apriDashSezione === 'function' && !window.apriDashSezione.__ms) {
      apriDashOrig = window.apriDashSezione;
      var w = function (n) {
        if (inGo || !pronto) return apriDashOrig.apply(this, arguments);
        var az = tipo() === 'azienda';
        var mappa = { overview: az ? 'azcal' : 'home', dati: 'dati', fatture: 'fatture', report: 'report', notifiche: 'notifiche', storico: 'movimenti', sicurezza: 'sicurezza' };
        var pg = mappa[n]; if (pg) { vai(pg); return; }
        return apriDashOrig.apply(this, arguments);
      };
      w.__ms = true; window.apriDashSezione = w;
    }
    // 2) "Chiudi" della vecchia Dashboard -> torna alla Dashboard del menu
    if (typeof window.chiudiDashSezione === 'function' && !window.chiudiDashSezione.__ms) {
      var cOrig = window.chiudiDashSezione;
      window.chiudiDashSezione = function () { if (pronto) { vai('home'); return; } return cOrig.apply(this, arguments); };
      window.chiudiDashSezione.__ms = true;
    }
    // 3) riquadro "I miei mezzi / Le mie autorizzazioni" della home -> pagine dedicate
    if (typeof window.apriProfiloTrasportatore === 'function' && !window.apriProfiloTrasportatore.__ms) {
      var pOrig = window.apriProfiloTrasportatore;
      var pw = function () { if (inGo || !pronto) return pOrig.apply(this, arguments); vai('mezzi'); };
      pw.__ms = true; window.apriProfiloTrasportatore = pw;
      apriProfiloOrig = pOrig;
    }
  }
  var apriProfiloOrig = null;

  /* Qualsiasi punto del portale che fa "scrollIntoView" su un blocco nascosto dal menu
     (campanella, card, "vai allo storico", "modifica carico"...) fa aprire la pagina giusta. */
  function paginaDelBlocco(el) {
    var az = tipo() === 'azienda';
    var MAP = {
      'carichi-disponibili-wrap': 'carichi', 'calendario-section': 'carichi', 'cap-bar-section': 'carichi',
      'calendario-carichi-wrap': az ? 'azcal' : 'cal', 'carichi-presi-wrap': 'presi', 'rs-wrap': az ? 'azpagare' : 'inc',
      'report-trasportatore-wrap': 'azreptr', 'storico-sec-head': az ? 'azstorico' : 'storico', 'ms-storico-box': az ? 'azstorico' : 'storico',
      'faq-box': 'faq', 'ms-assist': 'scrivici', 'sezione-azienda': 'pubblica', 'sezione-profilo-trasportatore': 'mezzi',
      'hero-personale': 'home', 'cards-riepilogo-wrap': 'home', 'cards-riepilogo-azienda': 'home', 'riquadro-profilo-trasp': 'home',
      'dash-sezione-overview': az ? 'azcal' : 'home', 'dash-sezione-dati': 'dati', 'dash-sezione-fatture': 'fatture', 'dash-sezione-report': 'report',
      'dash-sezione-notifiche': 'notifiche', 'dash-sezione-storico': 'movimenti', 'dash-sezione-sicurezza': 'sicurezza', 'ms-tg': 'tg'
    };
    for (var n = el; n && n !== document.body; n = n.parentNode) { if (n.id && MAP[n.id]) return MAP[n.id]; }
    return null;
  }
  function agganciaScroll() {
    var orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function () {
      var args = arguments, self = this;
      if (pronto && !inGo && document.body.classList.contains('ms-on')) {
        var pg = paginaDelBlocco(self);
        if (pg && pg !== cur && PAG[pg]) {
          // se il blocco e' gia' visibile nella pagina attuale non faccio nulla di speciale
          var gia = self.offsetParent !== null;
          if (!gia) { vai(pg, { senzaScroll: true }); setTimeout(function () { try { orig.apply(self, args); } catch (e) {} }, 60); return; }
        }
      }
      return orig.apply(self, args);
    };
  }

  /* ---------- "Stampa" diventa "Scarica" ----------
     Chi vuole stampare, scarica il PDF e lo stampa da solo. I pulsanti Stampa che gia' esistono
     (carichi presi, resoconto, storico...) ora scaricano un PDF con lo stesso contenuto. */
  function eStampa(b) {
    if (!b || !b.closest || b.closest('#ms-intro') || b.closest('#ms-side')) return false;
    var oc = b.getAttribute('onclick') || '';
    if (/DocAz/.test(oc)) return false;                  // documenti dell'azienda: hanno gia' il loro "Scarica"
    return /Stampa/.test(b.textContent || '');
  }
  function rinomina() {
    document.querySelectorAll('button').forEach(function (b) {
      if (!eStampa(b) || b.__msRen) return;
      b.__msRen = true;
      var w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, null);
      var n; while ((n = w.nextNode())) { n.nodeValue = n.nodeValue.replace('🖨️', '⬇️').replace('🖨', '⬇️').replace(/Stampa/g, 'Scarica'); }
    });
  }
  window.addEventListener('click', function (e) {
    if (!pronto) return;
    var b = e.target.closest && e.target.closest('button'); if (!b || !b.__msRen) return;
    var oc = b.getAttribute('onclick') || '';
    if (!/stampa|Stampa/.test(oc) && !b.classList.contains('ect-stampa-riga')) return;
    if (b.classList.contains('ect-stampa-riga')) return;           // righe: gia' gestite (modo scarica)
    // le funzioni di stampa aprono una finestra e ci scrivono il documento: la intercetto e ne faccio un PDF
    var orig = window.open, html = '';
    window.open = function () {
      return { document: { write: function (h) { html += h; }, close: function () {}, open: function () {} }, focus: function () {}, print: function () {}, close: function () {}, closed: false };
    };
    window.__ectModoScarica = true;
    setTimeout(function () {
      window.open = orig; window.__ectModoScarica = false;
      if (!html) return;
      try {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var titolo = (doc.title || '').replace(/^EcoTruckConnect\s*[—-]\s*/, '') || 'Documento';
        doc.querySelectorAll('style,script').forEach(function (x) { x.remove(); });
        if (typeof window.ectScarica === 'function') window.ectScarica(titolo, [doc.body]);
      } catch (er) { console.error('menu-laterale scarica', er); }
    }, 120);
  }, true);

  /* ---------- avvio ---------- */
  function appVisibile() { var a = $('app'); return !!a && a.style.display !== 'none' && getComputedStyle(a).display !== 'none'; }

  function avvia() {
    if (pronto) return;
    stile();
    if (!preparaDom()) return;
    agganciaFunzioni();
    pronto = true;
    applicaClassi();
    costruisciMenu();
    vai('home', { senzaScroll: true });
    agganciaScroll();
  }
  function spegni() {
    document.body.classList.remove('ms-on', 'ms-overlay', 'ms-drawer', 'ms-stretto');
    tuttoSpento(); pronto = false; cur = null;
    var s = $('ms-side'); if (s) s.remove();
  }

  var timer = setInterval(function () {
    var t = tipo();
    var ok = appVisibile() && (t === 'trasportatore' || t === 'azienda');
    if (ok && !pronto) { try { avvia(); } catch (e) { console.error('menu-laterale: avvio fallito, resta il menu classico', e); spegni(); clearInterval(timer); } }
    else if (!ok && pronto) { spegni(); }
    else if (ok && pronto) {
      // il nome del menu dipende dal tipo: se cambia (nuovo accesso) lo ricostruisco
      if (!$('ms-side')) { costruisciMenu(); }
      rinomina();
      var top = document.querySelector('#app > .navbar'); if (top) document.body.style.setProperty('--ms-top', Math.round(top.getBoundingClientRect().bottom > 40 ? top.getBoundingClientRect().bottom : top.offsetHeight) + 'px');
    }
  }, 350);

  window.addEventListener('scroll', function () { if (pronto) { var n = document.querySelector('#app > .navbar'); if (n) { var t = Math.round(n.getBoundingClientRect().bottom); document.body.style.setProperty('--ms-top', Math.max(t, 0) + 'px'); } } }, { passive: true });
  window.addEventListener('resize', function () { if (pronto) { if (!overlay()) drawer = false; applicaClassi(); } });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer) chiudiDrawer(); });

  // per chi vuole aprire una pagina da fuori (es. test): ectMenu.vai('presi')
  function scaricaPagina() {
    var p = PAG[cur]; if (!p || !p.dl) return;
    var ids = p.c === 'dash' ? ['dash-sezione-' + p.dash] : p.c === 'isc' ? ['ms-isc'] : (p.blocchi || []);
    var nodi = ids.map($).filter(Boolean);
    if (typeof window.ectScarica === 'function') window.ectScarica(testo(cur).t, nodi);
  }
  window.ectMenu = { vai: vai, pagine: PAG, menu: MENU, scarica: scaricaPagina };
})();
