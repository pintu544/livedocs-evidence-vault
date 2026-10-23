import type { Report } from "../types";

/**
 * Evidence archive panel — the visible "new tool" surface for the AWS build.
 * Shows the S3 archive links for a run, or a calm unavailable note when
 * archiving failed (the report itself is never affected).
 */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function fmtDate(isoMs: number): string {
  return new Date(isoMs).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ArchivePanel({ report }: { report: Report }) {
  if (report.archive) {
    // Presigned URLs are minted seconds after generatedAt and live 7 days.
    const expiresAt = Date.parse(report.generatedAt) + SEVEN_DAYS_MS;
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs sm:text-sm text-amber-800">
            🗄️ This run was archived to Amazon S3 (run {report.archive.runId}), but its share
            links expired on {fmtDate(expiresAt)} — presigned links are valid for 7 days. The
            archived objects themselves are still stored in S3.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-emerald-900">
            🗄️ Evidence archived to Amazon S3
          </h3>
          <span className="text-xs font-mono text-emerald-700">run {report.archive.runId}</span>
        </div>
        <p className="mt-1.5 text-xs sm:text-sm text-emerald-800">
          This report and every source behind it are stored durably in S3 — open them from any
          device, even after this page is gone. These share links are valid until{" "}
          {Number.isFinite(expiresAt) ? fmtDate(expiresAt) : "7 days after the run"}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={report.archive.reportUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            📄 Archived report (Markdown)
          </a>
          <a
            href={report.archive.evidenceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm hover:bg-emerald-100 transition"
          >
            🔍 Evidence bundle (JSON)
          </a>
        </div>
      </div>
    );
  }

  if (report.archiveError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs sm:text-sm text-amber-800">
          🗄️ Evidence archive unavailable for this run — the report above is complete and
          unaffected.
        </p>
      </div>
    );
  }

  return null;
}
