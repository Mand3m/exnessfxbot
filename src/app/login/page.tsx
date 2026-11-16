import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ verified?: string; error?: string; reset?: string; pack?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const q = await searchParams;
  const joinQs = new URLSearchParams();
  if (q.pack) joinQs.set("pack", q.pack);
  if (q.next) joinQs.set("next", q.next);
  const joinHref = joinQs.size ? `/register?${joinQs.toString()}` : "/register";
  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Log in</h1>
      <p className="mt-2 text-sm text-muted">
        Use the email and password you registered with.
      </p>
      {q.verified ? (
        <p className="mt-4 rounded-xl border border-[#c9a227] bg-[#e0b422]/15 px-4 py-3 text-sm text-[#e0b422]">
          Your email has been verified. You can log in now.
        </p>
      ) : null}
      {q.reset ? (
        <p className="mt-4 rounded-xl border border-[#c9a227] bg-[#e0b422]/15 px-4 py-3 text-sm text-[#e0b422]">
          Password updated. Log in with the new password.
        </p>
      ) : null}
      {q.error ? (
        <p className="mt-4 rounded-xl border border-red-400 bg-red-500/20 px-4 py-3 text-sm text-red-200">
          {q.error}
        </p>
      ) : null}
      <div className="mt-6">
        <AuthForm mode="login" />
      </div>
      <p className="mt-4 text-sm text-muted">
        No account?{" "}
        <Link href={joinHref} className="text-[#e0b422] underline">
          Join
        </Link>
      </p>
    </div>
  );
}
