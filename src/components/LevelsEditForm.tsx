"use client";

import { useState } from "react";

export function LevelsEditForm({
  signalId,
  stopLoss,
  takeProfit,
  next = "/",
}: {
  signalId: string;
  stopLoss: number;
  takeProfit: number;
  next?: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[#c9a227]/70 bg-black/50 p-3">
      <form
        action="/api/admin/desk"
        method="post"
        className="space-y-2"
        onSubmit={() => setBusy(true)}
      >
        <input type="hidden" name="deskAction" value="levels" />
        <input type="hidden" name="id" value={signalId} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="password" value="exnessfxbot-admin" />
        <p className="text-xs font-semibold uppercase tracking-wide text-[#e0b422]">
          Edit SL / TP
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            <span className="mb-1 block text-[#d4b84a]">SL price</span>
            <input
              name="stopLoss"
              required
              inputMode="decimal"
              defaultValue={stopLoss}
              className="w-full rounded-lg border border-[#c9a227] bg-white px-2 py-2 text-sm text-black"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-[#d4b84a]">TP price</span>
            <input
              name="takeProfit"
              required
              inputMode="decimal"
              defaultValue={takeProfit}
              className="w-full rounded-lg border border-[#c9a227] bg-white px-2 py-2 text-sm text-black"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-[#e0b422] px-3 py-2 text-xs font-semibold !text-black disabled:opacity-50"
        >
          {busy ? "Updating…" : "Update levels"}
        </button>
      </form>
      <form action="/api/admin/desk" method="post" onSubmit={() => setBusy(true)}>
        <input type="hidden" name="deskAction" value="close" />
        <input type="hidden" name="id" value={signalId} />
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="password" value="exnessfxbot-admin" />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full border border-red-400 px-3 py-2 text-xs font-semibold text-red-200 disabled:opacity-50"
        >
          Close order
        </button>
      </form>
    </div>
  );
}
