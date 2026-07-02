# Project History

## 2026-07-02: Discovery and roadmap planning complete

### Accomplishments

- Captured the approved relationship-copilot discovery baseline from Sandhya's thought dump.
- Classified the friend's CRM and Bob CRM as inspiration/reference rather than product requirements.
- Chose a clean `relationship-copilot/` application with selective legacy reuse.
- Established approval-before-write, source provenance, and multi-user isolation as foundational constraints.
- Created a nine-phase roadmap from clean foundation through private beta.
- Created nine TDD-first implementation plans containing 47 blocks and 96 build chunks.
- Recorded official feasibility gates for WhatsApp, Google, Granola, Slack, and LinkedIn.
- Merged the planning artifacts to `main` through pull request #4.

### Verification

- Confirmed every roadmap phase has one implementation plan.
- Confirmed every plan includes goal, architecture, design patterns, tech stack, and approved source.
- Confirmed all 47 blocks include measurable success criteria.
- Confirmed every code chunk starts with a RED test; documentation/audit chunks are explicitly exempted.
- Confirmed `main` matches `origin/main` after merge.
- No application test count exists because no relationship-copilot product code has been implemented.

### Key learnings

- External projects must be explicitly classified as inspiration, baseline code, constraints, or approved requirements before requirements are inferred.
- Copying a clean subtree into `main` preserves files but not the divergent branch's commit ancestry; historical branches should be archived and removed separately.
- GitHub CLI authentication is independent of a working SSH Git remote and should be checked before prescribing PR commands.
- Large plan sets need automated structure and staged-diff checks before commit.

### Next phase

Phase 0: Clean foundation and tenant boundary. Start only after creating a dedicated phase branch through the `build` workflow.
