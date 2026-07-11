"use client";

import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs` of quiet. Keeps the preview from re-parsing on
 * every keystroke (§5.1: ~300ms debounce).
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
