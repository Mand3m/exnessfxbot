import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, userHasPack } from "@/lib/auth";
import { MENTORSHIP_MODULES } from "@/lib/mentorship-pack";
import { LogoutButton } from "@/components/LogoutButton";
import { NoticeCentre } from "@/components/NoticeCentre";
import { SHOW_PREMIUM } from "@/lib/site";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
      <dl className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-6 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">Name</dt>
          <dd>{user.name}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Email</dt>
          <dd>{user.email}</dd>
        </div>
        {SHOW_PREMIUM ? (
          <div className="flex justify-between">
            <dt className="text-muted">Plan</dt>
            <dd className="capitalize">{user.plan}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Beginner pack</dt>
          <dd>
            {userHasPack(user, "beginner")
              ? "Unlocked"
              : "Locked — pay $30, then wait for admin"}
          </dd>
        </div>
        {MENTORSHIP_MODULES.map((mod) => (
          <div className="flex justify-between gap-4" key={mod.id}>
            <dt className="text-muted">{mod.short}</dt>
            <dd>{userHasPack(user, mod.id) ? "Unlocked" : "Locked"}</dd>
          </div>
        ))}
      </dl>
      {SHOW_PREMIUM ? (
        <p className="mt-4 text-sm text-muted">
          {user.plan === "premium"
            ? "Premium is active. Cards are instant. New signals and stop-loss moves are emailed to you and listed below."
            : "You are on the regular plan (10-minute delay). Open Premium, pay a package, then wait for admin to confirm the deposit."}
        </p>
      ) : null}
      <p className="mt-2 text-sm text-muted">
        Course material opens only after admin unlocks it on this email. Register once, pay the pack,
        then wait for the desk.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <LogoutButton />
        <Link href="/students" className="inline-flex min-h-11 items-center text-sm text-[#e0b422] underline">
          Beginner pack
        </Link>
        <Link href="/mentorship" className="inline-flex min-h-11 items-center text-sm text-[#e0b422] underline">
          Mentorship
        </Link>
        {SHOW_PREMIUM ? (
          <Link href="/premium" className="inline-flex min-h-11 items-center text-sm text-[#e0b422] underline">
            Premium packages
          </Link>
        ) : null}
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-[#e0b422] underline">
          Signals
        </Link>
      </div>
      {user.plan === "premium" ? <NoticeCentre /> : null}
    </div>
  );
}
