import type { Metadata } from "next";
import { JournalClub } from "@/components/JournalClub";
import { JOURNAL_CLUB_SHARE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Forex Traders' Journal Club",
  description:
    "Coming soon: a small weekly meeting where pro traders walk through the process, thinking and execution behind their trades, and how they handle the emotional side. Join the waitlist.",
  alternates: { canonical: JOURNAL_CLUB_SHARE_URL },
};

export default function JournalClubPage() {
  return <JournalClub />;
}
