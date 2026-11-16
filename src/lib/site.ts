export const DESK_NAME = "Forex Trading Consultants";
export const DESK_DOMAIN = "forextradingconsultants.com";
export const DESK_EMAIL = "info@forextradingconsultants.com";

/** Public student landing. Share this URL with beginners. */
export const STUDENT_SHARE_PATH = "/students";
export const STUDENT_SHARE_URL = `https://${DESK_DOMAIN}${STUDENT_SHARE_PATH}`;
export const MENTORSHIP_PATH = "/mentorship";
export const MENTORSHIP_SHARE_URL = `https://${DESK_DOMAIN}${MENTORSHIP_PATH}`;

/** Free educational videos for visitors (Information tab). */
export const INFORMATION_PATH = "/information";
export const HUSTLE_LIFESTYLE_PATH = "/hustle-lifestyle";
export const INFORMATION_SHARE_URL = `https://${DESK_DOMAIN}${INFORMATION_PATH}`;

/** Public team page. */
export const TEAM_PATH = "/team";
export const TEAM_SHARE_URL = `https://${DESK_DOMAIN}${TEAM_PATH}`;

/** Algo-Sniper Bot signals (formerly the homepage board). */
export const ALGO_SNIPER_PATH = "/algo-sniper";
export const ALGO_SNIPER_SHARE_URL = `https://${DESK_DOMAIN}${ALGO_SNIPER_PATH}`;

/** Public Algo-Sniper tab and /algo-sniper page. Flip to true to restore. */
export const SHOW_ALGO_SNIPER = false;

/** Public Premium tab, /premium page, and pay CTAs. Flip to true to restore. */
export const SHOW_PREMIUM = false;

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