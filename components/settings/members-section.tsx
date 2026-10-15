"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { changeMemberRole, removeMember } from "@/actions/members";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { ORG_ROLE_LABELS, ORG_ROLES, type OrgRole } from "@/lib/constants";
import { toastResult } from "@/lib/toast-result";
import { Section } from "./section";

type Member = { userId: string; name: string | null; email: string; image: string | null; role: OrgRole; joined: string };

function MemberRow({ member, isSelf, canManage }: { member: Member; isSelf: boolean; canManage: boolean }) {
  const [pending, startTransition] = useTransition();
  const label = member.name ?? member.email;

  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:flex sm:px-5">
      <UserAvatar name={member.name} email={member.email} image={member.image} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {label}
          {isSelf ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {member.email}
          <span className="hidden sm:inline"> · Joined {member.joined}</span>
        </p>
      </div>
      {canManage ? (
        <div className="col-start-2 flex items-center gap-1.5 sm:ml-auto">
          <NativeSelect
            aria-label={`Role for ${label}`}
            className="w-36"
            value={member.role}
            disabled={pending}
            onChange={(event) => {
              const role = event.target.value as OrgRole;
              startTransition(async () => {
                toastResult(await changeMemberRole({ userId: member.userId, role }));
              });
            }}
          >
            {ORG_ROLES.map((role) => (
              <option key={role} value={role}>
                {ORG_ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
          {isSelf ? (
            <span className="size-9" aria-hidden />
          ) : (
            <ConfirmDialog
              title={`Remove ${label}?`}
              description="They lose access to this organization and its teams straight away. Their tasks and history stay."
              confirmLabel="Remove member"
              pending={pending}
              onConfirm={() =>
                new Promise<boolean>((resolve) =>
                  startTransition(async () => resolve(toastResult(await removeMember({ userId: member.userId })))),
                )
              }
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Remove ${label}`} className="text-muted-foreground">
                  <Trash2 />
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <span className="col-start-2 text-xs text-muted-foreground sm:ml-auto">{ORG_ROLE_LABELS[member.role]}</span>
      )}
    </li>
  );
}

export function MembersSection({ members, viewerId, canManage }: { members: Member[]; viewerId: string; canManage: boolean }) {
  return (
    <Section
      id="members"
      title="Members"
      description={
        canManage
          ? "Admins manage members and teams. Stakeholders only submit requests and follow the decisions."
          : undefined
      }
    >
      <ul className="divide-y">
        {members.map((member) => (
          <MemberRow key={member.userId} member={member} isSelf={member.userId === viewerId} canManage={canManage} />
        ))}
      </ul>
    </Section>
  );
}
