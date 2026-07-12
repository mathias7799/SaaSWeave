import {
  Building2,
  LayoutDashboard,
  Mail,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Tag,
  Users
} from "lucide-react";

import { type ConsoleNavGroup } from "@/features/console-nav/config/console-nav.config";

export const adminNav: ConsoleNavGroup[] = [
  {
    heading: "Platform",
    items: [
      { exact: true, icon: LayoutDashboard, label: "Analytics", to: "/admin" },
      { icon: Building2, label: "Workspaces", to: "/admin/workspaces" },
      { icon: Tag, label: "Plans & catalog", to: "/admin/plans" },
      { icon: Users, label: "Users", to: "/admin/users" }
    ]
  },
  {
    heading: "Control",
    items: [
      { icon: SlidersHorizontal, label: "Platform features", to: "/admin/features" },
      { icon: Mail, label: "Emails", to: "/admin/emails" },
      { icon: ScrollText, label: "Audit log", to: "/admin/audit" },
      { icon: Settings, label: "Platform settings", to: "/admin/settings" }
    ]
  }
];
