// FUNZIONE SERVERLESS NETLIFY — sicurezza.js (26/9/2026)
//
// 1) GOOGLE AUTHENTICATOR (consigliato)
//    Chiamata dal portale / dalla dashboard con l'utente GIA' entrato
//    (header Authorization: Bearer <token dell'utente>):
//      { azione: "stato" }                       -> { mfa_attivo, pw_temporanea }
//      { azione: "mfa_inizia" }                  -> { segreto, otpauth }
//      { azione: "mfa_conferma", codice }        -> attiva + { ticket_dati, ticket_firma }
//      { azione: "mfa_verifica", codice }        -> { ticket_dati, ticket_firma }
//      { azione: "mfa_disattiva", codice }       -> disattiva
//      { azione: "password_cambiata" }           -> toglie il segno "password temporanea"
//
// 2) PASSWORD DIMENTICATA CON CODICE VIA EMAIL
//    Chiamata SOLO da Make (header x-ect-key = ECT_FUNCTION_KEY):
//      { azione: "reset_codice", email }                 -> { ok, codice } (max 3 al giorno)
//      { azione: "reset_conferma", email, codice, password }
//      { azione: "mfa_azzera", email }                   -> per chi perde il telefono
//      { azione: "segna_temporanea", email }
//
// Il segreto di Google Authenticator e' salvato CIFRATO: nemmeno chi vede
// il profilo dell'utente puo' leggerlo. Il "ticket" dopo il codice giusto
// e' firmato con la chiave segreta: Make lo verifica a ogni richiesta.
const crypto = require('crypto');

const CHIAVE = process.env.ECT_FUNCTION_KEY || '';
const DURATA_TICKET_ORE = 12;
const MINUTI_CODICE_EMAIL = 15;
const MAX_TENTATIVI = 5;
const MAX_RICHIESTE_GIORNO = 3;

function risposta(stato, dati) {
  return { statusCode: stato, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dati) };
}

/* ---------- cifratura del segreto ---------- */
function chiaveCifratura() { return crypto.createHash('sha256').update(CHIAVE + '|mfa').digest(); }
function cifra(testo) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chiaveCifratura(), iv);
  const enc = Buffer.concat([c.update(testo, 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}
function decifra(pacchetto) {
  const [iv, tag, enc] = String(pacchetto || '').split('.');
  const d = crypto.createDecipheriv('aes-256-gcm', chiaveCifratura(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
}

/* ---------- codici di Google Authenticator (TOTP, 6 cifre, 30 secondi) ---------- */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf) {
  let bits = 0, valore = 0, out = '';
  for (const b of buf) {
    valore = (valore << 8) | b; bits += 8;
    while (bits >= 5) { out += ALFABETO[(valore >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALFABETO[(valore << (5 - bits)) & 31];
  return out;
}
function daBase32(testo) {
  let bits = 0, valore = 0; const out = [];
  for (const ch of testo.replace(/=+$/, '').toUpperCase()) {
    const i = ALFABETO.indexOf(ch); if (i < 0) continue;
    valore = (valore << 5) | i; bits += 5;
    if (bits >= 8) { out.push((valore >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}
function codiceTotp(segreto, passo) {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(passo / 0x100000000), 0);
  buf.writeUInt32BE(passo >>> 0, 4);
  const h = crypto.createHmac('sha1', daBase32(segreto)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}
function totpValido(segreto, codice) {
  const c = String(codice || '').replace(/\D/g, '');
  if (c.length !== 6) return false;
  const passo = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) { if (codiceTotp(segreto, passo + d) === c) return true; }
  return false;
}

/* ---------- ticket firmato per Make ---------- */
function creaTicket(email) {
  const scade = Math.floor(Date.now() / 1000) + DURATA_TICKET_ORE * 3600;
  const dati = String(email).toLowerCase() + '|' + scade;
  const firma = crypto.createHmac('sha256', CHIAVE).update(dati).digest('hex');
  return { ticket_dati: dati, ticket_firma: firma, scade: scade };
}

/* ---------- accesso a Netlify Identity (amministratore) ---------- */
async function leggiUtente(identity, id) {
  const r = await fetch(`${identity.url}/admin/users/${id}`, { headers: { Authorization: `Bearer ${identity.token}` } });
  if (!r.ok) throw new Error('utente non leggibile');
  return r.json();
}
async function trovaPerEmail(identity, email) {
  const cercata = String(email || '').trim().toLowerCase();
  for (let pagina = 1; pagina <= 20; pagina++) {
    const r = await fetch(`${identity.url}/admin/users?page=${pagina}&per_page=100`, { headers: { Authorization: `Bearer ${identity.token}` } });
    if (!r.ok) return null;
    const d = await r.json();
    const lista = d.users || d || [];
    const u = lista.find(x => String(x.email || '').toLowerCase() === cercata);
    if (u) return u;
    if (lista.length < 100) return null;
  }
  return null;
}
async function aggiorna(identity, id, corpo) {
  const r = await fetch(`${identity.url}/admin/users/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${identity.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });
  if (!r.ok) throw new Error('aggiornamento non riuscito: ' + r.status);
  return r.json();
}

function oggi() { return new Date().toISOString().slice(0, 10); }
function hashCodice(email, codice) {
  return crypto.createHmac('sha256', CHIAVE).update(String(email).toLowerCase() + '|' + codice).digest('hex');
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return risposta(405, { ok: false, errore: 'usa_post' });
  if (!CHIAVE) return risposta(500, { ok: false, errore: 'chiave_mancante' });
  const identity = context.clientContext && context.clientContext.identity;
  if (!identity || !identity.url || !identity.token) return risposta(500, { ok: false, errore: 'identity_non_disponibile' });

  let corpo = {};
  try { corpo = JSON.parse(event.body || '{}'); } catch (e) { return risposta(400, { ok: false, errore: 'json_non_valido' }); }
  const azione = corpo.azione;
  const chiaveRicevuta = (event.headers && (event.headers['x-ect-key'] || event.headers['X-Ect-Key'])) || '';
  const daMake = chiaveRicevuta === CHIAVE;

  try {
    /* ===================== AZIONI SOLO DA MAKE ===================== */
    if (['reset_codice', 'reset_conferma', 'mfa_azzera', 'segna_temporanea'].includes(azione)) {
      if (!daMake) return risposta(401, { ok: false, errore: 'non_autorizzato' });
      const u = await trovaPerEmail(identity, corpo.email);
      if (!u) return risposta(200, { ok: false, errore: 'utente_non_trovato' });
      const am = u.app_metadata || {};

      if (azione === 'reset_codice') {
        const conteggio = am.reset_giorno === oggi() ? (am.reset_conteggio || 0) : 0;
        if (conteggio >= MAX_RICHIESTE_GIORNO) return risposta(200, { ok: false, errore: 'troppe_richieste_oggi' });
        const codice = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await aggiorna(identity, u.id, { app_metadata: {
          reset_hash: hashCodice(u.email, codice),
          reset_scade: Date.now() + MINUTI_CODICE_EMAIL * 60000,
          reset_tentativi: 0,
          reset_giorno: oggi(),
          reset_conteggio: conteggio + 1
        } });
        return risposta(200, { ok: true, codice: codice, minuti: MINUTI_CODICE_EMAIL });
      }

      if (azione === 'reset_conferma') {
        if (!am.reset_hash) return risposta(200, { ok: false, errore: 'nessun_codice' });
        if (Date.now() > (am.reset_scade || 0)) {
          await aggiorna(identity, u.id, { app_metadata: { reset_hash: null, reset_scade: null, reset_tentativi: null } });
          return risposta(200, { ok: false, errore: 'codice_scaduto' });
        }
        const tentativi = (am.reset_tentativi || 0) + 1;
        const giusto = hashCodice(u.email, String(corpo.codice || '').replace(/\D/g, '')) === am.reset_hash;
        if (!giusto) {
          if (tentativi >= MAX_TENTATIVI) {
            await aggiorna(identity, u.id, { app_metadata: { reset_hash: null, reset_scade: null, reset_tentativi: null } });
            return risposta(200, { ok: false, errore: 'troppi_tentativi' });
          }
          await aggiorna(identity, u.id, { app_metadata: { reset_tentativi: tentativi } });
          return risposta(200, { ok: false, errore: 'codice_errato', tentativi_rimasti: MAX_TENTATIVI - tentativi });
        }
        const pw = corpo.password_b64 ? Buffer.from(String(corpo.password_b64), 'base64').toString('utf8') : String(corpo.password || '');
        if (pw.length < 8) return risposta(200, { ok: false, errore: 'password_corta' });
        await aggiorna(identity, u.id, { password: pw, app_metadata: { reset_hash: null, reset_scade: null, reset_tentativi: null, pw_temporanea: false } });
        return risposta(200, { ok: true });
      }

      if (azione === 'mfa_azzera') {
        await aggiorna(identity, u.id, { app_metadata: { mfa_attivo: false, mfa_segreto: null, mfa_attesa: null, mfa_errori: null, mfa_blocco: null } });
        return risposta(200, { ok: true });
      }

      if (azione === 'segna_temporanea') {
        await aggiorna(identity, u.id, { app_metadata: { pw_temporanea: true } });
        return risposta(200, { ok: true });
      }
    }

    /* ============ AZIONI DELL'UTENTE GIA' ENTRATO (portale / dashboard) ============ */
    const chi = context.clientContext && context.clientContext.user;
    if (!chi || !chi.sub) return risposta(401, { ok: false, errore: 'accesso_richiesto' });
    const u = await leggiUtente(identity, chi.sub);
    const am = u.app_metadata || {};

    if (azione === 'stato') {
      return risposta(200, { ok: true, email: u.email, mfa_attivo: am.mfa_attivo === true, pw_temporanea: am.pw_temporanea === true });
    }

    if (azione === 'password_cambiata') {
      await aggiorna(identity, u.id, { app_metadata: { pw_temporanea: false } });
      return risposta(200, { ok: true });
    }

    if (azione === 'mfa_inizia') {
      if (am.mfa_attivo === true) return risposta(200, { ok: false, errore: 'gia_attivo' });
      const segreto = base32(crypto.randomBytes(20));
      await aggiorna(identity, u.id, { app_metadata: { mfa_attesa: cifra(segreto) } });
      const etichetta = encodeURIComponent('EcoTruckConnect:' + u.email);
      const otpauth = `otpauth://totp/${etichetta}?secret=${segreto}&issuer=EcoTruckConnect&algorithm=SHA1&digits=6&period=30`;
      return risposta(200, { ok: true, segreto: segreto, otpauth: otpauth });
    }

    // da qui servono i controlli contro chi prova a indovinare il codice
    if (['mfa_conferma', 'mfa_verifica', 'mfa_disattiva'].includes(azione)) {
      if (am.mfa_blocco && Date.now() < am.mfa_blocco) {
        const minuti = Math.ceil((am.mfa_blocco - Date.now()) / 60000);
        return risposta(200, { ok: false, errore: 'bloccato', minuti: minuti });
      }
      let segreto;
      try { segreto = decifra(azione === 'mfa_conferma' ? am.mfa_attesa : am.mfa_segreto); }
      catch (e) { return risposta(200, { ok: false, errore: azione === 'mfa_conferma' ? 'ricomincia' : 'non_attivo' }); }

      if (!totpValido(segreto, corpo.codice)) {
        const errori = (am.mfa_errori || 0) + 1;
        const cambio = errori >= MAX_TENTATIVI ? { mfa_errori: 0, mfa_blocco: Date.now() + 15 * 60000 } : { mfa_errori: errori };
        await aggiorna(identity, u.id, { app_metadata: cambio });
        if (errori >= MAX_TENTATIVI) return risposta(200, { ok: false, errore: 'bloccato', minuti: 15 });
        return risposta(200, { ok: false, errore: 'codice_errato', tentativi_rimasti: MAX_TENTATIVI - errori });
      }

      if (azione === 'mfa_conferma') {
        await aggiorna(identity, u.id, { app_metadata: { mfa_attivo: true, mfa_segreto: am.mfa_attesa, mfa_attesa: null, mfa_errori: 0, mfa_blocco: null } });
        return risposta(200, Object.assign({ ok: true }, creaTicket(u.email)));
      }
      if (azione === 'mfa_verifica') {
        if (am.mfa_errori) await aggiorna(identity, u.id, { app_metadata: { mfa_errori: 0, mfa_blocco: null } });
        return risposta(200, Object.assign({ ok: true }, creaTicket(u.email)));
      }
      if (azione === 'mfa_disattiva') {
        await aggiorna(identity, u.id, { app_metadata: { mfa_attivo: false, mfa_segreto: null, mfa_attesa: null, mfa_errori: 0, mfa_blocco: null } });
        return risposta(200, { ok: true });
      }
    }

    return risposta(400, { ok: false, errore: 'azione_sconosciuta' });
  } catch (err) {
    return risposta(500, { ok: false, errore: 'errore_interno', dettaglio: String(err && err.message || err) });
  }
};
