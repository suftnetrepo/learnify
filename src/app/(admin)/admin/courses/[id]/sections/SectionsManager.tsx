"use client";
import type {
  CreateLecturePayload, UpdateLecturePayload, CreateSectionPayload,
  LectureResource, LectureResourceType, CourseFormat,
} from "@/types/course.types";

import { useState, useEffect, useOptimistic, useTransition } from "react";
import {
  Plus, ChevronDown, ChevronRight, Pencil,
  Trash2, GripVertical, Video, FileText,
  Archive, Code2, Link as LinkIcon, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { CloudinaryUploader } from "@/components/course/CloudinaryUploader";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { cn, formatDuration } from "@/lib/utils";
import { useSections, useLectures } from "@/hooks/useCourses";
import { resourcesApi } from "@/lib/api-client";

interface Lecture {
  id: string; title: string; videoUrl: string | null; videoDuration: number | null;
  isFree: boolean; isPublished: boolean; sortOrder: number;
  thumbnailUrl: string | null; videoPublicId: string | null;
}
interface Section {
  id: string; title: string; sortOrder: number; lectures: Lecture[];
  // Plain "HH:MM:SS" clock time — no date/timezone component. A section is a
  // time slot in the day for in-person/hybrid courses (e.g. "Morning
  // Session, 09:00–11:00"); the lectures inside it are just topics covered
  // in that slot, not separately scheduled.
  scheduledStart: string | null;
  scheduledEnd:   string | null;
}
interface Props   { courseId: string; initialSections: Section[]; format: CourseFormat }

const RESOURCE_TYPE_OPTIONS: { value: LectureResourceType; label: string }[] = [
  { value: "pdf",    label: "PDF" },
  { value: "zip",    label: "ZIP archive" },
  { value: "github", label: "GitHub repo" },
  { value: "link",   label: "External link" },
  { value: "video",  label: "Video" },
];

const RESOURCE_TYPE_ICONS: Record<LectureResourceType, React.ReactNode> = {
  pdf:    <FileText size={14} />,
  zip:    <Archive  size={14} />,
  github: <Code2    size={14} />,
  link:   <LinkIcon size={14} />,
  video:  <Video    size={14} />,
};

export function SectionsManager({ courseId, initialSections, format }: Props) {
  const [sections,  setSections]  = useState<Section[]>(initialSections);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>(
    Object.fromEntries(initialSections.map((s) => [s.id, true]))
  );
  const [sectionModal,     setSectionModal]     = useState<{ section?: Section } | null>(null);
  const [lectureModal,     setLectureModal]     = useState<{ sectionId: string; lecture?: Lecture } | null>(null);
  const [deleteSection,    setDeleteSection]    = useState<string | null>(null);
  const [deleteLectureIds, setDeleteLectureIds] = useState<{ sectionId: string; lectureId: string } | null>(null);

  const { createSection, updateSection, deleteSection: doDeleteSection, deleting: deletingSection } = useSections(courseId);
  const { createLecture, updateLecture, deleteLecture, togglePublished, deleting: deletingLecture } = useLectures();
  const { success } = useToast();

  // ─ Section CRUD ────────────────────────────────────────────────────────────
  async function handleSaveSection(values: Partial<Section> & { title: string }) {
    const isEdit = !!values.id;
    const res    = isEdit
      ? await updateSection(values.id!, values as Partial<CreateSectionPayload>)
      : await createSection(values as CreateSectionPayload);

    if (res) {
      if (isEdit) {
        setSections((prev) => prev.map((s) => s.id === values.id ? { ...s, ...(res as Partial<Section>) } : s));
      } else {
        setSections((prev) => [...prev, { ...res as Section, lectures: [] }]);
        setExpanded((prev) => ({ ...prev, [(res as Section).id]: true }));
      }
      setSectionModal(null);
    }
  }

  async function handleDeleteSection(id: string) {
    const res = await doDeleteSection(id);
    if (res !== null) {
      setSections((prev) => prev.filter((s) => s.id !== id));
      setDeleteSection(null);
    }
  }

  // ─ Lecture CRUD ────────────────────────────────────────────────────────────
  async function handleSaveLecture(sectionId: string, values: Partial<Lecture> & { title: string }) {
    const isEdit = !!values.id;
    const res    = isEdit
      ? await updateLecture(values.id!, values as UpdateLecturePayload)
      : await createLecture(sectionId, values as CreateLecturePayload);

    if (res) {
      setSections((prev) => prev.map((s) => {
        if (s.id !== sectionId) return s;
        if (isEdit) {
          return { ...s, lectures: s.lectures.map((l) => l.id === (res as Lecture).id ? res as Lecture : l) };
        }
        return { ...s, lectures: [...s.lectures, res as Lecture] };
      }));
      setLectureModal(null);
    }
  }

  async function handleDeleteLecture(sectionId: string, lectureId: string) {
    const res = await deleteLecture(lectureId);
    if (res !== null) {
      setSections((prev) => prev.map((s) =>
        s.id === sectionId ? { ...s, lectures: s.lectures.filter((l) => l.id !== lectureId) } : s
      ));
      setDeleteLectureIds(null);
    }
  }

  async function handleTogglePublished(lecture: Lecture, sectionId: string) {
    const res = await togglePublished(lecture.id, !lecture.isPublished);
    if (res) {
      setSections((prev) => prev.map((s) =>
        s.id === sectionId
          ? { ...s, lectures: s.lectures.map((l) => l.id === lecture.id ? { ...l, isPublished: !l.isPublished } : l) }
          : s
      ));
    }
  }

  async function handlePublishAll() {
    const unpublished = sections.flatMap((s) => s.lectures).filter((l) => !l.isPublished);
    if (unpublished.length === 0) return;

    // togglePublished already toasts its own error per failed call (via the
    // useLectures() hook), so only successes need to be reconciled here —
    // marking every lecture published regardless of the actual per-call
    // result would show lectures as published in the UI that the server
    // actually rejected.
    const results     = await Promise.all(unpublished.map((l) => togglePublished(l.id, true)));
    const succeededIds = new Set(unpublished.filter((_, i) => results[i]).map((l) => l.id));

    if (succeededIds.size > 0) {
      setSections((prev) => prev.map((s) => ({
        ...s,
        lectures: s.lectures.map((l) => succeededIds.has(l.id) ? { ...l, isPublished: true } : l),
      })));
      success(
        succeededIds.size === unpublished.length
          ? "All lectures published"
          : `${succeededIds.size} of ${unpublished.length} lectures published`
      );
    }
  }

  return (
    <div className="space-y-3">
      {sections.length > 0 && (
        <div className="flex items-center justify-end">
          <button onClick={handlePublishAll} className="text-xs font-medium text-brand-600 hover:underline">
            Publish all
          </button>
        </div>
      )}

      {sections.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-200 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-100">
            <FileText size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No sections yet</p>
          <p className="mt-1 text-xs text-gray-400">Add your first section to start building the curriculum.</p>
          <Button size="sm" leftIcon={<Plus size={14} />} className="mt-4" onClick={() => setSectionModal({})}>
            Add First Section
          </Button>
        </div>
      )}

      {sections.map((section) => (
        <div key={section.id} className="card p-0 overflow-hidden">
          {/* Section header */}
          <div className="flex items-center gap-3 bg-surface-50 px-4 py-3 border-b border-surface-100">
            <GripVertical size={15} className="text-gray-300 cursor-grab flex-shrink-0" />
            <button
              onClick={() => setExpanded((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
              className="flex flex-1 items-center gap-2 text-left min-w-0"
            >
              {expanded[section.id]
                ? <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                : <ChevronRight size={15} className="text-gray-400 flex-shrink-0" />}
              <span className="font-semibold text-sm text-gray-900 truncate">{section.title}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{section.lectures.length} lecture{section.lectures.length !== 1 ? "s" : ""}</span>
              {section.scheduledStart && (
                <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Clock size={11} />
                  {section.scheduledStart.slice(0, 5)}
                  {section.scheduledEnd && <> – {section.scheduledEnd.slice(0, 5)}</>}
                </span>
              )}
            </button>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="sm" leftIcon={<Plus size={13} />}
                onClick={() => setLectureModal({ sectionId: section.id })}>
                Add lecture
              </Button>
              <button onClick={() => setSectionModal({ section })}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 transition-colors"
                aria-label="Edit section">
                <Pencil size={13} />
              </button>
              <button onClick={() => setDeleteSection(section.id)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                aria-label="Delete section">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Lectures */}
          {expanded[section.id] && (
            <div>
              {section.lectures.length === 0 ? (
                <div className="px-4 py-5 text-center text-sm text-gray-400">
                  No lectures yet.{" "}
                  <button onClick={() => setLectureModal({ sectionId: section.id })}
                    className="text-brand-600 hover:underline font-medium">Add one</button>
                </div>
              ) : section.lectures.map((lecture) => (
                <div key={lecture.id}
                  className="flex items-center gap-3 border-t border-surface-100 px-4 py-3 hover:bg-surface-50 transition-colors">
                  <GripVertical size={13} className="text-gray-200 cursor-grab flex-shrink-0" />
                  <div className={cn(
                    "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg",
                    lecture.videoUrl ? "bg-brand-50 text-brand-500" : "bg-surface-100 text-gray-400"
                  )}>
                    {lecture.videoUrl ? <Video size={13} /> : <FileText size={13} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{lecture.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {lecture.videoDuration && (
                        <span className="text-xs text-gray-400">{formatDuration(Math.round(lecture.videoDuration / 60))}</span>
                      )}
                      {lecture.isFree && <Badge variant="accent">Free preview</Badge>}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleTogglePublished(lecture, section.id); }}
                        title={lecture.isPublished ? "Published — click to unpublish" : "Draft — click to publish"}
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
                          lecture.isPublished
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        )}
                      >
                        {lecture.isPublished ? "Published" : "Draft"}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setLectureModal({ sectionId: section.id, lecture })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteLectureIds({ sectionId: section.id, lectureId: lecture.id })}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Add section */}
      {sections.length > 0 && (
        <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={() => setSectionModal({})} className="w-full">
          Add Section
        </Button>
      )}

      {/* Lecture modal */}
      {/* Keyed on the target lecture (or "new") so the form's useState hooks
          re-initialize from the current `lecture` prop every time a different
          lecture is edited — otherwise the same component instance keeps
          whatever values were left over from the previous time it was open. */}
      <LectureModal
        key={lectureModal?.lecture?.id ?? "new"}
        open={!!lectureModal}
        onClose={() => setLectureModal(null)}
        onSave={(values) => handleSaveLecture(lectureModal!.sectionId, values)}
        lecture={lectureModal?.lecture}
      />

      {/* Section modal — same key-based remount trick as LectureModal above */}
      <SectionModal
        key={sectionModal?.section?.id ?? "new-section"}
        open={!!sectionModal}
        onClose={() => setSectionModal(null)}
        onSave={handleSaveSection}
        section={sectionModal?.section}
        format={format}
      />

      {/* Delete section confirm */}
      <ConfirmModal
        open={!!deleteSection}
        onClose={() => setDeleteSection(null)}
        onConfirm={() => handleDeleteSection(deleteSection!)}
        title="Delete Section"
        description="This will also delete all lectures in this section. This cannot be undone."
        confirmLabel="Delete Section"
        variant="danger"
        loading={deletingSection}
      />

      {/* Delete lecture confirm */}
      <ConfirmModal
        open={!!deleteLectureIds}
        onClose={() => setDeleteLectureIds(null)}
        onConfirm={() => deleteLectureIds && handleDeleteLecture(deleteLectureIds.sectionId, deleteLectureIds.lectureId)}
        title="Delete Lecture"
        description="This lecture and its video will be permanently removed."
        confirmLabel="Delete Lecture"
        variant="danger"
        loading={deletingLecture}
      />
    </div>
  );
}

// ─── Lecture form modal ──────────────────────────────────────────────────────
interface LectureModalProps {
  open:     boolean;
  onClose:  () => void;
  onSave:   (values: Partial<Lecture> & { title: string }) => Promise<void>;
  lecture?: Lecture;
}

function LectureModal({ open, onClose, onSave, lecture }: LectureModalProps) {
  const [title,         setTitle]         = useState(lecture?.title ?? "");
  const [videoUrl,      setVideoUrl]      = useState(lecture?.videoUrl ?? "");
  const [videoPublicId, setVideoPublicId] = useState(lecture?.videoPublicId ?? "");
  const [videoDuration, setVideoDuration] = useState(lecture?.videoDuration ?? 0);
  const [thumbnailUrl,  setThumbnailUrl]  = useState(lecture?.thumbnailUrl ?? "");
  const [isFree,        setIsFree]        = useState(lecture?.isFree ?? false);
  const [isPublished,   setIsPublished]   = useState(lecture?.isPublished ?? true);
  const [saving,        setSaving]        = useState(false);
  const [titleError,    setTitleError]    = useState("");

  const { error: toastError } = useToast();

  // ─ Resources (only meaningful once the lecture exists) ──────────────────────
  const [resources,        setResources]        = useState<LectureResource[]>([]);
  const [loadingResources, setLoadingResources]  = useState(false);
  const [resourceType,     setResourceType]     = useState<LectureResourceType>("pdf");
  const [resourceLabel,    setResourceLabel]    = useState("");
  const [resourceUrl,      setResourceUrl]      = useState("");
  const [addingResource,   setAddingResource]   = useState(false);

  useEffect(() => {
    if (!lecture?.id) return;
    setLoadingResources(true);
    resourcesApi.list(lecture.id)
      .then(setResources)
      .catch((err) => toastError("Failed to load resources", err instanceof Error ? err.message : undefined))
      .finally(() => setLoadingResources(false));
  }, [lecture?.id]);

  async function handleAddResource() {
    if (!lecture?.id || !resourceLabel.trim() || !resourceUrl) return;
    setAddingResource(true);
    try {
      const created = await resourcesApi.create(lecture.id, {
        type:  resourceType,
        label: resourceLabel.trim(),
        url:   resourceUrl,
      });
      setResources((prev) => [...prev, created]);
      setResourceLabel("");
      setResourceUrl("");
      setResourceType("pdf");
    } catch (err) {
      toastError("Failed to add resource", err instanceof Error ? err.message : undefined);
    } finally {
      setAddingResource(false);
    }
  }

  async function handleDeleteResource(id: string) {
    try {
      await resourcesApi.remove(id);
      setResources((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      toastError("Failed to delete resource", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleSave() {
    if (!title.trim()) { setTitleError("Lecture title is required"); return; }
    setSaving(true);
    await onSave({
      id: lecture?.id,
      title: title.trim(),
      videoUrl:      videoUrl      || undefined,
      videoPublicId: videoPublicId || undefined,
      videoDuration: videoDuration || undefined,
      thumbnailUrl:  thumbnailUrl  || undefined,
      isFree,
      isPublished,
    });
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={lecture ? "Edit Lecture" : "Add Lecture"} size="lg">
      <div className="space-y-4">
        <Input label="Lecture Title" value={title}
          onChange={(e) => { setTitle(e.target.value); setTitleError(""); }}
          placeholder="e.g. Introduction and setup" error={titleError} required autoFocus />

        <CloudinaryUploader type="video" folder="lectures" label="Lecture Video"
          currentUrl={videoUrl || undefined}
          onSuccess={(result) => {
            setVideoUrl(result.secureUrl);
            setVideoPublicId(result.publicId);
            if (result.duration) setVideoDuration(Math.round(result.duration));
            if (result.thumbnailUrl) setThumbnailUrl(result.thumbnailUrl);
          }} />

        {/* Resources — needs a real lecture id, so hidden while adding a new lecture */}
        {lecture?.id && (
          <div className="space-y-3 border-t border-surface-100 pt-4">
            <p className="form-label">Resources</p>

            {loadingResources ? (
              <p className="text-xs text-gray-400">Loading resources…</p>
            ) : resources.length === 0 ? (
              <p className="text-xs text-gray-400">No resources added yet.</p>
            ) : (
              <div className="space-y-1.5">
                {resources.map((r) => (
                  <div key={r.id}
                    className="flex items-center gap-2.5 rounded-lg border border-surface-200 px-3 py-2">
                    <span className="flex-shrink-0 text-gray-400">{RESOURCE_TYPE_ICONS[r.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                      <p className="text-xs text-gray-400 truncate">{r.url}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteResource(r.id)}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                      aria-label="Delete resource">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add resource */}
            <div className="space-y-3 rounded-xl border border-dashed border-surface-200 p-3">
              <div className="grid grid-cols-2 gap-3">
                <Select label="Type" value={resourceType} options={RESOURCE_TYPE_OPTIONS}
                  onChange={(e) => setResourceType(e.target.value as LectureResourceType)} />
                <Input label="Label" placeholder="e.g. Week 1 Exercise Files"
                  value={resourceLabel} onChange={(e) => setResourceLabel(e.target.value)} />
              </div>

              {resourceType === "github" || resourceType === "link" ? (
                <Input label="URL" placeholder="https://…"
                  value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)} />
              ) : (
                <CloudinaryUploader
                  type={resourceType === "video" ? "video" : "document"}
                  folder="resources"
                  label="File"
                  currentUrl={resourceUrl || undefined}
                  onSuccess={(result) => setResourceUrl(result.secureUrl)} />
              )}

              <Button size="sm" variant="secondary" leftIcon={<Plus size={13} />}
                onClick={handleAddResource} loading={addingResource}
                disabled={!resourceLabel.trim() || !resourceUrl}>
                Add resource
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div onClick={() => setIsFree(!isFree)}
              className={cn("flex h-5 w-5 items-center justify-center rounded border-2 transition-all",
                isFree ? "bg-brand-500 border-brand-500" : "border-surface-300")}>
              {isFree && <svg width="10" height="8" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Free preview</span>
              <p className="text-xs text-gray-400">Visible before purchase</p>
            </div>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div onClick={() => setIsPublished(!isPublished)}
              className={cn("flex h-5 w-5 items-center justify-center rounded border-2 transition-all",
                isPublished ? "bg-brand-500 border-brand-500" : "border-surface-300")}>
              {isPublished && <svg width="10" height="8" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Published</span>
              <p className="text-xs text-gray-400">Visible to enrolled students</p>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!title.trim()}>
            {lecture ? "Save Changes" : "Add Lecture"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Section form modal ──────────────────────────────────────────────────────
interface SectionModalProps {
  open:     boolean;
  onClose:  () => void;
  onSave:   (values: Partial<Section> & { title: string }) => Promise<void>;
  section?: Section;
  format:   CourseFormat;
}

function SectionModal({ open, onClose, onSave, section, format }: SectionModalProps) {
  const [title,         setTitle]         = useState(section?.title ?? "");
  const [scheduledStart, setScheduledStart] = useState(section?.scheduledStart?.slice(0, 5) ?? "");
  const [scheduledEnd,   setScheduledEnd]   = useState(section?.scheduledEnd?.slice(0, 5)   ?? "");
  const [saving,        setSaving]        = useState(false);
  const [titleError,    setTitleError]    = useState("");

  async function handleSave() {
    if (!title.trim()) { setTitleError("Section title is required"); return; }
    setSaving(true);
    await onSave({
      id: section?.id,
      title: title.trim(),
      scheduledStart: scheduledStart || undefined,
      scheduledEnd:   scheduledEnd   || undefined,
    });
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={section ? "Edit Section" : "Add Section"} size="md">
      <div className="space-y-4">
        <Input label="Section Title" value={title}
          onChange={(e) => { setTitle(e.target.value); setTitleError(""); }}
          placeholder="e.g. Introduction to TypeScript" error={titleError} required autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }} />

        {(format === "in_person" || format === "hybrid") && (
          <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Clock size={11} /> Session Time
            </p>
            <p className="text-xs text-gray-400">
              When does this part of the day start and end? e.g. Morning session: 09:00 – 11:00
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Start time</label>
                <input
                  type="time"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">End time</label>
                <input
                  type="time"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} loading={saving} disabled={!title.trim()}>
            {section ? "Save Changes" : "Add Section"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
