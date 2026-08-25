import { headers } from "next/headers";

export async function isAndroidApp() {
  const ua = (await headers()).get("user-agent") || "";
  return /FTCApp/i.test(ua) || (/Android/i.test(ua) && /;\s*wv\)/i.test(ua));
}
