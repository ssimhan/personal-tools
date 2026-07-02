import Link from "next/link";

import { requestMagicLink } from "./actions";
import { SubmitButton } from "./submit-button";

interface LoginPageProps {
  readonly searchParams: Promise<{
    error?: string;
    sent?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const state = await searchParams;

  return (
    <main className="auth-shell">
      <section className="auth-content" aria-labelledby="login-title">
        <Link className="auth-wordmark" href="/">
          Relationship Copilot
        </Link>
        <p className="eyebrow">Private relationship memory</p>
        <h1 id="login-title">Sign in with your email.</h1>
        <p className="auth-summary">
          We will send a secure link. No shared password, no canonical account.
        </p>

        {state.sent === "1" ? (
          <p className="auth-notice" role="status">
            Check your inbox for the sign-in link.
          </p>
        ) : null}
        {state.error ? (
          <p className="auth-error" role="alert">
            {state.error === "invalid-email"
              ? "Enter a valid email address."
              : "We could not send the link. Please try again."}
          </p>
        ) : null}

        <form className="auth-form" action={requestMagicLink}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
          />
          <SubmitButton />
        </form>
      </section>
    </main>
  );
}
