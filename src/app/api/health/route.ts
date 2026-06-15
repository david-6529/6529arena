import { json } from "@/lib/api";
import { hasDatabaseUrl, prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "not_configured" | "error" = hasDatabaseUrl() ? "error" : "not_configured";

  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "ok";
    } catch {
      database = "error";
    }
  }

  const ok = database !== "error";

  return json(
    {
      ok,
      service: "6529-agent-arena",
      database,
    },
    { status: ok ? 200 : 503 },
  );
}
