// FUNZIONE SERVERLESS NETLIFY — imposta-password-diretta.js
//
// EMERGENZA 25/7: bypassa completamente email/invite_token/recovery_token.
// Imposta la password di un utente esistente direttamente via Admin API.
// Usata SOLO per sbloccare i test quando Gmail (o altri client email)
// "consumano" il token monouso scansionando il link prima del click umano.
//
// NON usare per il flusso pubblico di lancio: è uno strumento di emergenza
// per uso interno/admin, da chiamare a mano dalla Console del browser.
//
// Come si chiama (da Console del browser, sullo stesso dominio del portale):
// fetch('/.netlify/functions/imposta-password-diretta', {
//   method: 'POST',
//   headers: {'Content-Type':'application/json'},
//   body: JSON.stringify({ email: 'xxx@gmail.com', password: 'NuovaPassword123!' })
// }).then(r=>r.json()).then(console.log)
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, errore: 'Usa POST' }) };
  }
  let email, password;
  try {
    const body = JSON.parse(event.body || '{}');
    email = body.email;
    password = body.password;
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, errore: 'Body JSON non valido' }) };
  }
  if (!email || !password || password.length < 8) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, errore: 'Servono email e password (min 8 caratteri)' }) };
  }
  const identity = context.clientContext && context.clientContext.identity;
  if (!identity || !identity.token || !identity.url) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, errore: 'Identity non disponibile su questo sito' }) };
  }
  try {
    const listRes = await fetch(`${identity.url}/admin/users`, {
      headers: { 'Authorization': `Bearer ${identity.token}` }
    });
    const listData = await listRes.json();
    const users = listData.users || listData || [];
    const user = users.find(u => u.email === email);
    if (!user) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, errore: 'Utente non trovato: ' + email }) };
    }
    const updRes = await fetch(`${identity.url}/admin/users/${user.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${identity.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: password, confirm: true })
    });
    const updData = await updRes.json();
    if (!updRes.ok) {
      return { statusCode: updRes.status, body: JSON.stringify({ ok: false, errore: updData }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true, user: updData }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, errore: String(err) }) };
  }
};
