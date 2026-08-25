const fs = require("fs");
const nodemailer = require("nodemailer");

const env = {};
for (const line of fs.readFileSync("/opt/forextradingconsultants/.env.local", "utf8").split(/\r?\n/)) {
  const text = line.trim();
  if (!text || text.startsWith("#") || !text.includes("=")) continue;
  const i = text.indexOf("=");
  env[text.slice(0, i)] = text.slice(i + 1);
}

const host = env.SMTP_HOST;
const user = env.SMTP_USER;
const pass = env.SMTP_PASS;
if (!host || !user || !pass) {
  console.error("SMTP keys missing");
  process.exit(1);
}

const transport = nodemailer.createTransport({
  host,
  port: Number(env.SMTP_PORT || 587),
  secure: env.SMTP_SECURE === "1",
  auth: { user, pass },
});

transport
  .verify()
  .then(() => {
    console.log("SMTP_OK");
    process.exit(0);
  })
  .catch((err) => {
    console.error("SMTP_FAIL", err && err.message ? err.message : err);
    process.exit(1);
  });
