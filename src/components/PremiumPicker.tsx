"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BTC_ADDRESS, MERCHANTS, OTHER_PACKAGES, SIGNAL_PLANS } from "@/lib/packages";
import type { PayNetwork } from "@/lib/payments";
import { DEFAULT_RISK_PCT, RISK_TIERS } from "@/lib/calc";

type Session = { id: string; name: string; email: string; plan: "regular" | "premium" };
type Pack = { id: string; name: string; price: number; period?: string };

export function PremiumPicker() {
  const [picked, setPicked] = useState<(typeof SIGNAL_PLANS)[number]["id"]>("monthly");
  const [user, setUser] = useState<Session | null | undefined>(undefined);
  const [payPack, setPayPack] = useState<Pack | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => setUser(j.user || null))
      .catch(() => setUser(null));
  }, []);

  const loggedIn = Boolean(user);

  return (
    <div
      id="pay"
      className="scroll-mt-20 rounded-3xl border border-[#c9a227] bg-black/70 px-4 py-6 sm:rounded-[28px] sm:px-10 sm:py-10"
    >
      <h2 className="text-center text-2xl font-semibold tracking-tight text-[#e0b422] sm:text-3xl">
        Algo-Sniper Subscription
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-sm text-[#d4b84a]">
        This subscription is for account management.
      </p>
      <p className="mx-auto mt-2 max-w-xl text-center text-sm font-semibold text-[#e0b422]">
        Note: The Bot is not for sale.
      </p>
      {loggedIn ? (
        <p className="mt-2 text-center text-sm text-[#d4b84a]">
          Signed in as {user?.name}. Pay a package below. Admin confirms the deposit, then cards
          are instant and emails go out with each signal.
        </p>
      ) : null}

      <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
        {SIGNAL_PLANS.map((plan) => {
          const active = picked === plan.id;
          return (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 px-4 py-6 text-center ${
                active
                  ? "border-[#e0b422] bg-[#e0b422]/15"
                  : "border-[#6b5a20] bg-black/40"
              }`}
            >
              <button type="button" className="w-full" onClick={() => setPicked(plan.id)}>
                <p className="text-lg font-semibold text-[#e0b422]">{plan.name}</p>
                <p className="num mt-3 text-4xl font-semibold text-[#f3d56a]">${plan.price}</p>
                <p className="mt-2 text-sm text-[#d4b84a]">${plan.perDay.toFixed(2)} / day</p>
              </button>
              {loggedIn ? (
                <button
                  type="button"
                  onClick={() => setPayPack(plan)}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#e0b422] px-4 py-2.5 text-sm font-semibold !text-black"
                >
                  Pay ${plan.price}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {user === undefined ? (
        <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-[#d4b84a]">Checking account…</p>
      ) : user ? (
        user.plan === "premium" ? (
          <p className="mx-auto mt-8 max-w-3xl rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-sm text-emerald-300">
            Premium is on. You already see live cards. Pay again to extend the term.
          </p>
        ) : (
          <p className="mx-auto mt-8 max-w-3xl rounded-xl border border-[#e0b422]/50 bg-[#e0b422]/10 px-4 py-3 text-center text-sm text-[#f3d56a]">
            After you pay, wait for admin approval. Then the 10-minute delay is removed.
          </p>
        )
      ) : (
        <>
          <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-[#e0b422]/50 bg-[#e0b422]/10 px-4 py-3 text-center text-sm text-[#f3d56a]">
            ⚠ Log in or register to pay for a package.
          </div>
          <div className="mx-auto mt-5 grid max-w-3xl gap-3 sm:grid-cols-2">
            <Link
              href={`/login?pack=${picked}`}
              className="inline-flex items-center justify-center rounded-xl bg-[#e0b422] px-5 py-3.5 text-base font-semibold !text-black"
            >
              Login
            </Link>
            <Link
              href={`/register?pack=${picked}`}
              className="inline-flex items-center justify-center rounded-xl bg-[#e0b422] px-5 py-3.5 text-base font-semibold !text-black"
            >
              Register
            </Link>
          </div>
        </>
      )}

      {payPack ? (
        <PayDialog
          pack={payPack}
          defaultName={user?.name || ""}
          onClose={() => setPayPack(null)}
        />
      ) : null}
    </div>
  );
}

export function OtherPackagePay() {
  const [user, setUser] = useState<Session | null | undefined>(undefined);
  const [payPack, setPayPack] = useState<Pack | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => setUser(j.user || null))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user === undefined) return;
    const pay = new URLSearchParams(window.location.search).get("pay");
    if (!pay) return;
    const pack = OTHER_PACKAGES.find((p) => p.id === pay);
    if (!pack) return;
    if (user) {
      setPayPack(pack);
      return;
    }
    window.location.replace(`/login?pack=${pack.id}`);
  }, [user]);

  return (
    <>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {OTHER_PACKAGES.map((pack) => (
          <article
            key={pack.id}
            className="flex flex-col rounded-2xl border border-[#c9a227] bg-black/60 p-6"
          >
            <h3 className="text-lg font-semibold text-[#e0b422]">{pack.name}</h3>
            <p className="num mt-3 text-3xl font-semibold text-[#f3d56a]">
              ${pack.price}
              <span className="ml-1 text-sm font-normal text-[#d4b84a]">{pack.period}</span>
            </p>
            <p className="mt-3 flex-1 text-sm text-[#d4b84a]">{pack.blurb}</p>
            {user ? (
              <button
                type="button"
                onClick={() => setPayPack(pack)}
                className="mt-5 inline-flex justify-center rounded-xl bg-[#e0b422] px-4 py-2.5 text-sm font-semibold !text-black"
              >
                Pay ${pack.price}
              </button>
            ) : user === undefined ? (
              <p className="mt-5 text-center text-xs text-[#d4b84a]">Checking account…</p>
            ) : (
              <Link
                href={`/login?pack=${pack.id}`}
                className="mt-5 inline-flex justify-center rounded-xl bg-[#e0b422] px-4 py-2.5 text-sm font-semibold !text-black"
              >
                Log in to pay
              </Link>
            )}
          </article>
        ))}
      </div>
      {payPack ? (
        <PayDialog pack={payPack} defaultName={user?.name || ""} onClose={() => setPayPack(null)} />
      ) : null}
    </>
  );
}

function PayDialog({
  pack,
  defaultName,
  onClose,
}: {
  pack: Pack;
  defaultName: string;
  onClose: () => void;
}) {
  const [payerName, setPayerName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState<PayNetwork>("MTN");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [mt5Token, setMt5Token] = useState("");
  const [copied, setCopied] = useState(false);
  const crypto = network === "BTC";
  const code = !crypto ? MERCHANTS[network] : "";

  async function copyBtc() {
    try {
      await navigator.clipboard.writeText(BTC_ADDRESS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          payerName,
          phone,
          network,
          reference,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not submit");
      setDone(json.message || "Submitted for approval.");
      setMt5Token(typeof json.mt5Token === "string" ? json.mt5Token : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-2 border-[#e0b422] bg-black p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-[#f3d56a] shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-[#e0b422]">Pay {pack.name}</h3>
            <p className="num mt-1 text-sm text-[#d4b84a]">${pack.price}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center text-sm text-[#d4b84a] underline"
          >
            Close
          </button>
        </div>

        {done ? (
          <div className="mt-5 space-y-4">
            <p className="text-sm leading-relaxed text-emerald-300">{done}</p>
            {mt5Token ? (
              <Mt5LinkForm token={mt5Token} defaultLabel={defaultName} />
            ) : null}
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <p className="text-sm leading-relaxed text-[#d4b84a]">
              {crypto
                ? "International clients: send Bitcoin to the address below, then paste the transaction ID and submit. Admin confirms it on the desk. After approval you get instant cards and an email on every new signal."
                : "Enter the name and number you will pay from. Send the deposit to the merchant code for your network. Each merchant code is registered in the name of EXNESS FX TRADING CONSULTANTS LTD. Then submit. Admin confirms it on the desk. After approval you get instant cards and an email on every new signal."}
            </p>
            <div className="flex flex-wrap gap-2">
              {(["MTN", "Airtel", "BTC"] as const).map((net) => (
                <button
                  key={net}
                  type="button"
                  onClick={() => setNetwork(net)}
                  className={`min-h-11 flex-1 rounded-xl px-2 py-2.5 text-sm font-semibold ${
                    network === net
                      ? "bg-[#e0b422] !text-black"
                      : "border border-[#c9a227] text-[#d4b84a]"
                  }`}
                >
                  {net === "BTC" ? "BTC · International" : net}
                </button>
              ))}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-[#d4b84a]">
                {crypto ? "Your name" : "Name on the MoMo account"}
              </span>
              <input
                required
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                className="w-full rounded-xl border border-[#c9a227] bg-black px-3 py-3"
              />
            </label>
            {crypto ? null : (
              <label className="block text-sm">
                <span className="mb-1 block text-[#d4b84a]">Mobile number</span>
                <input
                  required
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07…"
                  className="w-full rounded-xl border border-[#c9a227] bg-black px-3 py-3"
                />
              </label>
            )}
            {crypto ? (
              <div className="rounded-xl border border-[#c9a227] bg-black/60 px-4 py-3 text-sm">
                <p className="font-semibold text-[#e0b422]">Bitcoin (BTC) · international</p>
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#c9a227] bg-black px-3 py-2">
                  <p className="num min-w-0 flex-1 break-all text-xs text-[#f3d56a]">{BTC_ADDRESS}</p>
                  <button
                    type="button"
                    onClick={() => void copyBtc()}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#c9a227] text-[#e0b422]"
                    aria-label={copied ? "Copied" : "Copy Bitcoin address"}
                    title={copied ? "Copied" : "Copy address"}
                  >
                    {copied ? (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15V5h10" />
                      </svg>
                    )}
                  </button>
                </div>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-[#d4b84a]">
                  <li>Send BTC equal to ${pack.price} USD to that address.</li>
                  <li>Wait for the transaction to broadcast.</li>
                  <li>Paste the transaction ID below and submit.</li>
                  <li>Admin confirms receipt, then premium starts.</li>
                </ol>
              </div>
            ) : (
              <div className="rounded-xl border border-[#c9a227] bg-black/60 px-4 py-3 text-sm">
                <p className="font-semibold text-[#e0b422]">
                  {network} merchant code: <span className="num">{code}</span>
                </p>
                <p className="mt-1 text-xs text-[#d4b84a]">
                  Name on the merchant: EXNESS FX TRADING CONSULTANTS LTD
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[#d4b84a]">
                  <li>Open {network} money on that number.</li>
                  <li>
                    Pay / deposit to merchant code {code} (EXNESS FX TRADING CONSULTANTS LTD).
                  </li>
                  <li>
                    Send ${pack.price} (or the UGX equivalent). Keep the confirmation.
                  </li>
                  <li>Submit this form. Admin approves, then premium starts.</li>
                </ol>
              </div>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-[#d4b84a]">
                {crypto ? "Bitcoin transaction ID" : "Confirmation / reference (optional)"}
              </span>
              <input
                required={crypto}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={crypto ? "txid" : ""}
                className="w-full rounded-xl border border-[#c9a227] bg-black px-3 py-3"
              />
            </label>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[#e0b422] px-5 py-3 text-sm font-semibold !text-black disabled:opacity-50"
            >
              {busy ? "Submitting…" : "Submit to admin"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Mt5LinkForm({ token, defaultLabel }: { token: string; defaultLabel: string }) {
  const field =
    "w-full rounded-xl border border-[#c9a227] bg-black px-3 py-3 text-[#f3d56a]";
  const [label, setLabel] = useState(defaultLabel || "My MT5");
  const [login, setLogin] = useState("");
  const [server, setServer] = useState("");
  const [password, setPassword] = useState("");
  const [riskPct, setRiskPct] = useState(String(DEFAULT_RISK_PCT));
  const [suffix, setSuffix] = useState("");
  const [deviation, setDeviation] = useState("20");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/mt5", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mt5Token: token,
          label,
          login,
          server,
          password,
          riskPct: Number(riskPct),
          symbolSuffix: suffix,
          deviation: Number(deviation),
        }),
      });
      const json = await res.json();
      setPassword("");
      if (!res.ok) throw new Error(json.error || "Could not save MT5 details.");
      setOk(json.message || "MT5 details saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save MT5 details.");
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return <p className="text-sm leading-relaxed text-emerald-300">{ok}</p>;
  }

  return (
    <form className="space-y-3" onSubmit={submit} autoComplete="off">
      <h4 className="text-lg font-semibold text-[#e0b422]">Link your MT5 account</h4>
      <p className="text-sm text-[#d4b84a]">
        This subscription is for account management. Enter the same MT5 login the desk will trade.
        Sent over your logged-in session only. The password is encrypted on the server.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Label</span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={field} maxLength={40} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">MT5 login</span>
          <input
            required
            inputMode="numeric"
            autoComplete="off"
            value={login}
            onChange={(e) => setLogin(e.target.value.replace(/\D/g, "").slice(0, 12))}
            className={field}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Server</span>
          <input
            required
            autoComplete="off"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="Exness-MT5Trial8"
            className={field}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Password</span>
          <input
            required
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Risk per trade</span>
          <select value={riskPct} onChange={(e) => setRiskPct(e.target.value)} className={field}>
            {RISK_TIERS.map((tier) => (
              <option key={tier.pct} value={tier.pct}>
                {tier.label} · {tier.pct}%
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-semibold text-[#e0b422]">Symbol suffix</span>
          <input
            autoComplete="off"
            value={suffix}
            onChange={(e) => setSuffix(e.target.value.slice(0, 12))}
            placeholder="z  or  .pro"
            className={field}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block font-semibold text-[#e0b422]">Max slippage</span>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={deviation}
            onChange={(e) => setDeviation(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className={field}
          />
        </label>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-[#e0b422] px-5 py-3 text-sm font-semibold !text-black disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save MT5 details"}
      </button>
    </form>
  );
}

function Icon({ name }: { name: "bolt" | "shield" | "mail" }) {
  if (name === "bolt") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M13 2 4 14h7l-1 8 10-14h-7l0-6z" fill="#e0b422" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3z"
          stroke="#e0b422"
          strokeWidth="1.8"
        />
        <path d="M9 12l2 2 4-4" stroke="#e0b422" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="#e0b422" strokeWidth="1.8" />
      <path d="M4 7l8 6 8-6" stroke="#e0b422" strokeWidth="1.8" />
    </svg>
  );
}

export function FeatureRow() {
  const items = [
    { icon: "bolt" as const, title: "Instant Access", text: "Immediate access to signals on the site" },
    { icon: "shield" as const, title: "No Ads", text: "Pure experience without distractions" },
    { icon: "mail" as const, title: "Email Notifications", text: "Real-time notifications for every new signal" },
  ];
  return (
    <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="rounded-2xl border border-[#c9a227] bg-black/55 px-5 py-7 text-center"
        >
          <div className="flex justify-center">
            <Icon name={item.icon} />
          </div>
          <h3 className="mt-3 font-semibold text-[#e0b422]">{item.title}</h3>
          <p className="mt-1 text-sm text-[#d4b84a]">{item.text}</p>
        </div>
      ))}
    </div>
  );
}
