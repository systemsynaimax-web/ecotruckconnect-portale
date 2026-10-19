/* Rende cliccabili email e numeri di telefono in tutta la pagina (Dashboard Gestori, Pagamenti, Report).
   - email  -> apre il popup "Scrivi email" dentro la pagina (con allegato)
   - telefono -> 📞 chiama (tel:) + 💬 WhatsApp
   Non tocca campi di testo, bottoni, link già esistenti, script. */
(function () {
  var SALTA = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1, BUTTON: 1, A: 1, NOSCRIPT: 1, CODE: 1, PRE: 1, TITLE: 1 };
  var RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|((?<![\w+.\-\/])(?:\+39|0039)?[ .]?3\d{2}[ .]?\d{6,7}(?![\d\/.\-]))/g;
  var MIEA = 'system.synaimax@gmail.com';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function wa(t) { var n = String(t).replace(/[^0-9+]/g, ''); if (n.indexOf('00') === 0) n = n.slice(2); else if (n.charAt(0) === '+') n = n.slice(1); else if (n.length <= 10) n = '39' + n; return n; }
  function saltare(el) {
    for (var e = el; e && e !== document.body; e = e.parentElement) {
      if (SALTA[e.tagName] || e.isContentEditable || e.id === 'mail-popup-bg' || (e.hasAttribute && e.hasAttribute('data-nolink'))) return true;
    }
    return false;
  }
  function trasforma(nodo) {
    var t = nodo.nodeValue; if (!t || t.length < 6) return;
    RE.lastIndex = 0; if (!RE.test(t)) return; RE.lastIndex = 0;
    var frag = document.createDocumentFragment(), ultimo = 0, m, fatto = false;
    while ((m = RE.exec(t))) {
      if (m[1] && m[1].toLowerCase() === MIEA) continue;
      fatto = true;
      if (m.index > ultimo) frag.appendChild(document.createTextNode(t.slice(ultimo, m.index)));
      var s = document.createElement('span'); s.setAttribute('data-ac', '1');
      if (m[1]) s.innerHTML = '<a href="#" data-ac-mail="' + esc(m[1]) + '" title="Scrivi email" style="color:inherit;text-decoration:underline dotted;cursor:pointer;">' + esc(m[1]) + '</a>';
      else s.innerHTML = '<a href="tel:' + esc(m[2].replace(/[^0-9+]/g, '')) + '" title="Chiama" style="color:inherit;text-decoration:underline dotted;">' + esc(m[2]) + '</a> <a href="https://wa.me/' + wa(m[2]) + '" target="_blank" rel="noopener" title="Scrivi su WhatsApp" style="color:#4ade80;text-decoration:none;">💬</a>';
      frag.appendChild(s); ultimo = m.index + m[0].length;
    }
    if (!fatto) return;
    if (ultimo < t.length) frag.appendChild(document.createTextNode(t.slice(ultimo)));
    nodo.parentNode.replaceChild(frag, nodo);
  }
  function scansiona(radice) {
    if (!radice || saltare(radice.nodeType === 1 ? radice : radice.parentElement)) return;
    var w = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { return saltare(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
    var lista = [], n; while ((n = w.nextNode())) lista.push(n);
    lista.forEach(trasforma);
  }
  var coda = [], timer = null;
  function pianifica(n) { coda.push(n); if (timer) return; timer = setTimeout(function () { timer = null; var c = coda; coda = []; c.forEach(function (x) { if (document.body.contains(x)) { try { scansiona(x); } catch (e) {} } }); }, 300); }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-ac-mail]'); if (!a) return;
    e.preventDefault();
    if (typeof window.apriMailPopup === 'function') window.apriMailPopup(a.getAttribute('data-ac-mail'), '');
    else location.href = 'mailto:' + a.getAttribute('data-ac-mail');
  });
  function avvia() {
    scansiona(document.body);
    new MutationObserver(function (muts) {
      muts.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && !(n.hasAttribute && n.hasAttribute('data-ac'))) pianifica(n); else if (n.nodeType === 3 && n.parentElement && !n.parentElement.hasAttribute('data-ac')) pianifica(n.parentElement); }); });
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
