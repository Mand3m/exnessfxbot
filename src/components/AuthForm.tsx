"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.needsVerify) {
          setError(json.error || "Verify your email first.");
          return;
        }
        throw new Error(json.error || "Failed");
      }
      if (json.needsVerify) {
        router.push("/register/check-email?email=" + encodeURIComponent(email));
        return;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not resend.");
      setNotice("Verification email sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      {mode === "register" && (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
          />
        </label>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base"
        />
      </label>
      {error ? <p className="text-sm text-sell">{error}</p> : null}
      {notice ? <p className="text-sm text-[#e0b422]">{notice}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#e0b422] px-5 py-2.5 text-sm font-semibold !text-black disabled:opacity-50"
      >
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      {mode === "login" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <Link href="/forgot-password" className="text-[#e0b422] underline">
            Forgot password
          </Link>
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="text-[#e0b422] underline disabled:opacity-50"
          >
            Resend verification email
          </button>
        </div>
      ) : null}
    </form>
  );
}
