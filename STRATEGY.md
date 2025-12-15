# Strategic Context

> This document connects product development to strategic planning.
> Full strategy lives at: https://github.com/StevenPate/tbr-strategy-source

---

## What We're Building

**TBR.fyi** is an SMS-powered book capture tool that solves a specific problem: book recommendations happen in moments when traditional apps are too slow.

### The Core Insight

```
Podcast mention → 5 seconds to capture → or it's forgotten
```

Goodreads requires: Open app → Search → Find edition → Add to shelf (30+ seconds, high friction)
TBR.fyi requires: Text ISBN or title → Done (5 seconds, zero friction)

---

## Three-Pillar Strategy (Summary)

Full details: [THREE_PILLAR_STRATEGY.md](https://github.com/StevenPate/tbr-strategy-source/blob/main/THREE_PILLAR_STRATEGY.md)

| Pillar | What | When |
|--------|------|------|
| **1. Personal Utility** | Frictionless SMS book capture | NOW (validating) |
| **2. Bookstore Network** | Local inventory integration | After Pillar 1 validates |
| **3. Open Platform** | Developer API & ecosystem | After Pillar 2 validates |

**Critical**: Each pillar unlocks the next. We don't build Pillar 2 features until Pillar 1 is validated.

---

## Current Phase: Checkpoint 1 Validation

**Status**: In Progress
**Goal**: Prove personal utility exists

### What We're Validating

| Question | Target | Why It Matters |
|----------|--------|----------------|
| Do I use it 50+ times? | 50 captures | Confirms the problem is real |
| Do 5 friends use it 10+ times? | 5 active users | Confirms it's not just me |
| Do 40%+ return after Day 7? | 40% retention | Confirms ongoing utility, not novelty |

### Validation Status

Track progress: [CHECKPOINT_STATUS.md](https://github.com/StevenPate/tbr-strategy-source/blob/main/validation/CHECKPOINT_STATUS.md)

---

## Feature Prioritization Framework

### Build Now (Supports Checkpoint 1)

Features that help validate personal utility:

- ✅ SMS capture (ISBN, title, Amazon links, photos)
- ✅ Web dashboard for management
- ✅ Custom shelves
- ✅ Bulk import (Goodreads CSV)
- 🔄 Edition finder (reduces capture friction)
- 🔄 Better error messages (helps users recover)

### Build Later (Requires Checkpoint 2)

Features that require bookstore validation:

- ⏸️ Public shelf sharing
- ⏸️ Bookstore inventory integration
- ⏸️ "In stock nearby" badges
- ⏸️ Reserve for pickup flow

### Build Much Later (Requires Checkpoint 3+)

Features that require platform validation:

- ⏸️ Public API
- ⏸️ Embeddable widgets
- ⏸️ Developer SDK
- ⏸️ Third-party integrations
- ⏸️ ActivityPub federation

### Decision Rule

When evaluating a feature request or TODO item, ask:

```
Does this help validate Checkpoint 1?
├── YES → Consider building it
└── NO → Which checkpoint does it serve?
    ├── Checkpoint 2 → Defer until Checkpoint 1 validates
    └── Checkpoint 3+ → Defer until Checkpoint 2 validates
```

---

## Key Strategic Decisions

### ADR-001: SMS-First Capture

**Decision**: SMS is the primary capture mechanism, not a native app.

**Why**:
- Zero friction (no app install, no navigation)
- Works everywhere (any phone, any situation)
- Differentiates from Goodreads/StoryGraph

**Trade-offs accepted**:
- Per-message cost (Twilio)
- Limited rich UI in SMS
- Users must save phone number

Full rationale: [decisions/001-sms-first-capture.md](https://github.com/StevenPate/tbr-strategy-source/blob/main/decisions/001-sms-first-capture.md)

---

## Metrics That Matter

### North Star Metric

**Books Captured Per Month** (total across all users)

Why: Measures utility, drives bookstore value, attracts developers.

### Supporting Metrics

| Metric | What It Tells Us |
|--------|------------------|
| Day 7 retention | Is there ongoing utility? |
| Books per user per month | How engaged are users? |
| SMS vs. Web capture ratio | Is SMS the right primary interface? |
| Capture success rate | Is the UX working? |

---

## What NOT to Optimize For (Yet)

| Metric | Why We're Ignoring It |
|--------|----------------------|
| Total users | Quality > quantity at this stage |
| Revenue | Premature before utility validated |
| Social engagement | We're not building social features yet |
| API usage | No API exists yet |

---

## Repository Links

| Resource | Link |
|----------|------|
| **Strategy Repo** | https://github.com/StevenPate/tbr-strategy-source |
| **Three-Pillar Strategy** | [THREE_PILLAR_STRATEGY.md](https://github.com/StevenPate/tbr-strategy-source/blob/main/THREE_PILLAR_STRATEGY.md) |
| **Checkpoint Status** | [validation/CHECKPOINT_STATUS.md](https://github.com/StevenPate/tbr-strategy-source/blob/main/validation/CHECKPOINT_STATUS.md) |
| **Current Quarter Roadmap** | [roadmap/CURRENT_QUARTER.md](https://github.com/StevenPate/tbr-strategy-source/blob/main/roadmap/CURRENT_QUARTER.md) |
| **Decision Records** | [decisions/](https://github.com/StevenPate/tbr-strategy-source/tree/main/decisions) |
| **User Persona** | [customer/LITERARY_LINDSAY.md](https://github.com/StevenPate/tbr-strategy-source/blob/main/customer/LITERARY_LINDSAY.md) |

---

## When to Update This Document

- **Checkpoint validated**: Update "Current Phase" section
- **Major pivot**: Update strategy summary
- **New ADR created**: Add to "Key Strategic Decisions"

---

## The One Question

Before building any feature, ask:

> **"Does this help us validate that people want frictionless book capture?"**

If yes, build it. If no, defer it.
