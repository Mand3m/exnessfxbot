import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Download Android app" };

const APK_HREF = "/download/forex-trading-consultants.apk";

export default function DownloadPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Download the Android app</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Install Forex Trading Consultants on your phone.
      </p>
      <a
        href={APK_HREF}
        download="forex-trading-consultants.apk"
        className="mt-8 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#e0b422] px-6 py-3 text-sm font-semibold !text-black"
      >
        Download APK
      </a>
      <ol className="mt-8 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
        <li>Open this page on your Android phone and tap Download APK.</li>
        <li>If Android asks, allow this site to install unknown apps, then tap Install.</li>
        <li>Open <strong>Forex Trading Consultants</strong> from your app drawer.</li>
      </ol>
      <p className="mt-6 text-sm text-muted">
        <Link href="/" className="text-[#e0b422] underline">
          Back to live signals
        </Link>
      </p>
    </div>
  );
}
