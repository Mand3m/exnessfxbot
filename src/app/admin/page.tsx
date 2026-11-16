import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/AdminLoginForm";
import { StaffConsole } from "@/components/StaffConsole";
import { getStaffSession, listUsers } from "@/lib/auth";
import { listPayments } from "@/lib/payments";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string; ok?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const q = await searchParams;
  const staff = await getStaffSession();
  if (!staff) {
    return (
      <div className="mx-auto max-w-md px-4 py-8 sm:py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Admin login</h1>
        <p className="mt-2 text-sm text-muted">
          Site admin only. Member Log in cannot open this page. This is not the
          local signal desk.
        </p>
        {q.error ? (
          <p className="mt-4 rounded-xl border border-red-400 bg-red-500/20 px-4 py-3 text-sm text-red-200">
            {q.error}
          </p>
        ) : null}
        <div className="mt-6">
          <AdminLoginForm />
        </div>
      </div>
    );
  }

  return (
    <StaffConsole
      users={listUsers()}
      payments={listPayments()}
      notice={q.ok}
      error={q.error}
    />
  );
}
