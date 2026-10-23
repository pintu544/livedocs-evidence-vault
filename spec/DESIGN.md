# DESIGN — LiveDocs + S3 Evidence Archive

## Architecture
Three parts, one new:
- **LiveDocs backend (existing)** — Express API: SerpApi discovery → LLM synthesis → cited Markdown report. Unchanged pipeline.
- **`archiveEvidence` tool (new)** — a backend module called once per successful run. Builds the evidence bundle from the run result, writes both objects to S3 via `@aws-sdk/client-s3`, generates presigned URLs via `@aws-sdk/s3-request-presigner`, returns `{ runId, reportUrl, evidenceUrl }` or a typed failure.
- **Frontend (existing + one panel)** — after a run, renders the "Evidence archive" panel from the new response fields; shows "archive unavailable" on failure/null.

Flow (verified against the actual LiveDocs code, 2026-10-23): `POST /api/research` is an SSE stream; the final event carries the structured `Report` as JSON. After `runAgent` succeeds and before the final event, the handler calls `archiveEvidence(report)` (best-effort, try/catch) and attaches the result as an `archive` field on the report payload → UI renders the panel from it.

## Data model
No database. S3 objects only:
- Key: `evidence/<runId>/report.md`, `evidence/<runId>/evidence.json`; `runId` = ISO timestamp + short random suffix (collision-safe, sortable).
- The LiveDocs `Report` is structured (`query, entities[]` each with `sources[]`, `comparisonTable, verdict, creditsUsed, generatedAt, mode`) — so `report.md` is a faithful Markdown rendering of it (verdict, comparison table, per-entity sections with linked sources), and `evidence.json` is `{ runId, query, generatedAt, mode, creditsUsed, sources: [flattened, de-duplicated { title, url, snippet, kind }], report: <full Report JSON> }`.
- Env config: `S3_ARCHIVE_ENABLED`, `AWS_REGION` (ap-south-1), `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (app settings / Doppler only).

## API contracts
- `POST /api/research` — request and SSE shape unchanged. The final report payload gains: `archive: { runId, reportUrl, evidenceUrl } | null` and `archiveError: string | null` (short, user-safe message; details only in server logs).
- `GET /api/health` — gains `s3ArchiveConfigured: boolean`.

## Key decisions
- **Personal repo fork** (`pintu544/livedocs-evidence-vault`) — team repo belongs to another competition; rejected editing it or its Azure app.
- **Direct S3 SDK from the backend** — one deploy surface, demo-provable; Lambda rejected (extra infra, no story gain).
- **Presigned URLs (7 days)** over public objects or a proxy endpoint — bucket stays fully private; links expire on their own.
- **Best-effort archiving** — research is the product; archiving is an enhancement and must never fail a run.

## Risks
1. **Pintu's AWS console step (bucket + IAM user) is on the critical path** — de-risked: exact click-path prepared in TASKS Slice 0; everything else (code, tests with mocked S3) proceeds without it; live verification happens the moment keys land.
2. **SerpApi/LLM credit burn during demo rehearsals** — each LiveDocs run costs 5 SerpApi credits; cap rehearsal runs, reuse one good recorded run for the article screenshots.
3. **Azure zip-deploy slowness (seen on LiveDocs)** — deploy early in Slice 2, not on deadline day; health-check the new app before recording the video.
