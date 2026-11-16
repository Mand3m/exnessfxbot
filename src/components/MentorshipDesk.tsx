"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PayDialog } from "@/components/PremiumPicker";
import { OTHER_PACKAGES, MENTORSHIP_OFFERS, type MentorshipTabId } from "@/lib/packages";
import { INFORMATION_PATH, MENTORSHIP_PATH, STUDENT_SHARE_PATH } from "@/lib/site";

type Session = {
  id: string;
  name: string;
  email: string;
  plan: "regular" | "premium";
  entitlements?: { packId: string }[];
};

type ChromeTabId = MentorshipTabId | "information";

function packFor(id: MentorshipTabId) {
  const pack = OTHER_PACKAGES.find((p) => p.id === id);
  if (!pack) throw new Error(`Missing package ${id}`);
  return pack;
}

export function MentorshipChrome({ active }: { active: ChromeTabId }) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-16">
      <p className="text-center text-sm font-semibold uppercase tracking-wider text-[#e0b422]">
        Coaching
      </p>
      <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight sm:text-4xl">
        Mentorship and beginner pack
      </h1>

      <div
        role="tablist"
        aria-label="Mentorship, beginner pack, and information"
        className="mx-auto mt-10 flex max-w-2xl rounded-2xl border border-[#c9a227] bg-black/60 p-1"
      >
        <Link
          href={MENTORSHIP_PATH}
          role="tab"
          aria-selected={active === "mentorship"}
          className={`min-h-11 flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-extrabold tracking-tight sm:text-base ${
            active === "mentorship" ? "bg-[#e0b422] !text-black" : "text-[#FFD700] hover:text-white"
          }`}
        >
          {MENTORSHIP_OFFERS.mentorship.tabLabel}
        </Link>
        <Link
          href={STUDENT_SHARE_PATH}
          role="tab"
          aria-selected={active === "beginner"}
          className={`min-h-11 flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-extrabold tracking-tight sm:text-base ${
            active === "beginner" ? "bg-[#e0b422] !text-black" : "text-[#FFD700] hover:text-white"
          }`}
        >
          {MENTORSHIP_OFFERS.beginner.tabLabel}
        </Link>
        <Link
          href={INFORMATION_PATH}
          role="tab"
          aria-selected={active === "information"}
          className={`min-h-11 flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-extrabold tracking-tight sm:text-base ${
            active === "information" ? "bg-[#e0b422] !text-black" : "text-[#FFD700] hover:text-white"
          }`}
        >
          Information
        </Link>
      </div>
    </div>
  );
}

export function PackPitch({
  packId,
  initialUser = null,
}: {
  packId: MentorshipTabId;
  initialUser?: Session | null;
}) {
  const pack = packFor(packId);
  const offer = MENTORSHIP_OFFERS[packId];
  const [user, setUser] = useState<Session | null>(initialUser);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => setUser(j.user || null))
      .catch(() => setUser(null));
  }, []);

  const next = packId === "beginner" ? STUDENT_SHARE_PATH : MENTORSHIP_PATH;
  const loginHref = `/login?pack=${pack.id}&next=${encodeURIComponent(`${next}?pay=${pack.id}`)}`;
  const registerHref = `/register?pack=${pack.id}&next=${encodeURIComponent(next)}`;

  useEffect(() => {
    if (!user) return;
    const pay = new URLSearchParams(window.location.search).get("pay");
    if (pay === packId) setPayOpen(true);
  }, [user, packId]);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 sm:px-6 sm:pb-16">
      <article className="mx-auto mt-8 max-w-2xl rounded-3xl border border-[#c9a227] bg-black/70 px-5 py-8 sm:px-10 sm:py-10">
        <h2 className="text-center text-xl font-semibold text-[#e0b422] sm:text-2xl">{pack.name}</h2>
        <p className="num mt-4 text-center text-5xl font-semibold text-[#f3d56a]">
          ${pack.price}
          <span className="ml-2 text-base font-normal text-[#d4b84a]">{pack.period}</span>
        </p>
        <p className="mt-4 text-center text-sm text-[#d4b84a]">{offer.headline}</p>
        {offer.quote ? (
          <blockquote className="mx-auto mt-6 max-w-xl text-center">
            <p className="text-base italic leading-relaxed text-[#f3d56a]">“{offer.quote}”</p>
            {offer.quoteBy ? (
              <p className="mt-2 text-xs tracking-wide text-[#d4b84a]">— {offer.quoteBy}</p>
            ) : null}
          </blockquote>
        ) : null}
        {offer.body ? (
          <p className="mt-6 text-center text-sm leading-relaxed text-white">{offer.body}</p>
        ) : null}
        {offer.includes.length > 0 ? (
          <ul className="mt-6 space-y-2 text-sm text-white">
            {offer.includes.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e0b422]" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {user ? (
          <button
            type="button"
            onClick={() => setPayOpen(true)}
            className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#e0b422] px-5 py-3.5 text-base font-semibold !text-black"
          >
            Pay ${pack.price}
          </button>
        ) : (
          <>
            <p className="mt-8 rounded-xl border border-[#e0b422]/50 bg-[#e0b422]/10 px-4 py-3 text-center text-sm text-[#f3d56a]">
              Create an account with your email first.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Link
                href={registerHref}
                className="inline-flex items-center justify-center rounded-xl bg-[#e0b422] px-5 py-3.5 text-base font-semibold !text-black"
              >
                Register
              </Link>
              <Link
                href={loginHref}
                className="inline-flex items-center justify-center rounded-xl border border-[#c9a227] px-5 py-3.5 text-base font-semibold text-[#e0b422]"
              >
                Login
              </Link>
            </div>
          </>
        )}
      </article>

      {payOpen && user ? (
        <PayDialog pack={pack} defaultName={user.name || ""} onClose={() => setPayOpen(false)} />
      ) : null}
    </div>
  );
}