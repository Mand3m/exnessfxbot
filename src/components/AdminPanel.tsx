"use client";

import { useState } from "react";
import { PAIRS } from "@/lib/pairs";
import type { Signal } from "@/lib/signals";

type Member = { id: string; email: string; name: string; plan: "regular" | "premium" };

type Mt5State = {
  config: {
    enabled: boolean;
    login: string;
    server: string;
    password: string;
    lot: number;
    deviation: number;
    symbolSuffix: string;
    terminalPath: string;
    hasPassword: boolean;
    linked: boolean;
  };
  status: {
    ok: boolean;
    connected: boolean;
    message: string;
    login?: number;
    server?: string;
    name?: string;
    balance?: number;
    equity?: number;
    updatedAt: string;
  } | null;
  jobs: {
    id: string;
    action: string;
    signalId: string;
    pair: string;
    side: string;
    status: string;
    ticket?: number;
    message?: string;
    createdAt: string;
  }[];
};

const emptyForm = {
  pair: "USDJPY",
  side: "buy",
  entry: "",
  takeProfit: "",
  stopLoss: "",
  openOnMt5: true,
};

const emptyMt5 = {
  enabled: false,
  login: "",
  server: "",
  password: "",
  lot: 0.01,
  deviation: 20,
  symbolSuffix: "",
  terminalPath: "",
};

export function AdminPanel() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [users, setUsers] = useState<Member[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [mt5, setMt5] = useState<Mt5State | null>(null);
  const [mt5Form, setMt5Form] = useState(emptyMt5);

  async function call(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim(), action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      if (json.signals) setSignals(json.signals);
      if (json.users) setUsers(json.users);
      if (json.mt5) {
        setMt5(json.mt5 as Mt5State);
        const cfg = (json.mt5 as Mt5State).config;
        setMt5Form({
          enabled: cfg.enabled,
          login: cfg.login,
          server: cfg.server,
          password: "",
          lot: cfg.lot,
          deviation: cfg.deviation,
          symbolSuffix: cfg.symbolSuffix,
          terminalPath: cfg.terminalPath,
        });
      }
      if (json.message) setNotice(json.message);
      setAuthed(true);
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      if (action === "list") setAuthed(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!authed && (
        <form
          className="flex flex-col gap-3 rounded-2xl border border-[#c9a227] bg-black/80 p-5 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            call("list");
          }}
        >
          <label className="block flex-1 text-sm">
            <span className="mb-1 block text-muted">Admin password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="rounded-full bg-[#e0b422] px-5 py-3 text-sm font-semibold !text-black disabled:opacity-50"
          >
            {busy ? "Unlocking…" : "Unlock desk"}
          </button>
        </form>
      )}
      {authed && (
        <div className="flex items-center justify-between rounded-2xl border border-[#c9a227] bg-black/80 px-4 py-3 text-sm">
          <p className="text-[#e0b422]">Desk unlocked</p>
          <button
            type="button"
            className="text-muted underline"
            onClick={() => call("list")}
          >
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-sell">{error}</p>}
      {notice && <p className="text-sm text-[#e0b422]">{notice}</p>}

      {authed && (
        <>
          <form
            className="space-y-4 rounded-2xl border border-[#c9a227] bg-black/80 p-5"
            onSubmit={(e) => {
              e.preventDefault();
              call("publish", {
                pair: form.pair,
                side: form.side,
                entry: Number(form.entry),
                takeProfit: Number(form.takeProfit),
                stopLoss: Number(form.stopLoss),
                openOnMt5: form.openOnMt5,
              }).then((j) => {
                if (j?.ok) {
                  setForm({
                    ...emptyForm,
                    pair: form.pair,
                    side: form.side,
                    openOnMt5: form.openOnMt5,
                  });
                }
              });
            }}
          >
            <div>
              <h2 className="font-semibold text-[#e0b422]">Live card panel</h2>
              <p className="mt-1 text-sm text-muted">
                Pick the pair, type SL / TP / Entry, then submit. That pair’s
                card updates for premium now and for regular members in 10 minutes.
              </p>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Pair</span>
              <select
                value={form.pair}
                onChange={(e) => setForm({ ...form, pair: e.target.value })}
                className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
              >
                {PAIRS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, side: "buy" })}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                  form.side === "buy" ? "bg-emerald-600 text-white" : "border border-border text-muted"
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, side: "sell" })}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${
                  form.side === "sell" ? "bg-red-600 text-white" : "border border-border text-muted"
                }`}
              >
                Sell
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                <span className="mb-1 block text-muted">SL price</span>
                <input
                  value={form.stopLoss}
                  onChange={(e) => setForm({ ...form, stopLoss: e.target.value })}
                  inputMode="decimal"
                  required
                  placeholder="Stop loss"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">TP price</span>
                <input
                  value={form.takeProfit}
                  onChange={(e) => setForm({ ...form, takeProfit: e.target.value })}
                  inputMode="decimal"
                  required
                  placeholder="Take profit"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Entry price</span>
                <input
                  value={form.entry}
                  onChange={(e) => setForm({ ...form, entry: e.target.value })}
                  inputMode="decimal"
                  required
                  placeholder="Entry"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#f3d56a]">
              <input
                type="checkbox"
                checked={form.openOnMt5}
                onChange={(e) => setForm({ ...form, openOnMt5: e.target.checked })}
              />
              Also open this trade on the linked MT5 account
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-[#e0b422] px-5 py-3 text-sm font-semibold !text-black disabled:opacity-50"
            >
              {busy ? "Publishing…" : "Submit to live card"}
            </button>
          </form>

          <section className="space-y-4 rounded-2xl border border-[#c9a227] bg-black/80 p-5">
            <div>
              <h2 className="font-semibold text-[#e0b422]">Link MT5 account</h2>
              <p className="mt-1 text-sm text-muted">
                The site still publishes the card as usual. If this link is enabled and
                the executor is running, it also places the same Entry / SL / TP on
                your MetaTrader 5 account. Open MT5, turn on Algo Trading, then run
                {" "}
                <code className="rounded bg-black px-1">scripts/start-mt5-executor.cmd</code>.
                Use the master password, not the investor password.
              </p>
            </div>
            {mt5?.status ? (
              <p className="rounded-xl border border-[#c9a227] bg-black/60 px-3 py-2 text-sm">
                {mt5.status.connected
                  ? `Executor connected: ${mt5.status.login || "account"} @ ${mt5.status.server || "MT5"} · balance ${mt5.status.balance ?? "—"}`
                  : mt5.status.message}
              </p>
            ) : (
              <p className="text-sm text-muted">
                Executor not seen yet. Start the script after MT5 is logged in.
              </p>
            )}
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                call("mt5Save", {
                  enabled: mt5Form.enabled,
                  login: mt5Form.login,
                  server: mt5Form.server,
                  mt5Password: mt5Form.password,
                  lot: mt5Form.lot,
                  deviation: mt5Form.deviation,
                  symbolSuffix: mt5Form.symbolSuffix,
                  terminalPath: mt5Form.terminalPath,
                });
              }}
            >
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 flex items-center gap-2 text-muted">
                  <input
                    type="checkbox"
                    checked={mt5Form.enabled}
                    onChange={(e) => setMt5Form({ ...mt5Form, enabled: e.target.checked })}
                  />
                  Enable auto-open when I submit a signal
                </span>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">MT5 login</span>
                <input
                  value={mt5Form.login}
                  onChange={(e) => setMt5Form({ ...mt5Form, login: e.target.value })}
                  inputMode="numeric"
                  placeholder="123456789"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Server</span>
                <input
                  value={mt5Form.server}
                  onChange={(e) => setMt5Form({ ...mt5Form, server: e.target.value })}
                  placeholder="Exness-MT5Trial8"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">
                  Password {mt5?.config.hasPassword ? "(saved — leave blank to keep)" : ""}
                </span>
                <input
                  type="password"
                  value={mt5Form.password}
                  onChange={(e) => setMt5Form({ ...mt5Form, password: e.target.value })}
                  autoComplete="off"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Lot size</span>
                <input
                  value={mt5Form.lot}
                  onChange={(e) => setMt5Form({ ...mt5Form, lot: Number(e.target.value) })}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Symbol suffix (optional)</span>
                <input
                  value={mt5Form.symbolSuffix}
                  onChange={(e) => setMt5Form({ ...mt5Form, symbolSuffix: e.target.value })}
                  placeholder="m  or  .pro"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-muted">Max slippage (points)</span>
                <input
                  value={mt5Form.deviation}
                  onChange={(e) => setMt5Form({ ...mt5Form, deviation: Number(e.target.value) })}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="mb-1 block text-muted">terminal64.exe path (optional)</span>
                <input
                  value={mt5Form.terminalPath}
                  onChange={(e) => setMt5Form({ ...mt5Form, terminalPath: e.target.value })}
                  placeholder="C:\Program Files\MetaTrader 5\terminal64.exe"
                  className="w-full rounded-xl border border-[#c9a227] bg-white px-3 py-3 text-black"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-[#e0b422] px-5 py-3 text-sm font-semibold !text-black disabled:opacity-50 sm:col-span-2"
              >
                {busy ? "Saving…" : "Save MT5 link"}
              </button>
            </form>
            {mt5?.jobs.length ? (
              <div className="overflow-x-auto">
                <p className="mb-2 text-xs uppercase text-muted">Recent MT5 jobs</p>
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-muted">
                    <tr>
                      <th className="py-2">When</th>
                      <th className="py-2">Action</th>
                      <th className="py-2">Pair</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Ticket</th>
                      <th className="py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mt5.jobs.map((job) => (
                      <tr key={job.id} className="border-t border-border">
                        <td className="py-2 text-xs">{job.createdAt.replace("T", " ").slice(0, 19)}</td>
                        <td className="py-2">{job.action}</td>
                        <td className="py-2">{job.pair}</td>
                        <td className="py-2">{job.status}</td>
                        <td className="num py-2">{job.ticket || "—"}</td>
                        <td className="py-2 text-xs text-muted">{job.message || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-card-2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Pair</th>
                  <th className="px-3 py-2">Side</th>
                  <th className="px-3 py-2">Entry</th>
                  <th className="px-3 py-2">TP</th>
                  <th className="px-3 py-2">SL</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="px-3 py-3 font-medium">{s.pair}</td>
                    <td className="px-3 py-3 uppercase">{s.side}</td>
                    <td className="num px-3 py-3">{s.entry}</td>
                    <td className="num px-3 py-3">{s.takeProfit}</td>
                    <td className="num px-3 py-3">{s.stopLoss}</td>
                    <td className="px-3 py-3">{s.status}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2 text-xs font-semibold">
                        <button type="button" className="text-buy" onClick={() => call("resolve", { id: s.id, status: "filled" })}>
                          Fill
                        </button>
                        <button type="button" className="text-warn" onClick={() => call("resolve", { id: s.id, status: "cancelled" })}>
                          Cancel
                        </button>
                        <button type="button" className="text-sell" onClick={() => call("delete", { id: s.id })}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-semibold">Members</h2>
            <p className="mt-1 text-sm text-muted">
              Regular accounts see prices 10 minutes late. Premium accounts see
              the desk the moment you submit.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted">
                  <tr>
                    <th className="py-2">Name</th>
                    <th className="py-2">Email</th>
                    <th className="py-2">Plan</th>
                    <th className="py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-muted">
                        No members yet. They register at /register.
                      </td>
                    </tr>
                  )}
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="py-3">{u.name}</td>
                      <td className="py-3">{u.email}</td>
                      <td className="py-3 capitalize">{u.plan}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-[#e0b422] underline"
                          onClick={() =>
                            call("setPlan", {
                              userId: u.id,
                              plan: u.plan === "premium" ? "regular" : "premium",
                            })
                          }
                        >
                          {u.plan === "premium" ? "Make regular" : "Make premium"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
