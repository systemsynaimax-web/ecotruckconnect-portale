// FUNZIONE SERVERLESS NETLIFY — letture.js (19/11/2026)
//
// LETTURE DEL PORTALE SENZA PASSARE DA MAKE (zero crediti Make).
// Prima ogni "Aggiorna" faceva partire scenari Make: la lettura dei carichi costava
// 6 crediti + 1 per ogni carico in lista. Ora le stesse letture le fa questa funzione,
// direttamente su Airtable, e risponde con la STESSA forma di dati che mandava Make.
//
// Chiamata SOLO dal portale con l'utente gia' entrato
// (header Authorization: Bearer <token Netlify Identity>) — come documenti.js.
//
//   { azione: "carichi_disponibili" }              -> { ok, dati: { carichi: [...] } }
//   { azione: "get_utente" }                       -> { ok, dati: { azienda: [...], trasportatore: [...] } }
//   { azione: "get_carichi_pubblicati_azienda" }   -> { ok, dati: { carichi: [...] } }
//   { azione: "get_candidature_trasportatore" }    -> { ok, dati: { candidature: [...] } }
//   { azione: "conta_trasportatori_compatibili" }  -> { ok, dati: { trasportatori: [...] } }
//   SOLO GESTORI:
//   { azione: "get_dashboard_data" }               -> { ok, dati: { carichi: [...] } }   (fino a 1000 carichi)
//   { azione: "get_scadenze" }                     -> { ok, dati: { scadenze: [...] } }
//
// L'utente e' SEMPRE quello del token (l'email mandata dal browser non conta).
// Se questa funzione non risponde, il portale torna da solo alle letture via Make.
// Serve la variabile d'ambiente AIRTABLE_TOKEN (la stessa di documenti.js).

const BASE = 'app0TGG8f4ARpdlbl';
const T_CARICHI = 'tblZ7NoiUBJsi1ZSK';
const T_TRASP = 'tblrn6u8TOshdviwo';
const T_AZ = 'tblVSe1R3ayWgNDy9';
const T_SCAD = 'tblzYbLC0ky9YkXNk';
const VISTA_DISPONIBILI = 'viwhtwFMNgPjGxlwN';
const VISTA_STORICO = 'viwK5MGtGp80hrCP0';
const EMAIL_GESTORI = ['system.synaimax@gmail.com'];

// campi mandati ai trasportatori per i carichi disponibili (gli stessi dello scenario Make)
const CAMPI_DISPONIBILI = ['note', 'stato', 'id_carico', 'km_tratta', 'cap_arrivo', 'codice_cer', 'pericoloso', 'tipo_merce',
  'cap_partenza', 'citta_arrivo', 'tipo_rifiuto', 'data_consegna', 'numero_ordine', 'citta_partenza', 'destinazione_cap',
  'importo_pattuito', 'termini_pagamento', 'data_pubblicazione', 'tipo_mezzo_richiesto', 'autorizzazione_richiesta'];

// campi della dashboard dei gestori (gli stessi dello scenario Make "Proxy Liste")
const CAMPI_DASHBOARD = ['note', 'stato', 'km_tratta', 'specifica', 'cap_arrivo', 'codice_cer', 'pericoloso', 'tipo_merce',
  'azienda_piva', 'cap_partenza', 'citta_arrivo', 'nome_azienda', 'tipo_rifiuto', 'data_consegna', 'email_azienda',
  'numero_ordine', 'bloccato_da_id', 'citta_partenza', 'data_assegnato', 'data_incassato', 'notifica_letta', 'pagato_azienda',
  'assegnato_a_nome', 'bloccato_da_nome', 'importo_pattuito', 'indirizzo_ritiro', 'telefono_azienda', 'azienda_indirizzo',
  'azienda_referente', 'destinatario_nome', 'termini_pagamento', 'data_pubblicazione', 'indirizzo_consegna',
  'trasportatore_piva', 'data_pagato_azienda', 'trasportatore_email', 'assegnato_a_telefono', 'tipo_mezzo_richiesto',
  'destinatario_telefono', 'incassato_trasportatore', 'trasportatore_indirizzo', 'autorizzazione_richiesta'];

const TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLETOKEN || '';

// memoria a breve termine (vale finche' la funzione resta "calda"): evita di rileggere Airtable
// a ogni pressione di "Aggiorna" quando tanti utenti aggiornano quasi insieme.
const CACHE = {};
const DURATA_MS = { disponibili: 45 * 1000, dashboard: 20 * 1000 };
const MIN_RIFORZA_MS = 8 * 1000;   // anche con "forza" non rileggo Airtable piu' di una volta ogni 8 secondi

function risposta(stato, dati) {
  return { statusCode: stato, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(dati) };
}

function testoFormula(v) { return String(v || '').toLowerCase().trim().replace(/\\/g, '\\\\').replace(/"/g, '\\"'); }

async function airtable(tabella, parametri) {
  const tutti = [];
  let offset = '';
  const max = Number(parametri.maxRecords) || 100;
  for (let giro = 0; giro < 12; giro++) {
    const q = new URLSearchParams();
    q.set('pageSize', '100');
    q.set('maxRecords', String(max));
    if (parametri.view) q.set('view', parametri.view);
    if (parametri.formula) q.set('filterByFormula', parametri.formula);
    (parametri.campi || []).forEach(c => q.append('fields[]', c));
    if (offset) q.set('offset', offset);
    const r = await fetch('https://api.airtable.com/v0/' + BASE + '/' + tabella + '?' + q.toString(), {
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('airtable_' + r.status + ' ' + JSON.stringify(d.error || d));
    (d.records || []).forEach(x => tutti.push(x));
    offset = d.offset || '';
    if (!offset || tutti.length >= max) break;
  }
  return tutti.slice(0, max);
}

// risposta dalla memoria se ancora fresca; altrimenti la rilegge
async function conMemoria(chiave, durata, forza, leggi) {
  const ora = Date.now();
  const c = CACHE[chiave];
  if (c && (ora - c.t) < durata && !(forza && (ora - c.t) >= MIN_RIFORZA_MS)) return c.v;
  const v = await leggi();
  CACHE[chiave] = { t: ora, v: v };
  return v;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return risposta(405, { ok: false, errore: 'usa_post' });
  if (!TOKEN) return risposta(500, { ok: false, errore: 'token_airtable_mancante' });
  const chi = context.clientContext && context.clientContext.user;
  if (!chi || !chi.email) return risposta(401, { ok: false, errore: 'accesso_richiesto' });
  const email = String(chi.email).toLowerCase().trim();
  const gestore = EMAIL_GESTORI.indexOf(email) !== -1;

  let corpo = {};
  try { corpo = JSON.parse(event.body || '{}'); } catch (e) { return risposta(400, { ok: false, errore: 'json_non_valido' }); }
  const azione = corpo.azione;
  const forza = corpo.forza === true;

  try {
    // ---------- carichi disponibili (tutti i trasportatori vedono la stessa lista) ----------
    if (azione === 'carichi_disponibili') {
      const carichi = await conMemoria('disponibili', DURATA_MS.disponibili, forza, async () => {
        const rec = await airtable(T_CARICHI, { view: VISTA_DISPONIBILI, maxRecords: 200 });
        return rec
          .filter(r => String((r.fields || {}).stato || '') !== 'ANNULLATO')
          .map(r => {
            const o = { id: r.id, createdTime: r.createdTime };
            CAMPI_DISPONIBILI.forEach(c => { const v = (r.fields || {})[c]; o[c] = (v === undefined || v === null) ? '' : v; });
            return o;
          });
      });
      return risposta(200, { ok: true, dati: { carichi: carichi } });
    }

    // ---------- chi e' l'utente (trasportatore o azienda) ----------
    if (azione === 'get_utente') {
      const fe = "LOWER(TRIM({email}))=\"" + testoFormula(email) + "\"";
      const [tr, az] = await Promise.all([
        airtable(T_TRASP, { formula: fe, maxRecords: 1 }),
        airtable(T_AZ, { formula: fe, maxRecords: 1 })
      ]);
      return risposta(200, { ok: true, dati: { azienda: az, trasportatore: tr } });
    }

    // ---------- carichi pubblicati dall'azienda che e' entrata ----------
    if (azione === 'get_carichi_pubblicati_azienda') {
      const fe = "LOWER(TRIM({email_azienda}))=\"" + testoFormula(email) + "\"";
      const rec = await airtable(T_CARICHI, { formula: fe, maxRecords: 200 });
      return risposta(200, { ok: true, dati: { carichi: rec } });
    }

    // ---------- carichi PRESI dal trasportatore che e' entrato ----------
    if (azione === 'get_candidature_trasportatore') {
      const fe = "AND(LOWER({bloccato_da_id}) = \"" + testoFormula(email) + "\", {stato}=\"PRESO\")";
      const rec = await airtable(T_CARICHI, { view: VISTA_STORICO, formula: fe, maxRecords: 200 });
      return risposta(200, { ok: true, dati: { candidature: rec } });
    }

    // ---------- quanti trasportatori approvati (contatore per le aziende) ----------
    if (azione === 'conta_trasportatori_compatibili') {
      const rec = await conMemoria('compatibili', DURATA_MS.disponibili, forza, () =>
        airtable(T_TRASP, { formula: '{stato}="Approvato"', maxRecords: 100, campi: ['tipo_camion', 'autorizzazioni'] }));
      return risposta(200, { ok: true, dati: { trasportatori: rec } });
    }

    // ---------- SOLO GESTORI ----------
    if (azione === 'get_dashboard_data' || azione === 'get_scadenze') {
      if (!gestore) return risposta(403, { ok: false, errore: 'solo_gestori' });
      if (azione === 'get_dashboard_data') {
        const carichi = await conMemoria('dashboard', DURATA_MS.dashboard, forza, async () => {
          const rec = await airtable(T_CARICHI, { formula: 'TRUE()', maxRecords: 1000 });
          return rec.map(r => {
            const o = { id: r.id, createdTime: r.createdTime };
            CAMPI_DASHBOARD.forEach(c => { const v = (r.fields || {})[c]; o[c] = (v === undefined || v === null) ? '' : v; });
            return o;
          });
        });
        return risposta(200, { ok: true, dati: { carichi: carichi } });
      }
      const rec = await airtable(T_SCAD, { formula: '{Stato}="Attiva"', maxRecords: 50 });
      return risposta(200, { ok: true, dati: { scadenze: rec } });
    }

    return risposta(400, { ok: false, errore: 'azione_non_valida' });
  } catch (e) {
    return risposta(502, { ok: false, errore: 'lettura_non_riuscita', dettaglio: String(e && e.message || e).slice(0, 200) });
  }
};
