import { describe, expect, it } from "vitest";

import { createInteraction } from "./interaction";

const interactionId = "20000000-0000-4000-8000-000000000001";
const personId = "10000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000001";

describe("interaction domain", () => {
  it("normalizes a sourced interaction and freezes its ownership", () => {
    const result = createInteraction({
      id: interactionId,
      ownerId,
      personId,
      type: "  meeting  ",
      occurredAt: "2026-07-02T18:00:00-07:00",
      summary: "  Talked about content workflows.  ",
      sourceRecordId: null,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: interactionId,
        ownerId,
        personId,
        type: "meeting",
        occurredAt: "2026-07-03T01:00:00.000Z",
        summary: "Talked about content workflows.",
        sourceRecordId: null,
      },
    });

    if (result.ok) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(() => {
        (result.value as { ownerId: string }).ownerId =
          "00000000-0000-4000-8000-000000000002";
      }).toThrow();
    }
  });

  it("rejects invalid timestamps", () => {
    expect(
      createInteraction({
        id: interactionId,
        ownerId,
        personId,
        type: "meeting",
        occurredAt: "tonight-ish",
        summary: "Talked about content workflows.",
      }),
    ).toEqual({
      ok: false,
      error: { code: "invalid_occurred_at", field: "occurredAt" },
    });
  });

  it("rejects summaries that are blank or unsafe to persist", () => {
    expect(
      createInteraction({
        id: interactionId,
        ownerId,
        personId,
        type: "meeting",
        occurredAt: "2026-07-03T01:00:00.000Z",
        summary: "   ",
      }),
    ).toEqual({
      ok: false,
      error: { code: "invalid_summary", field: "summary" },
    });

    expect(
      createInteraction({
        id: interactionId,
        ownerId,
        personId,
        type: "meeting",
        occurredAt: "2026-07-03T01:00:00.000Z",
        summary: "Unsafe\u0000summary",
      }),
    ).toEqual({
      ok: false,
      error: { code: "invalid_summary", field: "summary" },
    });
  });
});
