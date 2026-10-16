"use client";

import { Search } from "lucide-react";
import { useTaskActions } from "@/components/tasks/task-actions";

/** The phone top bar's way into the command palette (⌘K on a keyboard). */
export function SearchButton() {
  const { openPalette } = useTaskActions();
  return (
    <button
      type="button"
      aria-label="Search"
      onClick={openPalette}
      className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      <Search className="size-[18px]" aria-hidden />
    </button>
  );
}

/** The sidebar's search row: opens the palette, and shows its shortcut. */
export function SidebarSearch() {
  const { openPalette } = useTaskActions();
  return (
    <button
      type="button"
      onClick={openPalette}
      className="flex h-8 w-full items-center gap-2.5 rounded-md border bg-background px-2.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
    >
      <Search className="size-3.5" aria-hidden />
      Search
      <kbd className="ml-auto rounded border px-1 font-sans text-[10px]">Ctrl K</kbd>
    </button>
  );
}
