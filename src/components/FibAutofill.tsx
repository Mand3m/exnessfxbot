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
};

type Book = { fib: Fib | null; pairs: Record<string, Fib> };

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

/** Copies Fib 0.5 → Entry and Fib 1.0 → SL for the pair selected on the desk. */
export function FibAutofill() {
  const [note, setNote] = useState("Fib: waiting for MT5…");

  useEffect(() => {
    let live = true;
    let book: Book = { fib: null, pairs: {} };
    let applied = { pair: "", key: "" };

    function apply(entry: number, sl: number, tp: number, side?: string) {
      const form = document.querySelector<HTMLFormElement>('form[action="/api/admin/desk"]');
      if (!form) return;
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
      const pair = selectedPair();
      const row = rowForPair(book, pair);
      if (!book.fib && !Object.keys(book.pairs || {}).length) {
        setNote(
          "Fib: not running. Attach FibToDesk to each MT5 chart you draw on."
        );
        return;
      }
      if (!row) {
        setNote(
          `Fib: no ${pair || "pair"} drawing yet. Draw Fibonacci on the ${pair || "matching"} MT5 chart, then select ${pair || "that pair"} here.`
        );
        return;
      }
      const tp =
        Number(row.takeProfit) > 0
          ? Number(row.takeProfit)
          : Number(row.entry) + 2.5 * (Number(row.entry) - Number(row.stopLoss));
      const key = `${row.entry}|${row.stopLoss}|${tp}|${row.at}`;
      if (applied.pair !== pair || applied.key !== key) {
        applied = { pair, key };
        apply(Number(row.entry), Number(row.stopLoss), tp, row.side);
      }
      setNote(
        `Fib ${pair}: 0.5 → Entry ${row.entry} · 100 → SL ${row.stopLoss} · TP 2.5R ${tp}${row.symbol ? ` · ${row.symbol}` : ""}`
      );
    }

    async function tick() {
      if (!live) return;
      try {
        const res = await fetch("/api/admin/fib", { cache: "no-store" });
        const json = await res.json();
        book = { fib: json.fib || null, pairs: json.pairs || {} };
        sync();
      } catch {
        setNote("Fib: desk could not read the MT5 file.");
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
