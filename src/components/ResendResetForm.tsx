"use client";

import { useState } from "react";

export function ResendResetForm({ email = "" }: { email?: string }) {
  const [value, setValue] = useState(email);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not resend the email.");
      setNotice("Reset email sent again. Check inbox and spam.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted">Did not get the first email?</p>
      {!email ? (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Email</span>
          <input
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            autoComplete="email"
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
          />
        </label>
      ) : (
        <input type="hidden" value={value} readOnly />
      )}
      {error ? <p className="text-sm text-sell">{error}</p> : null}
      {notice ? <p className="text-sm text-[#e0b422]">{notice}</p> : null}
      <button
        type="submit"
        disabled={busy || !value}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#e0b422] px-5 py-2.5 text-sm font-semibold !text-black disabled:opacity-50"
      >
        {busy ? "Sending…" : "Resend reset email"}
      </button>
    </form>
  );
}
