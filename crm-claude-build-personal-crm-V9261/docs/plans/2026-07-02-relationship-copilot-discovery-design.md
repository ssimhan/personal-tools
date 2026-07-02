# Personal Relationship Copilot — Discovery Baseline

**Date:** 2026-07-02  
**Status:** Approved discovery baseline; detailed product and technical planning deferred  
**Branch:** `design/crm-relationship-copilot`

## Purpose of this document

This captures Sandhya's initial product thought dump so future discovery can resume without turning early inspiration into fixed requirements. It is not an implementation plan and does not authorize a build.

Two references informed the conversation:

- The friend's existing Relationship Memory Layer app, supplied as `crm-claude-build-personal-crm-V9261 (4).zip`
- [Bob CRM](https://rkroft.github.io/bob-crm-landing/)

Both are inspiration, not specifications. The supplied ZIP matches the CRM code already present on the repository's `CRM` branch; that branch additionally contains earlier planning and mockup documents.

## Product concept

A personal relationship copilot that helps Sandhya capture context conversationally, maintain trustworthy memory about the people she meets, and proactively restart relationships at the right moment.

The primary capture surface is a persistent WhatsApp conversation. Sandhya should be able to describe a meeting in natural language and have the system identify the person and relevant event. WhatsApp should then link to the relevant app screen, where Sandhya reviews every proposed detail, edits it, and saves only what she confirms.

The product should then enrich that trusted record from selected communication and meeting sources, remind Sandhya when a relationship deserves attention, and draft a contextual opener without ever sending outreach automatically.

## Core user needs

When Sandhya opens a person's record, it should quickly answer:

1. Who is this person?
2. What was our last meaningful conversation about?
3. Why might now be a good time to reconnect?
4. What could I say to restart the conversation?
5. Which channel should I use?

## Trust model

The central product principle is:

> Incorrect information is worse than missing information.

The system proposes and Sandhya decides. Every proposed person match, profile fact, interaction note, inferred update, and reminder must be shown for approval. Sandhya can edit each detail before saving it.

The system must not:

- silently add inferred facts to a trusted profile;
- send outreach automatically;
- treat shared membership in a channel or meeting as evidence of closeness;
- allow source-derived suggestions to become indistinguishable from user-approved facts.

Each proposal should retain its source and enough context for Sandhya to judge it.

## Product architecture constraint

The initial release may begin with Sandhya as its only active user, but the architecture must support multiple users in the future without reworking the core data model or security boundary.

This means:

- people, interactions, proposals, reminders, source records, and generated content are owned by a user;
- database access controls enforce isolation between users;
- email, calendar, meeting, Slack, WhatsApp, and future LinkedIn connections are authorized and stored per user;
- ingestion jobs, review queues, reminders, and notification delivery always run in the context of the owning user;
- source provenance and approval history remain attached to the owning user and record;
- product configuration must not rely on one canonical account, a hard-coded email, or globally shared connector credentials.

This is multi-user product readiness, not a decision to build team collaboration in the first release. Whether users can later share contacts, workspaces, or relationship context remains open.

## Example capture workflow

Sandhya texts WhatsApp:

> I met Joan at dinner tonight. We chatted about content management and what she's building with Claude Code, and how I find it super interesting. I pitched her on shifting to Codex. Need to follow up in the next couple months on Codex workflows for content marketing.

The system should:

1. Look for the likely dinner in email and calendar context.
2. Ask only the clarifying questions needed to resolve Joan's identity.
3. Propose structured conversation details for Joan's profile.
4. Propose a follow-up reminder in approximately two months.
5. Send Sandhya a WhatsApp notification with a deep link to the exact review screen in the app.
6. Let Sandhya inspect the source, edit each proposed detail, and approve or reject it before saving.
7. At the due time, send a reminder containing the person, topic, relationship context, suggested channel, and a generated opener.
8. Offer `Snooze`, `Complete`, and `Dismiss` actions.

## Review and deferral behavior

WhatsApp is the primary capture and notification channel, not the full review interface. After capture or discovery, WhatsApp should send a concise notification with a deep link to the exact proposal in the app.

The app provides the review experience. It should show the proposed person match and field-level changes, the supporting source context, and controls to edit, approve, or reject the details before saving. A user should land directly on the relevant review item rather than having to find it in a general inbox.

If Sandhya says she is busy or asks to be reminded later, the unresolved proposal should remain in the app's review queue and appear in an email digest rather than disappear. The digest should link back to the relevant app review items. Its format and delivery schedule are intentionally deferred for later discovery.

## Proactive relationship attention

The system should proactively surface people rather than wait for a search.

Initial signals include:

- time since the last meaningful interaction;
- a job change;
- something the person posted;
- an explicit follow-up captured in conversation.

Relationship priority should be inferred primarily from the frequency, recency, and meaningfulness of prior interactions. Sandhya should be able to correct the inference, but the initial model should not require manually assigning a priority or cadence to every person.

## Outreach assistance

A proactive reminder should include:

- a concise reminder of who the person is;
- the most recent meaningful conversation context;
- why the person is surfacing now;
- a generated opener grounded in trusted context;
- a recommended communication channel;
- actions to snooze, complete, or dismiss the reminder.

Channel selection should prefer the channel of the most recent meaningful exchange. When multiple channels are equally relevant, use this preference order:

1. Slack
2. Text
3. LinkedIn message
4. Email

## Initial source scope

### Email

- Start with Sandhya's personal email.
- Use direct relationship-bearing exchanges.
- Exclude newsletters, automated mail, bulk messages, and spam.

### Calendar and Granola

- Consider meetings with fewer than 15 attendees.
- Propose a person record or update for every attendee.
- Potential meeting context includes the title and date, a short relationship-relevant summary, topics discussed, commitments, follow-ups, and a link to the source note.
- The exact storage and privacy policy for transcripts and quotations remains open.

### Slack

- Start with the Women Defining AI (WDAI) workspace.
- Public and private channels may provide context.
- Only DMs and direct replies within the same thread count as meaningful interactions.
- Reactions, passive channel co-membership, and participation in unrelated shared conversations should not affect a profile or relationship priority.

### LinkedIn

- Support reviewed batch additions over time.
- LinkedIn messages, posts, and job-change monitoring are desired later capabilities.
- Integration feasibility, account safety, and allowed data-access methods require separate investigation before planning.

### Other future sources

- Twitter or X context
- Additional community Slack workspaces
- Other meeting or messaging sources discovered during later research

## Initial product scope

- Natural-language capture through WhatsApp
- Identity resolution using approved source context
- Editable person profiles
- A chronological relationship timeline
- App-based proposal review with field-level editing, source context, and approve or reject controls
- Deep links from WhatsApp and email to exact review items
- User-approved profile and interaction updates
- Email, calendar, Granola, and scoped WDAI Slack ingestion
- Inferred relationship priority
- Proactive follow-up reminders
- Contextual opener generation
- Recommended outreach channel
- Reminder actions: snooze, complete, dismiss
- WhatsApp-first capture and notifications with app-based review and email-digest deferral

## Later possibilities

- LinkedIn message and activity ingestion
- Automated job-change monitoring
- Twitter or X context
- Additional Slack workspaces
- Network maps and community detection
- Introduction tracking and connector intelligence inspired by Bob
- Richer enrichment and recurring relationship reviews

## Current visual preference

The current preference among early visual explorations is **Warm + Quiet**: warm neutral surfaces, restrained coral accents, an open-list layout, and a calm product-first hierarchy. This is directional inspiration only. A separate UI-shaping exercise is required before implementation.

## Decisions intentionally deferred

- Whether to adapt the existing app in place or rebuild parts of it
- Exact connector and authentication strategy for every source
- WhatsApp provider and deployment model
- Whether future users remain independent or can share contacts, workspaces, or relationship context
- Data retention, transcript storage, deletion, and privacy controls
- Confidence scoring and identity-resolution thresholds
- Email-digest timing and format
- Reminder scheduling semantics
- Detailed priority model
- Exact web and mobile information architecture
- AI provider and model choices
- Testing, migration, deployment, and operating-cost plans

## Recommended next step

When discovery resumes, continue the brainstorm at product altitude rather than asking for field-level details immediately. Resolve the largest remaining choices in this order:

1. Define the smallest end-to-end version of the WhatsApp capture and approval loop.
2. Decide which one or two enrichment sources belong in the first usable release.
3. Shape the primary review and relationship-memory interfaces.
4. Investigate connector feasibility and privacy constraints.
5. Choose adapt-in-place, partial rebuild, or full rebuild based on that scoped product.
6. Create a TDD-first implementation plan only after the design is approved.
