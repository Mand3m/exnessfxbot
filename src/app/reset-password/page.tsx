import type { Metadata } from "next";
import Link from "next/link";
import { peekResetToken } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export const metadata: Metadata = { title: "Reset password" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  const check = peekResetToken(String(token || ""));

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Choose a new password</h1>
      {check.ok ? (
        <>
          <p className="mt-2 text-sm text-muted">Enter the new password twice, then you can log in.</p>
          <div className="mt-6">
            <ResetPasswordForm token={String(token)} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 rounded-xl border border-red-400 bg-red-500/20 px-4 py-3 text-sm text-red-200">
            {check.error}
          </p>
          <p className="mt-4 text-sm text-muted">
            <Link href="/forgot-password" className="text-[#e0b422] underline">
              Request a new reset link
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
