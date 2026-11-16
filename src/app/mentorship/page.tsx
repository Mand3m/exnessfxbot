import type { Metadata } from "next";
import { MentorshipChrome, PackPitch } from "@/components/MentorshipDesk";
import { MentorshipClassroom } from "@/components/MentorshipClassroom";
import { getSession, userHasPack } from "@/lib/auth";
import { MENTORSHIP_MODULE_IDS } from "@/lib/mentorship-pack";

export const metadata: Metadata = {
  title: "Mentorship",
  description:
    "Mentorship materials: market structure, supply and demand, QM, and daily range. Admin unlocks each block after payment.",
};

export const dynamic = "force-dynamic";

export default async function MentorshipPage() {
  const session = await getSession();
  const enrolled =
    Boolean(session) && MENTORSHIP_MODULE_IDS.some((id) => userHasPack(session, id));

  return (
    <>
      <MentorshipChrome active="mentorship" />
      {enrolled && session ? (
        <MentorshipClassroom name={session.name} entitlements={session.entitlements} />
      ) : (
        <PackPitch packId="mentorship" initialUser={session} />
      )}
    </>
  );
}
