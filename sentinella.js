/* SENTINELLA PORTALE — segnala alla Centralina ogni azione fallita (trasportatore, azienda, registrazione, robottino, pagamenti, documenti).
   Non modifica mai le richieste: guarda soltanto l'esito e, se qualcosa non va, avvisa i gestori. */
(function () {
  if (window.__SENTINELLA) return; window.__SENTINELLA = true;
  var HOOK = 'https://hook.eu1.make.com/sshvn9i99hbjelp5euxa9s2mxxjtjep1';
  var nativo = window.fetch.bind(window);
  var INVIATE = 0, MAX = 6, FINESTRA = 5 * 60 * 1000;
  var SCRIVONO = /^(crea_|aggiorna_|blocca_|segna_|salva_|approva_|rifiuta|registra|rigenera|risolvi_|marca_|annulla|rinuncia|paga|chat_bot|trasportatore_approvato|azienda_approvata|password_scelta)/;
  var NOMI = {
    chat_bot: 'Il robottino non ha risposto', crea_carico: 'Pubblicazione carico non riuscita', aggiorna_carico: 'Modifica carico non riuscita',
    blocca_carico: 'Presa del carico non riuscita', check_carico: 'Verifica carico non riuscita', segna_pagamento: 'Registrazione pagamento non riuscita',
    get_utente: 'Caricamento profilo utente non riuscito', get_dashboard_data: 'Caricamento dashboard non riuscito', get_registrazioni: 'Caricamento registrazioni non riuscito',
    approva_trasportatore: 'Approvazione trasportatore non riuscita', approva_azienda: 'Approvazione azienda non riuscita', get_registro_attivita: 'Storico attivita non caricato',
    get_scadenze: 'Scadenze non caricate', conta_trasportatori_compatibili: 'Conteggio trasportatori non riuscito', rigenera_password: 'Rigenerazione password non riuscita'
  };
  function ruolo() { try { return (typeof tipoUtente !== 'undefined' && tipoUtente) ? String(tipoUtente) : ''; } catch (e) { return ''; } }
  function email() { try { if (typeof emailUtente === 'function') return String(emailUtente() || ''); } catch (e) {} try { var u = window.netlifyIdentity && window.netlifyIdentity.currentUser(); return u && u.email ? u.email : ''; } catch (e) { return ''; } }
  function quadretto(azione, url) {
    var p = location.pathname + ' ' + azione + ' ' + url, r = ruolo();
    if (/chat_bot/.test(azione)) return '15';
    if (/dashboard|registrazioni|centralina/.test(location.pathname) || r === 'gestore') return '1';
    if (/azienda/.test(r)) return '3';
    return '2';
  }
  function ok24() { try { var k = '__sent_' + new Date().getHours(); return true; } catch (e) { return true; } }
  function giaInviata(chiave) {
    try {
      var s = JSON.parse(sessionStorage.getItem('__sentinella') || '{}'), t = Date.now();
      if (s[chiave] && t - s[chiave] < FINESTRA) return true;
      s[chiave] = t; sessionStorage.setItem('__sentinella', JSON.stringify(s));
    } catch (e) {}
    return false;
  }
  function segnala(azione, errore, url) {
    try {
      if (INVIATE >= MAX) return;
      var chiave = azione + '|' + errore; if (giaInviata(chiave)) return;
      INVIATE++;
      nativo(HOOK, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        origine: 'portale', azione: String(azione).slice(0, 120), errore: String(errore).slice(0, 300), q: quadretto(azione, url || ''),
        ruolo: ruolo(), email: email(), pagina: location.pathname + location.hash, quando: new Date().toISOString()
      }) }).catch(function () {});
    } catch (e) {}
  }
  function azioneDi(opts) {
    try { if (opts && typeof opts.body === 'string' && opts.body.charAt(0) === '{') { var b = JSON.parse(opts.body); return b.action || ''; } } catch (e) {}
    return '';
  }
  window.fetch = function (url, opts) {
    var ind = ''; try { ind = typeof url === 'string' ? url : ((url && url.url) || ''); } catch (e) {}
    var osservata = ind.indexOf('hook.eu1.make.com') !== -1 || ind.indexOf('/.netlify/functions/') !== -1;
    if (!osservata || ind.indexOf(HOOK) === 0) return nativo(url, opts);
    var azione = azioneDi(opts) || (ind.split('/').pop() || 'richiesta');
    var nome = NOMI[azione] || ('Azione non riuscita: ' + azione);
    var p = nativo(url, opts);
    p.then(function (r) {
      try {
        if (r.status >= 500 || r.status === 410 || r.status === 404) { segnala(nome, 'Il servizio ha risposto con errore ' + r.status, ind); return; }
        if (r.status === 401 || r.status === 403 || r.status === 429) return; // accesso scaduto o troppe richieste: non e' un guasto
        r.clone().text().then(function (t) {
          var d = null; try { d = JSON.parse(t); } catch (e) {}
          if (azione === 'chat_bot') { if (!d || typeof d.reply !== 'string' || !d.reply.trim()) segnala(nome, 'Risposta vuota o non valida del robottino', ind); return; }
          if (!SCRIVONO.test(azione)) return;
          if (!t || !t.trim()) { segnala(nome, 'Risposta vuota dal sistema', ind); return; }
          if (!d) { if (/error|errore|exception|timeout/i.test(t.slice(0, 200))) segnala(nome, t.slice(0, 200), ind); return; }
          if (d.ok === false || d.success === false || d.status === 'error') segnala(nome, d.error || d.errore || d.message || d.motivo || 'Il sistema ha risposto ok=false', ind);
        }).catch(function () {});
      } catch (e) {}
    }, function (err) {
      segnala(nome, 'Nessuna risposta dal sistema (' + (err && err.message ? err.message : 'rete') + ')', ind);
    });
    return p;
  };
  window.addEventListener('error', function (ev) {
    try { if (ev && ev.filename && ev.filename.indexOf(location.origin) === 0) segnala('Errore nella pagina', (ev.message || 'errore') + ' @' + ev.filename.split('/').pop() + ':' + ev.lineno, ''); } catch (e) {}
  });
})();
