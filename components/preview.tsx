"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";

type PreviewProps = {
  markdown: string;
};

/** The rendered output, tagged with the source it was produced from. */
type Render = {
  source: string;
  html: string;
  error: string | null;
};

const EMPTY: Render = { source: "", html: "", error: null };

export function Preview({ markdown }: PreviewProps) {
  const debounced = useDebouncedValue(markdown, 300);
  const [render, setRender] = useState<Render>(EMPTY);

  const isEmpty = debounced.trim() === "";

  // Both derived rather than stored: the output carries the source that produced
  // it, so "is a render in flight" is just "the output is behind the input".
  const isStale = render.source !== debounced;
  const isRendering = !isEmpty && isStale;

  useEffect(() => {
    if (isEmpty || !isStale) return;

    // Guards against a slow parse resolving after a newer one and clobbering it.
    let cancelled = false;

    // Loaded on demand: Shiki's grammars are large and would otherwise sit in the
    // initial bundle and hurt LCP (§6 Performance).
    void import("@/lib/markdown")
      .then(({ renderMarkdown }) => renderMarkdown(debounced, "preview"))
      .then((html) => {
        if (!cancelled) setRender({ source: debounced, html, error: null });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setRender({
          source: debounced,
          html: "",
          error:
            cause instanceof Error
              ? cause.message
              : "Could not render this Markdown.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [debounced, isEmpty, isStale]);

  return (
    <section
      aria-label="Rendered preview"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <header className="print-hidden flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
          Preview
        </span>
        {isRendering && (
          <Loader2
            aria-hidden
            className="size-3.5 animate-spin text-muted-foreground"
          />
        )}
        <span className="sr-only" role="status" aria-live="polite">
          {isRendering ? "Rendering preview" : "Preview up to date"}
        </span>
      </header>

      <div className="print-root min-h-0 flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="print-hidden flex h-full items-center justify-center p-8">
            <p className="max-w-xs text-center text-sm text-muted-foreground">
              Paste your Markdown here to see the preview.
            </p>
          </div>
        ) : render.error ? (
          <div className="print-hidden p-8">
            <p className="text-sm font-medium text-destructive">
              Could not render this Markdown
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{render.error}</p>
          </div>
        ) : (
          // Safe: this HTML comes from lib/markdown.ts, which never emits raw
          // HTML from the source and runs the tree through rehype-sanitize.
          <article
            className="markdown-body px-6 py-8 sm:px-10"
            dangerouslySetInnerHTML={{ __html: render.html }}
          />
        )}
      </div>
    </section>
  );
}
