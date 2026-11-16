import type { Metadata } from "next";
import { HomeLanding } from "@/components/HomeLanding";
import { DESK_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: DESK_NAME + " - Follow the money",
  description:
    "Forex Trading Consultants: mentorship, structure, risk, and execution culture for traders who want to think like the skilled minority.",
};

export default function HomePage() {
  return <HomeLanding />;
}