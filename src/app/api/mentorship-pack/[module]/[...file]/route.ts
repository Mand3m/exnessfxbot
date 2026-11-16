import { NextResponse } from "next/server";
import { getSession, userHasPack } from "@/lib/auth";
import { findMentorshipModule, resolveMentorshipFile } from "@/lib/mentorship-pack";
import { serveMediaFile } from "@/lib/serve-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ module: string; file: string[] }> };

export async function GET(req: Request, { params }: Props) {
  const session = await getSession();
  const { module: moduleId, file } = await params;
  const mod = findMentorshipModule(moduleId);
  if (!mod) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (!userHasPack(session, mod.id)) {
    return NextResponse.json({ error: "This mentorship material is locked." }, { status: 401 });
  }
  const rel = (file || []).map((p) => decodeURIComponent(p)).join("/");
  const hit = resolveMentorshipFile(mod.id, rel);
  if (!hit) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return serveMediaFile(
    hit.fullPath,
    hit.mime,
    hit.name,
    req.headers.get("range"),
    hit.kind === "slides" || hit.kind === "file"
  );
}
