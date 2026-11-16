import type { PackKind } from "@/lib/beginner-pack";

export function CourseMedia({
  href,
  title,
  kind,
  downloadName,
}: {
  href: string;
  title: string;
  kind: PackKind | "file";
  downloadName: string;
}) {
  return (
    <div className="mt-4">
      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={href}
          alt={title}
          className="mx-auto max-h-[90vh] w-full rounded-xl border border-[#c9a227]/50 object-contain bg-black"
        />
      ) : null}
      {kind === "video" ? (
        <video
          controls
          preload="metadata"
          playsInline
          className="w-full rounded-xl border border-[#c9a227]/50 bg-black"
          src={href}
        >
          Your browser cannot play this video.{" "}
          <a href={href} className="text-[#e0b422] underline">
            Download it
          </a>
          .
        </video>
      ) : null}
      {kind === "pdf" ? (
        <iframe
          title={title}
          src={href}
          className="h-[80vh] w-full rounded-xl border border-[#c9a227]/50 bg-white"
        />
      ) : null}
      {kind === "slides" || kind === "file" ? (
        <p className="text-sm text-[#d4b84a]">
          {kind === "slides"
            ? "PowerPoint slides. Download and open in PowerPoint, Google Slides, or similar."
            : "Download this file to open it."}
        </p>
      ) : null}
      <a
        href={href}
        download={downloadName}
        className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#e0b422] underline underline-offset-4"
      >
        Download {downloadName}
      </a>
    </div>
  );
}
