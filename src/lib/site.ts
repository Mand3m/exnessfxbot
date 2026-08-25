export const DESK_NAME = "Forex Trading Consultants";
export const DESK_DOMAIN = "forextradingconsultants.com";
export const DESK_EMAIL = "info@forextradingconsultants.com";

/** Public site origin for emails and redirects. Never use the Lightsail loopback. */
export function publicSiteOrigin(req?: Request) {
  const env = (process.env.APP_URL || process.env.SITE_URL || "").trim().replace(/\/$/, "");
  if (env) return env;
  if (req) {
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
      .split(",")[0]
      .trim();
    const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
    if (host && !/^127\.0\.0\.1(?::\d+)?$/.test(host) && !/^localhost(?::\d+)?$/i.test(host)) {
      return `${proto}://${host}`;
    }
  }
  return `https://${DESK_DOMAIN}`;
}
