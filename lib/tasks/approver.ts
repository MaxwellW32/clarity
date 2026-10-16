/** Who approves by default: the current approver, else a lead who isn't the assignee, else an admin, else any lead. */
export function defaultApproverFor(
  people: { id: string; lead: boolean; admin: boolean }[],
  approverId: string | null,
  assigneeId: string | null,
): string | null {
  return (
    approverId ??
    people.find((person) => person.lead && person.id !== assigneeId)?.id ??
    people.find((person) => person.admin && person.id !== assigneeId)?.id ??
    people.find((person) => person.lead)?.id ??
    null
  );
}
