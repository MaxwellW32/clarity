import type { Metadata } from "next";
import { NotificationPreferencesForm } from "@/components/settings/notification-preferences";
import { ProfileForm } from "@/components/settings/profile-form";
import { getPreferences } from "@/lib/dal/notifications";
import { timeZoneOptions } from "@/lib/time";
import { requireViewerContext } from "@/lib/viewer";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, org } = await requireViewerContext();
  const preferences = await getPreferences(user.id);
  return (
    <div className="grid gap-6">
      <ProfileForm
        name={user.name ?? ""}
        email={user.email}
        timezone={user.timezone ?? ""}
        orgTimezone={org.timezone}
        orgName={org.name}
        zones={timeZoneOptions()}
      />
      <NotificationPreferencesForm initial={preferences} email={user.email} />
    </div>
  );
}
