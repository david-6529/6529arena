import { describe, expect, it } from "vitest";
import { formatDate, formatLatency, formatPercent, formatUsd } from "@/lib/format";

describe("format helpers", () => {
  it("formats percentages, dollars, latency, and missing values consistently", () => {
    expect(formatPercent(0.556)).toBe("56%");
    expect(formatUsd(null)).toBe("n/a");
    expect(formatUsd(0.004)).toBe("$0.0040");
    expect(formatUsd(0.12)).toBe("$0.12");
    expect(formatLatency(undefined)).toBe("n/a");
    expect(formatLatency(950)).toBe("950 ms");
    expect(formatLatency(4_600)).toBe("4.6 s");
  });

  it("formats dates without exposing seconds", () => {
    expect(formatDate(new Date("2026-06-15T12:34:56.000Z"))).toMatch(/Jun 15/);
    expect(formatDate(null)).toBe("n/a");
  });
});
