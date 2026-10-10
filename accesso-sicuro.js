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
  /* 27/9: queste 7 letture nel Proxy principale rispondevano sempre vuote.
     Ora le fa lo scenario "Proxy Liste" (stessi controlli di sicurezza: accesso,
     Google Authenticator, gestori). Il file le manda li' automaticamente. */
  var PROXY_LISTE = 'https://hook.eu1.make.com/nqp4yjmtegxakql7a24sqvpit0vjcpjw';
  var AZIONI_LISTE = ['get_carichi_pubblicati_azienda', 'get_candidature_trasportatore', 'conta_trasportatori_compatibili',
                      'get_dashboard_data', 'get_candidature', 'get_scadenze', 'get_registrazioni',
                      'modifica_carico', 'annulla_carico', 'richiedi_annullamento'];
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

  /* La finestra di accesso di Netlify (un riquadro trasparente grande quanto lo
     schermo) a volte resta aperta da sola e si prende TUTTI i clic della pagina.
     Noi non la usiamo (abbiamo le nostre schermate), quindi la rendiamo sempre
     invisibile e non cliccabile, da subito. */
  (function () {
    var st = document.createElement('style');
    st.textContent = '#netlify-identity-widget{visibility:hidden !important;pointer-events:none !important;}';
    (document.head || document.documentElement).appendChild(st);
    function chiudiNetlify() { try { if (window.netlifyIdentity && typeof netlifyIdentity.close === 'function') netlifyIdentity.close(); } catch (e) {} }
    try { if (window.netlifyIdentity) { netlifyIdentity.on('init', chiudiNetlify); netlifyIdentity.on('login', chiudiNetlify); netlifyIdentity.on('open', function () { setTimeout(chiudiNetlify, 0); }); } } catch (e) {}
    setTimeout(chiudiNetlify, 800); setTimeout(chiudiNetlify, 2500);
  })();

  /* ================= UTENTE E PASS ================= */
  function utenteCorrente() {
    try { if (window.netlifyIdentity && typeof netlifyIdentity.currentUser === 'function') { var u = netlifyIdentity.currentUser(); if (u) return u; } } catch (e) {}
    try { if (window.netlifyIdentity && netlifyIdentity.gotrue && typeof netlifyIdentity.gotrue.currentUser === 'function') { var g = netlifyIdentity.gotrue.currentUser(); if (g) return g; } } catch (e) {}
    try { if (typeof currentUser !== 'undefined' && currentUser) return currentUser; } catch (e) {}
    return null;
  }
  /* aspetta che il sistema di accesso Netlify sia pronto. Attenzione: il sistema
     di Netlify puo' avviarsi PRIMA di questo file, quindi non basta aspettare il
     suo segnale "init": controllo anche direttamente, ogni 150 ms, fino a 5 secondi */
  var identitaPronta = new Promise(function (ok) {
    var fatto = false;
    function via() { if (!fatto) { fatto = true; ok(); } }
    try { if (window.netlifyIdentity) netlifyIdentity.on('init', via); } catch (e) {}
    var giri = 0;
    var controllo = setInterval(function () {
      giri++;
      if (utenteCorrente() || giri > 33) { clearInterval(controllo); via(); }
    }, 150);
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
    try { sessionStorage.removeItem('ect_giallo_chiuso'); sessionStorage.removeItem('ect_popup_mfa_visto'); sessionStorage.removeItem('ect_popup_pw_visto'); } catch (e) {}
  }

  /* ================= CHIAMATA ALLA FUNZIONE DI SICUREZZA ================= */
  async function sicurezza(azione, extra) {
    if (window.__ANTEPRIMA_SCUDO) {
      if (azione === 'stato') return { ok: true, email: 'anteprima@ecotruckconnect.it', mfa_attivo: false, pw_temporanea: true };
      if (azione === 'mfa_inizia') return { ok: true, segreto: 'ANTEPRIMAANTEPRIMAAB', otpauth: 'otpauth://totp/EcoTruckConnect:anteprima?secret=ANTEPRIMAANTEPRIMAAB&issuer=EcoTruckConnect' };
      return { ok: false, errore: 'anteprima' };
    }
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

  /* ================= ASSISTENTE VIRTUALE: informazioni aggiornate (27/9) =================
     Il Proxy ha un testo base. Qui aggiungiamo, a ogni domanda, le informazioni vere
     del portale (diverse per trasportatore e azienda) e puliamo la domanda da
     virgolette e a capo, che prima rompevano il messaggio. */
  var BOT_COMUNE = [
    'ISTRUZIONI: rispondi in italiano, semplice e diretto, massimo 6 frasi, solo testo semplice senza asterischi, senza grassetto e senza elenchi puntati, indicando il percorso esatto nel portale con i nomi dei pulsanti tra « ». Usa solo queste informazioni; se non sai una cosa, di di scrivere al supporto. Non chiedere mai password o codici.',
    'SEI un assistente basato su intelligenza artificiale, non una persona.',
    'ACCESSO: si entra con email e password. Il primo accesso usa una password temporanea ricevuta per email: compare una striscia rossa e si apre la finestra «Scegli la tua password»; si puo premere «Piu tardi». Per cambiarla quando vuoi: menu «Dashboard» e poi «Sicurezza» e poi «Cambia password».',
    'PASSWORD DIMENTICATA: nella pagina di accesso clicca «Password dimenticata», scrivi la tua email, ricevi per email un codice di 6 numeri valido 15 minuti, poi scrivi codice e nuova password. Massimo 3 codici al giorno.',
    'GOOGLE AUTHENTICATOR (consigliato, non obbligatorio): striscia gialla «Attiva ora» oppure «Dashboard» e poi «Sicurezza». Si scarica l app gratuita Google Authenticator, dal computer si inquadra il quadratino QR, dal telefono si tocca il pulsante per aggiungere EcoTruckConnect, poi si scrive il codice di 6 numeri e si preme «Attiva». Da quel momento a ogni accesso serve anche il codice dell app. Se cambi o perdi il telefono scrivi al supporto.',
    'PAGAMENTI: iscrizione 150 euro all anno per trasportatori e aziende, con link di pagamento via email dopo la verifica dei dati. Il trasportatore paga 20 euro per ogni carico che prende. Per le aziende pubblicare i carichi e gratuito. Si paga su pagina sicura Shopify. Prima della scadenza annuale arriva un promemoria per email.',
    'RIEPILOGO: menu «Dashboard» e poi «Riepilogo movimenti» per vedere i movimenti; non e una fattura fiscale. «I miei report» mostra numeri e un grafico mese per mese. «Modifica i miei dati» per aggiornare i dati. In «Sicurezza» c e anche «Elimina il mio account».',
    'PRIVACY E REGOLE: il portale e privato, nessuno vede i dati degli altri. SynAIMAX mette in contatto aziende e trasportatori ma non e parte del contratto di trasporto: il prezzo del trasporto si accorda e si paga direttamente tra azienda e trasportatore.',
    'SUPPORTO: modulo «Scrivici» nel portale oppure email ecotruckconnect@synaimaxpro.com. Modifica o annullamento di un carico: per ora scrivere al supporto.'
  ].join(' ');
  var BOT_TRASPORTATORE = [
    'L UTENTE E UN TRASPORTATORE.',
    'PROFILO: nei riquadri «I miei mezzi» e «Le mie autorizzazioni» indica tutti i mezzi che hai e le autorizzazioni (conto terzi, rifiuti, ADR e altre), poi salva. Il sistema ti mostra e ti notifica solo i carichi compatibili con il tuo profilo.',
    'TELEGRAM: menu «Dashboard» e poi «Notifiche» e poi «Collega Telegram»: si apre il bot, premi Avvia. Da quel momento ricevi in privato i carichi compatibili.',
    'PRENDERE UN CARICO: nella lista «Carichi Disponibili» o nel «Calendario Carichi» clicca il carico blu, poi «Prendi», conferma e paga 20 euro entro 5 minuti. Se non paghi in tempo il carico torna disponibile per gli altri. Colori: blu disponibile, arancione qualcuno sta pagando, rosso gia preso. Dopo il pagamento il carico e tuo e ricevi la conferma.'
  ].join(' ');
  var BOT_AZIENDA = [
    'L UTENTE E UN AZIENDA.',
    'PUBBLICARE UN CARICO (gratis): riquadro «Pubblica un Carico»: CAP e citta di partenza e arrivo, data, tipo di merce, specifica, note, se e un rifiuto (serve il codice CER) o se e pericoloso, il tipo di mezzo richiesto e l autorizzazione richiesta; poi «Pubblica Carico». Si puo anche cliccare un giorno del «Calendario Carichi» per precompilare la data.',
    'DOPO LA PUBBLICAZIONE: il carico arriva solo ai trasportatori con mezzo e autorizzazioni compatibili, anche su Telegram. Quando un trasportatore lo prende e paga, il carico diventa rosso (preso). Lo stato dei carichi si vede in «Riepilogo movimenti» e nel calendario.'
  ].join(' ');
  function pulisciTesto(t) { return String(t || '').replace(/["\\]/g, "'").replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim(); }
  function componiDomandaBot(domanda) {
    var tipo = ''; try { tipo = (typeof tipoUtente !== 'undefined' && tipoUtente) ? tipoUtente : ''; } catch (e) {}
    var ruolo = tipo === 'azienda' ? BOT_AZIENDA : (tipo === 'trasportatore' ? BOT_TRASPORTATORE : (BOT_TRASPORTATORE + ' ' + BOT_AZIENDA));
    return pulisciTesto('INFORMAZIONI AGGIORNATE DEL PORTALE: ' + BOT_COMUNE + ' ' + ruolo + ' DOMANDA DELL UTENTE: ' + pulisciTesto(domanda).slice(0, 800));
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
        if (corpo.action === 'chat_bot' && typeof corpo.message === 'string') corpo.message = componiDomandaBot(corpo.message);
        if (AZIONI_LISTE.indexOf(corpo.action) !== -1 && indirizzo.indexOf('n78xlbwx6483qv9v0eamw5th3sq20qak') !== -1) url = PROXY_LISTE;
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
    var eraBot = false; try { eraBot = !!(opts && typeof opts.body === 'string' && opts.body.indexOf('"action":"chat_bot"') !== -1); } catch (e) {}
    var risposta = await fetchOriginale(url, opts);
    if (!eraBot) return risposta;
    // risposta dell'assistente: tolgo asterischi e simboli di formattazione
    try {
      var dati = await risposta.clone().json();
      if (dati && typeof dati.reply === 'string') {
        dati.reply = dati.reply.replace(/\*\*|__/g, '').replace(/^\s*[#>]+\s*/gm, '').replace(/^\s*[-*•]\s+/gm, '• ');
        return new Response(JSON.stringify(dati), { status: risposta.status, headers: { 'Content-Type': 'application/json' } });
      }
    } catch (e) {}
    return risposta;
  };

  /* ================= GRAFICA COMUNE ================= */
  var STILE = '' +
    '#netlify-identity-widget{visibility:hidden !important;pointer-events:none !important;}' +
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
    '#ect-striscia-mfa{background:#f59e0b;color:#1c1917;padding:10px 44px 10px 20px;font-size:13px;font-weight:600;text-align:center;line-height:1.5;position:relative;z-index:60;font-family:"DM Sans",system-ui,sans-serif;}' +
    '#ect-striscia-mfa button.att{margin-left:10px;background:#1c1917;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;}' +
    '#ect-striscia-mfa .x{position:absolute;right:14px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:18px;font-weight:700;}' +
    '#ect-striscia-rossa{background:#dc2626;color:#fff;padding:10px 20px;font-size:13px;font-weight:600;text-align:center;line-height:1.5;position:relative;z-index:61;font-family:"DM Sans",system-ui,sans-serif;}' +
    '#ect-striscia-rossa button{margin-left:10px;background:#fff;color:#b91c1c;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;}' +
    '#ect-striscia-rossa button.dopo{margin-left:6px;background:transparent;color:#fff;border:1px solid #fff;font-weight:600;}' +
    '#banner-pw-temp{background:#dc2626 !important;color:#fff !important;position:relative;z-index:61;}' +
    '#banner-pw-temp b{color:#fff !important;}' +
    '#banner-pw-temp button:first-of-type{background:#fff !important;color:#b91c1c !important;}' +
    '#banner-pw-temp button:nth-of-type(2){background:transparent !important;color:#fff !important;border:1px solid #fff !important;}' +
    '#ect-pill{position:relative;z-index:59;background:#0e1623;border-bottom:1px solid rgba(255,255,255,0.12);padding:7px 20px;font-family:"DM Sans",system-ui,sans-serif;font-size:12px;color:#f1f5f9;display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;}' +
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
    // clic sullo sfondo scuro, fuori dal riquadro = chiude
    var sfondo = document.getElementById('ect-attiva');
    if (sfondo) sfondo.onclick = function (ev) { if (ev.target === sfondo) chiudi('ect-attiva'); };
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
      else if (r && r.errore === 'anteprima') mostraErr(err, '🎭 Anteprima: qui l\'utente vero attiva Google Authenticator.');
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
        var barra = document.getElementById('ect-pill');
        if (barra && barra.parentNode === cont) gialla.insertAdjacentElement('afterend', barra);
      }
    } else if (gialla) gialla.remove();

    // striscia rossa per i gestori (nel portale c'e' gia' quella della pagina, colorata di rosso)
    if (GESTORI) {
      var rossa = document.getElementById('ect-striscia-rossa');
      if (st.pw_temporanea) {
        if (!rossa) {
          rossa = document.createElement('div'); rossa.id = 'ect-striscia-rossa';
          rossa.innerHTML = '🔒 Stai usando una <b>password temporanea</b>. Per sicurezza scegline una tua.<button type="button" class="cambia">Cambia password</button><button type="button" class="dopo">Più tardi</button>';
          rossa.querySelector('.cambia').onclick = apriCambiaPasswordGestori;
          rossa.querySelector('.dopo').onclick = function () { rossa.style.display = 'none'; };
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

    // Google Authenticator: NESSUNA finestra automatica. Si apre solo cliccando
    // "Attiva ora" (striscia gialla o sezione Sicurezza).

    // Password temporanea: la finestra "Scegli la tua password" si apre da sola,
    // una volta per accesso (con il pulsante "Più tardi")
    var pwVista = false; try { pwVista = sessionStorage.getItem('ect_popup_pw_visto') === '1'; } catch (e) {}
    if (!pwVista) {
      if (GESTORI && st.pw_temporanea) {
        try { sessionStorage.setItem('ect_popup_pw_visto', '1'); } catch (e) {}
        apriCambiaPasswordGestori();
      }
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
    // "Rigenera password" non serve piu': resta solo "Cambia password"
    function togliRigenera() {
      document.querySelectorAll('button[onclick="rigeneraPassword()"]').forEach(function (b) {
        var prima = b.previousElementSibling;
        if (prima && /Rigenera password/i.test(prima.textContent)) prima.style.display = 'none';
        b.style.display = 'none';
      });
      ['rigenera-pw-msg', 'pw-ultima-modifica'].forEach(function (id) { var e = document.getElementById(id); if (e) e.style.setProperty('display', 'none', 'important'); });
    }
    togliRigenera(); setTimeout(togliRigenera, 1500);
    // password temporanea: appena compare la striscia rossa, si apre da sola la
    // finestra "Scegli la tua password" (una volta per accesso, con "Più tardi")
    var guardaPw = setInterval(function () {
      var br = document.getElementById('banner-pw-temp');
      var app = document.getElementById('app');
      if (!br || !app || app.style.display !== 'block') return;
      if (br.style.display !== 'block') return;
      clearInterval(guardaPw);
      var vista = false; try { vista = sessionStorage.getItem('ect_popup_pw_visto') === '1'; } catch (e) {}
      var m = document.getElementById('modal-cambia-pw');
      var conSezione = false; try { conSezione = !!new URLSearchParams(location.search).get('apri'); } catch (e) {}
      if (!vista && !conSezione && m && m.style.display !== 'flex' && typeof apriCambiaPassword === 'function') {
        try { sessionStorage.setItem('ect_popup_pw_visto', '1'); } catch (e) {}
        apriCambiaPassword();
      }
    }, 500);
    // CAP -> CITTA' (27/9): nel modulo "Pubblica un Carico", scrivendo il CAP la citta' si compila da sola
    var capPronto = null;
    function caricaCap() {
      if (window.ECT_CAP) return Promise.resolve();
      if (capPronto) return capPronto;
      capPronto = new Promise(function (ok, no) {
        var sc = document.createElement('script'); sc.src = '/cap-comuni.js';
        sc.onload = ok; sc.onerror = function () { capPronto = null; no(); }; document.head.appendChild(sc);
      });
      return capPronto;
    }
    function collegaCap(idCap, idCitta) {
      var inCap = document.getElementById(idCap), inCitta = document.getElementById(idCitta);
      if (!inCap || !inCitta || inCap.__ectCap) return;
      inCap.__ectCap = true;
      var nota = document.createElement('div');
      nota.style.cssText = 'font-size:12px;color:#86efac;margin-top:5px;min-height:16px;';
      inCap.insertAdjacentElement('afterend', nota);
      var autoMessa = '';
      function scegli(nome) { inCitta.value = nome; autoMessa = nome; inCitta.dispatchEvent(new Event('input', { bubbles: true })); }
      inCap.addEventListener('input', function () {
        var v = inCap.value.replace(/\D/g, '');
        if (v.length !== 5) { nota.textContent = ''; return; }
        caricaCap().then(function () {
          var r = window.ECT_CAP[v];
          if (!r) { nota.style.color = '#fbbf24'; nota.textContent = 'CAP non trovato: scrivi la città a mano.'; return; }
          var lista = Array.isArray(r) ? r : [r];
          var primo = lista[0].split('|');
          if (!inCitta.value.trim() || inCitta.value === autoMessa) scegli(primo[0]);
          nota.style.color = '#86efac';
          nota.innerHTML = '';
          var testo = document.createElement('span'); testo.textContent = '📍 ' + primo[0] + ' (' + primo[1] + ')'; nota.appendChild(testo);
          if (lista.length > 1) {
            var alt = document.createElement('span'); alt.textContent = '  · altri comuni con questo CAP: '; alt.style.color = 'rgba(241,245,249,0.6)'; nota.appendChild(alt);
            lista.slice(1, 8).forEach(function (x, i) {
              var q = x.split('|'), a = document.createElement('a');
              a.href = '#'; a.textContent = q[0] + ' (' + q[1] + ')'; a.style.cssText = 'color:#93c5fd;margin-right:8px;';
              a.onclick = function (e) { e.preventDefault(); scegli(q[0]); testo.textContent = '📍 ' + q[0] + ' (' + q[1] + ')'; };
              nota.appendChild(a);
            });
          }
        }).catch(function () { nota.textContent = ''; });
      });
    }
    var giriCap = 0;
    var aspettaCap = setInterval(function () {
      giriCap++;
      if (document.getElementById('ins-cap-part')) { collegaCap('ins-cap-part', 'ins-citta-part'); collegaCap('ins-cap-arr', 'ins-citta-arr'); clearInterval(aspettaCap); }
      else if (giriCap > 60) clearInterval(aspettaCap);
    }, 500);

    // GRAFICI NEI REPORT DEL PORTALE (27/9): sotto "📈 I miei report", mese per mese
    function caricaChart() {
      return new Promise(function (ok, no) {
        if (window.Chart) return ok();
        var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
        sc.onload = ok; sc.onerror = no; document.head.appendChild(sc);
      });
    }
    var graficoPortale = null;
    function disegnaGraficoPortale() {
      var cards = document.getElementById('report-cards'); if (!cards) return;
      var box = document.getElementById('ect-grafico-report');
      if (!box) {
        box = document.createElement('div'); box.id = 'ect-grafico-report';
        box.style.cssText = 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px;margin:4px 0 10px;';
        box.innerHTML = '<div id="ect-graf-titolo" style="color:#fff;font-weight:700;font-size:13px;margin-bottom:2px;"></div><div id="ect-graf-nota" style="color:rgba(241,245,249,0.5);font-size:12px;margin-bottom:8px;"></div><div style="position:relative;height:220px;"><canvas id="ect-graf-canvas"></canvas></div>';
        cards.insertAdjacentElement('afterend', box);
      }
      var mesi = []; var o = new Date(); for (var i = 5; i >= 0; i--) mesi.push(new Date(o.getFullYear(), o.getMonth() - i, 1));
      var nomi = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
      var etichette = mesi.map(function (m) { return nomi[m.getMonth()] + ' ' + String(m.getFullYear()).slice(2); });
      function perMese(date) { var v = mesi.map(function () { return 0; }); date.forEach(function (x) { if (!x) return; var d = new Date(x.d || x); if (isNaN(d)) return; var k = mesi.findIndex(function (m) { return m.getFullYear() === d.getFullYear() && m.getMonth() === d.getMonth(); }); if (k >= 0) v[k] += (x.n != null ? x.n : 1); }); return v; }
      var azienda = false; try { azienda = (typeof tipoUtente !== 'undefined' && tipoUtente === 'azienda'); } catch (e) {}
      var serie, titolo, nota = '', finti = false;
      if (azienda) {
        var tutti = []; try { tutti = carichiPubblicatiAzienda || []; } catch (e) {}
        var f = tutti.map(function (c) { return c.fields || c; });
        var pub = perMese(f.map(function (x) { return x.data_pubblicazione || x.createdTime; }));
        var pre = perMese(f.filter(function (x) { return String(x.stato || '').toUpperCase() === 'PRESO'; }).map(function (x) { return x.data_assegnato || x.data_pubblicazione; }));
        if (window.__ANTEPRIMA_SCUDO && pub.every(function (n) { return !n; })) { pub = [3, 5, 4, 7, 6, 9]; pre = [2, 4, 3, 6, 5, 7]; finti = true; }
        titolo = '📊 I miei carichi, mese per mese';
        serie = [{ label: 'Pubblicati', data: pub, backgroundColor: '#3b82f6', yAxisID: 'y' }, { label: 'Presi', data: pre, backgroundColor: '#22c55e', yAxisID: 'y' }];
      } else {
        var cands = []; try { cands = ultimeCandidature || []; } catch (e) {}
        var fatti = cands.map(function (c) { return c.fields || c; }).filter(function (x) { var st = String(x.stato || '').toLowerCase(); return st.indexOf('complet') >= 0 || st.indexOf('accett') >= 0 || st.indexOf('pagat') >= 0 || st === 'preso'; });
        var quando = function (x) { return x.data_assegnato || x.data_candidatura || x.data_pubblicazione; };
        var num = perMese(fatti.map(quando));
        var imp = function (v) { try { return parseImportoPattuito(v); } catch (e) { return parseFloat(String(v || '0').replace(/[^0-9,.-]/g, '').replace(',', '.')) || 0; } };
        var eur = perMese(fatti.map(function (x) { return { d: quando(x), n: imp(x.importo_pattuito) }; }));
        if (window.__ANTEPRIMA_SCUDO && num.every(function (n) { return !n; })) { num = [2, 3, 5, 4, 6, 8]; eur = [360, 540, 900, 720, 1080, 1440]; finti = true; }
        titolo = '📊 I miei carichi e il mio guadagno, mese per mese';
        serie = [{ label: 'Carichi presi', data: num, backgroundColor: '#3b82f6', yAxisID: 'y' }, { type: 'line', label: 'Guadagno €', data: eur, borderColor: '#22c55e', backgroundColor: '#22c55e', yAxisID: 'y2', tension: 0, pointRadius: 3 }];
      }
      document.getElementById('ect-graf-titolo').textContent = titolo;
      document.getElementById('ect-graf-nota').textContent = finti ? '🎭 Anteprima: numeri di esempio' : 'Ultimi 6 mesi';
      caricaChart().then(function () {
        if (graficoPortale) graficoPortale.destroy();
        var scale = { x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { beginAtZero: true, position: 'left', ticks: { color: '#94a3b8', precision: 0 }, grid: { color: 'rgba(255,255,255,0.06)' } } };
        if (!azienda) scale.y2 = { beginAtZero: true, position: 'right', ticks: { color: '#86efac', callback: function (v) { return '€ ' + v; } }, grid: { display: false } };
        graficoPortale = new Chart(document.getElementById('ect-graf-canvas'), { type: 'bar', data: { labels: etichette, datasets: serie }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cbd5e1', boxWidth: 12 } } }, scales: scale } });
      }).catch(function () { document.getElementById('ect-graf-nota').textContent = 'Grafico non disponibile in questo momento.'; });
    }
    var agganciaReport = setInterval(function () {
      if (typeof window.aggiornaDashReport === 'function' && !window.aggiornaDashReport.__ect) {
        var orig = window.aggiornaDashReport;
        window.aggiornaDashReport = function () { var r = orig.apply(this, arguments); try { disegnaGraficoPortale(); } catch (e) {} return r; };
        window.aggiornaDashReport.__ect = true;
        clearInterval(agganciaReport);
      }
    }, 400);

    // anteprima: ?preview=...&apri=<sezione> apre direttamente quella sezione
    // (notifiche = Collega Telegram, sicurezza, fatture = Riepilogo movimenti, report, dati, overview)
    var apriSez = null; try { apriSez = new URLSearchParams(location.search).get('apri'); } catch (e) {}
    if (window.__ANTEPRIMA_SCUDO && apriSez) {
      var giriSez = 0;
      var vaiSez = setInterval(function () {
        giriSez++;
        var app = document.getElementById('app');
        if (app && app.style.display === 'block' && typeof apriDashSezione === 'function') {
          clearInterval(vaiSez);
          setTimeout(function () {
            var m = document.getElementById('modal-cambia-pw'); if (m) m.style.display = 'none';
            try { apriDashSezione(apriSez); } catch (e) {}
            var el = document.getElementById('dash-sezione-' + apriSez);
            if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.style.outline = '3px solid #f59e0b'; el.style.borderRadius = '12px'; setTimeout(function () { el.style.outline = ''; }, 4000); }
          }, 600);
        } else if (giriSez > 40) clearInterval(vaiSez);
      }, 250);
    }
    // anteprima: fa vedere anche la striscia rossa della password temporanea
    if (window.__ANTEPRIMA_SCUDO) {
      var mostraRossa = setInterval(function () {
        var app = document.getElementById('app'), br = document.getElementById('banner-pw-temp');
        if (app && app.style.display === 'block' && br) {
          clearInterval(mostraRossa); br.style.display = 'block'; leggiStato();
          window.salvaNuovaPassword = function () {
            var e = document.getElementById('cpw-err');
            if (e) { e.textContent = '🎭 Anteprima: qui l\'utente vero salva la sua nuova password.'; e.style.display = 'block'; }
          };
        }
      }, 300);
    }
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
    // RETE DI SICUREZZA: se il sistema di Netlify si e' avviato prima della pagina,
    // il portale puo' restare fermo su "Caricamento". Dopo 3 secondi lo sblocco io.
    setTimeout(function () {
      var car = document.getElementById('loading');
      var app = document.getElementById('app');
      var login = document.getElementById('login-page');
      var fermo = car && getComputedStyle(car).display !== 'none' && (!app || getComputedStyle(app).display === 'none') && (!login || getComputedStyle(login).display === 'none');
      if (!fermo) return;
      if (document.getElementById('recovery-page') && getComputedStyle(document.getElementById('recovery-page')).display !== 'none') return;
      var u = null;
      try { u = netlifyIdentity.currentUser() || (netlifyIdentity.gotrue && netlifyIdentity.gotrue.currentUser()); } catch (e) {}
      try {
        if (u && typeof avviaApp === 'function') { currentUser = u; avviaApp(); }
        else if (typeof mostraLogin === 'function') { mostraLogin(); }
      } catch (e) {}
    }, 3000);
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
      '<button class="sec" id="ect-annulla">Più tardi</button>' +
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
    p.innerHTML = '🔒 ' + email + ' · <span class="esci" id="ect-pill-esci">⏻ Esci</span>';
    // barretta in alto (sotto le strisce): non copre mai niente della pagina
    var gialla = document.getElementById('ect-striscia-mfa'), rossa = document.getElementById('ect-striscia-rossa');
    var dopo = gialla || rossa;
    if (dopo) dopo.insertAdjacentElement('afterend', p); else document.body.insertBefore(p, document.body.firstChild);
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
    var deciso = false;
    function decidi(u) {
      if (deciso) return; deciso = true;
      if (u) verificaGestore(); else mostraLogin();
    }
    netlifyIdentity.on('init', function (u) { decidi(u || utenteCorrente()); });
    try { netlifyIdentity.init(); } catch (e) {}
    // il sistema di Netlify potrebbe essersi gia' avviato prima di noi: controllo direttamente
    var giri = 0;
    var controllo = setInterval(function () {
      giri++;
      var u = utenteCorrente();
      if (u) { clearInterval(controllo); decidi(u); }
      else if (giri > 13) { clearInterval(controllo); decidi(null); }
    }, 150);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})();

/* =====================================================================
   27/9 sera — STAMPA PULITA, STAMPA PER RIGA E NELLE FINESTRE,
   PUBBLICA SENZA DOPPIONI, TIPO MERCE SCRITTO A MANO, TELEGRAM AZIENDA
   ===================================================================== */
(function () {
  function ora() { var d = new Date(); return d.toLocaleDateString('it-IT') + ' alle ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
  function emailUtente() { try { var u = window.netlifyIdentity && netlifyIdentity.currentUser(); return (u && u.email) || ''; } catch (e) { return ''; } }
  function esc(t) { var d = document.createElement('div'); d.textContent = t == null ? '' : String(t); return d.innerHTML; }

  // Stampa in una finestra pulita: solo il contenuto scelto, senza strisce, pulsanti e menu
  function ectStampa(titolo, nodi, htmlExtra) {
    // 10/10: nel portale si SCARICA (PDF vero). Se e' attivo il modo "scarica" non apro la finestra di stampa.
    if (window.__ectModoScarica && typeof window.ectScarica === 'function') { window.ectScarica(titolo, nodi, htmlExtra); return; }
    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { alert('Il browser ha bloccato la finestra di stampa: consenti i popup per questo sito.'); return; }
    var corpo = '';
    (nodi || []).forEach(function (n) {
      if (!n) return;
      var c = n.cloneNode(true);
      c.querySelectorAll('button, input, select, textarea, .feed-actions, .spiega-apri, .ect-stampa-bar, script').forEach(function (x) { x.remove(); });
      corpo += c.outerHTML;
    });
    w.document.write('<!DOCTYPE html><html lang="it"><head><meta charset="UTF-8"><title>' + esc(titolo) + '</title><style>' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:28px;font-size:13px;line-height:1.5;}' +
      '.testata{border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:18px;}' +
      '.testata h1{font-size:18px;margin:0 0 4px;color:#1d4ed8;}.testata div{font-size:11px;color:#555;}' +
      '*{color:#111 !important;background:transparent !important;box-shadow:none !important;}' +
      'table{width:100%;border-collapse:collapse;margin:8px 0;}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:12px;}' +
      'th{background:#f1f5f9 !important;}.scheda td:first-child{width:38%;font-weight:bold;}' +
      'img,svg,canvas{max-width:100%;}a{text-decoration:none;}' +
      '@page{margin:14mm;}</style></head><body>' +
      '<div class="testata"><h1>EcoTruckConnect — ' + esc(titolo) + '</h1><div>Stampato il ' + esc(ora()) + (emailUtente() ? ' · ' + esc(emailUtente()) : '') + '</div></div>' +
      (htmlExtra || '') + corpo +
      '<div style="margin-top:22px;font-size:10px;color:#777;">Documento di riepilogo EcoTruckConnect — SynAIMAX S.R.L.S. Non sostituisce la fattura fiscale.</div>' +
      '</body></html>');
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 400);
  }
  window.ectStampa = ectStampa;

  // 1) I pulsanti "Stampa" gia' presenti: stampano SOLO la loro sezione, non la pagina intera
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button');
    if (!b) return;
    var oc = b.getAttribute('onclick') || '';
    if (oc.indexOf('stampaConTimbro') === -1) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var nodi = [], titolo = 'Riepilogo';
    var sez = b.closest('.section');
    if (sez) {
      var t = sez.previousElementSibling; if (t && t.classList.contains('sec-title')) titolo = t.textContent.trim();
      nodi = [sez];
    } else if (b.closest('#storico-sec-head')) {
      var h = b.closest('#storico-sec-head'); titolo = (h.textContent.split('📅')[0] || 'Storico').trim();
      nodi = [h.nextElementSibling];
    } else if (b.closest('#dash-sezione-fatture')) {
      titolo = 'Riepilogo movimenti'; var s = b.closest('#dash-sezione-fatture');
      nodi = Array.from(s.querySelectorAll('.table-box, table')).filter(function (x, i, arr) { return !arr.some(function (y) { return y !== x && y.contains(x); }); });
    } else {
      var box = b.parentElement; while (box && box !== document.body && !box.querySelector('table')) box = box.parentElement;
      nodi = [box || document.body];
    }
    ectStampa(titolo, nodi);
  }, true);

  // 2) Stampa di UN solo carico (riga delle tabelle del portale)
  function numeroOrdine(tr) {
    for (var i = 0; i < tr.cells.length; i++) { var t = (tr.cells[i].childNodes[0] && tr.cells[i].childNodes[0].textContent || tr.cells[i].textContent).trim(); if (/^ORD-[\w-]+$/.test(t)) return t; }
    var m = tr.textContent.match(/ORD-\d+/); return m ? m[0] : null;
  }
  function trovaCarico(chiave) {
    var fonti = [];
    try { fonti = fonti.concat(carichiPubblicatiAzienda || []); } catch (e) {}
    try { fonti = fonti.concat(ultimeCandidature || []); } catch (e) {}
    try { fonti = fonti.concat(ultimiCarichi || []); } catch (e) {}
    for (var i = 0; i < fonti.length; i++) {
      var f = fonti[i].fields || fonti[i];
      if (f.numero_ordine === chiave || fonti[i].id === chiave || f.richiesta_id === chiave) { var ris = Object.assign({}, f); ris.__id = fonti[i].id || f.id; return ris; }
    }
    return null;
  }
  function dataOra(v) { if (!v) return '—'; var d = new Date(v); if (isNaN(d)) return String(v); return d.toLocaleDateString('it-IT') + (String(v).length > 10 ? ' ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : ''); }
  function euroTxt(v) { try { return euro(v); } catch (e) { return v ? '€ ' + v : '—'; } }
  function stampaCarico(f, riga) {
    var righe = [];
    function add(k, v) { if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) righe.push('<tr><td>' + esc(k) + '</td><td>' + esc(Array.isArray(v) ? v.join(', ') : v) + '</td></tr>'); }
    if (f) {
      add('Numero ordine', f.numero_ordine); add('Stato', f.stato);
      add('Tratta', (f.citta_partenza || '') + ' (' + (f.cap_partenza || '') + ') → ' + (f.citta_arrivo || '') + ' (' + (f.cap_arrivo || '') + ')');
      add('Data del carico', dataOra(f.data_consegna)); add('Pubblicato il', dataOra(f.data_pubblicazione));
      add('Tipo merce', f.tipo_merce); add('Specifica', f.specifica); add('Note', f.note);
      add('Mezzo che serve', f.tipo_mezzo_richiesto); add('Autorizzazioni che deve avere il trasportatore', f.autorizzazione_richiesta);
      if (f.codice_cer) add('Codice CER', f.codice_cer);
      add('Importo pattuito', f.importo_pattuito ? euroTxt(f.importo_pattuito) : ''); add('Termini di pagamento', f.termini_pagamento);
      add('Azienda', f.nome_azienda); add('Telefono azienda', f.telefono_azienda);
      add('Trasportatore', f.assegnato_a_nome || f.bloccato_da_nome); add('Telefono trasportatore', f.assegnato_a_telefono);
      add('Preso il', f.data_assegnato ? dataOra(f.data_assegnato) : '');
    } else if (riga) {
      var th = riga.closest('table') ? Array.from(riga.closest('table').querySelectorAll('thead th')).map(function (x) { return x.textContent.trim(); }) : [];
      Array.from(riga.cells).forEach(function (c, i) { if (th[i] && !/azione/i.test(th[i])) add(th[i], c.textContent.trim()); });
    }
    ectStampa('Carico ' + ((f && f.numero_ordine) || ''), [], '<table class="scheda">' + righe.join('') + '</table>');
  }
  function aggiungiStampaRighe() {
    document.querySelectorAll('#storico-body tr, #dash-fatture-body tr, #dash-sezione-fatture tbody tr').forEach(function (tr) {
      if (tr.__ectStampa || tr.cells.length < 2 || tr.querySelector('.empty')) return;
      tr.__ectStampa = true;
      var testo = tr.textContent;
      var no = numeroOrdine(tr); var m = no ? [no] : testo.match(/rec[A-Za-z0-9]{14}/);
      var btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'btn-cap ect-stampa-riga'; btn.textContent = '⬇️ Scarica';
      btn.style.cssText = 'padding:5px 10px;font-size:11px;margin-left:6px;';
      btn.onclick = function (ev) { ev.stopPropagation(); window.__ectModoScarica = true; try { stampaCarico(m ? trovaCarico(m[0]) : null, tr); } finally { window.__ectModoScarica = false; } };
      tr.cells[tr.cells.length - 1].appendChild(btn);
    });
  }

  // 3) Stampa e Salva PDF dentro le finestre che si aprono (dashboard e portale)
  function barraStampa(cont, titoloFn) {
    if (!cont || cont.querySelector(':scope > .ect-stampa-bar')) return;
    if (!cont.textContent.trim()) return;
    var bar = document.createElement('div');
    bar.className = 'ect-stampa-bar';
    bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:0 0 12px;flex-wrap:wrap;';
    ['⬇️ Scarica'].forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = t;
      b.style.cssText = 'background:#2563eb;color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;';
      b.onclick = function (ev) { ev.stopPropagation(); window.__ectModoScarica = true; try { ectStampa(titoloFn(), [cont]); } finally { window.__ectModoScarica = false; } };
      bar.appendChild(b);
    });
    cont.insertBefore(bar, cont.firstChild);
  }
  function aggiungiStampaFinestre() {
    var mb = document.getElementById('modal-body');
    if (mb && mb.offsetParent) barraStampa(mb, function () { var t = document.getElementById('modal-title'); return (t && t.textContent.trim()) || 'Scheda'; });
    var nd = document.getElementById('notif-dettaglio');
    if (nd && nd.offsetParent) barraStampa(nd, function () { var h = nd.querySelector('h2,h3,.dett-nome,strong'); return 'Scheda ' + ((h && h.textContent.trim()) || ''); });
    var cm = document.getElementById('cal-modal-corpo-carichi');
    if (cm && cm.offsetParent) barraStampa(cm, function () { var h = document.querySelector('#cal-modal-overlay h3'); return 'Carichi del ' + ((h && h.textContent.trim()) || ''); });
    var dc = document.getElementById('btn-chiudi-dettaglio-carico');
    if (dc && dc.offsetParent) { var box = dc.parentElement && dc.parentElement.parentElement; if (box) barraStampa(box, function () { return 'Dettaglio carico'; }); }
  }

  // 4) Portale: niente doppioni con "Pubblica Carico" + Tipo merce scritto a mano + errore che dice cosa manca
  var giriPub = 0;
  var agganciaPubblica = setInterval(function () {
    giriPub++;
    if (typeof window.pubblicaCarico === 'function' && !window.pubblicaCarico.__ect) {
      var orig = window.pubblicaCarico, inCorso = false;
      window.pubblicaCarico = async function () {
        if (inCorso) return;
        inCorso = true;
        var btn = document.querySelector('.btn-pubblica'); var testoBtn = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Pubblicazione in corso…'; btn.style.opacity = '0.7'; }
        try {
          var hid = document.getElementById('ins-merce'), vis = document.getElementById('ins-merce-ricerca');
          if (hid && vis && !hid.value && vis.value.trim()) {
            var scritto = vis.value.trim().toLowerCase(), trovato = null;
            try { (OPZIONI_MERCE || []).forEach(function (op) { if (!trovato && op.toLowerCase() === scritto) trovato = op; }); } catch (e) {}
            if (trovato) hid.value = trovato;
          }
          await orig.apply(this, arguments);
          var err = document.getElementById('ins-err');
          if (err && err.style.display === 'block' && /campi obbligatori/i.test(err.textContent)) {
            var campi = [['ins-cap-part', 'CAP partenza'], ['ins-cap-arr', 'CAP arrivo'], ['ins-citta-part', 'Città partenza'], ['ins-citta-arr', 'Città arrivo'], ['ins-data', 'Data carico'], ['ins-merce', 'Tipo merce (sceglilo dall\u2019elenco)'], ['ins-specifica', 'Specifica'], ['ins-note', 'Note']];
            var mancano = campi.filter(function (c) { var el = document.getElementById(c[0]); return el && !String(el.value || '').trim(); }).map(function (c) { return c[1]; });
            if (mancano.length) err.textContent = '⚠️ Manca: ' + mancano.join(', ') + '.';
          }
        } finally {
          inCorso = false;
          if (btn) { btn.disabled = false; btn.innerHTML = testoBtn; btn.style.opacity = ''; }
        }
      };
      window.pubblicaCarico.__ect = true;
      clearInterval(agganciaPubblica);
    } else if (giriPub > 80) clearInterval(agganciaPubblica);
  }, 400);

  // 5) Azienda: "Collega Telegram" non serve (riceve campanella ed email)
  function nascondiTelegramAzienda() {
    var tipo = ''; try { tipo = tipoUtente; } catch (e) {}
    if (tipo !== 'azienda') return;
    document.querySelectorAll('a[href*="t.me/SynAIMAX_EcoTruck_bot"]').forEach(function (a) {
      var box = a.closest('div[style*="border"]') || a.parentElement;
      if (box && !box.__ectNascosto) { box.style.display = 'none'; box.__ectNascosto = true; }
    });
  }

  // 6) AZIENDA: Modifica / Annulla (solo se DISPONIBILE) / Richiedi annullamento (se gia' preso)
  var PROXY_P = 'https://hook.eu1.make.com/n78xlbwx6483qv9v0eamw5th3sq20qak';
  function pulito(t) { return String(t == null ? '' : t).replace(/["\\]/g, "'").replace(/[\r\n\t]+/g, ' ').trim(); }
  async function chiamaProxy(corpo) {
    try { var r = await fetch(PROXY_P, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }); return await r.json(); } catch (e) { return null; }
  }
  function ricarica() { try { if (typeof aggiornaDashFatture === 'function') aggiornaDashFatture(); } catch (e) {} try { if (typeof caricaDati === 'function' && currentUser) caricaDati(currentUser.email); } catch (e) {} }
  function finestraCarico(titolo, html, onOk, testoOk) {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147482000;background:rgba(8,13,22,0.85);display:flex;align-items:center;justify-content:center;padding:16px;';
    ov.innerHTML = '<div style="background:#0e1623;border:1px solid rgba(255,255,255,0.14);border-radius:14px;padding:22px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;color:#f1f5f9;font-family:DM Sans,system-ui,sans-serif;">' +
      '<div style="font-size:17px;font-weight:800;margin-bottom:12px;">' + titolo + '</div>' + html +
      '<div class="ect-m-err" style="display:none;color:#f87171;font-size:13px;margin-top:10px;"></div>' +
      '<div style="display:flex;gap:8px;margin-top:16px;"><button type="button" class="ect-m-ok" style="flex:1;background:#2563eb;color:#fff;border:none;border-radius:9px;padding:11px;font-weight:700;cursor:pointer;">' + (testoOk || 'Salva') + '</button>' +
      '<button type="button" class="ect-m-no" style="flex:1;background:rgba(255,255,255,0.08);color:#fff;border:none;border-radius:9px;padding:11px;cursor:pointer;">Annulla</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('.ect-m-no').onclick = function () { ov.remove(); };
    ov.querySelector('.ect-m-ok').onclick = async function () {
      var b = this, err = ov.querySelector('.ect-m-err'); err.style.display = 'none';
      b.disabled = true; var t0 = b.textContent; b.textContent = 'Attendi…';
      var esito = await onOk(ov);
      b.disabled = false; b.textContent = t0;
      if (esito === true) ov.remove(); else if (esito) { err.textContent = esito; err.style.display = 'block'; }
    };
    return ov;
  }
  var CAMPO = 'width:100%;box-sizing:border-box;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:9px 11px;color:#f1f5f9;font-size:13px;margin:4px 0 10px;';
  function apriModifica(f) {
    var html =
      '<div style="font-size:12px;color:rgba(241,245,249,0.6);margin-bottom:10px;">' + esc((f.citta_partenza || '') + ' → ' + (f.citta_arrivo || '')) + ' · ' + esc(f.numero_ordine || '') + '<br>Si può modificare finché nessun trasportatore l\u2019ha preso.</div>' +
      '<label style="font-size:11px;color:rgba(241,245,249,0.6);">DATA DEL CARICO</label><input type="date" class="m-data" style="' + CAMPO + '" value="' + esc(String(f.data_consegna || '').slice(0, 10)) + '">' +
      '<label style="font-size:11px;color:rgba(241,245,249,0.6);">SPECIFICA</label><input class="m-spec" style="' + CAMPO + '" value="' + esc(f.specifica || '') + '">' +
      '<label style="font-size:11px;color:rgba(241,245,249,0.6);">NOTE</label><textarea class="m-note" rows="2" style="' + CAMPO + '">' + esc(f.note || '') + '</textarea>' +
      '<label style="font-size:11px;color:rgba(241,245,249,0.6);">IMPORTO PATTUITO (€)</label><input class="m-imp" inputmode="decimal" style="' + CAMPO + '" value="' + esc(f.importo_pattuito || '') + '">' +
      '<label style="font-size:11px;color:rgba(241,245,249,0.6);">TERMINI DI PAGAMENTO</label><input class="m-ter" style="' + CAMPO + '" value="' + esc(f.termini_pagamento || '') + '">';
    finestraCarico('✏️ Modifica carico', html, async function (ov) {
      var v = function (c) { return pulito(ov.querySelector(c).value); };
      var dati = { data_consegna: v('.m-data'), specifica: v('.m-spec'), note: v('.m-note'), importo_pattuito: v('.m-imp'), termini_pagamento: v('.m-ter') };
      for (var k in dati) if (!dati[k]) return '⚠️ Compila tutti i campi.';
      var r = await chiamaProxy(Object.assign({ action: 'modifica_carico', carico_id: f.__id }, dati));
      if (r && String(r.ok) === 'true') { ricarica(); alert('✅ Carico modificato.'); return true; }
      if (r && r.errore === 'non_modificabile') return 'Non si può più modificare: un trasportatore lo sta prendendo o l\u2019ha già preso.';
      return 'Non riesco a salvare. Riprova tra poco.';
    }, '💾 Salva modifiche');
  }
  function apriAnnulla(f) {
    finestraCarico('❌ Annulla carico', '<div style="font-size:13px;line-height:1.6;">Vuoi annullare il carico <b>' + esc((f.citta_partenza || '') + ' → ' + (f.citta_arrivo || '')) + '</b> del ' + esc(dataOra(f.data_consegna)) + '?<br><br>Sparisce subito per i trasportatori e resta nel tuo storico come <b>ANNULLATO</b>.</div>', async function () {
      var r = await chiamaProxy({ action: 'annulla_carico', carico_id: f.__id });
      if (r && String(r.ok) === 'true') { ricarica(); alert('✅ Carico annullato.'); return true; }
      if (r && r.errore === 'non_annullabile') return 'Non si può più annullare: un trasportatore lo sta prendendo o l\u2019ha già preso. Usa «Richiedi annullamento».';
      return 'Non riesco ad annullare. Riprova tra poco.';
    }, 'Sì, annulla il carico');
  }
  function apriRichiesta(f) {
    finestraCarico('📩 Richiedi annullamento', '<div style="font-size:13px;line-height:1.6;margin-bottom:8px;">Il carico <b>' + esc((f.citta_partenza || '') + ' → ' + (f.citta_arrivo || '')) + '</b> è già stato preso: la richiesta arriva ai gestori, che ti ricontattano.</div>' +
      '<label style="font-size:11px;color:rgba(241,245,249,0.6);">MOTIVO</label><textarea class="m-mot" rows="3" style="' + CAMPO + '"></textarea>', async function (ov) {
      var mot = pulito(ov.querySelector('.m-mot').value);
      if (!mot) return '⚠️ Scrivi il motivo.';
      var r = await chiamaProxy({ action: 'richiedi_annullamento', carico_id: f.__id, motivo: mot });
      if (r && String(r.ok) === 'true') { alert('✅ Richiesta inviata ai gestori.'); return true; }
      return 'Non riesco a inviare la richiesta. Riprova tra poco.';
    }, 'Invia richiesta');
  }
  function aggiungiAzioniAzienda() {
    var tipo = ''; try { tipo = tipoUtente; } catch (e) {}
    if (tipo !== 'azienda') return;
    var finto = !!window.__ANTEPRIMA_SCUDO;
    document.querySelectorAll('#storico-body tr, #dash-fatture-body tr').forEach(function (tr) {
      if (tr.__ectAzioni || tr.cells.length < 2 || tr.querySelector('.empty')) return;
      var no = numeroOrdine(tr); if (!no) return;
      var f = trovaCarico(no); if (!f) return;
      var id = f.__id || f.id; if (!id) return;
      tr.__ectAzioni = true; tr.__ectStampa = true;
      var st = String(f.stato || '').toUpperCase(), cella = tr.cells[tr.cells.length - 1];
      // Una fila sola, sempre nello stesso ordine e con gli stessi colori (28/9)
      cella.innerHTML = ''; cella.style.whiteSpace = 'normal';
      var fila = document.createElement('div'); fila.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
      cella.appendChild(fila);
      var TONI = { blu: 'background:#2563eb;color:#fff;border:1px solid #2563eb;', rosso: 'background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.5);',
        ambra: 'background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.5);', spento: 'background:rgba(255,255,255,0.06);color:rgba(241,245,249,0.5);border:1px solid rgba(255,255,255,0.12);cursor:not-allowed;' };
      function btn(testo, tono, fn) {
        var b = document.createElement('button'); b.type = 'button'; b.textContent = testo;
        b.style.cssText = 'padding:6px 12px;font-size:12px;font-weight:600;border-radius:8px;cursor:pointer;white-space:nowrap;' + TONI[tono];
        b.onclick = function (ev) { ev.stopPropagation(); fn(); }; fila.appendChild(b);
      }
      function etichetta(testo, col) { var sp = document.createElement('span'); sp.textContent = testo; sp.style.cssText = 'font-size:12px;font-weight:600;color:' + col + ';'; fila.appendChild(sp); }
      btn('⬇️ Scarica', 'blu', function () { window.__ectModoScarica = true; try { stampaCarico(f, tr); } finally { window.__ectModoScarica = false; } }); fila.lastChild.classList.add('ect-stampa-riga');
      btn('🔁 Duplica', 'blu', function () { if (typeof duplicaCarico === 'function') duplicaCarico(id); });
      var _v = f.tipo_rifiuto, _rif = _v === true || ['true', 'si', 'sì', 'yes', '1'].indexOf(String(Array.isArray(_v) ? _v[0] : _v).toLowerCase().trim()) !== -1 || String(f.codice_cer || '').trim().length > 0;
      if (_rif && st.indexOf('ANNULLATO') !== 0 && typeof window.ectDestApriModale === 'function') btn('♻️ Impianto e intermediario', 'blu', function () { window.ectDestApriModale(no); });
      if (st === 'DISPONIBILE') {
        btn('✏️ Modifica', 'blu', function () { if (finto && typeof anteprimaModificaCarico === 'function') anteprimaModificaCarico(id); else apriModifica(f); });
        btn('❌ Annulla', 'rosso', function () { if (finto && typeof anteprimaEliminaCarico === 'function') anteprimaEliminaCarico(id); else apriAnnulla(f); });
      } else if (st.indexOf('PAGAMENTO') >= 0) {
        btn('🔒 Bloccato', 'spento', function () { alert('⏳ Un trasportatore sta pagando proprio ora questo carico: Modifica e Annulla sono bloccati per 5 minuti.'); });
      } else if (st === 'PRESO') {
        btn('📩 Richiedi annullamento', 'ambra', function () { if (finto && typeof anteprimaRichiediAnnullamento === 'function') anteprimaRichiediAnnullamento(id); else apriRichiesta(f); });
      } else if (st === 'ANNULLAMENTO RICHIESTO') etichetta('⏳ In attesa dei gestori', '#fbbf24');
      else if (st === 'ANNULLATO') etichetta('Annullato', 'rgba(241,245,249,0.5)');
    });
  }

  // 7) ORA accanto alla data su ogni riga delle tabelle del portale
  function aggiungiOrari() {
    document.querySelectorAll('#storico-body tr, #dash-fatture-body tr').forEach(function (tr) {
      if (tr.__ectOra || tr.cells.length < 2) return;
      var m = [numeroOrdine(tr)]; if (!m[0]) return;
      var f = trovaCarico(m[0]); if (!f) return;
      var c0 = tr.cells[0]; if (!/^\s*\d{2}\/\d{2}\/\d{4}\s*$/.test(c0.textContent)) { tr.__ectOra = true; return; }
      var rif = String(f.stato || '').toUpperCase() === 'PRESO' && f.data_assegnato ? f.data_assegnato : (f.data_pubblicazione || f.createdTime);
      if (!rif || String(rif).length <= 10) { tr.__ectOra = true; return; }
      var d = new Date(rif); if (isNaN(d)) { tr.__ectOra = true; return; }
      var o = document.createElement('div'); o.style.cssText = 'font-size:11px;opacity:0.65;'; o.textContent = 'ore ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      c0.appendChild(o); tr.__ectOra = true;
    });
  }

  // 8) FILTRI sopra le tabelle del portale: ricerca + stato
  function barraFiltri(tabella, chiave) {
    if (!tabella || tabella.__ectFiltri) return;
    tabella.__ectFiltri = true;
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px;';
    bar.innerHTML = '<input type="text" placeholder="🔎 Cerca: città, ordine, trasportatore…" style="flex:1;min-width:180px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 11px;color:#f1f5f9;font-size:12px;">' +
      '<select style="background:#0e1623;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:8px 10px;color:#f1f5f9;font-size:12px;"><option value="">Tutti gli stati</option><option>DISPONIBILE</option><option value="PAGAMENTO">IN PAGAMENTO</option><option>PRESO</option><option>ANNULLATO</option></select>';
    var box = tabella.closest('.table-box') || tabella;
    box.parentNode.insertBefore(bar, box);
    var inp = bar.querySelector('input'), sel = bar.querySelector('select');
    function applica() {
      var q = inp.value.trim().toLowerCase(), s = sel.value.toUpperCase();
      tabella.querySelectorAll('tbody tr').forEach(function (tr) {
        if (tr.querySelector('.empty')) return;
        var t = tr.textContent, ok = (!q || t.toLowerCase().indexOf(q) >= 0) && (!s || t.toUpperCase().indexOf(s) >= 0);
        tr.style.display = ok ? '' : 'none';
      });
    }
    inp.oninput = applica; sel.onchange = applica;
    tabella.__ectApplica = applica;
  }
  function aggiungiFiltri() {
    var sb = document.getElementById('storico-body'); if (sb) barraFiltri(sb.closest('table'), 'storico');
    var fb = document.getElementById('dash-fatture-body'); if (fb) barraFiltri(fb.closest('table'), 'fatture');
    [sb, fb].forEach(function (b) { if (b) { var t = b.closest('table'); if (t && t.__ectApplica) t.__ectApplica(); } });
  }

  // 9) Account dei GESTORI entrato nel portale: avviso chiaro invece del messaggio tecnico
  var GESTORI_EMAIL = ['system.synaimax@gmail.com'];
  var giriG = 0;
  var controllaGestore = setInterval(function () {
    giriG++;
    var app = document.getElementById('app');
    if (!app || app.style.display !== 'block' || window.ECT_SOLO_GESTORI) { if (giriG > 80) clearInterval(controllaGestore); return; }
    var mail = emailUtente().toLowerCase(), tipo = ''; try { tipo = tipoUtente; } catch (e) {}
    if (giriG < 12) return; // aspetto che il portale riconosca l'utente
    clearInterval(controllaGestore);
    if (tipo || GESTORI_EMAIL.indexOf(mail) === -1 || document.getElementById('ect-avviso-gestore')) return;
    var av = document.createElement('div'); av.id = 'ect-avviso-gestore';
    av.style.cssText = 'margin:14px 20px;padding:16px;border-radius:12px;background:rgba(37,99,235,0.12);border:1px solid rgba(96,165,250,0.5);color:#f1f5f9;font-size:14px;line-height:1.6;';
    av.innerHTML = '👤 <b>Questo è l\u2019account dei gestori</b> (' + esc(mail) + '). Il portale è per aziende e trasportatori: per vedere tutto usa la <b>Dashboard Gestori</b>.' +
      '<div style="margin-top:10px;"><a href="/dashboard.html" style="display:inline-block;background:#2563eb;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-weight:700;">📊 Apri la Dashboard Gestori</a></div>';
    var nav = app.querySelector('.navbar'); if (nav) nav.insertAdjacentElement('afterend', av); else app.insertBefore(av, app.firstChild);
  }, 500);

  // 10) TRASPORTATORE dal computer: QR code per collegare Telegram con il telefono
  function qrTelegram() {
    var tipo = ''; try { tipo = tipoUtente; } catch (e) {}
    if (tipo !== 'trasportatore' || /android|iphone|ipad|ipod/i.test(navigator.userAgent || '')) return;
    var a = document.querySelector('a[href^="https://t.me/SynAIMAX_EcoTruck_bot"]');
    if (!a || !a.offsetParent || document.getElementById('ect-qr-tg')) return;
    var box = document.createElement('div'); box.id = 'ect-qr-tg';
    box.style.cssText = 'margin-top:12px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
    box.innerHTML = '<div id="ect-qr-tg-img" style="background:#fff;padding:8px;border-radius:8px;"></div><div style="font-size:12px;color:rgba(241,245,249,0.75);line-height:1.6;max-width:260px;">📱 <b>Sei al computer?</b> Inquadra il quadratino con la fotocamera del telefono: si apre Telegram, premi <b>Avvia</b>. Entro 5 minuti ti arriva la conferma.</div>';
    a.insertAdjacentElement('afterend', box);
    function disegna() { try { new QRCode(document.getElementById('ect-qr-tg-img'), { text: a.href, width: 130, height: 130 }); } catch (e) {} }
    if (window.QRCode) disegna(); else { var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; sc.onload = disegna; document.head.appendChild(sc); }
  }

  // 11) 🔄 AGGIORNA accanto a OGNI pulsante Stampa di sezione (portale e dashboard), con icona che gira
  (function () {
    var st = document.createElement('style');
    st.textContent = '.ect-gira{display:inline-block;animation:ectgira .8s linear infinite;}@keyframes ectgira{to{transform:rotate(360deg);}}';
    (document.head || document.documentElement).appendChild(st);
  })();
  function attendi(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  async function eseguiAggiorna(sezione) {
    // DASHBOARD GESTORI
    if (typeof caricaTutto === 'function') {
      if (sezione && sezione.querySelector && sezione.querySelector('#registro-lista') && typeof caricaRegistroAttivita === 'function') { await caricaRegistroAttivita(); return; }
      var giri = 0; while (typeof caricamentoInCorso !== 'undefined' && caricamentoInCorso && giri++ < 40) await attendi(250);
      await caricaTutto(); return;
    }
    // PORTALE aziende/trasportatori
    var mail = emailUtente();
    if (typeof caricaDati === 'function' && mail) await caricaDati(mail);
    var tipo = ''; try { tipo = tipoUtente; } catch (e) {}
    if (tipo === 'azienda' && typeof aggiornaDashFatture === 'function') await aggiornaDashFatture();
    try { if (typeof renderCampanellino === 'function') renderCampanellino(); } catch (e) {}
    await attendi(400);
  }
  async function premiAggiorna(b) {
    if (b.disabled) return;
    var t0 = b.innerHTML; b.disabled = true;
    b.innerHTML = '<span class="ect-gira">🔄</span> Aggiorno…';
    try { await eseguiAggiorna(b.closest('.dash-card, .panel, .card, [id^="dash-sezione-"], .ins-box, section, div')); } catch (e) {}
    b.innerHTML = '✅ Aggiornato';
    setTimeout(function () { b.disabled = false; b.innerHTML = t0; }, 1400);
  }
  function aggiungiAggiorna() {
    document.querySelectorAll('button[onclick*="stampaConTimbro"]').forEach(function (bs) {
      if (bs.__ectAgg) return; bs.__ectAgg = true;
      var b = document.createElement('button'); b.type = 'button'; b.className = bs.className;
      b.setAttribute('style', bs.getAttribute('style') || ''); b.innerHTML = '🔄 Aggiorna';
      b.onclick = function (ev) { ev.stopPropagation(); premiAggiorna(b); };
      bs.parentNode.insertBefore(b, bs);
    });
    // Report del portale (non ha il pulsante Stampa di sezione)
    var rep = document.getElementById('dash-sezione-report');
    if (rep && !rep.__ectAgg && rep.firstElementChild) {
      rep.__ectAgg = true;
      var b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'btn-cap'; b2.innerHTML = '🔄 Aggiorna';
      b2.style.cssText = 'margin:0 0 10px;';
      b2.onclick = function () { premiAggiorna(b2); };
      rep.insertBefore(b2, rep.firstChild);
    }
    // Campanella azienda: "Aggiorna ora" che gira
    if (typeof aggiornaCampanellino === 'function' && !window.__ectCampWrap) {
      window.__ectCampWrap = true;
      var orig = aggiornaCampanellino;
      window.aggiornaCampanellino = async function (manuale) {
        var btn = document.querySelector('button[onclick*="aggiornaCampanellino(true)"]');
        var t0 = btn ? btn.innerHTML : '';
        if (manuale && btn) { btn.disabled = true; btn.innerHTML = '<span class="ect-gira">🔄</span> Aggiorno…'; }
        try { await orig.apply(this, arguments); } catch (e) {}
        if (manuale && btn) { await attendi(350); btn.innerHTML = '✅ Aggiornato'; setTimeout(function () { btn.disabled = false; btn.innerHTML = t0 || '🔄 Aggiorna ora'; }, 1200); }
      };
    }
  }

  setInterval(function () { try { aggiungiStampaRighe(); aggiungiStampaFinestre(); nascondiTelegramAzienda(); aggiungiAzioniAzienda(); aggiungiOrari(); aggiungiFiltri(); qrTelegram(); aggiungiAggiorna(); } catch (e) {} }, 700);
})();
