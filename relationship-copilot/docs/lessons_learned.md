# Lessons Learned

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

The new product directory contains only roadmap and plan artifacts. Current-facing documentation must repeat that no product code, connector, database, or deployment exists yet.
