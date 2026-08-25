import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES } from "@/lib/learn";
import { SiteBasics } from "@/components/SiteBasics";

export const metadata: Metadata = { title: "Learn" };

export default function LearnPage() {
  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">Education</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Forex trading basics</h1>
        <p className="mt-3 text-muted">
          The same topics from the board: what FX is, strategies, brokers, plans,
          signals, risk, and psychology.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {ARTICLES.map((a) => (
            <Link
              key={a.slug}
              href={`/learn/${a.slug}`}
              className="rounded-2xl border border-border bg-card p-5 transition hover:border-brand/50"
            >
              <h2 className="font-semibold">{a.title}</h2>
              <p className="mt-2 text-sm text-muted">{a.summary}</p>
            </Link>
          ))}
        </div>
      </div>
      <SiteBasics />
    </>
  );
}
