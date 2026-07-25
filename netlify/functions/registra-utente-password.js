// FUNZIONE SERVERLESS NETLIFY — registra-utente-password.js
//
// SOSTITUISCE DEFINITIVAMENTE il flusso email/invite_token, che si rompe
// perché Gmail (e altri client) scansionano automaticamente i link nelle
// email consumando il token monouso prima che l'utente clicchi davvero.
//
// Cosa fa: crea l'utente su Netlify Identity (se non esiste già) o lo
// aggiorna (se esiste), impostando SUBITO una password generata
// automaticamente e restituendola nella risposta — pronta per essere
// spedita via email dallo scenario Make. Nessun link, nessun token,
// nessuna seconda email da Netlify: un login diretto e definitivo.
//
// Come si chiama (da Make, HTTP module):
// POST https://ecotruckconnect-portale.netlify.app/.netlify/functions/registra-utente-password
// Body JSON: { "email": "persona@esempio.com" }
//   (il campo "password" è opzionale: se omesso viene generata automaticamente)
//
// Risposta: { "ok": true, "password": "EcoTruck482913!", "user": {...} }
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, errore: 'Metodo non permesso, usa POST' })
    };
  }

  let email, password;
  try {
    const body = JSON.parse(event.body || '{}');
    email = body.email;
    password = body.password;
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, errore: 'Body non valido, serve JSON con { "email": "..." }' })
    };
  }
  if (!email) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, errore: 'Manca il campo email' })
    };
  }

  if (!password) {
    const numero = Math.floor(100000 + Math.random() * 900000);
    password = `EcoTruck${numero}!`;
  }
  if (password.length < 8) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, errore: 'Password troppo corta (minimo 8 caratteri)' })
    };
  }

  const identity = context.clientContext && context.clientContext.identity;
  if (!identity || !identity.token || !identity.url) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, errore: 'Contesto Identity non disponibile su questo sito Netlify.' })
    };
  }

  try {
    const listRes = await fetch(`${identity.url}/admin/users`, {
      headers: { 'Authorization': `Bearer ${identity.token}` }
    });
    const listData = await listRes.json();
    const users = listData.users || listData || [];
    const existing = users.find(u => u.email === email);

    let finalUser;
    if (existing) {
      const updRes = await fetch(`${identity.url}/admin/users/${existing.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${identity.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: password, confirm: true })
      });
      finalUser = await updRes.json();
      if (!updRes.ok) {
        return { statusCode: updRes.status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, errore: finalUser }) };
      }
    } else {
      const createRes = await fetch(`${identity.url}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${identity.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: email, password: password, confirm: true })
      });
      finalUser = await createRes.json();
      if (!createRes.ok) {
        return { statusCode: createRes.status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, errore: finalUser }) };
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, password: password, user: finalUser })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, errore: String(err) })
    };
  }
};
