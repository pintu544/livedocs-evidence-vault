import "dotenv/config";
import express from "express";
import cors from "cors";
import { runAgent } from "./agent.js";
import { archiveEvidence, archiveConfigFromEnv } from "./archive.js";
import type { ProgressMsg, Report } from "./types.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
// Max time the S3 evidence archive may add to a research response.
const ARCHIVE_BUDGET_MS = Number(process.env.ARCHIVE_BUDGET_MS ?? 3000);

app.set("trust proxy", true); // req.ip should be the client, not the host's proxy
app.use(cors());
app.use(express.json({ limit: "256kb" }));

// Per-IP rate limit for the paid research endpoint (in-memory, per instance).
// Each research run spends real SerpApi credits, so the public demo needs a
// guard against quota exhaustion. Defaults: 20 runs per 10 minutes per IP.
const RATE_LIMIT_MAX = Number(process.env.RESEARCH_RATE_LIMIT_MAX ?? 20);
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const researchHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (researchHits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    researchHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  researchHits.set(ip, hits);
  return false;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    serpApiConfigured: Boolean(process.env.SERPAPI_API_KEY),
    llmConfigured: Boolean(process.env.LLM_API_KEY),
    s3ArchiveConfigured: archiveConfigFromEnv() !== null,
    time: new Date().toISOString(),
  });
});

/**
 * POST /api/research — runs the agent pipeline and streams progress as SSE.
 * Body: { "query": "React Query vs SWR" }
 * Events: data: {"step": "...", "detail": "..."} ... final: data: {"done": true, "report": {...}}
 */
app.post("/api/research", async (req, res) => {
  const query = String(req.body?.query ?? "").trim();
  if (!query) {
    res.status(400).json({ error: "Missing 'query' in request body." });
    return;
  }
  if (!process.env.SERPAPI_API_KEY) {
    res.status(500).json({
      error:
        "SERPAPI_API_KEY is not configured on the server. Add it to backend/.env (see .env.example).",
    });
    return;
  }
  if (rateLimited(req.ip ?? "unknown")) {
    res.status(429).json({
      error: "Rate limit reached for research runs — please wait a few minutes and try again.",
    });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (step: string, detail?: string) => {
    const msg: ProgressMsg = { step, detail };
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  };

  try {
    const report: Report = await runAgent(query, (step, detail) => send(step, detail));

    // Best-effort: archive the evidence bundle to S3. A failure — or a slow
    // S3 — must never fail or stall the research run, so the archive call is
    // raced against a hard budget (SPEC: ≤3 s added) and always resolves to
    // a definite archive/archiveError pair.
    report.archive = null;
    report.archiveError = null;
    const archiveConfigured = archiveConfigFromEnv() !== null;
    if (!archiveConfigured) {
      // Fresh run on an unconfigured deployment: say so (SPEC req 5) instead
      // of silently looking like the pre-feature app. (Pre-feature history
      // items never pass through this handler, so they stay silent.)
      report.archiveError = "Evidence archive unavailable for this run.";
    }
    if (archiveConfigured) {
      send("archiving", "Archiving evidence to S3…");
      const archivePromise = archiveEvidence(report);
      archivePromise.catch(() => undefined); // raced below; swallow late rejections
      try {
        report.archive = await Promise.race([
          archivePromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("archive-timeout")), ARCHIVE_BUDGET_MS),
          ),
        ]);
        if (report.archive) {
          send("archiving", `Evidence archived to S3 — run ${report.archive.runId}.`);
        }
      } catch (archiveErr) {
        const e = archiveErr as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
        // eslint-disable-next-line no-console
        console.error("S3 evidence archive failed:", {
          name: e?.name,
          message: e?.message,
          httpStatusCode: e?.$metadata?.httpStatusCode,
        });
        report.archive = null;
        report.archiveError = "Evidence archive unavailable for this run.";
      }
    }

    send("done", `Report ready (${report.mode} mode) — ${report.creditsUsed} SerpApi credits used.`);
    const done: ProgressMsg = { step: "report", done: true, detail: JSON.stringify(report) };
    res.write(`data: ${JSON.stringify(done)}\n\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const msg: ProgressMsg = { step: "error", error: message };
    res.write(`data: ${JSON.stringify(msg)}\n\n`);
  } finally {
    res.end();
  }
});

// Optional: serve the built frontend from ../frontend/dist when present.
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(here, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => res.sendFile(path.join(frontendDist, "index.html")));
}

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`LiveDocs Research Agent backend on http://localhost:${PORT}`);
});
