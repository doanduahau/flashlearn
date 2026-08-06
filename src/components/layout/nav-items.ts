import {
  BarChart3,
  CirclePlus,
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
  { label: "T\u1ed5ng quan", href: "/dashboard", icon: Home },
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

export const mobilePrimaryNavItems: NavItem[] = [
  { label: "T\u1ed5ng quan", href: "/dashboard", icon: Home },
  { label: "B\u1ed9 flashcard", href: "/sets", icon: Layers },
  { label: "H\u1ecdc", href: "/study", icon: GraduationCap },
  { label: "Ki\u1ec3m tra", href: "/quiz", icon: ListChecks },
  { label: "Th\u00eam", href: "#more", icon: CirclePlus },
];

export const mobileOverflowNavItems: NavItem[] = [
  { label: "Import", href: "/import", icon: Upload },
  { label: "B\u1ed9 \u0111\u1eb7c bi\u1ec7t", href: "/collections", icon: FolderHeart },
  ...secondaryNavItems,
];
