# GRILL — LiveDocs + S3 Evidence Archive (AWS Weekend Challenge: "Give your Agent a Tool")

1. **What is the one demo that proves it works?**
   Run a LiveDocs research query live → the report renders as before → a new "Evidence archive" panel shows two Amazon S3 links (report.md + evidence.json) → opening one serves the actual archived file from S3. Before/after in one screen: before, the report vanished on refresh; after, it is durable and shareable.

2. **Which agent, exactly?**
   LiveDocs Research Agent (built Oct 22–23 for All Day AI; live at livedocs-research-agent.azurewebsites.net; SerpApi discovery + LLM synthesis, fully cited reports). It is the freshest agent with a working live demo and real citations worth archiving.

3. **Where does the code live? The team repo is off-limits.**
   New personal repo `pintu544/livedocs-evidence-vault`, seeded from Pintu's own LiveDocs code. The All Day AI team repo (CommunityHackathons/adai26-team-002) is NOT modified — different competition, teammates' work.

4. **What exactly is "the tool"?**
   An `archive_evidence` tool the agent calls at the end of every successful run: it writes the report (Markdown) and the full evidence bundle (JSON: query, timestamp, cited sources with title/URL/snippet, model mode) to Amazon S3 and returns presigned URLs. One tool, one job — per the challenge theme.

5. **Why S3 and not a database or local disk?**
   The report's problem is durability + shareability, not querying. S3 gives durable objects with presigned, expiring share links for near-zero cost and zero new infra. DynamoDB/local disk solve neither sharing nor durability as cleanly.

6. **Direct SDK calls or a Lambda in the middle?**
   Direct `@aws-sdk/client-s3` calls from the agent backend. A Lambda adds a deploy surface and cold-start latency without changing the story. Rejected.

7. **AWS account/credentials — what's needed from Pintu?**
   One console session (~10 min, his root login + MFA): create bucket `livedocs-evidence-vault` (ap-south-1, all public access blocked) + one IAM user with a policy scoped to PutObject/GetObject on that bucket only. Keys go to Doppler (muse/dev) and the app's settings — never in chat, code, or git. The existing `alexa-bedrock-agent` IAM user has no S3 permissions and is not reused.

8. **Where does the agent run for the demo?**
   Same Azure Web App pattern as LiveDocs (already proven), as a separate app so the All Day AI submission stays untouched. Hosting is not judged; the named AWS service is Amazon S3.

9. **Failure mode: S3 down or keys missing?**
   Archiving is best-effort and non-blocking: the research report still returns; the archive panel shows "archive unavailable" and the failure is logged. A broken archive must never break research.

10. **What is explicitly deferred?**
    No archive browsing/search UI, no user accounts, no lifecycle/expiry automation (7-day presigned links only), no Lambda, no migration of the All Day AI deployment, no changes to the research pipeline itself.
