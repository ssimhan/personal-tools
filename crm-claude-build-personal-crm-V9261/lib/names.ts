// Tiny helpers for composing/splitting display names. first_name and last_name
// are the source of truth when present; full_name is the composed display form.

export function composeFullName(first: string | null | undefined, last: string | null | undefined): string {
  return [first?.trim(), last?.trim()].filter(Boolean).join(" ").trim();
}

export function splitFullName(full: string): { first: string; last: string | null } {
  const trimmed = full.trim();
  if (!trimmed) return { first: "", last: null };
  const idx = trimmed.indexOf(" ");
  if (idx === -1) return { first: trimmed, last: null };
  return { first: trimmed.slice(0, idx), last: trimmed.slice(idx + 1).trim() || null };
}
