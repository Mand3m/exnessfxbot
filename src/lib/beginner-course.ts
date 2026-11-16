export type CourseModule = {
  id: string;
  title: string;
  lead: string;
  paragraphs: string[];
  bullets?: string[];
};

export const BEGINNER_COURSE: CourseModule[] = [
  {
    id: "concepts",
    title: "1. Basic concepts of trading",
    lead: "Forex is the market where one currency is exchanged for another.",
    paragraphs: [
      "You are not buying a company. You are buying one currency and selling another at the same time. EUR/USD, for example, is the price of one euro in US dollars.",
      "Prices move when more traders want one side than the other. Your job as a beginner is not to predict every tick. It is to wait for a clear setup, define the risk, and execute the plan.",
      "A demo account is the right place to practise these steps before you use money you cannot afford to lose.",
    ],
  },
  {
    id: "terms",
    title: "2. Basic terminology",
    lead: "Learn these words first. Every order ticket uses them.",
    paragraphs: ["Hold these in your notes. You will see them on every card and every platform."],
    bullets: [
      "Pair — two currencies quoted together, such as GBP/USD or XAU/USD.",
      "Bid / Ask — the sell price and the buy price. The gap between them is the spread, the broker’s cost to enter.",
      "Pip — the usual small step in price. On most pairs a pip is 0.0001. On JPY pairs it is 0.01. On gold it is 0.1 or 0.01 depending on the broker.",
      "Lot — the size of the trade. 1.00 lot is a standard lot, 0.10 is mini, 0.01 is micro.",
      "Long / Short — buy if you expect the price to rise; sell if you expect it to fall.",
      "Stop loss (SL) — the price that closes the trade if it goes against you. Place it first.",
      "Take profit (TP) — the price that closes the trade if it goes your way.",
      "Leverage — borrowed size from the broker. It magnifies both profit and loss. Small risk on the account still matters more than high leverage.",
    ],
  },
  {
    id: "risk",
    title: "3. Basic risk management and calculation",
    lead: "Professionals size the trade from the stop. Beginners often skip this and blow the account.",
    paragraphs: [
      "Decide the money you can lose on one idea before you click buy or sell. A simple rule: risk 1% of the account on a single trade. On a $200 account that is $2. On a $1,000 account that is $10.",
      "Lot size comes from three numbers: account balance, the percent you will risk, and the distance from entry to stop loss in pips.",
      "Example: $1,000 account, 1% risk = $10. Stop is 20 pips. If each 0.01 lot risks about $0.10 per pip on that pair, then 20 pips × $0.10 = $2 per 0.01 lot. $10 ÷ $2 = 5 micro lots, which is 0.05 lot.",
      "If the stop is wider, the lot is smaller. If you cannot make the lot small enough for a 1% risk, skip the trade. Use the position size calculator on this site until the arithmetic is automatic.",
      "Never move the stop further away to “give it room” after you are in. That is how a $10 risk becomes a $50 loss.",
    ],
    bullets: [
      "Write the dollar risk before you order.",
      "Place the stop where the idea is wrong, then size the lot to that distance.",
      "One loss must not damage the week. A string of 1% losses is recoverable. One 20% loss often is not.",
    ],
  },
  {
    id: "entry",
    title: "4. An entry idea for practice",
    lead: "You need one simple idea you can repeat. Not five strategies.",
    paragraphs: [
      "Practice idea — level and stop. Mark a clear recent high or low on H1 or H4. That level is where other traders already reacted.",
      "If price returns to that level and rejects it (a wick, a small candle against the level, then a close back), that is your practice entry. You are not guessing the middle of a range. You are trading a place on the chart that already meant something.",
      "Stop loss goes beyond the level, far enough that a normal wick does not take you out, and no further. Take profit is at least the same distance as the stop (1:1). When you are comfortable, aim for 1:2 — the target is twice the stop.",
      "If the level is not obvious in five seconds, skip it. A beginner who waits will outlast a beginner who chases.",
      "Drill this on demo: mark one level a day, wait, take the reject or stand aside. Journal the result. The skill is the wait, not the click.",
    ],
  },
  {
    id: "execution",
    title: "5. Basic execution — placing the trade",
    lead: "This is the last stage of the beginner pack: you can now put the idea on the platform.",
    paragraphs: [
      "Open the order ticket on your broker. Choose the pair. Choose Buy or Sell to match the idea.",
      "Use a pending order if price has not reached your level yet (Buy Limit below the market, Sell Limit above, Buy Stop above, Sell Stop below). Use a market order only if price is already at the level and the candle has rejected it.",
      "Fill stop loss and take profit on the ticket before you send. Confirm lot size matches the 1% calculation. Send the order. Then leave it. Do not tighten the stop because you are nervous. Do not add to a losing trade.",
      "When the stop or the target is hit, the trade is over. Record it: pair, side, lot, risk in dollars, result. That notebook is part of the skill.",
      "You now have enough to trade with basic professional habits: a defined idea, a defined risk, and a clean execution. Mentorship is the next step when you want the desk on your own book. Until then, repeat this beginner loop on demo, then on a small live size you can afford to lose.",
    ],
    bullets: [
      "Ticket: pair, side, lot, SL, TP — all filled before send.",
      "Pending if you are early; market only at the level.",
      "One idea, one risk, one result. Then the next idea.",
    ],
  },
];
