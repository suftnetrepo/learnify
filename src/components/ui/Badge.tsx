import { cn } from "@/lib/utils";

type BadgeVariant = "brand" | "success" | "warning" | "danger" | "neutral" | "accent";

const variantClasses: Record<BadgeVariant, string> = {
  brand:   "bg-brand-50 text-brand-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger:  "bg-red-50 text-red-700",
  neutral: "bg-surface-100 text-gray-600",
  accent:  "bg-accent-50 text-accent-600",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ variant = "neutral", children, className, dot }: BadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
      variantClasses[variant],
      className
    )}>
      {dot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", {
          "bg-brand-500":   variant === "brand",
          "bg-emerald-500": variant === "success",
          "bg-amber-500":   variant === "warning",
          "bg-red-500":     variant === "danger",
          "bg-gray-400":    variant === "neutral",
          "bg-accent-500":  variant === "accent",
        })} />
      )}
      {children}
    </span>
  );
}

// Convenience maps for status values
export function UserStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    active:    "success",
    pending:   "warning",
    suspended: "danger",
    invited:   "brand",
  };
  return <Badge variant={map[status] ?? "neutral"} dot>{status}</Badge>;
}

export function CourseStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    published: "success",
    draft:     "neutral",
    archived:  "danger",
  };
  return <Badge variant={map[status] ?? "neutral"} dot>{status}</Badge>;
}

export function PurchaseStatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    completed: "success",
    pending:   "warning",
    refunded:  "accent",
    failed:    "danger",
  };
  return <Badge variant={map[status] ?? "neutral"} dot>{status}</Badge>;
}
