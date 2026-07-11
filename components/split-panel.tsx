"use client";

import type { ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMediaQuery } from "@/hooks/use-media-query";

export type MobileView = "editor" | "preview";

type SplitPanelProps = {
  editor: ReactNode;
  preview: ReactNode;
  mobileView: MobileView;
  onMobileViewChange: (view: MobileView) => void;
};

/**
 * Side-by-side on desktop with a draggable divider; a tab switch on narrow
 * screens (§5.1 Layout).
 *
 * `useMediaQuery` reports false until mount, so the very first paint is the
 * mobile layout. That is the safe direction: the tab layout renders a single
 * panel, so nothing is measured or dragged before we know the real viewport.
 */
export function SplitPanel({
  editor,
  preview,
  mobileView,
  onMobileViewChange,
}: SplitPanelProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize={50} minSize={25} className="print-hidden">
          {editor}
        </ResizablePanel>
        <ResizableHandle withHandle className="print-hidden" />
        <ResizablePanel defaultSize={50} minSize={25}>
          {preview}
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    <Tabs
      value={mobileView}
      onValueChange={(value) => onMobileViewChange(value as MobileView)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div className="print-hidden border-b px-3 py-2">
        <TabsList className="w-full">
          <TabsTrigger value="editor" className="flex-1">
            Editor
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-1">
            Preview
          </TabsTrigger>
        </TabsList>
      </div>

      {/* forceMount keeps the editor's scroll position and the preview's
          rendered HTML alive while the other tab is showing. */}
      <TabsContent
        value="editor"
        forceMount
        className="min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        {editor}
      </TabsContent>
      <TabsContent
        value="preview"
        forceMount
        className="min-h-0 flex-1 data-[state=inactive]:hidden"
      >
        {preview}
      </TabsContent>
    </Tabs>
  );
}
