import { Prisma } from "@/generated/prisma/client";
import { dropCreatedAtMs } from "@/lib/6529/normalize";
import type { WaveDrop } from "@/lib/6529/types";
import { prisma } from "@/lib/db/prisma";

const CACHE_CHUNK_SIZE = 1_000;

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function dateFromTimestamp(value: number | undefined) {
  return value ? new Date(value) : null;
}

function compactText(value: string | null | undefined) {
  const text = value?.replace(/\s+/g, " ").trim();

  return text || null;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function cacheWaveDrops(drops: WaveDrop[]) {
  const cachedWaveDrop = prisma?.cachedWaveDrop;

  if (!cachedWaveDrop || !drops.length) {
    return {
      attemptedCount: drops.length,
      cachedCount: 0,
    };
  }

  const uniqueDrops = new Map<string, WaveDrop>();

  for (const drop of drops) {
    if (drop.id && !uniqueDrops.has(drop.id)) {
      uniqueDrops.set(drop.id, drop);
    }
  }

  const rows = [...uniqueDrops.values()]
    .map((drop) => {
      const waveId = drop.source_wave_id?.trim();

      if (!waveId) {
        return null;
      }

      return {
        dropId: drop.id,
        waveId,
        waveName: drop.source_wave_name ?? null,
        sourceRole: drop.source_wave_role ?? null,
        serialNo: drop.serial_no ?? null,
        createdAt6529: dateFromTimestamp(dropCreatedAtMs(drop)),
        updatedAt6529: dateFromTimestamp(drop.updated_at),
        authorHandle: drop.author?.handle ?? null,
        authorDisplay: drop.author?.display ?? null,
        authorWallet: drop.author?.primary_wallet ?? null,
        title: compactText(drop.title),
        content: compactText(drop.content),
        dropType: drop.drop_type ?? null,
        rawJson: toInputJson(drop.raw ?? drop),
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (!rows.length) {
    return {
      attemptedCount: drops.length,
      cachedCount: 0,
    };
  }

  const now = new Date();
  let createdCount = 0;

  for (const rowChunk of chunk(rows, CACHE_CHUNK_SIZE)) {
    const created = await cachedWaveDrop.createMany({
      data: rowChunk,
      skipDuplicates: true,
    });
    createdCount += created.count;

    await cachedWaveDrop.updateMany({
      where: {
        dropId: {
          in: rowChunk.map((row) => row.dropId),
        },
      },
      data: {
        fetchedAt: now,
      },
    });
  }

  return {
    attemptedCount: drops.length,
    cachedCount: rows.length,
    createdCount,
  };
}
