"use client";

import { useEffect, useState } from "react";

type Notice = {
  id: string;
  title: string;
  body: string;
  at: string;
  kind: string;
};

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function NoticeCentre() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/notices", { credentials: "include", cache: "no-store" });
    const json = await res.json();
    if (!json.ok || !json.premium) return;
    setNotices(json.notices || []);
    setUnread(json.unread || 0);
  }

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  async function markRead() {
    setBusy(true);
    try {
      await fetch("/api/notices", { method: "POST", credentials: "include" });
      setUnread(0);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Notification centre</h2>
        {unread > 0 ? (
          <button
            type="button"
            onClick={markRead}
            disabled={busy}
            className="text-sm text-[#e0b422] underline disabled:opacity-50"
          >
            Mark all read
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">
        When a stop is moved, you get a written instruction here: what to do, and the new SL.
      </p>
      {notices.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No trade-management notices yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notices.map((n, i) => {
            const isNew = i < unread;
            return (
              <li
                key={n.id}
                className={`rounded-xl border px-4 py-3 ${
                  isNew ? "border-[#e0b422] bg-[#e0b422]/10" : "border-white/15"
                }`}
              >
                <p className="text-sm font-semibold text-white">{n.title}</p>
                <p className="mt-1 text-sm text-white">{n.body}</p>
                <p className="mt-1 text-xs text-muted">{when(n.at)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
