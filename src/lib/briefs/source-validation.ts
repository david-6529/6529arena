export type SourceReference = {
  dropId: string;
  path: string;
  section: string;
};

type SourceValidation = {
  totalDrops: number;
  referencedDropIds: string[];
  missingDropIds: string[];
  references: SourceReference[];
  missingReferences: SourceReference[];
};

const sectionLabels: Record<string, string> = {
  action_items: "Action items",
  changes_since_previous: "Changes since previous",
  citations: "Citations",
  decisions_needed: "Decisions needed",
  open_questions: "Open questions",
  risks: "Risks",
  source_drop_ids: "Source drops",
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

function buildValidation(availableDropIds: Set<string>, references: SourceReference[]): SourceValidation {
  const referencedDropIds = [...new Set(references.map((reference) => reference.dropId))].sort();
  const missingDropIds = referencedDropIds.filter((id) => !availableDropIds.has(id));
  const missingDropIdSet = new Set(missingDropIds);

  return {
    totalDrops: availableDropIds.size,
    referencedDropIds,
    missingDropIds,
    references,
    missingReferences: references.filter((reference) => missingDropIdSet.has(reference.dropId)),
  };
}

function sectionFromPath(path: string) {
  const root = path.split(/[.[\]]/).find(Boolean) ?? "source_drop_ids";
  const index = path.match(/^[^\[]+\[(\d+)\]/)?.[1];
  const label = sectionLabels[root] ?? root.replaceAll("_", " ");

  return index === undefined ? label : `${label} #${Number(index) + 1}`;
}

function addReference(dropId: string, path: string, target: SourceReference[]) {
  target.push({
    dropId,
    path,
    section: sectionFromPath(path),
  });
}

function addSourceDropIds(value: unknown, path: string, target: SourceReference[]) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      addReference(item.trim(), path, target);
    }
  }
}

function collectReferences(value: unknown, target: SourceReference[], path = "") {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      collectReferences(item, target, `${path}[${index}]`);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (typeof value.drop_id === "string" && value.drop_id.trim()) {
    addReference(value.drop_id.trim(), path ? `${path}.drop_id` : "drop_id", target);
  }

  addSourceDropIds(value.source_drop_ids, path ? `${path}.source_drop_ids` : "source_drop_ids", target);

  for (const [key, child] of Object.entries(value)) {
    collectReferences(child, target, path ? `${path}.${key}` : key);
  }
}

export function validateWaveBriefSources(briefJson: unknown, dropsJson: unknown): SourceValidation {
  const availableDropIds = extractDropIdsFromDrops(dropsJson);
  const references: SourceReference[] = [];

  collectReferences(briefJson, references);

  return buildValidation(availableDropIds, references);
}

function normalizeContentDropId(raw: string) {
  return raw
    .trim()
    .replace(/^["'`[(]+/, "")
    .replace(/[,"'`).\]]+$/, "")
    .trim();
}

function splitContentDropIds(raw: string) {
  return raw
    .split(/,|;|\s+and\s+/i)
    .map(normalizeContentDropId)
    .filter((id) => id.length > 0);
}

function collectContentReferences(content: string) {
  const references: SourceReference[] = [];
  const lines = content.split(/\r?\n/);
  let currentSection = "Content";
  let inCitations = false;

  for (const [lineIndex, line] of lines.entries()) {
    const heading = line.match(/^\*\*(.+?)\*\*$/);

    if (heading) {
      currentSection = heading[1]?.trim() || "Content";
      inCitations = currentSection.toLowerCase() === "citations";
      continue;
    }

    const sourceMatch = line.match(/\bSources?\s*(?:drops?)?:\s*([^\n]+)/i);

    if (sourceMatch?.[1]) {
      for (const [sourceIndex, dropId] of splitContentDropIds(sourceMatch[1]).entries()) {
        references.push({
          dropId,
          path: `content.line${lineIndex + 1}.sources[${sourceIndex}]`,
          section: currentSection,
        });
      }
    }

    if (inCitations) {
      const citationMatch = line.match(/^-\s*([^:\s]+)\s*:/);

      if (citationMatch?.[1]) {
        references.push({
          dropId: normalizeContentDropId(citationMatch[1]),
          path: `content.citations.line${lineIndex + 1}`,
          section: "Citations",
        });
      }
    }
  }

  return references;
}

export function validateWaveBriefContentSources(content: string, dropsJson: unknown): SourceValidation {
  return buildValidation(extractDropIdsFromDrops(dropsJson), collectContentReferences(content));
}
