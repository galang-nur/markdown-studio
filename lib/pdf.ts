import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Browser, type PaperFormat } from "puppeteer";

import { MARGIN_PRESETS, type MarginPreset, type PaperSize } from "./constants";
import { renderMarkdown } from "./markdown";

export type PdfOptions = {
  paperSize: PaperSize;
  margin: MarginPreset;
};

/**
 * Chromium takes ~300ms to boot, which would dominate the request budget (§6:
 * under 10s for a 50-page document). Keep one browser alive across requests and
 * open a fresh page per export, so a crashed page cannot poison the next caller.
 */
let browserPromise: Promise<Browser> | undefined;

async function getBrowser(): Promise<Browser> {
  const existing = await browserPromise?.catch(() => undefined);
  if (existing?.connected) return existing;

  browserPromise = puppeteer.launch({
    // In Docker we run as a non-root user in a container that is already a
    // sandbox, which is the only context where dropping Chromium's own sandbox
    // is acceptable (§6 Security).
    args: process.env.PUPPETEER_NO_SANDBOX === "true"
      ? ["--no-sandbox", "--disable-dev-shm-usage"]
      : ["--disable-dev-shm-usage"],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  try {
    return await browserPromise;
  } catch (error) {
    browserPromise = undefined; // let the next request retry the launch
    throw error;
  }
}

let pdfCssPromise: Promise<string> | undefined;

/**
 * styles/pdf.css is the source of truth for print styling and is read from disk
 * rather than inlined here. next.config.ts adds it to the route's traced files so
 * it survives the standalone build.
 */
function getPdfCss(): Promise<string> {
  pdfCssPromise ??= readFile(
    path.join(process.cwd(), "styles", "pdf.css"),
    "utf8",
  );
  return pdfCssPromise;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

async function buildDocument(markdown: string, title: string): Promise<string> {
  // Same pipeline as the live preview, so the PDF matches the on-screen render.
  const [body, css] = await Promise.all([
    renderMarkdown(markdown, "pdf"),
    getPdfCss(),
  ]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;
}

export async function generatePdf(
  markdown: string,
  title: string,
  options: PdfOptions,
): Promise<Uint8Array> {
  const html = await buildDocument(markdown, title);
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // The document needs no network of its own, but remote <img> tags are legal
    // Markdown. The `load` event fires only once subresources have settled, so
    // images are present in the print rather than blank.
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });

    return await page.pdf({
      format: options.paperSize as PaperFormat,
      margin: {
        top: MARGIN_PRESETS[options.margin].value,
        right: MARGIN_PRESETS[options.margin].value,
        bottom: MARGIN_PRESETS[options.margin].value,
        left: MARGIN_PRESETS[options.margin].value,
      },
      printBackground: true,
      timeout: 30_000,
    });
  } finally {
    await page.close().catch(() => {});
  }
}
