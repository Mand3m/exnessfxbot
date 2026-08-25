import type { Metadata, Viewport } from "next";
import { Geist_Mono, GFS_Didot } from "next/font/google";
import { ChartHost } from "@/components/ChartPopup";
import { AppNotify } from "@/components/AppNotify";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const didot = GFS_Didot({
  variable: "--font-didot",
  subsets: ["greek", "latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16130e",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001"),
  title: {
    default: "Forex Trading Consultants — Free forex signals",
    template: "%s · Forex Trading Consultants",
  },
  description:
    "Free forex signal desk for major pairs: entry, take profit, stop loss, From/Till windows, results, and a position size calculator. Independent — not affiliated with Exness.",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${didot.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1850608178071792"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <ChartHost />
        <AppNotify />
      </body>
    </html>
  );
}
