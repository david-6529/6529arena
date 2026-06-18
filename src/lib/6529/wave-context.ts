import { getWaveDrops } from "@/lib/6529/client";
import { dropCreatedAtMs } from "@/lib/6529/normalize";
import type { WaveDrop } from "@/lib/6529/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WAVE_DROPS_PAGE_SIZE = 200;
const DEFAULT_CONTEXT_CAP = 500;
const EXPLICIT_WINDOW_SAFETY_CAP = 5_000;

export type WaveContextParams = {
  waveId: string;
  contextFrom?: string;
  contextTo?: string;
  maxMessages?: number;
};

function parseWindowDate(value?: string) {
  if (!value) {
    return undefined;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw Object.assign(new Error(`Invalid context window date: ${value}`), { status: 400 });
  }

  return timestamp;
}

function isWithinWindow(drop: WaveDrop, fromMs?: number, toMs?: number) {
  const createdAt = dropCreatedAtMs(drop);

  if (!createdAt) {
    return !fromMs && !toMs;
  }

  return (!fromMs || createdAt >= fromMs) && (!toMs || createdAt <= toMs);
}

function dropAuthor(drop: WaveDrop) {
  return drop.author?.handle ?? drop.author?.display ?? drop.author?.primary_wallet ?? "unknown";
}

export async function fetchWaveContext(params: WaveContextParams) {
  const now = Date.now();
  const explicitWindow = Boolean(params.contextFrom || params.contextTo);
  const fromMs = explicitWindow ? parseWindowDate(params.contextFrom) : now - DAY_MS;
  const toMs = explicitWindow ? parseWindowDate(params.contextTo) : now;

  if (fromMs && toMs && fromMs > toMs) {
    throw Object.assign(new Error("Context window start must be before context window end."), {
      status: 400,
    });
  }

  const maxMessages =
    params.maxMessages ?? (explicitWindow ? EXPLICIT_WINDOW_SAFETY_CAP : DEFAULT_CONTEXT_CAP);
  const collected: WaveDrop[] = [];
  let searchedMessages = 0;
  let serialNoLimit: number | undefined;
  let lastOldestSerial: number | undefined;
  let wave: unknown;

  while (searchedMessages < maxMessages) {
    const limit = Math.min(WAVE_DROPS_PAGE_SIZE, maxMessages - searchedMessages);
    const page = await getWaveDrops(params.waveId, {
      limit,
      serialNoLimit,
      searchStrategy: serialNoLimit ? "FIND_OLDER" : undefined,
    });
    const pageDrops = page.drops ?? [];

    wave ??= page.wave ?? null;

    if (!pageDrops.length) {
      break;
    }

    searchedMessages += pageDrops.length;
    collected.push(...pageDrops.filter((drop) => isWithinWindow(drop, fromMs, toMs)));

    const pageSerials = pageDrops
      .map((drop) => drop.serial_no)
      .filter((serial): serial is number => typeof serial === "number");
    const oldestSerial = pageSerials.length ? Math.min(...pageSerials) : undefined;
    const reachedWindowStart = Boolean(
      fromMs &&
        pageDrops.some((drop) => {
          const createdAt = dropCreatedAtMs(drop);
          return createdAt ? createdAt < fromMs : false;
        }),
    );

    if (reachedWindowStart || !oldestSerial || oldestSerial === lastOldestSerial) {
      break;
    }

    lastOldestSerial = oldestSerial;
    serialNoLimit = oldestSerial;
  }

  return {
    wave,
    drops: collected.slice(0, maxMessages),
    context: {
      from: fromMs ? new Date(fromMs).toISOString() : null,
      to: toMs ? new Date(toMs).toISOString() : null,
      maxMessages,
      searchedMessages,
      explicitWindow,
    },
  };
}

export async function previewWaveContext(params: WaveContextParams) {
  const waveContext = await fetchWaveContext(params);
  const ordered = [...waveContext.drops].sort((a, b) => (a.serial_no ?? 0) - (b.serial_no ?? 0));

  return {
    waveId: params.waveId,
    dropCount: ordered.length,
    fromDropId: ordered[0]?.id ?? null,
    toDropId: ordered.at(-1)?.id ?? null,
    context: waveContext.context,
    sampleDrops: ordered.slice(-5).map((drop) => ({
      id: drop.id,
      serialNo: drop.serial_no ?? null,
      author: dropAuthor(drop),
      createdAt: drop.created_at ? new Date(drop.created_at).toISOString() : null,
      preview: (drop.content ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
    })),
  };
}
