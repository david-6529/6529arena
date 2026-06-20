import { searchWaves } from "@/lib/6529/wave-search";
import { handleRouteError, json } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseLimit(value: string | null) {
  const parsed = Number(value ?? 8);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 20 ? parsed : 8;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim() ?? "";

    if (query.length < 2) {
      return json({ waves: [] });
    }

    return json({
      waves: await searchWaves(query, {
        limit: parseLimit(url.searchParams.get("limit")),
      }),
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
