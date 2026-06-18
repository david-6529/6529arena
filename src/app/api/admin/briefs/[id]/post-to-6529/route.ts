import { handleRouteError, json, requireAdmin } from "@/lib/api";
import { postWaveBriefTo6529, previewWaveBriefPost } from "@/lib/data/wave-briefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const preview = await previewWaveBriefPost({ briefId: id, appUrl });

    return json({ preview });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await context.params;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
    const brief = await postWaveBriefTo6529({ briefId: id, appUrl });

    return json({ brief });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
