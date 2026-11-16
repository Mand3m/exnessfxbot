"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CALLING_CODES, composeContact } from "@/lib/calling-codes";
import { isSampleStudentLogin } from "@/lib/sample-logins";
import { SHOW_PREMIUM } from "@/lib/site";

function safeNext() {
  const q = new URLSearchParams(window.location.search);
  const next = q.get("next") || "";
  if (next.startsWith("/") && !next.startsWith("//")) return next;
  const pack = q.get("pack") || "";
  if (pack === "mentorship" || pack === "beginner") return `/mentorship?pay=${pack}`;
  if (pack) return SHOW_PREMIUM ? `/premium?pay=${pack}` : "/";
  return "/";
}

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dialIso, setDialIso] = useState("");
  const [phone, setPhone] = useState("");
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
    if (mode === "login" && !isSampleStudentLogin(email)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Enter a valid email.");
        setBusy(false);
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setBusy(false);
        return;
      }
    }
    if (mode === "register") {
      const contact = composeContact(dialIso, phone);
      if (!contact.ok) {
        setError(contact.error);
        setBusy(false);
        return;
      }
    }
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "login" ? { email, password } : { name, email, password, dialIso, phone }
        ),
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
      router.push(safeNext());
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

  const sampleStudent = mode === "login" && isSampleStudentLogin(email);

  return (
    <form
      onSubmit={onSubmit}
      noValidate={mode === "login"}
      className="space-y-4 rounded-2xl border border-border bg-card p-6"
    >
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
      {mode === "register" && (
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Contact</span>
          <span className="flex flex-col gap-2 sm:flex-row">
            <select
              value={dialIso}
              onChange={(e) => setDialIso(e.target.value)}
              required
              aria-label="Country code"
              className="w-full rounded-xl border border-border bg-background px-3 py-3 text-base sm:w-48"
            >
              <option value="">Country code</option>
              {CALLING_CODES.map((c) => (
                <option key={c.iso} value={c.iso}>
                  {c.name} +{c.dial}
                </option>
              ))}
            </select>
            <input
              type="tel"
              name="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="Phone number"
              aria-label="Phone number"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-3 text-base"
            />
          </span>
          <span className="mt-1 block text-xs text-muted">
            Choose your country code, then the number people use to reach you.
          </span>
        </label>
      )}
      <label className="block text-sm">
        <span className="mb-1 block text-muted">{mode === "login" ? "Email or username" : "Email"}</span>
        <input
          type={mode === "register" ? "email" : "text"}
          name={mode === "login" ? "username" : "email"}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete={mode === "login" ? "username" : "email"}
          inputMode={mode === "login" ? "text" : "email"}
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
          minLength={mode === "register" || (mode === "login" && !sampleStudent) ? 6 : undefined}
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
