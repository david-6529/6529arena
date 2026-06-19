import { describe, expect, it } from "vitest";
import { inferWaveTaskWorkflowLabel, waveTaskWorkflowLabels } from "@/lib/workflows/task-workflows";

describe("inferWaveTaskWorkflowLabel", () => {
  it("maps common task language to standard workflow templates", () => {
    expect(inferWaveTaskWorkflowLabel("Confirm grant reviewer for the rubric")).toBe("grants");
    expect(inferWaveTaskWorkflowLabel("Prepare the governance vote summary")).toBe("governance");
    expect(inferWaveTaskWorkflowLabel("Ship the product roadmap fix")).toBe("product/build");
    expect(inferWaveTaskWorkflowLabel("Curate artist mint options")).toBe("art curation");
    expect(inferWaveTaskWorkflowLabel("Write onboarding support docs")).toBe("community support");
    expect(inferWaveTaskWorkflowLabel("Draft meme contest caption")).toBe("meme creation");
  });

  it("returns null when the task does not match a standard workflow", () => {
    expect(inferWaveTaskWorkflowLabel("Check the latest thread")).toBeNull();
  });

  it("keeps labels unique for select controls and rollups", () => {
    expect(new Set(waveTaskWorkflowLabels).size).toBe(waveTaskWorkflowLabels.length);
  });
});
