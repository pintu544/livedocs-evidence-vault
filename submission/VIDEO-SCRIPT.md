# Demo video shot script — target 2:00–2:30 (hard limit 3:00)

Setup: browser open at https://livedocs-evidence-vault.azurewebsites.net, screen recording on. Keep narration conversational; the visuals carry the proof.

| # | Time | Screen | Say / show |
|---|------|--------|-----------|
| 1 | 0:00–0:15 | LiveDocs home | "This is LiveDocs, my research agent. Ask it a question and it searches the live web and writes a cited report. But watch what happens to the evidence." |
| 2 | 0:15–0:45 | Run query "Zustand vs Redux Toolkit"; report renders | Let the progress steps play. "Here's the report — verdict, comparison table, sources. Now I refresh." |
| 3 | 0:45–0:55 | Refresh the page | "Gone. The report only ever existed in that response. For a research tool, that's the flaw." |
| 4 | 0:55–1:35 | Run the same query again; this time the green "Evidence archived to Amazon S3" panel appears with the run ID | "So I gave the agent a new tool: archive_evidence. Every run now writes the report and a full evidence bundle — every source it cited — into a private S3 bucket, and hands back presigned links, right here in the panel." |
| 5 | 1:35–2:05 | Click "Archived report (Markdown)" → S3 URL opens the .md; then "Evidence bundle (JSON)" → JSON with sources | Show the run ID matching the panel. "Same run ID. Eleven sources, with URLs and snippets — anyone can check the verdict against them, days later." |
| 6 | 2:05–2:25 | Back to the app; close on the panel | "The bucket is fully private, the IAM user can only read and write this one evidence prefix, and if S3 ever fails, the report still arrives — archiving never blocks research. The agent doesn't just answer anymore. It keeps its receipts." |

Notes:
- Do a rehearsal run first (each run costs 5 SerpApi credits); the recorded run should be the second take at most.
- If the archive panel shows amber "unavailable", stop — health should show s3ArchiveConfigured: true before recording.
- Upload to YouTube as public/unlisted per the challenge rules (must be publicly visible), paste the link into the Builder Center submission.
