import path from "path";
import { NextResponse } from "next/server";
import { getSession, userHasPack } from "@/lib/auth";
import { findBeginnerPackItem } from "@/lib/beginner-pack";
import { serveMediaFile } from "@/lib/serve-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Props = { params: Promise<{ slug: string }> };

export async function GET(req: Request, { params }: Props) {
  const session = await getSession();
  if (!userHasPack(session, "beginner")) {
    return NextResponse.json({ error: "Beginner pack is locked." }, { status: 401 });
  }

  const { slug } = await params;
  const item = findBeginnerPackItem(slug);
  if (!item) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "data", "beginner-pack", item.file);
  return serveMediaFile(
    filePath,
    item.mime,
    item.downloadName,
    req.headers.get("range"),
    item.kind === "slides"
  );
}
