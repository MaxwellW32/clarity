"use client";

import { NotebookPen } from "lucide-react";
import { useEffect, useRef } from "react";
import { FOCUS_UPDATE_EVENT } from "../task-actions";
import type { UpdateContext } from "../update-context";
import { UpdateProgressForm } from "../update-progress-form";

/**
 * The Update Progress form on the task's own page. The U shortcut, the header button and the palette all
 * dispatch FOCUS_UPDATE_EVENT, which scrolls here and puts the cursor in the first field.
 */
export function InlineUpdate({ context, fresh }: { context: UpdateContext; fresh: boolean }) {
  const progressRef = useRef<HTMLTextAreaElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function focus() {
      sectionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      progressRef.current?.focus();
    }
    window.addEventListener(FOCUS_UPDATE_EVENT, focus);
    return () => window.removeEventListener(FOCUS_UPDATE_EVENT, focus);
  }, []);

  return (
    <section ref={sectionRef} id="update-progress" aria-labelledby="update-progress-heading" className="scroll-mt-20 rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-3 md:px-6">
        <NotebookPen className="size-4 text-muted-foreground" aria-hidden />
        <h2 id="update-progress-heading" className="text-sm font-semibold">
          Update progress
        </h2>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
          {fresh ? "Leave a note for whoever picks this up next, including you." : "Press U from anywhere on this page."}
        </span>
      </div>
      <div className="px-5 py-4 md:px-6">
        <UpdateProgressForm key={`${context.task.status}-${context.task.assigneeId ?? ""}`} context={context} progressRef={progressRef} />
      </div>
    </section>
  );
}
