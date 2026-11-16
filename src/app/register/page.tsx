import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { OTHER_PACKAGES, SIGNAL_PLANS } from "@/lib/packages";

export const metadata: Metadata = { title: "Join" };

type Props = { searchParams: Promise<{ pack?: string; next?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const { pack, next } = await searchParams;
  const chosen =
    SIGNAL_PLANS.find((p) => p.id === pack) || OTHER_PACKAGES.find((p) => p.id === pack);
  const loginQs = new URLSearchParams();
  if (pack) loginQs.set("pack", pack);
  if (next) loginQs.set("next", next);
  const loginHref = loginQs.size ? `/login?${loginQs.toString()}` : "/login";

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Create an account</h1>
      <p className="mt-2 text-sm text-muted">
        {chosen
          ? `You chose ${chosen.name} — $${chosen.price} ${chosen.period}. Register this email, pay, then admin unlocks the material on that email.`
          : "Every student needs an account. We email a verification link. After you confirm, pay the pack you want. Admin unlocks the material on this email only after payment."}
      </p>
      <div className="mt-6">
        <AuthForm mode="register" />
      </div>
      <p className="mt-4 text-sm text-muted">
        Already a member?{" "}
        <Link href={loginHref} className="text-[#e0b422] underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
