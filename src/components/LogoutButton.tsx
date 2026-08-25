"use client";

export function LogoutButton({ compact }: { compact?: boolean }) {
  async function logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      /* still leave the page */
    }
    window.location.assign("/");
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      className={
        compact
          ? "inline-flex min-h-11 items-center px-2 text-xs font-semibold text-white hover:underline"
          : "inline-flex min-h-11 items-center rounded-full bg-[#e0b422] px-5 py-2.5 text-sm font-semibold !text-black"
      }
    >
      Log out
    </button>
  );
}
