import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Verify your email" };

type Props = { searchParams: Promise<{ email?: string }> };

export default async function CheckEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Check your email</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {email ? (
          <>
            Tap the verification link we sent to <span className="text-[#e0b422]">{email}</span>.
            After that you can log in.
          </>
        ) : (
          <>Tap the verification link in your email. After that you can log in.</>
        )}
      </p>
      <p className="mt-3 text-sm text-muted">
        If it is not in the inbox, check spam. The link expires in 24 hours.
      </p>
      <p className="mt-4 text-sm text-muted">
        Already verified?{" "}
        <Link href="/login" className="text-[#e0b422] underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
