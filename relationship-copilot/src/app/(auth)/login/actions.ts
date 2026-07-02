"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { applicationUrl } from "@/config/application-url";
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
      emailRedirectTo: applicationUrl("/auth/confirm").toString(),
    },
  });

  if (error) {
    redirect("/login?error=magic-link");
  }

  redirect("/login?sent=1");
}
