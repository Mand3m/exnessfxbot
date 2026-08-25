"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "@/components/LogoutButton";

type User = { name: string; email: string; plan: "regular" | "premium" };

function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <circle cx="12" cy="12" r="10.2" fill="none" stroke="#e0b422" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="#2f9e6a" strokeWidth="1.2" />
      <circle cx="12" cy="9" r="3.1" fill="#e0b422" />
      <path
        d="M6.6 18.2c1.2-2.6 3.1-3.9 5.4-3.9s4.2 1.3 5.4 3.9"
        fill="none"
        stroke="#e0b422"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function AuthBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setUser(j.user || null))
      .catch(() => setUser(null));
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

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        className="grid h-11 w-11 shrink-0 touch-manipulation place-items-center rounded-full"
        aria-label={open ? "Close account menu" : "Open account menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <AccountIcon />
      </button>
      {open ? (
        <div className="absolute right-0 z-[70] mt-1 min-w-[10.5rem] overflow-hidden rounded-xl border border-[#c9a227] bg-black py-1 shadow-lg">
          {user ? (
            <>
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                {user.name}
              </Link>
              <Link
                href="/download"
                onClick={() => setOpen(false)}
                className="block whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Android app
              </Link>
              <div className="px-2 pb-1">
                <LogoutButton compact />
              </div>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Log in
              </Link>
              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Join
              </Link>
              <Link
                href="/download"
                onClick={() => setOpen(false)}
                className="block whitespace-nowrap px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
              >
                Android app
              </Link>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
