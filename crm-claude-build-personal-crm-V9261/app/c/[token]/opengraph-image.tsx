import { ImageResponse } from "next/og";
import { admin } from "@/lib/supabase/admin";

// Per-token social preview image. Slack/Twitter/etc. will pull this when the
// /c/<token> link is pasted, showing the contact's name instead of the generic
// site card.

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { token: string } }) {
  const { token } = params;
  // Same lookup logic as the page: short_token by default, UUID falls back to
  // the legacy contact_token column.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const lookupColumn = isUuid ? "contact_token" : "short_token";
  const { data: person } = await admin()
    .from("people")
    .select("full_name, first_name")
    .eq(lookupColumn, token)
    .maybeSingle();

  const firstName = person?.first_name?.trim() || person?.full_name?.trim().split(/\s+/)[0] || "";
  const headline = firstName ? `${firstName}!` : "Your contact page";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #ffffff 0%, #f4fdf6 100%)",
          padding: "64px 80px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header — green dot + CRM wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              background: "#00d437",
              boxShadow: "0 0 20px rgba(0,212,55,0.45)",
            }}
          />
          <span style={{ fontSize: 36, fontWeight: 700, color: "#111", letterSpacing: -0.5 }}>
            CRM
          </span>
        </div>

        {/* Center — first-name greeting + the longer "what to do here" line */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 24,
          }}
        >
          <span
            style={{
              fontSize: headline.length > 14 ? 112 : 144,
              fontWeight: 700,
              color: "#111",
              letterSpacing: -2,
              lineHeight: 1.0,
            }}
          >
            {headline}
          </span>
          <span
            style={{
              fontSize: 38,
              color: "#444",
              letterSpacing: -0.3,
              lineHeight: 1.25,
              maxWidth: 980,
            }}
          >
            Update your contact info, preferred channel and see how you and Andy can amplify each other
          </span>
        </div>

        {/* Footer — domain on the right */}
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 28, color: "#666" }}>
          crm.andymowat.com
        </div>
      </div>
    ),
    { ...size },
  );
}
