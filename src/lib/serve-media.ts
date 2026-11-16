import { createReadStream, existsSync, statSync } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";

export function serveMediaFile(
  filePath: string,
  mime: string,
  downloadName: string,
  rangeHeader: string | null,
  asAttachment: boolean
) {
  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File missing." }, { status: 404 });
  }
  const stat = statSync(filePath);
  const size = stat.size;
  const safeName = downloadName.replace(/"/g, "");
  const disposition = `${asAttachment ? "attachment" : "inline"}; filename="${safeName}"`;

  if (rangeHeader) {
    const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    const start = Math.min(Number(m?.[1] || 0), Math.max(0, size - 1));
    const end = m?.[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    if (start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const stream = createReadStream(filePath, { start, end });
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  }

  const stream = createReadStream(filePath);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
