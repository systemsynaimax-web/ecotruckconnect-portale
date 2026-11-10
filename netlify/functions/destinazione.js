// FUNZIONE SERVERLESS NETLIFY — destinazione.js (8/10/2026)
//
// PRODUTTORE, IMPIANTO DI DESTINAZIONE E INTERMEDIARIO dei carichi di RIFIUTI (richiesta di Gerlando; produttore aggiunto il 10/11/2026).
// Facoltativo. L'azienda che ha ordinato il carico, alla pubblicazione E DOPO che il trasportatore lo ha
// accettato (stato PRESO), puo' scrivere i dati dell'impianto di destinazione e di un
// eventuale intermediario e allegare i file delle autorizzazioni.
// Il trasportatore che ha preso il carico li puo' SOLO vedere e scaricare.
// I gestori (dashboard) possono vedere, scaricare e stampare.
//
// Chiamata SOLO dal portale con l'utente gia' entrato
// (header Authorization: Bearer <token Netlify Identity>), come documenti.js.
// Tutti i controlli stanno QUI, sul server: nascondere un tasto nel portale non basta.
//
//   { azione: "dest_leggi",        numero_ordine }                          azienda / trasportatore / gestore
//   { azione: "dest_salva",        numero_ordine, produttore{}, impianto{}, intermediario{} }   SOLO azienda proprietaria
//   { azione: "dest_file_carica",  numero_ordine, parte, nome_file, tipo, file }  SOLO azienda proprietaria
//   { azione: "dest_file_rimuovi", numero_ordine, id }                            SOLO azienda proprietaria
//   { azione: "dest_file_apri",    numero_ordine, id }                      azienda / trasportatore / gestore
//        -> { ok, nome, tipo, file(base64) }  (il file passa dal server, l'indirizzo Airtable non esce mai)
//
// Campi usati sulla tabella Carichi (per NOME): produttore_ragione_sociale, produttore_codice_fiscale,
// produttore_indirizzo, produttore_n_autorizzazione (4 campi NUOVI, testo su una riga),
// impianto_ragione_sociale, impianto_indirizzo,
// impianto_n_autorizzazione, impianto_ente_rilascio, impianto_scadenza,
// intermediario_ragione_sociale, intermediario_n_autorizzazione, intermediario_ente_rilascio,
// intermediario_scadenza, destinazione_file_dati (ALLEGATO), destinazione_aggiornato_il (data e ora).
// I file hanno il nome che inizia con la parte: "[produttore] nome.pdf" / "[impianto] nome.pdf" / "[intermediario] nome.pdf".
// Se in Airtable i 4 campi del produttore non esistono ancora, impianto e intermediario si salvano lo stesso
// e la risposta porta produttore_non_salvato: true (il portale lo dice all'utente).
// Serve la variabile d'ambiente AIRTABLE_TOKEN (la stessa di documenti.js).

const BASE = 'app0TGG8f4ARpdlbl';
const T_CARICHI = 'tblZ7NoiUBJsi1ZSK';
const GESTORI = ['system.synaimax@gmail.com'];
const CAMPO_FILE = 'destinazione_file_dati';
const CAMPO_AGG = 'destinazione_aggiornato_il';
const MAX_BYTE = 4 * 1024 * 1024;
const MAX_FILE_PER_PARTE = 3;
const TIPI = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
const PARTI = ['produttore', 'impianto', 'intermediario'];
const CAMPI_PARTE = {
  produttore: ['ragione_sociale', 'codice_fiscale', 'indirizzo', 'n_autorizzazione'],
  impianto: ['ragione_sociale', 'indirizzo', 'n_autorizzazione', 'ente_rilascio', 'scadenza'],
  intermediario: ['ragione_sociale', 'n_autorizzazione', 'ente_rilascio', 'scadenza']
};

const TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLETOKEN || '';

function risposta(stato, dati) {
  return { statusCode: stato, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati) };
}
function testoFormula(v) { return String(v || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function minuscolo(v) { return String(v == null ? '' : v).toLowerCase().trim(); }
function pulisci(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max || 200); }
function dataValida(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? undefined : s;
}

async function airtable(percorso, opzioni) {
  const r = await fetch('https://api.airtable.com/v0/' + BASE + '/' + percorso, Object.assign({}, opzioni || {}, {
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }
  }));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('airtable_' + r.status + ' ' + JSON.stringify(d.error || d));
  return d;
}

function eRifiuto(f) {
  const v = f.tipo_rifiuto;
  const si = v === true || ['true', 'si', 'sì', 'yes', '1'].indexOf(minuscolo(Array.isArray(v) ? v[0] : v)) !== -1;
  return si || pulisci(f.codice_cer).length > 0;
}

function parteDelFile(nome) {
  const m = String(nome || '').match(/^\[([^\]]+)\]\s*/);
  return m && PARTI.indexOf(m[1]) !== -1 ? m[1] : '';
}

function elencoFile(f) {
  return ((f && f[CAMPO_FILE]) || []).map(a => ({
    id: a.id,
    parte: parteDelFile(a.filename),
    nome: String(a.filename || '').replace(/^\[[^\]]+\]\s*/, ''),
    tipo: a.type || '',
    dimensione: a.size || 0
  })).filter(x => x.parte);
}

function datiDelCarico(f) {
  const out = {};
  PARTI.forEach(p => {
    out[p] = {};
    CAMPI_PARTE[p].forEach(c => {
      out[p][c] = c === 'scadenza' ? String(f[p + '_scadenza'] || '').slice(0, 10) : String(f[p + '_' + c] || '');
    });
  });
  return out;
}

function pacchetto(rec, ruolo) {
  const f = rec.fields || {};
  return { ok: true, applicabile: true, ruolo: ruolo, numero_ordine: f.numero_ordine || '', dati: datiDelCarico(f), file: elencoFile(f), aggiornato_il: f[CAMPO_AGG] || '' };
}

async function caricoPerOrdine(numero) {
  const formula = "{numero_ordine}='" + testoFormula(numero) + "'";
  const d = await airtable(T_CARICHI + '?maxRecords=1&filterByFormula=' + encodeURIComponent(formula));
  return (d.records && d.records[0]) || null;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return risposta(405, { ok: false, errore: 'usa_post' });
  if (!TOKEN) return risposta(500, { ok: false, errore: 'token_airtable_mancante' });
  const chi = context.clientContext && context.clientContext.user;
  if (!chi || !chi.email) return risposta(401, { ok: false, errore: 'accesso_richiesto' });
  const email = minuscolo(chi.email);

  let corpo = {};
  try { corpo = JSON.parse(event.body || '{}'); } catch (e) { return risposta(400, { ok: false, errore: 'json_non_valido' }); }
  const azione = corpo.azione;
  const AZIONI = ['dest_leggi', 'dest_salva', 'dest_file_carica', 'dest_file_rimuovi', 'dest_file_apri'];
  if (AZIONI.indexOf(azione) === -1) return risposta(400, { ok: false, errore: 'azione_sconosciuta' });

  try {
    const numero = pulisci(corpo.numero_ordine, 60);
    if (!numero) return risposta(200, { ok: false, errore: 'carico_mancante' });
    let rec = await caricoPerOrdine(numero);
    if (!rec) return risposta(200, { ok: false, errore: 'non_autorizzato' });
    const f = rec.fields || {};

    // chi e' chi, deciso dal server
    let ruolo = '';
    if (GESTORI.indexOf(email) !== -1) ruolo = 'gestore';
    else if (minuscolo(f.email_azienda) === email) ruolo = 'azienda';
    else if (minuscolo(f.bloccato_da_id) === email || minuscolo(f.trasportatore_email) === email) ruolo = 'trasportatore';
    if (!ruolo) return risposta(200, { ok: false, errore: 'non_autorizzato' });

    // 10/10: vale per i carichi di RIFIUTI.
    //  - AZIENDA: puo' scrivere/allegare/modificare fin dalla pubblicazione (qualsiasi stato tranne annullato/scaduto) e dopo che il carico e' stato preso
    //  - TRASPORTATORE: vede e scarica SOLO dopo aver preso il carico (stato PRESO = ha gia' pagato i 20 euro)
    //  - GESTORE: vede/scarica sempre
    const statoCarico = String(f.stato || '').toUpperCase();
    let applicabile = eRifiuto(f);
    if (ruolo === 'trasportatore' && statoCarico !== 'PRESO') applicabile = false;
    if (ruolo === 'azienda' && (statoCarico.indexOf('ANNULLATO') === 0 || statoCarico === 'SCADUTO')) applicabile = false;
    if (!applicabile) {
      return risposta(200, { ok: true, applicabile: false, ruolo: ruolo });
    }
    // un trasportatore che non e' piu' quello del carico non vede niente (controllato sopra); i gestori solo leggono/aprono
    const soloAzienda = azione === 'dest_salva' || azione === 'dest_file_carica' || azione === 'dest_file_rimuovi';
    if (soloAzienda && ruolo !== 'azienda') return risposta(200, { ok: false, errore: 'solo_azienda' });

    if (azione === 'dest_leggi') return risposta(200, pacchetto(rec, ruolo));

    if (azione === 'dest_salva') {
      const campi = {};
      const per = { produttore: corpo.produttore || {}, impianto: corpo.impianto || {}, intermediario: corpo.intermediario || {} };
      for (const p of PARTI) {
        // un portale non ancora aggiornato non manda il produttore: in quel caso non lo tocco (non cancello i suoi dati)
        if (p === 'produttore' && !corpo.produttore) continue;
        for (const c of CAMPI_PARTE[p]) {
          if (c === 'scadenza') {
            const sc = dataValida(per[p].scadenza);
            if (sc === undefined) return risposta(200, { ok: false, errore: 'data_non_valida', parte: p });
            campi[p + '_scadenza'] = sc; // null svuota la data
          } else if (c === 'codice_fiscale') {
            campi[p + '_' + c] = pulisci(per[p][c], 20).toUpperCase();
          } else {
            campi[p + '_' + c] = pulisci(per[p][c], c === 'indirizzo' ? 250 : 200);
          }
        }
      }
      campi[CAMPO_AGG] = new Date().toISOString();
      let nuovo, produttoreNonSalvato = false;
      try {
        nuovo = await airtable(T_CARICHI + '/' + rec.id, { method: 'PATCH', body: JSON.stringify({ fields: campi, typecast: true }) });
      } catch (e) {
        // i campi del produttore non esistono ancora in Airtable: salvo comunque il resto
        if (/UNKNOWN_FIELD_NAME|UNKNOWN_FIELD/.test(String(e && e.message)) && Object.keys(campi).some(k => k.indexOf('produttore_') === 0)) {
          const senza = {};
          Object.keys(campi).forEach(k => { if (k.indexOf('produttore_') !== 0) senza[k] = campi[k]; });
          nuovo = await airtable(T_CARICHI + '/' + rec.id, { method: 'PATCH', body: JSON.stringify({ fields: senza, typecast: true }) });
          produttoreNonSalvato = true;
        } else throw e;
      }
      return risposta(200, Object.assign(pacchetto(nuovo, ruolo), produttoreNonSalvato ? { produttore_non_salvato: true } : {}));
    }

    if (azione === 'dest_file_carica') {
      const parte = String(corpo.parte || '');
      if (PARTI.indexOf(parte) === -1) return risposta(200, { ok: false, errore: 'parte_non_valida' });
      const tipo = String(corpo.tipo || '');
      if (!TIPI[tipo]) return risposta(200, { ok: false, errore: 'tipo_non_ammesso' });
      const b64 = String(corpo.file || '').replace(/^data:[^,]*,/, '');
      const byte = Math.floor(b64.length * 3 / 4);
      if (!b64 || byte > MAX_BYTE) return risposta(200, { ok: false, errore: 'file_troppo_grande' });
      if (elencoFile(f).filter(x => x.parte === parte).length >= MAX_FILE_PER_PARTE) return risposta(200, { ok: false, errore: 'troppi_file' });
      let nome = String(corpo.nome_file || 'documento').replace(/[\\/:*?"<>|\[\]]/g, '_').slice(0, 80);
      if (!/\.[a-z0-9]{2,4}$/i.test(nome)) nome += '.' + TIPI[tipo];
      const up = await fetch('https://content.airtable.com/v0/' + BASE + '/' + rec.id + '/' + encodeURIComponent(CAMPO_FILE) + '/uploadAttachment', {
        method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: tipo, file: b64, filename: '[' + parte + '] ' + nome })
      });
      if (!up.ok) { console.error('destinazione upload fallito', up.status, await up.text().catch(() => '')); return risposta(200, { ok: false, errore: 'caricamento_fallito' }); }
      const nuovo = await airtable(T_CARICHI + '/' + rec.id, { method: 'PATCH', body: JSON.stringify({ fields: { [CAMPO_AGG]: new Date().toISOString() }, typecast: true }) });
      return risposta(200, pacchetto(nuovo, ruolo));
    }

    if (azione === 'dest_file_rimuovi') {
      const id = String(corpo.id || '');
      const tutti = f[CAMPO_FILE] || [];
      const bersaglio = tutti.find(a => a.id === id && parteDelFile(a.filename));
      if (!bersaglio) return risposta(200, { ok: false, errore: 'file_non_trovato' });
      const restano = tutti.filter(a => a.id !== id).map(a => ({ id: a.id }));
      const nuovo = await airtable(T_CARICHI + '/' + rec.id, { method: 'PATCH', body: JSON.stringify({ fields: { [CAMPO_FILE]: restano, [CAMPO_AGG]: new Date().toISOString() }, typecast: true }) });
      return risposta(200, Object.assign(pacchetto(nuovo, ruolo), { rimosso: String(bersaglio.filename || '').replace(/^\[[^\]]+\]\s*/, '') }));
    }

    if (azione === 'dest_file_apri') {
      const id = String(corpo.id || '');
      const a = (f[CAMPO_FILE] || []).find(x => x.id === id && parteDelFile(x.filename));
      if (!a || !a.url) return risposta(200, { ok: false, errore: 'file_non_trovato' });
      if ((a.size || 0) > MAX_BYTE + 1024) return risposta(200, { ok: false, errore: 'file_troppo_grande' });
      const r = await fetch(a.url);
      if (!r.ok) return risposta(200, { ok: false, errore: 'file_non_raggiungibile' });
      const buf = Buffer.from(await r.arrayBuffer());
      return risposta(200, { ok: true, nome: String(a.filename || '').replace(/^\[[^\]]+\]\s*/, ''), tipo: a.type || r.headers.get('content-type') || 'application/octet-stream', file: buf.toString('base64') });
    }

    return risposta(400, { ok: false, errore: 'azione_sconosciuta' });
  } catch (e) {
    console.error('destinazione.js', e);
    return risposta(500, { ok: false, errore: 'errore_server' });
  }
};
