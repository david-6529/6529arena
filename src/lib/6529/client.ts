import { get6529ApiBaseUrl, getBearerToken } from "@/lib/6529/auth";
import { getMockPollDrop, getMockPostDrop, getMockWave, getMockWaveDrops, is6529MockMode } from "@/lib/6529/mock";
import { normalizeWaveDropsResponse } from "@/lib/6529/normalize";
import type { DropPollRequest, PostDropOptions } from "@/lib/6529/types";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  searchParams?: Record<string, string | number | boolean | undefined>;
};

async function apiFetch<T>(path: string, options: RequestOptions = {}) {
  const url = new URL(`${get6529ApiBaseUrl()}${path}`);

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw Object.assign(
      new Error(
        `6529 API request failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`,
      ),
      { status: response.status },
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function getWave(waveId: string) {
  if (is6529MockMode()) {
    return getMockWave(waveId);
  }

  return apiFetch(`/waves/${encodeURIComponent(waveId)}`);
}

export async function search6529WavesByName(query: string, params: { limit?: number } = {}) {
  if (is6529MockMode()) {
    return [getMockWave("mock-wave-alpha")];
  }

  return apiFetch<unknown[]>(`/waves`, {
    searchParams: {
      name: query,
      limit: params.limit ?? 8,
    },
  });
}

export async function getWaveDrops(
  waveId: string,
  params: {
    limit?: number;
    serialNoLimit?: number;
    searchStrategy?: "FIND_OLDER" | "FIND_NEWER";
    dropType?: "CHAT" | "PARTICIPATORY" | "WINNER";
  } = {},
) {
  if (is6529MockMode()) {
    return getMockWaveDrops(waveId);
  }

  const raw = await apiFetch<unknown>(`/v2/waves/${encodeURIComponent(waveId)}/drops`, {
    searchParams: {
      limit: params.limit ?? 30,
      serial_no_limit: params.serialNoLimit,
      search_strategy: params.searchStrategy,
      drop_type: params.dropType,
    },
  });

  return normalizeWaveDropsResponse(raw);
}

export async function searchWaveDrops(
  waveId: string,
  query: string,
  params: { page?: number; size?: number } = {},
) {
  if (is6529MockMode()) {
    return getMockWaveDrops(waveId);
  }

  const raw = await apiFetch<unknown>(`/v2/waves/${encodeURIComponent(waveId)}/search`, {
    searchParams: {
      term: query,
      page: params.page ?? 1,
      size: params.size ?? 20,
    },
  });

  return normalizeWaveDropsResponse(raw);
}

export async function postDrop(waveId: string, content: string, options: PostDropOptions = {}) {
  if (is6529MockMode()) {
    return getMockPostDrop(waveId, content, options);
  }

  const token = await getBearerToken();
  const signerAddress = process.env["6529_BOT_WALLET_ADDRESS"];

  if (!signerAddress) {
    throw new Error("6529_BOT_WALLET_ADDRESS is required to post a drop.");
  }

  return apiFetch("/drops", {
    method: "POST",
    token,
    body: {
      title: null,
      wave_id: waveId,
      drop_type: options.dropType ?? (options.poll ? "PARTICIPATORY" : "CHAT"),
      parts: [
        {
          content,
          quoted_drop: null,
          media: [],
          attachments: [],
        },
      ],
      referenced_nfts: [],
      mentioned_users: [],
      mentioned_waves: [],
      metadata: [],
      signature: null,
      is_safe_signature: false,
      signer_address: signerAddress,
      reply_to: options.replyToDropId
        ? {
            drop_id: options.replyToDropId,
            drop_part_id: 1,
          }
        : undefined,
      poll: options.poll,
    },
  });
}

export async function createDirectMessageWave(identityAddresses: string[]) {
  if (is6529MockMode()) {
    return {
      id: `mock-dm-${Date.now()}`,
      identity_addresses: identityAddresses,
      source: "fixture",
    };
  }

  const token = await getBearerToken();

  return apiFetch("/waves/direct-message/new", {
    method: "POST",
    token,
    body: {
      identity_addresses: identityAddresses,
    },
  });
}

export async function createPollDrop(
  waveId: string,
  content: string,
  poll: DropPollRequest,
  options: Omit<PostDropOptions, "poll" | "dropType"> = {},
) {
  if (is6529MockMode()) {
    return getMockPollDrop(waveId, content, poll, options);
  }

  return postDrop(waveId, content, {
    ...options,
    poll,
    dropType: "PARTICIPATORY",
  });
}

export async function getWaveLeaderboard(waveId: string) {
  if (is6529MockMode()) {
    return {
      wave_id: waveId,
      source: "fixture",
      leaderboard: [],
    };
  }

  return apiFetch(`/v2/waves/${encodeURIComponent(waveId)}/leaderboard`);
}

export async function getWaveDecisions(waveId: string) {
  if (is6529MockMode()) {
    return {
      wave_id: waveId,
      source: "fixture",
      decisions: [],
    };
  }

  return apiFetch(`/v2/waves/${encodeURIComponent(waveId)}/decisions`);
}
