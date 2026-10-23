# Giving my research agent a memory: an S3 evidence archive

**Project:** LiveDocs + Evidence Vault
**Live demo:** https://livedocs-evidence-vault.azurewebsites.net
**Code:** https://github.com/pintu544/livedocs-evidence-vault
**AWS service used:** Amazon S3

## (a) The starting agent

LiveDocs is a research agent I built earlier this month. You give it a question — say, "Zustand vs Redux Toolkit" — and it goes to work: it searches the live web through SerpApi, pulls GitHub stats for the projects it finds, and synthesizes a structured report with a comparison table, a verdict, and the sources behind every claim.

It had one flaw that kept bothering me. The report existed only inside the HTTP response. You read it, you closed the tab, and the evidence trail was gone. For a tool whose whole pitch is "don't trust the summary, check the sources," that is a real problem: research you can't re-open, share, or audit isn't research you can rely on.

## (b) The new tool: archive_evidence, backed by Amazon S3

For this challenge I gave the agent one new tool: `archive_evidence`.

At the end of every successful run, the agent now packages up two artifacts and stores them in a private S3 bucket (ap-south-1):

- `report.md` — a clean Markdown rendering of the report: query, verdict, comparison table, and every entity with its linked sources.
- `evidence.json` — the auditable bundle: the query, timestamp, mode, credits used, the full de-duplicated source list (title, URL, snippet, kind), and the complete structured report.

The bucket blocks all public access. The only way in is through 7-day presigned URLs, which the agent returns with the run and the UI shows in a new "Evidence archived" panel, next to the run ID.

Why S3 and not a database? The problem was never querying — it was durability and sharing. S3 gives me durable objects and expiring share links for effectively zero cost and zero new infrastructure. A Lambda in the middle would have added a deploy surface without changing the story, so the agent calls S3 directly with the AWS SDK.

Two design decisions mattered more than the happy path:

1. **Archiving never blocks research.** The archive call is best-effort, wrapped in a hard 3-second budget with abort signals. If S3 is slow, misconfigured, or down, the report is still delivered — the panel just says the archive is unavailable for that run. The report is the product; the archive is an enhancement.
2. **The evidence has to be trustworthy.** The archived Markdown is sanitized against injection from web-derived text (a hostile page shouldn't be able to plant links in my evidence file), and a small adversarial QA pass — a fresh reviewer who didn't write the code — is part of how this was built. It caught the missing timeout before I did.

The IAM side is deliberately boring: a dedicated user whose policy allows exactly `PutObject` and `GetObject` on `evidence/*` in this one bucket. Nothing else.

## (c) The new behavior it unlocked

Before: a report was a moment. You could export it yourself, or lose it.

After: every run leaves a durable, shareable evidence trail. A real run from the live demo — run `20261023T060056Z-a2f123` — archived a 3.3 KB report and an 8.3 KB evidence bundle with 11 cited sources. Anyone with the link can open the exact sources the agent used, days later, from any device, and check whether the verdict actually follows from them. The panel even knows when its own links have expired and says so, instead of sending you to a dead S3 error page.

That changes what the agent is. It stops being a chatty summarizer and becomes something closer to a researcher with a lab notebook: the work product is no longer the answer, it's the answer *plus* the receipts.

## What I'd do next

- An archive index so runs can be browsed and compared over time.
- Citation verification as a second tool: re-fetch each archived source and flag claims whose sources have changed or vanished.
- Lifecycle rules to move old evidence to S3 Glacier — the notebook should be cheap to keep forever.
