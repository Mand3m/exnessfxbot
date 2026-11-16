"use client";

import { useEffect, useState } from "react";

type Fib = {
  at: string;
  ok?: boolean;
  reason?: string;
  symbol?: string;
  pair?: string;
  entry: number;
  stopLoss: number;
  takeProfit?: number;
  side?: "buy" | "sell";
  source?: "fib" | "order";
  alreadyLive?: boolean;
  kind?: string;
  ticket?: number;
};

type Book = {
  fib: Fib | null;
  pairs: Record<string, Fib>;
  order: Fib | null;
  orders: Record<string, Fib>;
};

function selectedPair() {
  return document.querySelector<HTMLSelectElement>('select[name="pair"]')?.value || "";
}

function pairOf(row: Fib | null | undefined): string {
  if (!row) return "";
  if (row.pair) return row.pair;
  const s = String(row.symbol || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  for (const id of ["XAUUSD", "GBPJPY", "USDJPY", "EURUSD"]) {
    if (s.includes(id)) return id;
  }
  return "";
}

function rowForPair(book: Book, pair: string): Fib | null {
  const mapped = book.pairs?.[pair];
  if (mapped && mapped.ok !== false && mapped.entry > 0) return mapped;
  if (book.fib && book.fib.ok !== false && pairOf(book.fib) === pair && book.fib.entry > 0) {
    return book.fib;
  }
  return null;
}

function orderForPair(book: Book, pair: string): Fib | null {
  const mapped = book.orders?.[pair];
  if (mapped && mapped.ok !== false && mapped.entry > 0) return mapped;
  if (book.order && book.order.ok !== false && pairOf(book.order) === pair && book.order.entry > 0) {
    return book.order;
  }
  return null;
}

function pickRow(book: Book, selected: string): { row: Fib | null; pair: string; fromOrder: boolean } {
  const selectedOrder = orderForPair(book, selected);
  if (selectedOrder) return { row: selectedOrder, pair: selected, fromOrder: true };

  const selectedFib = rowForPair(book, selected);
  if (selectedFib) return { row: selectedFib, pair: selected, fromOrder: false };

  const latestOrder = book.order && book.order.ok !== false && book.order.entry > 0 ? book.order : null;
  if (latestOrder) {
    const p = pairOf(latestOrder) || selected;
    return { row: latestOrder, pair: p, fromOrder: true };
  }

  const latestFib = book.fib && book.fib.ok !== false && book.fib.entry > 0 ? book.fib : null;
  if (latestFib) {
    const p = pairOf(latestFib) || selected;
    return { row: latestFib, pair: p, fromOrder: false };
  }

  return { row: null, pair: selected, fromOrder: false };
}

/** Copies Fib 0.5 → Entry / Fib 1.0 → SL, or live MT5 limit/market prices, onto the desk form. */
export function FibAutofill() {
  const [note, setNote] = useState("Desk: waiting for MT5…");

  useEffect(() => {
    let live = true;
    let book: Book = { fib: null, pairs: {}, order: null, orders: {} };
    let applied = { pair: "", key: "" };

    function publishForm() {
      const action = document.querySelector<HTMLInputElement>(
        'form[action="/api/admin/desk"] input[name="action"][value="publish"]'
      );
      return action?.form || document.querySelector<HTMLInputElement>('input[name="entry"]')?.form || null;
    }

    function setOpenOnMt5(checked: boolean) {
      const form = publishForm();
      if (!form) return;
      const box =
        form.querySelector<HTMLInputElement>('input[name="openOnMt5"]') ||
        document.querySelector<HTMLInputElement>("#openOnMt5");
      if (!box) return;
      if (box.checked !== checked) {
        box.checked = checked;
        box.dispatchEvent(new Event("change", { bubbles: true }));
        box.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    function setAlreadyLive(isLive: boolean, ticket?: number) {
      const form = publishForm();
      if (!form) return;
      const liveEl =
        form.querySelector<HTMLInputElement>('input[name="alreadyLive"]') ||
        document.querySelector<HTMLInputElement>("#alreadyLive");
      const ticketEl =
        form.querySelector<HTMLInputElement>('input[name="mt5Ticket"]') ||
        document.querySelector<HTMLInputElement>("#mt5Ticket");
      if (liveEl) liveEl.value = isLive ? "1" : "";
      if (ticketEl) ticketEl.value = isLive && ticket && ticket > 0 ? String(ticket) : "";
    }

    function apply(entry: number, sl: number, tp: number, side?: string, pair?: string) {
      const form = publishForm();
      if (!form) return;
      if (pair) {
        const sel = form.querySelector<HTMLSelectElement>('select[name="pair"]');
        if (sel && sel.value !== pair) {
          sel.value = pair;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
      const entryEl = form.querySelector<HTMLInputElement>('input[name="entry"]');
      const slEl = form.querySelector<HTMLInputElement>('input[name="stopLoss"]');
      const tpEl = form.querySelector<HTMLInputElement>('input[name="takeProfit"]');
      if (entryEl) {
        entryEl.value = String(entry);
        entryEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (slEl) {
        slEl.value = String(sl);
        slEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (tpEl && tp > 0) {
        tpEl.value = String(tp);
        tpEl.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (side === "buy" || side === "sell") {
        const radio = form.querySelector<HTMLInputElement>(`input[name="side"][value="${side}"]`);
        if (radio) radio.checked = true;
      }
    }

    function sync() {
      const selected = selectedPair();
      const { row, pair, fromOrder } = pickRow(book, selected);
      if (!row || row.ok === false || !(Number(row.entry) > 0)) {
        const anyFib = Object.values(book.pairs || {}).some((p) => p && p.ok !== false && p.entry > 0);
        const anyOrder = Object.values(book.orders || {}).some((p) => p && p.ok !== false && p.entry > 0);
        if (!book.fib && !book.order && !anyFib && !anyOrder) {
          setNote("Desk: not running. Attach FibToDesk to each MT5 chart (or run DeskAgent).");
          return;
        }
        setAlreadyLive(false);
        setNote(
          `Desk: no ${selected || "pair"} fib or manual order yet. Draw Fibonacci, or place a limit/market with SL/TP.`
        );
        return;
      }
      const tp =
        Number(row.takeProfit) > 0
          ? Number(row.takeProfit)
          : Number(row.entry) + 2.5 * (Number(row.entry) - Number(row.stopLoss));
      const key = `${fromOrder ? "order" : "fib"}|${row.entry}|${row.stopLoss}|${tp}|${row.at}|${row.ticket || ""}`;
      if (applied.pair !== pair || applied.key !== key) {
        applied = { pair, key };
        apply(Number(row.entry), Number(row.stopLoss), tp, row.side, pair);
        const isLive = fromOrder || Boolean(row.alreadyLive);
        setOpenOnMt5(!isLive);
        setAlreadyLive(isLive, Number(row.ticket) > 0 ? Number(row.ticket) : undefined);
      }
      if (fromOrder || row.alreadyLive) {
        const kind = row.kind || "order";
        setNote(
          `Live ${kind} ${pair}: Entry ${row.entry} · SL ${row.stopLoss} · TP ${tp}` +
            `${row.ticket ? ` · #${row.ticket}` : ""} — Submit sends cards only (MT5 already open).`
        );
      } else {
        setNote(
          `Fib ${pair}: 0.5 → Entry ${row.entry} · 100 → SL ${row.stopLoss} · TP 2.5R ${tp}` +
            `${row.symbol ? ` · ${row.symbol}` : ""}`
        );
      }
    }

    async function tick() {
      if (!live) return;
      try {
        const res = await fetch("/api/admin/fib", { cache: "no-store" });
        const json = await res.json();
        book = {
          fib: json.fib || null,
          pairs: json.pairs || {},
          order: json.order || null,
          orders: json.orders || {},
        };
        sync();
      } catch {
        setNote("Desk: could not read the MT5 Common Files.");
      }
    }

    const select = document.querySelector<HTMLSelectElement>('select[name="pair"]');
    const onPair = () => sync();
    select?.addEventListener("change", onPair);

    tick();
    const id = window.setInterval(tick, 800);
    return () => {
      live = false;
      window.clearInterval(id);
      select?.removeEventListener("change", onPair);
    };
  }, []);

  return <p className="mt-3 text-xs text-[#d4b84a]">{note}</p>;
}
