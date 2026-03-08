/**
 * EMAIL SEND SERVICE
 * Invio email SMTP diretto via Nodemailer.
 * Configurato per Microsoft 365 (smtp.office365.com).
 *
 * Env vars richieste:
 *   SMTP_HOST=smtp.office365.com
 *   SMTP_PORT=587
 *   SMTP_USER=info@itsmia.it
 *   SMTP_PASS=<app password>
 *   SMTP_FROM_NAME=Federico - MIA (opzionale)
 */

import nodemailer from 'nodemailer';

// --- Config ---
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.office365.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Federico - MIA';

let transporter = null;

/**
 * Verifica se il servizio email e' configurato
 */
export function isEmailConfigured() {
  return !!(SMTP_USER && SMTP_PASS);
}

/**
 * Crea o restituisce il transporter Nodemailer
 */
function getTransporter() {
  if (!transporter) {
    if (!isEmailConfigured()) {
      throw new Error('SMTP non configurato. Imposta SMTP_USER e SMTP_PASS nelle variabili d\'ambiente.');
    }
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // STARTTLS
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporter;
}

/**
 * Verifica la connessione SMTP
 */
export async function verifySmtp() {
  try {
    const t = getTransporter();
    await t.verify();
    return { ok: true, message: `SMTP connesso: ${SMTP_USER}@${SMTP_HOST}` };
  } catch (err) {
    return { ok: false, message: `SMTP errore: ${err.message}` };
  }
}

/**
 * Invia una singola email
 * @param {Object} params
 * @param {string} params.to - Indirizzo destinatario
 * @param {string} params.subject - Oggetto email
 * @param {string} params.body - Corpo email (testo plain)
 * @param {string} [params.replyTo] - Reply-to opzionale
 * @returns {Object} { success, messageId, error }
 */
export async function sendEmail({ to, subject, body, replyTo }) {
  try {
    const t = getTransporter();

    // Converti body in HTML basico (preserva line breaks)
    const htmlBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>');

    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_USER}>`,
      to,
      subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${htmlBody}</div>`,
    };

    if (replyTo) {
      mailOptions.replyTo = replyTo;
    }

    const info = await t.sendMail(mailOptions);
    console.log(`[EmailSend] Inviata a ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[EmailSend] Errore invio a ${to}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Invia un batch di email con delay tra ognuna (per evitare rate limit).
 * Max 5 email per batch, 3s delay tra ognuna.
 * Pensato per restare dentro il timeout di 60s di Vercel.
 *
 * @param {Array} emails - Array di { to, subject, body, leadId }
 * @param {number} [delayMs=3000] - Delay in ms tra ogni email
 * @returns {Object} { sent, failed, results }
 */
export async function sendBatch(emails, delayMs = 3000) {
  const MAX_BATCH = 5;
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

/**
 * Resetta il transporter (utile per test o cambio config)
 */
export function resetTransporter() {
  if (transporter) {
    transporter.close();
    transporter = null;
  }
}
