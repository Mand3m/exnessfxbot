"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthBar } from "@/components/AuthBar";
import { Logo } from "@/components/Logo";
import { NoticeBell } from "@/components/NoticeBell";
import { SHOW_ALGO_SNIPER, SHOW_PREMIUM } from "@/lib/site";

/** Spacer matches the header: two rows until lg, one row from lg. Padding is the notch, not extra height. */
const BAR =
  "h-[calc(7.5rem+env(safe-area-inset-top,0px))] lg:h-[calc(4.75rem+env(safe-area-inset-top,0px))]";

export function Header() {
  const pathname = usePathname();
  const premiumOn = pathname.startsWith("/premium");
  const sniperOn = pathname.startsWith("/algo-sniper");
  const teamOn = pathname.startsWith("/team");
  const mentorOn =
    pathname.startsWith("/mentorship") ||
    pathname.startsWith("/students") ||
    pathname.startsWith("/information");

  return (
    <>
      <header
        className={`site-header fixed inset-x-0 top-0 z-50 overflow-x-clip border-b border-[#c9a227] bg-black/95 pt-[env(safe-area-inset-top,0px)] ${BAR}`}
      >
        <div className="mx-auto flex h-[7.5rem] max-w-6xl flex-wrap items-center gap-x-2 px-3 lg:h-[4.75rem] lg:flex-nowrap lg:gap-3 lg:px-6">
          <Logo />

          <div className="relative z-[60] ml-auto flex items-center lg:order-3 lg:ml-0">
            <NoticeBell />
            <AuthBar />
          </div>
          <nav
            aria-label="Primary"
            className="relative z-[60] order-3 flex w-full min-w-0 items-center justify-between gap-1 overflow-x-auto [scrollbar-width:none] lg:order-2 lg:w-auto lg:flex-1 lg:justify-end lg:gap-2 [&::-webkit-scrollbar]:hidden"
          >
            {SHOW_ALGO_SNIPER ? (
              <Link
                href="/algo-sniper"
                className={`whitespace-nowrap px-1 py-2 text-xs font-extrabold tracking-tight text-[#FFD700] sm:px-2 sm:text-sm lg:px-3 lg:text-base ${
                  sniperOn ? "" : "hover:text-white"
                }`}
              >
                Algo-Sniper
              </Link>
            ) : null}
            <Link
              href="/mentorship"
              className={`whitespace-nowrap px-1 py-2 text-xs font-extrabold tracking-tight text-[#FFD700] sm:px-2 sm:text-sm lg:px-3 lg:text-base ${
                mentorOn ? "" : "hover:text-white"
              }`}
            >
              Mentorship
            </Link>
            <Link
              href="/team"
              className={`whitespace-nowrap px-1 py-2 text-xs font-extrabold tracking-tight text-[#FFD700] sm:px-2 sm:text-sm lg:px-3 lg:text-base ${
                teamOn ? "" : "hover:text-white"
              }`}
            >
              Meet the Team
            </Link>
            {SHOW_PREMIUM ? (
              <Link
                href="/premium"
                className={`whitespace-nowrap px-1 py-2 text-xs font-extrabold tracking-tight text-[#FFD700] sm:px-2 sm:text-sm lg:px-3 lg:text-base ${
                  premiumOn ? "" : "hover:text-white"
                }`}
              >
                Premium
              </Link>
            ) : null}
          </nav>
        </div>
      </header>
      <div className={BAR} aria-hidden />
    </>
  );
}
