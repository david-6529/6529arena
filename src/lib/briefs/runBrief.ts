import { generateWithAnthropic } from "@/lib/ai/anthropic";
import { generateWithGoogle } from "@/lib/ai/google";
import { generateWithOllama } from "@/lib/ai/ollama";
import { generateWithOpenAI } from "@/lib/ai/openai";
import { estimateCostUsd } from "@/lib/ai/pricing";
import { runProviderCall } from "@/lib/ai/retry";
import { buildWaveBriefPrompts, type PreviousWaveSummary, type WaveBriefPromptContext } from "@/lib/briefs/prompts";
import { renderWaveBrief } from "@/lib/briefs/render";
import { parseWaveBrief, type WaveBriefPayload } from "@/lib/briefs/schema";
import { dropCreatedAtMs } from "@/lib/6529/normalize";
import type { WaveDrop } from "@/lib/6529/types";

export type BriefProvider = "openai" | "anthropic" | "google" | "ollama" | "local";

export const defaultWaveBriefMaxOutputTokens = 1800;

export type WaveBriefRunResult = {
  provider: BriefProvider;
  modelName: string;
  rawOutput: string;
  structured: WaveBriefPayload;
  renderedOutput: string;
  promptTokens?: number;
  completionTokens?: number;
  costUsd?: number;
  latencyMs: number;
};

export type WaveBriefCostPreview = {
  provider: BriefProvider;
  modelName: string;
  promptTokens: number;
  maxOutputTokens: number;
  estimatedCostUsd: number | null;
  costCapUsd: number | null;
  costCapExceeded: boolean;
  pricingAvailable: boolean;
  promptDropCount: number;
  promptOmittedDropCount: number;
  fetchedDropCount: number;
};

function localMockModeEnabled() {
  return process.env.WAVE_BRIEF_LOCAL_MOCK_MODE === "true";
}

function configuredProvider(value?: string): BriefProvider {
  if (localMockModeEnabled()) {
    return "local";
  }

  if (value === "local") {
    return "local";
  }

  if (value === "anthropic" || value === "google" || value === "ollama" || value === "openai") {
    return value;
  }

  return "ollama";
}

function defaultModel(provider: BriefProvider) {
  if (provider === "local") {
    return "extractive-check-in";
  }

  if (provider === "ollama") {
    return "qwen3:14b";
  }

  if (provider === "anthropic") {
    return "claude-sonnet-4-5";
  }

  if (provider === "google") {
    return "gemini-2.0-flash";
  }

  return "gpt-4.1-mini";
}

function apiKeyName(provider: BriefProvider) {
  if (provider === "local") {
    return "WAVE_BRIEF_LOCAL_MOCK_MODE";
  }

  if (provider === "ollama") {
    return "OLLAMA_BASE_URL";
  }

  if (provider === "anthropic") {
    return "ANTHROPIC_API_KEY";
  }

  if (provider === "google") {
    return "GOOGLE_API_KEY";
  }

  return "OPENAI_API_KEY";
}

export function getWaveBriefProviderConfig(params?: { provider?: string; modelName?: string }) {
  const provider = configuredProvider(params?.provider ?? process.env.WAVE_BRIEF_PROVIDER);
  const modelName = provider === "local" ? defaultModel(provider) : params?.modelName || process.env.WAVE_BRIEF_MODEL || defaultModel(provider);
  const keyName = apiKeyName(provider);

  return {
    provider,
    modelName,
    keyName,
    configured:
      provider === "local"
        ? localMockModeEnabled()
        : provider === "ollama"
          ? true
          : Boolean(process.env[keyName]?.trim()),
  };
}

function assertProviderConfigured(provider: BriefProvider) {
  if (provider === "local") {
    if (localMockModeEnabled()) {
      return;
    }

    throw Object.assign(new Error("WAVE_BRIEF_LOCAL_MOCK_MODE=true is required to generate local wave check-ins."), {
      status: 422,
      code: "provider_not_configured",
    });
  }

  const { keyName, configured } = getWaveBriefProviderConfig({ provider });

  if (!configured) {
    throw Object.assign(new Error(`${keyName} is required to generate ${provider} wave check-ins.`), {
      status: 422,
      code: "provider_not_configured",
    });
  }
}

export function getWaveBriefEstimatedCostCapUsd() {
  const configured = Number(process.env.MAX_WAVE_BRIEF_ESTIMATED_COST_USD ?? 0.25);

  return Number.isFinite(configured) && configured > 0 ? configured : null;
}

function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

export function estimateWaveBriefRunCost(params: {
  provider: string;
  modelName: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
}) {
  const promptTokens = estimateTokenCount(`${params.systemPrompt}\n\n${params.userPrompt}`);

  if (params.provider === "local" || params.provider === "ollama") {
    return {
      promptTokens,
      maxOutputTokens: params.maxOutputTokens,
      estimatedCostUsd: 0,
    };
  }

  return {
    promptTokens,
    maxOutputTokens: params.maxOutputTokens,
    estimatedCostUsd: estimateCostUsd({
      provider: params.provider,
      modelName: params.modelName,
      promptTokens,
      completionTokens: params.maxOutputTokens,
    }),
  };
}

function authorName(drop: WaveDrop) {
  return drop.author?.handle ?? drop.author?.display ?? drop.author?.primary_wallet ?? "unknown";
}

function compactText(value: string | null | undefined, maxChars = 220) {
  const text = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\bSources?\s*:/gi, "source mentions:")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars - 3).trimEnd()}...`;
}

function sentenceFromDrop(drop: WaveDrop) {
  return compactText(drop.content || drop.title || "No text content.", 240);
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

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function uniqueDrops(drops: WaveDrop[]) {
  const seen = new Set<string>();
  const result: WaveDrop[] = [];

  for (const drop of drops) {
    if (seen.has(drop.id)) {
      continue;
    }

    seen.add(drop.id);
    result.push(drop);
  }

  return result;
}

function selectDrops(drops: WaveDrop[], patterns: RegExp[], limit: number) {
  return uniqueDrops(
    drops.filter((drop) => matchesAny(`${drop.title ?? ""} ${drop.content ?? ""}`, patterns)),
  ).slice(0, limit);
}

function classifyLocalWaveType(drops: WaveDrop[]): Pick<WaveBriefPayload, "wave_type" | "wave_type_label"> {
  const text = drops.map((drop) => `${drop.title ?? ""} ${drop.content ?? ""}`).join("\n").toLowerCase();

  if (/\b(pr|pull request|deploy|deployment|staging|prod|production|branch|commit|merge|build|bug|incident|release)\b/.test(text)) {
    return { wave_type: "engineering_release", wave_type_label: "Engineering release" };
  }

  if (/\b(vote|proposal|governance|approve|approval|consensus|policy|rubric|rep|delegate)\b/.test(text)) {
    return { wave_type: "governance_decision", wave_type_label: "Governance decision" };
  }

  if (/\b(art|artist|meme|mint|drop|pfp|collection|collector|curation|gallery)\b/.test(text)) {
    return { wave_type: "creative_drop", wave_type_label: "Creative drop" };
  }

  if (/\b(task|owner|follow[- ]?up|roadmap|plan|launch|workstream|blocked|next step|ship)\b/.test(text)) {
    return { wave_type: "project_ops", wave_type_label: "Project ops" };
  }

  return { wave_type: "community_chat", wave_type_label: "Community chat" };
}

function sectionTitleForType(type: WaveBriefPayload["wave_type"], kind: "signal" | "questions" | "work" | "risks") {
  const titles = {
    community_chat: {
      signal: "Main thread",
      questions: "Open loops",
      work: "Useful follow-ups",
      risks: "Watch-outs",
    },
    project_ops: {
      signal: "Current state",
      questions: "Decisions or questions",
      work: "Next work",
      risks: "Blockers",
    },
    engineering_release: {
      signal: "Release state",
      questions: "Validation questions",
      work: "Next deploy move",
      risks: "Release risks",
    },
    governance_decision: {
      signal: "Proposal state",
      questions: "Unresolved points",
      work: "Decision path",
      risks: "Governance risks",
    },
    creative_drop: {
      signal: "What was shared",
      questions: "Open reactions",
      work: "Creative next steps",
      risks: "Context to check",
    },
  } satisfies Record<WaveBriefPayload["wave_type"], Record<"signal" | "questions" | "work" | "risks", string>>;

  return titles[type][kind];
}

function renderDropLine(drop: WaveDrop) {
  const serial = drop.serial_no == null ? "" : `#${drop.serial_no} `;
  return `${serial}@${authorName(drop)}: ${sentenceFromDrop(drop)}`;
}

function buildLocalSections(params: {
  type: WaveBriefPayload["wave_type"];
  citedDrops: WaveDrop[];
  questionDrops: WaveDrop[];
  actionDrops: WaveDrop[];
  riskDrops: WaveDrop[];
}) {
  return [
    { title: sectionTitleForType(params.type, "signal"), drops: params.citedDrops.slice(0, 4) },
    { title: sectionTitleForType(params.type, "questions"), drops: params.questionDrops },
    { title: sectionTitleForType(params.type, "work"), drops: params.actionDrops },
    { title: sectionTitleForType(params.type, "risks"), drops: params.riskDrops },
  ]
    .filter((section) => section.drops.length)
    .map((section) => ({
      title: section.title,
      bullets: section.drops.map((drop) => ({
        text: renderDropLine(drop),
        source_drop_ids: [drop.id],
      })),
    }));
}

function buildLocalWaveBrief(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
  context?: WaveBriefPromptContext;
  previousSummary?: PreviousWaveSummary;
}): WaveBriefPayload {
  const ordered = sortDropsChronologically(params.drops);
  const newest = [...ordered].reverse();
  const citedDrops = uniqueDrops(newest.filter((drop) => compactText(drop.content || drop.title).length > 0)).slice(0, 8);
  const citedIds = citedDrops.map((drop) => drop.id);
  const fallbackIds = citedIds.slice(0, 3);
  const questionDrops = selectDrops(newest, [/\?/, /\b(can we|should we|how do|what is|what are|why|when|who)\b/i], 3);
  const actionDrops = selectDrops(
    newest,
    [/\b(todo|follow up|need to|needs to|should|please|pls|next|owner|assign|fix|build|ship|merge|check|review)\b/i],
    4,
  );
  const riskDrops = selectDrops(
    newest,
    [/\b(risk|blocked|problem|issue|bug|break|fail|unsafe|wrong|confusing|concern|cap|quota|error|429|delay)\b/i],
    3,
  );
  const decisionDrops = selectDrops(newest, [/\b(decide|decision|choose|pick|approve|ship|merge|cutoff|policy|plan)\b/i], 3);
  const waveType = classifyLocalWaveType(params.drops);
  const sections = buildLocalSections({
    type: waveType.wave_type,
    citedDrops,
    questionDrops,
    actionDrops,
    riskDrops,
  });
  const window =
    params.context?.from || params.context?.to
      ? ` Window: ${params.context.from ?? "start"} to ${params.context.to ?? "now"}.`
      : "";
  const capLimitations = params.context?.hitCap
    ? ["One or more source waves hit the fetch cap, so this should not be treated as complete-history analysis."]
    : [];
  const promptLimitations =
    params.drops.length > citedDrops.length
      ? [`Local test mode cited ${citedDrops.length} of ${params.drops.length} fetched drops and may miss nuance.`]
      : ["Local test mode used all fetched drops available to it."];

  return {
    title: "Local test check-in",
    ...waveType,
    executive_summary: [
      `Local test mode read ${params.drops.length} fetched drops and produced an extractive check-in without calling an AI provider.`,
      citedDrops.length
        ? `The newest cited items include ${citedDrops.slice(0, 3).map((drop) => `@${authorName(drop)}`).join(", ")}.`
        : "No citable text drops were available.",
    ].join(" "),
    evidence_coverage: {
      summary: `Fetched ${params.drops.length} drops in ${params.context?.mode ?? "unknown"} mode.${window}`,
      limitations: [...capLimitations, ...promptLimitations],
    },
    sections,
    summary_bullets: citedDrops.slice(0, 5).map(renderDropLine),
    changes_since_previous: params.previousSummary
      ? citedDrops.slice(0, 3).map((drop) => ({
          change: `Recent source activity after the previous checked check-in: ${renderDropLine(drop)}`,
          source_drop_ids: [drop.id],
        }))
      : [],
    decisions_needed: decisionDrops.length
      ? decisionDrops.map((drop) => ({
          title: `Decide how to handle: ${sentenceFromDrop(drop)}`,
          why: "This source drop used decision or shipping language.",
          source_drop_ids: [drop.id],
        }))
      : [
          {
            title: "Decide whether this local test check-in is accurate enough to use.",
            why: "This was generated by deterministic local extraction, not a reasoning model.",
            source_drop_ids: fallbackIds,
          },
        ],
    open_questions: questionDrops.length
      ? questionDrops.map((drop) => ({
          question: sentenceFromDrop(drop),
          source_drop_ids: [drop.id],
        }))
      : [],
    action_items: actionDrops.length
      ? actionDrops.map((drop) => ({
          task: `Follow up on: ${sentenceFromDrop(drop)}`,
          suggested_owner: authorName(drop) === "unknown" ? "" : authorName(drop),
          source_drop_ids: [drop.id],
        }))
      : [
          {
            task: "Review the cited drops and replace local test output with a model-generated check-in before sharing publicly.",
            suggested_owner: "",
            source_drop_ids: fallbackIds,
          },
        ],
    risks: riskDrops.length
      ? riskDrops.map((drop) => ({
          risk: sentenceFromDrop(drop),
          severity: "medium" as const,
          source_drop_ids: [drop.id],
        }))
      : [
          {
            risk: "Local extractive mode is useful for UI testing, but it can miss implicit context and should not be treated as production-quality synthesis.",
            severity: "medium" as const,
            source_drop_ids: fallbackIds,
          },
        ],
    suggested_post: citedDrops.length
      ? `Local test check-in: ${citedDrops.slice(0, 3).map(renderDropLine).join(" ")}`
      : "Local test check-in: no citable source text was found in the fetched context.",
    citations: citedDrops.map((drop) => ({
      drop_id: drop.id,
      reason: "Used by local extractive test mode as source evidence.",
    })),
    confidence: 0.55,
  };
}

export function estimateWaveBriefDraftCost(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
  context?: WaveBriefPromptContext;
  provider?: string;
  modelName?: string;
  maxOutputTokens?: number;
  previousSummary?: PreviousWaveSummary;
}): WaveBriefCostPreview {
  const providerConfig = getWaveBriefProviderConfig(params);
  const maxOutputTokens = params.maxOutputTokens ?? defaultWaveBriefMaxOutputTokens;
  const prompts = buildWaveBriefPrompts({
    waveId: params.waveId,
    requestText: params.requestText,
    drops: params.drops,
    context: params.context,
    previousSummary: params.previousSummary,
  });
  const estimate = estimateWaveBriefRunCost({
    provider: providerConfig.provider,
    modelName: providerConfig.modelName,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    maxOutputTokens,
  });
  const costCapUsd = getWaveBriefEstimatedCostCapUsd();
  const estimatedCostUsd = estimate.estimatedCostUsd ?? null;

  return {
    provider: providerConfig.provider,
    modelName: providerConfig.modelName,
    promptTokens: estimate.promptTokens,
    maxOutputTokens,
    estimatedCostUsd,
    costCapUsd,
    costCapExceeded: Boolean(costCapUsd != null && estimatedCostUsd != null && estimatedCostUsd > costCapUsd),
    pricingAvailable: estimatedCostUsd != null,
    promptDropCount: prompts.stats.promptDropCount,
    promptOmittedDropCount: prompts.stats.promptOmittedDropCount,
    fetchedDropCount: prompts.stats.fetchedDropCount,
  };
}

export async function runWaveBrief(params: {
  waveId: string;
  requestText: string;
  drops: WaveDrop[];
  context?: WaveBriefPromptContext;
  provider?: string;
  modelName?: string;
  maxOutputTokens?: number;
  previousSummary?: PreviousWaveSummary;
}): Promise<WaveBriefRunResult> {
  const providerConfig = getWaveBriefProviderConfig(params);
  const provider = providerConfig.provider;
  const modelName = providerConfig.modelName;
  const maxOutputTokens = params.maxOutputTokens ?? defaultWaveBriefMaxOutputTokens;
  const prompts = buildWaveBriefPrompts({
    waveId: params.waveId,
    requestText: params.requestText,
    drops: params.drops,
    context: params.context,
    previousSummary: params.previousSummary,
  });
  const costCap = getWaveBriefEstimatedCostCapUsd();
  const estimate = estimateWaveBriefRunCost({
    provider,
    modelName,
    systemPrompt: prompts.systemPrompt,
    userPrompt: prompts.userPrompt,
    maxOutputTokens,
  });

  if (costCap === null) {
    throw Object.assign(
      new Error("MAX_WAVE_BRIEF_ESTIMATED_COST_USD must be a positive number to generate wave check-ins."),
      {
        status: 503,
        code: "wave_brief_cost_cap_invalid",
      },
    );
  }

  if (estimate.estimatedCostUsd === undefined) {
    throw Object.assign(new Error(`Wave check-in cost cap requires pricing for ${provider}/${modelName}.`), {
      status: 422,
    });
  }

  const estimatedCostUsd = estimate.estimatedCostUsd;

  if (estimatedCostUsd > costCap) {
    throw Object.assign(
      new Error(`Estimated wave check-in cost $${estimatedCostUsd.toFixed(2)} exceeds cap $${costCap.toFixed(2)}.`),
      { status: 422 },
    );
  }

  assertProviderConfigured(provider);

  if (provider === "local") {
    const startedAt = Date.now();
    const structured = buildLocalWaveBrief({
      waveId: params.waveId,
      requestText: params.requestText,
      drops: params.drops,
      context: params.context,
      previousSummary: params.previousSummary,
    });
    const renderedOutput = renderWaveBrief(structured);

    return {
      provider,
      modelName,
      rawOutput: JSON.stringify(structured),
      structured,
      renderedOutput,
      promptTokens: estimate.promptTokens,
      completionTokens: estimateTokenCount(renderedOutput),
      costUsd: 0,
      latencyMs: Date.now() - startedAt,
    };
  }

  const startedAt = Date.now();
  const generation = await runProviderCall(`${provider}/${modelName}:wave-brief`, async () =>
    provider === "openai"
      ? generateWithOpenAI({
          modelName,
          systemPrompt: prompts.systemPrompt,
          userPrompt: prompts.userPrompt,
          maxOutputTokens,
        })
      : provider === "anthropic"
        ? generateWithAnthropic({
            modelName,
            systemPrompt: prompts.systemPrompt,
            userPrompt: prompts.userPrompt,
            maxOutputTokens,
          })
        : provider === "google"
          ? generateWithGoogle({
              modelName,
              systemPrompt: prompts.systemPrompt,
              userPrompt: prompts.userPrompt,
              maxOutputTokens,
            })
          : generateWithOllama({
              modelName,
              systemPrompt: prompts.systemPrompt,
              userPrompt: prompts.userPrompt,
              maxOutputTokens,
            }),
  );
  const structured = parseWaveBrief(generation.text);

  return {
    provider,
    modelName,
    rawOutput: generation.text,
    structured,
    renderedOutput: renderWaveBrief(structured),
    promptTokens: generation.promptTokens,
    completionTokens: generation.completionTokens,
    costUsd: generation.costUsd,
    latencyMs: Date.now() - startedAt,
  };
}
