import Link from "next/link";

export function MentorshipUnlocked({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 sm:pb-16">
      <article className="mt-8 rounded-3xl border border-[#c9a227] bg-black/70 px-5 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#e0b422]">
          Mentorship — start
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome{name ? `, ${name}` : ""}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#d4b84a]">
          Admin has unlocked one-on-one mentorship on your email. The desk will work with you
          on pairs, risk, and your own book for the term you paid.
        </p>
        <ul className="mt-6 space-y-2 text-sm text-white">
          <li>Private sessions on entries, stops, and your trades.</li>
          <li>A simple strategy you can follow without guessing.</li>
          <li>Risk and lot size reviewed with the desk.</li>
        </ul>
        <p className="mt-6 text-sm text-[#d4b84a]">
          Reach the desk on WhatsApp or Telegram from the footer, and keep this email as the
          account the desk has on file. If you still need the beginner notes, they stay on the{" "}
          <Link href="/students" className="text-[#e0b422] underline underline-offset-4">
            beginner pack
          </Link>{" "}
          tab after that pack is unlocked.
        </p>
      </article>
    </div>
  );
}
