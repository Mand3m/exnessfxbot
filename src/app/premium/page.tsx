import type { Metadata } from "next";
import { FeatureRow, OtherPackagePay, PremiumPicker } from "@/components/PremiumPicker";

export const metadata: Metadata = {
  title: "Premium",
  description:
    "Get the most out of Forex Trading Consultants signals. Early Access $40, 6 months $99, annual $199. Mentorship and student packages.",
};

export default function PremiumPage() {
  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-20">
        <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-4xl">
          Get the most out of the signals
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-white">
          Unlock exclusive features and maximize your trading efficiency
        </p>

        <FeatureRow />

        <div className="mt-12">
          <PremiumPicker />
        </div>

        <h2 className="mt-16 text-center text-2xl font-semibold text-[#e0b422]">
          Other packages
        </h2>
        <OtherPackagePay />
      </div>
    </div>
  );
}
