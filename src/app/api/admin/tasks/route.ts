import { z } from "zod";
import { handleRouteError, json, parseJson, requireAdmin } from "@/lib/api";
import { createManualWaveTask, listWaveTasks, waveTaskStatuses } from "@/lib/data/wave-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createTaskSchema = z.object({
  waveId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(240),
  status: z.enum(waveTaskStatuses).optional(),
  suggestedOwner: z.string().trim().max(120).optional(),
  sourceDropIds: z.array(z.string().trim().min(1)).max(50).optional(),
  reviewerNotes: z.string().trim().max(2000).optional(),
  reviewedBy: z.string().trim().max(120).optional(),
  outcomeDropId: z.string().trim().max(120).optional(),
  outcomeUrl: z.string().trim().max(500).optional(),
  outcomeSummary: z.string().trim().max(1000).optional(),
});

export async function GET(request: Request) {
  try {
    requireAdmin(request);

    return json({ tasks: await listWaveTasks() });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function POST(request: Request) {
  try {
    requireAdmin(request);
    const body = await parseJson(request, createTaskSchema);
    const task = await createManualWaveTask(body);

    return json({ task }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
