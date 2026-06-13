// Single source of truth for tunable constants and model names.
// Per the PRD: model IDs and the similarity floor must be config values,
// never hardcoded across multiple files.

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  // AI models — three distinct values, even if two currently match.
  // Each is independently swappable with a one-line env change.
  visionModel: optional("VISION_MODEL", "claude-haiku-4-5-20251001"),
  textModel: optional("TEXT_MODEL", "claude-haiku-4-5-20251001"),
  embeddingModel: optional("EMBEDDING_MODEL", "text-embedding-3-small"),

  // Hard semantic similarity floor — single source of truth.
  // Below this, results are hidden entirely ("no results" is valid).
  semanticSimilarityFloor: Number(optional("SEMANTIC_SIMILARITY_FLOOR", "0.75")),

  // Allowed sign-in emails (single-user product, optionally with multiple sign-in emails).
  allowedEmails: optional("ALLOWED_USER_EMAILS", "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  // When set, ALL signed-in allowed users see the data owned by this one canonical
  // user. Lets one person sign in from multiple emails into the same CRM.
  // Leave empty for standard per-user data isolation.
  canonicalOwnerEmail: optional("CANONICAL_OWNER_EMAIL", "").trim().toLowerCase() || null,

  // When set, sign-in requires this exact password (in addition to email being
  // in ALLOWED_USER_EMAILS). The same string is used as the underlying Supabase
  // Auth password, so you never set a password in-app — rotate it by changing
  // this env value and signing in again to re-establish session.
  authPassword: optional("AUTH_PASSWORD", "") || null,

  // When set, requests bearing Authorization: Bearer <this value> bypass cookie
  // auth and operate as the canonical owner. Used by the Chrome extension.
  // Trimmed so stray whitespace in the env var can't break the match.
  extensionApiKey: optional("EXTENSION_API_KEY", "").trim() || null,

  // Absolute base URL of the deployed app, used to build links in outgoing
  // emails (e.g. the contact-update footer). No trailing slash needed.
  appBaseUrl: optional("APP_BASE_URL", "").replace(/\/$/, ""),

  // Shared secret for the inbound-email webhook (Postmark). The webhook URL
  // carries ?token=<this>; requests without it are rejected.
  inboundEmailSecret: optional("INBOUND_EMAIL_SECRET", "").trim() || null,

  resendFromEmail: optional("RESEND_FROM_EMAIL", ""),
} as const;

export function requireApiKeys() {
  return {
    anthropic: required("ANTHROPIC_API_KEY"),
    openai: required("OPENAI_API_KEY"),
    resend: required("RESEND_API_KEY"),
  };
}
