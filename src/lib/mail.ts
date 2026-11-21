import { DESK_EMAIL, DESK_NAME } from "@/lib/site";

const DEFAULT_FROM = `${DESK_NAME} <${DESK_EMAIL}>`;

function smtpTransport() {
  const host = (process.env.SMTP_HOST || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "1" || port === 465;
  return {
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: { user, pass },
  };
}

function fromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || DEFAULT_FROM;
}

export async function sendVerificationEmail(to: string, url: string) {
  const cfg = smtpTransport();
  if (cfg) {
    try {
      const nodemailer = await import("nodemailer");
      const transport = nodemailer.createTransport(cfg);
      await transport.sendMail({
        from: fromAddress(),
        replyTo: DESK_EMAIL,
        to,
        subject: "Verify your Forex Trading Consultants email",
        text:
          "Confirm your Forex Trading Consultants account by opening this link:\n\n" +
          url +
          "\n\nThe link expires in 24 hours. If you did not register, ignore this email.",
        html:
          '<div style="font-family:Georgia,serif;background:#000;color:#f3d56a;padding:28px">' +
          '<h1 style="color:#e0b422;font-weight:400">Forex Trading Consultants</h1>' +
          "<p>Confirm this email to finish creating your account.</p>" +
          '<p><a href="' +
          url +
          '" style="display:inline-block;background:#e0b422;color:#000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Verify email</a></p>' +
          "<p style=\"color:#d4b84a;font-size:13px\">Or paste this link:<br>" +
          url +
          "</p></div>",
      });
      return { sent: true as const };
    } catch (err) {
      console.error("Verification email failed", err);
      return { sent: false as const };
    }
  }
  console.error("[verify-email] SMTP is not configured; inbox was not sent", to);
  return { sent: false as const };
}

export async function sendPasswordResetEmail(to: string, url: string) {
  const subject = "Reset your Forex Trading Consultants password";
  const text =
    "Reset your Forex Trading Consultants password by opening this link:\n\n" +
    url +
    "\n\nThe link expires in 24 hours. If you did not ask for a reset, ignore this email.";
  const html =
    '<div style="font-family:Georgia,serif;background:#000;color:#f3d56a;padding:28px">' +
    '<h1 style="color:#e0b422;font-weight:400">Forex Trading Consultants</h1>' +
    "<p>Use this link to choose a new password.</p>" +
    '<p><a href="' +
    url +
    '" style="display:inline-block;background:#e0b422;color:#000;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">Reset password</a></p>' +
    "<p style=\"color:#d4b84a;font-size:13px\">Or paste this link:<br>" +
    url +
    "</p></div>";
  return sendMail(to, subject, text, html);
}

async function sendMail(to: string, subject: string, text: string, html: string, replyTo: string = DESK_EMAIL) {
  const cfg = smtpTransport();
  if (!cfg) {
    console.error("[mail] SMTP is not configured", to, subject);
    return { sent: false as const };
  }
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(cfg);
    await transport.sendMail({
      from: fromAddress(),
      replyTo,
      to,
      subject,
      text,
      html,
    });
    return { sent: true as const };
  } catch (err) {
    console.error("Mail failed", err);
    return { sent: false as const };
  }
}

export async function sendTradeManageAlert(
  to: string,
  notice: { title: string; body: string }
) {
  const subject = `Forex Trading Consultants: ${notice.title}`;
  const text = notice.body + "\n\nOpen your account to see the notification centre.\n";
  const html =
    '<div style="font-family:Georgia,serif;background:#000;color:#f3d56a;padding:28px">' +
    '<h1 style="color:#e0b422;font-weight:400">Forex Trading Consultants</h1>' +
    `<p><strong>${notice.title}</strong></p>` +
    `<p>${notice.body}</p>` +
    "<p>Open your account notification centre for the full trade update.</p>" +
    "</div>";
  return sendMail(to, subject, text, html);
}

export async function sendSignalAlert(
  to: string,
  signal: { pair: string; side: string; entry: number; takeProfit: number; stopLoss: number }
) {
  const side = signal.side.toUpperCase();
  const subject = `Forex Trading Consultants ${signal.pair} ${side} @ ${signal.entry}`;
  const text =
    `New premium signal\n\n${signal.pair} ${side}\nEntry ${signal.entry}\nTP ${signal.takeProfit}\nSL ${signal.stopLoss}\n`;
  const html =
    '<div style="font-family:Georgia,serif;background:#000;color:#f3d56a;padding:28px">' +
    '<h1 style="color:#e0b422;font-weight:400">Forex Trading Consultants</h1>' +
    `<p>New ${signal.pair} <strong>${side}</strong> card is live for premium now.</p>` +
    `<p>Entry <strong>${signal.entry}</strong><br>TP <strong>${signal.takeProfit}</strong><br>SL <strong>${signal.stopLoss}</strong></p>` +
    "</div>";
  return sendMail(to, subject, text, html);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** New Forex Traders' Journal Club waitlist signup, delivered to the desk inbox. */
export async function sendJournalClubSignup(signup: {
  name: string;
  email: string;
  contact: string;
  country: string;
  experience: string;
  message: string;
  createdAt: string;
}) {
  const subject = `Journal Club waitlist: ${signup.name} (${signup.experience})`;
  const rows: [string, string][] = [
    ["Name", signup.name],
    ["Email", signup.email],
    ["Phone / WhatsApp", signup.contact],
    ["Country", signup.country],
    ["Experience", signup.experience],
    ["Message", signup.message || "(none)"],
    ["Signed up", signup.createdAt],
  ];
  const text =
    "New Forex Traders' Journal Club waitlist signup\n\n" +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    "\n\nReply to this email to reach the trader directly.\n";
  const html =
    '<div style="font-family:Georgia,serif;background:#000;color:#f3d56a;padding:28px">' +
    '<h1 style="color:#e0b422;font-weight:400">Journal Club waitlist</h1>' +
    "<p>A new trader joined the Forex Traders&#39; Journal Club waitlist.</p>" +
    '<table style="border-collapse:collapse">' +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 14px 4px 0;color:#d4b84a;vertical-align:top">${k}</td>` +
          `<td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`
      )
      .join("") +
    "</table>" +
    '<p style="color:#d4b84a;font-size:13px">Reply to this email to reach the trader directly.</p>' +
    "</div>";
  return sendMail(DESK_EMAIL, subject, text, html, signup.email);
}
