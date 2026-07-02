import Link from "next/link";

export default function HomePage() {
  return (
    <main className="welcome-shell">
      <nav className="welcome-nav" aria-label="Primary navigation">
        <span className="wordmark">Relationship Copilot</span>
        <Link className="sign-in-link" href="/login">
          Sign in
        </Link>
      </nav>

      <section className="welcome-content" aria-labelledby="welcome-title">
        <p className="eyebrow">Trusted relationship memory</p>
        <h1 id="welcome-title">Remember people, clearly.</h1>
        <p className="welcome-summary">
          Keep the context that matters, review every proposed detail, and
          reconnect when the timing feels right.
        </p>

        <div className="trust-note">
          <span className="trust-mark" aria-hidden="true">
            ✓
          </span>
          <p>You approve every detail before it becomes part of your record.</p>
        </div>
      </section>

      <footer className="welcome-footer">
        <p>Private by default. Outreach is drafted, never sent for you.</p>
      </footer>
    </main>
  );
}
