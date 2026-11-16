export type TeamMember = {
  name: string;
  role: string;
  years: number;
  focus: string;
  photo: string;
  width: number;
  height: number;
  /** Digits only, country code included. */
  whatsapp: string;
  bio: string;
};

export const TEAM_YEARS = 8 + 10 + 6;

export const TEAM: TeamMember[] = [
  {
    name: "Maumbe George",
    role: "Mentor / Educator",
    years: 8,
    focus: "ICT and Orderflow",
    photo: "/team/george.jpg",
    width: 3091,
    height: 3046,
    whatsapp: "256785041739",
    bio: "George is the Mentor and Educator at Forex Trading Consultants. He has 8 years of trading experience and teaches with a mix of ICT and Orderflow. He makes sure learners and traders get the best out of the concepts, and he keeps that education clear of the material sold across the internet.",
  },
  {
    name: "Amos Mugembe",
    role: "Operations Manager",
    years: 10,
    focus: "Orderflow",
    photo: "/team/amos.jpg",
    width: 1848,
    height: 1770,
    whatsapp: "256751158918",
    bio: "Amos runs the day-to-day operations of the company so traders have the best experience with the desk. He has 10 years of trading experience and works mostly with Orderflow. Amos is also the signal provider at Forex Trading Consultants.",
  },
  {
    name: "Namabako Joshua",
    role: "Social Media Manager",
    years: 6,
    focus: "Orderflow and market imbalances",
    photo: "/team/joshua.jpg",
    width: 3158,
    height: 3360,
    whatsapp: "256707273575",
    bio: "Joshua has 6 years of trading experience. His trading focuses on Orderflow and market imbalances. He is the Social Media Manager at Forex Trading Consultants.",
  },
];

export function whatsappLabel(digits: string) {
  const local = digits.slice(3);
  return `+${digits.slice(0, 3)} ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}
