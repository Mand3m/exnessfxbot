import type { Metadata } from "next";
import { MentorshipChrome } from "@/components/MentorshipDesk";
import { InformationResources } from "@/components/InformationResources";
import { INFORMATION_SHARE_URL } from "@/lib/site";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Information resources",
  description:
    "Latest videos from the Forex Trading Consultants YouTube channel, alongside Mentorship and the Beginner pack.",
  alternates: { canonical: INFORMATION_SHARE_URL },
};

export default function InformationPage() {
  return (
    <>
      <MentorshipChrome active="information" />
      <InformationResources />
    </>
  );
}