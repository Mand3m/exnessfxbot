import { NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/auth";
import { publicSiteOrigin } from "@/lib/site";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = String(url.searchParams.get("token") || "");
  const login = new URL("/login", publicSiteOrigin(req) + "/");
  if (!token) {
    login.searchParams.set("error", "Missing verification link.");
    return NextResponse.redirect(login, 303);
  }
  const result = verifyEmailToken(token);
  if (!result.ok) {
    login.searchParams.set("error", result.error);
    return NextResponse.redirect(login, 303);
  }
  login.searchParams.set("verified", "1");
  return NextResponse.redirect(login, 303);
}
