import { BarChart3, Inbox, LayoutGrid, ListChecks, Target, Users, type LucideIcon } from "lucide-react";
import type { NavKey } from "@/lib/permissions";

export const NAV_ITEMS: Record<NavKey, { href: string; label: string; icon: LucideIcon }> = {
  overview: { href: "/overview", label: "Overview", icon: LayoutGrid },
  "my-work": { href: "/my-work", label: "My Work", icon: ListChecks },
  team: { href: "/team", label: "Team", icon: Users },
  requests: { href: "/requests", label: "Requests", icon: Inbox },
  goals: { href: "/goals", label: "Goals", icon: Target },
  reports: { href: "/reports", label: "Reports", icon: BarChart3 },
};

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
