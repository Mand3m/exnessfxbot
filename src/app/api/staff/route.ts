import { NextResponse } from "next/server";
import { getStaffSession, grantPack, revokePack, setUserPlan } from "@/lib/auth";
import { isMaterialPack } from "@/lib/packages";
import { findMentorshipModule, MENTORSHIP_MODULES } from "@/lib/mentorship-pack";
import { decidePayment } from "@/lib/payments";

function back(query: string) {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: `/admin${query ? `?${query}` : ""}` },
  });
}

export async function POST(req: Request) {
  const staff = await getStaffSession();
  if (!staff) {
    return back("error=" + encodeURIComponent("Admin login required."));
  }

  const form = await req.formData();
  const action = String(form.get("action") || "");

  if (action === "paymentApprove" || action === "paymentReject") {
    const result = decidePayment(
      String(form.get("id") || ""),
      action === "paymentApprove" ? "approved" : "rejected"
    );
    if (!result.ok) {
      return back("error=" + encodeURIComponent(result.error));
    }
    const packName = result.payment.packName;
    const material = isMaterialPack(result.payment.packId);
    const mentorshipPay = result.payment.packId === "mentorship";
    return back(
      action === "paymentApprove"
        ? "ok=" +
            encodeURIComponent(
              mentorshipPay
                ? `Payment approved for ${result.payment.email}. Grant each mentorship material below.`
                : material
                  ? `Payment approved. ${packName} is unlocked on ${result.payment.email}.`
                  : "Payment approved. Member is premium and will get instant cards plus email alerts."
            )
        : "ok=Payment+rejected"
    );
  }

  if (action === "grantPack" || action === "revokePack") {
    const userId = String(form.get("userId") || "");
    const packId = String(form.get("packId") || "");
    if (!isMaterialPack(packId)) {
      return back("error=Unknown+material+pack");
    }
    const user = action === "grantPack" ? grantPack(userId, packId) : revokePack(userId, packId);
    if (!user) return back("error=Member+not+found");
    const mod = findMentorshipModule(packId);
    const label = mod ? mod.title : packId;
    return back(
      action === "grantPack"
        ? "ok=" + encodeURIComponent(`Unlocked ${label} for ${user.email}`)
        : "ok=" + encodeURIComponent(`Removed ${label} from ${user.email}`)
    );
  }

  if (action === "grantMentorshipAll" || action === "revokeMentorshipAll") {
    const userId = String(form.get("userId") || "");
    let email = "";
    if (action === "grantMentorshipAll") {
      const enrolled = grantPack(userId, "mentorship");
      if (!enrolled) return back("error=Member+not+found");
      email = enrolled.email;
      for (const mod of MENTORSHIP_MODULES) grantPack(userId, mod.id);
    } else {
      const enrolled = revokePack(userId, "mentorship");
      if (!enrolled) return back("error=Member+not+found");
      email = enrolled.email;
      for (const mod of MENTORSHIP_MODULES) revokePack(userId, mod.id);
    }
    return back(
      action === "grantMentorshipAll"
        ? "ok=" + encodeURIComponent(`Granted all four mentorship materials to ${email}`)
        : "ok=" + encodeURIComponent(`Revoked all mentorship materials from ${email}`)
    );
  }

  if (action === "setPlan") {
    setUserPlan(
      String(form.get("userId") || ""),
      String(form.get("plan")) === "premium" ? "premium" : "regular"
    );
    return back("ok=Member+updated");
  }

  return back("error=Unknown+action");
}
