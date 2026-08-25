import type { Metadata } from "next";
import Link from "next/link";
import { ResendResetForm } from "@/components/ResendResetForm";

export const metadata: Metadata = { title: "Check your email" };

type Props = { searchParams: Promise<{ email?: string }> };

export default async function ForgotCheckEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {email ? (
          <>
            If an account exists for <span className="text-[#e0b422]">{email}</span>, tap the
            reset link we sent. Then choose a new password.
          </>
        ) : (
          <>If an account exists for that email, tap the reset link we sent.</>
        )}
      </p>
      <p className="mt-3 text-sm text-muted">
        If it is not in the inbox, check spam and Promotions. The link expires in 24 hours.
      </p>
      <ResendResetForm email={email || ""} />
      <p className="mt-4 text-sm text-muted">
        <Link href="/login" className="text-[#e0b422] underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
