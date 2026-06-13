import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "@/lib/config";

// Service-role client — bypasses RLS. Use ONLY in server code, never client-side.
// Used when we need to read/write data owned by a canonical user, regardless of
// which allowed user is currently signed in.
let _admin: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

// Resolve the canonical owner's auth user id from their email. Cached in-process.
// Throws a friendly error if the canonical user hasn't signed in yet — they must
// sign in first to bootstrap their Supabase Auth account.
let _canonicalOwnerId: string | null = null;
export async function getCanonicalOwnerId(): Promise<string> {
  if (_canonicalOwnerId) return _canonicalOwnerId;
  if (!config.canonicalOwnerEmail) {
    throw new Error("CANONICAL_OWNER_EMAIL not configured");
  }
  return _canonicalOwnerId = await lookupUserIdByEmail(config.canonicalOwnerEmail);
}

// Resolve the owner id for extension (API-key) requests.
// Order of preference:
//   1. CANONICAL_OWNER_EMAIL if set (multi-email-into-one-CRM setups)
//   2. The single email in ALLOWED_USER_EMAILS if exactly one is configured
//      (the common single-user case)
// Throws if neither can be resolved.
let _extensionOwnerId: string | null = null;
export async function getExtensionOwnerId(): Promise<string> {
  if (_extensionOwnerId) return _extensionOwnerId;
  if (config.canonicalOwnerEmail) {
    return _extensionOwnerId = await getCanonicalOwnerId();
  }
  if (config.allowedEmails.length === 1) {
    return _extensionOwnerId = await lookupUserIdByEmail(config.allowedEmails[0]);
  }
  throw new Error(
    "Set CANONICAL_OWNER_EMAIL, or ensure ALLOWED_USER_EMAILS contains exactly one email, so the extension knows whose data to operate on.",
  );
}

async function lookupUserIdByEmail(email: string): Promise<string> {
  const target = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Failed to list users: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found.id;
    if (data.users.length < 1000) break;
    page++;
  }
  throw new Error(
    `User ${email} has not signed in yet. Sign in with that email on the web app first to create the account.`,
  );
}
