/* Popup "Scrivi email" per i gestori: scrive a un trasportatore/azienda, con allegato (max 3 MB).
   Parte solo con login gestore + Google Authenticator (verificato su Make). Copia nascosta a system.synaimax@gmail.com. */
(function () {
  var HOOK = 'https://hook.eu1.make.com/aam5pr2wknuyb66mvbisryk5bxgthlkd';
  var MAX = 3 * 1024 * 1024;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function chiudi() { var m = document.getElementById('mail-popup-bg'); if (m) m.remove(); }
  function leggiFile(f) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { ko(new Error('lettura file')); };
      r.readAsDataURL(f);
    });
  }
  window.apriMailPopup = function (email, nome, oggetto, testo) {
    chiudi();
    var bg = document.createElement('div');
    bg.id = 'mail-popup-bg';
    bg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;';
    var inp = 'width:100%;box-sizing:border-box;background:#0e1623;border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:10px;color:#fff;font-size:14px;font-family:inherit;margin:4px 0 12px;';
    bg.innerHTML = '<div style="background:#111b2b;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:20px;max-width:560px;width:100%;max-height:92vh;overflow:auto;color:#fff;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><b style="font-size:17px;">✉️ Scrivi email' + (nome ? ' a ' + esc(nome) : '') + '</b><button id="mp-x" style="background:none;border:none;color:#fff;font-size:22px;cursor:pointer;">✕</button></div>' +
      '<label style="font-size:12px;color:#94a3b8;">A</label><input id="mp-a" style="' + inp + '" value="' + esc(email) + '">' +
      '<label style="font-size:12px;color:#94a3b8;">Oggetto</label><input id="mp-o" style="' + inp + '" value="' + esc(oggetto || 'EcoTruckConnect') + '">' +
      '<label style="font-size:12px;color:#94a3b8;">Messaggio</label><textarea id="mp-t" rows="7" style="' + inp + '">' + esc(testo || '') + '</textarea>' +
      '<label style="font-size:12px;color:#94a3b8;">Allegato (PDF, immagine, documento — max 3 MB)</label><input id="mp-f" type="file" style="' + inp + '">' +
      '<div id="mp-msg" style="min-height:20px;font-size:13px;margin-bottom:10px;"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;"><button id="mp-ann" style="padding:10px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:none;color:#fff;cursor:pointer;">Annulla</button><button id="mp-inv" style="padding:10px 18px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-weight:700;cursor:pointer;">✉️ Invia email</button></div></div>';
    document.body.appendChild(bg);
    document.getElementById('mp-x').onclick = chiudi;
    document.getElementById('mp-ann').onclick = chiudi;
    document.getElementById('mp-inv').onclick = async function () {
      var msg = document.getElementById('mp-msg'), btn = this;
      var a = document.getElementById('mp-a').value.trim(), o = document.getElementById('mp-o').value.trim(), t = document.getElementById('mp-t').value;
      var f = document.getElementById('mp-f').files[0];
      if (a.indexOf('@') < 1) { msg.style.color = '#f87171'; msg.textContent = 'Indirizzo email non valido.'; return; }
      if (!o) { msg.style.color = '#f87171'; msg.textContent = 'Scrivi l\'oggetto.'; return; }
      if (f && f.size > MAX) { msg.style.color = '#f87171'; msg.textContent = 'File troppo grande (max 3 MB).'; return; }
      btn.disabled = true; btn.textContent = '⏳ Invio…'; msg.textContent = '';
      try {
        var corpo = { destinatario: a, oggetto: o, testo: t };
        if (f) { corpo.allegato_nome = f.name; corpo.allegato_base64 = await leggiFile(f); }
        try { if (window.ectTokenAccesso) { var tk = await window.ectTokenAccesso(); if (tk) corpo.token = tk; } } catch (e) {}
        try { var tt = JSON.parse(localStorage.getItem('ect_mfa_ticket') || 'null'); if (tt && tt.dati) { corpo.ticket_dati = tt.dati; corpo.ticket_firma = tt.firma; } } catch (e) {}
        var r = await fetch(HOOK, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
        var d = {}; try { d = await r.json(); } catch (e) {}
        if (r.ok && d.esito === 'inviata') {
          msg.style.color = '#4ade80'; msg.textContent = '✅ Email inviata a ' + a + (f ? ' con l\'allegato ' + f.name : '') + '.';
          btn.textContent = 'Inviata'; setTimeout(chiudi, 2500);
        } else {
          msg.style.color = '#f87171'; msg.textContent = r.status === 401 ? '⛔ Non autorizzato: rifai il login con Google Authenticator.' : '⚠️ Email NON inviata (errore ' + r.status + '). Riprova.';
          btn.disabled = false; btn.textContent = '✉️ Riprova';
        }
      } catch (e) {
        msg.style.color = '#f87171'; msg.textContent = '⚠️ Email NON inviata: ' + (e && e.message ? e.message : 'errore di rete') + '.';
        btn.disabled = false; btn.textContent = '✉️ Riprova';
      }
    };
  };
})();
