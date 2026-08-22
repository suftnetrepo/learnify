"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useCourseForm } from "@/hooks/useCourses";
import { useToast } from "@/components/ui/Toast";
import {
  BookOpen, DollarSign, Tag, Globe, MapPin,
  Eye, Archive, FileEdit, CheckCircle2, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Category { id: string; name: string }

interface CourseFormProps {
  categories:   Category[];
  initialData?: {
    id?:               string;
    title?:            string;
    description?:      string;
    shortDescription?: string;
    price?:            number;
    format?:           string;
    location?:         string;
    status?:           string;
    categoryId?:       string;
    level?:            string;
    language?:         string;
  };
  mode: "create" | "edit";
  /** Hide the publication-status picker — for manager-tutors, who can edit
   *  content and pricing but publish only via the admin approval flow. */
  hidePublish?: boolean;
  hideStatus?:  boolean;
}

type StatusKey = "draft" | "published" | "archived";

const STATUS_CONFIG: Record<StatusKey, {
  icon: React.ReactNode; label: string; description: string;
  activeRing: string; activeBg: string; activeText: string;
}> = {
  draft: {
    icon: <FileEdit size={15} />,
    label: "Draft",
    description: "Not visible to students. Publish when ready.",
    activeRing: "ring-2 ring-brand-200 border-brand-300",
    activeBg:   "bg-brand-50",
    activeText: "text-brand-700",
  },
  published: {
    icon: <Eye size={15} />,
    label: "Published",
    description: "Live in the catalogue. Students can purchase.",
    activeRing: "ring-2 ring-emerald-200 border-emerald-300",
    activeBg:   "bg-emerald-50",
    activeText: "text-emerald-700",
  },
  archived: {
    icon: <Archive size={15} />,
    label: "Archived",
    description: "Hidden from listings. Existing students keep access.",
    activeRing: "ring-2 ring-red-200 border-red-300",
    activeBg:   "bg-red-50",
    activeText: "text-red-700",
  },
};

function SectionCard({ icon, title, sub, children }: {
  icon: React.ReactNode; title: string; sub: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-card">
      <div className="flex items-start gap-3 pb-4 border-b border-surface-100 mb-5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icon}</div>
        <div><p className="text-sm font-bold text-gray-900">{title}</p><p className="text-xs text-gray-400 mt-0.5">{sub}</p></div>
      </div>
      {children}
    </div>
  );
}

export function CourseForm({ categories, initialData, mode, hidePublish, hideStatus }: CourseFormProps) {
  const showPublishSection = !(hidePublish || hideStatus);
  const router = useRouter();
  const { success } = useToast();
  const { save, loading, error } = useCourseForm(initialData?.id);

  const [format,           setFormat]           = useState(initialData?.format ?? "online");
  const [status,           setStatus]           = useState<StatusKey>((initialData?.status as StatusKey) ?? "draft");
  const [description,      setDescription]      = useState(initialData?.description ?? "");
  const [shortDescription, setShortDescription] = useState(initialData?.shortDescription ?? "");
  const [fieldErrors,      setFieldErrors]      = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    // Client-side validation
    const title = (fd.get("title") as string).trim();
    if (!title) { setFieldErrors({ title: "Course title is required" }); return; }
    setFieldErrors({});

    const res = await save({
      title,
      description,
      shortDescription,
      price:       Number(fd.get("price")),
      format:      (fd.get("format") as "online" | "in_person" | "hybrid") ?? "online",
      location:    (fd.get("location") as string) || undefined,
      status,
      categoryId:  (fd.get("categoryId") as string) || undefined,
      level:       (fd.get("level") as "beginner" | "intermediate" | "advanced") || undefined,
      language:    fd.get("language") as string,
    });

    if (res && mode === "edit") {
      // refresh handled by hook
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* Global error */}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <Info size={15} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Basic Info */}
      <SectionCard icon={<BookOpen size={16} />} title="Basic Information" sub="Core details students will see in the catalogue.">
        <div className="space-y-4">
          <Input label="Course Title" name="title" placeholder="e.g. Complete Next.js 15 Masterclass"
            defaultValue={initialData?.title} error={fieldErrors.title} required
            hint="Keep it specific and descriptive — 60 characters or fewer works best." />
          <div>
            <label className="form-label">Short Description <span className="font-normal text-gray-400">(shown on cards)</span></label>
            <div className="relative">
              <textarea name="shortDescription" value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="One compelling sentence about what this course delivers…"
                maxLength={500} rows={2} className="form-input resize-none pr-14" />
              <span className={cn("absolute bottom-2 right-3 text-xs pointer-events-none", shortDescription.length > 450 ? "text-amber-500" : "text-gray-300")}>
                {shortDescription.length}/500
              </span>
            </div>
          </div>
          <div>
            <label className="form-label">Full Description <span className="font-normal text-gray-400">(course detail page)</span></label>
            <textarea name="description" value={description} onChange={(e) => setDescription(e.target.value)}
              rows={6} placeholder="Describe what students will learn, who it's for, and what makes it unique…"
              className="form-input resize-none" />
          </div>
        </div>
      </SectionCard>

      {/* Pricing */}
      <SectionCard icon={<DollarSign size={16} />} title="Pricing & Format" sub="Set how much this course costs and how it is delivered.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="form-label">Price (£) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">£</span>
              <input name="price" type="number" min="0" step="0.01" defaultValue={initialData?.price ?? 0}
                className="form-input pl-7" required />
            </div>
            {fieldErrors.price && <p className="form-error">{fieldErrors.price}</p>}
            <p className="form-hint">Students see the price including applicable tax.</p>
          </div>
          <Select label="Format" name="format" value={format} onChange={(e) => setFormat(e.target.value)}
            options={[
              { value: "online",    label: "Online — fully remote" },
              { value: "in_person", label: "In-person — physical location" },
              { value: "hybrid",    label: "Hybrid — online & in-person" },
            ]} error={fieldErrors.format} required />
          {(format === "in_person" || format === "hybrid") && (
            <div className="sm:col-span-2">
              <label className="form-label flex items-center gap-1.5">
                <MapPin size={12} className="text-gray-400" /> Location / Address <span className="text-red-500">*</span>
              </label>
              <input name="location" type="text" defaultValue={initialData?.location}
                placeholder="e.g. The Shard, 32 London Bridge St, London SE1 9SG"
                className={cn("form-input", fieldErrors.location && "border-red-400")} required />
              {fieldErrors.location && <p className="form-error">{fieldErrors.location}</p>}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Classification */}
      <SectionCard icon={<Tag size={16} />} title="Classification" sub="Help students find this course with the right category and skill level.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Category" name="categoryId" defaultValue={initialData?.categoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Select a category" />
          <Select label="Level" name="level" defaultValue={initialData?.level}
            options={[
              { value: "beginner",     label: "Beginner" },
              { value: "intermediate", label: "Intermediate" },
              { value: "advanced",     label: "Advanced" },
            ]} placeholder="Select level" />
          <div>
            <label className="form-label flex items-center gap-1.5">
              <Globe size={12} className="text-gray-400" /> Language
            </label>
            <input name="language" type="text" defaultValue={initialData?.language ?? "English"} className="form-input" />
          </div>
        </div>
      </SectionCard>

      {/* Status */}
      {showPublishSection && (
        <SectionCard icon={<Eye size={16} />} title="Publication Status" sub="Control whether this course is visible to students.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(Object.keys(STATUS_CONFIG) as StatusKey[]).map((key) => {
              const cfg      = STATUS_CONFIG[key];
              const isActive = status === key;
              return (
                <button key={key} type="button" onClick={() => setStatus(key)}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all",
                    isActive
                      ? `${cfg.activeRing} ${cfg.activeBg} ${cfg.activeText}`
                      : "border-surface-200 bg-white text-gray-600 hover:border-brand-200 hover:bg-surface-50"
                  )}>
                  <div className="flex w-full items-center gap-2">
                    {cfg.icon}
                    <span className="text-sm font-semibold">{cfg.label}</span>
                    {isActive && <CheckCircle2 size={13} className="ml-auto" />}
                  </div>
                  <p className="text-xs leading-relaxed opacity-75">{cfg.description}</p>
                </button>
              );
            })}
          </div>
          {status === "published" && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <Info size={13} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700">Publishing makes this course immediately available for purchase. Ensure all sections and lectures are added first.</p>
            </div>
          )}
        </SectionCard>
      )}

      {!showPublishSection && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Publishing is handled by the platform admin — submit this course for approval from the banner above once it&apos;s ready.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-6 py-4 shadow-card">
        <Button variant="ghost" type="button" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" loading={loading} leftIcon={!loading ? <CheckCircle2 size={15} /> : undefined}>
          {mode === "create" ? "Create Course" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}
