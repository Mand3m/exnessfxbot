import type { Metadata } from "next";
import { HustleLifestyle } from "@/components/HustleLifestyle";

export const metadata: Metadata = {
  title: "Hustle Lifestyle",
  description: "A visual look at how we do things — pattern recon and the secret life of fractals.",
};

export default function HustleLifestylePage() {
  return <HustleLifestyle />;
}