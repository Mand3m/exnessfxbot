import { NextResponse } from "next/server";
import { loadFibBook } from "@/lib/fib";

export const dynamic = "force-dynamic";

export async function GET() {
  const book = loadFibBook();
  return NextResponse.json({
    ok: true,
    fib: book.latest,
    pairs: book.pairs,
  });
}
