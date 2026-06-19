import { search6529WavesByName } from "@/lib/6529/client";
import type { JsonRecord } from "@/lib/6529/types";
import { prisma } from "@/lib/db/prisma";

export type WaveSearchResult = {
  id: string;
  name: string;
  description: string | null;
  source: "6529" | "history";
};

type WaveBriefSearchRow = {
  waveId: string;
  title: string;
  contextJson: unknown;
  createdAt: Date;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pickText(source: JsonRecord | null | undefined, keys: string[]) {
  if (!source) {
    return undefined;
  }

  for (const key of keys) {
    const value = asText(source[key]);

    if (value) {
      return value;
    }
  }

  return undefined;
}

function extractDescription(rawWave: JsonRecord | null) {
  const direct = pickText(rawWave, ["description", "overview", "summary", "about"]);

  if (direct) {
    return direct;
  }

  const descriptionDrop = isRecord(rawWave?.["description_drop"])
    ? rawWave["description_drop"]
    : isRecord(rawWave?.["descriptionDrop"])
      ? rawWave["descriptionDrop"]
      : null;

  if (!descriptionDrop) {
    return null;
  }

  const parts = Array.isArray(descriptionDrop["parts"]) ? descriptionDrop["parts"] : [];

  return parts
    .filter(isRecord)
    .map((part) => asText(part["content"]))
    .filter((part): part is string => Boolean(part))
    .join("\n\n") || null;
}

function extractContextWave(contextJson: unknown) {
  if (!isRecord(contextJson)) {
    return null;
  }

  return isRecord(contextJson["wave"]) ? contextJson["wave"] : null;
}

export function normalizeWaveSearchResult(
  rawWave: unknown,
  params: {
    fallbackId?: string;
    fallbackName?: string;
    source: WaveSearchResult["source"];
  },
): WaveSearchResult | null {
  const wave = isRecord(rawWave) ? rawWave : null;
  const id =
    pickText(wave, ["id", "wave_id", "waveId", "uuid"]) ??
    asText(params.fallbackId);

  if (!id) {
    return null;
  }

  return {
    id,
    name:
      pickText(wave, ["name", "title", "wave_name", "waveName", "label"]) ??
      asText(params.fallbackName) ??
      id,
    description: extractDescription(wave),
    source: params.source,
  };
}

function matchesQuery(result: WaveSearchResult, query: string) {
  const needle = query.toLowerCase();

  return [result.name, result.description ?? ""]
    .some((value) => value.toLowerCase().includes(needle));
}

function mergeWaveResult(
  resultsById: Map<string, WaveSearchResult>,
  result: WaveSearchResult | null,
) {
  if (!result) {
    return;
  }

  if (!resultsById.has(result.id)) {
    resultsById.set(result.id, result);
  }
}

async function searchHistory(query: string, limit: number) {
  if (!prisma) {
    return [];
  }

  const rows = await prisma.waveBrief.findMany({
    take: Math.max(limit * 4, 20),
    orderBy: { createdAt: "desc" },
    select: {
      waveId: true,
      title: true,
      contextJson: true,
      createdAt: true,
    },
  });
  const resultsById = new Map<string, WaveSearchResult>();

  for (const row of rows as WaveBriefSearchRow[]) {
    const result = normalizeWaveSearchResult(extractContextWave(row.contextJson), {
      fallbackId: row.waveId,
      fallbackName: row.title,
      source: "history",
    });

    if (result && matchesQuery(result, query)) {
      mergeWaveResult(resultsById, result);
    }
  }

  return [...resultsById.values()].slice(0, limit);
}

async function search6529(query: string, limit: number) {
  try {
    return (await search6529WavesByName(query, { limit }))
      .map((wave) =>
        normalizeWaveSearchResult(wave, {
          source: "6529",
        }),
      )
      .filter((result): result is WaveSearchResult => Boolean(result));
  } catch {
    return [];
  }
}

export async function searchWaves(
  query: string,
  params: {
    limit?: number;
  } = {},
) {
  const normalizedQuery = query.trim();
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 20);

  if (normalizedQuery.length < 2) {
    return [];
  }

  const resultsById = new Map<string, WaveSearchResult>();

  for (const result of await search6529(normalizedQuery, limit)) {
    mergeWaveResult(resultsById, result);
  }

  for (const result of await searchHistory(normalizedQuery, limit)) {
    mergeWaveResult(resultsById, result);
  }

  return [...resultsById.values()].slice(0, limit);
}
