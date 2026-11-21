"use client";

import { useState } from "react";
import { CALLING_CODES, composeContact } from "@/lib/calling-codes";

const LEVELS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "pro", label: "Pro" },
];

const field = "w-full rounded-xl border border-border bg-background px-3 py-3 text-base";

export function JournalClubWaitlist() {
  const [startedAt] = useState(() => Date.now());
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [dialIso, setDialIso] = useState("UG");
  const [phone, setPhone] = useState("");
  const [experience, setExperience] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<"" | "joined" | "already">("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("Enter a valid email.");
      return;
    }
    const contact = composeContact(dialIso, phone);
    if (!contact.ok) {
      setError(contact.error);
      return;
    }
    if (!experience) {
      setError("Choose your experience level.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/journal-club", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, dialIso, phone, experience, message, website, startedAt }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Could not join the waitlist.");
      setDone(json.already ? "already" : "joined");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the waitlist.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[#c9a227] bg-card p-6 text-center">
        <p className="text-xl font-semibold text-[#FFD700]">
          {done === "already" ? "You're already on the list" : "You're on the waitlist"}
        </p>
        <p className="mt-3 text-base text-white">
          We&apos;ll contact you as soon as the first Journal Club session is scheduled.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative space-y-4 rounded-2xl border border-border bg-card p-6">
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          autoComplete="name"
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={120}
          autoComplete="email"
          inputMode="email"
          className={field}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Phone / WhatsApp</span>
        <span className="flex flex-col gap-2 sm:flex-row">
          <select
            value={dialIso}
            onChange={(e) => setDialIso(e.target.value)}
            required
            aria-label="Country code"
            className={`${field} sm:w-48`}
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
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="Phone number"
            aria-label="Phone number"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-3 text-base"
          />
        </span>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Experience level</span>
        <select
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          required
          className={field}
        >
          <option value="">Choose one</option>
          {LEVELS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-muted">Message (optional)</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="What would you like to learn from pro traders?"
          className={field}
        />
      </label>
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-sell">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#e0b422] px-5 py-2.5 text-sm font-semibold !text-black disabled:opacity-50"
      >
        {busy ? "Please wait…" : "Join the waitlist"}
      </button>
    </form>
  );
}
