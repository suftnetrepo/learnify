"use client";
import type { CreateLecturePayload, UpdateLecturePayload } from "@/types/course.types";

import { useState, useOptimistic, useTransition } from "react";
import {
  Plus, ChevronDown, ChevronRight, Pencil,
  Trash2, GripVertical, Video, FileText, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ConfirmModal } from "@/components/ui/Modal";
import { CloudinaryUploader } from "@/components/course/CloudinaryUploader";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDuration } from "@/lib/utils";
import { useSections, useLectures } from "@/hooks/useCourses";

interface Lecture {
  id: string; title: string; videoUrl: string | null; videoDuration: number | null;
  isFree: boolean; isPublished: boolean; sortOrder: number;
  thumbnailUrl: string | null; videoPublicId: string | null;
}
interface Section { id: string; title: string; sortOrder: number; lectures: Lecture[] }
interface Props   { courseId: string; initialSections: Section[] }

export function SectionsManager({ courseId, initialSections }: Props) {
  const [sections,  setSections]  = useState<Section[]>(initialSections);
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>(
    Object.fromEntries(initialSections.map((s) => [s.id, true]))
  );
  const [addingSection,    setAddingSection]    = useState(false);
  const [newSectionTitle,  setNewSectionTitle]  = useState("");
  const [lectureModal,     setLectureModal]     = useState<{ sectionId: string; lecture?: Lecture } | null>(null);
  const [deleteSection,    setDeleteSection]    = useState<string | null>(null);
  const [deleteLectureIds, setDeleteLectureIds] = useState<{ sectionId: string; lectureId: string } | null>(null);

  const { createSection, deleteSection: doDeleteSection, creating, deleting: deletingSection } = useSections(courseId);
  const { createLecture, updateLecture, deleteLecture, togglePublished, deleting: deletingLecture } = useLectures();

  // ─ Section CRUD ────────────────────────────────────────────────────────────
  async function handleCreateSection() {
    if (!newSectionTitle.trim()) return;
    const res = await createSection(newSectionTitle.trim());
    if (res) {
      setSections((prev) => [...prev, { ...res as Section, lectures: [] }]);
      setExpanded((prev) => ({ ...prev, [(res as Section).id]: true }));
      setNewSectionTitle("");
      setAddingSection(false);
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

  return (
    <div className="space-y-3">
      {sections.length === 0 && !addingSection && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-surface-200 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-100">
            <FileText size={22} className="text-gray-300" />
          </div>
          <p className="text-sm font-medium text-gray-500">No sections yet</p>
          <p className="mt-1 text-xs text-gray-400">Add your first section to start building the curriculum.</p>
          <Button size="sm" leftIcon={<Plus size={14} />} className="mt-4" onClick={() => setAddingSection(true)}>
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
            </button>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="sm" leftIcon={<Plus size={13} />}
                onClick={() => setLectureModal({ sectionId: section.id })}>
                Add lecture
              </Button>
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
                      {!lecture.isPublished && <Badge variant="neutral">Draft</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleTogglePublished(lecture, section.id)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                        lecture.isPublished ? "text-emerald-500 hover:bg-emerald-50" : "text-gray-300 hover:bg-surface-100"
                      )}
                      title={lecture.isPublished ? "Published" : "Draft — click to publish"}>
                      {lecture.isPublished ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
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
      {addingSection ? (
        <div className="card p-4 space-y-3">
          <Input label="Section title" placeholder="e.g. Introduction to TypeScript"
            value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateSection(); }} />
          <div className="flex gap-2">
            <Button loading={creating} onClick={handleCreateSection} disabled={!newSectionTitle.trim()}>
              Add Section
            </Button>
            <Button variant="ghost" onClick={() => { setAddingSection(false); setNewSectionTitle(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : sections.length > 0 && (
        <Button variant="secondary" leftIcon={<Plus size={15} />} onClick={() => setAddingSection(true)} className="w-full">
          Add Section
        </Button>
      )}

      {/* Lecture modal */}
      <LectureModal
        open={!!lectureModal}
        onClose={() => setLectureModal(null)}
        onSave={(values) => handleSaveLecture(lectureModal!.sectionId, values)}
        lecture={lectureModal?.lecture}
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
  const [isPublished,   setIsPublished]   = useState(lecture?.isPublished ?? false);
  const [saving,        setSaving]        = useState(false);
  const [titleError,    setTitleError]    = useState("");

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
