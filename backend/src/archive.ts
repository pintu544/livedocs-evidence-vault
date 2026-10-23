/**
 * archiveEvidence — the agent's S3 evidence-archive tool.
 *
 * After a successful research run, this stores two objects in Amazon S3:
 *   evidence/<runId>/report.md      — human-readable rendering of the report
 *   evidence/<runId>/evidence.json  — the auditable evidence bundle
 * and returns 7-day presigned GET URLs for both. The bucket stays private;
 * the presigned URLs are the only read path.
 *
 * Archiving is best-effort by design: callers must treat a throw here as
 * "archive unavailable", never as a failed research run.
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Report, Source } from "./types.js";

export interface ArchiveInfo {
  runId: string;
  reportUrl: string;
  evidenceUrl: string;
}

export interface ArchiveConfig {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export interface EvidenceSource {
  title: string;
  url: string;
  snippet?: string;
  kind: Source["kind"];
}

export interface EvidenceBundle {
  markdown: string;
  json: string;
  sources: EvidenceSource[];
}

const PRESIGN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

/** Archiving is configured iff a bucket is set and S3_ARCHIVE_ENABLED is not
 *  "false". Keys may come from the environment/instance role, so they are
 *  optional — but exactly one of the pair is a misconfiguration, so archiving
 *  stays off rather than silently falling back to ambient credentials. */
export function archiveConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ArchiveConfig | null {
  if ((env.S3_ARCHIVE_ENABLED ?? "").trim().toLowerCase() === "false") return null;
  const bucket = (env.S3_BUCKET ?? "").trim();
  if (!bucket) return null;
  const accessKeyId = env.AWS_ACCESS_KEY_ID || undefined;
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY || undefined;
  if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) return null;
  return {
    bucket,
    region: (env.AWS_REGION ?? "ap-south-1").trim() || "ap-south-1",
    accessKeyId,
    secretAccessKey,
  };
}

/** Sortable, collision-safe run id, e.g. 20261023T053000Z-a1b2c3. */
export function makeRunId(date: Date = new Date(), rand: () => number = Math.random): string {
  const stamp = date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const suffix = Math.floor(rand() * 0xffffff)
    .toString(16)
    .padStart(6, "0");
  return `${stamp}-${suffix}`;
}

/** Flatten every entity's sources into one de-duplicated list (first wins). */
export function collectSources(report: Report): EvidenceSource[] {
  const seen = new Set<string>();
  const out: EvidenceSource[] = [];
  for (const entity of report.entities) {
    for (const s of entity.sources) {
      const url = (s.url ?? "").trim();
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push({ title: s.title, url, snippet: s.snippet, kind: s.kind });
    }
  }
  return out;
}

function mdCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim();
}

/** Sanitize a free-text block field (LLM/web-derived) for Markdown output:
 *  collapse newlines and escape link brackets so content cannot inject
 *  headings or links into the archived evidence artifact. */
function mdText(text: string): string {
  return text
    .replace(/\r?\n/g, " ")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .trim();
}

/** Render a source as a Markdown link only for http(s) URLs with the target
 *  escaped; anything else degrades to plain text (never a clickable link). */
function mdSourceLink(s: Source): string {
  const title = mdCell(mdText(s.title || s.url));
  const url = (s.url ?? "").trim();
  if (/^https?:\/\//i.test(url)) {
    const safeUrl = url.replace(/\s/g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");
    return `[${title}](${safeUrl})`;
  }
  return title;
}

export function renderReportMarkdown(report: Report, runId: string): string {
  const lines: string[] = [];
  lines.push(`# LiveDocs Research Report`);
  lines.push("");
  lines.push(`- **Query:** ${mdText(report.query)}`);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(`- **Mode:** ${report.mode}`);
  lines.push(`- **Run ID:** ${runId}`);
  lines.push("");
  lines.push(`## Verdict`);
  lines.push("");
  lines.push(mdText(report.verdict));
  lines.push("");
  if (report.comparisonTable.length > 0) {
    const headers = ["Aspect", ...report.entities.map((e) => e.name)];
    lines.push(`## Comparison`);
    lines.push("");
    lines.push(`| ${headers.map((h) => mdCell(mdText(h))).join(" | ")} |`);
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
    for (const row of report.comparisonTable) {
      // Pad/truncate ragged rows to the header width so the table stays valid.
      const values = [...(row.values ?? [])];
      while (values.length < report.entities.length) values.push("");
      const cells = [row.aspect, ...values.slice(0, report.entities.length)];
      lines.push(`| ${cells.map((v) => mdCell(mdText(v ?? ""))).join(" | ")} |`);
    }
    lines.push("");
  }
  lines.push(`## Entities`);
  for (const entity of report.entities) {
    lines.push("");
    lines.push(`### ${mdText(entity.name)}`);
    if (entity.summary) lines.push("", mdText(entity.summary));
    if (entity.latestRelease) {
      lines.push("", `- Latest release: ${mdText(entity.latestRelease)}${entity.releaseDate ? ` (${mdText(entity.releaseDate)})` : ""}`);
    }
    if (entity.sources.length > 0) {
      lines.push("", `Sources:`);
      for (const s of entity.sources) {
        lines.push(`- ${mdSourceLink(s)}${s.snippet ? ` — ${mdCell(mdText(s.snippet))}` : ""}`);
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function buildEvidenceBundle(report: Report, runId: string): EvidenceBundle {
  const sources = collectSources(report);
  const bundle = {
    runId,
    query: report.query,
    generatedAt: report.generatedAt,
    mode: report.mode,
    creditsUsed: report.creditsUsed,
    sources,
    report,
  };
  return {
    markdown: renderReportMarkdown(report, runId),
    json: JSON.stringify(bundle, null, 2),
    sources,
  };
}

export interface ArchiveDeps {
  config?: ArchiveConfig | null;
  client?: S3Client;
  now?: Date;
  rand?: () => number;
}

/**
 * Archive one report. Returns null when archiving is not configured.
 * Throws on S3 failure — the caller decides how to degrade.
 */
export async function archiveEvidence(
  report: Report,
  deps: ArchiveDeps = {},
): Promise<ArchiveInfo | null> {
  const config = deps.config !== undefined ? deps.config : archiveConfigFromEnv();
  if (!config) return null;

  const runId = makeRunId(deps.now ?? new Date(), deps.rand ?? Math.random);
  const bundle = buildEvidenceBundle(report, runId);
  const prefix = `evidence/${runId}`;

  const client =
    deps.client ??
    new S3Client({
      region: config.region,
      maxAttempts: 2,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
          : undefined,
    });

  // Hard per-request timeout: a silent S3 endpoint must never hang a run.
  const abortSignal = AbortSignal.timeout(10_000);
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: `${prefix}/report.md`,
      Body: bundle.markdown,
      ContentType: "text/markdown; charset=utf-8",
    }),
    { abortSignal },
  );
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: `${prefix}/evidence.json`,
      Body: bundle.json,
      ContentType: "application/json; charset=utf-8",
    }),
    { abortSignal },
  );

  const [reportUrl, evidenceUrl] = await Promise.all([
    getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: `${prefix}/report.md` }), {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    }),
    getSignedUrl(client, new GetObjectCommand({ Bucket: config.bucket, Key: `${prefix}/evidence.json` }), {
      expiresIn: PRESIGN_EXPIRY_SECONDS,
    }),
  ]);

  return { runId, reportUrl, evidenceUrl };
}
