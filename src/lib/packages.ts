export const SIGNAL_PLANS = [
  {
    id: "monthly",
    name: "Early Access",
    price: 40,
    days: 30,
    perDay: 40 / 30,
    period: "per month",
  },
  {
    id: "six-months",
    name: "6 months",
    price: 99,
    days: 180,
    perDay: 99 / 180,
    period: "every 6 months",
  },
  {
    id: "annual",
    name: "Annual",
    price: 199,
    days: 365,
    perDay: 199 / 365,
    period: "per year",
  },
] as const;

export const FEATURES = [
  {
    title: "Instant Access",
    text: "Immediate access to signals on the site",
    icon: "bolt",
  },
  {
    title: "No Ads",
    text: "Pure experience without distractions",
    icon: "shield",
  },
  {
    title: "Email Notifications",
    text: "Real-time notifications for every new signal",
    icon: "mail",
  },
] as const;

export const OTHER_PACKAGES = [
  {
    id: "mentorship",
    name: "One-on-One Mentorship",
    price: 300,
    days: 120,
    period: "for 4 months",
    blurb: "Private sessions with the desk on pairs, risk, and your own book.",
  },
  {
    id: "strategy-videos",
    name: "Strategy Videos",
    price: 50,
    days: 30,
    period: "one-time",
    blurb: "Recorded lessons on Entry, SL, and TP on the four markets.",
  },
  {
    id: "beginner",
    name: "Beginner pack",
    price: 30,
    days: 30,
    period: "for one month",
    blurb:
      "New students are introduced to forex up to basic execution: concepts, terms, risk and calculation, plus a practice entry idea.",
  },
] as const;

export const MENTORSHIP_TAB_IDS = ["mentorship", "beginner"] as const;
export type MentorshipTabId = (typeof MENTORSHIP_TAB_IDS)[number];

export const MENTORSHIP_OFFERS: Record<
  MentorshipTabId,
  {
    packId: MentorshipTabId;
    tabLabel: string;
    headline: string;
    quote?: string;
    quoteBy?: string;
    body?: string;
    includes: readonly string[];
  }
> = {
  mentorship: {
    packId: "mentorship",
    tabLabel: "Mentorship",
    headline:
      "One-on-one coaching that trains you to analyse the market and execute one simple method, every day.",
    quote: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
    quoteBy: "Will Durant",
    body:
      "Mentorship is meant to nurture and grow your execution and analysis skills through repetition of the same methods every day. At Exness FX Trading Consultants, we have identified a simple system to this effect that is easy to analyse, execute and make money from the markets consistently.",
    includes: [],
  },
  beginner: {
    packId: "beginner",
    tabLabel: "Beginner pack",
    headline:
      "A new student is introduced to trading up to the basic execution stage — enough to trade with basic professional skills.",
    includes: [
      "Basic concepts of forex trading",
      "Basic trading terminology",
      "Basic risk management and calculation principles",
      "An entry idea for practice as you start in the market",
      "How to place a trade: the basic execution stage",
    ],
  },
};

/** Educational packs unlocked by admin after payment. Signal plans stay on premium. */
export const MATERIAL_PACK_IDS = [
  "beginner",
  "mentorship",
  "strategy-videos",
  "mentor-1",
  "mentor-2",
  "mentor-3",
  "mentor-4",
] as const;
export type MaterialPackId = (typeof MATERIAL_PACK_IDS)[number];

export function isMaterialPack(id: string | null | undefined): id is MaterialPackId {
  return (MATERIAL_PACK_IDS as readonly string[]).includes(id || "");
}

export function isMentorshipTab(id: string | null | undefined): id is MentorshipTabId {
  return id === "mentorship" || id === "beginner";
}

export const MERCHANTS = {
  MTN: "593294",
  Airtel: "4366333",
} as const;

export const BTC_ADDRESS = "bc1qsr8wlnjxklkzcc4tcc4pxeqgx8qu9gr0rs0elc";

export type AnyPack = (typeof SIGNAL_PLANS)[number] | (typeof OTHER_PACKAGES)[number];

export function findPack(id: string): AnyPack | undefined {
  return ([...SIGNAL_PLANS, ...OTHER_PACKAGES] as AnyPack[]).find((p) => p.id === id);
}

/** Access length from the date admin admits the student. */
export function packTermDays(packId: string): number {
  if (packId === "beginner") return 30;
  if (packId === "mentorship" || packId.startsWith("mentor-")) return 120;
  const pack = findPack(packId);
  return pack && "days" in pack && pack.days > 0 ? pack.days : 0;
}
