import {
  BarChart3,
  FolderHeart,
  GraduationCap,
  History,
  Home,
  Layers,
  ListChecks,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Import", href: "/import", icon: Upload },
  { label: "Bộ flashcard", href: "/sets", icon: Layers },
  { label: "Bộ đặc biệt", href: "/collections", icon: FolderHeart },
  { label: "Học", href: "/study", icon: GraduationCap },
  { label: "Kiểm tra", href: "/quiz", icon: ListChecks },
];

export const secondaryNavItems: NavItem[] = [
  { label: "Lịch sử", href: "/history", icon: History },
  { label: "Thống kê", href: "/statistics", icon: BarChart3 },
  { label: "Cài đặt", href: "/settings", icon: Settings },
];
