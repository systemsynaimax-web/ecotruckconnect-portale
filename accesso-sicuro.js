/* =====================================================================
   ACCESSO SICURO — EcoTruckConnect (26/9/2026)
   1) A ogni richiesta verso Make aggiunge il "pass" di chi ha fatto
      l'accesso (token Netlify Identity). Make lo verifica e risponde
      SOLO a chi ha fatto l'accesso, e a ognuno solo con i suoi dati.
   2) Nelle pagine dei gestori (dashboard, report, registrazioni) chiede
      email e password e fa entrare SOLO i gestori.
      Per attivarlo la pagina scrive, prima di questo file:
      <script>window.ECT_SOLO_GESTORI = true;</script>
   ===================================================================== */
(function () {
  var PROXY = 'https://hook.eu1.make.com/n78xlbwx6483qv9v0eamw5th3sq20qak';
  var PROTETTI = [
    'hook.eu1.make.com/n78xlbwx6483qv9v0eamw5th3sq20qak',
    'hook.eu1.make.com/bbs0sa06xwkhxh5vd3ghyp7ss4rkjepm'
  ];

  function utenteCorrente() {
    try {
      if (window.netlifyIdentity && typeof netlifyIdentity.currentUser === 'function') {
        var u = netlifyIdentity.currentUser();
        if (u) return u;
      }
    } catch (e) {}
    try {
      if (window.netlifyIdentity && netlifyIdentity.gotrue && typeof netlifyIdentity.gotrue.currentUser === 'function') {
        var g = netlifyIdentity.gotrue.currentUser();
        if (g) return g;
      }
    } catch (e) {}
    try { if (typeof currentUser !== 'undefined' && currentUser) return currentUser; } catch (e) {}
    return null;
  }

  /* aspetta che il sistema di accesso Netlify sia pronto (max 5 secondi),
     altrimenti le prime richieste della pagina partirebbero senza pass */
  var identitaPronta = new Promise(function (ok) {
    var fatto = false;
    function via() { if (!fatto) { fatto = true; ok(); } }
    try { if (window.netlifyIdentity) netlifyIdentity.on('init', via); } catch (e) {}
    setTimeout(via, 5000);
  });

  async function tokenAccesso() {
    var u = utenteCorrente();
    if (!u) { await identitaPronta; u = utenteCorrente(); }
    if (!u) return null;
    try { if (typeof u.jwt === 'function') return await u.jwt(); } catch (e) {}
    try { if (u.token && u.token.access_token) return u.token.access_token; } catch (e) {}
    return null;
  }
  window.ectTokenAccesso = tokenAccesso;

  /* ---- 1) pass automatico su ogni richiesta verso Make ---- */
  var fetchPrecedente = window.fetch.bind(window);
  window.fetch = async function (url, opts) {
    try {
      var indirizzo = typeof url === 'string' ? url : ((url && url.url) || '');
      var protetto = PROTETTI.some(function (p) { return indirizzo.indexOf(p) !== -1; });
      if (protetto && !window.__ANTEPRIMA_SCUDO) {
        opts = Object.assign({}, opts || {});
        var corpo = {};
        if (typeof opts.body === 'string' && opts.body) {
          try { corpo = JSON.parse(opts.body); } catch (e) { corpo = {}; }
        }
        var tok = await tokenAccesso();
        if (tok) corpo.token = tok;
        opts.method = 'POST';
        opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        opts.body = JSON.stringify(corpo);
      }
    } catch (e) { /* in caso di problemi la richiesta parte comunque */ }
    return fetchPrecedente(url, opts);
  };

  if (!window.ECT_SOLO_GESTORI) return;

  /* ---- 2) lucchetto per le pagine dei gestori ---- */
  var STILE = '' +
    '#ect-lucchetto{position:fixed;inset:0;z-index:2147483000;background:#080d16;display:flex;align-items:center;justify-content:center;font-family:"DM Sans",system-ui,sans-serif;color:#f1f5f9;padding:20px;}' +
    '#ect-lucchetto .box{background:#0e1623;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:30px;width:100%;max-width:380px;}' +
    '#ect-lucchetto h2{font-size:20px;margin:0 0 6px;font-weight:800;}' +
    '#ect-lucchetto .sub{font-size:13px;color:rgba(241,245,249,0.55);margin-bottom:22px;line-height:1.5;}' +
    '#ect-lucchetto label{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(241,245,249,0.5);margin-bottom:7px;}' +
    '#ect-lucchetto .campo{position:relative;margin-bottom:16px;}' +
    '#ect-lucchetto input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:13px 44px 13px 14px;color:#f1f5f9;font-size:14px;outline:none;}' +
    '#ect-lucchetto input:focus{border-color:#3b82f6;}' +
    '#ect-lucchetto .occhio{position:absolute;right:13px;top:50%;transform:translateY(-50%);cursor:pointer;user-select:none;}' +
    '#ect-lucchetto button{width:100%;background:#3b82f6;color:#fff;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;}' +
    '#ect-lucchetto button.sec{background:rgba(255,255,255,0.08);margin-top:10px;}' +
    '#ect-lucchetto .err{color:#ef4444;font-size:12px;margin-top:10px;display:none;text-align:center;}' +
    '#ect-lucchetto .ok{color:#22c55e;font-size:13px;margin-top:10px;display:none;text-align:center;}' +
    '#ect-pill{position:fixed;left:14px;bottom:14px;z-index:2147482000;background:#0e1623;border:1px solid rgba(255,255,255,0.12);border-radius:30px;padding:7px 12px;font-family:"DM Sans",system-ui,sans-serif;font-size:12px;color:#f1f5f9;display:flex;gap:10px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,0.4);}' +
    '#ect-pill span.link{cursor:pointer;color:#60a5fa;}' +
    '#ect-pill span.esci{cursor:pointer;color:#ef4444;}';

  function occhio(idCampo) {
    return '<span class="occhio" onclick="var f=document.getElementById(\'' + idCampo + '\');f.type=f.type===\'password\'?\'text\':\'password\';">👁</span>';
  }

  function mostraSchermata(html) {
    var el = document.getElementById('ect-lucchetto');
    if (!el) {
      var st = document.createElement('style'); st.textContent = STILE; document.head.appendChild(st);
      el = document.createElement('div'); el.id = 'ect-lucchetto';
      document.body.appendChild(el);
    }
    el.innerHTML = '<div class="box">' + html + '</div>';
    el.style.display = 'flex';
  }

  function nascondiLucchetto() {
    var el = document.getElementById('ect-lucchetto');
    if (el) el.style.display = 'none';
  }

  function mostraAttesa() {
    mostraSchermata('<h2>🔒 Area Gestori</h2><div class="sub">Verifica dell\'accesso in corso...</div>');
  }

  function mostraLogin(messaggio) {
    mostraSchermata(
      '<h2>🔒 Area Gestori</h2>' +
      '<div class="sub">Accesso riservato ai gestori di EcoTruckConnect.</div>' +
      '<label>Email</label><div class="campo"><input type="email" id="ect-email" autocomplete="username" placeholder="la-tua@email.com"></div>' +
      '<label>Password</label><div class="campo"><input type="password" id="ect-pw" autocomplete="current-password" placeholder="••••••••">' + occhio('ect-pw') + '</div>' +
      '<button id="ect-entra">Entra →</button>' +
      '<div class="err" id="ect-err"></div>'
    );
    var err = document.getElementById('ect-err');
    if (messaggio) { err.textContent = messaggio; err.style.display = 'block'; }
    var entra = async function () {
      var email = document.getElementById('ect-email').value.trim();
      var pw = document.getElementById('ect-pw').value;
      err.style.display = 'none';
      if (!email || !pw) { err.textContent = 'Scrivi email e password.'; err.style.display = 'block'; return; }
      var b = document.getElementById('ect-entra'); b.disabled = true; b.textContent = 'Verifica...';
      try {
        await netlifyIdentity.gotrue.login(email, pw, true);
        window.location.reload();
      } catch (e) {
        b.disabled = false; b.textContent = 'Entra →';
        err.textContent = 'Email o password non corretti.'; err.style.display = 'block';
      }
    };
    document.getElementById('ect-entra').onclick = entra;
    document.getElementById('ect-pw').onkeydown = function (ev) { if (ev.key === 'Enter') entra(); };
    setTimeout(function () { var f = document.getElementById('ect-email'); if (f) f.focus(); }, 50);
  }

  function esciSubito() {
    var u = utenteCorrente();
    try { if (u && typeof u.logout === 'function') u.logout().catch(function () {}); } catch (e) {}
    try { netlifyIdentity.logout(); } catch (e) {}
    try { localStorage.removeItem('gotrue.user'); } catch (e) {}
    window.location.replace(window.location.pathname);
  }
  window.ectEsci = esciSubito;

  function mostraNonGestore(email) {
    mostraSchermata(
      '<h2>⛔ Accesso riservato</h2>' +
      '<div class="sub">L\'account <b>' + (email || '') + '</b> non è un gestore di EcoTruckConnect. Questa area è solo per i gestori.</div>' +
      '<button id="ect-esci">⏻ Esci e cambia account</button>'
    );
    document.getElementById('ect-esci').onclick = esciSubito;
  }

  function apriCambiaPassword() {
    mostraSchermata(
      '<h2>🔑 Cambia password</h2>' +
      '<div class="sub">Da ora entrerai con questa password. Almeno 8 caratteri.</div>' +
      '<label>Nuova password</label><div class="campo"><input type="password" id="ect-np1" autocomplete="new-password">' + occhio('ect-np1') + '</div>' +
      '<label>Conferma password</label><div class="campo"><input type="password" id="ect-np2" autocomplete="new-password">' + occhio('ect-np2') + '</div>' +
      '<button id="ect-salva">💾 Salva password</button>' +
      '<button class="sec" id="ect-annulla">Chiudi</button>' +
      '<div class="err" id="ect-err"></div><div class="ok" id="ect-ok">✅ Password salvata.</div>'
    );
    document.getElementById('ect-annulla').onclick = nascondiLucchetto;
    document.getElementById('ect-salva').onclick = async function () {
      var p1 = document.getElementById('ect-np1').value, p2 = document.getElementById('ect-np2').value;
      var err = document.getElementById('ect-err'); err.style.display = 'none';
      if (p1.length < 8) { err.textContent = 'Almeno 8 caratteri.'; err.style.display = 'block'; return; }
      if (p1 !== p2) { err.textContent = 'Le due password non coincidono.'; err.style.display = 'block'; return; }
      try {
        await utenteCorrente().update({ password: p1 });
        document.getElementById('ect-ok').style.display = 'block';
        document.getElementById('ect-salva').style.display = 'none';
      } catch (e) {
        err.textContent = 'Non sono riuscito a salvare. Esci, rientra e riprova.'; err.style.display = 'block';
      }
    };
  }

  function mostraPill(email) {
    if (document.getElementById('ect-pill')) return;
    var p = document.createElement('div'); p.id = 'ect-pill';
    p.innerHTML = '🔒 ' + email + ' · <span class="link" id="ect-pill-pw">🔑 Cambia password</span> · <span class="esci" id="ect-pill-esci">⏻ Esci</span>';
    document.body.appendChild(p);
    document.getElementById('ect-pill-pw').onclick = apriCambiaPassword;
    document.getElementById('ect-pill-esci').onclick = esciSubito;
  }

  async function verificaGestore() {
    try {
      var r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'whoami' }) });
      if (r.status === 401) { mostraLogin('Sessione scaduta: accedi di nuovo.'); return; }
      var d = await r.json();
      if (d && (d.gestore === true || d.gestore === 'true')) {
        nascondiLucchetto();
        mostraPill(d.email || '');
      } else {
        mostraNonGestore(d && d.email);
      }
    } catch (e) {
      mostraLogin('Non riesco a verificare l\'accesso. Controlla la connessione e riprova.');
    }
  }

  function avvia() {
    mostraAttesa();
    if (!window.netlifyIdentity) { mostraLogin('Sistema di accesso non caricato. Ricarica la pagina.'); return; }
    netlifyIdentity.on('init', function (u) { if (u) verificaGestore(); else mostraLogin(); });
    netlifyIdentity.init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})();
