import { z } from "zod";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { createWaveBriefDraft, listWaveBriefs } from "@/lib/data/wave-briefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createBriefSchema = z.object({
  waveId: z.string().trim().min(1),
  triggerDropId: z.string().trim().min(1).optional(),
  requestText: z.string().trim().min(1).max(1000).optional(),
  contextFrom: z.string().trim().min(1).optional(),
  contextTo: z.string().trim().min(1).optional(),
  maxMessages: z.number().int().min(1).max(5000).optional(),
  provider: z.enum(["openai", "anthropic", "google"]).optional(),
  modelName: z.string().trim().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  try {
    requireAdmin(request);

    return json({ briefs: await listWaveBriefs() });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await parseJson(request, createBriefSchema);
    const brief = await createWaveBriefDraft(body);

    return json({ brief }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
