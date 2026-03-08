/**
 * EMAIL SEND SERVICE
 * Invio email via Brevo (ex Sendinblue) HTTP API.
 * Nessuna dipendenza SMTP — perfetto per Vercel serverless.
 *
 * Env vars richieste:
 *   BREVO_API_KEY=xkeysib-...
 *   EMAIL_FROM=info@itsmia.it (opzionale, default)
 *   EMAIL_FROM_NAME=Federico - MIA (opzionale, default)
 */

// --- Config ---
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'info@itsmia.it';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'Federico - MIA';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Verifica se il servizio email e' configurato
 */
export function isEmailConfigured() {
  return !!BREVO_API_KEY;
}

/**
 * Verifica la connessione Brevo (chiama GET /account)
 */
export async function verifySmtp() {
  try {
    if (!BREVO_API_KEY) {
      return { ok: false, message: 'BREVO_API_KEY non configurata.' };
    }

    const resp = await fetch('https://api.brevo.com/v3/account', {
      headers: { 'api-key': BREVO_API_KEY }
    });

    if (!resp.ok) {
      const err = await resp.text();
      return { ok: false, message: `Brevo API errore: ${resp.status} - ${err}` };
    }

    const data = await resp.json();
    return {
      ok: true,
      message: `Brevo connesso: ${data.email || EMAIL_FROM} — Piano: ${data.plan?.[0]?.type || 'free'}`
    };
  } catch (err) {
    return { ok: false, message: `Brevo errore: ${err.message}` };
  }
}

/**
 * Invia una singola email via Brevo API
 * @param {Object} params
 * @param {string} params.to - Indirizzo destinatario
 * @param {string} params.subject - Oggetto email
 * @param {string} params.body - Corpo email (testo plain)
 * @param {string} [params.replyTo] - Reply-to opzionale
 * @returns {Object} { success, messageId, error }
 */
export async function sendEmail({ to, subject, body, replyTo }) {
  try {
    if (!BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY non configurata.');
    }

    // Converti body in HTML basico (preserva line breaks, rendi link cliccabili)
    const htmlBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

    const payload = {
      sender: {
        name: EMAIL_FROM_NAME,
        email: EMAIL_FROM
      },
      to: [{ email: to }],
      subject,
      textContent: body,
      htmlContent: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${htmlBody}</div>`
    };

    if (replyTo) {
      payload.replyTo = { email: replyTo };
    }

    const resp = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      const errMsg = errData.message || `HTTP ${resp.status}`;
      console.error(`[EmailSend] Brevo errore per ${to}:`, errMsg);
      return { success: false, error: errMsg };
    }

    const data = await resp.json();
    const messageId = data.messageId || data.messageIds?.[0] || 'ok';
    console.log(`[EmailSend] Inviata a ${to}: ${messageId}`);
    return { success: true, messageId };
  } catch (err) {
    console.error(`[EmailSend] Errore invio a ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Invia un batch di email con delay tra ognuna (per evitare rate limit).
 * Max 5 email per batch, 2s delay tra ognuna.
 * Pensato per restare dentro il timeout di 60s di Vercel.
 *
 * @param {Array} emails - Array di { to, subject, body, leadId }
 * @param {number} [delayMs=2000] - Delay in ms tra ogni email
 * @returns {Object} { sent, failed, results }
 */
export async function sendBatch(emails, delayMs = 2000) {
  const MAX_BATCH = 8; // Brevo e' piu' veloce di SMTP, possiamo fare batch piu' grandi
  const batch = emails.slice(0, MAX_BATCH);
  const results = [];
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    const { to, subject, body, leadId } = batch[i];

    const result = await sendEmail({ to, subject, body });
    results.push({
      leadId,
      to,
      ...result
    });

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Delay tra email (non dopo l'ultima)
    if (i < batch.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return { sent, failed, results, total: batch.length };
}
