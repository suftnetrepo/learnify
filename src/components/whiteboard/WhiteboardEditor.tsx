"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, BookOpen, Check, ChevronDown, Download, Loader2, Save, AlertTriangle, Eye, Radio } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  ExcalidrawCanvas, serializeScene, exportScenePng, exportSceneSvg, downloadBlob,
  type AppState, type BinaryFiles, type ExcalidrawImperativeAPI, type OrderedExcalidrawElement, type StoredScene,
} from "./ExcalidrawCanvas";
import { whiteboardsApi, liveSessionsApi, conflictVersion, type WhiteboardDTO } from "./whiteboard-api";

interface Props {
  id:       string;
  /** "/dashboard/whiteboards" or "/instructor/whiteboards" */
  basePath: string;
  live?: {
    /** Tutor/admin allowed to launch a live session on this board */
    canStart:        boolean;
    /** Active session this user may join (null if none, or not theirs to join) */
    activeSessionId: string | null;
    /** Any active session — the solo editor goes read-only so it can't fight the room's saves */
    sessionActive:   boolean;
  };
}

type SaveStatus = "saved" | "saving" | "unsaved";

const AUTOSAVE_MS = Number(process.env.NEXT_PUBLIC_WHITEBOARD_AUTOSAVE_MS) || 1500;
const SNAPSHOT_MS = 5 * 60 * 1000;

interface LiveScene { elements: readonly OrderedExcalidrawElement[]; appState: AppState; files: BinaryFiles }

/**
 * Cheap change fingerprint. Excalidraw's onChange also fires for scrolling, selection and
 * hover, which shouldn't count as edits — element versions, file count and background do.
 */
function sceneSignature({ elements, appState, files }: LiveScene): string {
  let versions = 0;
  for (const el of elements) versions += el.version;
  return `${elements.length}:${versions}:${Object.keys(files).length}:${appState.viewBackgroundColor}`;
}

function safeFilename(title: string, ext: string) {
  return `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "whiteboard"}.${ext}`;
}

export function WhiteboardEditor({ id, basePath, live }: Props) {
  const router = useRouter();
  const { error: toastError, warning, success } = useToast();
  const [startingLive, setStartingLive] = useState(false);
  const sessionActive = live?.sessionActive ?? false;

  const [board,     setBoard]     = useState<WhiteboardDTO | null>(null);
  const [canEdit,   setCanEdit]   = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status,    setStatus]    = useState<SaveStatus>("saved");
  const [conflict,  setConflict]  = useState<number | null>(null);   // server version when a 409 is pending
  const [editingTitle, setEditingTitle] = useState(false);
  const [exporting, setExporting] = useState(false);

  const apiRef          = useRef<ExcalidrawImperativeAPI | null>(null);
  const versionRef      = useRef(1);
  const liveRef         = useRef<LiveScene | null>(null);
  const savedSigRef     = useRef<string | null>(null);   // signature of the last saved (or loaded) scene
  const snapshotSigRef  = useRef<string | null>(null);   // signature of the last snapshot
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conflictRef     = useRef(false);
  // PATCHes run one at a time: a title save and a scene save sharing a version would 409 each other
  const queueRef        = useRef<Promise<void>>(Promise.resolve());

  // ─── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    whiteboardsApi.get(id)
      .then(({ whiteboard, canEdit }) => {
        if (cancelled) return;
        versionRef.current = whiteboard.version;
        setBoard(whiteboard);
        setCanEdit(canEdit && !sessionActive);
      })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : "Couldn't load whiteboard"); });
    return () => { cancelled = true; };
  }, [id, sessionActive]);

  // ─── Save ──────────────────────────────────────────────────────────────────
  const enqueue = useCallback((task: () => Promise<void>) => {
    const run = queueRef.current.then(task, task);
    queueRef.current = run.catch(() => {});
    return run;
  }, []);

  const handleConflict = useCallback((serverVersion: number) => {
    conflictRef.current = true;
    setConflict(serverVersion);
    setStatus("unsaved");
    warning("This whiteboard changed elsewhere", "Choose whether to reload the latest version or keep your changes.");
  }, [warning]);

  const saveScene = useCallback(() => enqueue(async () => {
    const live = liveRef.current;
    if (!live || conflictRef.current) return;
    const sig = sceneSignature(live);
    if (sig === savedSigRef.current) { setStatus("saved"); return; }

    setStatus("saving");
    try {
      const sceneData = await serializeScene(live.elements, live.appState, live.files);
      const { version } = await whiteboardsApi.update(id, { version: versionRef.current, sceneData });
      versionRef.current  = version;
      savedSigRef.current = sig;
      // Edits made while the request was in flight still need saving
      setStatus(liveRef.current && sceneSignature(liveRef.current) !== sig ? "unsaved" : "saved");
    } catch (err) {
      const serverVersion = conflictVersion(err);
      if (serverVersion !== null) return handleConflict(serverVersion);
      setStatus("unsaved");
      toastError("Couldn't save whiteboard", err instanceof Error ? err.message : undefined);
    }
  }), [enqueue, handleConflict, id, toastError]);

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { void saveScene(); }, AUTOSAVE_MS);
  }, [saveScene]);

  // Stable identity — Excalidraw calls this on every pointer move
  const handleChange = useCallback((elements: readonly OrderedExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
    const live = { elements, appState, files };
    liveRef.current = live;
    const sig = sceneSignature(live);
    if (savedSigRef.current === null) {   // first onChange = the loaded scene, not an edit
      savedSigRef.current    = sig;
      snapshotSigRef.current = sig;
      return;
    }
    if (sig === savedSigRef.current || conflictRef.current) return;
    setStatus("unsaved");
    scheduleSave();
  }, [scheduleSave]);

  async function handleSaveNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await saveScene();
    await takeSnapshot("manual");
  }

  // ─── Snapshots (every 5 min, only when the scene changed since the last one) ─
  const takeSnapshot = useCallback(async (trigger: "periodic" | "manual") => {
    const live = liveRef.current;
    if (!live || conflictRef.current) return;
    const sig = sceneSignature(live);
    if (trigger === "periodic" && sig === snapshotSigRef.current) return;   // idle tabs mustn't push real history out
    try {
      await whiteboardsApi.snapshot(id, await serializeScene(live.elements, live.appState, live.files), trigger);
      snapshotSigRef.current = sig;
      if (trigger === "manual") success("Whiteboard saved");
    } catch {
      // Backups are best-effort; autosave still holds the scene
    }
  }, [id, success]);

  useEffect(() => {
    if (!canEdit) return;
    const timer = setInterval(() => { void takeSnapshot("periodic"); }, SNAPSHOT_MS);
    return () => clearInterval(timer);
  }, [canEdit, takeSnapshot]);

  // Warn before leaving with unsaved edits; clear any pending debounce on unmount
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (status !== "saved") e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [status]);
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // ─── Conflict resolution ───────────────────────────────────────────────────
  async function reloadLatest() {
    try {
      const { whiteboard } = await whiteboardsApi.get(id);
      const scene = whiteboard.sceneData;
      const api   = apiRef.current;
      if (api) {
        if (scene?.files) api.addFiles(Object.values(scene.files));
        api.updateScene({
          elements: scene?.elements ?? [],
          ...(scene?.appState?.viewBackgroundColor && { appState: { viewBackgroundColor: scene.appState.viewBackgroundColor } }),
        });
      }
      versionRef.current  = whiteboard.version;
      savedSigRef.current = null;   // re-baseline on the next onChange from the replaced scene
      conflictRef.current = false;
      setBoard(whiteboard);
      setConflict(null);
      setStatus("saved");
    } catch (err) {
      toastError("Couldn't reload whiteboard", err instanceof Error ? err.message : undefined);
    }
  }

  function keepMine() {
    if (conflict === null) return;
    versionRef.current  = conflict;   // deliberately overwrite the newer server version
    conflictRef.current = false;
    setConflict(null);
    void saveScene();
  }

  // ─── Title ─────────────────────────────────────────────────────────────────
  function saveTitle(raw: string) {
    setEditingTitle(false);
    const title = raw.trim();
    if (!board || !title || title === board.title) return;
    const previous = board.title;
    setBoard({ ...board, title });
    void enqueue(async () => {
      try {
        const { version } = await whiteboardsApi.update(id, { version: versionRef.current, title });
        versionRef.current = version;
      } catch (err) {
        setBoard((b) => (b ? { ...b, title: previous } : b));
        const serverVersion = conflictVersion(err);
        if (serverVersion !== null) return handleConflict(serverVersion);
        toastError("Couldn't rename whiteboard", err instanceof Error ? err.message : undefined);
      }
    });
  }

  // ─── Export ────────────────────────────────────────────────────────────────
  async function handleExport(format: "png" | "svg") {
    const api = apiRef.current;
    if (!api || !board) return;
    setExporting(true);
    try {
      const scene: StoredScene = await serializeScene(api.getSceneElements(), api.getAppState(), api.getFiles());
      if (format === "png") {
        downloadBlob(await exportScenePng(scene), safeFilename(board.title, "png"));
      } else {
        const svg = await exportSceneSvg(scene);
        downloadBlob(new Blob([svg], { type: "image/svg+xml" }), safeFilename(board.title, "svg"));
      }
    } catch (err) {
      toastError("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  async function startLiveSession() {
    setStartingLive(true);
    try {
      await liveSessionsApi.start(id);
      router.push(`${basePath}/${id}/classroom`);
    } catch (err) {
      toastError("Couldn't start the live session", err instanceof Error ? err.message : undefined);
      setStartingLive(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-gray-500">{loadError}</p>
        <Link href={basePath} className="text-sm font-semibold text-brand-600 hover:underline">Back to My Whiteboards</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-surface-100 bg-white px-4 py-3 sm:px-6">
        <Link
          href={basePath}
          aria-label="Back to My Whiteboards"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-surface-100 hover:text-gray-900"
        >
          <ArrowLeft size={18} />
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {!board ? (
            <div className="h-5 w-48 animate-pulse rounded bg-surface-100" />
          ) : editingTitle ? (
            <input
              autoFocus
              defaultValue={board.title}
              maxLength={200}
              aria-label="Whiteboard title"
              onBlur={(e) => saveTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  e.currentTarget.blur();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="w-full max-w-md rounded-lg border border-brand-300 px-2 py-1 font-display text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          ) : (
            <button
              onClick={() => canEdit && setEditingTitle(true)}
              disabled={!canEdit}
              title={canEdit ? "Click to rename" : undefined}
              className={cn(
                "truncate rounded-lg px-2 py-1 text-left font-display text-base font-bold text-gray-900",
                canEdit && "hover:bg-surface-50",
              )}
            >
              {board.title}
            </button>
          )}
          {board?.courseTitle && (
            <span className="hidden max-w-[200px] items-center gap-1 truncate rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 sm:inline-flex">
              <BookOpen size={11} className="flex-shrink-0" />
              <span className="truncate">{board.courseTitle}</span>
            </span>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {board && !canEdit && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-gray-600">
              <Eye size={13} /> View only
            </span>
          )}
          {board && canEdit && <SaveIndicator status={status} />}
          {live?.activeSessionId ? (
            <Link
              href={`${basePath}/${id}/classroom`}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-red-500 px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-600"
            >
              <Radio size={14} /> Rejoin Session
            </Link>
          ) : live?.canStart && !live.sessionActive ? (
            <Button size="sm" variant="secondary" leftIcon={<Radio size={14} />} onClick={startLiveSession} loading={startingLive} disabled={!board}>
              Start Live Session
            </Button>
          ) : null}
          {canEdit && (
            <Button size="sm" variant="outline" leftIcon={<Save size={14} />} onClick={handleSaveNow}
              disabled={!board || status === "saving" || conflict !== null}>
              Save
            </Button>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm" leftIcon={<Download size={14} />} rightIcon={<ChevronDown size={13} />} loading={exporting} disabled={!board}>
                Export
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={4} className="z-50 min-w-[140px] rounded-xl border border-surface-100 bg-white p-1 shadow-card">
                {(["png", "svg"] as const).map((fmt) => (
                  <DropdownMenu.Item
                    key={fmt}
                    onSelect={() => { void handleExport(fmt); }}
                    className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none data-[highlighted]:bg-surface-50"
                  >
                    {fmt.toUpperCase()} image
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      {live?.sessionActive && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-2.5 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-red-700">
            <span className="h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-red-500" />
            A live session is running on this whiteboard — editing happens in the classroom.
          </p>
          {live.activeSessionId && (
            <Link href={`${basePath}/${id}/classroom`} className="text-sm font-semibold text-red-700 hover:underline">Join session</Link>
          )}
        </div>
      )}

      {/* Conflict banner */}
      {conflict !== null && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 sm:px-6">
          <p className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle size={16} className="flex-shrink-0 text-amber-500" />
            This whiteboard was changed in another tab or device. Autosave is paused.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={reloadLatest}>Reload latest</Button>
            <Button size="sm" variant="primary" onClick={keepMine}>Keep my changes</Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="relative min-h-0 flex-1">
        {board ? (
          <ExcalidrawCanvas
            initialData={board.sceneData ? { elements: board.sceneData.elements, appState: board.sceneData.appState, files: board.sceneData.files } : null}
            onChange={canEdit ? handleChange : undefined}
            readOnly={!canEdit}
            onApi={(api) => { apiRef.current = api; }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={24} className="animate-spin text-brand-500" />
          </div>
        )}
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Loader2 size={13} className="animate-spin" /> Saving…</span>;
  }
  if (status === "unsaved") {
    return <span className="inline-flex items-center gap-1.5 text-xs text-amber-600"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600"><Check size={13} /> Saved</span>;
}
