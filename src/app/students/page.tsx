import type { Metadata } from "next";
import { MentorshipChrome, PackPitch } from "@/components/MentorshipDesk";
import { BeginnerCourse } from "@/components/BeginnerCourse";
import { getSession, userHasPack } from "@/lib/auth";
import { STUDENT_SHARE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Beginner pack for students",
  description:
    "Student beginner pack: basic concepts, terms, risk, a practice entry idea, and basic execution. Register, pay $30, then admin unlocks the course.",
  alternates: { canonical: STUDENT_SHARE_URL },
};

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const session = await getSession();
  const unlocked = userHasPack(session, "beginner");

  return (
    <>
      <MentorshipChrome active="beginner" />
      {unlocked && session ? (
        <BeginnerCourse name={session.name} />
      ) : (
        <PackPitch packId="beginner" initialUser={session} />
      )}
    </>
  );
}
