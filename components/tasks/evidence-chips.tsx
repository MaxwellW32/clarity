"use client";

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { EvidenceLink } from "@/lib/tasks/types";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Evidence as compact chips: open in a new tab, or copy the link. */
export function EvidenceChips({ links }: { links: EvidenceLink[] }) {
  if (links.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Evidence">
      {links.map((link) => (
        <li key={link.id} className="flex max-w-full items-center overflow-hidden rounded-md border bg-background text-xs">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-1.5 px-2 py-1 hover:bg-accent"
            title={link.url}
          >
            <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{link.label ?? hostOf(link.url)}</span>
          </a>
          <button
            type="button"
            aria-label={`Copy link: ${link.label ?? hostOf(link.url)}`}
            className="border-l px-1.5 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={async () => {
              await navigator.clipboard.writeText(link.url);
              toast.success("Link copied.");
            }}
          >
            <Copy className="size-3" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
