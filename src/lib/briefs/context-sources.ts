import type { JsonRecord } from "@/lib/6529/types";

export type WaveBriefSourceSummary = {
  waveId: string;
  name: string | null;
  label: string | null;
  primary: boolean;
  availableDropCount: number | null;
  dropCount: number | null;
  hitCap: boolean | null;
  oldestDropAt: string | null;
  newestDropAt: string | null;
  searchedMessages: number | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function normalizeSource(raw: unknown): WaveBriefSourceSummary | null {
  if (!isRecord(raw)) {
    return null;
  }

  const waveId = asText(raw["waveId"]) ?? asText(raw["wave_id"]) ?? asText(raw["id"]);

  if (!waveId) {
    return null;
  }

  return {
    waveId,
    name: asText(raw["name"]),
    label: asText(raw["label"]),
    primary: raw["primary"] === true,
    availableDropCount: asNumber(raw["availableDropCount"]) ?? asNumber(raw["available_drop_count"]),
    dropCount: asNumber(raw["dropCount"]) ?? asNumber(raw["drop_count"]),
    hitCap: asBoolean(raw["hitCap"]) ?? asBoolean(raw["hit_cap"]),
    oldestDropAt: asText(raw["oldestDropAt"]) ?? asText(raw["oldest_drop_at"]),
    newestDropAt: asText(raw["newestDropAt"]) ?? asText(raw["newest_drop_at"]),
    searchedMessages: asNumber(raw["searchedMessages"]) ?? asNumber(raw["searched_messages"]),
  };
}

export function getWaveBriefSourceSummaries(contextJson: unknown): WaveBriefSourceSummary[] {
  if (!isRecord(contextJson)) {
    return [];
  }

  const context = isRecord(contextJson["context"]) ? contextJson["context"] : null;
  const sources = Array.isArray(context?.["sources"]) ? context["sources"] : [];
  const normalizedSources = sources
    .map(normalizeSource)
    .filter((source): source is WaveBriefSourceSummary => Boolean(source));

  if (normalizedSources.length) {
    return normalizedSources;
  }

  const wave = isRecord(contextJson["wave"]) ? contextJson["wave"] : null;
  const fallback = normalizeSource({
    waveId: wave?.["id"],
    name: wave?.["name"],
    label: "Primary wave",
    primary: true,
    availableDropCount: null,
    hitCap: null,
    oldestDropAt: null,
    newestDropAt: null,
  });

  return fallback ? [fallback] : [];
}
