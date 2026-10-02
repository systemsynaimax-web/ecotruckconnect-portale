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
