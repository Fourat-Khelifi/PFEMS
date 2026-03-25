import { Resend } from "resend";
import { RESEND_API_KEY, RESEND_FROM, EMAIL_FROM_NAME } from "./index.js";

const apiKey = RESEND_API_KEY || process.env.RESEND_API_KEY;
const resend = new Resend(apiKey);

const sandboxFrom = "onboarding@resend.dev";
const defaultFrom = RESEND_FROM
  ? EMAIL_FROM_NAME
    ? `${EMAIL_FROM_NAME} <${RESEND_FROM}>`
    : RESEND_FROM
  : EMAIL_FROM_NAME
    ? `${EMAIL_FROM_NAME} <${sandboxFrom}>`
    : sandboxFrom;

if (!apiKey) {
  console.warn("⚠️ RESEND_API_KEY not set. Email sending will fail.");
} else {
  console.log("✅ Resend client initialized");
}

if (!RESEND_FROM && apiKey) {
  console.warn(
    "📧 RESEND_FROM not set; using onboarding@resend.dev. For production, verify a domain at https://resend.com/domains and set RESEND_FROM (e.g. noreply@yourdomain.com). Note: the sandbox sender may only deliver to your Resend account email."
  );
}

async function sendMail(mailOptions) {
  const from =
    mailOptions.from && !String(mailOptions.from).includes("undefined")
      ? mailOptions.from
      : defaultFrom;
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

    if (response?.error) {
      const err = response.error;
      const msg =
        typeof err.message === "string"
          ? err.message
          : err.message != null
            ? JSON.stringify(err.message)
            : JSON.stringify(err);
      throw new Error(msg || "Resend returned an unknown email error");
    }

    const messageId = response?.data?.id || response?.id || null;

    const info = {
      messageId,
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
