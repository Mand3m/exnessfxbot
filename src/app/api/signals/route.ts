import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  REGULAR_DELAY_MS,
  dayPipTotal,
  listBoard,
  listMonthly,
  listRecentResults,
  monthPipTotal,
  settleLiveOrders,
} from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  const premium = session?.plan === "premium";
  await settleLiveOrders();
  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    premium,
    delayMinutes: premium ? 0 : REGULAR_DELAY_MS / 60000,
    board: listBoard({ premium }),
    monthly: listMonthly(),
    dayPips: dayPipTotal(),
    monthPips: monthPipTotal(),
    recent: listRecentResults(),
  });
}
