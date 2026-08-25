"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthBar } from "@/components/AuthBar";
import { Logo } from "@/components/Logo";

const BAR = "h-[calc(4.25rem+env(safe-area-inset-top))] sm:h-[calc(4.75rem+env(safe-area-inset-top))]";

export function Header() {
  const pathname = usePathname();
  const premiumOn = pathname.startsWith("/premium");

  return (
    <>
      <header className={`site-header fixed inset-x-0 top-0 z-50 border-b border-[#c9a227] bg-black/95 ${BAR}`}>
        <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between gap-2 px-3 pt-[env(safe-area-inset-top)] sm:h-[4.75rem] sm:gap-3 sm:px-6">
          <Logo />

          <div className="relative z-[60] flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/premium"
              className={`px-2 py-2 text-sm font-extrabold tracking-tight text-[#FFD700] sm:px-3 sm:text-base ${
                premiumOn ? "" : "hover:text-white"
              }`}
            >
              Premium
            </Link>
            <AuthBar />
          </div>
        </div>
      </header>
      <div className={BAR} aria-hidden />
    </>
  );
}
