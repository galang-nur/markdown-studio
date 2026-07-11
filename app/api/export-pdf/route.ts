import { NextResponse } from "next/server";

import {
  DEFAULT_MARGIN,
  DEFAULT_PAPER_SIZE,
  formatCount,
  MARGIN_PRESETS,
  MAX_MARKDOWN_CHARS,
  PAPER_SIZES,
  safeFilename,
  type MarginPreset,
  type PaperSize,
} from "@/lib/constants";
import { generatePdf } from "@/lib/pdf";

// Puppeteer drives a real Chromium process, so this cannot run on the Edge runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

type ErrorBody = { error: string; detail?: string };

function fail(status: number, error: string, detail?: string) {
  return NextResponse.json<ErrorBody>({ error, detail }, { status });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail(400, "Invalid request", "Body must be valid JSON.");
  }

  const body = payload as Record<string, unknown> | null;
  const markdown = body?.markdown;

  if (typeof markdown !== "string" || markdown.trim() === "") {
    return fail(
      400,
      "Nothing to export",
      "Add some Markdown content before exporting.",
    );
  }

  if (markdown.length > MAX_MARKDOWN_CHARS) {
    return fail(
      413,
      "Document too large",
      `This document is ${formatCount(markdown.length)} characters. The limit is ${formatCount(MAX_MARKDOWN_CHARS)}.`,
    );
  }

  const paperSize: PaperSize = PAPER_SIZES.includes(body?.paperSize as PaperSize)
    ? (body!.paperSize as PaperSize)
    : DEFAULT_PAPER_SIZE;

  const margin: MarginPreset =
    typeof body?.margin === "string" && body.margin in MARGIN_PRESETS
      ? (body.margin as MarginPreset)
      : DEFAULT_MARGIN;

  // Also guards the Content-Disposition header against CRLF / quote injection.
  const filename = safeFilename(
    typeof body?.filename === "string" ? body.filename : undefined,
  );

  try {
    const pdf = await generatePdf(markdown, filename, { paperSize, margin });

    return new NextResponse(pdf as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.byteLength),
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        // Nothing about a user's document should be retained anywhere (§6).
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    // Surface the real reason (§6 Reliability: no generic "something went wrong"),
    // but log only the failure itself — never the user's content.
    const detail =
      error instanceof Error ? error.message : "Unknown rendering error.";
    console.error("[export-pdf] generation failed:", detail);

    const isLaunchFailure = /executable|launch|spawn|ENOENT|browser/i.test(
      detail,
    );

    return fail(
      500,
      "PDF generation failed",
      isLaunchFailure
        ? "The PDF renderer (headless Chromium) could not start on the server. Use “Print / Save as PDF” as a fallback."
        : detail,
    );
  }
}
