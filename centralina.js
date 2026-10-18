/* =====================================================================
   EcoTruckConnect — centralina.js (18/10/2026)
   CENTRALINA della Dashboard Gestori: 16 quadretti (verde / giallo / rosso), report di oggi,
   riquadro di dettaglio per ogni quadretto, archivio dei guasti, bottone "Aggiorna ora".
   SOLO per i gestori: vive in dashboard.html e dashboard-demo.html, mai nei portali.
   - Dashboard FINTA: la pagina scrive prima  window.CENTRALINA_DEMO = true  -> dati di esempio, nulla di reale.
   - Dashboard REALE: legge lo stato da Airtable (tabelle Centralina e Centralina Archivio) tramite lo
     scenario Make "Centralina Leggi" (indirizzo qui sotto in CENTRALINA_URL). Finche' l'indirizzo e' vuoto
     i quadretti restano grigi e c'e' scritto "non ancora collegata".
   - Nessuna notifica Telegram. Operaio / Riserva 1 / Riserva 2 sono scenari Make: qui si vede solo il risultato.
   ===================================================================== */
(function () {
  'use strict';
  var DEMO = !!window.CENTRALINA_DEMO;
  var CENTRALINA_URL = 'https://hook.eu1.make.com/i2vvp1ly9alev23iubqxnt9txuvn5prp';          /* <- indirizzo del webhook "Centralina Leggi" (si compila quando lo scenario e' pronto) */
  var ORARI = '08:00 · 15:00 · 20:00';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var PORTALE = 'https://ecotruckconnect-portale.netlify.app/';

  /* ---------- i 16 quadretti: cosa controllano e dove si ripara ---------- */
  var META = {
    1:  { i: '🖥️', cosa: 'La Dashboard Gestori risponde e si apre (pagina dashboard.html).', link: 'dashboard.html', lt: 'Apri la Dashboard' },
    2:  { i: '🚚', cosa: 'Il portale del trasportatore si apre: carichi, presi, commissioni, iscrizione.', link: PORTALE, lt: 'Apri il portale' },
    3:  { i: '🏢', cosa: 'Il portale dell’azienda si apre: pubblica carico, pagamenti, storico.', link: PORTALE, lt: 'Apri il portale' },
    4:  { i: '🌐', cosa: 'La vetrina pubblica si apre e mostra le condizioni e il modulo di iscrizione.', link: 'https://ecotruckconnect.synaimaxpro.com', lt: 'Apri la vetrina' },
    5:  { i: '🎭', cosa: 'La dashboard finta si apre (dati di esempio).', link: 'dashboard-demo.html', lt: 'Apri la dashboard finta' },
    6:  { i: '👁️', cosa: 'L’anteprima dei portali (dati di esempio) si apre.', link: PORTALE + '?preview=trasportatore', lt: 'Apri l’anteprima' },
    7:  { i: '⚙️', cosa: 'Gli scenari Make che devono essere accesi sono accesi e senza errori.', link: 'https://eu1.make.com/992733/scenarios', lt: 'Apri Make' },
    8:  { i: '🗄️', cosa: 'Airtable risponde e le tabelle Carichi, Trasportatori e Aziende si leggono.', link: 'https://airtable.com/app0TGG8f4ARpdlbl', lt: 'Apri Airtable' },
    9:  { i: '🐙', cosa: 'Il deposito GitHub del portale è raggiungibile.', link: 'https://github.com/systemsynaimax-web/ecotruckconnect-portale', lt: 'Apri GitHub' },
    10: { i: '🚀', cosa: 'Netlify serve i siti e l’ultima pubblicazione è andata a buon fine.', link: 'https://app.netlify.com/', lt: 'Apri Netlify' },
    11: { i: '💳', cosa: 'Shopify risponde e il pagamento da 20 € è raggiungibile.', link: 'https://admin.shopify.com/store/zdv0ey-rv', lt: 'Apri Shopify' },
    12: { i: '📜', cosa: 'Privacy, cookie e condizioni (Iubenda) sono raggiungibili dai portali.', link: 'https://www.iubenda.com/it/dashboard', lt: 'Apri Iubenda' },
    13: { i: '📁', cosa: 'Google Drive è raggiungibile (cartelle e documenti di lavoro).', link: 'https://drive.google.com/', lt: 'Apri Google Drive' },
    14: { i: '✈️', cosa: 'Il bot Telegram risponde (notifiche ai trasportatori).', link: 'https://t.me/SynAIMAX_EcoTruck_bot', lt: 'Apri il bot' },
    15: { i: '🤖', cosa: 'Il robottino (Claude) risponde alle domande nel portale.', link: 'https://console.anthropic.com/', lt: 'Apri la console Claude' },
    16: { i: '🧾', cosa: 'Gli abbonamenti dei servizi sono attivi e non in scadenza.', link: 'dashboard.html#strumenti', lt: 'Apri Strumenti' }
  };
  var COL = {
    Grigio: { c: '#64748b', b: 'rgba(100,116,139,.35)', bg: 'rgba(100,116,139,.10)', t: 'Non ancora controllato' },
    Verde:  { c: '#22c55e', b: 'rgba(34,197,94,.45)',  bg: 'rgba(34,197,94,.10)',  t: 'Tutto a posto' },
    Giallo: { c: '#f59e0b', b: 'rgba(245,158,11,.6)',  bg: 'rgba(245,158,11,.12)', t: 'Da guardare' },
    Rosso:  { c: '#ef4444', b: 'rgba(239,68,68,.7)',   bg: 'rgba(239,68,68,.14)',  t: 'Guasto' }
  };
  var PASSI = ['Operaio', 'Riserva 1', 'Riserva 2'];

  var stato = { q: [], arch: [], collegata: false, errore: '', agg: null, msgAgg: '' };
  var vista = 'griglia';           /* 'griglia' | id del quadretto */
  var meseVis = new Date(); meseVis.setDate(1);
  var giornoSel = '';
  var occupato = false;

  /* ---------- dati ---------- */
  function ora(minFa) { return new Date(Date.now() - minFa * 60000).toISOString(); }
  function datiFinti() {
    var nomi = ['Dashboard reale', 'Portale trasportatore', 'Portale azienda', 'Vetrina', 'Dashboard demo', 'Anteprima portali', 'Make (scenari)', 'Airtable', 'GitHub', 'Netlify', 'Shopify (pagamenti)', 'Iubenda', 'Google Drive', 'Telegram', 'Claude AI (robottino)', 'Abbonamenti'];
    var alte = { 1: 1, 2: 1, 3: 1, 7: 1, 8: 1, 11: 1 };
    var q = nomi.map(function (n, k) {
      return { id: String(k + 1), nome: n, stato: 'Verde', ultimo_controllo: ora(35), dettaglio: '', ultimo_intervento: 'Nessuno', tentativi: 0, priorita: alte[k + 1] ? 'Alta (azienda/trasportatore)' : 'Media', attivo: true, _risolveAl: 0 };
    });
    q[7].stato = 'Giallo'; q[7].dettaglio = 'Airtable: le richieste API del mese sono all’85% del limite. Se arrivano al 100% i portali smettono di leggere i dati.'; q[7].ultimo_intervento = 'Operaio'; q[7].tentativi = 1; q[7]._risolveAl = 0;
    q[13].stato = 'Giallo'; q[13].dettaglio = 'Telegram: il bot ha risposto in 9 secondi (normale: meno di 2).'; q[13]._risolveAl = 0;
    q[10].stato = 'Rosso'; q[10].dettaglio = 'Shopify: il collegamento al pagamento da 20 € non risponde dalle 15:00. I trasportatori non riescono a completare il pagamento di un carico.'; q[10].ultimo_intervento = 'Riserva 1'; q[10].tentativi = 2; q[10]._risolveAl = 2;
    var a = [
      ['Make: scenario spento', '7', 'Rosso', 70, 'Operaio', 'Riacceso lo scenario “Timer Carico”', 'Risolto'],
      ['Netlify: pubblicazione fallita', '10', 'Giallo', 1500, 'Operaio', 'Rilanciata la pubblicazione', 'Risolto'],
      ['Airtable: risposta lenta', '8', 'Giallo', 2900, 'Operaio', 'Ripetuta la lettura dopo 2 minuti', 'Risolto'],
      ['Portale azienda non si apriva', '3', 'Rosso', 4400, 'Riserva 1', 'L’operaio non è riuscito; la riserva ha rilanciato l’ultima pubblicazione', 'Risolto'],
      ['Shopify: pagamento non raggiungibile', '11', 'Rosso', 5800, 'Riserva 2', 'Operaio e Riserva 1 non sono riusciti; Riserva 2 ha rifatto il collegamento', 'Risolto'],
      ['Telegram: bot lento', '14', 'Giallo', 8600, 'Operaio', 'Nuovo tentativo, risponde', 'Risolto'],
      ['Robottino senza risposta', '15', 'Rosso', 11000, 'Gestore', 'Chiave del robottino scaduta: serviva l’intervento del gestore', 'Serve tu'],
      ['Make: esecuzione fallita', '7', 'Giallo', 14500, 'Operaio', 'Rilanciata l’esecuzione fallita', 'Risolto'],
      ['Vetrina: pagina lenta', '4', 'Giallo', 18000, 'Operaio', 'Nuovo controllo, tutto regolare', 'Risolto']
    ].map(function (r) { return { titolo: r[0], quadretto: r[1], livello: r[2], quando: ora(r[3]), chi: r[4], azione: r[5], esito: r[6], segnato_risolto: r[6] === 'Risolto' }; });
    return { q: q, arch: a };
  }

  function carica(forza) {
    if (DEMO) {
      if (!stato.q.length) { var d = datiFinti(); stato.q = d.q; stato.arch = d.arch; }
      stato.collegata = true; stato.agg = new Date().toISOString(); disegna(); return Promise.resolve();
    }
    if (!CENTRALINA_URL) {
      if (!stato.q.length) stato.q = Object.keys(META).map(function (k) { return { id: k, nome: 'Quadretto ' + k, stato: 'Grigio', dettaglio: '', ultimo_intervento: 'Nessuno', tentativi: 0 }; });
      stato.collegata = false; disegna(); return Promise.resolve();
    }
    var chiama = function (body) {
      return fetch(CENTRALINA_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.text(); })
        .then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) { j = null; } return j; });
    };
    var prima = forza ? chiama({ action: 'centralina_aggiorna', id: '1' }).catch(function () { return null; }) : Promise.resolve();
    return prima.then(function () { return chiama({ action: 'centralina_leggi' }); })
      .then(function (j) {
        if (!j) throw new Error('risposta non valida');
        if (j.ok === false) throw new Error(j.errore || 'accesso non consentito');
        var piatto = function (r) { var f = (r && r.fields) || {}; f._rec = r && r.id; return f; };
        stato.q = (j.centr || []).map(piatto).map(function (f) {
          return { id: String(f.id_quadretto), nome: f.nome || ('Quadretto ' + f.id_quadretto), stato: f.stato || 'Grigio', ultimo_controllo: f.ultimo_controllo || '', dettaglio: f.dettaglio || '', ultimo_intervento: f.ultimo_intervento || 'Nessuno', tentativi: Number(f.tentativi) || 0, priorita: f.priorita || '', attivo: !!f.attivo };
        }).sort(function (a, b) { return Number(a.id) - Number(b.id); });
        stato.arch = (j.arch || []).map(piatto).map(function (f) {
          return { titolo: f.titolo || '', quadretto: String(f.quadretto || ''), livello: f.livello || 'Giallo', quando: f.quando || '', chi: f.chi || '', azione: f.azione || '', esito: f.esito || '', segnato_risolto: !!f.segnato_risolto };
        });
        stato.collegata = true; stato.errore = ''; stato.agg = new Date().toISOString();
      })
      .catch(function (e) { stato.errore = String(e && e.message || e); stato.collegata = false; })
      .then(function () { disegna(); });
  }

  function globale() {
    var peggio = 'Grigio', rank = { Grigio: 0, Verde: 1, Giallo: 2, Rosso: 3 };
    stato.q.forEach(function (x) { if ((rank[x.stato] || 0) > rank[peggio]) peggio = x.stato; });
    return peggio;
  }
  function conta(s) { return stato.q.filter(function (x) { return x.stato === s; }).length; }
  function fmt(iso, corto) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString('it-IT', corto ? { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }); } catch (e) { return iso; }
  }
  function giornoDi(iso) { try { return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }); } catch (e) { return ''; } }

  /* ---------- stile ---------- */
  function stile() {
    if ($('ct-stile')) return;
    var s = document.createElement('style'); s.id = 'ct-stile';
    s.textContent = [
      '@keyframes ct-lg{0%,100%{opacity:1}50%{opacity:.25}}@keyframes ct-lr{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.1;transform:scale(1.25)}}',
      '@media (prefers-reduced-motion:no-preference){.ct-y{animation:ct-lg 1.4s ease-in-out infinite}.ct-r{animation:ct-lr .6s ease-in-out infinite}}',
      '#mg-centralina{color:#f1f5f9;}',
      '.ct-bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:0 0 16px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);}',
      '.ct-glob{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:700;}',
      '.ct-pal{width:16px;height:16px;border-radius:50%;display:inline-block;flex:none;}',
      '.ct-btn{background:#2563eb;color:#fff;border:none;border-radius:10px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;}',
      '.ct-btn:hover{filter:brightness(1.1);} .ct-btn[disabled]{opacity:.55;cursor:wait;}',
      '.ct-btn.sec{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:#f1f5f9;}',
      '.ct-btn.ver{background:#16a34a;} .ct-btn.ros{background:#dc2626;}',
      '.ct-sm{font-size:12px;color:rgba(241,245,249,.6);line-height:1.5;}',
      '.ct-h{margin:22px 0 10px;font-size:13px;letter-spacing:1.4px;color:rgba(241,245,249,.55);font-weight:700;text-transform:uppercase;}',
      '.ct-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;}',
      '.ct-q{text-align:left;border-radius:14px;padding:14px;cursor:pointer;font:inherit;color:#f1f5f9;border:1px solid;display:flex;flex-direction:column;gap:6px;min-height:104px;}',
      '.ct-q:hover{filter:brightness(1.15);}',
      '.ct-q .t{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:rgba(241,245,249,.65);}',
      '.ct-q b{font-size:15px;} .ct-q .s{font-size:12px;font-weight:700;}',
      '.ct-rep{border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;}',
      '.ct-rep .r{display:flex;gap:12px;padding:11px 14px;border-top:1px solid rgba(255,255,255,.08);font-size:13px;align-items:flex-start;}',
      '.ct-rep .r:first-child{border-top:none;} .ct-rep .o{min-width:48px;color:rgba(241,245,249,.6);font-variant-numeric:tabular-nums;}',
      '.ct-tag{display:inline-block;font-size:11px;font-weight:700;border-radius:999px;padding:2px 9px;border:1px solid;white-space:nowrap;}',
      '.ct-box{border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:16px;background:rgba(255,255,255,.04);margin:0 0 14px;}',
      '.ct-box h3{margin:0 0 8px;font-size:13px;letter-spacing:1.2px;color:rgba(241,245,249,.55);text-transform:uppercase;}',
      '.ct-box p{margin:0;font-size:14px;line-height:1.55;}',
      '.ct-steps{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;}',
      '.ct-step{flex:1;min-width:120px;border-radius:10px;padding:10px;font-size:12px;text-align:center;border:1px solid rgba(255,255,255,.15);color:rgba(241,245,249,.6);}',
      '.ct-step b{display:block;font-size:13px;color:#f1f5f9;margin-bottom:2px;}',
      '.ct-step.fatto{border-color:rgba(245,158,11,.6);background:rgba(245,158,11,.1);} .ct-step.ok{border-color:rgba(34,197,94,.6);background:rgba(34,197,94,.1);}',
      '.ct-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;max-width:420px;}',
      '.ct-cal .d{aspect-ratio:1;border-radius:8px;border:1px solid rgba(255,255,255,.08);font-size:12px;display:flex;align-items:center;justify-content:center;cursor:default;background:rgba(255,255,255,.03);color:rgba(241,245,249,.55);}',
      '.ct-cal .d.e{cursor:pointer;color:#fff;font-weight:700;} .ct-cal .d.sel{outline:2px solid #60a5fa;} .ct-cal .w{font-size:11px;text-align:center;color:rgba(241,245,249,.45);}',
      '.ct-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}',
      '#ct-pop{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;}',
      '#ct-pop .c{background:#0f172a;border-radius:16px;padding:22px;max-width:420px;width:100%;border:2px solid;}',
      '#ct-pop h3{margin:0 0 8px;font-size:18px;} #ct-pop p{margin:0 0 16px;font-size:14px;line-height:1.55;color:rgba(241,245,249,.8);}',
      '.ct-dot{width:11px;height:11px;border-radius:50%;margin-left:auto;flex:none;display:inline-block;background:#64748b;}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- disegno ---------- */
  function pallino(st, grande) {
    var k = COL[st] || COL.Grigio;
    return '<span class="ct-pal' + (st === 'Giallo' ? ' ct-y' : st === 'Rosso' ? ' ct-r' : '') + '" style="background:' + k.c + ';' + (grande ? '' : 'width:12px;height:12px;') + '"></span>';
  }
  function tag(st) { var k = COL[st] || COL.Grigio; return '<span class="ct-tag" style="color:' + k.c + ';border-color:' + k.b + ';background:' + k.bg + '">' + esc(st) + '</span>'; }

  function barra() {
    var g = globale(), k = COL[g];
    var testo = !stato.collegata && !DEMO ? (stato.errore ? 'Non riesco a leggere la centralina' : 'Centralina non ancora collegata')
      : g === 'Verde' ? 'Tutto a posto' : g === 'Giallo' ? 'Qualcosa da guardare' : g === 'Rosso' ? 'C’è un guasto' : 'Nessun controllo ancora fatto';
    var sub = DEMO ? '🎭 DEMO: dati di esempio, niente di vero.' : (stato.errore ? esc(stato.errore) : (stato.collegata ? '' : 'Si accende dopo il collegamento con Make e Airtable.'));
    return '<div class="ct-bar"><div class="ct-glob">' + pallino(g, true) + '<span style="color:' + k.c + '">' + testo + '</span></div>' +
      '<div class="ct-sm">' + conta('Verde') + ' verdi · ' + conta('Giallo') + ' gialli · ' + conta('Rosso') + ' rossi · aggiornato ' + fmt(stato.agg) + '<br>Controlli automatici: ' + ORARI + (sub ? '<br>' + sub : '') + (stato.msgAgg ? '<br><b style="color:#93c5fd">' + esc(stato.msgAgg) + '</b>' : '') + '</div>' +
      '<span style="margin-left:auto" class="ct-row"><button class="ct-btn" id="ct-agg"' + (occupato ? ' disabled' : '') + '>' + (occupato ? 'Controllo in corso…' : '↻ Aggiorna ora') + '</button></span></div>';
  }

  function reportOggi() {
    var oggi = giornoDi(new Date().toISOString());
    var ev = stato.arch.filter(function (e) { return giornoDi(e.quando) === oggi; }).sort(function (a, b) { return new Date(b.quando) - new Date(a.quando); });
    var righe = ev.length ? ev.map(function (e) {
      var q = nomeQ(e.quadretto);
      return '<div class="r"><span class="o">' + fmt(e.quando, 1) + '</span><span>' + tag(e.livello) + '</span><span style="flex:1"><b>' + esc(e.titolo) + '</b><br><span class="ct-sm">' + esc(e.chi) + ': ' + esc(e.azione) + ' · ' + esc(e.esito) + (q ? ' · ' + esc(q) : '') + '</span></span>' + (q ? '<button class="ct-btn sec" data-q="' + esc(e.quadretto) + '" style="padding:6px 12px">Vai al danno →</button>' : '') + '</div>';
    }).join('') : '<div class="r"><span class="ct-sm">Oggi nessun guasto registrato.</span></div>';
    var aperti = stato.q.filter(function (x) { return x.stato === 'Giallo' || x.stato === 'Rosso'; });
    var righeAperti = aperti.map(function (x) {
      return '<div class="r"><span class="o">ORA</span><span>' + tag(x.stato) + '</span><span style="flex:1"><b>' + esc(x.id) + ' · ' + esc(x.nome) + '</b><br><span class="ct-sm">' + esc(x.dettaglio || 'Da controllare') + '</span></span><button class="ct-btn ' + (x.stato === 'Rosso' ? 'ros' : 'sec') + '" data-q="' + esc(x.id) + '" style="padding:6px 12px">Vai al danno →</button></div>';
    }).join('');
    return '<div class="ct-row" style="margin:22px 0 10px"><div class="ct-h" style="margin:0">Report di oggi</div><button class="ct-btn sec" data-az-rep="1" style="margin-left:auto">🖨 Stampa / scarica report</button></div><div class="ct-rep">' + righeAperti + righe + '</div>';
  }
  function nomeQ(id) { var x = stato.q.filter(function (y) { return String(y.id) === String(id); })[0]; return x ? x.nome : ''; }

  function griglia() {
    return '<div class="ct-h">I 16 quadretti</div><div class="ct-grid">' + stato.q.map(function (x) {
      var k = COL[x.stato] || COL.Grigio, m = META[x.id] || { i: '▫️' };
      return '<button type="button" class="ct-q" data-q="' + esc(x.id) + '" style="border-color:' + k.b + ';background:' + k.bg + '"><span class="t"><span>' + m.i + ' ' + esc(x.id) + (/^Alta/.test(x.priorita || '') ? ' · ★' : '') + '</span>' + pallino(x.stato) + '</span><b>' + esc(x.nome) + '</b><span class="s" style="color:' + k.c + '">' + k.t + '</span></button>';
    }).join('') + '</div><div class="ct-sm" style="margin-top:8px">★ = riguarda direttamente azienda e trasportatore (carichi, pagamenti). Clicca un quadretto per vedere cosa è successo e dove ripararlo.</div>';
  }

  function calendario() {
    var y = meseVis.getFullYear(), m = meseVis.getMonth();
    var primo = new Date(y, m, 1), giorni = new Date(y, m + 1, 0).getDate(), off = (primo.getDay() + 6) % 7;
    var per = {};
    stato.arch.forEach(function (e) { var g = giornoDi(e.quando); if (!g) return; var r = per[g]; per[g] = (e.livello === 'Rosso' || r === 'Rosso') ? 'Rosso' : 'Giallo'; });
    var h = '<div class="ct-row" style="margin-bottom:8px"><button class="ct-btn sec" data-mese="-1">◀</button><b style="min-width:150px;text-align:center">' + primo.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) + '</b><button class="ct-btn sec" data-mese="1">▶</button></div><div class="ct-cal">';
    ['L', 'M', 'M', 'G', 'V', 'S', 'D'].forEach(function (d) { h += '<div class="w">' + d + '</div>'; });
    for (var i = 0; i < off; i++) h += '<div></div>';
    for (var d = 1; d <= giorni; d++) {
      var key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'), l = per[key], k = l ? COL[l] : null;
      h += '<div class="d' + (l ? ' e' : '') + (giornoSel === key ? ' sel' : '') + '" ' + (l ? 'data-g="' + key + '" style="background:' + k.bg + ';border-color:' + k.b + '"' : '') + '>' + d + '</div>';
    }
    h += '</div>';
    var lista = stato.arch.filter(function (e) { return giornoSel ? giornoDi(e.quando) === giornoSel : true; }).sort(function (a, b) { return new Date(b.quando) - new Date(a.quando); }).slice(0, giornoSel ? 50 : 12);
    h += '<div class="ct-h" style="margin-top:16px">' + (giornoSel ? 'Guasti del ' + giornoSel.split('-').reverse().join('/') + ' <button class="ct-btn sec" data-g="" style="padding:3px 10px;margin-left:8px">tutti</button>' : 'Ultimi guasti') + '</div><div class="ct-rep">' +
      (lista.length ? lista.map(function (e) {
        return '<div class="r"><span class="o">' + fmt(e.quando) + '</span><span>' + tag(e.livello) + '</span><span><b>' + esc(e.titolo) + '</b><br><span class="ct-sm">' + esc(e.chi) + ': ' + esc(e.azione) + ' · ' + esc(e.esito) + '</span></span></div>';
      }).join('') : '<div class="r"><span class="ct-sm">Nessun guasto in archivio.</span></div>') + '</div>';
    return '<div class="ct-h">Archivio guasti</div>' + h + '<div class="ct-row" style="margin-top:12px"><button class="ct-btn sec" id="ct-csv">⬇ Scarica archivio (CSV)</button></div>';
  }

  function dettaglio(id) {
    var x = stato.q.filter(function (y) { return String(y.id) === String(id); })[0]; if (!x) { vista = 'griglia'; return griglia(); }
    var m = META[x.id] || { i: '▫️', cosa: '', link: '#', lt: 'Apri' }, k = COL[x.stato] || COL.Grigio;
    var passo = Math.min(Number(x.tentativi) || 0, 3), risolto = x.stato === 'Verde';
    var storia = stato.arch.filter(function (e) { return String(e.quadretto) === String(x.id); }).sort(function (a, b) { return new Date(b.quando) - new Date(a.quando); }).slice(0, 8);
    var steps = PASSI.map(function (p, i) {
      var cls = i < passo ? (risolto && i === passo - 1 ? 'ok' : 'fatto') : '';
      return '<div class="ct-step ' + cls + '"><b>' + p + '</b>' + (i < passo ? (risolto && i === passo - 1 ? 'ha risolto' : 'provato, non basta') : 'non ancora') + '</div>';
    }).join('') + '<div class="ct-step ' + (x.stato === 'Rosso' && passo >= 3 ? 'fatto' : '') + '"><b>Serve tu</b>' + (x.stato === 'Rosso' && passo >= 3 ? 'tocca a te' : 'solo se tutto fallisce') + '</div>';
    var bott = x.stato === 'Verde'
      ? '<button class="ct-btn sec" data-az="controlla">↻ Controlla questo quadretto</button>'
      : '<button class="ct-btn" data-az="riprova">↻ Riprova (fa lavorare ' + (passo >= 2 ? 'la Riserva 2' : passo === 1 ? 'la Riserva 1' : 'l’Operaio') + ')</button><button class="ct-btn sec" data-az="riaccendi">⏻ Riaccendi</button><button class="ct-btn ver" data-az="risolto">✔ Segna risolto</button>';
    return '<div class="ct-row" style="margin-bottom:14px"><button class="ct-btn sec" data-back="1">◀ Tutti i quadretti</button><button class="ct-btn sec" data-az="stampa">🖨 Stampa</button></div>' +
      '<div class="ct-box" style="border-color:' + k.b + ';background:' + k.bg + '"><div class="ct-row" style="gap:12px">' + pallino(x.stato, true) + '<div><div style="font-size:20px;font-weight:700">' + m.i + ' ' + esc(x.id) + ' · ' + esc(x.nome) + '</div><div class="ct-sm" style="color:' + k.c + '">' + k.t + ' · ultimo controllo ' + fmt(x.ultimo_controllo) + '</div></div></div></div>' +
      (x.stato === 'Giallo' || x.stato === 'Rosso' ? '<div class="ct-box"><h3>Cosa è successo</h3><p>' + esc(x.dettaglio || 'Nessun dettaglio registrato.') + '</p></div>' : '<div class="ct-box"><h3>Stato</h3><p>Nessun problema. ' + esc(x.dettaglio || '') + '</p></div>') +
      '<div class="ct-box"><h3>Dov’è il danno e cosa controlla questo quadretto</h3><p>' + esc(m.cosa) + '</p><p style="margin-top:10px"><a class="ct-btn" style="text-decoration:none;display:inline-block" href="' + esc(m.link) + '" target="_blank" rel="noopener">' + esc(m.lt) + ' ↗</a></p></div>' +
      '<div class="ct-box"><h3>Chi ha provato a ripararlo</h3><div class="ct-steps">' + steps + '</div><p class="ct-sm" style="margin-top:8px">Tentativi: ' + (x.tentativi || 0) + ' · ultimo intervento: ' + esc(x.ultimo_intervento || 'Nessuno') + '</p></div>' +
      '<div class="ct-box"><h3>Azioni</h3><div class="ct-row">' + bott + '</div><p class="ct-sm" id="ct-msg" style="margin-top:8px"></p></div>' +
      '<div class="ct-box"><h3>Storia di questo quadretto</h3>' + (storia.length ? storia.map(function (e) { return '<p class="ct-sm" style="margin:0 0 4px">' + fmt(e.quando) + ' · ' + tag(e.livello) + ' ' + esc(e.titolo) + ' — ' + esc(e.chi) + ': ' + esc(e.azione) + ' (' + esc(e.esito) + ')</p>'; }).join('') : '<p class="ct-sm">Nessun guasto registrato.</p>') + '</div>';
  }

  function disegna() {
    aggiornaMenu();
    var c = $('mg-centralina'); if (!c) return;
    if (!c.getAttribute('data-ct')) { c.setAttribute('data-ct', '1'); legami(c); }
    c.innerHTML = vista === 'griglia' ? barra() + reportOggi() + griglia() + calendario() : barra() + dettaglio(vista);
  }

  /* ---------- menu laterale: spia ---------- */
  function aggiornaMenu() {
    var g = globale(), k = COL[g], d = $('ct-dot');
    if (!d) { var b = document.querySelector('#mg-side .mg-v[data-p="centralina"]'); if (!b) return; d = document.createElement('span'); d.id = 'ct-dot'; d.className = 'ct-dot'; b.appendChild(d); }
    d.style.background = k.c; d.className = 'ct-dot' + (g === 'Giallo' ? ' ct-y' : g === 'Rosso' ? ' ct-r' : '');
    d.title = k.t;
    if (!stile._avviso) { stile._avviso = 1; setTimeout(avviso, 600); }
  }

  /* ---------- pop-up guasto ---------- */
  function suono() {
    try { var A = window.AudioContext || window.webkitAudioContext; if (!A) return; var c = new A(), o = c.createOscillator(), gn = c.createGain(); o.type = 'square'; o.frequency.value = 880; gn.gain.value = .08; o.connect(gn); gn.connect(c.destination); o.start(); setTimeout(function () { o.frequency.value = 660; }, 220); setTimeout(function () { o.stop(); c.close(); }, 520); } catch (e) {}
  }
  function avviso() {
    var g = globale(); if (g !== 'Giallo' && g !== 'Rosso') return;
    var chiave = 'ct_avviso_' + g + '_' + (DEMO ? 'demo' : 'reale');
    try { if (sessionStorage.getItem(chiave)) return; sessionStorage.setItem(chiave, '1'); } catch (e) {}
    var k = COL[g], p = document.createElement('div'); p.id = 'ct-pop';
    var n = conta(g);
    p.innerHTML = '<div class="c" style="border-color:' + k.c + '"><h3 style="color:' + k.c + '">' + (g === 'Rosso' ? '🚨 C’è stato un guasto' : '⚠️ Qualcosa da guardare') + '</h3><p>' + n + ' quadretto' + (n > 1 ? 'i' : '') + ' ' + (g === 'Rosso' ? 'in rosso' : 'in giallo') + ' nella centralina. Vai a vedere cosa è successo.</p><div class="ct-row"><button class="ct-btn ' + (g === 'Rosso' ? 'ros' : '') + '" id="ct-pop-vai">Vai alla centralina</button><button class="ct-btn sec" id="ct-pop-no">Dopo</button></div></div>';
    document.body.appendChild(p);
    if (g === 'Rosso') suono();
    $('ct-pop-no').onclick = function () { p.remove(); };
    $('ct-pop-vai').onclick = function () { p.remove(); apri(); };
  }
  function apri() { vista = 'griglia'; if (window.ectMenuGestori) window.ectMenuGestori.vai('centralina'); disegna(); }

  /* ---------- azioni ---------- */
  function msg(t) { var m = $('ct-msg'); if (m) m.textContent = t; }
  function azione(az, id) {
    var x = stato.q.filter(function (y) { return String(y.id) === String(id); })[0]; if (!x) return;
    if (az === 'stampa') return stampa(x);
    if (!DEMO && !stato.collegata) { msg('La centralina non è ancora collegata: questo comando funzionerà dopo il collegamento.'); return; }
    if (DEMO) return azioneDemo(az, x);
    msg('Invio il comando…');
    fetch(CENTRALINA_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'centralina_' + az, id: x.id }) })
      .then(function (r) { return r.text(); }).then(function (t) { var j = null; try { j = JSON.parse(t); } catch (e) {} if (j && j.ok === false) throw new Error(j.errore === 'quadretto_non_ancora_attivo' ? 'questo quadretto non è ancora attivo' : (j.errore || 'comando rifiutato')); msg(''); return carica(); })
      .catch(function (e) { msg('Non è riuscito: ' + (e && e.message || e)); });
  }
  function azioneDemo(az, x) {
    if (az === 'risolto') { x.stato = 'Verde'; x.dettaglio = ''; x.ultimo_controllo = new Date().toISOString(); stato.arch.unshift({ titolo: x.nome + ': segnato risolto', quadretto: x.id, livello: 'Giallo', quando: new Date().toISOString(), chi: 'Gestore', azione: 'Segnato risolto a mano', esito: 'Risolto', segnato_risolto: true }); disegna(); return; }
    if (az === 'controlla') { x.ultimo_controllo = new Date().toISOString(); msg('Controllato: tutto a posto.'); setTimeout(disegna, 600); return; }
    var passo = Number(x.tentativi) || 0, chi = PASSI[Math.min(passo, 2)];
    msg(chi + ' al lavoro…');
    setTimeout(function () {
      var okk = passo >= (x._risolveAl || 0);
      x.tentativi = passo + 1; x.ultimo_intervento = chi; x.ultimo_controllo = new Date().toISOString();
      if (okk) { x.stato = 'Verde'; x.dettaglio = ''; stato.arch.unshift({ titolo: x.nome + ': sistemato', quadretto: x.id, livello: 'Giallo', quando: new Date().toISOString(), chi: chi, azione: 'Riparazione automatica (demo)', esito: 'Risolto', segnato_risolto: false }); }
      else { x.stato = 'Rosso'; x.dettaglio = (x.dettaglio || '') + ''; }
      disegna();
    }, 1500);
  }
  function stampa(x) {
    var m = META[x.id] || {}, w = window.open('', '_blank'); if (!w) { msg('Il browser ha bloccato la finestra di stampa.'); return; }
    w.document.write('<html><head><meta charset="utf-8"><title>Centralina — ' + esc(x.nome) + '</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1{margin:0 0 4px}.s{font-size:18px;font-weight:700}td{padding:6px 10px;border-bottom:1px solid #ccc;vertical-align:top}table{border-collapse:collapse;width:100%;margin-top:14px}</style></head><body><h1>EcoTruckConnect — Centralina</h1><div class="s">' + esc(x.id) + ' · ' + esc(x.nome) + ' — ' + esc(x.stato) + '</div><table>' +
      '<tr><td><b>Stampato il</b></td><td>' + new Date().toLocaleString('it-IT') + (DEMO ? ' (DEMO: dati di esempio)' : '') + '</td></tr>' +
      '<tr><td><b>Ultimo controllo</b></td><td>' + esc(fmt(x.ultimo_controllo)) + '</td></tr>' +
      '<tr><td><b>Cosa è successo</b></td><td>' + esc(x.dettaglio || '—') + '</td></tr>' +
      '<tr><td><b>Cosa controlla</b></td><td>' + esc(m.cosa || '') + '</td></tr>' +
      '<tr><td><b>Dove ripararlo</b></td><td>' + esc(m.link || '') + '</td></tr>' +
      '<tr><td><b>Tentativi / ultimo intervento</b></td><td>' + (x.tentativi || 0) + ' · ' + esc(x.ultimo_intervento || 'Nessuno') + '</td></tr></table><script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }
  function stampaReport() {
    var w = window.open('', '_blank'); if (!w) { alert('Il browser ha bloccato la finestra di stampa: consentila e riprova.'); return; }
    var oggi = giornoDi(new Date().toISOString());
    var ev = stato.arch.filter(function (e) { return giornoDi(e.quando) === oggi; }).sort(function (a, b) { return new Date(a.quando) - new Date(b.quando); });
    var g = globale();
    var tq = stato.q.map(function (x) {
      var m = META[x.id] || {};
      return '<tr><td>' + esc(x.id) + '</td><td><b>' + esc(x.nome) + '</b></td><td>' + esc(x.stato) + '</td><td>' + esc(fmt(x.ultimo_controllo)) + '</td><td>' + esc(x.dettaglio || '') + (x.stato === 'Giallo' || x.stato === 'Rosso' ? '<br><small>Dove ripararlo: ' + esc(m.link || '') + '</small>' : '') + '</td></tr>';
    }).join('');
    var te = ev.length ? ev.map(function (e) { return '<tr><td>' + esc(fmt(e.quando, 1)) + '</td><td>' + esc(e.livello) + '</td><td>' + esc(e.titolo) + '</td><td>' + esc(e.chi) + ': ' + esc(e.azione) + '</td><td>' + esc(e.esito) + '</td></tr>'; }).join('') : '<tr><td colspan="5">Oggi nessun guasto registrato.</td></tr>';
    w.document.write('<html><head><meta charset="utf-8"><title>Report centralina ' + oggi + '</title><style>body{font-family:Arial,sans-serif;padding:26px;color:#111}h1{margin:0 0 4px}h2{margin:22px 0 6px;font-size:15px}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #bbb;padding:5px 8px;text-align:left;vertical-align:top}th{background:#eee}small{color:#555}</style></head><body><h1>EcoTruckConnect — Report centralina</h1><div>' + new Date().toLocaleString('it-IT') + ' · Stato generale: <b>' + esc(g) + '</b> · ' + conta('Verde') + ' verdi, ' + conta('Giallo') + ' gialli, ' + conta('Rosso') + ' rossi' + (DEMO ? ' · <b>DEMO: dati di esempio</b>' : '') + '</div><h2>I 16 quadretti</h2><table><tr><th>N.</th><th>Quadretto</th><th>Stato</th><th>Ultimo controllo</th><th>Dettaglio</th></tr>' + tq + '</table><h2>Cosa è successo oggi</h2><table><tr><th>Ora</th><th>Livello</th><th>Guasto</th><th>Chi e cosa</th><th>Esito</th></tr>' + te + '</table><script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }
  function csv() {
    var righe = [['quando', 'quadretto', 'nome', 'livello', 'chi', 'azione', 'esito', 'titolo']].concat(stato.arch.map(function (e) { return [e.quando, e.quadretto, nomeQ(e.quadretto), e.livello, e.chi, e.azione, e.esito, e.titolo]; }));
    var t = righe.map(function (r) { return r.map(function (c) { return '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' })); a.download = 'centralina-archivio' + (DEMO ? '-demo' : '') + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  function aggiornaOra() {
    if (occupato) return; occupato = true; stato.msgAgg = 'Controllo in corso…'; disegna();
    var fine = function (testo) {
      occupato = false; stato.agg = new Date().toISOString();
      stato.msgAgg = testo + ' (' + fmt(stato.agg, 1) + ')'; disegna();
      setTimeout(function () { stato.msgAgg = ''; disegna(); }, 12000);
    };
    if (DEMO) { setTimeout(function () { stato.q.forEach(function (x) { x.ultimo_controllo = new Date().toISOString(); }); fine('Aggiornato: ' + conta('Verde') + ' verdi, ' + conta('Giallo') + ' gialli, ' + conta('Rosso') + ' rossi'); }, 1400); return; }
    if (!CENTRALINA_URL) { setTimeout(function () { fine('Controllato, ma la centralina non è ancora collegata a Make: nessun controllo vero'); }, 700); return; }
    carica(true).then(function () {
      fine(stato.collegata ? 'Aggiornato: ' + conta('Verde') + ' verdi, ' + conta('Giallo') + ' gialli, ' + conta('Rosso') + ' rossi' : 'Non sono riuscito ad aggiornare' + (stato.errore ? ': ' + stato.errore : ''));
    });
  }

  function legami(c) {
    c.addEventListener('click', function (e) {
      var t = e.target;
      var q = t.closest('[data-q]'); if (q) { vista = q.getAttribute('data-q'); disegna(); window.scrollTo(0, 0); return; }
      if (t.closest('[data-back]')) { vista = 'griglia'; disegna(); return; }
      if (t.closest('#ct-agg')) { aggiornaOra(); return; }
      if (t.closest('[data-az-rep]')) { stampaReport(); return; }
      if (t.closest('#ct-csv')) { csv(); return; }
      var ms = t.closest('[data-mese]'); if (ms) { meseVis.setMonth(meseVis.getMonth() + Number(ms.getAttribute('data-mese'))); disegna(); return; }
      var g = t.closest('[data-g]'); if (g) { giornoSel = g.getAttribute('data-g'); disegna(); return; }
      var a = t.closest('[data-az]'); if (a) azione(a.getAttribute('data-az'), vista);
    });
  }

  function avvia() {
    stile();
    var n = 0, iv = setInterval(function () {
      n++;
      if ($('mg-centralina') && document.querySelector('#mg-side')) { clearInterval(iv); carica(); setInterval(function () { if (vista === 'griglia' && !occupato) carica(); }, 5 * 60000); }
      else if (n > 80) clearInterval(iv);
    }, 250);
  }
  window.ectCentralina = { apri: apri, ricarica: carica, demo: DEMO };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
