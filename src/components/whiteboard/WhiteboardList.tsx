"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { format } from "date-fns";
import { MoreVertical, Pencil, Copy, Trash2, Plus, PenLine, BookOpen, Presentation, Radio } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { whiteboardsApi, type WhiteboardSummaryDTO } from "./whiteboard-api";
import type { JoinableSession } from "@/services/whiteboard-session.service";

interface Props {
  initialBoards: WhiteboardSummaryDTO[];
  courses:       { id: string; title: string }[];
  /** "/dashboard/whiteboards" or "/instructor/whiteboards" */
  basePath:      string;
  /** The user's own boards that have an active live session */
  liveBoardIds?: string[];
  /** Live sessions on other people's boards this user can join (e.g. their tutor's) */
  joinable?:     JoinableSession[];
}

export function WhiteboardList({ initialBoards, courses, basePath, liveBoardIds = [], joinable = [] }: Props) {
  const live = useMemo(() => new Set(liveBoardIds), [liveBoardIds]);
  const router = useRouter();
  const { error: toastError, success } = useToast();

  const [boards,        setBoards]        = useState(initialBoards);
  const [courseFilter,  setCourseFilter]  = useState<string>("");   // "" = All
  const [creating,      setCreating]      = useState(false);
  const [renamingId,    setRenamingId]    = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WhiteboardSummaryDTO | null>(null);

  const visible = useMemo(
    () => (courseFilter ? boards.filter((b) => b.courseId === courseFilter) : boards),
    [boards, courseFilter],
  );

  async function handleCreate() {
    setCreating(true);
    try {
      // A board created while filtering by a course starts linked to it
      const board = await whiteboardsApi.create({ title: "Untitled Whiteboard", courseId: courseFilter || null });
      router.push(`${basePath}/${board.id}`);
    } catch (err) {
      toastError("Couldn't create whiteboard", err instanceof Error ? err.message : undefined);
      setCreating(false);
    }
  }

  async function handleRename(board: WhiteboardSummaryDTO, title: string) {
    setRenamingId(null);
    const next = title.trim();
    if (!next || next === board.title) return;

    setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, title: next } : b)));
    try {
      const { whiteboard, version } = await whiteboardsApi.update(board.id, { version: board.version, title: next });
      setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, version, updatedAt: whiteboard.updatedAt } : b)));
    } catch (err) {
      setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, title: board.title } : b)));
      toastError("Couldn't rename whiteboard", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleDuplicate(board: WhiteboardSummaryDTO) {
    try {
      const copy = await whiteboardsApi.duplicate(board.id);
      setBoards((prev) => [{ ...copy, courseTitle: null }, ...prev]);
      success("Whiteboard duplicated");
    } catch (err) {
      toastError("Couldn't duplicate whiteboard", err instanceof Error ? err.message : undefined);
    }
  }

  async function handleDelete(board: WhiteboardSummaryDTO) {
    setConfirmDelete(null);
    const index = boards.findIndex((b) => b.id === board.id);
    setBoards((prev) => prev.filter((b) => b.id !== board.id));   // optimistic
    try {
      await whiteboardsApi.remove(board.id);
    } catch (err) {
      setBoards((prev) => {
        const restored = [...prev];
        restored.splice(Math.min(index, restored.length), 0, board);
        return restored;
      });
      toastError("Couldn't delete whiteboard", err instanceof Error ? err.message : undefined);
    }
  }

  return (
    <div className="w-full space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-gray-900">My Whiteboards</h1>
          <p className="mt-1 text-sm text-gray-400">
            {boards.length} whiteboard{boards.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button leftIcon={<Plus size={16} />} onClick={handleCreate} loading={creating}>
          New Whiteboard
        </Button>
      </div>

      {/* Live sessions on other people's boards */}
      {joinable.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live now
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {joinable.map((s) => (
              <Link
                key={s.sessionId}
                href={`${basePath}/${s.whiteboardId}/classroom`}
                className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-4 py-3 transition-colors hover:border-red-200 hover:bg-red-50"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-red-500 shadow-sm">
                  <Radio size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{s.title}</p>
                  {s.courseTitle && <p className="truncate text-xs text-gray-500">{s.courseTitle}</p>}
                </div>
                <span className="flex-shrink-0 rounded-full bg-red-500 px-2.5 py-1 text-xs font-bold text-white">Join</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filter bar */}
      {boards.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setCourseFilter("")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              courseFilter === ""
                ? "bg-brand-500 text-white"
                : "border border-surface-200 bg-white text-gray-600 hover:border-brand-300 hover:text-brand-700",
            )}
          >
            All
          </button>
          {courses.length > 0 && (
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              aria-label="Filter by course"
              className={cn(
                "max-w-[260px] truncate rounded-full px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200",
                courseFilter
                  ? "bg-brand-500 text-white"
                  : "border border-surface-200 bg-white text-gray-600 hover:border-brand-300",
              )}
            >
              <option value="">By Course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Grid / empty state */}
      {visible.length > 0 ? (
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((board) => (
            <div
              key={board.id}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-surface-100 bg-white transition-all hover:border-brand-200 hover:shadow-sm"
            >
              <Link
                href={`${basePath}/${board.id}`}
                className="flex aspect-video items-center justify-center bg-gradient-to-br from-brand-50 to-surface-50"
                aria-label={`Open ${board.title}`}
              >
                <PenLine size={28} className="text-brand-300 transition-colors group-hover:text-brand-400" />
              </Link>
              {live.has(board.id) && (
                <Link
                  href={`${basePath}/${board.id}/classroom`}
                  className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-red-600"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Join
                </Link>
              )}

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {renamingId === board.id ? (
                      <input
                        autoFocus
                        defaultValue={board.title}
                        maxLength={200}
                        aria-label="Whiteboard title"
                        onBlur={(e) => handleRename(board, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")  e.currentTarget.blur();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full rounded-lg border border-brand-300 px-2 py-1 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
                      />
                    ) : (
                      <Link href={`${basePath}/${board.id}`}>
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 hover:text-brand-700">
                          {board.title}
                        </h3>
                      </Link>
                    )}
                  </div>

                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        aria-label="Whiteboard actions"
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-surface-100 hover:text-gray-700"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={4}
                        // Don't refocus the trigger on close — it would immediately blur the rename input
                        onCloseAutoFocus={(e) => e.preventDefault()}
                        className="z-50 min-w-[160px] rounded-xl border border-surface-100 bg-white p-1 shadow-card"
                      >
                        <MenuItem icon={<Pencil size={14} />} onSelect={() => setRenamingId(board.id)}>Rename</MenuItem>
                        <MenuItem icon={<Copy size={14} />} onSelect={() => handleDuplicate(board)}>Duplicate</MenuItem>
                        <MenuItem icon={<Trash2 size={14} />} onSelect={() => setConfirmDelete(board)} danger>Delete</MenuItem>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {board.courseTitle && (
                    <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                      <BookOpen size={11} className="flex-shrink-0" />
                      <span className="truncate">{board.courseTitle}</span>
                    </span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    Updated {format(new Date(board.updatedAt), "d MMM yyyy, HH:mm")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-dashed border-surface-200 p-14 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
            <Presentation size={28} className="text-brand-500" />
          </div>
          <h3 className="mb-2 font-display text-xl font-bold text-gray-900">
            {courseFilter ? "No whiteboards for this course" : "No whiteboards yet"}
          </h3>
          <p className="mx-auto mb-6 max-w-xs text-sm text-gray-400">
            Sketch ideas, work through problems and keep visual notes alongside your courses.
          </p>
          <Button leftIcon={<Plus size={16} />} onClick={handleCreate} loading={creating}>
            Create your first whiteboard
          </Button>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Delete whiteboard?"
        description={confirmDelete ? `"${confirmDelete.title}" will be removed from your whiteboards.` : ""}
        confirmLabel="Delete"
        variant="danger"
        icon={<Trash2 size={22} />}
      />
    </div>
  );
}

function MenuItem({ icon, children, onSelect, danger }: {
  icon: React.ReactNode; children: React.ReactNode; onSelect: () => void; danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition-colors",
        danger ? "text-red-600 data-[highlighted]:bg-red-50" : "text-gray-700 data-[highlighted]:bg-surface-50",
      )}
    >
      {icon} {children}
    </DropdownMenu.Item>
  );
}
