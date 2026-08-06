import { GraduationCap, Home, Layers, ListChecks, UserRound, type LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  activePaths?: string[];
}

export const mainNavItems: NavItem[] = [
  { label: "Tổng quan", href: "/dashboard", icon: Home },
  {
    label: "Bộ flashcard",
    href: "/sets",
    icon: Layers,
    activePaths: ["/sets", "/collections"],
  },
  { label: "Học", href: "/study", icon: GraduationCap },
  { label: "Kiểm tra", href: "/quiz", icon: ListChecks },
  {
    label: "Cá nhân",
    href: "/profile",
    icon: UserRound,
    activePaths: ["/profile", "/settings", "/statistics"],
  },
];

export const mobilePrimaryNavItems = mainNavItems;
