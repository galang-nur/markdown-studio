"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Returns whether `query` currently matches.
 *
 * `matchMedia` is an external store, so it is subscribed to rather than mirrored
 * into state — that keeps the value consistent with the DOM on the very first
 * render and avoids a cascading re-render after mount.
 *
 * There is no viewport during SSR, so the server snapshot is always `false`.
 * Callers must therefore treat `false` as "narrow, or not yet known".
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
