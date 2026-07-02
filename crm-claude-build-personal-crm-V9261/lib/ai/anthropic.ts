import Anthropic from "@anthropic-ai/sdk";
import { config, requireApiKeys } from "@/lib/config";

let _client: Anthropic | null = null;
function client() {
  if (!_client) _client = new Anthropic({ apiKey: requireApiKeys().anthropic });
  return _client;
}

// ---------------------------------------------------------------------------
// Vision / OCR
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  text: string;
  confidence: number; // 0..1
}

const OCR_SYSTEM = `You are an OCR extractor. Given an image, return strictly a JSON object:
{ "text": "<all readable text, preserving order; empty string if none>",
  "confidence": <number from 0 to 1 reflecting how confident you are in the extraction> }

Rules:
- Preserve line breaks where they aid readability.
- Do NOT summarize, interpret, or add commentary. Verbatim text only.
- If the image is empty, blurry, or contains no readable text, return text:"" and a low confidence (<0.3).
- Output only the JSON object. No markdown fences. No prose.`;

export async function extractTextFromImage(opts: {
  base64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}): Promise<ExtractionResult> {
  const resp = await client().messages.create({
    model: config.visionModel,
    max_tokens: 2048,
    system: OCR_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: opts.mediaType, data: opts.base64 } },
          { type: "text", text: "Extract the text from this image." },
        ],
      },
    ],
  });

  const block = resp.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  try {
    const parsed = JSON.parse(raw);
    const text = typeof parsed.text === "string" ? parsed.text : "";
    const confidence = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    return { text, confidence };
  } catch {
    return { text: raw, confidence: raw.length > 0 ? 0.4 : 0 };
  }
}

// ---------------------------------------------------------------------------
// Relationship summary regeneration
// ---------------------------------------------------------------------------

const SUMMARY_SYSTEM = `You maintain a compressed relationship memory for a personal CRM.

Your job: rewrite the relationship summary given the current summary, the permanent notes, and one or more new interactions. Produce a fresh compressed summary, max 1000 characters.

PERSPECTIVE — this is critical:
- The summary is ALWAYS about THIS contact. It is never about you (the CRM owner).
- An interaction may be something YOU wrote (outgoing — e.g. an email or note you sent) or something the contact wrote/said (incoming). Interactions explicitly labeled outgoing (e.g. "[Outgoing email — sent by me]") are in YOUR voice: first person ("I", "my", "I'll", "we") in that text refers to YOU, not the contact.
- NEVER attribute YOUR plans, locations, opinions, or activities to the contact. Example: if an outgoing email from you says "I'll be in Seattle in July", that's YOUR plan, not theirs — do NOT add it to their summary. The contact's summary only gets THEIR plans, opinions, and context.
- An outgoing email may still surface substantive things about the CONTACT (e.g. "I heard you're struggling with Attio" → the contact may be working on/with Attio). Extract only what the email implies about THEM, not about you.
- When direction is ambiguous, be conservative — don't attribute anything to the contact unless the inputs clearly support it.

DO NOT DUPLICATE PERMANENT NOTES — this is critical:
- Permanent notes are shown to the user as their own card, right next to this summary. Restating their content here is duplication and has no value.
- Treat permanent notes as if they were already in the summary. Only write what would still be informative ON TOP of them.
- The summary must ADD context beyond what permanent notes already say. Never restate, paraphrase, or rephrase them — even with cleaner grammar.
- Example: if the note says "Former VC, princeton… bad at replying. running sales at gamma now", do NOT write "Former VC from Princeton. Now running sales at Gamma. Tends to be slow to respond." That's the same information.

CRITICAL — when to write nothing:
- Only record information that is CLEAR, SUBSTANTIVE, ADDITIVE, and NOT already in the permanent notes. If, after removing anything covered by the permanent notes, the current summary and new interactions add nothing substantive, return an EMPTY summary — output nothing at all.
- A bare action with no substance ("pinged with an ask", "reached out", "saw at an event", "sent a note") is NOT summary-worthy on its own. The raw interactions already capture that it happened.
- NEVER pad with placeholders or filler such as "TBD", "context TBD", "expertise TBD", "details unknown", "more to come". If you don't know something, omit it entirely — do not mention that it's unknown.
- BUT do not discard meaningful context that already exists in the current summary just because the new interaction is thin — carry the existing substance forward.

What the summary IS:
- Substantive context about WHO they are and WHAT MATTERS: role, expertise, what they're working on or building, what they care about, recurring themes, the substance of asks they've made, opinions they hold, strategic relevance to the user.
- Durable personal/professional info: family, location, long-term interests, communication style.

What the summary IS NOT:
- The person's name. It is already attached to their record. NEVER write their name, and never begin the summary with it. Refer to them as "they"/"them".
- A restatement of the permanent notes. Anything already captured there must NOT appear here.
- A timeline of meetings. Do NOT include "met at X conference", "saw at Y event", "had coffee on Z date", "intro'd by N", or any other where/when/how-we-met provenance. That history lives in the raw interactions, not here.
- Logistics, scheduling, travel.
- Stale or transient details — drop them by not carrying forward.

Rules:
- Permanent notes are AUTHORITATIVE GROUND TRUTH. If the current summary contradicts a permanent note, the permanent note wins. Never re-introduce a fact contradicted by permanent notes.
- Do not endlessly append. Compress. Prefer fewer, denser sentences.
- Do not invent facts. If something isn't supported by the inputs, leave it out.
- Output ONLY the new summary text, or nothing at all. No preface, no JSON, no quotes, no labels, no name.
- Hard cap: 1000 characters. If you exceed this, you have failed.`;

export interface RegenInput {
  currentSummary: string | null;
  permanentNotes: string | null;
  newInteractions: Array<{ type: string; content: string; createdAt: string }>;
}

export async function regenerateSummary(input: RegenInput): Promise<string> {
  const ixBlock = input.newInteractions
    .map(
      (i, idx) =>
        `Interaction ${idx + 1} (${i.type}, ${i.createdAt}):\n${i.content}`,
    )
    .join("\n\n");

  const userMsg = [
    `Current relationship summary:`,
    input.currentSummary ? input.currentSummary : "(none yet)",
    ``,
    `Permanent notes (AUTHORITATIVE):`,
    input.permanentNotes ? input.permanentNotes : "(none)",
    ``,
    `New interaction(s):`,
    ixBlock,
    ``,
    `Produce the updated relationship summary, or output nothing if there is no substantive, durable context to record. Never include the person's name.`,
  ].join("\n");

  const resp = await client().messages.create({
    model: config.textModel,
    max_tokens: 600,
    system: SUMMARY_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const block = resp.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";
  return text.slice(0, 1000);
}

// ---------------------------------------------------------------------------
// Identity resolution reasoning (Tier 3+)
// ---------------------------------------------------------------------------

const IDENTITY_SYSTEM = `You match an interaction snippet to a candidate person from a CRM. Decide whether the snippet is ABOUT one of the candidates.

Return strictly JSON:
{ "matchedPersonId": "<id or null>", "confidence": <0..1>, "reason": "<short>" }

Rules:
- Only match if there is clear evidence (name + topic match, email referenced, etc.).
- If ambiguous, return matchedPersonId: null with confidence below 0.5.
- Output only JSON.`;

export interface IdentityCandidate {
  id: string;
  full_name: string;
  primary_email: string | null;
  relationship_summary: string | null;
}

export interface IdentityMatch {
  matchedPersonId: string | null;
  confidence: number;
  reason: string;
}

export async function resolveIdentityAI(snippet: string, candidates: IdentityCandidate[]): Promise<IdentityMatch> {
  if (candidates.length === 0) return { matchedPersonId: null, confidence: 0, reason: "no candidates" };
  const userMsg = [
    `Snippet:\n${snippet.slice(0, 4000)}`,
    ``,
    `Candidates:`,
    ...candidates.map(
      (c) =>
        `- id=${c.id} | name=${c.full_name} | email=${c.primary_email ?? ""} | summary=${(c.relationship_summary ?? "").slice(0, 200)}`,
    ),
  ].join("\n");

  const resp = await client().messages.create({
    model: config.textModel,
    max_tokens: 300,
    system: IDENTITY_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });
  const block = resp.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  try {
    const parsed = JSON.parse(raw);
    return {
      matchedPersonId: typeof parsed.matchedPersonId === "string" ? parsed.matchedPersonId : null,
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0,
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
    };
  } catch {
    return { matchedPersonId: null, confidence: 0, reason: "parse error" };
  }
}

// ---------------------------------------------------------------------------
// Broadcast personalization
// ---------------------------------------------------------------------------

const PERSONALIZE_SYSTEM = `You generate light personalization for an outreach email. The user has written a canonical message body. Your job is to produce ONLY a short personalized intro and (optionally) a personalized closing line.

Rules:
- Preserve the user's voice — the canonical body shows their tone. Match it.
- Be subtle and contextual. No artificial intimacy. No "Hope you're doing well!" filler.
- 1-2 short sentences for the intro. The closing is one short line, optional.
- Use the relationship summary, permanent notes, and recent interactions for context.
- If you don't have strong context, return a generic intro like "Hey {firstName}," — do NOT force personalization.
- Return strictly JSON: { "intro": "<text>", "closing": "<text or empty>" }
- Output only the JSON. No markdown fences.`;

export interface PersonalizationContext {
  firstName: string;
  fullName: string;
  relationshipSummary: string | null;
  permanentNotes: string | null;
  recentInteractions: string[]; // already-truncated content snippets
}

export interface PersonalizationResult {
  intro: string;
  closing: string;
}

export async function personalizeBroadcast(
  ctx: PersonalizationContext,
  canonicalBody: string,
): Promise<PersonalizationResult> {
  const hasContext = !!(ctx.relationshipSummary || ctx.permanentNotes || ctx.recentInteractions.length);
  if (!hasContext) {
    return { intro: `Hey ${ctx.firstName},`, closing: "" };
  }

  const userMsg = [
    `Recipient: ${ctx.fullName} (first name: ${ctx.firstName})`,
    ``,
    `Relationship summary: ${ctx.relationshipSummary ?? "(none)"}`,
    `Permanent notes: ${ctx.permanentNotes ?? "(none)"}`,
    `Recent interactions:`,
    ...(ctx.recentInteractions.length ? ctx.recentInteractions.map((s) => `- ${s.slice(0, 300)}`) : ["(none)"]),
    ``,
    `Canonical message body (do NOT rewrite — only generate intro + closing that surround it):`,
    canonicalBody.slice(0, 4000),
  ].join("\n");

  const resp = await client().messages.create({
    model: config.textModel,
    max_tokens: 400,
    system: PERSONALIZE_SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const block = resp.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  try {
    const parsed = JSON.parse(raw);
    return {
      intro: typeof parsed.intro === "string" && parsed.intro.trim() ? parsed.intro.trim() : `Hey ${ctx.firstName},`,
      closing: typeof parsed.closing === "string" ? parsed.closing.trim() : "",
    };
  } catch {
    return { intro: `Hey ${ctx.firstName},`, closing: "" };
  }
}

// ---------------------------------------------------------------------------
// Notes-priority signal (called on permanent_notes save)
// ---------------------------------------------------------------------------

// Score 0..1 estimating how strongly permanent_notes indicate that the user
// has an open thread / unmet need with this contact (an intro, follow-up,
// favor, owed reply, scheduled action). Used as one factor in the Feed's
// priority score. Returns null when notes are empty/whitespace.
const NOTES_PRIORITY_SYSTEM = `You score CRM permanent notes for one signal only:
how strongly does the note indicate the USER wants or expects something specific from this contact — an introduction, a follow-up, a favor, an owed reply, an open ask, a scheduled action, a commitment, a debt.

Output STRICTLY a JSON object: {"score": <number from 0 to 1>}
- 0.0 = notes are purely descriptive (who they are, where they live, traits, history). No open thread.
- 0.5 = mild signal (e.g. "good to stay in touch", "potential collaborator").
- 1.0 = explicit open ask, debt, or action ("owes me intro to X", "follow up on Y", "told me they'd send Z").

No preface, no commentary. Just the JSON object.`;

export async function scoreNotesForAsk(notes: string | null): Promise<number | null> {
  const trimmed = notes?.trim() ?? "";
  if (!trimmed) return null;
  const resp = await client().messages.create({
    model: config.textModel,
    max_tokens: 60,
    system: NOTES_PRIORITY_SYSTEM,
    messages: [{ role: "user", content: `Notes:\n${trimmed.slice(0, 2000)}` }],
  });
  const block = resp.content.find((b) => b.type === "text");
  const raw = block && block.type === "text" ? block.text.trim() : "";
  try {
    const parsed = JSON.parse(raw);
    const s = Number(parsed.score);
    if (!Number.isFinite(s)) return 0;
    return Math.max(0, Math.min(1, s));
  } catch {
    return 0;
  }
}

