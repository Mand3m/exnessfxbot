import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLES, getArticle } from "@/lib/learn";
import { SiteBasics } from "@/components/SiteBasics";

type Props = { params: Promise<{ slug: string }> };

const MENTORSHIP_HREF = "/premium?pay=mentorship";

function renderLinked(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = part.match(/^\*\*(.+)\*\*$/);
    if (!m) return part;
    return (
      <Link
        key={i}
        href={MENTORSHIP_HREF}
        className="font-semibold text-[#e0b422] underline underline-offset-4"
      >
        {m[1]}
      </Link>
    );
  });
}

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  return { title: article?.title || "Learn" };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <>
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link href="/learn" className="text-sm text-brand hover:underline">
          ← All notes
        </Link>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">{article.title}</h1>
        <div className="mt-8 space-y-8">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-semibold">{section.heading}</h2>
              {section.paragraphs
                .filter((p) => p.trim())
                .map((p) => (
                  <p key={p} className="mt-3 text-base leading-relaxed text-muted">
                    {renderLinked(p)}
                  </p>
                ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
                  {section.bullets.map((b) => (
                    <li key={b}>{renderLinked(b)}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
      <SiteBasics />
    </>
  );
}
