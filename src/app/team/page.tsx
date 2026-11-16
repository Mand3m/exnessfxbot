import type { Metadata } from "next";
import { MeetTeam } from "@/components/MeetTeam";
import { TEAM_SHARE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Meet the Team",
  description:
    "Meet the Forex Trading Consultants desk: Maumbe George, Amos Mugembe, and Namabako Joshua. Education, operations, signals, and social, with 24 years of trading experience.",
  alternates: { canonical: TEAM_SHARE_URL },
};

export default function TeamPage() {
  return <MeetTeam />;
}
