import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { NoticeCentre } from "@/components/NoticeCentre";

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
        <div className="flex justify-between">
          <dt className="text-muted">Plan</dt>
          <dd className="capitalize">{user.plan}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-muted">
        {user.plan === "premium"
          ? "Premium is active. Cards are instant. New signals and stop-loss moves are emailed to you and listed below."
          : "You are on the regular plan (10-minute delay). Open Premium, pay a package, then wait for admin to confirm the deposit."}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <LogoutButton />
        <Link href="/premium" className="inline-flex min-h-11 items-center text-sm text-[#e0b422] underline">
          Premium packages
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center text-sm text-[#e0b422] underline">
          Signals
        </Link>
      </div>
      {user.plan === "premium" ? <NoticeCentre /> : null}
    </div>
  );
}
