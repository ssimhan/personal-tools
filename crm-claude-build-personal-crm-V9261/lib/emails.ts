// Heuristic check: does an email plausibly belong to someone with this name?
//
// Returns true when the email's local-part has no overlap with the person's
// name tokens — e.g. amowat@gmail.com vs "Allison Pickens" → looks mismatched.
//
// Designed to catch the obvious "I typed in my own email by mistake" case
// without false-flagging common patterns (apickens, allison.p, alli@..., etc.)
// since substring matching in either direction handles initial+lastname,
// nickname truncations, etc.
export function emailLooksMismatched(
  email: string,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): boolean {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (!local) return false;

  const emailTokens = local.split(/[^a-z]+/).filter((t) => t.length >= 2);
  if (emailTokens.length === 0) return false; // numeric-only local-part, can't judge

  const nameTokens = [firstName, lastName]
    .filter((s): s is string => !!s)
    .flatMap((n) => n.toLowerCase().split(/\s+/))
    .filter((t) => t.length >= 2);
  if (nameTokens.length === 0) return false; // no name to compare against

  for (const nameTok of nameTokens) {
    for (const emailTok of emailTokens) {
      if (emailTok.includes(nameTok) || nameTok.includes(emailTok)) return false;
    }
  }
  return true;
}
