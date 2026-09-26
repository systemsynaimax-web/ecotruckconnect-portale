/* =====================================================================
   ACCESSO SICURO — EcoTruckConnect (versione 2 — 26/9/2026)
   1) Aggiunge il "pass" di chi ha fatto l'accesso a ogni richiesta verso
      Make. Make risponde solo a chi ha fatto l'accesso, e a ognuno solo
      con i suoi dati.
   2) Google Authenticator (consigliato): chi lo attiva,
      a ogni accesso deve scrivere anche il codice dell'app.
   3) Striscia ROSSA = password temporanea da cambiare.
      Striscia GIALLA = ricorda di attivare Google Authenticator (con ✕,
      ricompare al prossimo accesso).
   4) "Password dimenticata" con codice via email: la password NON cambia
      finche' il proprietario non scrive il codice ricevuto.
   5) Pagine dei gestori (dashboard, report, registrazioni): entrano solo
      i gestori. Per attivarlo la pagina scrive, prima di questo file:
      <script>window.ECT_SOLO_GESTORI = true;</script>
   ===================================================================== */
(function () {
  var PROXY = 'https://hook.eu1.make.com/n78xlbwx6483qv9v0eamw5th3sq20qak';
  var PROTETTI = [
    'hook.eu1.make.com/n78xlbwx6483qv9v0eamw5th3sq20qak',
    'hook.eu1.make.com/bbs0sa06xwkhxh5vd3ghyp7ss4rkjepm'
  ];
  var AZIONI_PUBBLICHE = ['reset_richiedi', 'reset_conferma'];
  var FUNZIONE = '/.netlify/functions/sicurezza';
  var LINK_ANDROID = 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2';
  var LINK_IPHONE = 'https://apps.apple.com/app/google-authenticator/id388497605';
  var LIB_QR = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
  var GESTORI = !!window.ECT_SOLO_GESTORI;
  var fetchOriginale = window.fetch.bind(window);

  /* ================= UTENTE E PASS ================= */
  function utenteCorrente() {
    try { if (window.netlifyIdentity && typeof netlifyIdentity.currentUser === 'function') { var u = netlifyIdentity.currentUser(); if (u) return u; } } catch (e) {}
    try { if (window.netlifyIdentity && netlifyIdentity.gotrue && typeof netlifyIdentity.gotrue.currentUser === 'function') { var g = netlifyIdentity.gotrue.currentUser(); if (g) return g; } } catch (e) {}
    try { if (typeof currentUser !== 'undefined' && currentUser) return currentUser; } catch (e) {}
    return null;
  }
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

  /* ================= TICKET DEL CODICE DELL'APP ================= */
  function leggiTicket() { try { return JSON.parse(localStorage.getItem('ect_mfa_ticket') || 'null'); } catch (e) { return null; } }
  function salvaTicket(t) { try { localStorage.setItem('ect_mfa_ticket', JSON.stringify({ dati: t.ticket_dati, firma: t.ticket_firma, scade: t.scade })); } catch (e) {} }
  function ticketValido(email) {
    var t = leggiTicket(); if (!t || !t.dati) return false;
    var parti = String(t.dati).split('|');
    return parti[0] === String(email || '').toLowerCase() && Number(parti[1]) > Date.now() / 1000 + 60;
  }
  function pulisciSessione() {
    try { localStorage.removeItem('ect_mfa_ticket'); } catch (e) {}
    try { sessionStorage.removeItem('ect_giallo_chiuso'); sessionStorage.removeItem('ect_popup_mfa_visto'); } catch (e) {}
  }

  /* ================= CHIAMATA ALLA FUNZIONE DI SICUREZZA ================= */
  async function sicurezza(azione, extra) {
    var tok = await tokenAccesso();
    var r = await fetchOriginale(FUNZIONE, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(Object.assign({ azione: azione }, extra || {}))
    });
    try { return await r.json(); } catch (e) { return { ok: false, errore: 'risposta_non_valida' }; }
  }
  var statoPromessa = null;
  var statoCorrente = null;
  function leggiStato(forza) {
    if (!statoPromessa || forza) {
      statoPromessa = sicurezza('stato').then(function (s) {
        statoCorrente = (s && s.ok) ? s : null;
        if (statoCorrente) setTimeout(aggiornaInterfaccia, 0);
        return statoCorrente;
      }).catch(function () { return null; });
    }
    return statoPromessa;
  }

  var cancelloInCorso = null;
  async function garantisciCodice() {
    if (window.__ANTEPRIMA_SCUDO) return;
    var u = utenteCorrente(); if (!u) { await identitaPronta; u = utenteCorrente(); }
    if (!u) return;
    var st = await leggiStato();
    if (!st || !st.mfa_attivo) return;
    if (ticketValido(u.email)) return;
    if (!cancelloInCorso) cancelloInCorso = schermataCodice().then(function () { cancelloInCorso = null; });
    await cancelloInCorso;
  }

  /* ================= PASS AUTOMATICO SU OGNI RICHIESTA ================= */
  window.fetch = async function (url, opts) {
    try {
      var indirizzo = typeof url === 'string' ? url : ((url && url.url) || '');
      var protetto = PROTETTI.some(function (p) { return indirizzo.indexOf(p) !== -1; });
      if (protetto && !window.__ANTEPRIMA_SCUDO) {
        opts = Object.assign({}, opts || {});
        var corpo = {};
        if (typeof opts.body === 'string' && opts.body) { try { corpo = JSON.parse(opts.body); } catch (e) { corpo = {}; } }
        if (AZIONI_PUBBLICHE.indexOf(corpo.action) === -1) {
          await garantisciCodice();
          var tok = await tokenAccesso();
          if (tok) corpo.token = tok;
          var t = leggiTicket();
          if (t && t.dati) { corpo.ticket_dati = t.dati; corpo.ticket_firma = t.firma; }
        }
        opts.method = 'POST';
        opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        opts.body = JSON.stringify(corpo);
      }
    } catch (e) { /* in caso di problemi la richiesta parte comunque */ }
    return fetchOriginale(url, opts);
  };

  /* ================= GRAFICA COMUNE ================= */
  var STILE = '' +
    '.ect-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(8,13,22,0.94);display:flex;align-items:center;justify-content:center;font-family:"DM Sans",system-ui,sans-serif;color:#f1f5f9;padding:16px;overflow-y:auto;}' +
    '.ect-ov .box{background:#0e1623;border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:26px;width:100%;max-width:420px;margin:auto;}' +
    '.ect-ov h2{font-size:19px;margin:0 0 6px;font-weight:800;}' +
    '.ect-ov .sub{font-size:13px;color:rgba(241,245,249,0.65);margin-bottom:16px;line-height:1.55;}' +
    '.ect-ov label{display:block;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(241,245,249,0.5);margin-bottom:7px;}' +
    '.ect-ov .campo{position:relative;margin-bottom:14px;}' +
    '.ect-ov input{width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:13px 44px 13px 14px;color:#f1f5f9;font-size:15px;outline:none;}' +
    '.ect-ov input:focus{border-color:#3b82f6;}' +
    '.ect-ov input.codice{letter-spacing:8px;font-size:22px;text-align:center;padding:12px;}' +
    '.ect-ov .occhio{position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;user-select:none;background:#1e293b;color:#ffffff;border:1px solid rgba(255,255,255,0.35);border-radius:7px;padding:5px 8px;font-size:15px;line-height:1;}' +
    '.ect-ov button{width:100%;background:#3b82f6;color:#fff;border:none;border-radius:10px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;margin-top:4px;}' +
    '.ect-ov button.sec{background:rgba(255,255,255,0.08);margin-top:10px;}' +
    '.ect-ov a.bottone{display:block;text-align:center;background:#fff;color:#0e1623;border-radius:10px;padding:12px;font-weight:700;text-decoration:none;margin:8px 0;}' +
    '.ect-ov .passo{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin:12px 0;font-size:14px;line-height:1.55;}' +
    '.ect-ov .passo b{color:#fff;}' +
    '.ect-ov .qr{background:#fff;padding:8px;border-radius:8px;display:inline-block;margin:6px 6px 0 0;}' +
    '.ect-ov .qrs{display:flex;gap:10px;flex-wrap:wrap;}' +
    '.ect-ov .qrs div.et{font-size:12px;color:rgba(241,245,249,0.7);text-align:center;margin-top:4px;}' +
    '.ect-ov .chiave{font-family:monospace;font-size:13px;word-break:break-all;background:rgba(255,255,255,0.06);padding:8px 10px;border-radius:8px;margin-top:6px;user-select:all;}' +
    '.ect-ov .err{color:#f87171;font-size:13px;margin-top:10px;display:none;text-align:center;}' +
    '.ect-ov .ok{color:#4ade80;font-size:14px;margin-top:10px;display:none;text-align:center;line-height:1.5;}' +
    '.ect-ov .piccolo{font-size:12px;color:rgba(241,245,249,0.5);margin-top:14px;text-align:center;line-height:1.5;}' +
    '#ect-striscia-mfa{background:#f59e0b;color:#1c1917;padding:10px 44px 10px 20px;font-size:13px;font-weight:600;text-align:center;line-height:1.5;position:relative;z-index:2147481000;font-family:"DM Sans",system-ui,sans-serif;}' +
    '#ect-striscia-mfa button.att{margin-left:10px;background:#1c1917;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;}' +
    '#ect-striscia-mfa .x{position:absolute;right:14px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:18px;font-weight:700;}' +
    '#ect-striscia-rossa{background:#dc2626;color:#fff;padding:10px 20px;font-size:13px;font-weight:600;text-align:center;line-height:1.5;position:relative;z-index:2147481001;font-family:"DM Sans",system-ui,sans-serif;}' +
    '#ect-striscia-rossa button{margin-left:10px;background:#fff;color:#b91c1c;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;}' +
    '#banner-pw-temp{background:#dc2626 !important;color:#fff !important;position:relative;z-index:2147481001;}' +
    '#banner-pw-temp b{color:#fff !important;}' +
    '#banner-pw-temp button:first-of-type{background:#fff !important;color:#b91c1c !important;}' +
    '#banner-pw-temp button:nth-of-type(2){display:none !important;}' +
    '#ect-pill{position:fixed;left:14px;bottom:14px;z-index:2147482000;background:#0e1623;border:1px solid rgba(255,255,255,0.12);border-radius:30px;padding:7px 12px;font-family:"DM Sans",system-ui,sans-serif;font-size:12px;color:#f1f5f9;display:flex;gap:10px;align-items:center;flex-wrap:wrap;box-shadow:0 6px 20px rgba(0,0,0,0.4);}' +
    '#ect-pill span.link{cursor:pointer;color:#60a5fa;}' +
    '#ect-pill span.esci{cursor:pointer;color:#ef4444;}' +
    '#ect-blocco-sicurezza{margin:18px 0 10px;padding:14px;border:1px solid rgba(245,158,11,0.35);border-radius:10px;background:rgba(245,158,11,0.06);}';
  function stile() {
    if (document.getElementById('ect-stile')) return;
    var st = document.createElement('style'); st.id = 'ect-stile'; st.textContent = STILE; document.head.appendChild(st);
  }
  function occhio(id) {
    return '<span class="occhio" data-per="' + id + '" title="Mostra o nascondi la password">👁</span>';
  }
  function attivaOcchietti(radice) {
    (radice || document).querySelectorAll('.occhio[data-per]').forEach(function (o) {
      o.onclick = function () {
        var f = document.getElementById(o.getAttribute('data-per')); if (!f) return;
        f.type = f.type === 'password' ? 'text' : 'password';
        o.textContent = f.type === 'password' ? '👁' : '🙈';
      };
    });
  }
  function finestra(id, html) {
    stile();
    var el = document.getElementById(id);
    if (!el) { el = document.createElement('div'); el.id = id; el.className = 'ect-ov'; document.body.appendChild(el); }
    el.innerHTML = '<div class="box">' + html + '</div>';
    el.style.display = 'flex';
    attivaOcchietti(el);
    return el;
  }
  function chiudi(id) { var el = document.getElementById(id); if (el) el.remove(); }
  function mostraErr(el, testo) { el.textContent = testo; el.style.display = 'block'; }
  function dispositivo() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iphone';
    return 'computer';
  }
  function caricaQr() {
    return new Promise(function (ok, no) {
      if (window.QRCode) return ok();
      var s = document.createElement('script'); s.src = LIB_QR; s.onload = ok; s.onerror = no; document.head.appendChild(s);
    });
  }
  function disegnaQr(idEl, testo) {
    return caricaQr().then(function () {
      var el = document.getElementById(idEl); if (!el) return;
      el.innerHTML = '';
      new QRCode(el, { text: testo, width: 150, height: 150, correctLevel: QRCode.CorrectLevel.M });
    }).catch(function () {});
  }
  function esciSubito() {
    pulisciSessione();
    var u = utenteCorrente();
    try { if (u && typeof u.logout === 'function') u.logout().catch(function () {}); } catch (e) {}
    try { netlifyIdentity.logout(); } catch (e) {}
    try { localStorage.removeItem('gotrue.user'); } catch (e) {}
    window.location.replace(window.location.pathname);
  }
  window.ectEsci = esciSubito;

  /* ================= SCHERMATA "SCRIVI IL CODICE DELL'APP" ================= */
  function schermataCodice() {
    return new Promise(function (fatto) {
      finestra('ect-codice',
        '<h2>🛡️ Codice di Google Authenticator</h2>' +
        '<div class="sub">Apri <b>Google Authenticator</b> sul telefono e scrivi il codice di 6 numeri che vedi accanto a <b>EcoTruckConnect</b>.</div>' +
        '<div class="campo"><input class="codice" id="ect-cod-in" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></div>' +
        '<button id="ect-cod-ok">Conferma →</button>' +
        '<div class="err" id="ect-cod-err"></div>' +
        '<button class="sec" id="ect-cod-esci">⏻ Esci</button>' +
        '<div class="piccolo">Il codice cambia ogni 30 secondi: se non funziona, aspetta quello nuovo.<br>Hai perso o cambiato telefono? Scrivi a ecotruckconnect@synaimaxpro.com</div>');
      var inp = document.getElementById('ect-cod-in'), err = document.getElementById('ect-cod-err'), b = document.getElementById('ect-cod-ok');
      document.getElementById('ect-cod-esci').onclick = esciSubito;
      async function conferma() {
        err.style.display = 'none';
        var c = inp.value.replace(/\D/g, '');
        if (c.length !== 6) { mostraErr(err, 'Scrivi i 6 numeri che vedi nell\'app.'); return; }
        b.disabled = true; b.textContent = 'Verifica...';
        var r = await sicurezza('mfa_verifica', { codice: c }).catch(function () { return null; });
        b.disabled = false; b.textContent = 'Conferma →';
        if (r && r.ok) { salvaTicket(r); chiudi('ect-codice'); fatto(); return; }
        inp.value = '';
        if (r && r.errore === 'bloccato') mostraErr(err, 'Troppi codici sbagliati. Per sicurezza riprova tra ' + r.minuti + ' minuti.');
        else if (r && r.errore === 'codice_errato') mostraErr(err, 'Codice sbagliato. Tentativi rimasti: ' + r.tentativi_rimasti + '.');
        else mostraErr(err, 'Non riesco a verificare il codice. Controlla la connessione e riprova.');
      }
      b.onclick = conferma;
      inp.oninput = function () { if (inp.value.replace(/\D/g, '').length === 6) conferma(); };
      setTimeout(function () { inp.focus(); }, 60);
    });
  }

  /* ================= ATTIVAZIONE GOOGLE AUTHENTICATOR ================= */
  function apriAttivazione() {
    var disp = dispositivo();
    var passo1;
    if (disp === 'android') passo1 = '<a class="bottone" href="' + LINK_ANDROID + '" target="_blank" rel="noopener">📱 Scarica Google Authenticator (Android)</a>';
    else if (disp === 'iphone') passo1 = '<a class="bottone" href="' + LINK_IPHONE + '" target="_blank" rel="noopener">🍎 Scarica Google Authenticator (iPhone)</a>';
    else passo1 = 'Prendi il telefono e inquadra con la fotocamera il quadratino giusto:' +
      '<div class="qrs"><div><div class="qr" id="ect-qr-and"></div><div class="et">Android</div></div><div><div class="qr" id="ect-qr-ios"></div><div class="et">iPhone</div></div></div>';
    finestra('ect-attiva',
      '<h2>🛡️ Attiva Google Authenticator (consigliato)</h2>' +
      '<div class="sub">Per proteggere i tuoi dati. Segui questi passaggi.</div>' +
      '<div class="passo"><b>1. Scarica l\'app gratuita Google Authenticator</b> (produttore: Google LLC)<br>' + passo1 + '</div>' +
      '<div class="passo" id="ect-passo2"><b>2. Collega EcoTruckConnect all\'app</b><br><span style="color:rgba(241,245,249,0.6)">Preparazione...</span></div>' +
      '<div class="passo"><b>3. Scrivi il codice di 6 numeri che vedi nell\'app</b>' +
      '<div class="campo" style="margin-top:8px"><input class="codice" id="ect-att-in" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"></div></div>' +
      '<button id="ect-att-ok">✅ Attiva</button>' +
      '<div class="err" id="ect-att-err"></div>' +
      '<div class="ok" id="ect-att-fatto">✅ Google Authenticator attivo.<br>Da ora, per entrare servirà anche il codice dell\'app.</div>' +
      '<button class="sec" id="ect-att-chiudi">Più tardi</button>');
    if (disp === 'computer') { disegnaQr('ect-qr-and', LINK_ANDROID); disegnaQr('ect-qr-ios', LINK_IPHONE); }
    document.getElementById('ect-att-chiudi').onclick = function () { chiudi('ect-attiva'); };
    sicurezza('mfa_inizia').then(function (r) {
      var p2 = document.getElementById('ect-passo2'); if (!p2) return;
      if (!r || !r.ok) {
        if (r && r.errore === 'gia_attivo') { p2.innerHTML = '<b>La protezione è già attiva.</b>'; return; }
        p2.innerHTML = '<b>2. Collega EcoTruckConnect all\'app</b><br>Non riesco a preparare il collegamento. Chiudi e riprova tra poco.'; return;
      }
      var chiaveLeggibile = r.segreto.replace(/(.{4})/g, '$1 ').trim();
      if (disp === 'computer') {
        p2.innerHTML = '<b>2. Collega EcoTruckConnect all\'app</b><br>Apri Google Authenticator, tocca il <b>+</b>, poi <b>«Scansiona un codice QR»</b> e inquadra questo:' +
          '<div class="qr" id="ect-qr-mfa" style="margin-top:8px"></div>' +
          '<div style="margin-top:8px;font-size:12px;color:rgba(241,245,249,0.6)">Non riesci a inquadrarlo? Tocca «Inserisci una chiave di configurazione» e scrivi:</div><div class="chiave">' + chiaveLeggibile + '</div>';
        disegnaQr('ect-qr-mfa', r.otpauth);
      } else {
        p2.innerHTML = '<b>2. Collega EcoTruckConnect all\'app</b><br>Dopo averla installata, torna qui e tocca:' +
          '<a class="bottone" href="' + r.otpauth + '">➕ Aggiungi EcoTruckConnect all\'app</a>' +
          '<div style="font-size:12px;color:rgba(241,245,249,0.6)">Non si apre? Nell\'app tocca <b>+</b>, poi «Inserisci una chiave di configurazione» e scrivi:</div><div class="chiave">' + chiaveLeggibile + '</div>';
      }
    });
    var inp = document.getElementById('ect-att-in'), err = document.getElementById('ect-att-err'), b = document.getElementById('ect-att-ok');
    b.onclick = async function () {
      err.style.display = 'none';
      var c = inp.value.replace(/\D/g, '');
      if (c.length !== 6) { mostraErr(err, 'Scrivi i 6 numeri che vedi nell\'app.'); return; }
      b.disabled = true; b.textContent = 'Verifica...';
      var r = await sicurezza('mfa_conferma', { codice: c }).catch(function () { return null; });
      b.disabled = false; b.textContent = '✅ Attiva';
      if (r && r.ok) {
        salvaTicket(r);
        document.getElementById('ect-att-fatto').style.display = 'block';
        b.style.display = 'none';
        document.getElementById('ect-att-chiudi').textContent = 'Chiudi';
        if (statoCorrente) statoCorrente.mfa_attivo = true;
        aggiornaInterfaccia();
        return;
      }
      inp.value = '';
      if (r && r.errore === 'bloccato') mostraErr(err, 'Troppi codici sbagliati. Riprova tra ' + r.minuti + ' minuti.');
      else if (r && r.errore === 'codice_errato') mostraErr(err, 'Codice sbagliato. Controlla di leggere quello accanto a EcoTruckConnect. Tentativi rimasti: ' + r.tentativi_rimasti + '.');
      else if (r && r.errore === 'ricomincia') mostraErr(err, 'Il collegamento è scaduto: chiudi e riapri questa finestra.');
      else mostraErr(err, 'Non riesco a verificare il codice. Riprova.');
    };
  }
  window.ectApriAttivazione = apriAttivazione;

  function apriDisattivazione() {
    finestra('ect-disattiva',
      '<h2>Disattiva Google Authenticator</h2>' +
      '<div class="sub">Per sicurezza, scrivi il codice che vedi adesso nell\'app. Dopo, per entrare basterà la password.</div>' +
      '<div class="campo"><input class="codice" id="ect-dis-in" inputmode="numeric" maxlength="6" placeholder="000000"></div>' +
      '<button id="ect-dis-ok">Disattiva</button><div class="err" id="ect-dis-err"></div>' +
      '<button class="sec" id="ect-dis-chiudi">Annulla</button>');
    document.getElementById('ect-dis-chiudi').onclick = function () { chiudi('ect-disattiva'); };
    document.getElementById('ect-dis-ok').onclick = async function () {
      var err = document.getElementById('ect-dis-err'); err.style.display = 'none';
      var c = document.getElementById('ect-dis-in').value.replace(/\D/g, '');
      if (c.length !== 6) { mostraErr(err, 'Scrivi i 6 numeri dell\'app.'); return; }
      var r = await sicurezza('mfa_disattiva', { codice: c }).catch(function () { return null; });
      if (r && r.ok) { chiudi('ect-disattiva'); if (statoCorrente) statoCorrente.mfa_attivo = false; try { sessionStorage.removeItem('ect_giallo_chiuso'); } catch (e) {} aggiornaInterfaccia(); return; }
      if (r && r.errore === 'bloccato') mostraErr(err, 'Troppi codici sbagliati. Riprova tra ' + r.minuti + ' minuti.');
      else mostraErr(err, 'Codice sbagliato, riprova.');
    };
  }

  /* ================= STRISCE E RIQUADRI ================= */
  function contenitoreStrisce() {
    if (GESTORI) return document.body;
    return document.getElementById('app');
  }
  function aggiornaInterfaccia() {
    stile();
    var st = statoCorrente; if (!st) return;
    var cont = contenitoreStrisce(); if (!cont) return;

    // striscia gialla: Google Authenticator (consigliato)
    var gialla = document.getElementById('ect-striscia-mfa');
    var chiusa = false; try { chiusa = sessionStorage.getItem('ect_giallo_chiuso') === '1'; } catch (e) {}
    if (!st.mfa_attivo && !chiusa) {
      if (!gialla) {
        gialla = document.createElement('div'); gialla.id = 'ect-striscia-mfa';
        gialla.innerHTML = '🛡️ Attiva Google Authenticator per proteggere i tuoi dati (consigliato).' +
          '<button class="att" type="button">Attiva ora</button><span class="x" title="Chiudi">✕</span>';
        gialla.querySelector('.att').onclick = apriAttivazione;
        gialla.querySelector('.x').onclick = function () { try { sessionStorage.setItem('ect_giallo_chiuso', '1'); } catch (e) {} gialla.remove(); };
        var rossaPortale = document.getElementById('banner-pw-temp');
        var rossaGestori = document.getElementById('ect-striscia-rossa');
        var dopo = rossaGestori || rossaPortale;
        if (dopo && dopo.parentNode === cont) dopo.insertAdjacentElement('afterend', gialla);
        else cont.insertBefore(gialla, cont.firstChild);
      }
    } else if (gialla) gialla.remove();

    // striscia rossa per i gestori (nel portale c'e' gia' quella della pagina, colorata di rosso)
    if (GESTORI) {
      var rossa = document.getElementById('ect-striscia-rossa');
      if (st.pw_temporanea) {
        if (!rossa) {
          rossa = document.createElement('div'); rossa.id = 'ect-striscia-rossa';
          rossa.innerHTML = '🔒 Stai usando una <b>password temporanea</b>. Sceglierne una tua richiede 1 minuto.<button type="button">Cambia password</button>';
          rossa.querySelector('button').onclick = apriCambiaPasswordGestori;
          document.body.insertBefore(rossa, document.body.firstChild);
        }
      } else if (rossa) rossa.remove();
    }

    // riquadro nella sezione Sicurezza del portale
    var sez = document.getElementById('dash-sezione-sicurezza');
    if (sez) {
      var blocco = document.getElementById('ect-blocco-sicurezza');
      if (!blocco) {
        blocco = document.createElement('div'); blocco.id = 'ect-blocco-sicurezza';
        var h = sez.querySelector('h4');
        if (h) h.insertAdjacentElement('afterend', blocco); else sez.insertBefore(blocco, sez.firstChild);
      }
      if (st.mfa_attivo) {
        blocco.innerHTML = '<div style="color:#4ade80;font-size:13px;font-weight:600;margin-bottom:8px;">✅ Google Authenticator attivo</div>' +
          '<div style="color:var(--muted,#94a3b8);font-size:12px;margin-bottom:10px;">Per entrare serve anche il codice dell\'app.</div>' +
          '<button class="btn-cap" type="button" id="ect-btn-disattiva" style="background:rgba(255,255,255,0.08);">Disattiva</button>';
        document.getElementById('ect-btn-disattiva').onclick = apriDisattivazione;
      } else {
        blocco.innerHTML = '<div style="color:#fff;font-size:13px;font-weight:600;margin-bottom:6px;">🛡️ Google Authenticator (consigliato)</div>' +
          '<div style="color:var(--muted,#94a3b8);font-size:12px;line-height:1.6;margin-bottom:10px;">Per proteggere i tuoi dati. Una volta attivato, per entrare servirà anche il codice dell\'app.</div>' +
          '<button class="btn-cap" type="button" id="ect-btn-attiva">🛡️ Attiva ora</button>';
        document.getElementById('ect-btn-attiva').onclick = apriAttivazione;
      }
    }

    // riquadro "Proteggi il tuo accesso" una volta per accesso, dopo la scelta della password
    var visto = false; try { visto = sessionStorage.getItem('ect_popup_mfa_visto') === '1'; } catch (e) {}
    var pwTemp = !!st.pw_temporanea;
    var bannerPortale = document.getElementById('banner-pw-temp');
    if (bannerPortale && bannerPortale.style.display !== 'none') pwTemp = true;
    if (!st.mfa_attivo && !visto && !pwTemp) {
      try { sessionStorage.setItem('ect_popup_mfa_visto', '1'); } catch (e) {}
      var attendi = setInterval(function () {
        var m = document.getElementById('modal-cambia-pw');
        var aperto = m && m.style.display && m.style.display !== 'none';
        var altro = document.getElementById('ect-lucchetto') && document.getElementById('ect-lucchetto').style.display !== 'none';
        if (!aperto && !altro && !document.getElementById('ect-attiva')) { clearInterval(attendi); apriAttivazione(); }
      }, 1200);
    }
  }

  /* ================= PASSWORD DIMENTICATA CON CODICE VIA EMAIL ================= */
  function b64(testo) { return btoa(unescape(encodeURIComponent(testo))); }
  function disegnaPasswordDimenticata(cont, emailIniziale, dopoSuccesso) {
    cont.innerHTML =
      '<div id="ect-fp-a">' +
        '<div style="font-size:12px;color:rgba(241,245,249,0.6);margin-bottom:10px;line-height:1.5;">Scrivi la tua email: ti mandiamo un <b style="color:#fff">codice di 6 numeri</b>. La tua password <b style="color:#fff">non cambia</b> finché non scrivi il codice.</div>' +
        '<input type="email" id="ect-fp-email" class="lf-input" placeholder="la-tua@email.com" style="margin-bottom:10px;width:100%;box-sizing:border-box;">' +
        '<button class="btn-accedi" type="button" id="ect-fp-invia" style="padding:10px;font-size:13px;width:100%;">Inviami il codice</button>' +
      '</div>' +
      '<div id="ect-fp-b" style="display:none;">' +
        '<div style="font-size:12px;color:#4ade80;margin-bottom:10px;line-height:1.5;">✅ Se l\'email è registrata, ti abbiamo mandato un codice di 6 numeri (controlla anche lo spam). Vale 15 minuti.</div>' +
        '<input id="ect-fp-codice" class="lf-input" inputmode="numeric" maxlength="6" placeholder="Codice di 6 numeri" style="margin-bottom:10px;width:100%;box-sizing:border-box;letter-spacing:4px;">' +
        '<div class="pw-wrap" style="position:relative;"><input type="password" id="ect-fp-pw1" class="lf-input" placeholder="Nuova password (almeno 8 caratteri)" style="margin-bottom:10px;width:100%;box-sizing:border-box;"><span class="pw-eye" style="position:absolute;right:14px;top:40%;transform:translateY(-50%);cursor:pointer;" onclick="var f=document.getElementById(\'ect-fp-pw1\');f.type=f.type===\'password\'?\'text\':\'password\';">👁</span></div>' +
        '<div class="pw-wrap" style="position:relative;"><input type="password" id="ect-fp-pw2" class="lf-input" placeholder="Ripeti la nuova password" style="margin-bottom:10px;width:100%;box-sizing:border-box;"><span class="pw-eye" style="position:absolute;right:14px;top:40%;transform:translateY(-50%);cursor:pointer;" onclick="var f=document.getElementById(\'ect-fp-pw2\');f.type=f.type===\'password\'?\'text\':\'password\';">👁</span></div>' +
        '<button class="btn-accedi" type="button" id="ect-fp-salva" style="padding:10px;font-size:13px;width:100%;">💾 Salva la nuova password</button>' +
        '<div style="text-align:center;margin-top:10px;"><a href="#" id="ect-fp-nuovo" style="color:#60a5fa;font-size:12px;">Non è arrivato? Chiedi un nuovo codice</a></div>' +
      '</div>' +
      '<div id="ect-fp-ok" style="display:none;margin-top:10px;font-size:13px;color:#4ade80;line-height:1.5;">✅ Password cambiata. Ora accedi con la nuova password.</div>' +
      '<div id="ect-fp-err" style="display:none;margin-top:10px;font-size:12px;color:#f87171;line-height:1.5;"></div>';
    var em = cont.querySelector('#ect-fp-email'), err = cont.querySelector('#ect-fp-err');
    if (emailIniziale) em.value = emailIniziale;
    var emailUsata = '';
    function errore(t) { err.textContent = t; err.style.display = 'block'; }
    cont.querySelector('#ect-fp-invia').onclick = async function () {
      err.style.display = 'none';
      var e = em.value.trim();
      if (!e || e.indexOf('@') < 1 || e.indexOf('.') < 0) { errore('⚠️ Scrivi un\'email valida.'); return; }
      var b = this; b.disabled = true; b.textContent = 'Invio in corso...';
      try { await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_richiedi', email: e }) }); } catch (x) {}
      b.disabled = false; b.textContent = 'Inviami il codice';
      emailUsata = e;
      cont.querySelector('#ect-fp-a').style.display = 'none';
      cont.querySelector('#ect-fp-b').style.display = 'block';
      setTimeout(function () { cont.querySelector('#ect-fp-codice').focus(); }, 50);
    };
    cont.querySelector('#ect-fp-nuovo').onclick = function (ev) {
      ev.preventDefault();
      cont.querySelector('#ect-fp-b').style.display = 'none';
      cont.querySelector('#ect-fp-a').style.display = 'block';
      err.style.display = 'none';
    };
    cont.querySelector('#ect-fp-salva').onclick = async function () {
      err.style.display = 'none';
      var c = cont.querySelector('#ect-fp-codice').value.replace(/\D/g, '');
      var p1 = cont.querySelector('#ect-fp-pw1').value, p2 = cont.querySelector('#ect-fp-pw2').value;
      if (c.length !== 6) { errore('⚠️ Scrivi il codice di 6 numeri che hai ricevuto via email.'); return; }
      if (p1.length < 8) { errore('⚠️ La nuova password deve avere almeno 8 caratteri.'); return; }
      if (p1 !== p2) { errore('⚠️ Le due password non coincidono.'); return; }
      var b = this; b.disabled = true; b.textContent = 'Salvataggio...';
      var r = null;
      try {
        var risp = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_conferma', email: emailUsata, codice: c, password_b64: b64(p1) }) });
        r = await risp.json();
      } catch (x) { r = null; }
      b.disabled = false; b.textContent = '💾 Salva la nuova password';
      if (r && (r.ok === true || r.ok === 'true')) {
        cont.querySelector('#ect-fp-b').style.display = 'none';
        cont.querySelector('#ect-fp-ok').style.display = 'block';
        if (dopoSuccesso) dopoSuccesso(emailUsata);
        return;
      }
      var e2 = r && r.errore;
      if (e2 === 'codice_scaduto') errore('Il codice è scaduto. Chiedi un nuovo codice.');
      else if (e2 === 'troppi_tentativi') errore('Troppi tentativi sbagliati: il codice non vale più. Chiedi un nuovo codice.');
      else if (e2 === 'nessun_codice') errore('Nessun codice attivo per questa email. Chiedi un nuovo codice.');
      else if (e2 === 'password_corta') errore('La password deve avere almeno 8 caratteri.');
      else if (e2 === 'codice_errato') errore('Codice sbagliato.' + (r.tentativi_rimasti ? ' Tentativi rimasti: ' + r.tentativi_rimasti + '.' : ''));
      else errore('Codice sbagliato o non valido. Controlla e riprova.');
    };
  }

  /* ================= PORTALE: collegamenti alla pagina ================= */
  function agganciaPortale() {
    stile();
    // "Password dimenticata" con codice via email
    var box = document.getElementById('forgot-pw-box');
    if (box) {
      disegnaPasswordDimenticata(box, '', function (email) {
        var li = document.getElementById('li-email'); if (li) li.value = email;
        var pw = document.getElementById('li-pw'); if (pw) { pw.value = ''; pw.focus(); }
      });
    }
    window.richiediPasswordDimenticata = function () {};
    // uscita: pulisce anche il codice dell'app
    if (typeof window.doLogout === 'function' && !window.doLogout.__ect) {
      var vecchio = window.doLogout;
      window.doLogout = function () { pulisciSessione(); return vecchio.apply(this, arguments); };
      window.doLogout.__ect = true;
    }
    // "Collega Telegram": il pulsante deve portare il codice dell'utente,
    // altrimenti il bot non sa chi ha premuto "Avvia" e non collega niente
    setInterval(function () {
      var id = null;
      try { if (typeof trasportatoreRecordId !== 'undefined' && trasportatoreRecordId) id = trasportatoreRecordId; } catch (e) {}
      try { if (!id && typeof aziendaRecordId !== 'undefined' && aziendaRecordId) id = aziendaRecordId; } catch (e) {}
      if (!id || String(id).indexOf('preview') === 0) return;
      document.querySelectorAll('a[href^="https://t.me/SynAIMAX_EcoTruck_bot"]').forEach(function (a) {
        var giusto = 'https://t.me/SynAIMAX_EcoTruck_bot?start=' + id;
        if (a.getAttribute('href') !== giusto) a.setAttribute('href', giusto);
      });
    }, 1500);
    // appena si entra nel portale, controlla lo stato della protezione
    var app = document.getElementById('app');
    var controllo = setInterval(function () {
      if (app && app.style.display === 'block' && utenteCorrente()) {
        clearInterval(controllo);
        garantisciCodice().then(function () { return leggiStato(); });
      }
    }, 700);
  }

  if (!GESTORI) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agganciaPortale);
    else agganciaPortale();
    return;
  }

  /* ================= PAGINE DEI GESTORI ================= */
  function mostraLucchetto(html) { return finestra('ect-lucchetto', html); }
  function nascondiLucchetto() { var el = document.getElementById('ect-lucchetto'); if (el) el.style.display = 'none'; }

  function mostraLogin(messaggio) {
    mostraLucchetto(
      '<h2>🔒 Area Gestori</h2>' +
      '<div class="sub">Accesso riservato ai gestori di EcoTruckConnect.</div>' +
      '<label>Email</label><div class="campo"><input type="email" id="ect-email" autocomplete="username" placeholder="la-tua@email.com"></div>' +
      '<label>Password</label><div class="campo"><input type="password" id="ect-pw" autocomplete="current-password" placeholder="••••••••">' + occhio('ect-pw') + '</div>' +
      '<button id="ect-entra">Entra →</button>' +
      '<div class="err" id="ect-err"></div>' +
      '<div style="text-align:right;margin-top:12px;"><a href="#" id="ect-dimenticata" style="color:#60a5fa;font-size:12px;">Password dimenticata?</a></div>' +
      '<div id="ect-fp-box" style="display:none;margin-top:12px;"></div>'
    );
    var err = document.getElementById('ect-err');
    if (messaggio) mostraErr(err, messaggio);
    document.getElementById('ect-dimenticata').onclick = function (ev) {
      ev.preventDefault();
      var fb = document.getElementById('ect-fp-box');
      fb.style.display = fb.style.display === 'none' ? 'block' : 'none';
      if (!fb.innerHTML) disegnaPasswordDimenticata(fb, document.getElementById('ect-email').value.trim(), function (email) {
        document.getElementById('ect-email').value = email; document.getElementById('ect-pw').value = '';
      });
    };
    var entra = async function () {
      var email = document.getElementById('ect-email').value.trim();
      var pw = document.getElementById('ect-pw').value;
      err.style.display = 'none';
      if (!email || !pw) { mostraErr(err, 'Scrivi email e password.'); return; }
      var b = document.getElementById('ect-entra'); b.disabled = true; b.textContent = 'Verifica...';
      try {
        pulisciSessione();
        await netlifyIdentity.gotrue.login(email, pw, true);
        window.location.reload();
      } catch (e) {
        b.disabled = false; b.textContent = 'Entra →';
        mostraErr(err, 'Email o password non corretti.');
      }
    };
    document.getElementById('ect-entra').onclick = entra;
    document.getElementById('ect-pw').onkeydown = function (ev) { if (ev.key === 'Enter') entra(); };
    setTimeout(function () { var f = document.getElementById('ect-email'); if (f) f.focus(); }, 50);
  }

  function mostraNonGestore(email) {
    mostraLucchetto(
      '<h2>⛔ Accesso riservato</h2>' +
      '<div class="sub">L\'account <b>' + (email || '') + '</b> non è un gestore di EcoTruckConnect. Questa area è solo per i gestori.</div>' +
      '<button id="ect-esci">⏻ Esci e cambia account</button>'
    );
    document.getElementById('ect-esci').onclick = esciSubito;
  }

  function apriCambiaPasswordGestori() {
    finestra('ect-cambia-pw',
      '<h2>🔑 Cambia password</h2>' +
      '<div class="sub">Da ora entrerai con questa password. Almeno 8 caratteri.</div>' +
      '<label>Nuova password</label><div class="campo"><input type="password" id="ect-np1" autocomplete="new-password">' + occhio('ect-np1') + '</div>' +
      '<label>Conferma password</label><div class="campo"><input type="password" id="ect-np2" autocomplete="new-password">' + occhio('ect-np2') + '</div>' +
      '<button id="ect-salva">💾 Salva password</button>' +
      '<button class="sec" id="ect-annulla">Chiudi</button>' +
      '<div class="err" id="ect-err2"></div><div class="ok" id="ect-ok2">✅ Password salvata.</div>'
    );
    document.getElementById('ect-annulla').onclick = function () { chiudi('ect-cambia-pw'); };
    document.getElementById('ect-salva').onclick = async function () {
      var p1 = document.getElementById('ect-np1').value, p2 = document.getElementById('ect-np2').value;
      var err = document.getElementById('ect-err2'); err.style.display = 'none';
      if (p1.length < 8) { mostraErr(err, 'Almeno 8 caratteri.'); return; }
      if (p1 !== p2) { mostraErr(err, 'Le due password non coincidono.'); return; }
      try {
        await utenteCorrente().update({ password: p1 });
        await sicurezza('password_cambiata').catch(function () {});
        if (statoCorrente) statoCorrente.pw_temporanea = false;
        aggiornaInterfaccia();
        document.getElementById('ect-ok2').style.display = 'block';
        document.getElementById('ect-salva').style.display = 'none';
      } catch (e) {
        mostraErr(err, 'Non sono riuscito a salvare. Esci, rientra e riprova.');
      }
    };
  }

  function mostraPill(email) {
    if (document.getElementById('ect-pill')) return;
    var p = document.createElement('div'); p.id = 'ect-pill';
    p.innerHTML = '🔒 ' + email + ' · <span class="link" id="ect-pill-pw">🔑 Cambia password</span> · <span class="link" id="ect-pill-mfa">🛡️ Google Authenticator</span> · <span class="esci" id="ect-pill-esci">⏻ Esci</span>';
    document.body.appendChild(p);
    document.getElementById('ect-pill-pw').onclick = apriCambiaPasswordGestori;
    document.getElementById('ect-pill-mfa').onclick = function () { if (statoCorrente && statoCorrente.mfa_attivo) apriDisattivazione(); else apriAttivazione(); };
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
        leggiStato().then(aggiornaInterfaccia);
      } else {
        mostraNonGestore(d && d.email);
      }
    } catch (e) {
      mostraLogin('Non riesco a verificare l\'accesso. Controlla la connessione e riprova.');
    }
  }

  function avvia() {
    mostraLucchetto('<h2>🔒 Area Gestori</h2><div class="sub">Verifica dell\'accesso in corso...</div>');
    if (!window.netlifyIdentity) { mostraLogin('Sistema di accesso non caricato. Ricarica la pagina.'); return; }
    netlifyIdentity.on('init', function (u) { if (u) verificaGestore(); else mostraLogin(); });
    netlifyIdentity.init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})();
