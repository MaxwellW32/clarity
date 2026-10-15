import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/components/settings/settings-tabs";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsTabs />
      {children}
    </div>
  );
}
