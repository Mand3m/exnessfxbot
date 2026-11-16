"use client";

import { useState } from "react";
import { isSampleStaffLogin } from "@/lib/sample-logins";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const id = email.trim();
    const pass = password.trim();
    if (!isSampleStaffLogin(id)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) {
        setError("Enter a valid email.");
        setBusy(false);
        return;
      }
      if (pass.length < 6) {
        setError("Password must be at least 6 characters.");
        setBusy(false);
        return;
      }
    }
    try {
      const res = await fetch("/api/auth/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: id, password: pass }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not sign in.");
      window.location.assign("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="space-y-4 rounded-2xl border border-border bg-card p-6"
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Email or username</span>
        <input
          type="text"
          name="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
          inputMode="text"
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Password</span>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
        />
      </label>
      {error ? <p className="text-sm text-sell">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#e0b422] px-5 py-2.5 text-sm font-semibold !text-black disabled:opacity-50"
      >
        {busy ? "Please wait…" : "Admin log in"}
      </button>
    </form>
  );
}
