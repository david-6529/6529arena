import { describe, expect, it } from "vitest";
import { escapeCsvValue, toCsv } from "@/lib/csv";

describe("csv helpers", () => {
  it("escapes quotes, commas, and line breaks", () => {
    expect(escapeCsvValue("hello, \"arena\"\nnext")).toBe("\"hello, \"\"arena\"\"\nnext\"");
  });

  it("serializes rows with headers", () => {
    const csv = toCsv(
      [
        { id: "a", score: 1 },
        { id: "b", score: 2 },
      ],
      [
        { header: "ID", value: (row) => row.id },
        { header: "Score", value: (row) => row.score },
      ],
    );

    expect(csv).toBe("ID,Score\na,1\nb,2");
  });
});
