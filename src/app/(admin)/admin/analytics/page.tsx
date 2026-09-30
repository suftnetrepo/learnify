import { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Bot } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import { PlatformTab } from "./PlatformTab";
import { AiUsageTab } from "./AiUsageTab";

export const metadata: Metadata = { title: "Analytics" };

const TABS = [
  { id: "platform", label: "Platform", icon: BarChart3 },
  { id: "ai",       label: "AI Usage", icon: Bot },
] as const;

interface Props { searchParams: Promise<{ tab?: string }> }

export default async function AnalyticsPage({ searchParams }: Props) {
  // The tab lives in the URL (?tab=platform | ?tab=ai) so a shared link opens the same view
  const { tab: requested } = await searchParams;
  const tab = requested === "ai" ? "ai" : "platform";

  return (
    <div>
      <Topbar breadcrumbs={[{ label: "Admin" }, { label: "Analytics" }]} />
      <div className="p-6 space-y-6">
        <div>
          <h1 className="heading-1 text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tab === "ai" ? "AI tutor usage from StudyMind" : "Platform performance"} · Updates every 5 minutes
          </p>
        </div>

        <nav role="tablist" className="flex gap-1 border-b border-surface-100">
          {TABS.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              href={`/admin/analytics?tab=${id}`}
              role="tab"
              aria-selected={tab === id}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                tab === id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:border-surface-300 hover:text-gray-800"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </nav>

        {tab === "ai" ? <AiUsageTab /> : <PlatformTab />}
      </div>
    </div>
  );
}
