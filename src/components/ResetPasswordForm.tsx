"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (password !== confirm) {
      setError("The two passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update the password.");
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <label className="block text-sm">
        <span className="mb-1 block text-muted">New password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Confirm new password</span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
        />
      </label>
      {error ? <p className="text-sm text-sell">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#e0b422] px-5 py-2.5 text-sm font-semibold !text-black disabled:opacity-50"
      >
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}
