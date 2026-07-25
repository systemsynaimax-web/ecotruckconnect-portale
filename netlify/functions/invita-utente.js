// FUNZIONE SERVERLESS NETLIFY — invita-utente.js
//
// Cosa fa: invita un utente su Netlify Identity (manda l'email con il link
// per impostare la password), usando il token admin che Netlify fornisce
// AUTOMATICAMENTE a ogni funzione serverless — nessun ruolo, nessun login,
// nessun token da copiare a mano. Questo e' il modo ufficiale Netlify per
// fare operazioni admin su Identity da codice server-side.
//
// Come si chiama (esempio, da Make o da qualsiasi posto):
// POST https://ecotruckconnect-portale.netlify.app/.netlify/functions/invita-utente
// Body JSON: { "email": "persona@esempio.com" }
//
// Risposta: { "ok": true, "user": {...} }  oppure  { "ok": false, "errore": "..." }

exports.handler = async (event, context) => {
  // Solo POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, errore: 'Metodo non permesso, usa POST' }) };
  }

  let email;
  try {
    const body = JSON.parse(event.body || '{}');
    email = body.email;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, errore: 'Body non valido, serve JSON con { "email": "..." }' }) };
  }

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, errore: 'Manca il campo email' }) };
  }

  // Netlify fornisce questo automaticamente a OGNI funzione, su un sito
  // con Identity attivo — e' un token admin di breve durata, sempre valido,
  // indipendente da ruoli o login dell'utente che chiama la funzione.
  const identity = context.clientContext && context.clientContext.identity;

  if (!identity || !identity.token || !identity.url) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        errore: 'Contesto Identity non disponibile. Verifica che Identity sia attivo su questo sito Netlify.'
      })
    };
  }

  try {
    const res = await fetch(`${identity.url}/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${identity.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: email })
    });

    const data = await res.json();

    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ ok: false, errore: data }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, user: data }) };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, errore: String(err) }) };
  }
};
