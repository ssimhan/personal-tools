import { describe, expect, it } from "vitest";

import {
  createPerson,
  parseChannelType,
  supportedChannelTypes,
} from "./person";

const personId = "10000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000001";

describe("person domain", () => {
  it("trims user-entered identity fields and keeps ownership immutable", () => {
    const result = createPerson({
      id: personId,
      ownerId,
      displayName: "  Joan Doe  ",
      company: "  Example Studio  ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: personId,
        ownerId,
        displayName: "Joan Doe",
        company: "Example Studio",
        relationshipSummary: null,
        notes: null,
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

  it("rejects blank names and invalid owner identifiers", () => {
    expect(
      createPerson({ id: personId, ownerId, displayName: "   " }),
    ).toEqual({
      ok: false,
      error: { code: "invalid_display_name", field: "displayName" },
    });

    expect(
      createPerson({ id: personId, ownerId: "not-a-uuid", displayName: "Joan" }),
    ).toEqual({
      ok: false,
      error: { code: "invalid_owner_id", field: "ownerId" },
    });
  });

  it("accepts only the supported relationship channels", () => {
    expect(supportedChannelTypes).toEqual([
      "email",
      "phone",
      "text",
      "whatsapp",
      "slack",
      "linkedin",
    ]);

    for (const channel of supportedChannelTypes) {
      expect(parseChannelType(channel)).toEqual({ ok: true, value: channel });
    }

    expect(parseChannelType("fax")).toEqual({
      ok: false,
      error: { code: "unsupported_channel", field: "type" },
    });
  });
});
