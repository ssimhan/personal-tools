# Relationship Copilot Design Direction

**Status:** Directional system for the Phase 0 shell, not a final product UI specification
**Aesthetic:** Warm + Quiet

## Scene

The product is used in the small pause after a conversation or before reaching out, often on a laptop or phone in ordinary daylight. The interface should lower cognitive load and make careful review feel unhurried.

## Visual strategy

Use a restrained palette: warm tinted neutrals carry the surface, while coral appears only for primary actions, focus, and meaningful state. The design should feel open and composed, not sparse for its own sake.

## Tokens

| Role | Token | Current value |
|---|---|---|
| Main surface | `--paper` | `oklch(0.975 0.008 67)` |
| Secondary surface | `--paper-deep` | `oklch(0.943 0.012 64)` |
| Primary text | `--ink` | `oklch(0.245 0.018 43)` |
| Secondary text | `--muted` | `oklch(0.515 0.019 49)` |
| Divider | `--line` | `oklch(0.875 0.018 61)` |
| Accent | `--coral` | `oklch(0.61 0.128 36)` |
| Accent text | `--coral-deep` | `oklch(0.52 0.13 34)` |

## Typography

- Use the native system sans stack for clarity and platform familiarity.
- Keep product labels compact and consistent; reserve larger scale for a single page-level purpose.
- Use weight and spacing before adding new colors.
- Keep explanatory prose within 65 to 75 characters per line.

## Layout

- Prefer open lists, clear sections, and deliberate dividers over repeated cards.
- Use familiar product patterns for navigation, forms, review states, and confirmation.
- Mobile layouts must remain usable from 375 to 430 pixels without horizontal scrolling.
- Desktop content should preserve readable line length rather than stretching to the viewport.

## Components

- Controls have visible default, hover, focus, active, disabled, loading, and error states.
- Interactive targets are at least 44 by 44 pixels.
- Focus rings use the coral accent with sufficient contrast and spacing.
- Loading states use skeleton structure where content shape is known.
- Empty states explain what will appear and how to create it.
- Errors state what happened, what was preserved, and what the user can do next.

## Motion

Use 150 to 250 millisecond ease-out transitions only to clarify state changes. Respect reduced-motion preferences. Do not animate initial page entry or use motion as decoration.

## Content rules

- Explain provenance and approval state in plain language.
- Never imply that a suggestion is a trusted fact.
- Use specific action labels such as `Approve changes`, `Edit proposal`, or `Dismiss reminder`.
- Avoid generic labels such as `Submit` when the resulting action can be named.

## Current implementation boundary

The Phase 0 welcome shell demonstrates tone, spacing, color, touch targets, and focus treatment. Future authenticated screens still require feature-level shaping before implementation.
