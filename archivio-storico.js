/* =====================================================================
   EcoTruckConnect — archivio-storico.js (3/10/2026)
   Archivio storico TRASPORTATORI e archivio storico AZIENDE.
   Sostituisce "Registro attività" e "Anagrafica trasportatori e aziende".

   - Ogni utente: campanella cambi dati (verde normali, rossa P.IVA/IBAN/
     documenti), campanella interventi (rossa), etichetta scadenza.
     Lampeggiano finché non apri l'utente.
   - Archivio: contatori, Stampa tutto / Scegli cosa stampare / periodo /
     CSV, sezioni con Vedi e Stampa. Date e orari sempre indicati.
   - Scadenze: promemoria a 15, 7, 1 giorni, poi 3 giorni di tolleranza,
     poi sospensione.
   - Mai prezzi: solo "Pagamento iscrizione" / "Pagamento carico".

   Questa e' la versione DEMO (dati finti, generati qui sotto, sempre
   "freschi" rispetto a oggi). La versione reale leggera' Airtable.
   ===================================================================== */
(function () {
  'use strict';

  var CHIAVE_VISTI = 'ect_archivio_visti_demo';
  var TOLLERANZA = 2; /* 3/10: 48 ore dopo la scadenza, poi sospeso */

  /* ---------------- utilita' ---------------- */
  function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function due(n) { return (n < 10 ? '0' : '') + n; }
  function dataOra(d) { d = new Date(d); return due(d.getDate()) + '/' + due(d.getMonth() + 1) + '/' + d.getFullYear() + ' ore ' + due(d.getHours()) + ':' + due(d.getMinutes()); }
  function soloData(d) { d = new Date(d); return due(d.getDate()) + '/' + due(d.getMonth() + 1) + '/' + d.getFullYear(); }
  var ORA = new Date();
  function fra(giorni, ore, min) { var d = new Date(ORA); d.setDate(d.getDate() + giorni); d.setHours(ore == null ? 9 : ore, min || 0, 0, 0); return d.toISOString(); }
  function giorniA(iso) { var a = new Date(ORA); a.setHours(0, 0, 0, 0); var b = new Date(iso); b.setHours(0, 0, 0, 0); return Math.round((b - a) / 86400000); }
  function leggiVisti() { try { return JSON.parse(localStorage.getItem(CHIAVE_VISTI) || '{}'); } catch (e) { return {}; } }
  function salvaVisti(v) { try { localStorage.setItem(CHIAVE_VISTI, JSON.stringify(v)); } catch (e) {} }
  var visti = leggiVisti();

  function docEsempio(t, chi) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="595" height="420"><rect width="595" height="420" fill="#fff" stroke="#333" stroke-width="4"/>' +
      '<text x="297" y="90" font-family="Arial" font-size="28" text-anchor="middle" fill="#111">DOCUMENTO DI ESEMPIO</text>' +
      '<text x="297" y="160" font-family="Arial" font-size="22" text-anchor="middle" fill="#1d4ed8">' + esc(t) + '</text>' +
      '<text x="297" y="220" font-family="Arial" font-size="18" text-anchor="middle" fill="#444">' + esc(chi) + '</text>' +
      '<text x="297" y="330" font-family="Arial" font-size="14" text-anchor="middle" fill="#888">Dashboard demo EcoTruckConnect - non e un documento reale</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* =====================================================================
     DATI DEMO
     ===================================================================== */
  function viaggio(n, giorni, da, a, controparte, importo, pagato, extra) {
    return Object.assign({ id: 'V' + n, numero: 'ORD-DEMO-' + n, quando: fra(giorni, 8 + (n % 9), (n * 7) % 60), da: da, a: a, controparte: controparte, importo: importo, pagato: pagato,
      ritiro: 'Via Roma ' + (n % 40 + 1) + ', ' + da, consegna: 'Via Libertà ' + (n % 60 + 2) + ', ' + a, merce: ['Alimentare', 'Edilizia', 'Rifiuti non pericolosi', 'Pallet misti'][n % 4] }, extra || {});
  }
  var TRASP = [
    { id: 'T1', tipo: 'trasportatore', nome: 'Marco Russo (DEMO)', ragione: 'Russo Trasporti SRLS', email: 'marco.russo@esempio.it', tel: '333 1112233', piva: '01234567890', sede: 'Via Etna 7, 92100 Agrigento (AG)', stato: 'Approvato', iscritto: fra(-359, 10, 12), scadenza: fra(6),
      mezzi: ['Furgone frigo', 'Motrice centinata'],
      aut: [{ a: 'Conto Terzi', f: 'licenza-conto-terzi.pdf', q: fra(-40, 17, 5) }, { a: 'Frigorifero (0°C) - ATP', f: 'atp-2026.jpg', q: fra(-40, 17, 9) }, { a: 'Albo Gestori Ambientali', f: 'albo-gestori.pdf', q: fra(-3, 11, 22) }],
      viaggi: [viaggio(101, -1, 'Favara', 'Palermo', 'Edil Sud Srl (DEMO)', '180', false), viaggio(102, -4, 'Agrigento', 'Catania', 'Eco Recuperi Sicilia (DEMO)', '260', true), viaggio(103, -9, 'Licata', 'Gela', 'Gilda SRLS (DEMO)', '120', true), viaggio(104, -15, 'Favara', 'Sciacca', 'Edil Sud Srl (DEMO)', '140', true), viaggio(105, -22, 'Canicattì', 'Caltanissetta', 'Edil Sud Srl (DEMO)', '90', true)],
      viaggiTot: 150,
      pagamenti: [{ t: 'Pagamento carico', q: fra(-1, 9, 41), n: 'ORD-DEMO-101' }, { t: 'Pagamento carico', q: fra(-4, 15, 3), n: 'ORD-DEMO-102' }, { t: 'Rimborso carico', q: fra(-7, 12, 30), n: 'ORD-DEMO-099 (non assegnato)' }, { t: 'Pagamento carico', q: fra(-9, 8, 12), n: 'ORD-DEMO-103' }, { t: 'Pagamento iscrizione', q: fra(-359, 10, 30), n: 'Iscrizione annuale' }],
      promemoria: [{ t: 'Promemoria: scade tra 15 giorni', q: fra(-9, 8, 0) }, { t: 'Promemoria: scade tra 7 giorni', q: fra(-1, 8, 0) }],
      cambi: [{ id: 'c1', q: fra(0, 18, 40), campo: 'Partita IVA', prima: '01234567809', dopo: '01234567890', sens: true }, { id: 'c2', q: fra(-2, 10, 15), campo: 'Mezzi', prima: 'Furgone frigo', dopo: 'Furgone frigo, Motrice centinata', sens: false }],
      attivita: [{ q: fra(-3, 11, 22), t: 'Documento caricato', d: 'Albo Gestori Ambientali — albo-gestori.pdf' }, { q: fra(-5, 7, 58), t: 'Accesso al portale', d: 'da telefono' }, { q: fra(-11, 19, 4), t: 'Documento sostituito', d: 'Conto Terzi — licenza-conto-terzi.pdf' }],
      interventi: [{ id: 'i1', q: fra(-359, 9, 50), t: 'Iscrizione approvata', d: 'Approvata dalla dashboard (Gerlando)', grave: false }]
    },
    { id: 'T2', tipo: 'trasportatore', nome: 'Giuseppe Lo Bue (DEMO)', ragione: 'Lo Bue Giuseppe — ditta individuale', email: 'g.lobue@esempio.it', tel: '347 2223344', piva: '09876543210', sede: 'Via Mazzini 22, 92026 Favara (AG)', stato: 'Approvato', iscritto: fra(-120, 16, 2), scadenza: fra(245),
      mezzi: ['Bilico cassonato', 'Cassone scarrabile'],
      aut: [{ a: 'Conto Terzi', f: 'licenza-lobue.pdf', q: fra(-119, 18, 30) }],
      viaggi: [viaggio(201, -2, 'Favara', 'Trapani', 'Gilda SRLS (DEMO)', '280', false), viaggio(202, -6, 'Agrigento', 'Palermo', 'Edil Sud Srl (DEMO)', '200', true), viaggio(203, -13, 'Ribera', 'Sciacca', 'Eco Recuperi Sicilia (DEMO)', '70', true)],
      viaggiTot: 40,
      pagamenti: [{ t: 'Pagamento carico', q: fra(-2, 10, 5), n: 'ORD-DEMO-201' }, { t: 'Pagamento carico', q: fra(-6, 14, 48), n: 'ORD-DEMO-202' }, { t: 'Pagamento iscrizione', q: fra(-120, 16, 40), n: 'Iscrizione annuale' }],
      promemoria: [],
      cambi: [{ id: 'c3', q: fra(0, 9, 12), campo: 'Telefono', prima: '347 2223300', dopo: '347 2223344', sens: false }, { id: 'c4', q: fra(0, 9, 13), campo: 'Sede', prima: 'Via Roma 3, Favara', dopo: 'Via Mazzini 22, Favara', sens: false }],
      attivita: [{ q: fra(-1, 21, 10), t: 'Accesso al portale', d: 'da computer' }],
      interventi: [{ id: 'i2', q: fra(-120, 17, 1), t: 'Iscrizione approvata', d: 'Approvata dalla dashboard (Davide)', grave: false }]
    },
    { id: 'T3', tipo: 'trasportatore', nome: 'Antonio Pirrera (DEMO)', ragione: 'Pirrera Trasporti SRL', email: 'pirrera.demo@esempio.it', tel: '320 5556677', piva: '05554443331', sede: 'Via Agrigento 5, 92027 Licata (AG)', stato: 'Iscrizione scaduta — in tolleranza', iscritto: fra(-366, 9, 0), scadenza: fra(-1),
      mezzi: ['Furgone piccolo (fino 3,5t)', 'Motrice piccola (7,5t)'],
      aut: [{ a: 'Conto Terzi', f: 'licenza-pirrera.pdf', q: fra(-360, 12, 0) }],
      viaggi: [viaggio(301, -20, 'Licata', 'Ragusa', 'Gilda SRLS (DEMO)', '150', true)],
      viaggiTot: 12,
      pagamenti: [{ t: 'Pagamento carico', q: fra(-20, 11, 11), n: 'ORD-DEMO-301' }, { t: 'Pagamento iscrizione', q: fra(-366, 9, 20), n: 'Iscrizione annuale' }],
      promemoria: [{ t: 'Promemoria: scade tra 15 giorni', q: fra(-16, 8, 0) }, { t: 'Promemoria: scade tra 7 giorni', q: fra(-8, 8, 0) }, { t: 'Ultimo avviso: scade domani', q: fra(-2, 8, 0) }, { t: 'Iscrizione scaduta: 3 giorni per rinnovare', q: fra(-1, 8, 0) }],
      cambi: [],
      attivita: [{ q: fra(-1, 8, 47), t: 'Accesso al portale', d: 'ha aperto la pagina del rinnovo' }],
      interventi: [{ id: 'i3', q: fra(-1, 8, 0), t: 'Iscrizione scaduta', d: 'Partite le 48 ore di tolleranza: senza rinnovo l\'account verrà sospeso', grave: true }]
    },
    { id: 'T4', tipo: 'trasportatore', nome: 'Salvatore Greco (DEMO)', ragione: 'Greco Salvatore — ditta individuale', email: 's.greco@esempio.it', tel: '388 9990011', piva: '07778889990', sede: 'Via Kennedy 9, 90100 Palermo (PA)', stato: 'In attesa di approvazione', iscritto: fra(0, 11, 37), scadenza: null,
      mezzi: ['Motrice centinata'], aut: [{ a: 'Conto Terzi', f: 'licenza-greco.jpg', q: fra(0, 11, 45) }],
      viaggi: [], viaggiTot: 0, pagamenti: [], promemoria: [],
      cambi: [], attivita: [{ q: fra(0, 11, 37), t: 'Registrazione', d: 'Compilato il modulo di iscrizione dalla vetrina' }],
      interventi: [{ id: 'i4', q: fra(0, 11, 38), t: 'Richiesta di iscrizione', d: 'In attesa della vostra approvazione', grave: false }]
    }
  ];
  var AZIENDE = [
    { id: 'A1', tipo: 'azienda', nome: 'Edil Sud Srl (DEMO)', ragione: 'Edil Sud Srl', referente: 'Giuseppe Rossi', email: 'info@edilsud-esempio.it', tel: '0922 111222', piva: '01112223334', sede: 'Via Roma 12, 92026 Favara (AG)', stato: 'Approvato', iscritto: fra(-200, 10, 0), scadenza: fra(165),
      pubblicati: [{ n: 'ORD-DEMO-101', q: fra(-2, 17, 20), da: 'Favara', a: 'Palermo', stato: 'PRESO', da_chi: 'Marco Russo (DEMO)', idT: 'T1', preso: fra(-1, 9, 41) }, { n: 'ORD-DEMO-202', q: fra(-7, 9, 0), da: 'Agrigento', a: 'Palermo', stato: 'PRESO', da_chi: 'Giuseppe Lo Bue (DEMO)', idT: 'T2', preso: fra(-6, 14, 48) }, { n: 'ORD-DEMO-150', q: fra(0, 8, 30), da: 'Favara', a: 'Messina', stato: 'DISPONIBILE' }],
      pagamenti: [{ t: 'Pagamento iscrizione', q: fra(-200, 10, 20), n: 'Iscrizione annuale' }],
      promemoria: [],
      cambi: [{ id: 'c5', q: fra(0, 12, 5), campo: 'Referente', prima: 'Mario Rossi', dopo: 'Giuseppe Rossi', sens: false }],
      attivita: [{ q: fra(0, 8, 30), t: 'Carico pubblicato', d: 'ORD-DEMO-150 Favara → Messina' }, { q: fra(-1, 9, 50), t: 'Documenti trasportatore visti', d: 'Marco Russo (DEMO) — 3 documenti' }],
      interventi: [{ id: 'i5', q: fra(-200, 10, 5), t: 'Iscrizione approvata', d: 'Approvata dalla dashboard (Gerlando)', grave: false }]
    },
    { id: 'A2', tipo: 'azienda', nome: 'Eco Recuperi Sicilia (DEMO)', ragione: 'Eco Recuperi Sicilia Srl', referente: 'Laura Bianchi', email: 'info@ecorecuperi-esempio.it', tel: '095 333444', piva: '04445556667', sede: 'Zona Industriale, 95121 Catania (CT)', stato: 'Approvato', iscritto: fra(-90, 15, 0), scadenza: fra(275),
      pubblicati: [{ n: 'ORD-DEMO-102', q: fra(-5, 11, 0), da: 'Agrigento', a: 'Catania', stato: 'PRESO', da_chi: 'Marco Russo (DEMO)', idT: 'T1', preso: fra(-4, 15, 3) }, { n: 'ORD-DEMO-203', q: fra(-14, 10, 0), da: 'Ribera', a: 'Sciacca', stato: 'PRESO', da_chi: 'Giuseppe Lo Bue (DEMO)', idT: 'T2', preso: fra(-13, 9, 30) }],
      pagamenti: [{ t: 'Pagamento iscrizione', q: fra(-90, 15, 20), n: 'Iscrizione annuale' }],
      promemoria: [], cambi: [], attivita: [{ q: fra(-4, 15, 30), t: 'Accesso al portale', d: 'da computer' }],
      interventi: [{ id: 'i6', q: fra(-3, 16, 10), t: 'Richiesta di eliminazione account', d: 'Richiesta inviata dal portale — da gestire entro 30 giorni (GDPR)', grave: true }]
    },
    { id: 'A3', tipo: 'azienda', nome: 'Gilda SRLS (DEMO)', ragione: 'Gilda SRLS', referente: 'Carmela Gilda', email: 'info@gilda-esempio.it', tel: '0922 555666', piva: '04567891230', sede: 'Via Atenea 50, 92100 Agrigento (AG)', stato: 'Approvato', iscritto: fra(-364, 9, 0), scadenza: fra(1),
      pubblicati: [{ n: 'ORD-DEMO-103', q: fra(-10, 9, 0), da: 'Licata', a: 'Gela', stato: 'PRESO', da_chi: 'Marco Russo (DEMO)', idT: 'T1', preso: fra(-9, 8, 12) }, { n: 'ORD-DEMO-201', q: fra(-3, 12, 0), da: 'Favara', a: 'Trapani', stato: 'PRESO', da_chi: 'Giuseppe Lo Bue (DEMO)', idT: 'T2', preso: fra(-2, 10, 5) }, { n: 'ORD-DEMO-301', q: fra(-21, 9, 0), da: 'Licata', a: 'Ragusa', stato: 'PRESO', da_chi: 'Antonio Pirrera (DEMO)', idT: 'T3', preso: fra(-20, 11, 11) }],
      pagamenti: [{ t: 'Pagamento iscrizione', q: fra(-364, 9, 25), n: 'Iscrizione annuale' }],
      promemoria: [{ t: 'Promemoria: scade tra 15 giorni', q: fra(-14, 8, 0) }, { t: 'Promemoria: scade tra 7 giorni', q: fra(-6, 8, 0) }, { t: 'Ultimo avviso: scade domani', q: fra(0, 8, 0) }],
      cambi: [{ id: 'c6', q: fra(-1, 17, 2), campo: 'IBAN', prima: 'IT60 X054 •••• 1234', dopo: 'IT60 X054 •••• 9876', sens: true }],
      attivita: [{ q: fra(0, 8, 15), t: 'Accesso al portale', d: 'da telefono' }],
      interventi: [{ id: 'i7', q: fra(-364, 9, 10), t: 'Iscrizione approvata', d: 'Approvata dalla dashboard (Davide)', grave: false }]
    }
  ];
  function trovaT(id) { return TRASP.filter(function (t) { return t.id === id; })[0]; }

  /* =====================================================================
     STATO SCADENZA / NOVITA'
     ===================================================================== */
  function statoScadenza(u) {
    if (!u.scadenza) return null;
    var g = giorniA(u.scadenza);
    if (g > 15) return { txt: 'Scade il ' + soloData(u.scadenza), cls: '', blink: false, g: g };
    if (g > 7) return { txt: 'Scade tra ' + g + ' giorni', cls: 'arc-amb', blink: false, g: g };
    if (g > 1) return { txt: 'Scade tra ' + g + ' giorni', cls: 'arc-amb', blink: true, g: g };
    if (g === 1) return { txt: 'Ultimo giorno: scade domani', cls: 'arc-red', blink: true, g: g };
    if (g === 0) return { txt: 'Scaduta oggi — 48 ore per rinnovare', cls: 'arc-red', blink: true, g: g };
    var resto = TOLLERANZA + g;
    if (resto > 0) return { txt: 'Scaduta — ' + resto + (resto === 1 ? ' giorno' : ' giorni') + ' per rinnovare', cls: 'arc-red', blink: true, g: g };
    return { txt: 'Sospeso per mancato rinnovo', cls: 'arc-red', blink: false, g: g };
  }
  /* demo: le cose piu' vecchie di 3 giorni si considerano gia' viste */
  function recente(c) { return (ORA - new Date(c.q)) < 3 * 86400000; }
  function cambiNuovi(u) { return u.cambi.filter(function (c) { return recente(c) && !visti[u.id + ':' + c.id]; }); }
  function interventiNuovi(u) { return u.interventi.filter(function (c) { return recente(c) && !visti[u.id + ':' + c.id]; }); }
  var sessNuovi = {};
  function evidCambi(u) { var x = sessNuovi[u.id] || {}; return u.cambi.filter(function (c) { return x[c.id] || !visti[u.id + ':' + c.id]; }); }
  function evidInt(u) { var x = sessNuovi[u.id] || {}; return u.interventi.filter(function (c) { return x[c.id] || !visti[u.id + ':' + c.id]; }); }
  function segnaVisto(u) {
    sessNuovi[u.id] = sessNuovi[u.id] || {};
    cambiNuovi(u).concat(interventiNuovi(u)).forEach(function (c) { sessNuovi[u.id][c.id] = 1; });
    u.cambi.forEach(function (c) { visti[u.id + ':' + c.id] = Date.now(); });
    u.interventi.forEach(function (c) { visti[u.id + ':' + c.id] = Date.now(); });
    salvaVisti(visti);
  }

  /* =====================================================================
     STILE
     ===================================================================== */
  var css = '' +
    '.arc-wrap{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:22px;}' +
    '.arc-top{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:16px;}' +
    '.arc-cont{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;flex:1;min-width:280px;}' +
    '.arc-box{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;}' +
    '.arc-box .l{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;}' +
    '.arc-box .v{font-family:var(--font-h);font-size:24px;font-weight:800;margin-top:2px;}' +
    '.arc-tool{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;}' +
    '.arc-tool input{flex:1;min-width:220px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text);font-family:var(--font-b);font-size:13px;outline:none;}' +
    '.arc-btn{background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-b);white-space:nowrap;}' +
    '.arc-btn:hover{background:rgba(255,255,255,0.1);}' +
    '.arc-btn.pri{background:var(--blue);border-color:var(--blue);color:#fff;}' +
    '.arc-row{border-top:1px solid var(--border);}' +
    '.arc-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:13px 4px;cursor:pointer;flex-wrap:wrap;}' +
    '.arc-head:hover{background:rgba(255,255,255,0.02);}' +
    '.arc-nome{font-weight:700;font-size:14px;}' +
    '.arc-sub{font-size:12px;color:var(--muted);margin-top:2px;}' +
    '.arc-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;margin-left:6px;}' +
    '.arc-tag.t{background:rgba(59,130,246,0.15);color:#60a5fa;}.arc-tag.a{background:rgba(245,158,11,0.15);color:#fbbf24;}' +
    '.arc-pill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:4px 9px;border-radius:20px;white-space:nowrap;}' +
    '.arc-grn{background:rgba(34,197,94,0.15);color:#4ade80;border:1px solid rgba(34,197,94,0.45);}' +
    '.arc-red{background:rgba(239,68,68,0.14);color:#f87171;border:1px solid rgba(239,68,68,0.5);}' +
    '.arc-amb{background:rgba(245,158,11,0.14);color:#fbbf24;border:1px solid rgba(245,158,11,0.45);}' +
    '.arc-gry{background:rgba(255,255,255,0.05);color:var(--muted);border:1px solid var(--border);}' +
    '@keyframes arcLamp{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(239,68,68,0)}50%{opacity:.45;box-shadow:0 0 0 4px rgba(239,68,68,0.15)}}' +
    '.arc-lamp{animation:arcLamp 1.2s ease-in-out infinite;}' +
    '.arc-dx{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}' +
    '.arc-body{padding:4px 4px 18px;}' +
    '.arc-sez{border:1px solid var(--border);border-radius:12px;margin-top:10px;overflow:hidden;}' +
    '.arc-sez-h{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 14px;background:rgba(255,255,255,0.02);flex-wrap:wrap;}' +
    '.arc-sez-h b{font-size:13px;}' +
    '.arc-sez-c{padding:4px 14px 12px;font-size:13px;}' +
    '.arc-li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05);flex-wrap:wrap;}' +
    '.arc-li:last-child{border-bottom:none;}' +
    '.arc-q{font-size:11px;color:var(--muted);white-space:nowrap;}' +
    '.arc-new{background:rgba(34,197,94,0.07);border-left:3px solid #22c55e;padding-left:8px;}' +
    '.arc-new.s{background:rgba(239,68,68,0.07);border-left-color:#ef4444;}' +
    '.arc-sel{display:none;flex-wrap:wrap;gap:6px;margin:8px 0 2px;}' +
    '.arc-sel label{font-size:12px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:20px;padding:5px 11px;cursor:pointer;display:flex;gap:5px;align-items:center;}' +
    '.arc-sel select{background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:5px 8px;font-size:12px;}' +
    '.arc-line{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:6px 0 10px;}' +
    '.arc-line div{border-radius:8px;padding:7px 4px;text-align:center;font-size:11px;background:rgba(255,255,255,0.04);border:1px solid var(--border);}' +
    '.arc-line div.on{border-color:#22c55e;color:#4ade80;}' +
    '.arc-line div.qui{border-color:#ef4444;color:#f87171;}' +
    '.arc-vuoto{color:var(--muted);font-size:12px;padding:8px 0;}' +
    '@media(max-width:700px){.arc-line{grid-template-columns:repeat(3,minmax(0,1fr));}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  /* =====================================================================
     SEZIONI DELL'ARCHIVIO
     ===================================================================== */
  function li(sx, dx, cls) { return '<div class="arc-li' + (cls ? ' ' + cls : '') + '"><span>' + sx + '</span><span class="arc-q">' + (dx || '') + '</span></div>'; }
  function vuoto(t) { return '<div class="arc-vuoto">' + t + '</div>'; }
  function nelPeriodo(iso, gg) { if (!gg) return true; return (ORA - new Date(iso)) <= gg * 86400000; }

  function SEZIONI(u) {
    var T = u.tipo === 'trasportatore';
    var lista = [];
    var nuoviC = evidCambi(u), nuoviI = evidInt(u);
    lista.push({ k: 'anagrafica', t: '🪪 Anagrafica', html: function () {
      return li('<b>' + esc(u.ragione) + '</b>' + (u.referente ? '<br>Referente: ' + esc(u.referente) : ''), 'iscritto il ' + dataOra(u.iscritto)) +
        li('P.IVA ' + esc(u.piva), '') + li('📍 ' + esc(u.sede), '') + li('📞 ' + esc(u.tel) + ' · ✉️ ' + esc(u.email), '') + li('Stato: <b>' + esc(u.stato) + '</b>', '');
    } });
    if (T) {
      lista.push({ k: 'mezzi', t: '🚚 Mezzi', html: function () { return u.mezzi.map(function (m) { return li(esc(m), ''); }).join('') || vuoto('Nessun mezzo.'); } });
      lista.push({ k: 'aut', t: '📎 Autorizzazioni e documenti', html: function () {
        return u.aut.map(function (d, i) {
          return li('<b>' + esc(d.a) + '</b><br><span style="color:var(--muted);">' + esc(d.f) + '</span> <button class="arc-btn" onclick="event.stopPropagation();ectArcDoc(\'' + u.id + '\',' + i + ',false)">👁 Vedi</button> <button class="arc-btn" onclick="event.stopPropagation();ectArcDoc(\'' + u.id + '\',' + i + ',true)">🖨</button>', 'caricato il ' + dataOra(d.q));
        }).join('') || vuoto('Nessun documento.');
      } });
      lista.push({ k: 'viaggi', t: '🛣️ Viaggi (' + u.viaggiTot + ')', html: function (gg) {
        var v = u.viaggi.filter(function (x) { return nelPeriodo(x.quando, gg); });
        return (v.map(function (x) {
          return li('<b>' + esc(x.da) + ' → ' + esc(x.a) + '</b> · ' + esc(x.numero) + '<br>Azienda: ' + esc(x.controparte) + ' · Merce: ' + esc(x.merce) +
            '<br><span style="color:var(--muted);">Ritiro: ' + esc(x.ritiro) + ' · Consegna: ' + esc(x.consegna) + '</span><br>Importo pattuito (tra le parti): ' + esc(x.importo) + ' € · ' +
            (x.pagato ? '<span style="color:#4ade80;">trasporto pagato dall\'azienda</span>' : '<span style="color:#fbbf24;">trasporto da pagare</span>'), 'preso il ' + dataOra(x.quando));
        }).join('') || vuoto('Nessun viaggio nel periodo scelto.')) + (u.viaggiTot > u.viaggi.length ? '<div class="arc-vuoto">Nella demo sono mostrati gli ultimi ' + u.viaggi.length + ' viaggi su ' + u.viaggiTot + '.</div>' : '');
      } });
    } else {
      lista.push({ k: 'pubblicati', t: '📦 Carichi pubblicati (' + u.pubblicati.length + ')', html: function (gg) {
        return u.pubblicati.filter(function (c) { return nelPeriodo(c.q, gg); }).map(function (c) {
          return li('<b>' + esc(c.da) + ' → ' + esc(c.a) + '</b> · ' + esc(c.n) + ' · ' + (c.stato === 'PRESO' ? '<span style="color:#4ade80;">preso</span>' : '<span style="color:#60a5fa;">disponibile</span>'), 'pubblicato il ' + dataOra(c.q));
        }).join('') || vuoto('Nessun carico nel periodo scelto.');
      } });
      lista.push({ k: 'presi', t: '🤝 Carichi presi e da chi', html: function (gg) {
        return u.pubblicati.filter(function (c) { return c.stato === 'PRESO' && nelPeriodo(c.preso, gg); }).map(function (c) {
          var t = trovaT(c.idT);
          return li('<b>' + esc(c.da) + ' → ' + esc(c.a) + '</b> · ' + esc(c.n) + '<br>Trasportatore: <b>' + esc(c.da_chi) + '</b>' +
            (t ? '<br>Documenti: ' + t.aut.map(function (d, i) { return '<a href="#" style="color:#60a5fa;" onclick="event.preventDefault();event.stopPropagation();ectArcDoc(\'' + t.id + '\',' + i + ',false)">' + esc(d.a) + '</a>'; }).join(' · ') : ''), 'preso il ' + dataOra(c.preso));
        }).join('') || vuoto('Nessun carico preso nel periodo scelto.');
      } });
    }
    lista.push({ k: 'pagamenti', t: '💳 Pagamenti', html: function (gg) {
      return u.pagamenti.filter(function (p) { return nelPeriodo(p.q, gg); }).map(function (p) {
        var col = /Rimborso/.test(p.t) ? '#fbbf24' : '#4ade80';
        return li('<b style="color:' + col + ';">' + esc(p.t) + '</b> · ' + esc(p.n), dataOra(p.q));
      }).join('') || vuoto('Nessun pagamento nel periodo scelto.');
    } });
    lista.push({ k: 'scadenze', t: '⏰ Scadenze e promemoria', html: function () {
      if (!u.scadenza) return vuoto('Non ancora attivo: la scadenza parte dal primo pagamento dell\'iscrizione.');
      var g = giorniA(u.scadenza), s = statoScadenza(u);
      function fase(lbl, cond, qui) { return '<div class="' + (qui ? 'qui' : (cond ? 'on' : '')) + '">' + lbl + '</div>'; }
      var line = '<div class="arc-line">' + fase('-15 gg<br>email', g <= 15, g <= 15 && g > 7) + fase('-7 gg<br>email', g <= 7, g <= 7 && g > 1) + fase('-1 gg<br>ultimo avviso', g <= 1, g === 1) +
        fase('Scaduta<br>48 ore per rinnovare', g <= 0, g === 0) + fase('+1 gg<br>ultimo avviso', g <= -1, g === -1) + fase('+2 gg<br>sospeso', g <= -TOLLERANZA, g <= -TOLLERANZA) + '</div>';
      return li('Scadenza iscrizione: <b>' + soloData(u.scadenza) + '</b> — <span class="arc-pill ' + (s.cls || 'arc-gry') + '">' + esc(s.txt) + '</span>', '') + line +
        (u.promemoria.length ? u.promemoria.map(function (p) { return li('✉️ ' + esc(p.t), 'inviata il ' + dataOra(p.q)); }).join('') : vuoto('Nessun promemoria inviato finora.'));
    } });
    lista.push({ k: 'storico', t: '🕓 Storico attività', nuovi: nuoviC.length, sens: nuoviC.some(function (c) { return c.sens; }), html: function (gg) {
      var righe = u.cambi.map(function (c) { return { q: c.q, h: '<b>Cambio dati — ' + esc(c.campo) + '</b>' + (c.sens ? ' <span class="arc-pill arc-red">dato sensibile</span>' : '') + '<br>prima: <span style="color:var(--muted);">' + esc(c.prima) + '</span> → dopo: <b>' + esc(c.dopo) + '</b>', nuovo: nuoviC.indexOf(c) !== -1, sens: c.sens }; })
        .concat(u.attivita.map(function (a) { return { q: a.q, h: '<b>' + esc(a.t) + '</b><br><span style="color:var(--muted);">' + esc(a.d) + '</span>' }; }))
        .filter(function (r) { return nelPeriodo(r.q, gg); })
        .sort(function (a, b) { return new Date(b.q) - new Date(a.q); });
      return righe.map(function (r) { return li(r.h + (r.nuovo ? ' <span class="arc-pill ' + (r.sens ? 'arc-red' : 'arc-grn') + '">NUOVO</span>' : ''), dataOra(r.q), r.nuovo ? ('arc-new' + (r.sens ? ' s' : '')) : ''); }).join('') || vuoto('Nessuna attività nel periodo scelto.');
    } });
    lista.push({ k: 'interventi', t: '🛡️ Interventi e richieste', nuovi: nuoviI.length, sens: true, html: function (gg) {
      return u.interventi.filter(function (x) { return nelPeriodo(x.q, gg); }).map(function (x) {
        var n = nuoviI.indexOf(x) !== -1;
        return li('<b' + (x.grave ? ' style="color:#f87171;"' : '') + '>' + esc(x.t) + '</b><br><span style="color:var(--muted);">' + esc(x.d) + '</span>' + (n ? ' <span class="arc-pill arc-red">NUOVO</span>' : ''), dataOra(x.q), n ? 'arc-new s' : '');
      }).join('') || vuoto('Nessun intervento nel periodo scelto.');
    } });
    return lista;
  }

  /* =====================================================================
     RENDER
     ===================================================================== */
  var aperti = {}, sezAperte = {}, filtro = { trasportatore: '', azienda: '' }, periodo = {}, sceltaStampa = {};

  function campanelle(u) {
    var h = '', c = cambiNuovi(u), i = interventiNuovi(u), s = statoScadenza(u);
    if (c.length) { var ns = c.filter(function (x) { return x.sens; }).length; h += '<span class="arc-pill ' + (ns ? 'arc-red' : 'arc-grn') + ' arc-lamp" title="Cambi dati da vedere">🔔 ' + c.length + (c.length === 1 ? ' cambio dati' : ' cambi dati') + (ns ? ' · ' + ns + ' sensibile' : '') + '</span>'; }
    if (i.length) h += '<span class="arc-pill arc-red arc-lamp" title="Interventi e richieste da vedere">🛡️ ' + i.length + '</span>';
    if (s && s.cls) h += '<span class="arc-pill ' + s.cls + (s.blink ? ' arc-lamp' : '') + '">⏰ ' + esc(s.txt) + '</span>';
    return h;
  }
  function sottotitolo(u) {
    if (u.tipo === 'trasportatore') return esc(u.email) + ' · ' + esc(u.mezzi.join(', ')) + ' · ' + esc(u.stato) + ' · ' + u.viaggiTot + ' viaggi';
    var presi = u.pubblicati.filter(function (c) { return c.stato === 'PRESO'; }).length;
    return esc(u.email) + ' · ' + esc(u.stato) + ' · ' + u.pubblicati.length + ' carichi pubblicati · ' + presi + ' presi';
  }
  function contatori(u) {
    var box = function (l, v, col) { return '<div class="arc-box"><div class="l">' + l + '</div><div class="v"' + (col ? ' style="color:' + col + ';"' : '') + '>' + v + '</div></div>'; };
    var s = statoScadenza(u);
    if (u.tipo === 'trasportatore') {
      return box('Viaggi fatti', u.viaggiTot, 'var(--blue)') + box('Pagamenti carico', u.viaggiTot, '#4ade80') + box('Documenti', u.aut.length + '/' + u.aut.length) + box('Iscrizione', u.scadenza ? soloData(u.scadenza) : '—', s && s.cls === 'arc-red' ? '#f87171' : (s && s.cls ? '#fbbf24' : ''));
    }
    var presi = u.pubblicati.filter(function (c) { return c.stato === 'PRESO'; }).length;
    return box('Carichi pubblicati', u.pubblicati.length, 'var(--amber)') + box('Carichi presi', presi, '#4ade80') + box('Trasportatori usati', Object.keys(u.pubblicati.reduce(function (o, c) { if (c.idT) o[c.idT] = 1; return o; }, {})).length) + box('Iscrizione', u.scadenza ? soloData(u.scadenza) : '—', s && s.cls === 'arc-red' ? '#f87171' : (s && s.cls ? '#fbbf24' : ''));
  }
  function corpo(u) {
    var sez = SEZIONI(u), gg = periodo[u.id] || 0;
    if (!sceltaStampa[u.id]) { sceltaStampa[u.id] = {}; sez.forEach(function (s) { sceltaStampa[u.id][s.k] = true; }); }
    var h = '<div class="arc-body">' +
      '<div class="arc-cont" style="margin-bottom:12px;">' + contatori(u) + '</div>' +
      '<div class="arc-tool">' +
      '<button class="arc-btn pri" onclick="ectArcStampa(\'' + u.id + '\',\'tutto\')">🖨 Stampa tutto</button>' +
      '<button class="arc-btn" onclick="ectArcScegli(\'' + u.id + '\')">☑️ Scegli cosa stampare</button>' +
      '<button class="arc-btn" onclick="ectArcStampa(\'' + u.id + '\',\'scelta\')">📄 PDF</button>' +
      '<button class="arc-btn" onclick="ectArcCSV(\'' + u.id + '\')">⬇️ CSV</button>' +
      '<select class="arc-btn" onchange="ectArcPeriodo(\'' + u.id + '\',this.value)">' +
      [[0, 'Periodo: da sempre'], [7, 'Ultima settimana'], [30, 'Ultimo mese'], [365, 'Ultimo anno']].map(function (o) { return '<option value="' + o[0] + '"' + (gg == o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '</div>' +
      '<div class="arc-sel" id="arc-sel-' + u.id + '">' + sez.map(function (s) {
        return '<label><input type="checkbox" ' + (sceltaStampa[u.id][s.k] ? 'checked' : '') + ' onchange="ectArcSpunta(\'' + u.id + '\',\'' + s.k + '\',this.checked)"> ' + s.t + '</label>';
      }).join('') + '<button class="arc-btn pri" onclick="ectArcStampa(\'' + u.id + '\',\'scelta\')">🖨 Stampa selezione</button></div>';
    sez.forEach(function (s) {
      var k = u.id + ':' + s.k, ap = sezAperte[k] || (s.nuovi > 0);
      h += '<div class="arc-sez"><div class="arc-sez-h"><b>' + s.t + (s.nuovi ? ' <span class="arc-pill ' + (s.sens ? 'arc-red' : 'arc-grn') + '">' + s.nuovi + (s.nuovi === 1 ? ' nuovo' : ' nuovi') + '</span>' : '') + '</b>' +
        '<span class="arc-dx"><button class="arc-btn" onclick="ectArcSez(\'' + k + '\')">' + (ap ? '🙈 Chiudi' : '👁 Vedi') + '</button>' +
        '<button class="arc-btn" onclick="ectArcStampa(\'' + u.id + '\',\'' + s.k + '\')">🖨 Stampa</button></span></div>' +
        (ap ? '<div class="arc-sez-c">' + s.html(gg) + '</div>' : '') + '</div>';
    });
    return h + '</div>';
  }
  function riga(u) {
    var ap = !!aperti[u.id];
    return '<div class="arc-row" id="arc-row-' + u.id + '"><div class="arc-head" onclick="ectArcApri(\'' + u.id + '\')">' +
      '<div><span class="arc-nome">' + esc(u.nome) + '</span><span class="arc-tag ' + (u.tipo === 'trasportatore' ? 't">Trasportatore' : 'a">Azienda') + '</span>' +
      '<div class="arc-sub">' + sottotitolo(u) + '</div></div>' +
      '<div class="arc-dx">' + campanelle(u) + '<button class="arc-btn" onclick="event.stopPropagation();ectArcApri(\'' + u.id + '\')">' + (ap ? '🙈 Chiudi' : '👁 Vedi') + '</button><span style="color:var(--muted);">' + (ap ? '▴' : '▾') + '</span></div>' +
      '</div>' + (ap ? corpo(u) : '') + '</div>';
  }
  function sezione(tipo) {
    var lista = tipo === 'trasportatore' ? TRASP : AZIENDE;
    var q = (filtro[tipo] || '').toLowerCase().trim();
    var vis = lista.filter(function (u) {
      if (!q) return true;
      var t = [u.nome, u.ragione, u.email, u.piva, u.stato, (u.mezzi || []).join(' '), (u.aut || []).map(function (a) { return a.a; }).join(' ')].join(' ').toLowerCase();
      return t.indexOf(q) !== -1;
    });
    var attivi = lista.filter(function (u) { return /Approvato/.test(u.stato); }).length;
    var attesa = lista.filter(function (u) { return /attesa/i.test(u.stato); }).length;
    var vicine = lista.filter(function (u) { var s = statoScadenza(u); return s && s.cls; }).length;
    var nCambi = lista.reduce(function (n, u) { return n + cambiNuovi(u).length; }, 0);
    var nInt = lista.reduce(function (n, u) { return n + interventiNuovi(u).length; }, 0);
    var box = function (l, v, col, lamp) { return '<div class="arc-box' + (lamp ? ' arc-lamp' : '') + '"><div class="l">' + l + '</div><div class="v" style="color:' + col + ';">' + v + '</div></div>'; };
    var h = '<div class="arc-wrap">' +
      '<div class="arc-top"><div class="arc-cont">' +
      box(tipo === 'trasportatore' ? 'Trasportatori registrati' : 'Aziende registrate', lista.length, tipo === 'trasportatore' ? 'var(--blue)' : 'var(--amber)') +
      box('Attivi', attivi, '#4ade80') + box('In attesa', attesa, attesa ? '#fbbf24' : 'var(--muted)') + box('Scadenze vicine', vicine, vicine ? '#f87171' : 'var(--muted)', vicine > 0) + '</div>' +
      '<div class="arc-dx">' + (nCambi ? '<span class="arc-pill arc-grn arc-lamp">🔔 ' + nCambi + (nCambi === 1 ? ' cambio dati da vedere' : ' cambi dati da vedere') + '</span>' : '<span class="arc-pill arc-gry">🔔 nessun cambio dati nuovo</span>') +
      (nInt ? '<span class="arc-pill arc-red arc-lamp">🛡️ ' + nInt + (nInt === 1 ? ' intervento o richiesta' : ' interventi e richieste') + '</span>' : '') + '</div></div>' +
      '<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">Tutto quello che ha fatto ogni ' + (tipo === 'trasportatore' ? 'trasportatore' : 'azienda') + ', con data e ora: anagrafica, ' + (tipo === 'trasportatore' ? 'mezzi, autorizzazioni, viaggi' : 'carichi pubblicati e presi') + ', pagamenti, scadenze, cambi dati, interventi. La 🔔 lampeggia finché non apri l\'utente: verde = cambi normali, rossa = P.IVA, IBAN, documenti.</div>' +
      '<div class="arc-tool"><input type="text" placeholder="🔍 Cerca per nome, email, P.IVA' + (tipo === 'trasportatore' ? ', mezzo o autorizzazione' : '') + '..." value="' + esc(filtro[tipo]) + '" oninput="ectArcCerca(\'' + tipo + '\',this.value)">' +
      '<button class="arc-btn" onclick="ectArcStampaElenco(\'' + tipo + '\')">🖨 Stampa elenco</button><button class="arc-btn" onclick="ectArcCSVElenco(\'' + tipo + '\')">⬇️ CSV</button>' +
      '<button class="arc-btn" onclick="ectArcAzzera()" title="Solo demo: fa tornare le campanelle accese">↺ Riaccendi campanelle (demo)</button></div>' +
      (vis.map(riga).join('') || '<div class="arc-vuoto">Nessun risultato per "' + esc(q) + '".</div>') + '</div>';
    return h;
  }
  function render(tipo) {
    var id = tipo === 'trasportatore' ? 'arch-trasportatori' : 'arch-aziende';
    var el = document.getElementById(id); if (!el) return;
    var cerca = document.activeElement && el.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    var pos = cerca ? document.activeElement.selectionStart : null;
    el.innerHTML = sezione(tipo);
    if (cerca) { var inp = el.querySelector('.arc-tool input'); if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (e) {} } }
  }
  function renderTutto() { render('trasportatore'); render('azienda'); }
  function utente(id) { return TRASP.concat(AZIENDE).filter(function (u) { return u.id === id; })[0]; }

  /* =====================================================================
     AZIONI
     ===================================================================== */
  window.ectArcApri = function (id) {
    var u = utente(id); if (!u) return;
    aperti[id] = !aperti[id];
    if (aperti[id]) segnaVisto(u); else delete sessNuovi[id];
    render(u.tipo);
  };
  window.ectArcSez = function (k) { sezAperte[k] = !(sezAperte[k] || false); var u = utente(k.split(':')[0]); if (u) render(u.tipo); };
  window.ectArcCerca = function (tipo, v) { filtro[tipo] = v; render(tipo); };
  window.ectArcPeriodo = function (id, v) { periodo[id] = Number(v) || 0; var u = utente(id); if (u) render(u.tipo); };
  window.ectArcScegli = function (id) { var el = document.getElementById('arc-sel-' + id); if (el) el.style.display = el.style.display === 'flex' ? 'none' : 'flex'; };
  window.ectArcSpunta = function (id, k, v) { sceltaStampa[id][k] = v; };
  window.ectArcAzzera = function () { visti = {}; sessNuovi = {}; aperti = {}; salvaVisti(visti); renderTutto(); };

  window.ectArcDoc = function (id, i, stampa) {
    var u = utente(id); if (!u || !u.aut[i]) return;
    var d = u.aut[i], url = docEsempio(d.a, u.nome);
    var w = window.open('', '_blank'); if (!w) { alert('Il browser ha bloccato la finestra: consenti i pop-up per questo sito.'); return; }
    w.document.write('<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>' + esc(d.a + ' - ' + d.f) + '</title><style>body{margin:0;font-family:Arial,sans-serif;text-align:center;}h1{font-size:14px;margin:12px;}img{max-width:100%;}</style></head><body>' +
      '<h1>EcoTruckConnect - ' + esc(u.nome) + ' - ' + esc(d.a) + ' - caricato il ' + dataOra(d.q) + '</h1><img id="i" src="' + url + '">' +
      (stampa ? '<script>var i=document.getElementById("i");function p(){setTimeout(function(){window.print();},200);}if(i.complete)p();else i.onload=p;<\/script>' : '') + '</body></html>');
    w.document.close();
  };

  function finestraStampa(titolo, contenuto) {
    var w = window.open('', '_blank'); if (!w) { alert('Il browser ha bloccato la finestra: consenti i pop-up per questo sito.'); return; }
    var ora = new Date();
    w.document.write('<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>' + esc(titolo) + '</title><style>' +
      'body{font-family:Arial,sans-serif;color:#111;margin:24px;font-size:12px;} h1{font-size:18px;margin:0 0 4px;} .t{color:#555;margin-bottom:14px;} h2{font-size:14px;margin:16px 0 6px;border-bottom:1px solid #ccc;padding-bottom:4px;} ' +
      '.arc-li{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #eee;page-break-inside:avoid;} .arc-q{color:#555;white-space:nowrap;} button{display:none;} a{color:#111;text-decoration:none;} ' +
      '.arc-pill{border:1px solid #999;border-radius:10px;padding:1px 6px;font-size:10px;} .arc-line{display:flex;gap:4px;margin:6px 0;} .arc-line div{flex:1;border:1px solid #ccc;border-radius:6px;padding:4px;text-align:center;font-size:10px;} .arc-line div.qui{border-color:#c00;font-weight:bold;} .arc-new{background:#f3fff3;} .arc-new.s{background:#fff3f3;}' +
      '</style></head><body><h1>' + esc(titolo) + '</h1><div class="t">EcoTruckConnect — stampato il ' + dataOra(ora) + ' · Dashboard DEMO, dati di esempio</div>' + contenuto +
      '<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script></body></html>');
    w.document.close();
  }
  window.ectArcStampa = function (id, cosa) {
    var u = utente(id); if (!u) return;
    var sez = SEZIONI(u), gg = periodo[id] || 0;
    if (!sceltaStampa[id]) { sceltaStampa[id] = {}; sez.forEach(function (s) { sceltaStampa[id][s.k] = true; }); }
    var scelte = sez.filter(function (s) { return cosa === 'tutto' ? true : (cosa === 'scelta' ? sceltaStampa[id][s.k] : s.k === cosa); });
    if (!scelte.length) { alert('Scegli almeno una sezione da stampare.'); return; }
    var per = { 0: 'da sempre', 7: 'ultima settimana', 30: 'ultimo mese', 365: 'ultimo anno' }[gg] || 'da sempre';
    finestraStampa('Archivio — ' + u.nome, '<div class="t">' + (u.tipo === 'trasportatore' ? 'Trasportatore' : 'Azienda') + ' · ' + esc(u.email) + ' · periodo: ' + per + '</div>' +
      scelte.map(function (s) { return '<h2>' + s.t + '</h2>' + s.html(gg); }).join(''));
  };
  window.ectArcStampaElenco = function (tipo) {
    var lista = tipo === 'trasportatore' ? TRASP : AZIENDE;
    finestraStampa(tipo === 'trasportatore' ? 'Elenco trasportatori' : 'Elenco aziende', lista.map(function (u) {
      var s = statoScadenza(u);
      return '<div class="arc-li"><span><b>' + esc(u.nome) + '</b><br>' + sottotitolo(u) + '</span><span class="arc-q">' + (s ? esc(s.txt) : 'non ancora attivo') + '<br>iscritto il ' + dataOra(u.iscritto) + '</span></div>';
    }).join(''));
  };
  function scaricaCSV(nome, righe) {
    var csv = righe.map(function (r) { return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = nome + '-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }
  window.ectArcCSV = function (id) {
    var u = utente(id); if (!u) return;
    var r = [['Sezione', 'Data e ora', 'Descrizione']];
    (u.viaggi || []).forEach(function (v) { r.push(['Viaggio', dataOra(v.quando), v.numero + ' ' + v.da + ' → ' + v.a + ' · ' + v.controparte]); });
    (u.pubblicati || []).forEach(function (c) { r.push(['Carico pubblicato', dataOra(c.q), c.n + ' ' + c.da + ' → ' + c.a + ' · ' + c.stato + (c.da_chi ? ' · ' + c.da_chi : '')]); });
    u.pagamenti.forEach(function (p) { r.push([p.t, dataOra(p.q), p.n]); });
    u.promemoria.forEach(function (p) { r.push(['Promemoria', dataOra(p.q), p.t]); });
    u.cambi.forEach(function (c) { r.push(['Cambio dati', dataOra(c.q), c.campo + ': ' + c.prima + ' → ' + c.dopo]); });
    u.attivita.forEach(function (a) { r.push(['Attività', dataOra(a.q), a.t + ' — ' + a.d]); });
    u.interventi.forEach(function (x) { r.push(['Interventi e richieste', dataOra(x.q), x.t + ' — ' + x.d]); });
    scaricaCSV('archivio-' + u.nome.replace(/\W+/g, '-').toLowerCase(), r);
  };
  window.ectArcCSVElenco = function (tipo) {
    var lista = tipo === 'trasportatore' ? TRASP : AZIENDE;
    var r = [['Nome', 'Ragione sociale', 'Email', 'Telefono', 'P.IVA', 'Sede', 'Stato', 'Iscritto il', 'Scadenza']];
    lista.forEach(function (u) { r.push([u.nome, u.ragione, u.email, u.tel, u.piva, u.sede, u.stato, dataOra(u.iscritto), u.scadenza ? soloData(u.scadenza) : '']); });
    scaricaCSV(tipo === 'trasportatore' ? 'elenco-trasportatori' : 'elenco-aziende', r);
  };

  /* =====================================================================
     AVVIO
     ===================================================================== */
  function avvia() {
    var vecchie = ['registro-lista', 'anagrafica-lista'];
    vecchie.forEach(function (id) { var el = document.getElementById(id); if (el) { var sez = el.closest('.section'); if (sez) { sez.style.display = 'none'; var prev = sez.previousElementSibling; while (prev && !prev.classList.contains('sec-title')) { prev.style.display = 'none'; prev = prev.previousElementSibling; } if (prev) prev.style.display = 'none'; } } });
    var ancora = document.getElementById('arch-trasportatori');
    if (!ancora) {
      var reg = document.getElementById('registro-lista'); var dopo = reg ? reg.closest('.section') : null;
      if (!dopo) return;
      var html = '<div class="sec-title">🚚 Archivio storico trasportatori <span class="etichetta-nuovo">NUOVO</span></div><div id="arch-trasportatori"></div>' +
        '<div class="sec-title">🏢 Archivio storico aziende <span class="etichetta-nuovo">NUOVO</span></div><div id="arch-aziende"></div>';
      var titoloReg = dopo.previousElementSibling;
      (titoloReg || dopo).insertAdjacentHTML('beforebegin', html);
    }
    renderTutto();
    setInterval(function () { ORA = new Date(); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia); else avvia();
})();
