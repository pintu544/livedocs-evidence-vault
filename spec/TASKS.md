# TASKS — LiveDocs + S3 Evidence Archive (deadline Oct 27, 1:30 AM IST)

## Slice 0 — AWS setup (Pintu, ~10 min, blocks live verification only)
- [ ] Create S3 bucket `livedocs-evidence-vault` in ap-south-1, "Block all public access" ON (default).
- [ ] Create IAM user `livedocs-archiver` with an inline policy allowing only `s3:PutObject` and `s3:GetObject` on `arn:aws:s3:::livedocs-evidence-vault/evidence/*`; create access key.
- [ ] Hand the keys over via the secure route (Doppler muse/dev: `LIVEDOCS_S3_ACCESS_KEY_ID`, `LIVEDOCS_S3_SECRET_ACCESS_KEY`, `LIVEDOCS_S3_BUCKET`, `LIVEDOCS_S3_REGION`) — never in chat or git.
- Done means: keys exist in Doppler and a test `PutObject` from the VM succeeds.

## Slice 1 — The tool (backend, end-to-end with mocked S3)
- [x] Scaffold personal repo `pintu544/livedocs-evidence-vault` from Pintu's LiveDocs code; confirm the unmodified app runs locally (health + one research run). — DONE 2026-10-23 (pushed @ acdc039)
- [x] Implement `archiveEvidence` module: bundle builder, S3 PutObject ×2, presigned URL generation, typed failure result; wire into `POST /api/research` as best-effort; add `s3ArchiveConfigured` to `/api/health`. — DONE 2026-10-23
- [x] Tests (Vitest): bundle shape; key layout; success returns both URLs; S3 failure → report still returned with `archive: null` + `archiveError` set; archiving disabled when unconfigured. All green locally. — DONE 2026-10-23 (14/14; S3-failure path also verified live over SSE with fake credentials)
- [x] Adversarial QA pass on the slice (fresh eyes): presigned-URL expiry, oversized reports, source entries with missing fields, credential leakage in logs/errors. — DONE 2026-10-23: 1 critical (unbounded archive await) + 5 warnings all fixed with regression tests; live re-verified.
- Done means: local run produces a report and (with real keys) two S3 links that open the actual archived files.

## Slice 2 — UI + deploy + live proof
- [ ] Add the "Evidence archive" panel (run ID + two links; "archive unavailable" state).
- [ ] Deploy as a separate Azure Web App (All Day AI app untouched); set env incl. S3 keys from Doppler; verify `/api/health` shows `s3ArchiveConfigured: true`.
- [ ] Live end-to-end proof on the public URL: one research run → panel links open real S3 objects → record run ID + URLs as verification evidence.
- Done means: the GRILL Q1 demo works on the public URL, start to finish.

## Slice 3 — Submission pack
- [ ] Builder Center article (human tone): (a) starting agent, (b) the S3 evidence tool + why, (c) new behavior unlocked; before/after screenshots; repo + live links.
- [ ] Video shot script (≤ 3 min): before (refresh → report gone) → run with archive → open S3 links → close. Pintu records.
- [ ] Pre-submission review: projected score vs the top-50 bar + materials clarity check, then submit on Builder Center before Oct 27, 1:30 AM IST.
- Done means: submission visible on the challenge page with article + video link, confirmed in a rendered page check.
