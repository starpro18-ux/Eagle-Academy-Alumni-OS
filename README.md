# Eagle Academy Alumni OS

Eagle Academy Alumni OS is a human-controlled operating system for alumni and volunteer-led organizations.

The first product slice turns meetings and event plans into:

- source-backed decisions
- accountable commitments
- event briefs and budgets
- measurable objectives and outcomes
- reviewable AI recommendations

The system begins in draft-and-recommend mode. It does not send messages, change member status, approve budgets, or apply governance actions without a human approval.

## Foundation branch

The `codex/foundation` branch contains the initial trust model, connector contracts, domain primitives, and Supabase migration. It intentionally contains no member data or source documents.

## Product principles

1. Every important claim links to source evidence.
2. AI outputs are proposed, never silently applied.
3. Human corrections become labeled learning data.
4. Original evidence and decisions are immutable.
5. Autonomy increases only after measurable performance.
6. Every automated action is reversible and auditable.

## Initial connectors

Google Drive and Zoom will use the same ingestion path as manual uploads:

`connector -> source document -> source fragment -> evidence -> recommendation -> human approval -> measured outcome`

## Local development

The first implementation is intentionally dependency-light. The domain safety checks can be run with:

```bash
npm test
```

Do not commit PDFs, spreadsheets, transcripts, member lists, credentials, or Supabase keys. Store source material in protected object storage and retain only metadata and evidence references in Git.
