import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const typedPassword = String(formData.get("password") ?? "");
  if (!email || !typedPassword) return;

  if (config.allowedEmails.length && !config.allowedEmails.includes(email)) {
    redirect("/login?error=not_allowed");
  }

  // When AUTH_PASSWORD is set, sign-in requires that exact string.
  // The same string is also used as the underlying Supabase Auth password, so
  // there's no separate "set your password" step.
  if (config.authPassword && typedPassword !== config.authPassword) {
    redirect("/login?error=wrong_password");
  }
  const supabasePassword = config.authPassword ?? typedPassword;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: supabasePassword });
  if (error) {
    // First sign-in for this email — create the Supabase Auth account using the same password.
    const { error: signUpError } = await supabase.auth.signUp({ email, password: supabasePassword });
    if (signUpError) redirect(`/login?error=${encodeURIComponent(signUpError.message)}`);
    // Sign in immediately so the session cookie is set on this request.
    const { error: postSignInErr } = await supabase.auth.signInWithPassword({ email, password: supabasePassword });
    if (postSignInErr) redirect(`/login?error=${encodeURIComponent(postSignInErr.message)}`);
  }
  redirect("/");
}

function errorMessage(code: string): string {
  const decoded = decodeURIComponent(code);
  if (decoded === "not_allowed") return "That email isn't on the allowlist.";
  if (decoded === "wrong_password") return "Wrong password.";
  return decoded;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            {error ? <p className="text-sm text-destructive">{errorMessage(error)}</p> : null}
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
