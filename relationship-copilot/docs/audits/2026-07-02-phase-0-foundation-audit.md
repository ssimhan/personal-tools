# Phase 0 Foundation Audit: 2026-07-02

## Initial audit status: FAIL

### Blocking findings

1. The primary magic-link button renders normal-sized light text over the coral action color at a measured contrast ratio of 3.83:1, below the WCAG AA requirement of 4.5:1.
2. Supabase's default magic-link template links to `/auth/v1/verify`, while the application confirmation route expects `token_hash` and `type` at `/auth/confirm`. A locally generated email confirmed the mismatch, so the implemented login flow cannot complete as designed without a custom template.
3. `README.md`, `PROJECT_ROADMAP.md`, `PROJECT_HISTORY.md`, and `docs/BUGS.md` still describe Phase 0 as unimplemented after its application, schema, isolation, auth, CI, and UI work was completed.
4. The local database verification workflow required the explicitly approved installation of Docker and Colima, but that prerequisite is not yet documented for the next developer or session.

### Improvements

- The login form needs a pending/disabled state so a slow magic-link request cannot be submitted repeatedly without feedback.
- Supabase auth calls currently rely on the platform's default request behavior; add an explicit timeout policy before treating the authentication boundary as production-ready.
- GitHub Actions are version-tagged rather than commit-pinned. This is acceptable for the current private foundation branch but should be revisited before a broader beta.

### UX and aesthetic review

- Accessibility: 3/4. Semantic structure, focus visibility, keyboard operation, motion reduction, target sizes, and mobile overflow checks pass; primary button contrast fails.
- Performance: 4/4. The shell is small, server-rendered, and contains no unnecessary client bundle or imagery.
- Responsive behavior: 4/4. The welcome and login shells remain readable and overflow-free at 375px.
- Theming: 3/4. Shared OKLCH tokens are coherent; notice/error colors remain local declarations.
- Anti-patterns: 4/4. The Warm + Quiet direction is deliberate and restrained, with no excessive cards, side stripes, glass effects, gradient text, or ornamental clutter.
- Visual score: 18/20. The UI is visually strong but cannot pass while the contrast defect remains.

### Checks run

- Unit tests: 17 passing across 6 files.
- Database tests: 72 passing pgTAP assertions across 3 files.
- Browser tests: 2 passing in Chrome.
- Lint, typecheck, production build, and Node 24.17.0 runtime verification: pass.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Workflow YAML parse, route-manifest comparison, secret scan, tenant-isolation checks, and `git diff --check`: pass.
- Manual in-app Browser review of `/` and `/login`: complete at desktop and mobile widths.
- Local Supabase email inspection: complete with credentials and token values withheld.

## Fix status

All blocking findings are resolved:

- The primary action now uses the deeper coral token and passes a rendered 4.5:1 contrast contract.
- The tracked Supabase template sends token hashes to `/auth/confirm`; the route owns its cookie-bearing response and redirects through the configured application origin.
- A Chrome test now submits the form, reads the local Mailpit message, opens its one-time link, and reaches the protected application.
- Current-facing roadmap, README, history, bug, plan, lesson, and gotcha documentation reflects the implementation and approved Colima prerequisite.
- The login form exposes a disabled pending label, and all Supabase clients use an abort-aware 10-second request deadline with `finally` cleanup.

## Final re-audit status: PASS

### Blocking issues

None.

### Improvements logged

- GitHub Action commit pinning is accepted foundation debt with a Phase 8 hardening target.
- Hosted Supabase template configuration remains a deployment task; the tracked local template and browser contract define the required production value.

### Final checks

- Node 24.17.0 `npm run check`: pass; 20 unit tests across 8 files.
- Local Supabase pgTAP: pass; 72 assertions across 3 files.
- Chrome E2E: pass; 4 tests including contrast and full Mailpit magic-link authentication.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Workflow YAML parse, production route manifest, tenant isolation, secret handling, and `git diff --check`: pass.
- Chrome manual review: one `h1`, 48px primary target, no horizontal overflow, no console warnings/errors, and visual direction remains Warm + Quiet.
- Secondary Computer Use window inspection could not run because the Mac was locked. Chrome DOM, screenshot, console, and E2E checks covered the same product surface.

### Visual re-score

- Accessibility: 4/4.
- Performance: 4/4.
- Responsive behavior: 4/4.
- Theming: 3/4; coherent shared tokens remain, with local semantic notice/error colors.
- Anti-patterns: 4/4.
- Final visual score: 19/20.
