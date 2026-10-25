# Trust and autonomy model

## Default state

All agent outputs are drafts. The user must approve:

- decisions
- commitments
- owners
- due dates
- event objectives
- budgets
- support requests
- member-status changes
- external communications
- governance actions

## Evidence contract

Every recommendation must include:

- source document ID
- source fragment ID or timestamp
- source provider
- source version and content hash
- extracted claim
- confidence
- uncertainty or missing information
- agent and prompt version
- created timestamp

If the system cannot cite the claim, it must label it as unverified and keep it out of execution flows.

## Autonomy ladder

### Level 0: draft

The system summarizes and suggests. Nothing is sent or changed.

### Level 1: recommend

The system proposes owners, dates, event structures, and follow-ups with citations.

### Level 2: prepare

The system prepares a message, calendar event, budget request, or document for review. A person still approves the final action.

### Level 3: execute low-risk actions

Only narrowly defined actions may run automatically, such as internal reminders, after the policy is approved and the system has passed its promotion gate.

### Level 4: bounded autonomy

The system may coordinate a defined workflow within explicit limits. Every action remains logged, reversible, and subject to emergency pause.

## Promotion gate

A policy may be proposed for a higher autonomy level only when the configured sample size, acceptance rate, correction rate, reversal rate, critical-error count, and outcome improvement thresholds are met.

The first implementation uses conservative defaults:

- at least 30 reviewed recommendations
- at least 90% accepted without material correction
- no critical safety or privacy errors
- fewer than 5% reversals
- demonstrated improvement in a selected operating metric
- human approval of the promotion proposal

These are eligibility thresholds, not automatic authorization. A person must approve the promotion.

## Learning loop

The system learns from labeled records, not from silent behavior:

recommendation -> approval or correction -> execution -> observed result -> reviewer label -> benchmark -> proposal

A model or prompt change must replay against historical evidence and pass the benchmark before promotion. Original evidence is frozen so later information cannot rewrite what the system knew at the time.
