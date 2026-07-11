"use client";

import { FileText, Upload, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ACCEPTED_EXTENSIONS,
  formatCount,
  MAX_MARKDOWN_CHARS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

type EditorProps = {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  onFilesDropped: (files: FileList) => void;
  onRequestUpload: () => void;
  filename: string | null;
};

const PLACEHOLDER = `# Paste your Markdown here

…or drop a .md file anywhere in this panel.`;

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function Editor({
  value,
  onChange,
  onClear,
  onFilesDropped,
  onRequestUpload,
  filename,
}: EditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Drag events fire for every child element; counting enter/leave pairs stops
  // the highlight from flickering as the cursor moves within the panel.
  const dragDepth = useRef(0);

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current += 1;
    if (event.dataTransfer.types.includes("Files")) setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) setIsDragging(false);
  };

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      onFilesDropped(event.dataTransfer.files);
    }
  };

  const words = countWords(value);
  const isOverLimit = value.length > MAX_MARKDOWN_CHARS;

  return (
    <section
      aria-label="Markdown editor"
      className="relative flex h-full min-h-0 flex-col bg-background"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-medium text-muted-foreground">
          {filename ?? "Untitled"}
        </span>
        <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground/70">
          Editor
        </span>
      </header>

      <div className="relative min-h-0 flex-1">
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck={false}
          aria-label="Markdown source"
          aria-describedby="editor-status"
          className={cn(
            "size-full resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed",
            "text-foreground placeholder:text-muted-foreground/60",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
          )}
        />

        {isDragging && (
          <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-background/90 backdrop-blur-xs">
            <Upload className="size-5 text-primary" />
            <p className="text-sm font-medium">Drop to open</p>
            <p className="text-xs text-muted-foreground">
              {ACCEPTED_EXTENSIONS.join(", ")} · max 5MB
            </p>
          </div>
        )}
      </div>

      <footer
        id="editor-status"
        className="flex h-10 shrink-0 items-center gap-2 border-t px-3 text-xs text-muted-foreground"
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={value.length === 0}
          className="h-7 px-2 text-xs"
        >
          <X className="size-3.5" />
          Clear
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onRequestUpload}
          className="h-7 px-2 text-xs"
        >
          <Upload className="size-3.5" />
          Upload
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4!" />

        <span aria-live="polite" className="tabular-nums">
          {formatCount(words)} {words === 1 ? "word" : "words"}
        </span>
        <span
          className={cn(
            "ml-auto tabular-nums",
            isOverLimit && "font-medium text-destructive",
          )}
        >
          {formatCount(value.length)} / {formatCount(MAX_MARKDOWN_CHARS)}
        </span>
      </footer>
    </section>
  );
}
