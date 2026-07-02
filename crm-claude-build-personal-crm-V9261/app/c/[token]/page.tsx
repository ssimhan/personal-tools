import type { Metadata } from "next";
import { admin } from "@/lib/supabase/admin";
import { PublicContactForm } from "./_public-form";

export const dynamic = "force-dynamic";

// Per-token social preview: the title/description show the contact's name so
// pasting the link into Slack / messages shows "Charlie Graham's contact page"
// instead of a generic site card. The matching opengraph-image.tsx in this
// folder renders the image. Slack/etc. read these meta tags automatically.
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const lookupColumn = isUuid ? "contact_token" : "short_token";
  const { data: person } = await admin()
    .from("people")
    .select("full_name")
    .eq(lookupColumn, token)
    .maybeSingle();

  const name = person?.full_name?.trim();
  const title = name ? `${name}'s contact page` : "Contact page";
  const description = "Update your contact info, preferred channel and see how you and Andy can amplify each other.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicContactPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = admin();
  // Look up by short_token (new short URL) OR contact_token UUID (legacy URLs
  // already sent in old broadcast emails). UUIDs have a fixed shape; everything
  // else is treated as a short token.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  const lookupColumn = isUuid ? "contact_token" : "short_token";
  const { data: person } = await db
    .from("people")
    .select("id, first_name, full_name, primary_email, phone_number, linkedin_url, slack_channel, text_method, preferred_channel, accepts_asks")
    .eq(lookupColumn, token)
    .maybeSingle();

  if (!person) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Link expired</h1>
          <p className="text-sm text-muted-foreground">
            This contact link is no longer valid. If you were trying to update your details,
            just reply to the message that brought you here.
          </p>
        </div>
      </main>
    );
  }

  const firstName = person.first_name?.trim() || person.full_name.split(/\s+/)[0] || "there";

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-md mx-auto space-y-4">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Hi {firstName} 👋</h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s the contact info I have for you — feel free to update it anytime.
          </p>
          <p className="text-sm text-muted-foreground">
            And let me know the channel you prefer. Mine is{" "}
            <a href="mailto:andy@whispered.com" className="text-blue-600 underline">email</a> or{" "}
            <a href="https://www.linkedin.com/in/amowat/" target="_blank" rel="noreferrer" className="text-blue-600 underline">LinkedIn</a>{" "}
            but I&apos;m happy to default to your favorite channel.
          </p>
          <p className="text-sm text-muted-foreground">
            Andy<br />
            415-666-0200 <span className="opacity-80">(although I&apos;m best on email/LinkedIn ;)</span>
          </p>
        </div>

        <PublicContactForm
          token={token}
          hasSlack={!!person.slack_channel}
          initial={{
            primary_email: person.primary_email,
            phone_number: person.phone_number,
            linkedin_url: person.linkedin_url,
            text_method: (person.text_method as "sms" | "whatsapp" | null) ?? null,
            preferred_channel: (person.preferred_channel as PreferredChannel | null) ?? null,
            accepts_asks: (person.accepts_asks as boolean | null) ?? null,
          }}
        />

        {/* Sign-off footer below the form card. */}
        <div className="text-xs text-muted-foreground pt-2 space-y-2">
          <p className="text-center">P.S. Check out our 3 Whispered applications (the family is growing)</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <a href="https://www.whispered.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Whispered</a>{" "}
              the deepest database of unposted GTM roles and the network to reach them.
            </li>
            <li>
              <a href="https://www.whisperedevents.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Whispered Events</a>{" "}
              find exclusive in-person events for free.{" "}
              <span className="font-bold text-green-600 dark:text-green-400">LIVE — SIGNUP NOW</span>
            </li>
            <li>
              <a href="https://whisperednetwork.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Whispered Network</a>{" "}
              endorse the best people you know and tap into their network.{" "}
              <span className="font-bold text-green-600 dark:text-green-400">BETA — PING ME FOR INVITE</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

type PreferredChannel = "email" | "linkedin" | "phone" | "slack" | "text";
