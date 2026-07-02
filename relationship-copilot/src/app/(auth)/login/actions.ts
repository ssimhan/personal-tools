"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServerClient } from "@/infrastructure/supabase/server-client";

const emailSchema = z.email();

export async function requestMagicLink(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) {
    redirect("/login?error=invalid-email");
  }

  const client = await createServerClient();
  const { error } = await client.auth.signInWithOtp({
    email: email.data,
    options: {
      emailRedirectTo: `${applicationUrl()}/auth/confirm`,
    },
  });

  if (error) {
    redirect("/login?error=magic-link");
  }

  redirect("/login?sent=1");
}

function applicationUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
  );
}
