import type { Metadata } from "next";
import { ProfileForm } from "@/components/settings/profile-form";
import { timeZoneOptions } from "@/lib/time";
import { requireViewerContext } from "@/lib/viewer";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, org } = await requireViewerContext();
  return (
    <ProfileForm
      name={user.name ?? ""}
      email={user.email}
      timezone={user.timezone ?? ""}
      orgTimezone={org.timezone}
      orgName={org.name}
      zones={timeZoneOptions()}
    />
  );
}
