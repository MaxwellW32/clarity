"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: "Anywhere",
    keys: [
      ["Ctrl K", "Search, or jump to a page"],
      ["N", "New task"],
      ["/", "Focus the list search"],
      ["?", "This list"],
      ["Esc", "Close a dialog or menu"],
    ],
  },
  {
    title: "In a list",
    keys: [
      ["J / K", "Move to the next or previous task"],
      ["Enter", "Open the focused task"],
    ],
  },
  {
    title: "On a task",
    keys: [
      ["U", "Update progress"],
      ["Ctrl Enter", "Save the update"],
    ],
  },
];

/** The keyboard shortcuts, behind "?". */
export function ShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts are ignored while you are typing in a field.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{group.title}</h3>
              <dl className="divide-y rounded-md border">
                {group.keys.map(([key, what]) => (
                  <div key={key} className="flex items-center justify-between gap-4 px-3 py-1.5 text-sm">
                    <dd className="text-muted-foreground">{what}</dd>
                    <dt>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium">{key}</kbd>
                    </dt>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
