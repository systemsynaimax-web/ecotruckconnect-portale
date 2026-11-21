/* EcoTruckConnect — Report PDF dei pagamenti (azienda) / incassi (trasportatore).
   Due versioni, stesso stile:
   - modo 'singolo'  : report di UN trasportatore (azienda) o di UNA azienda (trasportatore), con dettaglio e totale.
   - modo 'generale' : riepilogo di tutti, una riga per persona + dettaglio dei trasporti.
   Funziona solo con i dati gia' caricati nel portale: nessuna chiamata a Make o Airtable (0 crediti).
   Richiede jsPDF 2.5.1 + jsPDF-AutoTable 3.8.2 (gia' caricati da index.html). */
(function () {
  const NAVY = [14, 22, 35], BLUE = [59, 130, 246], GREEN = [22, 163, 74], AMBER = [217, 119, 6],
    MUTED = [100, 110, 125], LIGHT = [243, 246, 250], LINE = [221, 226, 234], INK = [30, 36, 48];

  function eur(n) {
    return (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/ /g, ' ') + ' €';
  }
  function dataIt(d) { return d instanceof Date && !isNaN(d) ? d.toLocaleDateString('it-IT') : '-'; }
  function pulisci(s) { return String(s == null ? '' : s).replace(/→/g, '-').replace(/[^\x20-\x7e -ÿ€–—’‘“”]/g, ''); }

  /* o = { az:boolean, modo:'singolo'|'generale', periodo:'dal 01/11/2026 al 20/11/2026', filtro:'Tutti'|'Da pagare'|'Gia pagati',
           io:{nome,indirizzo,piva,tel,email}, loro:{nome,indirizzo,piva,tel,email,referente} (solo singolo),
           righe:[{data:Date, ordine, da, a, km, merce, termini, importo:Number, pagato:Boolean, nome, piva}], nomeFile } */
  window.ectReportPdf = function (o) {
    const J = window.jspdf.jsPDF;
    const doc = new J({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, M = 14;
    const az = !!o.az;
    const singolo = o.modo === 'singolo';
    const righe = (o.righe || []).slice().sort((a, b) => (a.data || 0) - (b.data || 0));
    const tot = righe.reduce((t, r) => t + r.importo, 0);
    const fatto = righe.filter(r => r.pagato).reduce((t, r) => t + r.importo, 0);
    const resta = tot - fatto;
    const parola = n => az ? (n === 1 ? 'trasporto' : 'trasporti') : (n === 1 ? 'carico' : 'carichi');
    const lblPagato = az ? 'Pagato' : 'Incassato';
    const lblDaPagare = az ? 'Da pagare' : 'Da incassare';
    const generato = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    /* ---------- intestazione ---------- */
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 26, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
    doc.text('EcoTruck', M, 16.5);
    const wEco = doc.getTextWidth('EcoTruck');
    doc.setTextColor(...BLUE); doc.text('Connect', M + wEco, 16.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(190, 200, 215);
    doc.text(az ? 'REPORT PAGAMENTI' : 'REPORT INCASSI', W - M, 12.5, { align: 'right' });
    doc.text('Generato il ' + generato, W - M, 18, { align: 'right' });

    /* ---------- titolo e dati del trasportatore (solo nell'intestazione, niente riquadri) ---------- */
    let y = 38;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...NAVY);
    const titolo = singolo
      ? (az ? 'Report trasportatore' : 'Report azienda')
      : (az ? 'Report generale dei pagamenti' : 'Report generale degli incassi');
    doc.text(titolo, M, y);
    y += 8;
    if (singolo && o.loro) {
      const d = o.loro;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...BLUE);
      doc.text(pulisci(d.nome || ''), M, y);
      y += 5.8;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      const riga1 = [d.referente ? 'Referente: ' + d.referente : '', d.piva ? 'P.IVA ' + d.piva : '', d.indirizzo || ''].filter(Boolean).join('   |   ');
      const riga2 = [d.tel ? 'Tel. ' + d.tel : '', d.email || ''].filter(Boolean).join('   |   ');
      [riga1, riga2].forEach(t => { if (t) { doc.text(doc.splitTextToSize(pulisci(t), W - 2 * M)[0], M, y); y += 4.8; } });
      y += 1;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED);
    const per0 = pulisci(o.periodo || '').replace(/^da sempre,?\s*/i, '').trim();
    let sotto = per0 ? 'Periodo: ' + per0 : '';
    if (!singolo) { const nPers = new Set(righe.map(r => r.nome)).size; sotto += (sotto ? '   |   ' : '') + nPers + (az ? (nPers === 1 ? ' trasportatore' : ' trasportatori') : (nPers === 1 ? ' azienda' : ' aziende')); }
    if (o.filtro && o.filtro !== 'Tutti') sotto += (sotto ? '   |   ' : '') + 'Solo: ' + pulisci(o.filtro);
    doc.text(sotto, M, y);
    y += 8;

    /* ---------- riquadri riassuntivi ---------- */
    const gap = 4, cw = (W - 2 * M - 3 * gap) / 4;
    const carte = [
      { v: String(righe.length), t: parola(righe.length) + ' nel periodo', col: NAVY },
      { v: eur(tot), t: az ? 'totale concordato' : 'totale da fatturare', col: NAVY },
      { v: eur(fatto), t: az ? 'già pagato' : 'già incassato', col: GREEN },
      { v: eur(resta), t: az ? 'ancora da pagare' : 'ancora da incassare', col: resta > 0 ? AMBER : GREEN, evidenzia: true }
    ];
    carte.forEach((c, i) => {
      const x = M + i * (cw + gap);
      doc.setFillColor(...(c.evidenzia && resta > 0 ? [255, 247, 232] : LIGHT));
      doc.setDrawColor(...(c.evidenzia && resta > 0 ? AMBER : LINE)); doc.setLineWidth(c.evidenzia && resta > 0 ? 0.5 : 0.2);
      doc.roundedRect(x, y, cw, 20, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(c.v.length > 11 ? 11.5 : 14); doc.setTextColor(...c.col);
      doc.text(c.v, x + 4, y + 9.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text(c.t, x + 4, y + 15.5);
    });
    y += 27;

    /* ---------- tabelle ---------- */
    const stile = {
      theme: 'plain',
      margin: { top: 22, left: M, right: M, bottom: 20 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 }, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8, lineWidth: 0 },
      alternateRowStyles: { fillColor: [250, 251, 253] },
      footStyles: { fillColor: LIGHT, textColor: NAVY, fontStyle: 'bold', fontSize: 9, lineWidth: { top: 0.5 }, lineColor: NAVY }
    };
    function etichettaSezione(testo) {
      if (y > H - 50) { doc.addPage(); y = 26; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...NAVY);
      doc.text(testo, M, y); y += 3;
    }
    function coloraStato(colIdx) {
      return function (d) {
        if (d.section === 'body' && d.column.index === colIdx) {
          const v = String(d.cell.raw);
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.textColor = v === lblPagato ? GREEN : AMBER;
        }
      };
    }

    if (!righe.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(...MUTED);
      doc.text('Nessun ' + parola(1) + ' in questo periodo.', M, y + 6);
    } else if (singolo) {
      etichettaSezione('Dettaglio dei ' + parola(2));
      doc.autoTable(Object.assign({}, stile, {
        startY: y,
        head: [['Data', 'Tratta', 'Merce', 'Termini', 'Importo', 'Stato']],
        body: righe.map(r => [dataIt(r.data), pulisci(r.da) + ' - ' + pulisci(r.a) + (r.km ? ', ' + r.km + ' km' : ''), pulisci(r.merce), pulisci(r.termini), eur(r.importo), r.pagato ? lblPagato : lblDaPagare]),
        foot: [[{ content: 'Totale ' + righe.length + ' ' + parola(righe.length), colSpan: 4 }, { content: eur(tot), styles: { halign: 'right' } }, '']],
        columnStyles: { 0: { cellWidth: 22 }, 4: { halign: 'right', cellWidth: 26, fontStyle: 'bold' }, 5: { cellWidth: 26 } },
        didParseCell: function (d) { if (d.section === 'head' && d.column.index === 4) d.cell.styles.halign = 'right'; coloraStato(5)(d); },
        showFoot: 'lastPage'
      }));
      y = doc.lastAutoTable.finalY + 8;
    } else {
      // riepilogo per persona
      const per = {};
      righe.forEach(r => { const p = per[r.nome] = per[r.nome] || { nome: r.nome, piva: r.piva, n: 0, tot: 0, fatto: 0 }; p.n++; p.tot += r.importo; if (r.pagato) p.fatto += r.importo; if (!p.piva && r.piva) p.piva = r.piva; });
      const elenco = Object.keys(per).map(k => per[k]).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it'));
      etichettaSezione(az ? 'Quanto dare a ciascun trasportatore' : 'Quanto incassare da ciascuna azienda');
      doc.autoTable(Object.assign({}, stile, {
        startY: y,
        head: [[az ? 'Trasportatore' : 'Azienda', 'P.IVA', 'N.', 'Totale', az ? 'Già pagato' : 'Già incassato', lblDaPagare]],
        body: elenco.map(p => [pulisci(p.nome), pulisci(p.piva || '-'), String(p.n), eur(p.tot), eur(p.fatto), eur(p.tot - p.fatto)]),
        foot: [[{ content: 'Totale', colSpan: 2 }, String(righe.length), eur(tot), eur(fatto), eur(resta)]],
        columnStyles: { 0: { cellWidth: 56, fontStyle: 'bold' }, 1: { cellWidth: 30 }, 2: { halign: 'center', cellWidth: 10 }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
        didParseCell: function (d) {
          if ((d.section === 'head') && d.column.index >= 3) d.cell.styles.halign = 'right';
          if (d.section === 'head' && d.column.index === 2) d.cell.styles.halign = 'center';
          if (d.section === 'foot') { if (d.column.index === 2) d.cell.styles.halign = 'center'; if (d.column.index >= 3) d.cell.styles.halign = 'right'; }
          if (d.section === 'body' && d.column.index === 5) d.cell.styles.textColor = (Number(String(d.cell.raw).replace(/[^\d,-]/g, '').replace(',', '.')) > 0) ? AMBER : GREEN;
        },
        showFoot: 'lastPage'
      }));
      y = doc.lastAutoTable.finalY + 10;
      // dettaglio: persona per persona (non mischiato per data)
      etichettaSezione('Dettaglio dei ' + parola(2) + (az ? ' per trasportatore' : ' per azienda'));
      elenco.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'it')).forEach(p => {
        const mie = righe.filter(r => r.nome === p.nome);
        const stimaAltezza = 9 + 9 + mie.length * 8.5 + 10; // intestazione + titoli + righe + totale
        if (y > H - 55 || (y + stimaAltezza > H - 20 && stimaAltezza < H - 60)) { doc.addPage(); y = 26; }
        doc.setFillColor(...NAVY); doc.roundedRect(M, y, W - 2 * M, 9, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255);
        doc.text(pulisci(p.nome) + (p.piva ? '   -   P.IVA ' + pulisci(p.piva) : ''), M + 4, y + 6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(210, 220, 235);
        doc.text(p.n + ' ' + parola(p.n) + '   |   totale ' + eur(p.tot) + '   |   ' + lblDaPagare.toLowerCase() + ' ' + eur(p.tot - p.fatto), W - M - 4, y + 6, { align: 'right' });
        doc.autoTable(Object.assign({}, stile, {
          startY: y + 9,
          head: [['Data', 'Tratta', 'Merce', 'Importo', 'Stato']],
          body: mie.map(r => [dataIt(r.data), pulisci(r.da) + ' - ' + pulisci(r.a) + (r.km ? ', ' + r.km + ' km' : ''), pulisci(r.merce), eur(r.importo), r.pagato ? lblPagato : lblDaPagare]),
          foot: [[{ content: 'Totale ' + pulisci(p.nome) + ': ' + p.n + ' ' + parola(p.n), colSpan: 3 }, { content: eur(p.tot), styles: { halign: 'right' } }, '']],
          headStyles: Object.assign({}, stile.headStyles, { fillColor: [60, 72, 92] }),
          columnStyles: { 0: { cellWidth: 22 }, 3: { halign: 'right', cellWidth: 26, fontStyle: 'bold' }, 4: { cellWidth: 26 } },
          didParseCell: function (d) { if (d.section === 'head' && d.column.index === 3) d.cell.styles.halign = 'right'; coloraStato(4)(d); },
          showFoot: 'lastPage'
        }));
        y = doc.lastAutoTable.finalY + 9;
      });
    }

    /* ---------- riquadro finale col totale ---------- */
    if (righe.length) {
      if (y > H - 37) { doc.addPage(); y = 26; }
      doc.setFillColor(...NAVY); doc.roundedRect(M, y, W - 2 * M, 15, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(190, 200, 215);
      const chi = singolo ? pulisci((o.loro && o.loro.nome) || '') : '';
      doc.text(az ? (singolo ? 'Da pagare a ' + chi : 'Da pagare in totale') : (singolo ? 'Da incassare da ' + chi : 'Da incassare in totale'), M + 6, y + 9.4);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); if (resta > 0.005) doc.setTextColor(255, 80, 80); else doc.setTextColor(255, 255, 255);
      doc.text(eur(resta), W - M - 6, y + 10, { align: 'right' });
      y += 20;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text('Importi concordati con l\'azienda alla pubblicazione, oltre IVA nei termini di legge. Non è una fattura fiscale.', M, y);
    }

    /* ---------- intestazione corta e piè di pagina su ogni pagina ---------- */
    const np = doc.getNumberOfPages();
    for (let i = 1; i <= np; i++) {
      doc.setPage(i);
      if (i > 1) {
        doc.setFillColor(...NAVY); doc.rect(0, 0, W, 12, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
        doc.text('EcoTruck', M, 8); const w = doc.getTextWidth('EcoTruck'); doc.setTextColor(...BLUE); doc.text('Connect', M + w, 8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(190, 200, 215);
        doc.text(pulisci(titolo + (singolo && o.loro ? ' - ' + o.loro.nome : '') + ' - ' + (o.periodo || '')), W - M, 8, { align: 'right' });
      }
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text('EcoTruckConnect - riepilogo non fiscale', M, H - 9);
      doc.text('Pagina ' + i + ' di ' + np, W - M, H - 9, { align: 'right' });
    }
    if (o.salva !== false) doc.save(o.nomeFile || ('report-' + new Date().toISOString().slice(0, 10) + '.pdf'));
    return doc;
  };
})();

/* =====================================================================
   DOCUMENTO PDF GENERICO (21/11/2026) — stesso stile dei report di Gerlando:
   fascia scura con il logo EcoTruckConnect, titolo, tabelle pulite, piè di pagina.
   Lo usano TUTTI gli altri PDF del portale (iscrizione 150 euro, 20 euro a carico, rinunce,
   annullamenti, riepiloghi, anagrafiche...), cosi' escono tutti con la stessa grafica.
   o = { titolo, sottotitolo, etichetta:'DOCUMENTO', blocchi:[
           {t:'h', txt}                        sezione
           {t:'p', txt}                        paragrafo
           {t:'kv', righe:[[etichetta, valore]]}   dati (es. Stato / Attiva)
           {t:'tab', head:[...], body:[[...]], destra:[indici colonne a destra]} tabella
           {t:'totale', etichetta, valore}     riquadro scuro col totale
         ], nota, nomeFile, salva:false per non scaricare } */
(function () {
  const NAVY = [14, 22, 35], BLUE = [59, 130, 246], MUTED = [100, 110, 125], LIGHT = [243, 246, 250], LINE = [221, 226, 234], INK = [30, 36, 48];
  function pulisci(s) { return String(s == null ? '' : s).replace(/→/g, '-').replace(/[–—]/g, '-').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e -ÿ€]/g, '').replace(/\s+/g, ' ').trim(); }
  window.ectPdfPulisci = pulisci;
  window.ectDocumentoPdf = function (o) {
    const J = window.jspdf.jsPDF;
    const doc = new J({ unit: 'mm', format: 'a4' });
    const W = 210, H = 297, M = 14;
    const generato = new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 26, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(255, 255, 255);
    doc.text('EcoTruck', M, 16.5); const wEco = doc.getTextWidth('EcoTruck');
    doc.setTextColor(...BLUE); doc.text('Connect', M + wEco, 16.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(190, 200, 215);
    doc.text(pulisci(o.etichetta || 'DOCUMENTO').toUpperCase(), W - M, 12.5, { align: 'right' });
    doc.text('Generato il ' + generato, W - M, 18, { align: 'right' });
    let y = 38;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...NAVY);
    doc.splitTextToSize(pulisci(o.titolo || 'Documento'), W - 2 * M).forEach(r => { doc.text(r, M, y); y += 8; });
    if (o.sottotitolo) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED); doc.splitTextToSize(pulisci(o.sottotitolo), W - 2 * M).forEach(r => { doc.text(r, M, y); y += 5; }); }
    y += 5;
    const nuova = h => { if (y + h > H - 20) { doc.addPage(); y = 26; } };
    const stile = {
      theme: 'plain', margin: { top: 22, left: M, right: M, bottom: 20 },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: { top: 2.6, bottom: 2.6, left: 2.5, right: 2.5 }, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 }, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8, lineWidth: 0 },
      alternateRowStyles: { fillColor: [250, 251, 253] }
    };
    (o.blocchi || []).forEach(b => {
      if (b.t === 'h') {
        nuova(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...NAVY);
        doc.text(pulisci(b.txt), M, y); y += 2; doc.setDrawColor(...BLUE); doc.setLineWidth(0.5); doc.line(M, y, M + 14, y); y += 6;
      } else if (b.t === 'p') {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
        doc.splitTextToSize(pulisci(b.txt), W - 2 * M).forEach(r => { nuova(6); doc.text(r, M, y); y += 5; });
        y += 2;
      } else if (b.t === 'kv') {
        const righe = (b.righe || []).filter(r => pulisci(r[0]) || pulisci(r[1]));
        if (!righe.length) return;
        nuova(14);
        doc.autoTable(Object.assign({}, stile, { startY: y, body: righe.map(r => [pulisci(r[0]), pulisci(r[1])]), theme: 'plain',
          columnStyles: { 0: { cellWidth: 55, textColor: MUTED, fontSize: 8.5 }, 1: { fontStyle: 'bold', fontSize: 10, textColor: NAVY } },
          alternateRowStyles: { fillColor: LIGHT }, styles: Object.assign({}, stile.styles, { cellPadding: { top: 3, bottom: 3, left: 4, right: 4 } }) }));
        y = doc.lastAutoTable.finalY + 8;
      } else if (b.t === 'tab') {
        if (!(b.body || []).length) return;
        nuova(20);
        const dx = b.destra || [], cs = {}; dx.forEach(i => { cs[i] = { halign: 'right' }; });
        doc.autoTable(Object.assign({}, stile, { startY: y, head: [(b.head || []).map(pulisci)], body: b.body.map(r => r.map(pulisci)), columnStyles: cs,
          didParseCell: function (d) { if (d.section === 'head' && dx.indexOf(d.column.index) !== -1) d.cell.styles.halign = 'right'; } }));
        y = doc.lastAutoTable.finalY + 8;
      } else if (b.t === 'totale') {
        nuova(20); doc.setFillColor(...NAVY); doc.roundedRect(M, y, W - 2 * M, 15, 2.5, 2.5, 'F');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(190, 200, 215); doc.text(pulisci(b.etichetta), M + 6, y + 9.4);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255, 255, 255); doc.text(pulisci(b.valore), W - M - 6, y + 10, { align: 'right' });
        y += 20;
      }
    });
    if (o.nota) { nuova(10); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED); doc.splitTextToSize(pulisci(o.nota), W - 2 * M).forEach(r => { doc.text(r, M, y); y += 4; }); }
    const np = doc.getNumberOfPages();
    for (let i = 1; i <= np; i++) {
      doc.setPage(i);
      if (i > 1) {
        doc.setFillColor(...NAVY); doc.rect(0, 0, W, 12, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255);
        doc.text('EcoTruck', M, 8); const w = doc.getTextWidth('EcoTruck'); doc.setTextColor(...BLUE); doc.text('Connect', M + w, 8);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(190, 200, 215);
        doc.text(pulisci(o.titolo || ''), W - M, 8, { align: 'right' });
      }
      doc.setDrawColor(...LINE); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text('EcoTruckConnect - SynAIMAX S.R.L.S. - riepilogo non fiscale', M, H - 9);
      doc.text('Pagina ' + i + ' di ' + np, W - M, H - 9, { align: 'right' });
    }
    if (o.salva !== false) doc.save(o.nomeFile || ('documento-' + new Date().toISOString().slice(0, 10) + '.pdf'));
    return doc;
  };
})();

/* =====================================================================
   HTML -> PDF (21/11/2026): "Stampa" diventa "Scarica PDF".
   Le funzioni che prima aprivano la finestra di stampa ora passano l'html a questa funzione,
   che lo trasforma in un PDF con la grafica EcoTruckConnect (stessa dei report) e lo scarica subito.
   ectHtmlInPdf(titolo, html, { etichetta, sottotitolo, nomeFile, nota }) */
(function () {
  window.ectHtmlInPdf = function (titolo, html, opz) {
    opz = opz || {};
    if (!(window.ectDocumentoPdf && window.jspdf)) { alert("Il generatore di PDF non e' ancora caricato: aggiorna la pagina e riprova."); return; }
    const P = window.ectPdfPulisci;
    const dom = new DOMParser().parseFromString(String(html || ''), 'text/html');
    dom.querySelectorAll('style,script,button,input,select,textarea,.ect-stampa-bar,.barra').forEach(x => x.remove());
    const primoH1 = dom.querySelector('h1'); if (primoH1) primoH1.remove();
    const blocchi = []; let kv = [];
    const testo = n => (n.textContent || '').replace(/\s+/g, ' ').trim();
    const chiudiKv = () => { if (kv.length) { blocchi.push({ t: 'kv', righe: kv }); kv = []; } };
    function visita(n) {
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'TABLE') {
        const righe = Array.from(n.querySelectorAll('tr')).map(tr => Array.from(tr.children).map(testo)).filter(r => r.some(Boolean));
        if (!righe.length) return;
        const haHead = !!n.querySelector('thead') || !!n.querySelector('tr th');
        if (!haHead && righe.every(r => r.length === 2)) { righe.forEach(r => kv.push(r)); chiudiKv(); return; }
        chiudiKv();
        blocchi.push({ t: 'tab', head: haHead ? righe[0] : righe[0].map(() => ''), body: haHead ? righe.slice(1) : righe });
        return;
      }
      if (/^H[1-6]$/.test(tag) || n.classList.contains('t')) { chiudiKv(); if (P(testo(n))) blocchi.push({ t: 'h', txt: testo(n) }); return; }
      const fig = Array.from(n.children);
      if (fig.length === 2 && !fig[0].children.length && !fig[1].children.length && testo(fig[0]) && testo(fig[1]) && testo(fig[0]).length < 60 && testo(fig[1]).length < 140 && /^(SMALL|LABEL|SPAN|DIV|B|STRONG)$/.test(fig[0].tagName)) { kv.push([testo(fig[0]), testo(fig[1])]); return; }
      if (n.querySelector('table,h1,h2,h3,h4,h5,h6') && fig.length) { fig.forEach(visita); return; }
      if (!P(testo(n))) return;
      if (fig.some(c => /^(DIV|P|UL|OL|SECTION)$/.test(c.tagName))) { fig.forEach(visita); return; }
      chiudiKv(); blocchi.push({ t: 'p', txt: testo(n) });
    }
    Array.from(dom.body.children).forEach(visita); chiudiKv();
    if (!blocchi.length) blocchi.push({ t: 'p', txt: 'Nessun dato da riportare.' });
    const slug = String(titolo || 'documento').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return window.ectDocumentoPdf({ titolo: titolo, etichetta: opz.etichetta || 'DOCUMENTO', sottotitolo: opz.sottotitolo || '', blocchi: blocchi,
      nota: opz.nota || "Documento di riepilogo EcoTruckConnect - SynAIMAX S.R.L.S. Non e' una fattura fiscale.",
      nomeFile: opz.nomeFile || (slug + '-' + new Date().toISOString().slice(0, 10) + '.pdf') });
  };
})();

/* Finestra "finta" per le vecchie funzioni di stampa: raccoglie l'html e, a document.close(), scarica il PDF.
   Uso:  var w = window.ectFinestraPdf('Titolo', 'ETICHETTA');  w.document.write(html);  w.document.close(); */
window.ectFinestraPdf = function (titolo, etichetta) {
  var html = '';
  return { document: { write: function (h) { html += h; }, open: function () {}, close: function () { window.ectHtmlInPdf(titolo, html, { etichetta: etichetta || 'DOCUMENTO' }); } }, focus: function () {}, print: function () {}, close: function () {} };
};
