import { describe, it, expect } from "vitest";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  archiveConfigFromEnv,
  archiveEvidence,
  buildEvidenceBundle,
  collectSources,
  makeRunId,
  renderReportMarkdown,
} from "../src/archive.js";
import type { Report } from "../src/types.js";

function sampleReport(): Report {
  return {
    query: "Zustand vs Redux Toolkit",
    entities: [
      {
        name: "Zustand",
        summary: "Small state manager.",
        sources: [
          { title: "Zustand docs", url: "https://zustand.docs.pmnd.rs", snippet: "Bear necessities.", kind: "docs" },
          { title: "Shared source", url: "https://example.com/shared", snippet: "Cited twice.", kind: "page" },
        ],
      },
      {
        name: "Redux Toolkit",
        latestRelease: "2.2.0",
        releaseDate: "2026-01-01",
        sources: [
          { title: "Shared source", url: "https://example.com/shared", snippet: "Duplicate URL.", kind: "page" },
          { title: "RTK docs", url: "https://redux-toolkit.js.org", kind: "docs" },
        ],
      },
    ],
    comparisonTable: [{ aspect: "Bundle size", values: ["~1 kB", "~11 kB"] }],
    verdict: "Zustand for small apps.",
    creditsUsed: 5,
    generatedAt: "2026-10-23T05:30:00.000Z",
    mode: "llm",
  };
}

const CONFIG = { bucket: "livedocs-evidence-vault", region: "ap-south-1", accessKeyId: "AKIAFAKE", secretAccessKey: "fake-secret" };

function stubClient(fail = false) {
  const client = new S3Client({ region: "ap-south-1", credentials: { accessKeyId: "AKIAFAKE", secretAccessKey: "fake-secret" } });
  const sent: PutObjectCommand[] = [];
  // @ts-expect-error — test stub replaces the transport-level send.
  client.send = async (cmd: unknown) => {
    if (fail) throw new Error("S3 unavailable");
    sent.push(cmd as PutObjectCommand);
    return {};
  };
  return { client, sent };
}

describe("archiveConfigFromEnv", () => {
  it("returns null without a bucket", () => {
    expect(archiveConfigFromEnv({} as NodeJS.ProcessEnv)).toBeNull();
  });
  it("defaults region to ap-south-1", () => {
    const cfg = archiveConfigFromEnv({ S3_BUCKET: "b" } as NodeJS.ProcessEnv);
    expect(cfg?.bucket).toBe("b");
    expect(cfg?.region).toBe("ap-south-1");
  });
});

describe("makeRunId", () => {
  it("is sortable and suffixed", () => {
    const id = makeRunId(new Date("2026-10-23T05:30:00.000Z"), () => 0.5);
    expect(id).toMatch(/^20261023T053000Z-[0-9a-f]{6}$/);
  });
});

describe("collectSources", () => {
  it("flattens and de-duplicates by URL, first occurrence wins", () => {
    const sources = collectSources(sampleReport());
    expect(sources).toHaveLength(3);
    expect(sources.map((s) => s.url)).toContain("https://example.com/shared");
    expect(sources.find((s) => s.url === "https://example.com/shared")?.snippet).toBe("Cited twice.");
  });
});

describe("renderReportMarkdown / buildEvidenceBundle", () => {
  it("renders query, verdict, table and linked sources", () => {
    const md = renderReportMarkdown(sampleReport(), "run-1");
    expect(md).toContain("Zustand vs Redux Toolkit");
    expect(md).toContain("Zustand for small apps.");
    expect(md).toContain("| Bundle size | ~1 kB | ~11 kB |");
    expect(md).toContain("[Zustand docs](https://zustand.docs.pmnd.rs)");
  });
  it("bundle JSON parses and carries run metadata + sources", () => {
    const bundle = buildEvidenceBundle(sampleReport(), "run-9");
    const parsed = JSON.parse(bundle.json);
    expect(parsed.runId).toBe("run-9");
    expect(parsed.mode).toBe("llm");
    expect(parsed.sources).toHaveLength(3);
    expect(parsed.report.query).toBe("Zustand vs Redux Toolkit");
    expect(bundle.markdown).toContain("run-9");
  });
});

describe("archiveEvidence", () => {
  it("returns null when unconfigured", async () => {
    await expect(archiveEvidence(sampleReport(), { config: null })).resolves.toBeNull();
  });

  it("writes report.md and evidence.json under evidence/<runId>/ and returns presigned URLs", async () => {
    const { client, sent } = stubClient();
    const result = await archiveEvidence(sampleReport(), {
      config: CONFIG,
      client,
      now: new Date("2026-10-23T05:30:00.000Z"),
      rand: () => 0.5,
    });
    expect(result).not.toBeNull();
    expect(result!.runId).toMatch(/^20261023T053000Z-[0-9a-f]{6}$/);
    expect(sent).toHaveLength(2);
    const keys = sent.map((c) => c.input.Key);
    expect(keys).toContain(`evidence/${result!.runId}/report.md`);
    expect(keys).toContain(`evidence/${result!.runId}/evidence.json`);
    expect(sent.find((c) => c.input.Key?.endsWith("report.md"))?.input.ContentType).toContain("text/markdown");
    expect(result!.reportUrl).toContain("livedocs-evidence-vault");
    expect(result!.reportUrl).toContain(encodeURIComponent(`evidence/${result!.runId}/report.md`).replace(/%2F/g, "/"));
    expect(result!.reportUrl).toContain("X-Amz-Expires=604800");
  });

  it("propagates S3 failure so the caller can degrade gracefully", async () => {
    const { client } = stubClient(true);
    await expect(archiveEvidence(sampleReport(), { config: CONFIG, client })).rejects.toThrow("S3 unavailable");
  });
});

describe("QA regressions", () => {
  it("S3_ARCHIVE_ENABLED=false disables archiving even with a bucket set", () => {
    expect(
      archiveConfigFromEnv({ S3_BUCKET: "b", S3_ARCHIVE_ENABLED: "false" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  it("exactly one credential of the pair disables archiving", () => {
    expect(archiveConfigFromEnv({ S3_BUCKET: "b", AWS_ACCESS_KEY_ID: "x" } as NodeJS.ProcessEnv)).toBeNull();
    expect(archiveConfigFromEnv({ S3_BUCKET: "b", AWS_SECRET_ACCESS_KEY: "y" } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("collectSources trims URLs and skips whitespace-only ones", () => {
    const r = sampleReport();
    r.entities[0].sources.push({ title: "Blank", url: "   ", kind: "page" });
    r.entities[0].sources.push({ title: "Padded", url: "  https://example.com/padded  ", kind: "page" });
    const urls = collectSources(r).map((s) => s.url);
    expect(urls).not.toContain("   ");
    expect(urls).toContain("https://example.com/padded");
  });

  it("ragged comparison rows are padded/truncated to header width", () => {
    const r = sampleReport();
    r.comparisonTable = [
      { aspect: "Short", values: ["only-one"] },
      { aspect: "Long", values: ["a", "b", "c", "d"] },
    ];
    const md = renderReportMarkdown(r, "run-x");
    expect(md).toContain("| Short | only-one |  |");
    expect(md).toContain("| Long | a | b |");
    expect(md).not.toContain("| Long | a | b | c |");
  });

  it("hostile fields cannot inject links or headings; non-http URLs are not linkified", () => {
    const r = sampleReport();
    r.entities[0].name = "Evil ](https://phish.example) name";
    r.entities[0].sources.push({ title: "Click me", url: "javascript:alert(1)", kind: "page" });
    r.entities[0].sources.push({ title: "Spaced", url: "https://example.com/a b)c", kind: "page" });
    const md = renderReportMarkdown(r, "run-x");
    expect(md).not.toContain("](https://phish.example)");
    expect(md).not.toContain("[Click me](javascript:");
    expect(md).toContain("Click me");
    expect(md).toContain("https://example.com/a%20b%29c");
  });
});
