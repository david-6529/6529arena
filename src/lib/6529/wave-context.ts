import { getWaveDrops } from "@/lib/6529/client";
import { dropCreatedAtMs } from "@/lib/6529/normalize";
import type { JsonRecord, WaveDrop } from "@/lib/6529/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WAVE_DROPS_PAGE_SIZE = 200;
const DEFAULT_CONTEXT_CAP = 500;
const EXPLICIT_WINDOW_SAFETY_CAP = 5_000;
const MAX_RELATED_WAVES = 8;

export type RelatedWaveContextParams = {
  waveId: string;
  label?: string;
};

export type WaveContextParams = {
  waveId: string;
  contextFrom?: string;
  contextTo?: string;
  maxMessages?: number;
  relatedWaves?: RelatedWaveContextParams[];
};

type WaveContextSource = {
  waveId: string;
  label: string;
  primary: boolean;
};

type WindowParams = {
  fromMs?: number;
  toMs?: number;
  maxMessages: number;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

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

function normalizeWaveId(value: string) {
  const trimmed = value.trim();
  const urlMatch = trimmed.match(/\/waves\/([^/?#\s]+)/);

  return (urlMatch?.[1] ?? trimmed).trim();
}

function normalizeSourceLabel(value: string | undefined, fallback: string) {
  const normalized = value?.trim().replace(/\s+/g, " ");

  return normalized || fallback;
}

function buildContextSources(params: WaveContextParams): WaveContextSource[] {
  const sources: WaveContextSource[] = [
    {
      waveId: normalizeWaveId(params.waveId),
      label: "Primary wave",
      primary: true,
    },
  ];
  const seen = new Set(sources.map((source) => source.waveId));

  for (const related of params.relatedWaves?.slice(0, MAX_RELATED_WAVES) ?? []) {
    const waveId = normalizeWaveId(related.waveId);

    if (!waveId || seen.has(waveId)) {
      continue;
    }

    seen.add(waveId);
    sources.push({
      waveId,
      label: normalizeSourceLabel(related.label, "Related wave"),
      primary: false,
    });
  }

  return sources;
}

function waveName(wave: unknown) {
  if (!isRecord(wave)) {
    return null;
  }

  const name = wave["name"];

  return typeof name === "string" && name.trim() ? name.trim() : null;
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

function sortDropsChronologically(drops: WaveDrop[]) {
  return [...drops].sort((a, b) => {
    const aCreated = dropCreatedAtMs(a) ?? 0;
    const bCreated = dropCreatedAtMs(b) ?? 0;

    if (aCreated !== bCreated) {
      return aCreated - bCreated;
    }

    return (a.serial_no ?? 0) - (b.serial_no ?? 0);
  });
}

async function fetchSingleWaveContext(source: WaveContextSource, windowParams: WindowParams) {
  const collected: WaveDrop[] = [];
  let searchedMessages = 0;
  let serialNoLimit: number | undefined;
  let lastOldestSerial: number | undefined;
  let wave: unknown;

  while (searchedMessages < windowParams.maxMessages) {
    const limit = Math.min(WAVE_DROPS_PAGE_SIZE, windowParams.maxMessages - searchedMessages);
    const page = await getWaveDrops(source.waveId, {
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
    collected.push(...pageDrops.filter((drop) => isWithinWindow(drop, windowParams.fromMs, windowParams.toMs)));

    const pageSerials = pageDrops
      .map((drop) => drop.serial_no)
      .filter((serial): serial is number => typeof serial === "number");
    const oldestSerial = pageSerials.length ? Math.min(...pageSerials) : undefined;
    const reachedWindowStart = Boolean(
      windowParams.fromMs &&
        pageDrops.some((drop) => {
          const createdAt = dropCreatedAtMs(drop);
          return createdAt ? createdAt < windowParams.fromMs! : false;
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
    drops: collected.slice(0, windowParams.maxMessages).map((drop) => ({
      ...drop,
      source_wave_id: source.waveId,
      source_wave_name: waveName(wave),
      source_wave_role: source.label,
    })),
    context: {
      searchedMessages,
    },
  };
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
  const sources = buildContextSources(params);
  const maxMessagesPerWave = Math.max(1, Math.ceil(maxMessages / sources.length));
  const sourceResults: Array<Awaited<ReturnType<typeof fetchSingleWaveContext>>> = [];

  for (const source of sources) {
    sourceResults.push(
      await fetchSingleWaveContext(source, {
        fromMs,
        toMs,
        maxMessages: maxMessagesPerWave,
      }),
    );
  }

  const drops = sortDropsChronologically(sourceResults.flatMap((result) => result.drops)).slice(-maxMessages);
  const sourcesContext = sourceResults.map((result, index) => ({
    waveId: sources[index]!.waveId,
    label: sources[index]!.label,
    primary: sources[index]!.primary,
    name: waveName(result.wave),
    dropCount: result.drops.length,
    searchedMessages: result.context.searchedMessages,
  }));

  return {
    wave: sourceResults[0]?.wave ?? null,
    relatedWaves: sourceResults.slice(1).map((result, index) => ({
      wave: result.wave ?? null,
      ...sourcesContext[index + 1],
    })),
    drops,
    context: {
      from: fromMs ? new Date(fromMs).toISOString() : null,
      to: toMs ? new Date(toMs).toISOString() : null,
      maxMessages,
      maxMessagesPerWave,
      searchedMessages: sourceResults.reduce((sum, result) => sum + result.context.searchedMessages, 0),
      explicitWindow,
      sources: sourcesContext,
    },
  };
}

export async function previewWaveContext(params: WaveContextParams) {
  const waveContext = await fetchWaveContext(params);
  const ordered = sortDropsChronologically(waveContext.drops);

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
      sourceWaveId: drop.source_wave_id ?? params.waveId,
      sourceWaveName: drop.source_wave_name ?? null,
      sourceWaveRole: drop.source_wave_role ?? null,
      preview: (drop.content ?? "").replace(/\s+/g, " ").trim().slice(0, 220),
    })),
  };
}
