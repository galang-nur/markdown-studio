"use client";

import { Download, Loader2, Printer, Settings2, Upload } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MARGIN_PRESETS,
  PAPER_SIZES,
  type MarginPreset,
  type PaperSize,
} from "@/lib/constants";

type ToolbarProps = {
  onUpload: () => void;
  onExport: () => void;
  onPrint: () => void;
  isExporting: boolean;
  canExport: boolean;
  paperSize: PaperSize;
  onPaperSizeChange: (value: PaperSize) => void;
  margin: MarginPreset;
  onMarginChange: (value: MarginPreset) => void;
};

/** Renders ⌘ on macOS and Ctrl elsewhere, once mounted. */
function modifierKey(): string {
  if (typeof navigator === "undefined") return "Ctrl";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}

export function Toolbar({
  onUpload,
  onExport,
  onPrint,
  isExporting,
  canExport,
  paperSize,
  onPaperSizeChange,
  margin,
  onMarginChange,
}: ToolbarProps) {
  const mod = modifierKey();

  return (
    <header className="print-hidden flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-4">
      <div className="flex items-center gap-2">
        <div
          aria-hidden
          className="grid size-7 place-items-center rounded-md bg-foreground font-mono text-xs font-bold text-background"
        >
          M
        </div>
        <h1 className="text-sm font-semibold tracking-tight">
          Markdown Studio
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" onClick={onUpload}>
              <Upload className="size-4" />
              <span className="hidden sm:inline">Upload .md</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open a .md file ({mod}+O)</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="PDF options">
                  <Settings2 className="size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>PDF options</TooltipContent>
          </Tooltip>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Paper size</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={paperSize}
              onValueChange={(value) => onPaperSizeChange(value as PaperSize)}
            >
              {PAPER_SIZES.map((size) => (
                <DropdownMenuRadioItem key={size} value={size}>
                  {size}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />

            <DropdownMenuLabel>Margins</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={margin}
              onValueChange={(value) => onMarginChange(value as MarginPreset)}
            >
              {Object.entries(MARGIN_PRESETS).map(([key, preset]) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  {preset.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />

            <DropdownMenuLabel className="font-normal text-muted-foreground">
              Fallback
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value="">
              <button
                type="button"
                onClick={onPrint}
                disabled={!canExport}
                className="flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <Printer className="size-4" />
                Print / Save as PDF
              </button>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="mx-0.5 !h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            {/* A disabled button is not focusable and would drop out of the tab
                order, so keep it enabled and let the handler reject instead. */}
            <Button
              size="sm"
              onClick={onExport}
              disabled={isExporting}
              aria-disabled={!canExport}
              aria-busy={isExporting}
            >
              {isExporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              <span className="hidden sm:inline">
                {isExporting ? "Exporting…" : "Export PDF"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Export to PDF ({mod}+Shift+E)
          </TooltipContent>
        </Tooltip>

        <ThemeToggle />
      </div>
    </header>
  );
}
