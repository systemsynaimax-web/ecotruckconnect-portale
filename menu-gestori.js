/* =====================================================================
   EcoTruckConnect — menu-gestori.js (10/10/2026)
   MENU LATERALE della Dashboard Gestori (dashboard.html e dashboard-demo.html).
   Additivo: non cambia nessuna funzione della dashboard, divide solo la pagina lunga in pagine.
   - Sopra restano: logo, mail, campanella, aggiornamento, vetrina (come prima).
   - Interruttore di sicurezza: aggiungere ?menu=classico all'indirizzo (oppure ?menu=laterale per riattivarlo).
   ===================================================================== */
(function () {
  'use strict';
  try {
    var q = location.search || '';
    if (/menu=classico/.test(q)) localStorage.setItem('ect_menu_classico_gest', '1');
    if (/menu=laterale/.test(q)) localStorage.removeItem('ect_menu_classico_gest');
    if (localStorage.getItem('ect_menu_classico_gest') === '1') return;
  } catch (e) {}

  function $(id) { return document.getElementById(id); }
  var PORTALE = 'https://ecotruckconnect-portale.netlify.app/';

  /* ---------- le pagine ---------- */
  var PAG = {
    home:      { i: '🏠', t: 'Dashboard', d: 'La pagina iniziale: scorciatoie e collegamenti rapidi.' },
    calendario:{ i: '📅', t: 'Calendario', d: 'I carichi giorno per giorno: disponibili, in pagamento, presi.' },
    storico:   { i: '📚', t: 'Storico movimenti', d: 'Archivio di tutto: filtra per periodo, stato, trasportatore o azienda. Scarica in CSV.' },
    archT:     { i: '🚚', t: 'Archivio trasportatori', d: 'Ogni trasportatore con tutta la sua storia: viaggi, pagamenti, cambi dati, attività. Cerca e scarica.' },
    archA:     { i: '🏢', t: 'Archivio aziende', d: 'Ogni azienda con tutta la sua storia: carichi pubblicati, pagamenti, cambi dati, attività. Cerca e scarica.' },
    registro:  { i: '📜', t: 'Registro attività', d: 'Chi ha fatto cosa e quando: modifiche dati, password, richieste di eliminazione.' },
    anagrafica:{ i: '👥', t: 'Anagrafica', d: 'Tutti i trasportatori e le aziende registrati, con mezzi e autorizzazioni.' },
    analitica: { i: '📈', t: 'Analitica', d: 'Numeri in tempo reale, andamenti e grafici (carichi, incassi, iscrizioni, sicurezza).' },
    strumenti: { i: '🛠️', t: 'Strumenti', d: 'Tutti gli strumenti in una pagina: collegamenti ai servizi, verifiche ufficiali, fatturazione, condizioni d’uso e privacy.' },
    annullamenti: { i: '↩️', t: 'Annullamenti e rimborsi', d: 'Richieste di annullamento e rimborsi da approvare.' },
    proposte:  { i: '💡', t: 'Da decidere', d: 'Tutela assicurativa, idee future e proposte: nulla di tutto questo è attivo, serve la decisione di Gerlando.' },
    finti:     { i: '🧪', t: 'Dati finti', d: 'Le versioni di prova con dati di esempio: dashboard azienda, dashboard trasportatore e dashboard gestori. Si può cliccare tutto senza rischi.' },
    altro:     { i: '📄', t: 'Altro', d: '' }
  };
  var REGOLE = [
    [/Portali personali|Vedi come funziona/i, 'finti'],
    [/Numeri in tempo reale/i, 'analitica'],
    [/Collegamenti rapidi/i, 'home'],
    [/Calendario/i, 'calendario'],
    [/Storico movimenti/i, 'storico'],
    [/Archivio storico trasportatori/i, 'archT'],
    [/Archivio storico aziende/i, 'archA'],
    [/Registro Attivit/i, 'registro'],
    [/Anagrafica/i, 'anagrafica'],
    [/Annullamenti/i, 'annullamenti'],
    [/Tutela assicurativa|Idee future|Vetrina/i, 'proposte'],
    [/Strumenti|Verifiche ufficiali|Fatturazione|Condizioni d.uso/i, 'strumenti']
  ];
  /* il menu: [pagina | {href} , sottotitolo] */
  var MENU = [
    { p: 'home', e: 'Scorciatoie e collegamenti' },
    { href: 'registrazioni.html', i: '🆕', t: 'Registrazioni', e: 'Nuove iscrizioni da approvare' },
    { p: 'calendario', e: 'I carichi giorno per giorno' },
    { p: 'storico', e: 'Tutti i carichi e i movimenti' },
    { p: 'archT', e: 'Storia di ogni trasportatore' },
    { p: 'archA', e: 'Storia di ogni azienda' },
    { p: 'registro', e: 'Chi ha fatto cosa' },
    { p: 'anagrafica', e: 'Trasportatori e aziende' },
    { href: 'report.html', i: '📋', t: 'Report trasportatori', e: 'Scheda di ogni trasportatore' },
    { p: 'analitica', e: 'Numeri, andamenti, grafici' },
    { p: 'strumenti', e: 'Tutti gli strumenti' },
    { p: 'annullamenti', e: 'Da approvare' },
    { p: 'proposte', e: 'Assicurazione, idee, proposte' },
    { p: 'finti', e: 'Dashboard di prova' }
  ];

  var gruppi = {};   // pagina -> elenco di elementi
  var cur = '';
  var pronto = false;

  function raggruppa() {
    var wrap = document.querySelector('.wrap'); if (!wrap) return false;
    var key = 'home';
    Array.prototype.slice.call(wrap.children).forEach(function (el) {
      if (el.id === 'mg-home' || el.id === 'mg-finti') return;
      if (el.classList && el.classList.contains('sec-title')) {
        var tx = el.textContent || '', k = null;
        for (var i = 0; i < REGOLE.length; i++) { if (REGOLE[i][0].test(tx)) { k = REGOLE[i][1]; break; } }
        key = k || 'altro';
        el.setAttribute('data-mg-titolo', '1');
      }
      el.setAttribute('data-mg', key);
      (gruppi[key] = gruppi[key] || []).push(el);
    });
    // i blocchi aggiunti da me
    return true;
  }

  function blocchiProprii() {
    var wrap = document.querySelector('.wrap'); if (!wrap) return;
    /* scorciatoie della home */
    if (!$('mg-home')) {
      var h = document.createElement('div'); h.id = 'mg-home'; h.setAttribute('data-mg', 'home');
      var SC = [['registrazioni.html', '🆕', 'Registrazioni', 'Nuove iscrizioni da approvare', 1], ['storico', '📚', 'Storico movimenti', 'Tutto quello che è successo'],
        ['archT', '🚚', 'Archivio trasportatori', 'Storia di ogni trasportatore'], ['archA', '🏢', 'Archivio aziende', 'Storia di ogni azienda'], ['analitica', '📈', 'Analitica', 'Numeri e grafici'], ['strumenti', '🛠️', 'Strumenti', 'Airtable, Make, Netlify…'], ['finti', '🧪', 'Dati finti', 'Dashboard di prova']];
      h.innerHTML = '<div class="sec-title">Cosa vuoi fare adesso?</div><div class="mg-sc">' + SC.filter(function (s) { return s[4] || haContenuto(s[0]); }).map(function (s) {
        return '<button type="button" class="mg-card" data-go="' + s[0] + '"><span class="mg-ic">' + s[1] + '</span><b>' + s[2] + '</b><small>' + s[3] + '</small></button>';
      }).join('') + '<button type="button" class="mg-card" data-camp="1"><span class="mg-ic">🔔</span><b>Campanella</b><small>Iscrizioni da approvare</small></button></div>';
      wrap.insertBefore(h, wrap.firstChild);
      (gruppi.home = gruppi.home || []).unshift(h);
    }
    /* pagina "Dati finti" nella dashboard reale (nella demo c'e' gia') */
    if (!gruppi.finti && !$('mg-finti')) {
      var f = document.createElement('div'); f.id = 'mg-finti'; f.setAttribute('data-mg', 'finti');
      var CD = [['🏢 Dashboard azienda', 'Il portale dell’azienda con dati di esempio: menu laterale, pubblica un carico, pagamenti, storico.', PORTALE + '?preview=azienda'],
        ['🚚 Dashboard trasportatore', 'Il portale del trasportatore con dati di esempio: carichi, presi, commissioni, iscrizione.', PORTALE + '?preview=trasportatore'],
        ['🎭 Dashboard gestori (finta)', 'Questa stessa dashboard, ma con dati finti: si può cliccare tutto senza rischi.', 'dashboard-demo.html']];
      f.innerHTML = '<div class="mg-sc">' + CD.map(function (c) {
        return '<a class="mg-card mg-card-l" href="' + c[2] + '" target="_blank" rel="noopener"><b>' + c[0] + '</b><small>' + c[1] + '</small><span class="mg-vai">Apri ↗</span></a>';
      }).join('') + '</div><div class="mg-nota">🧪 Sono versioni di prova: i dati sono di esempio e non toccano quelli veri. Si aprono in una nuova scheda.</div>';
      wrap.appendChild(f);
      (gruppi.finti = gruppi.finti || []).push(f);
    }
  }

  /* ---------- stile ---------- */
  function stile() {
    if ($('mg-stile')) return;
    var s = document.createElement('style'); s.id = 'mg-stile';
    s.textContent = [
      '.mg-off{display:none!important;}',
      'body.mg-on .btn-andamenti{display:none!important;}',
      'body.mg-on a[href="dashboard-demo.html"]{display:none!important;}',
      '#mg-side{display:none;}',
      'body.mg-on #mg-side{display:flex;flex-direction:column;position:fixed;left:0;top:var(--mg-top,64px);bottom:0;width:272px;background:#0a111c;border-right:1px solid rgba(255,255,255,.09);overflow-y:auto;z-index:300;padding:12px 10px 28px;box-sizing:border-box;transition:transform .2s;}',
      'body.mg-on .wrap,body.mg-on #andamenti-panel.mg-inline,body.mg-on #mg-intro{margin-left:272px;}',
      'body.mg-on.mg-stretto .wrap,body.mg-on.mg-stretto #andamenti-panel.mg-inline,body.mg-on.mg-stretto #mg-intro{margin-left:0;}',
      'body.mg-on.mg-stretto #mg-side{transform:translateX(-100%);}',
      '#mg-side .mg-top{display:flex;justify-content:space-between;align-items:center;padding:4px 6px 10px;font-size:11px;letter-spacing:1.5px;color:rgba(241,245,249,.5);font-weight:700;}',
      '.mg-v{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;border:1px solid transparent;border-radius:12px;padding:10px 10px;color:#f1f5f9;cursor:pointer;font:inherit;text-decoration:none;box-sizing:border-box;margin-bottom:2px;}',
      '.mg-v:hover{background:rgba(255,255,255,.05);}',
      '.mg-v.on{background:rgba(59,130,246,.16);border-color:rgba(59,130,246,.45);}',
      '.mg-v .mg-i{font-size:20px;width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border-radius:10px;flex:none;}',
      '.mg-v b{display:block;font-size:14px;} .mg-v small{display:block;font-size:11px;color:rgba(241,245,249,.55);margin-top:1px;}',
      '.mg-v .mg-ext{margin-left:auto;font-size:12px;opacity:.5;}',
      '#mg-tg{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);color:#f1f5f9;border-radius:8px;width:30px;height:30px;cursor:pointer;font-size:13px;}',
      '#mg-fab{display:none;position:fixed;left:14px;bottom:18px;z-index:310;background:#2563eb;color:#fff;border:none;border-radius:999px;padding:12px 18px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 6px 22px rgba(0,0,0,.45);}',
      'body.mg-on.mg-stretto #mg-fab{display:block;}',
      '#mg-bg{display:none;}',
      '#mg-intro{display:none;margin:0 0 0 272px;padding:16px 32px 4px;max-width:1400px;box-sizing:border-box;}',
      'body.mg-on #mg-intro{display:block;}',
      '#mg-intro h2{margin:0 0 4px;font-size:22px;color:#fff;} #mg-intro p{margin:0;font-size:13px;color:rgba(241,245,249,.65);line-height:1.5;max-width:900px;}',
      '.mg-sc{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;margin:0 0 22px;}',
      '.mg-card{display:flex;flex-direction:column;gap:4px;text-align:left;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;color:#f1f5f9;cursor:pointer;font:inherit;text-decoration:none;}',
      '.mg-card:hover{border-color:rgba(59,130,246,.6);background:rgba(59,130,246,.09);}',
      '.mg-card b{font-size:15px;} .mg-card small{font-size:12px;color:rgba(241,245,249,.6);line-height:1.45;} .mg-ic{font-size:24px;}',
      '.mg-card-l .mg-vai{margin-top:8px;align-self:flex-start;background:#2563eb;color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;}',
      '.mg-nota{font-size:12px;color:rgba(241,245,249,.55);margin:0 0 20px;}',
      '#andamenti-panel.mg-inline{position:static!important;inset:auto!important;background:none!important;padding:0 32px 32px!important;z-index:auto!important;overflow:visible!important;}',
      '#andamenti-panel.mg-inline .andamenti-box{max-width:1400px!important;}',
      '#andamenti-panel.mg-inline .andamenti-chiudi{display:none!important;}',
      '@media (max-width:1100px){',
      '  body.mg-on .wrap,body.mg-on #andamenti-panel.mg-inline,body.mg-on #mg-intro{margin-left:0;}',
      '  #mg-intro{margin-left:0!important;padding:14px 16px 0;}',
      '  body.mg-on #mg-side{transform:translateX(-100%);width:290px;box-shadow:0 0 40px rgba(0,0,0,.6);top:0;}',
      '  body.mg-on.mg-drawer #mg-side{transform:none;}',
      '  body.mg-on #mg-fab{display:block;}',
      '  body.mg-on.mg-drawer #mg-bg{display:block;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:299;}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- struttura ---------- */
  /* un gruppo ha contenuto se almeno un elemento (non il titolo) non e' nascosto dalla dashboard stessa */
  function haContenuto(k) {
    return (gruppi[k] || []).some(function (el) { return !el.hasAttribute('data-mg-titolo') && el.style.display !== 'none'; });
  }
  function costruisci() {
    if ($('mg-side')) return;
    var side = document.createElement('nav'); side.id = 'mg-side'; side.setAttribute('aria-label', 'Menu dashboard gestori');
    var html = '<div class="mg-top"><span>MENU</span><button id="mg-tg" type="button" title="Riduci o apri il menu">◀</button></div>';
    MENU.forEach(function (v) {
      if (v.href) html += '<a class="mg-v" href="' + v.href + '"><span class="mg-i">' + v.i + '</span><span><b>' + v.t + '</b><small>' + v.e + '</small></span><span class="mg-ext">↗</span></a>';
      else if (haContenuto(v.p)) html += '<button type="button" class="mg-v" data-p="' + v.p + '"><span class="mg-i">' + PAG[v.p].i + '</span><span><b>' + PAG[v.p].t + '</b><small>' + v.e + '</small></span></button>';
    });
    if (haContenuto('altro')) html += '<button type="button" class="mg-v" data-p="altro"><span class="mg-i">📄</span><span><b>Altro</b><small>Altre sezioni</small></span></button>';
    side.innerHTML = html;
    document.body.appendChild(side);
    var fab = document.createElement('button'); fab.id = 'mg-fab'; fab.type = 'button'; fab.textContent = '☰ Menu'; document.body.appendChild(fab);
    var bg = document.createElement('div'); bg.id = 'mg-bg'; document.body.appendChild(bg);
    var intro = document.createElement('div'); intro.id = 'mg-intro'; intro.innerHTML = '<h2 id="mg-t"></h2><p id="mg-d"></p>';
    var wrap = document.querySelector('.wrap'); wrap.parentNode.insertBefore(intro, wrap);

    side.addEventListener('click', function (e) { var b = e.target.closest('button[data-p]'); if (b) vai(b.getAttribute('data-p')); });
    $('mg-tg').onclick = function () { document.body.classList.add('mg-stretto'); salvaStato(false); };
    fab.onclick = function () {
      if (window.innerWidth <= 1100) document.body.classList.add('mg-drawer'); else { document.body.classList.remove('mg-stretto'); salvaStato(true); }
    };
    bg.onclick = function () { document.body.classList.remove('mg-drawer'); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') document.body.classList.remove('mg-drawer'); });
    // scorciatoie nella home + collegamenti con #ancora
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-go]');
      if (c) { var g = c.getAttribute('data-go'); if (/\.html$/.test(g)) location.href = g; else vai(g); return; }
      var camp = e.target.closest('[data-camp]'); if (camp && typeof window.apriNotifiche === 'function') { window.apriNotifiche(); return; }
      var a = e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href').length > 1) {
        var t = document.getElementById(a.getAttribute('href').slice(1)); var host = t && t.closest('[data-mg]');
        if (host) { e.preventDefault(); vai(host.getAttribute('data-mg')); setTimeout(function () { t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80); }
      }
    });
  }
  function salvaStato(aperto) { try { localStorage.setItem('ect_menu_gest_aperto', aperto ? '1' : '0'); } catch (e) {} }

  function misuraTop() {
    var h = document.querySelector('.hero'); var top = h ? Math.max(0, h.getBoundingClientRect().bottom) : 64;
    document.documentElement.style.setProperty('--mg-top', Math.min(top, 160) + 'px');
  }

  function vai(nome) {
    if (!PAG[nome] || !gruppi[nome]) nome = 'home';
    cur = nome;
    Object.keys(gruppi).forEach(function (k) { gruppi[k].forEach(function (el) { el.classList[k === nome ? 'remove' : 'add']('mg-off'); }); });
    // una sola sezione nella pagina: il titolo della sezione e' gia' nel riquadro in alto
    var titoli = gruppi[nome].filter(function (el) { return el.hasAttribute('data-mg-titolo'); });
    titoli.forEach(function (el) { el.classList[(titoli.length === 1 && nome !== 'home') ? 'add' : 'remove']('mg-off'); });
    var p = $('andamenti-panel');
    if (p) {
      p.classList.add('mg-inline');
      if (nome === 'analitica') { if (typeof window.apriAndamenti === 'function') { try { window.apriAndamenti(); } catch (e) { console.error(e); } } }
      else p.classList.remove('open');
    }
    $('mg-t').textContent = PAG[nome].t; $('mg-d').textContent = PAG[nome].d;
    document.querySelectorAll('#mg-side .mg-v[data-p]').forEach(function (b) { b.classList[b.getAttribute('data-p') === nome ? 'add' : 'remove']('on'); });
    document.body.classList.remove('mg-drawer');
    try { history.replaceState(null, '', location.pathname + location.search + '#' + nome); } catch (e) {}
    window.scrollTo(0, 0);
  }

  function avvia() {
    if (pronto) return; if (!raggruppa()) return;
    pronto = true; stile(); blocchiProprii(); costruisci();
    document.body.classList.add('mg-on');
    if (window.innerWidth <= 1100) document.body.classList.add('mg-stretto');
    else { try { if (localStorage.getItem('ect_menu_gest_aperto') === '0') document.body.classList.add('mg-stretto'); } catch (e) {} }
    misuraTop(); window.addEventListener('resize', misuraTop); window.addEventListener('scroll', misuraTop, { passive: true });
    var h = (location.hash || '').slice(1);
    vai(PAG[h] && gruppi[h] ? h : 'home');
    window.ectMenuGestori = { vai: vai, pagine: PAG, gruppi: gruppi };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
  window.addEventListener('load', function () { setTimeout(function () { avvia(); misuraTop(); }, 300); });
})();
