import {
  ACCEPTED_EXTENSIONS,
  formatCount,
  MAX_FILE_BYTES,
  MAX_MARKDOWN_CHARS,
} from "./constants";

export type LoadedFile = { name: string; content: string };

/** Thrown with a message that is safe to show the user directly. */
export class FileLoadError extends Error {}

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

/**
 * Validates and reads an uploaded Markdown file (§5.3).
 * Rejects on extension, size, and post-decode character count.
 */
export async function readMarkdownFile(file: File): Promise<LoadedFile> {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  if (!ACCEPTED_EXTENSIONS.includes(extension as (typeof ACCEPTED_EXTENSIONS)[number])) {
    throw new FileLoadError(
      `“${file.name}” is not a Markdown file. Accepted types: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    throw new FileLoadError(
      `“${file.name}” is ${formatMb(file.size)}. The limit is ${formatMb(MAX_FILE_BYTES)}.`,
    );
  }

  const content = await file.text();

  // A 5MB file can still be under the byte cap yet over the character cap the
  // export endpoint enforces, so check both.
  if (content.length > MAX_MARKDOWN_CHARS) {
    throw new FileLoadError(
      `“${file.name}” has ${formatCount(content.length)} characters. The limit is ${formatCount(MAX_MARKDOWN_CHARS)}.`,
    );
  }

  return { name: file.name, content };
}
