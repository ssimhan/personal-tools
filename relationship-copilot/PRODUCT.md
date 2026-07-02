# Relationship Copilot Product Context

**Register:** product
**Status:** Approved direction for Phase 0
**Source of truth:** `../crm-claude-build-personal-crm-V9261/docs/plans/2026-07-02-relationship-copilot-discovery-design.md`

## Product promise

Relationship Copilot helps a person remember who someone is, what their last meaningful exchange was about, and when it may be worth reconnecting. It captures context conversationally, preserves its source, and turns it into trusted memory only after review.

## Primary user

The first active user is Sandhya, who meets people frequently across dinners, meetings, email, community Slack, messaging, and professional networks. The architecture must support independent future users without changing the ownership or authorization model.

## Core jobs

1. Capture relationship context while it is fresh.
2. Review and correct every proposed fact before saving it.
3. Recall the most recent meaningful conversation quickly.
4. Understand why a relationship deserves attention now.
5. Draft a grounded opener and recommend the most relevant channel.

## Product principles

- Incorrect information is worse than missing information.
- The system proposes; the user decides.
- Source-derived facts stay visibly sourced and pending until approved.
- Outreach is drafted but never sent automatically.
- WhatsApp is a capture and notification surface; the app is the review surface.
- Every durable record, connection, job, and notification belongs to one user.
- Tenant isolation is enforced in both the database and application layer.
- Quiet usefulness matters more than engagement mechanics.

## Phase 0 scope

Phase 0 establishes the application shell, authentication boundary, user-owned core schema, row-level security, owner-scoped repositories, test harnesses, and CI. It does not implement capture, proposals, connectors, reminders, ranking, or generated outreach.

## Voice

Calm, direct, warm, and specific. Copy should help the user judge or act. Avoid hype, urgency theater, vague AI claims, and language that implies autonomous decisions.

## Anti-references

- A sales CRM that treats people as pipeline stages.
- An attention dashboard built around streaks, unread counts, or anxiety.
- An enrichment product that silently overwrites user knowledge.
- A chatbot that hides source evidence or review controls.
- A single-owner prototype with global credentials or canonical-user shortcuts.

## Deferred decisions

Detailed information architecture, connector vendors, model providers, reminder scheduling, confidence thresholds, data retention, transcript policy, and team-sharing behavior remain outside Phase 0 unless a later approved design resolves them.
