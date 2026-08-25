import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Forgot password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the email on your account. We will send a reset link to that inbox.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-4 text-sm text-muted">
        Remember it?{" "}
        <Link href="/login" className="text-[#e0b422] underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
