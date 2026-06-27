import {
  Inbox,
  AlertCircle,
  Clock,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  XCircle,
  Flame,
  ArrowUp,
  Minus,
  ArrowDown,
  Trash2,
  MapPin,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { ReportStatus, Priority, ReportType } from "@/lib/types";

// ---------------------------------------------------------------------------
// Status — monochrome (no colors, use typography + borders + opacity)
// ---------------------------------------------------------------------------
export interface StatusConfig {
  label: string;
  icon: LucideIcon;
  className: string;   // badge classes
  dotColor: string;     // map dot
  mapPin: string;       // map marker
}

export const STATUS_CONFIG: Record<ReportStatus, StatusConfig> = {
  NEW: {
    label: "New",
    icon: Inbox,
    className: "font-bold border-l-2 border-foreground",
    dotColor: "bg-foreground",
    mapPin: "#fafafa",
  },
  TRIAGED: {
    label: "Triaged",
    icon: AlertCircle,
    className: "font-bold border-l-2 border-muted-foreground",
    dotColor: "bg-muted-foreground",
    mapPin: "#a0a0a0",
  },
  ASSIGNED: {
    label: "Assigned",
    icon: Clock,
    className: "font-bold border-l-[3px] border-double border-foreground",
    dotColor: "bg-foreground",
    mapPin: "#d4d4d4",
  },
  IN_PROGRESS: {
    label: "In Progress",
    icon: PlayCircle,
    className: "font-bold border-l-2 border-foreground animate-pulse-dot",
    dotColor: "bg-foreground",
    mapPin: "#fafafa",
  },
  BLOCKED: {
    label: "Blocked",
    icon: PauseCircle,
    className: "font-bold border-l-2 border-foreground",
    dotColor: "bg-foreground",
    mapPin: "#e5e5e5",
  },
  DONE: {
    label: "Done",
    icon: CheckCircle2,
    className: "opacity-50",
    dotColor: "bg-muted-foreground",
    mapPin: "#737373",
  },
  REJECTED: {
    label: "Rejected",
    icon: XCircle,
    className: "opacity-30 line-through",
    dotColor: "bg-muted-foreground",
    mapPin: "#525252",
  },
};

// ---------------------------------------------------------------------------
// Priority — chevrons instead of colors
// ---------------------------------------------------------------------------
export interface PriorityConfig {
  label: string;
  icon: LucideIcon;
  chevrons: string; // ">" for LOW, ">>>>" for CRITICAL
  className: string;
}

export const PRIORITY_CONFIG: Record<Priority, PriorityConfig> = {
  CRITICAL: {
    label: "Critical",
    icon: Flame,
    chevrons: ">>>>",
    className: "font-bold",
  },
  HIGH: {
    label: "High",
    icon: ArrowUp,
    chevrons: ">>>",
    className: "font-semibold",
  },
  MEDIUM: {
    label: "Medium",
    icon: Minus,
    chevrons: ">>",
    className: "font-medium",
  },
  LOW: {
    label: "Low",
    icon: ArrowDown,
    chevrons: ">",
    className: "font-normal",
  },
};

// ---------------------------------------------------------------------------
// Report Type
// ---------------------------------------------------------------------------
export interface TypeConfig {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const TYPE_CONFIG: Record<ReportType, TypeConfig> = {
  OVERFLOW: { label: "Overflowing Bin", shortLabel: "Overflow", icon: Trash2 },
  ILLEGAL_DUMP: { label: "Illegal Dumping", shortLabel: "Illegal Dump", icon: MapPin },
  MISSED_PICKUP: { label: "Missed Pickup", shortLabel: "Missed Pickup", icon: Package },
};

// ---------------------------------------------------------------------------
// SLA helpers
// ---------------------------------------------------------------------------
export type SlaState = "on-time" | "due-soon" | "overdue";

export interface SlaInfo {
  state: SlaState;
  label: string;
  className: string;
}

export function getSlaInfo(
  slaDueAt: string | null | undefined,
): SlaInfo | null {
  if (!slaDueAt) return null;
  const due = new Date(slaDueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffH = diffMs / 3_600_000;

  if (diffMs < 0) {
    const overH = Math.round(Math.abs(diffH));
    return {
      state: "overdue",
      label: `${overH}h overdue`,
      className: "font-bold border-l-2 border-destructive",
    };
  }
  if (diffH < 4) {
    return {
      state: "due-soon",
      label: `${Math.round(diffH)}h left`,
      className: "font-medium",
    };
  }
  if (diffH < 24) {
    return {
      state: "on-time",
      label: `${Math.round(diffH)}h left`,
      className: "",
    };
  }
  const days = Math.round(diffH / 24);
  return {
    state: "on-time",
    label: `${days}d left`,
    className: "",
  };
}

// ---------------------------------------------------------------------------
// Age helper — "3h" / "2d"
// ---------------------------------------------------------------------------
export function getAge(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Human-readable date
// ---------------------------------------------------------------------------
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
