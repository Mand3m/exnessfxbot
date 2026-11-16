import Image from "next/image";
import { TEAM, TEAM_YEARS, whatsappLabel } from "@/lib/team";

export function MeetTeam() {
  return (
    <div className="bg-[#0c0a08] text-white">
      <section className="relative overflow-hidden border-b border-[#c9a227]/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(224,180,34,0.12),_transparent_55%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#FFD700]">
            Forex Trading Consultants
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">Meet the Team</h1>
          <p className="mt-6 text-lg leading-relaxed text-white sm:text-xl">
            The desk that manages Forex Trading Consultants brings {TEAM_YEARS} years of trading
            experience. Education, day-to-day operations, the signals traders follow, and the
            company&apos;s public voice all sit with this team. Learners and traders get a direct
            path through the concepts that matter.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-3">
        {TEAM.map((person) => (
          <article
            key={person.whatsapp}
            className="flex flex-col overflow-hidden rounded-3xl border border-[#c9a227] bg-black/70"
          >
            <Image
              src={person.photo}
              alt={`${person.name}, ${person.role} at Forex Trading Consultants`}
              width={person.width}
              height={person.height}
              unoptimized
              priority
              className="h-auto w-full"
            />
            <div className="flex flex-1 flex-col px-5 py-6 sm:px-6">
              <h2 className="text-2xl font-semibold">{person.name}</h2>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[#FFD700]">
                {person.role}
              </p>
              <p className="mt-3 text-sm text-white">
                {person.years} years · {person.focus}
              </p>
              <p className="mt-4 flex-1 text-base leading-relaxed text-white">{person.bio}</p>
              <a
                href={`https://wa.me/${person.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#e0b422] px-4 py-2 text-sm font-semibold !text-black"
              >
                WhatsApp {whatsappLabel(person.whatsapp)}
              </a>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
