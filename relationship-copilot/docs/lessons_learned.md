# Lessons Learned

## 2026-07-02 Phase 0 foundation

### Prove authentication through the actual delivery path

The route and cookie adapters looked correct in isolation, but the default email template never supplied the token hash the route expected. A local Mailpit browser test that submits the form, opens the delivered link, and reaches the protected page is the durable contract.

### Canonical origins are part of authentication correctness

`localhost` and `127.0.0.1` are operationally similar but different cookie origins. Auth email URLs, route redirects, E2E base URLs, and deployment configuration should share one explicit application URL.

### Infrastructure prerequisites belong in product documentation

The local database suite was blocked until a Docker-compatible runtime was installed. Because this affects every future schema and auth change, the approved Colima setup and reduced Supabase command now live in the README and project history.

### A successful cached install does not prove lockfile portability

The initial lockfile captured the laptop's OpenAI-internal npm firewall in every resolved tarball URL. Host inventory plus a clean Node 24 install against `registry.npmjs.org` is the relevant closeout proof for a personal repository.

## 2026-07-02 planning session

### Separate inspiration from requirements

The friend's CRM and Bob CRM initially pulled the conversation toward adapting their visible features. The correct product direction emerged only after explicitly treating both as inspiration and returning to Sandhya's real workflow.

### Prefer a clean integration branch for divergent histories

The historical `CRM` branch contained both the imported CRM and older Gmail changes. Merging it directly into `main` would have reintroduced unrelated conflicts. A branch from current `main` that restored only the CRM subtree produced the correct reviewable diff.

### Git transport and GitHub CLI authentication are separate

SSH push succeeded through the personal Git alias while `gh pr create` failed because GitHub CLI had no authenticated account. PR instructions should check both states before presenting a single terminal sequence.

### Validate large planning sets mechanically

The roadmap contained nine plans and nearly one hundred chunks. Counting plans, blocks, success-criteria sections, RED steps, and explicit non-code exceptions caught structural omissions that prose review alone would miss.

### Planning completion is not implementation completion

At planning closeout, the new product directory contained only roadmap and plan artifacts. Current-facing documentation should always distinguish completed planning from the implementation state that exists at the time.
