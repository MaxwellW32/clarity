"use client";

import { History, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

const KEY = "clarity.tasks.lastQuery";
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function write(value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, value);
  } catch {
    // storage can be unavailable; the chip then never shows
  }
  for (const listener of listeners) listener();
}

/** Remembers the last /tasks query in this browser and offers it back when the list opens unfiltered. */
export function LastFilters({ current }: { current: string }) {
  const saved = useSyncExternalStore(subscribe, read, () => null);

  useEffect(() => {
    if (current !== "") write(current);
  }, [current]);

  if (current !== "" || !saved) return null;
  const summary = [...new URLSearchParams(saved).entries()]
    .filter(([key]) => key !== "sort")
    .map(([key, value]) => (key === "closed" ? "closed shown" : `${key}: ${value.replaceAll(",", ", ").replaceAll("_", " ")}`))
    .join(" · ");
  if (summary === "") return null;
  return (
    <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
      <History className="size-3.5" aria-hidden />
      <span>Last time you filtered by {summary}.</span>
      <Link href={`/tasks?${saved}`} className="font-medium text-link underline-offset-4 hover:underline">
        Restore
      </Link>
      <button type="button" aria-label="Forget the last filters" className="rounded-sm p-0.5 hover:text-foreground" onClick={() => write(null)}>
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
