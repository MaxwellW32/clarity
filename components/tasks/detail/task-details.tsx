import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Person, TaskAbilities, TaskDetail } from "@/lib/tasks/types";
import { DescriptionEditor, SizeEditor } from "./detail-editors";

type When = { relative: string; absolute: string };

const nameOf = (person: Person | null | undefined) => person?.name ?? person?.email ?? "—";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm sm:grid sm:grid-cols-[9rem_minmax(0,1fr)] sm:justify-start">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right sm:text-left">{children}</dd>
    </div>
  );
}

function Stamp({ when }: { when: When }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{when.relative}</span>
      </TooltipTrigger>
      <TooltipContent>{when.absolute}</TooltipContent>
    </Tooltip>
  );
}

/** The description and the facts that rarely change. Editors see inline controls; everyone else sees text. */
export function TaskDetails({
  detail,
  abilities,
  started,
  completed,
}: {
  detail: TaskDetail;
  abilities: TaskAbilities;
  started: When | null;
  completed: When | null;
}) {
  return (
    <section aria-labelledby="details-heading" className="rounded-xl border bg-card">
      <h2 id="details-heading" className="border-b px-5 py-3 text-sm font-semibold md:px-6">
        Details
      </h2>
      <div className="grid gap-4 px-5 py-4 md:px-6">
        <DescriptionEditor taskId={detail.id} description={detail.description} editable={abilities.edit} />
        <dl className="divide-y border-t">
          <Row label="Team">
            {detail.team.name}
            {detail.project ? <span className="text-muted-foreground"> · {detail.project.name}</span> : null}
          </Row>
          <Row label="Size">
            <SizeEditor taskId={detail.id} size={detail.size} editable={abilities.edit} />
          </Row>
          {detail.approver ? <Row label="Approver">{nameOf(detail.approver)}</Row> : null}
          <Row label="Created by">{nameOf(detail.creator)}</Row>
          {started ? (
            <Row label="Started">
              <Stamp when={started} />
            </Row>
          ) : null}
          {completed ? (
            <Row label="Completed">
              <Stamp when={completed} />
            </Row>
          ) : null}
          {detail.request ? (
            <Row label="From request">
              <Link href={`/requests/${detail.request.id}`} className="text-link underline-offset-4 hover:underline">
                {detail.request.title}
              </Link>
            </Row>
          ) : null}
        </dl>
      </div>
    </section>
  );
}
