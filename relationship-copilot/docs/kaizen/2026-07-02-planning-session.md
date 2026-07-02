1. Target workflow: brainstorm
   Where: Discovery
   Edit:
   Before deriving requirements from examples, inherited code, screenshots, or competitor products, classify each input as `inspiration`, `baseline code`, `constraint`, or `approved requirement`. Reflect the classification to the user and do not promote inspiration into scope without explicit confirmation.

2. Target workflow: plan
   Where: Pre-Plan Checks
   Edit:
   When the planned work originates on a historical or long-lived branch, inspect its merge base with the intended target and list changed top-level paths. If unrelated history overlaps the target, plan a clean integration branch or subtree import before recommending a pull request.

3. Target workflow: plan
   Where: Plan Structure
   Edit:
   For roadmaps with multiple phase-plan files, add a mechanical consistency gate before commit: verify one plan per phase, required header fields, equal block/success-criteria counts, and either a RED step or an explicit non-code exemption for every chunk. Run `git diff --cached --check` after staging.

4. Target workflow: closeout
   Where: Git hygiene and CI
   Edit:
   Before prescribing GitHub CLI pull-request commands, run `gh auth status` independently of Git remote checks. If GitHub CLI is unavailable or unauthenticated, select an already supported authenticated PR surface before the push rather than discovering the limitation afterward.

5. Target workflow: closeout
   Where: Documentation update
   Edit:
   For planning-only phases, explicitly set three current-state fields during closeout: `planning status`, `implementation status`, and `next phase`. Treat “draft/awaiting approval” as stale after the planning PR merges, while preserving clearly historical handoff text inside immutable plan records.
