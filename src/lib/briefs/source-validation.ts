type SourceValidation = {
  totalDrops: number;
  referencedDropIds: string[];
  missingDropIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function extractDrops(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (isRecord(payload) && Array.isArray(payload.drops)) {
    return payload.drops;
  }

  return [];
}

function extractDropIdsFromDrops(payload: unknown) {
  return new Set(
    extractDrops(payload)
      .map((drop) => (isRecord(drop) && typeof drop.id === "string" ? drop.id : undefined))
      .filter((id): id is string => Boolean(id)),
  );
}

function addSourceDropIds(value: unknown, target: Set<string>) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      target.add(item.trim());
    }
  }
}

function collectReferences(value: unknown, target: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectReferences(item, target);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (typeof value.drop_id === "string" && value.drop_id.trim()) {
    target.add(value.drop_id.trim());
  }

  addSourceDropIds(value.source_drop_ids, target);

  for (const child of Object.values(value)) {
    collectReferences(child, target);
  }
}

export function validateWaveBriefSources(briefJson: unknown, dropsJson: unknown): SourceValidation {
  const availableDropIds = extractDropIdsFromDrops(dropsJson);
  const referenced = new Set<string>();

  collectReferences(briefJson, referenced);

  const referencedDropIds = [...referenced].sort();

  return {
    totalDrops: availableDropIds.size,
    referencedDropIds,
    missingDropIds: referencedDropIds.filter((id) => !availableDropIds.has(id)),
  };
}
