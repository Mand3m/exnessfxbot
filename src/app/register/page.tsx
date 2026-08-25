import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { OTHER_PACKAGES, SIGNAL_PLANS } from "@/lib/packages";

export const metadata: Metadata = { title: "Join" };

type Props = { searchParams: Promise<{ pack?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const { pack } = await searchParams;
  const chosen =
    SIGNAL_PLANS.find((p) => p.id === pack) || OTHER_PACKAGES.find((p) => p.id === pack);

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-muted">
        {chosen
          ? `You chose ${chosen.name} — $${chosen.price} ${chosen.period}. Create the account, then the desk activates access after payment.`
          : "We will email you a verification link. After you confirm, you can log in, view your profile, and take a Premium plan."}
      </p>
      <div className="mt-6">
        <AuthForm mode="register" />
      </div>
      <p className="mt-4 text-sm text-muted">
        Already a member?{" "}
        <Link href="/login" className="text-[#e0b422] underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
