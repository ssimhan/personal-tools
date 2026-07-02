import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { applicationUrl } from "@/config/application-url";
import { createRouteHandlerClient } from "@/infrastructure/supabase/server-client";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const response = NextResponse.redirect(applicationUrl("/app"));
    const client = createRouteHandlerClient(request, response);
    const { error } = await client.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(applicationUrl("/login?error=magic-link"));
}
