import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm:   "p-4",
  md:   "p-6",
  lg:   "p-8",
};

export function Card({ children, className, hover, padding = "md" }: CardProps) {
  return (
    <div className={cn(
      "card",
      paddingClasses[padding],
      hover && "card-hover cursor-pointer",
      className
    )}>
      {children}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label:      string;
  value:      string | number;
  delta?:     string;
  deltaType?: "up" | "down" | "neutral";
  icon?:      React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, delta, deltaType = "neutral", icon, className }: StatCardProps) {
  return (
    <Card className={cn("flex items-start justify-between", className)}>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
        <p className="mt-1.5 heading-2 text-gray-900">{value}</p>
        {delta && (
          <p className={cn("mt-1 text-xs font-medium", {
            "text-emerald-600": deltaType === "up",
            "text-red-500":     deltaType === "down",
            "text-gray-400":    deltaType === "neutral",
          })}>
            {deltaType === "up" && <TrendingUp size={11} className="inline mr-0.5" />}{deltaType === "down" && <TrendingDown size={11} className="inline mr-0.5" />}{delta}
          </p>
        )}
      </div>
      {icon && (
        <div className="ml-4 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          {icon}
        </div>
      )}
    </Card>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
  icon?:        React.ReactNode;
  title:        string;
  description?: string;
  action?:      React.ReactNode;
  className?:   string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-100 text-gray-300">
          {icon}
        </div>
      )}
      <h3 className="heading-3 text-gray-700">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-gray-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
