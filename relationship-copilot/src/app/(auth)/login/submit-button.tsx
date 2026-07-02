"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} aria-live="polite">
      {pending ? "Sending secure link…" : "Email me a sign-in link"}
    </button>
  );
}
