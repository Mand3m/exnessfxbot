import { CourseMedia } from "@/components/CourseMedia";
import { userHasPack } from "@/lib/auth";
import type { PackEntitlement } from "@/lib/auth";
import { listMentorshipFiles, MENTORSHIP_MODULES, readMentorshipReadme } from "@/lib/mentorship-pack";

export function MentorshipClassroom({
  name,
  entitlements,
}: {
  name: string;
  entitlements?: PackEntitlement[] | null;
}) {
  const session = { entitlements };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 sm:pb-16">
      <article className="mt-8 rounded-3xl border border-[#c9a227] bg-black/70 px-5 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-[#e0b422]">
          Mentorship — start
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Welcome{name ? `, ${name}` : ""}
        </h2>

        <ol className="mt-10 space-y-10">
          {MENTORSHIP_MODULES.filter((mod) => userHasPack(session, mod.id)).map((mod, i) => {
            const files = listMentorshipFiles(mod.id);
            const readme = readMentorshipReadme(mod.id);
            return (
              <li
                key={mod.id}
                className="border-t border-[#c9a227]/40 pt-8 first:border-t-0 first:pt-0"
              >
                <h3 className="text-xl font-semibold text-[#e0b422]">
                  {i + 1}. {mod.title}
                </h3>
                {files.length === 0 && !readme ? (
                  <p className="mt-3 text-sm text-[#d4b84a]">
                    This material is unlocked. Files will appear here after the zip is uploaded.
                  </p>
                ) : (
                  <div className="mt-4 space-y-8">
                    {readme ? (
                      <pre className="whitespace-pre-wrap rounded-xl border border-[#c9a227]/50 bg-black/50 px-4 py-4 text-sm leading-relaxed text-white">
                        {readme}
                      </pre>
                    ) : null}
                    {files.map((f) => (
                      <div key={f.relPath}>
                        <p className="text-sm font-semibold text-[#f3d56a]">
                          {f.name.replace(/^\d+-/, "").replace(/\.[^.]+$/, "").replace(/-/g, " ")}
                        </p>
                        <CourseMedia
                          href={`/api/mentorship-pack/${mod.id}/${f.relPath
                            .split("/")
                            .map(encodeURIComponent)
                            .join("/")}`}
                          title={f.name}
                          kind={f.kind}
                          downloadName={f.name}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </article>
    </div>
  );
}
