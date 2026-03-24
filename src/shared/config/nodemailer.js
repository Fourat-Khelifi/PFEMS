import { Resend } from "resend";
import { RESEND_API_KEY, NODEMAILER_EMAIL, EMAIL_FROM_NAME } from "./index.js";

const apiKey = RESEND_API_KEY || process.env.RESEND_API_KEY;
const resend = new Resend(apiKey);

const defaultFrom = NODEMAILER_EMAIL
  ? EMAIL_FROM_NAME
    ? `${EMAIL_FROM_NAME} <${NODEMAILER_EMAIL}>`
    : NODEMAILER_EMAIL
  : "onboarding@resend.dev";

if (!apiKey) {
  console.warn("⚠️ RESEND_API_KEY not set. Email sending will fail.");
} else {
  console.log("✅ Resend client initialized");
}

async function sendMail(mailOptions) {
  const from = mailOptions.from || defaultFrom;
  const to = mailOptions.to;
  const subject = mailOptions.subject || "";
  const html = mailOptions.html;
  const text = mailOptions.text;

  try {
    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
    });

    const info = {
      messageId: response.id || null,
      accepted: Array.isArray(to) ? to : [to],
      rejected: [],
      response,
    };

    return info;
  } catch (error) {
    console.error("❌ Error sending email via Resend:", error);
    throw error;
  }
}

function verify(cb) {
  if (!apiKey) {
    const err = new Error("RESEND_API_KEY not configured");
    if (cb) return cb(err);
    throw err;
  }
  console.log("✅ Resend API key present; client initialized");
  if (cb) cb(null, true);
  return true;
}

const transporter = { sendMail, verify };

export default transporter;
