import { BEGINNER_PACK } from "@/lib/beginner-pack";

function hrefFor(slug: string) {
  return `/api/beginner-pack/${slug}`;
}

export function BeginnerCourse({ name }: { name: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 sm:pb-16">
      <article className="mt-8 rounded-3xl border border-[#c9a227] bg-black/70 px-5 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#e0b422]">
          Beginner pack — start
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome{name ? `, ${name}` : ""}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#d4b84a]">
          Work these materials in order, starting with the reading guide. Open slides in PowerPoint
          or similar. Watch the videos on this page.
        </p>

        <ol className="mt-10 space-y-10">
          {BEGINNER_PACK.map((item, i) => (
            <li key={item.slug} className="border-t border-[#c9a227]/40 pt-8 first:border-t-0 first:pt-0">
              <h3 className="text-xl font-semibold text-[#e0b422]">
                {i + 1}. {item.title}
              </h3>
              <div className="mt-4">
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={hrefFor(item.slug)}
                    alt={item.title}
                    className="mx-auto max-h-[90vh] w-full rounded-xl border border-[#c9a227]/50 object-contain bg-black"
                  />
                ) : null}
                {item.kind === "video" ? (
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full rounded-xl border border-[#c9a227]/50 bg-black"
                    src={hrefFor(item.slug)}
                  >
                    Your browser cannot play this video.{" "}
                    <a href={hrefFor(item.slug)} className="text-[#e0b422] underline">
                      Download it
                    </a>
                    .
                  </video>
                ) : null}
                {item.kind === "pdf" ? (
                  <iframe
                    title={item.title}
                    src={hrefFor(item.slug)}
                    className="h-[80vh] w-full rounded-xl border border-[#c9a227]/50 bg-white"
                  />
                ) : null}
                {item.kind === "slides" ? (
                  <p className="text-sm text-[#d4b84a]">
                    PowerPoint slides. Download and open in PowerPoint, Google Slides, or similar.
                  </p>
                ) : null}
                <a
                  href={hrefFor(item.slug)}
                  download={item.downloadName}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#e0b422] underline underline-offset-4"
                >
                  Download {item.downloadName}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}
