# Bugs and Carryover

## Active

None. Product implementation has not started.

## Accepted planning risks

These are roadmap feasibility gates, not active defects:

- WhatsApp Business Platform provider setup, template behavior, and user mapping must be validated before Phase 2.
- Google OAuth verification, Pub/Sub ownership, and watch renewal must be validated before Phase 4.
- Granola API availability depends on the user's plan; CSV import is the documented fallback.
- Slack token type, scopes, and rate limits must be approved before Phase 6.
- Automated LinkedIn job/post monitoring remains blocked pending a compliant data source.

## Resolved during planning closeout

- **CLOSEOUT-001:** Roadmap and README still described the merged plans as awaiting approval. Resolved by marking planning complete and Phase 0 ready.
- **CLOSEOUT-002:** Legacy branch ancestry made the old CRM branch appear unmerged after a clean subtree import. Resolved by archiving the historical branch and using a clean integration PR.
