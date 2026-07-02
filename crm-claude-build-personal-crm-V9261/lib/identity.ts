import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveIdentityAI, type IdentityCandidate } from "@/lib/ai/anthropic";

// 4-tier identity resolution per PRD §Identity Resolution.
// Tier 1: exact LinkedIn match (auto)
// Tier 2: exact email match (auto)
// Tier 3: exact name match (always surfaced as ambiguous, never auto-merged)
// Tier 4: AI similarity (never auto-merges)

export interface ResolveInput {
  linkedinUrl?: string | null;
  email?: string | null;
  fullName?: string | null;
  snippet?: string | null; // raw content for Tier 4 AI matching
}

export type ResolveResult =
  | { kind: "matched"; personId: string; tier: 1 | 2 | 3; confidence: number }
  | { kind: "ambiguous"; candidateIds: string[]; reason: string }
  | { kind: "suggested"; personId: string; confidence: number; reason: string }
  | { kind: "none" };

export async function resolveIdentity(supabase: SupabaseClient, input: ResolveInput): Promise<ResolveResult> {
  // Tier 1: LinkedIn
  if (input.linkedinUrl && input.linkedinUrl.trim()) {
    const url = normalizeLinkedIn(input.linkedinUrl);
    const { data } = await supabase
      .from("people")
      .select("id")
      .eq("linkedin_url", url)
      .limit(2);
    if (data && data.length === 1) return { kind: "matched", personId: data[0].id, tier: 1, confidence: 1 };
    if (data && data.length > 1) return { kind: "ambiguous", candidateIds: data.map((d) => d.id), reason: "multiple linkedin matches" };
  }

  // Tier 2: email
  if (input.email && input.email.trim()) {
    const email = input.email.trim().toLowerCase();
    const { data: primary } = await supabase
      .from("people")
      .select("id")
      .ilike("primary_email", email)
      .limit(2);
    if (primary && primary.length === 1) return { kind: "matched", personId: primary[0].id, tier: 2, confidence: 1 };
    if (primary && primary.length > 1) return { kind: "ambiguous", candidateIds: primary.map((d) => d.id), reason: "multiple email matches" };

    // Secondary emails (text[] contains)
    const { data: secondary } = await supabase
      .from("people")
      .select("id")
      .contains("secondary_emails", [email])
      .limit(2);
    if (secondary && secondary.length === 1) return { kind: "matched", personId: secondary[0].id, tier: 2, confidence: 0.95 };
    if (secondary && secondary.length > 1) return { kind: "ambiguous", candidateIds: secondary.map((d) => d.id), reason: "multiple secondary email matches" };
  }

  // Tier 3: exact name match — NEVER auto-merge. Surface as ambiguous so the
  // user picks "use existing" or "create new" — protects against the
  // "Allison Pickens already exists, don't create a duplicate" case.
  if (input.fullName) {
    const { data: byName } = await supabase
      .from("people")
      .select("id")
      .ilike("full_name", input.fullName.trim())
      .limit(5);
    if (byName && byName.length > 0) {
      return {
        kind: "ambiguous",
        candidateIds: byName.map((d) => d.id),
        reason: byName.length === 1 ? "name already exists" : "multiple name matches",
      };
    }
  }

  // Tier 4: AI similarity over candidates with similar names
  if (input.snippet && input.fullName) {
    const { data: candidates } = await supabase
      .from("people")
      .select("id, full_name, primary_email, relationship_summary")
      .ilike("full_name", `%${input.fullName.trim()}%`)
      .limit(8);
    if (candidates && candidates.length) {
      const ai = await resolveIdentityAI(input.snippet, candidates as IdentityCandidate[]);
      if (ai.matchedPersonId && ai.confidence >= 0.7) {
        return { kind: "suggested", personId: ai.matchedPersonId, confidence: ai.confidence, reason: ai.reason };
      }
    }
  }

  return { kind: "none" };
}

export function normalizeLinkedIn(url: string): string {
  // Drop query string / hash, trailing slash, and lowercase — so tracking
  // params and casing don't create false mismatches.
  const base = url.trim().split("?")[0].split("#")[0];
  return base.replace(/\/$/, "").toLowerCase();
}

// extractLinkedIn/email pulls identifiers out of a free-text snippet — used when
// the user pastes an email or a screenshot's extracted text without specifying
// who it's about.
export function sniffIdentifiers(text: string): { linkedin?: string; email?: string } {
  const linkedin = text.match(/linkedin\.com\/in\/[A-Za-z0-9_\-%]+/i)?.[0];
  const email = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  return {
    linkedin: linkedin ? `https://${linkedin}` : undefined,
    email: email?.toLowerCase(),
  };
}
