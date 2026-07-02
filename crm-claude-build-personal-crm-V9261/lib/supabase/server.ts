import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { config } from "@/lib/config";
import { admin, getCanonicalOwnerId, getExtensionOwnerId } from "@/lib/supabase/admin";

type SetCookie = { name: string; value: string; options: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: SetCookie[]) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component — Next.js forbids setting cookies there.
            // Safe to ignore; middleware refreshes the session.
          }
        },
      },
    },
  );
}

export async function requireUser() {
  const cookieClient = await createClient();
  const { data, error } = await cookieClient.auth.getUser();
  if (error || !data.user) redirect("/login");

  // When a canonical owner is configured, all allowed users access the SAME
  // dataset: we return the service-role client (bypasses RLS) and pin owner_id
  // to the canonical user. Bootstrap rule: the canonical email must sign in
  // first so its auth.users row exists.
  if (config.canonicalOwnerEmail) {
    if (data.user.email?.toLowerCase() === config.canonicalOwnerEmail) {
      // The canonical user is signing in — use their id directly (also primes cache).
      return { supabase: admin(), user: data.user, ownerId: data.user.id };
    }
    const ownerId = await getCanonicalOwnerId();
    return { supabase: admin(), user: data.user, ownerId };
  }

  // No canonical owner — each user owns their own data via RLS.
  return { supabase: cookieClient, user: data.user, ownerId: data.user.id };
}

// API-route variant of requireUser. Accepts EITHER:
//   - Authorization: Bearer <EXTENSION_API_KEY> (used by the Chrome extension),
//     in which case the caller acts as the canonical owner with admin/service-role client
//   - the same Supabase session cookie as the web app
//
// Unlike requireUser(), this returns a Response on auth failure instead of
// redirecting — appropriate for fetch callers (extension, programmatic clients).
// Usage at the top of a route handler:
//
//   const auth = await requireUserOrApiKey(req);
//   if (auth instanceof Response) return auth;
//   const { supabase, ownerId } = auth;
export async function requireUserOrApiKey(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (config.extensionApiKey && token && token === config.extensionApiKey) {
      try {
        const ownerId = await getExtensionOwnerId();
        return { supabase: admin(), user: null, ownerId, viaApiKey: true as const };
      } catch (e) {
        return new Response(
          JSON.stringify({ error: e instanceof Error ? e.message : "owner lookup failed" }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }
    }
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // Cookie auth path
  const cookieClient = await createClient();
  const { data, error } = await cookieClient.auth.getUser();
  if (error || !data.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  if (config.canonicalOwnerEmail) {
    if (data.user.email?.toLowerCase() === config.canonicalOwnerEmail) {
      return { supabase: admin(), user: data.user, ownerId: data.user.id, viaApiKey: false as const };
    }
    const ownerId = await getCanonicalOwnerId();
    return { supabase: admin(), user: data.user, ownerId, viaApiKey: false as const };
  }

  return { supabase: cookieClient, user: data.user, ownerId: data.user.id, viaApiKey: false as const };
}
