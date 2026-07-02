import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../../../..");

describe("magic-link email contract", () => {
  it("routes token hashes through the application confirmation endpoint", () => {
    const config = readFileSync(
      resolve(projectRoot, "supabase/config.toml"),
      "utf8",
    );
    const template = readFileSync(
      resolve(projectRoot, "supabase/templates/magic_link.html"),
      "utf8",
    );

    expect(config).toContain("[auth.email.template.magic_link]");
    expect(config).toContain(
      'content_path = "./supabase/templates/magic_link.html"',
    );
    expect(template).toContain(
      '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email',
    );
    expect(template).not.toContain("{{ .ConfirmationURL }}");
  });
});
