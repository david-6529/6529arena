import mockWaveDropsFixture from "@/lib/6529/fixtures/mock-wave-drops.json";
import { normalizeWaveDropsResponse } from "@/lib/6529/normalize";
import type { DropPollRequest, PostDropOptions } from "@/lib/6529/types";

export function is6529MockMode() {
  return process.env["6529_MOCK_MODE"] === "true";
}

export function getMockWave(waveId: string) {
  return {
    id: waveId,
    name: "Mock 6529 Agent Arena Wave",
    source: "fixture",
  };
}

export function getMockWaveDrops(waveId: string) {
  return normalizeWaveDropsResponse({
    ...mockWaveDropsFixture,
    wave: {
      ...mockWaveDropsFixture.wave,
      id: waveId,
    },
  });
}

export function getMockPostDrop(
  waveId: string,
  content: string,
  options: PostDropOptions = {},
) {
  return {
    id: `mock-post-${Date.now()}`,
    wave_id: waveId,
    content,
    drop_type: options.dropType ?? (options.poll ? "PARTICIPATORY" : "CHAT"),
    reply_to_drop_id: options.replyToDropId ?? null,
    poll: options.poll ?? null,
    source: "fixture",
  };
}

export function getMockPollDrop(waveId: string, content: string, poll: DropPollRequest, options: Omit<PostDropOptions, "poll" | "dropType"> = {}) {
  return getMockPostDrop(waveId, content, {
    ...options,
    poll,
    dropType: "PARTICIPATORY",
  });
}
