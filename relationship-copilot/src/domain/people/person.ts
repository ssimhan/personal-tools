import { z } from "zod";

import { err, ok, type Result } from "@/domain/shared/result";

export const supportedChannelTypes = [
  "email",
  "phone",
  "text",
  "whatsapp",
  "slack",
  "linkedin",
] as const;

export type ChannelType = (typeof supportedChannelTypes)[number];

type PersonErrorCode =
  | "invalid_id"
  | "invalid_owner_id"
  | "invalid_display_name"
  | "unsupported_channel";

export interface PersonDomainError {
  readonly code: PersonErrorCode;
  readonly field: "id" | "ownerId" | "displayName" | "type";
}

export interface Person {
  readonly id: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly company: string | null;
  readonly relationshipSummary: string | null;
  readonly notes: string | null;
}

export interface CreatePersonInput {
  readonly id: string;
  readonly ownerId: string;
  readonly displayName: string;
  readonly company?: string | null;
  readonly relationshipSummary?: string | null;
  readonly notes?: string | null;
}

const uuidSchema = z.string().uuid();

export function createPerson(
  input: CreatePersonInput,
): Result<Person, PersonDomainError> {
  if (!uuidSchema.safeParse(input.id).success) {
    return err({ code: "invalid_id", field: "id" });
  }

  if (!uuidSchema.safeParse(input.ownerId).success) {
    return err({ code: "invalid_owner_id", field: "ownerId" });
  }

  const displayName = input.displayName.trim();
  if (!displayName) {
    return err({ code: "invalid_display_name", field: "displayName" });
  }

  return ok(
    Object.freeze({
      id: input.id,
      ownerId: input.ownerId,
      displayName,
      company: trimToNull(input.company),
      relationshipSummary: trimToNull(input.relationshipSummary),
      notes: trimToNull(input.notes),
    }),
  );
}

export function parseChannelType(
  input: string,
): Result<ChannelType, PersonDomainError> {
  if (supportedChannelTypes.includes(input as ChannelType)) {
    return ok(input as ChannelType);
  }

  return err({ code: "unsupported_channel", field: "type" });
}

function trimToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
