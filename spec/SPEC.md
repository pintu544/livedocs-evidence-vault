# SPEC — LiveDocs + S3 Evidence Archive

**Challenge:** AWS Builder Center Weekend Challenge "Give your Agent a Tool" — deadline **Mon Oct 26, 2026, 1:00 PM PDT (Oct 27, 1:30 AM IST)**. Judged: pass/fail gate → top 50 → 5 winners ($100 AWS credits + backpack each). Criteria, 25% each: innovation, craft, usefulness, storytelling.

## Problem
LiveDocs produces fully cited research reports, but a report exists only in the HTTP response — refresh the page and the evidence trail is gone. Research you can't re-open, share, or audit isn't trustworthy. The agent needs a tool that gives every run a permanent, shareable evidence archive.

## Users
- Pintu (entrant) — demos the before/after for the challenge.
- Any reader of a LiveDocs report — opens the S3 archive link to verify citations after the session ends.

## Functional requirements
1. The system SHALL, at the end of every successful research run, invoke an `archive_evidence` tool that stores the report and its evidence bundle in Amazon S3.
2. The system SHALL store two objects per run under `evidence/<runId>/`: `report.md` (the Markdown report) and `evidence.json` (query, ISO timestamp, mode, and every cited source: title, URL, snippet).
3. The system SHALL return presigned S3 GET URLs (7-day expiry) for both objects in the research API response.
4. The UI SHALL show an "Evidence archive" panel after a run with both links and the run ID; before this change no such panel exists (the before/after contrast).
5. If archiving fails (S3 error, missing config), the system SHALL still return the research report, show "archive unavailable" in the panel, and log the failure — archiving never blocks research.
6. The health endpoint SHALL report whether S3 archiving is configured (boolean only, never credentials).
7. The submission SHALL include a Builder Center project article covering (a) the starting agent and what it could do, (b) the new tool and why S3, (c) the new behavior unlocked, plus a public demo video under 3 minutes linked in the submission.

## Non-functional
- Archive step adds ≤ 3 s to a run's total time (two small objects, single-digit MB worst case).
- Bucket blocks all public access; the only read path is presigned URLs. IAM policy scoped to this bucket's objects only.
- No credentials in code, git, chat, or logs; keys live in Doppler + app settings only.

## Judging criteria → requirements
- **Usefulness** → req 1–4 (a real pain: ephemeral reports → durable, shareable evidence).
- **Craft** → req 5–6 (graceful degradation, config-aware health, scoped IAM, tests).
- **Innovation** → req 2 (the archived unit is the *evidence bundle*, not just the output — citations become auditable artifacts).
- **Storytelling** → req 7 + the one-screen before/after demo in GRILL Q1.

## Out of scope
Archive browsing/search UI; user accounts; Lambda; lifecycle rules; touching the All Day AI team repo or its Azure deployment; any change to the research pipeline's behavior.
