import { getCostTierWinners, getLeaderboard } from "@/lib/data/queries";
import { handleRouteError, json } from "@/lib/api";
import { leaderboardColumns } from "@/lib/leaderboard/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const leaderboard = await getLeaderboard(category);

    return json({
      leaderboard,
      tierWinners: getCostTierWinners(leaderboard),
      columns: leaderboardColumns,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
