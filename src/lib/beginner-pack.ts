export type PackKind = "image" | "video" | "pdf" | "slides";

export type BeginnerPackItem = {
  slug: string;
  file: string;
  title: string;
  kind: PackKind;
  mime: string;
  downloadName: string;
};

/** Unlocked beginner pack, in study order. */
export const BEGINNER_PACK: BeginnerPackItem[] = [
  {
    slug: "reading-guide",
    file: "reading-guide.jpg",
    title: "Reading guide",
    kind: "image",
    mime: "image/jpeg",
    downloadName: "READING GUIDE.jpg",
  },
  {
    slug: "onboarding-lesson-1",
    file: "onboarding-lesson-1.pptx",
    title: "Onboarding lesson 1",
    kind: "slides",
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    downloadName: "ONBOARDING LESSON 1.pptx",
  },
  {
    slug: "onboarding-lesson-2",
    file: "onboarding-lesson-2.pdf",
    title: "Onboarding lesson 2 — trading concepts",
    kind: "pdf",
    mime: "application/pdf",
    downloadName: "ONBOARDING LESSON 2 TRADING CONCEPTS.pdf",
  },
  {
    slug: "candlestick-pattern",
    file: "candlestick-pattern.mp4",
    title: "The only candlestick pattern guide you'll ever need",
    kind: "video",
    mime: "video/mp4",
    downloadName: "The ONLY Candlestick Pattern Guide.mp4",
  },
  {
    slug: "order-types",
    file: "order-types.mp4",
    title: "Forex market order types",
    kind: "video",
    mime: "video/mp4",
    downloadName: "Forex Market Order Types.mp4",
  },
  {
    slug: "risk-reward",
    file: "risk-reward.mp4",
    title: "How to find risk reward ratio for any trade",
    kind: "video",
    mime: "video/mp4",
    downloadName: "How to Find Risk Reward Ratio.mp4",
  },
  {
    slug: "mt5-tutorial",
    file: "mt5-tutorial.mp4",
    title: "MetaTrader 5 tutorial",
    kind: "video",
    mime: "video/mp4",
    downloadName: "MetaTrader 5 Tutorial.mp4",
  },
  {
    slug: "lot-size-chart",
    file: "lot-size-chart.jpg",
    title: "Lot size chart",
    kind: "image",
    mime: "image/jpeg",
    downloadName: "LOT SIZE CHART.jpg",
  },
  {
    slug: "fibonacci",
    file: "fibonacci.mp4",
    title: "Fibonacci retracement explained in under 5 minutes",
    kind: "video",
    mime: "video/mp4",
    downloadName: "Fibonacci Retracement.mp4",
  },
];

export function findBeginnerPackItem(slug: string) {
  return BEGINNER_PACK.find((item) => item.slug === slug) || null;
}
