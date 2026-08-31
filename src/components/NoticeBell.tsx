"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-[#FFD700]" aria-hidden>
      <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-4H5a1 1 0 0 1-.8-1.6L6 13.5V9a6 6 0 1 1 12 0v4.5l1.8 2.9A1 1 0 0 1 19 18Z" />
    </svg>
  );
}

export function NoticeBell() {
  const pathname = usePathname();
  const wrap = useRef<HTMLDivElement>(null);
  const [premium, setPremium] = useState(false);
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);

  async function load() {
    const me = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    const mine = await me.json();
    if (mine?.user?.plan !== "premium") {
      setPremium(false);
      setUnread(0);
      setNotices([]);
      return;
    }
    setPremium(true);
    const res = await fetch("/api/notices", { credentials: "include", cache: "no-store" });
    const json = await res.json();
    if (!json.ok) return;
    setNotices(json.notices || []);
    setUnread(json.unread || 0);
  }

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 8000);
    return () => clearInterval(t);
  }, [pathname]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead() {
    await fetch("/api/notices", { method: "POST", credentials: "include" });
    setUnread(0);
  }

  if (!premium) return null;

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        className="relative grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full"
        aria-label={unread ? `${unread} trade notifications` : "Notifications"}
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          if (!open && unread > 0) void markRead();
        }}
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-[70] mt-1 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[#c9a227] bg-black shadow-lg">
          <div className="flex items-center justify-between border-b border-white/15 px-4 py-2.5">
            <p className="text-sm font-semibold text-[#FFD700]">Notifications</p>
            <Link href="/account" className="text-xs text-white underline" onClick={() => setOpen(false)}>
              Open centre
            </Link>
          </div>
          {notices.length === 0 ? (
            <p className="px-4 py-6 text-sm text-white">No trade updates yet.</p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto">
              {notices.slice(0, 12).map((n) => (
                <li key={n.id} className="border-b border-white/10 px-4 py-3 last:border-b-0">
                  <p className="text-sm font-semibold text-white">{n.title}</p>
                  <p className="mt-1 text-sm leading-snug text-white">{n.body}</p>
                  <p className="mt-1 text-xs text-white/70">{when(n.at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
