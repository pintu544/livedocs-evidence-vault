# TASKS — LiveDocs + S3 Evidence Archive (deadline Oct 27, 1:30 AM IST)

## Slice 0 — AWS setup (Pintu, ~10 min, blocks live verification only)
- [x] Create S3 bucket `livedocs-evidence-vault` in ap-south-1, "Block all public access" ON (default). — DONE 2026-10-23 (console, root session; Pintu completed MFA in person)
- [x] Create IAM user `livedocs-archiver` with a customer-managed policy allowing only `s3:PutObject` and `s3:GetObject` on `arn:aws:s3:::livedocs-evidence-vault/evidence/*`; create access key. — DONE 2026-10-23 (policy `livedocs-archiver-policy`, programmatic access only)
- [x] Store the keys securely — DONE 2026-10-23: `hidden_files/aws-s3-credentials.json` (600) in the goal workspace is the operative vault copy (Doppler connector is read-only); runtime copy lives in the Azure app settings. Never in chat or git.
- Done means: keys stored and a test `PutObject` succeeds. — VERIFIED 2026-10-23: PutObject + GetObject + Node-SDK presigned GET all 200 against the real bucket.

## Slice 1 — The tool (backend, end-to-end with mocked S3)
- [x] Scaffold personal repo `pintu544/livedocs-evidence-vault` from Pintu's LiveDocs code; confirm the unmodified app runs locally (health + one research run). — DONE 2026-10-23 (pushed @ acdc039)
- [x] Implement `archiveEvidence` module: bundle builder, S3 PutObject ×2, presigned URL generation, typed failure result; wire into `POST /api/research` as best-effort; add `s3ArchiveConfigured` to `/api/health`. — DONE 2026-10-23
- [x] Tests (Vitest): bundle shape; key layout; success returns both URLs; S3 failure → report still returned with `archive: null` + `archiveError` set; archiving disabled when unconfigured. All green locally. — DONE 2026-10-23 (14/14; S3-failure path also verified live over SSE with fake credentials)
- [x] Adversarial QA pass on the slice (fresh eyes): presigned-URL expiry, oversized reports, source entries with missing fields, credential leakage in logs/errors. — DONE 2026-10-23: 1 critical (unbounded archive await) + 5 warnings all fixed with regression tests; live re-verified.
- Done means: local run produces a report and (with real keys) two S3 links that open the actual archived files.

## Slice 2 — UI + deploy + live proof
- [x] Add the "Evidence archive" panel (run ID + two links; "archive unavailable" state). — DONE 2026-10-23 (+ QA fixes: expiry-aware state for history re-opens, archiving progress step)
- [x] Deploy as a separate Azure Web App (All Day AI app untouched); set env incl. S3 keys; verify `/api/health` shows `s3ArchiveConfigured: true`. — DONE 2026-10-23: livedocs-evidence-vault.azurewebsites.net, health all-true
- [x] Live end-to-end proof on the public URL: one research run → panel links open real S3 objects → record run ID + URLs as verification evidence. — DONE 2026-10-23: run 20261023T060056Z-a2f123, report.md 200 (3,332 B), evidence.json 200 (8,318 B, 11 sources)
- Done means: the GRILL Q1 demo works on the public URL, start to finish. — MET 2026-10-23

## Slice 3 — Submission pack
- [ ] Builder Center article (human tone): (a) starting agent, (b) the S3 evidence tool + why, (c) new behavior unlocked; before/after screenshots; repo + live links.
- [ ] Video shot script (≤ 3 min): before (refresh → report gone) → run with archive → open S3 links → close. Pintu records.
- [ ] Pre-submission review: projected score vs the top-50 bar + materials clarity check, then submit on Builder Center before Oct 27, 1:30 AM IST.
- Done means: submission visible on the challenge page with article + video link, confirmed in a rendered page check.
