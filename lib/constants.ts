/** Shared limits and options. Referenced by client, route handler, and proxy. */

/** Max characters accepted by the editor and the export endpoint (~500KB). */
export const MAX_MARKDOWN_CHARS = 500_000;

/** Max size of an uploaded file. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_EXTENSIONS = [".md", ".markdown", ".txt"] as const;

/** Rate limit for POST /api/export-pdf, enforced in proxy.ts. */
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 10;

export const PAPER_SIZES = ["A4", "Letter"] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

export const MARGIN_PRESETS = {
  narrow: { label: "Narrow (1cm)", value: "1cm" },
  normal: { label: "Normal (2cm)", value: "2cm" },
  wide: { label: "Wide (3cm)", value: "3cm" },
} as const;
export type MarginPreset = keyof typeof MARGIN_PRESETS;

export const DEFAULT_PAPER_SIZE: PaperSize = "A4";
export const DEFAULT_MARGIN: MarginPreset = "normal";
export const DEFAULT_FILENAME = "document";

/**
 * Number formatting is pinned to one locale on purpose.
 *
 * `toLocaleString()` with no argument follows the *host's* locale, which differs
 * between the Node server and the browser: a server running under a European
 * locale renders 500000 as "500.000" while the browser renders "500,000". React
 * sees that as a text mismatch and throws away the server-rendered HTML.
 */
export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Strips anything that could break the Content-Disposition header or escape the
 * filename (path traversal, quotes, CRLF). Falls back to DEFAULT_FILENAME.
 */
export function safeFilename(input: string | undefined | null): string {
  const base = (input ?? "")
    .replace(/\.(md|markdown|txt)$/i, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return base || DEFAULT_FILENAME;
}
