"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { openChart } from "@/components/ChartPopup";
import { PAIRS } from "@/lib/pairs";

function OpenThenHome() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const pair = params.get("pair") || "USDJPY";
    const id = PAIRS.some((p) => p.id === pair) ? pair : "USDJPY";
    openChart({ pairId: id, signal: null });
    router.replace("/");
  }, [params, router]);

  return (
    <p className="px-4 py-16 text-center text-sm text-muted">Opening 5 minute chart…</p>
  );
}

export default function ChartPage() {
  return (
    <Suspense fallback={<p className="px-4 py-16 text-center text-sm text-muted">Opening chart…</p>}>
      <OpenThenHome />
    </Suspense>
  );
}
