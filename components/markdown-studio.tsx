"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Editor } from "@/components/editor";
import { Preview } from "@/components/preview";
import { SplitPanel, type MobileView } from "@/components/split-panel";
import { Toolbar } from "@/components/toolbar";
import {
  ACCEPTED_EXTENSIONS,
  DEFAULT_FILENAME,
  DEFAULT_MARGIN,
  DEFAULT_PAPER_SIZE,
  safeFilename,
  type MarginPreset,
  type PaperSize,
} from "@/lib/constants";
import { FileLoadError, readMarkdownFile } from "@/lib/markdown-file";

/**
 * Owns all editor state. Everything is ephemeral by design — no persistence, no
 * account, no server-side session (§2).
 */
export function MarkdownStudio() {
  const [markdown, setMarkdown] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("editor");
  const [paperSize, setPaperSize] = useState<PaperSize>(DEFAULT_PAPER_SIZE);
  const [margin, setMargin] = useState<MarginPreset>(DEFAULT_MARGIN);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canExport = markdown.trim().length > 0;

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const loadFiles = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    try {
      const { name, content } = await readMarkdownFile(file);
      setMarkdown(content);
      setFilename(name);
      toast.success(`Opened ${name}`);
    } catch (error) {
      toast.error(
        error instanceof FileLoadError
          ? error.message
          : "That file could not be read.",
      );
    }
  }, []);

  const handleClear = useCallback(() => {
    setMarkdown("");
    setFilename(null);
  }, []);

  /**
   * Client-side fallback when the server renderer is unavailable (§6 Reliability).
   * The print stylesheet in styles/preview.css hides the app chrome so the
   * browser's own "Save as PDF" prints just the rendered document.
   */
  const handlePrint = useCallback(() => {
    if (!canExport) return;
    // The preview is unmounted on mobile while the editor tab is active, so make
    // sure there is something to print.
    setMobileView("preview");
    // Let the tab switch commit before handing control to the print dialog.
    requestAnimationFrame(() => window.print());
  }, [canExport]);

  const handleExport = useCallback(async () => {
    if (!canExport) {
      toast.error("Nothing to export", {
        description: "Add some Markdown content first.",
      });
      return;
    }

    setIsExporting(true);
    const name = safeFilename(filename ?? DEFAULT_FILENAME);

    try {
      const response = await fetch("/api/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown, filename: name, paperSize, margin }),
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({}) as { error?: string; detail?: string });
        throw new Error(
          body.detail ?? body.error ?? `Server responded ${response.status}.`,
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${name}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${name}.pdf`);
    } catch (error) {
      const description =
        error instanceof TypeError
          ? "Could not reach the server. Check your connection."
          : error instanceof Error
            ? error.message
            : "Unknown error.";

      toast.error("PDF export failed", {
        description,
        action: { label: "Print instead", onClick: handlePrint },
        duration: 10_000,
      });
    } finally {
      setIsExporting(false);
    }
  }, [canExport, filename, handlePrint, margin, markdown, paperSize]);

  // Keyboard shortcuts (§10 Phase 2): Ctrl/⌘+Shift+E exports, Ctrl/⌘+O uploads.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      const key = event.key.toLowerCase();

      if (key === "e" && event.shiftKey) {
        event.preventDefault();
        void handleExport();
      } else if (key === "o" && !event.shiftKey) {
        event.preventDefault();
        openFilePicker();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleExport, openFilePicker]);

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <Toolbar
        onUpload={openFilePicker}
        onExport={handleExport}
        onPrint={handlePrint}
        isExporting={isExporting}
        canExport={canExport}
        paperSize={paperSize}
        onPaperSizeChange={setPaperSize}
        margin={margin}
        onMarginChange={setMargin}
      />

      <SplitPanel
        mobileView={mobileView}
        onMobileViewChange={setMobileView}
        editor={
          <Editor
            value={markdown}
            onChange={setMarkdown}
            onClear={handleClear}
            onFilesDropped={(files) => void loadFiles(files)}
            onRequestUpload={openFilePicker}
            filename={filename}
          />
        }
        preview={<Preview markdown={markdown} />}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          if (event.target.files) void loadFiles(event.target.files);
          // Reset so picking the same file twice fires onChange again.
          event.target.value = "";
        }}
      />
    </div>
  );
}
