"use client";

import { useState } from "react";
import { STUDENT_SHARE_PATH, STUDENT_SHARE_URL } from "@/lib/site";

export function StudentShareLink() {
  const [copied, setCopied] = useState(false);

  async function copyStudentLink() {
    try {
      await navigator.clipboard.writeText(STUDENT_SHARE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border-2 border-[#e0b422] bg-black/80 px-4 py-5 sm:px-6">
      <p className="text-sm font-semibold text-[#e0b422]">Student share link</p>
      <p className="mt-1 text-xs text-[#d4b84a]">
        Admin only. Send this to new students. It opens the beginner pack.
      </p>
      <div className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <p className="num min-w-0 flex-1 break-all rounded-xl border border-[#c9a227] bg-black px-3 py-3 text-sm text-[#f3d56a]">
          {STUDENT_SHARE_URL}
        </p>
        <button
          type="button"
          onClick={() => void copyStudentLink()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#e0b422] px-4 py-2.5 text-sm font-semibold !text-black"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-2 text-xs text-[#d4b84a]">
        Short alias: <span className="text-[#e0b422]">{STUDENT_SHARE_PATH}</span>
      </p>
    </section>
  );
}
