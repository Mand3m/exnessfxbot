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
    name: "Beginner Students",
    price: 30,
    days: 30,
    period: "for one month",
    blurb: "A first month for new traders: signals plus the basics notes.",
  },
] as const;

export const MERCHANTS = {
  MTN: "593294",
  Airtel: "4366333",
} as const;

export const BTC_ADDRESS = "bc1qsr8wlnjxklkzcc4tcc4pxeqgx8qu9gr0rs0elc";

export type AnyPack = (typeof SIGNAL_PLANS)[number] | (typeof OTHER_PACKAGES)[number];

export function findPack(id: string): AnyPack | undefined {
  return ([...SIGNAL_PLANS, ...OTHER_PACKAGES] as AnyPack[]).find((p) => p.id === id);
}
