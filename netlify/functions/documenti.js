// FUNZIONE SERVERLESS NETLIFY — documenti.js (3/10/2026)
//
// Documenti delle autorizzazioni dei trasportatori (un file per autorizzazione).
// Chiamata SOLO dal portale con l'utente gia' entrato
// (header Authorization: Bearer <token Netlify Identity>).
//
//   TRASPORTATORE
//   { azione: "elenco" }                                        -> { ok, documenti: [...] }
//   { azione: "carica", autorizzazione, nome_file, tipo, file } -> { ok, documenti: [...] }
//        file = contenuto in base64 (max 4 MB), tipo = pdf / jpg / png
//        se per quell'autorizzazione c'era gia' un file, viene sostituito
//   { azione: "allinea", autorizzazioni: [...] }                -> { ok, documenti: [...] }
//        toglie i file delle autorizzazioni che non ha piu' selezionato
//
//   TUTTI (trasportatore e azienda)
//   { azione: "movimenti" }                                    -> { ok, movimenti: [...] }
//        solo i movimenti dell'utente entrato (Registro Attivita')
//
//   { azione: "file_elenco" | "file_carica" (nome_file, tipo, file) | "file_rimuovi" (id) }
//        file facoltativi di "Modifica i miei dati" (campo documenti_miei_dati)
//
//   AZIENDA
//   { azione: "documenti_trasportatore", email_trasportatore }  -> { ok, documenti: [...] }
//        risponde SOLO se esiste un carico dell'azienda PRESO da quel trasportatore
//
// I file stanno su Airtable, tabella Trasportatori, campo "documenti_autorizzazioni".
// Il nome di ogni file inizia con l'autorizzazione: "[Conto Terzi] licenza.pdf".
// Serve la variabile d'ambiente AIRTABLE_TOKEN (token personale Airtable con
// permessi data.records:read e data.records:write sulla base EcoTruckConnect).

const BASE = 'app0TGG8f4ARpdlbl';
const T_TRASP = 'tblrn6u8TOshdviwo';
const T_CARICHI = 'tblZ7NoiUBJsi1ZSK';
const CAMPO_DOC = 'fldS8USio8K1dsvgn';
const MAX_BYTE = 4 * 1024 * 1024;
const TIPI = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

const TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLETOKEN || '';

function risposta(stato, dati) {
  return { statusCode: stato, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati) };
}

function testoFormula(v) { return String(v || '').toLowerCase().trim().replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

async function airtable(percorso, opzioni) {
  const r = await fetch('https://api.airtable.com/v0/' + BASE + '/' + percorso, Object.assign({}, opzioni || {}, {
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }
  }));
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('airtable_' + r.status + ' ' + JSON.stringify(d.error || d));
  return d;
}

async function trasportatorePerEmail(email) {
  const formula = "LOWER(TRIM({email}))='" + testoFormula(email) + "'";
  const d = await airtable(T_TRASP + '?maxRecords=1&returnFieldsByFieldId=true&filterByFormula=' + encodeURIComponent(formula));
  return (d.records && d.records[0]) || null;
}

function autDelFile(nome) {
  const m = String(nome || '').match(/^\[([^\]]+)\]\s*/);
  return m ? m[1] : '';
}

function elencoDocumenti(record) {
  const files = (record && record.fields && record.fields[CAMPO_DOC]) || [];
  return files.map(f => ({
    id: f.id,
    autorizzazione: autDelFile(f.filename),
    nome: String(f.filename || '').replace(/^\[[^\]]+\]\s*/, ''),
    url: f.url,
    tipo: f.type || '',
    dimensione: f.size || 0
  }));
}

async function tieniSolo(record, filtro) {
  const files = (record.fields[CAMPO_DOC] || []);
  const restano = files.filter(filtro);
  if (restano.length === files.length) return record;
  return await airtable(T_TRASP + '/' + record.id + '?returnFieldsByFieldId=true', {
    method: 'PATCH',
    body: JSON.stringify({ fields: { [CAMPO_DOC]: restano.map(f => ({ id: f.id })) }, returnFieldsByFieldId: true })
  });
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return risposta(405, { ok: false, errore: 'usa_post' });
  if (!TOKEN) return risposta(500, { ok: false, errore: 'token_airtable_mancante' });
  const chi = context.clientContext && context.clientContext.user;
  if (!chi || !chi.email) return risposta(401, { ok: false, errore: 'accesso_richiesto' });
  const email = String(chi.email).toLowerCase().trim();

  let corpo = {};
  try { corpo = JSON.parse(event.body || '{}'); } catch (e) { return risposta(400, { ok: false, errore: 'json_non_valido' }); }
  const azione = corpo.azione;

  try {
    /* ===================== STORICO MOVIMENTI (3/10/2026) =====================
       Restituisce SOLO i movimenti dell'utente entrato (riconosciuto dal token),
       presi dalla tabella Registro Attività. Vale per trasportatori e aziende. */
    if (azione === 'movimenti') {
      const T_AZ = 'tblVSe1R3ayWgNDy9', T_REG = 'tbleTTKVwdEEEOkaC';
      const fe = "LOWER(TRIM({email}))='" + testoFormula(email) + "'";
      const tr = await airtable(T_TRASP + '?maxRecords=1&filterByFormula=' + encodeURIComponent(fe));
      let rec = tr.records && tr.records[0];
      if (!rec) { const az = await airtable(T_AZ + '?maxRecords=1&filterByFormula=' + encodeURIComponent(fe)); rec = az.records && az.records[0]; }
      if (!rec) return risposta(200, { ok: false, errore: 'utente_non_trovato' });
      const f = rec.fields || {};
      const nomi = new Set([email]);
      [[f.nome, f.cognome].filter(Boolean).join(' '), f.ragione_sociale, f.nome].forEach(x => { if (x && String(x).trim()) nomi.add(String(x).toLowerCase().trim()); });
      const cond = Array.from(nomi).map(n => "LOWER(TRIM({autore_attivita}))='" + testoFormula(n) + "'").join(',');
      const q = T_REG + '?pageSize=100&sort%5B0%5D%5Bfield%5D=data_ora_attivita&sort%5B0%5D%5Bdirection%5D=desc&filterByFormula=' + encodeURIComponent('OR(' + cond + ')');
      const d = await airtable(q);
      const movimenti = (d.records || []).map(r => ({
        q: r.fields.data_ora_attivita || r.createdTime || null,
        titolo: r.fields.titolo_attivita || '',
        descrizione: r.fields.descrizione_attivita || '',
        tipo: (r.fields.tipo_attivita && r.fields.tipo_attivita.name) || r.fields.tipo_attivita || ''
      }));
      return risposta(200, { ok: true, movimenti: movimenti });
    }

    /* ============ FILE DI "MODIFICA I MIEI DATI" (3/10/2026) ============
       Trasportatori e aziende possono caricare file facoltativi (visura,
       patente, carta di circolazione...). Ognuno vede e tocca SOLO i suoi. */
    if (azione === 'file_elenco' || azione === 'file_carica' || azione === 'file_rimuovi') {
      const T_AZ = 'tblVSe1R3ayWgNDy9';
      const CAMPO = { [T_TRASP]: 'fldbD25oCKsQscf7q', [T_AZ]: 'fldEKEt8RWW5STutO' };
      const fe = "LOWER(TRIM({email}))='" + testoFormula(email) + "'";
      let tab = T_TRASP;
      let d = await airtable(T_TRASP + '?maxRecords=1&returnFieldsByFieldId=true&filterByFormula=' + encodeURIComponent(fe));
      let rec = d.records && d.records[0];
      if (!rec) { tab = T_AZ; d = await airtable(T_AZ + '?maxRecords=1&returnFieldsByFieldId=true&filterByFormula=' + encodeURIComponent(fe)); rec = d.records && d.records[0]; }
      if (!rec) return risposta(200, { ok: false, errore: 'utente_non_trovato' });
      const campo = CAMPO[tab];
      const elenca = r => ((r && r.fields && r.fields[campo]) || []).map(f => ({ id: f.id, nome: f.filename || 'file', url: f.url, tipo: f.type || '', dimensione: f.size || 0 }));
      if (azione === 'file_elenco') return risposta(200, { ok: true, file: elenca(rec) });
      if (azione === 'file_rimuovi') {
        const id = String(corpo.id || '');
        const files = rec.fields[campo] || [];
        const restano = files.filter(f => f.id !== id);
        if (restano.length === files.length) return risposta(200, { ok: false, errore: 'file_non_trovato' });
        const r2 = await airtable(tab + '/' + rec.id + '?returnFieldsByFieldId=true', { method: 'PATCH', body: JSON.stringify({ fields: { [campo]: restano.map(f => ({ id: f.id })) }, returnFieldsByFieldId: true }) });
        return risposta(200, { ok: true, file: elenca(r2) });
      }
      // file_carica
      const tipo = String(corpo.tipo || '');
      if (!TIPI[tipo]) return risposta(200, { ok: false, errore: 'tipo_non_ammesso' });
      const b64 = String(corpo.file || '').replace(/^data:[^,]*,/, '');
      const byte = Math.floor(b64.length * 3 / 4);
      if (!b64 || byte > MAX_BYTE) return risposta(200, { ok: false, errore: 'file_troppo_grande' });
      if ((rec.fields[campo] || []).length >= 20) return risposta(200, { ok: false, errore: 'troppi_file' });
      let nome = String(corpo.nome_file || 'documento').replace(/[\\/:*?"<>|\[\]]/g, '_').slice(0, 80);
      if (!/\.[a-z0-9]{2,4}$/i.test(nome)) nome += '.' + TIPI[tipo];
      const up = await fetch('https://content.airtable.com/v0/' + BASE + '/' + rec.id + '/' + campo + '/uploadAttachment', {
        method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: tipo, file: b64, filename: nome })
      });
      if (!up.ok) { console.error('upload file miei dati fallito', up.status, await up.text().catch(() => '')); return risposta(200, { ok: false, errore: 'caricamento_fallito' }); }
      const d2 = await airtable(tab + '/' + rec.id + '?returnFieldsByFieldId=true');
      return risposta(200, { ok: true, file: elenca(d2) });
    }

    /* ===================== AZIENDA ===================== */
    if (azione === 'documenti_trasportatore') {
      const et = String(corpo.email_trasportatore || '').toLowerCase().trim();
      if (!et) return risposta(200, { ok: false, errore: 'email_mancante' });
      const formula = "AND(LOWER(TRIM({email_azienda}))='" + testoFormula(email) + "',LOWER(TRIM({trasportatore_email}))='" + testoFormula(et) + "',UPPER({stato})='PRESO')";
      const c = await airtable(T_CARICHI + '?maxRecords=1&fields%5B%5D=stato&filterByFormula=' + encodeURIComponent(formula));
      if (!c.records || !c.records.length) return risposta(200, { ok: false, errore: 'non_autorizzato' });
      const t = await trasportatorePerEmail(et);
      return risposta(200, { ok: true, documenti: elencoDocumenti(t) });
    }

    /* ===================== TRASPORTATORE ===================== */
    let t = await trasportatorePerEmail(email);
    if (!t) return risposta(200, { ok: false, errore: 'trasportatore_non_trovato' });

    if (azione === 'elenco') {
      return risposta(200, { ok: true, documenti: elencoDocumenti(t) });
    }

    if (azione === 'allinea') {
      const tenere = new Set((Array.isArray(corpo.autorizzazioni) ? corpo.autorizzazioni : []).map(String));
      t = await tieniSolo(t, f => tenere.has(autDelFile(f.filename)));
      return risposta(200, { ok: true, documenti: elencoDocumenti(t) });
    }

    if (azione === 'carica') {
      const aut = String(corpo.autorizzazione || '').replace(/[\[\]]/g, '').trim();
      const permesse = (t.fields.fldCOhTR7rZc772IK || []).map(String);
      if (!aut) return risposta(200, { ok: false, errore: 'autorizzazione_mancante' });
      if (Array.isArray(corpo.autorizzazioni_selezionate)) corpo.autorizzazioni_selezionate.forEach(a => permesse.push(String(a)));
      if (!permesse.includes(aut)) return risposta(200, { ok: false, errore: 'autorizzazione_non_selezionata' });
      const tipo = String(corpo.tipo || '');
      if (!TIPI[tipo]) return risposta(200, { ok: false, errore: 'tipo_non_ammesso' });
      const b64 = String(corpo.file || '').replace(/^data:[^,]*,/, '');
      const byte = Math.floor(b64.length * 3 / 4);
      if (!b64 || byte > MAX_BYTE) return risposta(200, { ok: false, errore: 'file_troppo_grande' });
      let nome = String(corpo.nome_file || 'documento').replace(/[\\/:*?"<>|\[\]]/g, '_').slice(0, 80);
      if (!/\.[a-z0-9]{2,4}$/i.test(nome)) nome += '.' + TIPI[tipo];

      t = await tieniSolo(t, f => autDelFile(f.filename) !== aut);

      const r = await fetch('https://content.airtable.com/v0/' + BASE + '/' + t.id + '/' + CAMPO_DOC + '/uploadAttachment', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: tipo, file: b64, filename: '[' + aut + '] ' + nome })
      });
      if (!r.ok) {
        const err = await r.text().catch(() => '');
        console.error('upload fallito', r.status, err);
        return risposta(200, { ok: false, errore: 'caricamento_fallito' });
      }
      const nuovo = await trasportatorePerEmail(email);
      return risposta(200, { ok: true, documenti: elencoDocumenti(nuovo) });
    }

    return risposta(400, { ok: false, errore: 'azione_sconosciuta' });
  } catch (e) {
    console.error('documenti.js', e);
    return risposta(500, { ok: false, errore: 'errore_server' });
  }
};
