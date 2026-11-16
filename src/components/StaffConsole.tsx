import { isStaffUser, userHasPack, type PackEntitlement } from "@/lib/auth";
import { getMemberMt5ForPayment } from "@/lib/member-mt5";
import { MENTORSHIP_MODULES } from "@/lib/mentorship-pack";
import type { Payment } from "@/lib/payments";
import { StudentShareLink } from "@/components/StudentShareLink";

type Member = {
  id: string;
  name: string;
  email: string;
  contact?: string;
  plan: string;
  createdAt?: string;
  emailVerified?: boolean;
  role?: string;
  entitlements?: PackEntitlement[];
};

export function StaffConsole({
  users,
  payments,
  notice,
  error,
}: {
  users: Member[];
  payments: Payment[];
  notice?: string;
  error?: string;
}) {
  const pendingPays = payments.filter((p) => p.status === "pending").length;
  const students = users.filter((u) => !isStaffUser(u));

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Site admin for students, payments, and pack access. This is not the local signal desk.
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-400 bg-red-500/20 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-xl border border-[#c9a227] bg-[#e0b422]/15 px-4 py-3 text-sm text-[#e0b422]">
          {notice}
        </p>
      ) : null}

      <StudentShareLink />

      <section className="mt-8 space-y-3 rounded-2xl border-2 border-[#e0b422] bg-black/80 p-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#e0b422]">Payments</h2>
          <p className="mt-1 text-sm text-muted">
            {pendingPays
              ? `${pendingPays} waiting. Approve MoMo after it shows on MTN 593294 / Airtel 4366333. Approve BTC after it shows on bc1qsr8wlnjxklkzcc4tcc4pxeqgx8qu9gr0rs0elc.`
              : "No waiting deposits."}
          </p>
        </div>
        {payments.length === 0 ? (
          <p className="text-sm text-muted">No payment submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#c9a227]/60">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-sm leading-snug">
              <thead className="bg-black/70 text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2.5">When</th>
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Package</th>
                  <th className="px-3 py-2.5">Payer</th>
                  <th className="px-3 py-2.5">Network</th>
                  <th className="px-3 py-2.5">MT5</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5"> </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-[#c9a227]/40 align-top">
                    <td className="num px-3 py-2.5 text-xs">
                      {p.createdAt.replace("T", " ").slice(0, 16)}
                    </td>
                    <td className="px-3 py-2.5 text-xs break-words">
                      {p.email}
                      <span className="num mt-1 block">
                        {p.chargeCurrency === "UGX" && p.chargeAmount
                          ? `${p.chargeAmount.toLocaleString("en-UG")} UGX`
                          : `$${p.price}`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{p.packName}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {p.payerName}
                      <span className="num mt-1 block">{p.phone}</span>
                      {p.reference ? <span className="mt-1 block text-muted">Ref {p.reference}</span> : null}
                    </td>
                    <td className="px-3 py-2.5">{p.network}</td>
                    <td className="px-3 py-2.5 text-xs">
                      {(() => {
                        const mt5 = getMemberMt5ForPayment(p.id);
                        return mt5 ? (
                          <span>
                            {mt5.login} @{mt5.server}
                            <span className="mt-1 block text-muted">password saved</span>
                          </span>
                        ) : (
                          <span className="text-muted">not sent</span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${
                          p.status === "approved"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : p.status === "rejected"
                              ? "bg-red-500/15 text-red-400"
                              : "bg-amber-400/15 text-amber-300"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {p.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <form action="/api/staff" method="post">
                            <input type="hidden" name="action" value="paymentApprove" />
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="text-xs font-semibold text-emerald-400">
                              Approve
                            </button>
                          </form>
                          <form action="/api/staff" method="post">
                            <input type="hidden" name="action" value="paymentReject" />
                            <input type="hidden" name="id" value={p.id} />
                            <button type="submit" className="text-xs font-semibold text-red-400">
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-muted">
                          {p.decidedAt ? p.decidedAt.replace("T", " ").slice(0, 16) : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border-2 border-[#e0b422] bg-black/80 p-5 sm:p-6">
        <h2 className="text-2xl font-semibold text-[#e0b422]">Registered students</h2>
        <p className="mt-1 text-sm text-muted">
          Unlock beginner pack after they have paid. For mentorship, grant material 1, 2, 3, 4, or
          all four.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#c9a227]/60">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-black/70 text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Email</th>
                <th className="px-3 py-2.5">Registered</th>
                <th className="px-3 py-2.5">Access</th>
                <th className="px-3 py-2.5">Payment</th>
                <th className="px-3 py-2.5">Unlock material</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted">
                    No registered emails yet. Students join at /register or the beginner pack tab.
                  </td>
                </tr>
              )}
              {students.map((u) => {
                const beginnerOn = userHasPack(u, "beginner");
                const mentorOn = userHasPack(u, "mentorship");
                const modulesOn = MENTORSHIP_MODULES.filter((m) => userHasPack(u, m.id));
                const allMentorOn = modulesOn.length === MENTORSHIP_MODULES.length;
                const theirs = payments.filter((p) => p.userId === u.id);
                const pending = theirs.find((p) => p.status === "pending");
                const lastPay = theirs[0];
                return (
                  <tr key={u.id} className="border-t border-[#c9a227]/40 align-top">
                    <td className="px-3 py-3">
                      {u.name}
                      {u.contact ? (
                        <span className="num mt-1 block text-xs">{u.contact}</span>
                      ) : (
                        <span className="mt-1 block text-xs text-muted">No contact</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs break-all">{u.email}</td>
                    <td className="num px-3 py-3 text-xs">
                      {u.createdAt ? u.createdAt.replace("T", " ").slice(0, 16) : "—"}
                      <span className="mt-1 block text-muted">
                        {u.emailVerified ? "email verified" : "email not verified"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      <span className="block">
                        {beginnerOn ? "Beginner pack on" : "Beginner pack locked"}
                      </span>
                      <span className="mt-1 block">
                        {modulesOn.length
                          ? `Mentorship: ${modulesOn.map((m) => m.short).join(", ")}`
                          : mentorOn
                            ? "Mentorship enrolled"
                            : "Mentorship locked"}
                      </span>
                      <span className="mt-1 block capitalize text-muted">signals: {u.plan}</span>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {pending ? (
                        <span className="text-amber-300">
                          Waiting: {pending.packName} ${pending.price}
                        </span>
                      ) : lastPay ? (
                        <span>
                          {lastPay.status}: {lastPay.packName}
                        </span>
                      ) : (
                        <span className="text-muted">No payment yet</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col items-start gap-2">
                        <form action="/api/staff" method="post">
                          <input
                            type="hidden"
                            name="action"
                            value={beginnerOn ? "revokePack" : "grantPack"}
                          />
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="packId" value="beginner" />
                          <button type="submit" className="text-xs font-semibold text-[#e0b422] underline">
                            {beginnerOn ? "Revoke beginner pack" : "Unlock beginner pack"}
                          </button>
                        </form>
                        {MENTORSHIP_MODULES.map((mod) => {
                          const on = userHasPack(u, mod.id);
                          return (
                            <form action="/api/staff" method="post" key={mod.id}>
                              <input
                                type="hidden"
                                name="action"
                                value={on ? "revokePack" : "grantPack"}
                              />
                              <input type="hidden" name="userId" value={u.id} />
                              <input type="hidden" name="packId" value={mod.id} />
                              <button
                                type="submit"
                                className="text-xs font-semibold text-[#e0b422] underline"
                              >
                                {on ? `Revoke ${mod.short}` : `Grant ${mod.short}`}
                              </button>
                            </form>
                          );
                        })}
                        <form action="/api/staff" method="post">
                          <input
                            type="hidden"
                            name="action"
                            value={allMentorOn ? "revokeMentorshipAll" : "grantMentorshipAll"}
                          />
                          <input type="hidden" name="userId" value={u.id} />
                          <button type="submit" className="text-xs font-semibold text-[#e0b422] underline">
                            {allMentorOn ? "Revoke all four" : "Grant all four"}
                          </button>
                        </form>
                        <form action="/api/staff" method="post">
                          <input type="hidden" name="action" value="setPlan" />
                          <input type="hidden" name="userId" value={u.id} />
                          <input
                            type="hidden"
                            name="plan"
                            value={u.plan === "premium" ? "regular" : "premium"}
                          />
                          <button type="submit" className="text-xs font-semibold text-muted underline">
                            {u.plan === "premium" ? "Make signals regular" : "Make signals premium"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
