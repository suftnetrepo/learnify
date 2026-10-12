"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import {
  ArrowLeft, Users, PanelLeftClose, PanelLeftOpen, Loader2, Eye, WifiOff, Power, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import {
  ExcalidrawCanvas,
  type AppState, type ExcalidrawImperativeAPI, type OrderedExcalidrawElement,
} from "./ExcalidrawCanvas";
import { liveSessionsApi, type LiveSessionDTO } from "./whiteboard-api";
import type { ClientToServerEvents, ParticipantRole, RoomState, ServerToClientEvents } from "./realtime-types";

interface Props {
  whiteboardId: string;
  /** "/dashboard/whiteboards" or "/instructor/whiteboards" */
  basePath:     string;
}

type ClassroomSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type Phase      = "starting" | "live" | "ended" | "error";
type Connection = "connected" | "reconnecting" | "offline";

interface RosterItem { userId: string; name: string; role: ParticipantRole; canEdit: boolean; online: boolean; color?: string }
interface RemoteCursor { x: number; y: number; name: string; color: string }
interface Viewport { scrollX: number; scrollY: number; zoom: number }

const REALTIME_URL     = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
const SEND_BATCH_MS    = 50;      // coalesce element updates while dragging
const CURSOR_MS        = 50;
const OFFLINE_AFTER_MS = 30_000;  // reconnecting → red "Reload" banner
const MAX_AUTH_FAILURES = 3;

/** Z-order by Excalidraw's fractional index; unindexed elements keep their position. */
function byIndex(a: OrderedExcalidrawElement, b: OrderedExcalidrawElement) {
  if (!a.index || !b.index) return 0;
  return a.index < b.index ? -1 : a.index > b.index ? 1 : 0;
}

const ROLE_LABEL: Record<ParticipantRole, string> = { host: "Host", editor: "Tutor", viewer: "Student" };

export function LiveClassroom({ whiteboardId, basePath }: Props) {
  const { error: toastError, info } = useToast();

  const [phase,      setPhase]      = useState<Phase>("starting");
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>("reconnecting");
  const [session,    setSession]    = useState<LiveSessionDTO | null>(null);
  const [you,        setYou]        = useState<RoomState["you"] | null>(null);
  const [roster,     setRoster]     = useState<Record<string, RosterItem>>({});
  const [cursors,    setCursors]    = useState<Record<string, RemoteCursor>>({});
  const [viewport,   setViewport]   = useState<Viewport>({ scrollX: 0, scrollY: 0, zoom: 1 });
  const [initialElements, setInitialElements] = useState<OrderedExcalidrawElement[] | null>(null);
  const [panelOpen,  setPanelOpen]  = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending,     setEnding]     = useState(false);

  const socketRef       = useRef<ClassroomSocket | null>(null);
  const sessionIdRef    = useRef<string | null>(null);
  const apiRef          = useRef<ExcalidrawImperativeAPI | null>(null);
  const canEditRef      = useRef(false);
  const youIdRef        = useRef<string | null>(null);
  const lastSentRef     = useRef(new Map<string, number>());   // elementId → version the server has
  const pendingRef      = useRef(new Map<string, OrderedExcalidrawElement>());
  const sendTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bufferedRef     = useRef<OrderedExcalidrawElement[]>([]);   // patches that arrive before the canvas mounts
  const cursorRef       = useRef<{ last: number; timer: ReturnType<typeof setTimeout> | null; pending: { x: number; y: number } | null }>({ last: 0, timer: null, pending: null });
  const viewportRef     = useRef<Viewport>(viewport);
  const phaseRef        = useRef<Phase>("starting");

  const setPhaseBoth = (next: Phase) => { phaseRef.current = next; setPhase(next); };

  // ─── Scene merging ─────────────────────────────────────────────────────────

  /**
   * Applies server elements on top of the local scene. Ties go to the server: that's how a
   * client whose update was rejected converges on the authoritative copy.
   */
  const applyRemote = useCallback((incoming: readonly OrderedExcalidrawElement[]) => {
    const api = apiRef.current;
    if (!api) { bufferedRef.current.push(...incoming); return; }

    const byId = new Map(api.getSceneElementsIncludingDeleted().map((el) => [el.id, el] as const));
    let changed = false;
    for (const el of incoming) {
      const local = byId.get(el.id);
      if (!local || el.version >= local.version) {
        byId.set(el.id, el);
        changed = true;
        // Set before updateScene so the onChange it triggers doesn't echo this back
        lastSentRef.current.set(el.id, Math.max(lastSentRef.current.get(el.id) ?? 0, el.version));
        const pending = pendingRef.current.get(el.id);
        if (pending && pending.version <= el.version) pendingRef.current.delete(el.id);
      }
    }
    if (changed) api.updateScene({ elements: [...byId.values()].sort(byIndex), captureUpdate: "NEVER" });
  }, []);

  const flushPending = useCallback(() => {
    sendTimerRef.current = null;
    const socket = socketRef.current;
    if (!socket?.connected || !canEditRef.current || pendingRef.current.size === 0) return;
    const elements = [...pendingRef.current.values()];
    pendingRef.current.clear();
    for (const el of elements) lastSentRef.current.set(el.id, el.version);
    socket.emit("elements:update", { elements });
  }, []);

  /** Room state on (re)join: server map wins, except local edits newer than it (made while offline). */
  const handleRoomState = useCallback((state: RoomState) => {
    canEditRef.current = state.you.canEdit;
    youIdRef.current   = state.you.userId;
    setYou(state.you);
    setRoster((prev) => {
      const next: Record<string, RosterItem> = {};
      for (const [id, item] of Object.entries(prev)) next[id] = { ...item, online: false };
      for (const p of state.participants) next[p.userId] = { ...p, online: true };
      return next;
    });

    const server = new Map(state.elements.map((el) => [el.id, el] as const));
    lastSentRef.current = new Map(state.elements.map((el) => [el.id, el.version]));
    pendingRef.current.clear();

    const api = apiRef.current;
    if (!api) {
      setInitialElements(state.elements);
      setPhaseBoth("live");
      return;
    }

    const unsent: OrderedExcalidrawElement[] = [];
    if (state.you.canEdit) {
      for (const local of api.getSceneElementsIncludingDeleted()) {
        const remote = server.get(local.id);
        if (!remote || local.version > remote.version) { server.set(local.id, local); unsent.push(local); }
      }
    }
    api.updateScene({ elements: [...server.values()].sort(byIndex), captureUpdate: "NEVER" });
    if (unsent.length > 0) {
      for (const el of unsent) lastSentRef.current.set(el.id, el.version);
      socketRef.current?.emit("elements:update", { elements: unsent });
    }
  }, []);

  // ─── Connection lifecycle ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let authFailures = 0;
    const cursorState = cursorRef.current;

    const markReconnecting = () => {
      setConnection("reconnecting");
      if (!offlineTimerRef.current) {
        offlineTimerRef.current = setTimeout(() => setConnection("offline"), OFFLINE_AFTER_MS);
      }
    };
    const clearOfflineTimer = () => {
      if (offlineTimerRef.current) clearTimeout(offlineTimerRef.current);
      offlineTimerRef.current = null;
    };

    (async () => {
      try {
        const { sessionId } = await liveSessionsApi.start(whiteboardId);
        if (cancelled) return;
        sessionIdRef.current = sessionId;

        const detail = await liveSessionsApi.get(sessionId);
        if (cancelled) return;
        setSession(detail.session);
        setRoster(Object.fromEntries(detail.participants.map((p) => [p.userId, {
          userId: p.userId, name: p.name ?? "Participant", role: p.role, canEdit: p.canEdit, online: false,
        }])));

        const socket: ClassroomSocket = io(REALTIME_URL, {
          // Fresh token on every (re)connect — it carries no permissions the server trusts, just identity
          auth: (cb) => {
            liveSessionsApi.token(sessionId).then(({ token }) => cb({ token })).catch(() => cb({}));
          },
          reconnectionDelayMax: 5_000,
        });
        socketRef.current = socket;

        socket.on("connect", () => {
          authFailures = 0;
          clearOfflineTimer();
          setConnection("connected");
          socket.emit("join");
        });
        socket.on("connect_error", (err) => {
          if (err.message === "SESSION_ENDED" || err.message === "SESSION_NOT_FOUND") {
            socket.disconnect();
            setPhaseBoth("ended");
            return;
          }
          if (err.message === "UNAUTHORIZED" && ++authFailures >= MAX_AUTH_FAILURES) {
            socket.disconnect();
            setErrorMsg("You don't have access to this live session.");
            setPhaseBoth("error");
            return;
          }
          markReconnecting();
        });
        socket.on("disconnect", (reason) => {
          if (phaseRef.current === "ended") return;
          // Server-initiated disconnects don't auto-reconnect (room closed, or opened in another tab)
          if (reason === "io server disconnect") { clearOfflineTimer(); setConnection("offline"); return; }
          markReconnecting();
        });

        socket.on("room:state", handleRoomState);
        socket.on("elements:patch", ({ elements }) => applyRemote(elements));
        socket.on("participant:joined", (p) => {
          setRoster((prev) => ({ ...prev, [p.userId]: { ...p, online: true } }));
        });
        socket.on("participant:left", ({ userId }) => {
          setRoster((prev) => (prev[userId] ? { ...prev, [userId]: { ...prev[userId], online: false } } : prev));
          setCursors((prev) => { const next = { ...prev }; delete next[userId]; return next; });
        });
        socket.on("cursor:moved", ({ userId, ...cursor }) => {
          setCursors((prev) => ({ ...prev, [userId]: cursor }));
        });
        socket.on("permission:changed", ({ userId, canEdit }) => {
          setRoster((prev) => (prev[userId] ? { ...prev, [userId]: { ...prev[userId], canEdit } } : prev));
          if (userId === youIdRef.current && canEditRef.current !== canEdit) {
            canEditRef.current = canEdit;
            setYou((prev) => (prev ? { ...prev, canEdit } : prev));
            info(canEdit ? "You can now draw" : "Drawing access removed");
          }
        });
        socket.on("session:ended", () => {
          setPhaseBoth("ended");
          socket.disconnect();
        });
        socket.on("error", ({ code, message }) => {
          if (code === "SESSION_ENDED") { setPhaseBoth("ended"); return; }
          if (code === "NOT_A_PARTICIPANT") { setErrorMsg(message); setPhaseBoth("error"); return; }
          toastError(message);
        });
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Couldn't start the live session");
        setPhaseBoth("error");
      }
    })();

    return () => {
      cancelled = true;
      clearOfflineTimer();
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      if (cursorState.timer) clearTimeout(cursorState.timer);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [whiteboardId, handleRoomState, applyRemote, info, toastError]);

  // ─── Canvas callbacks ──────────────────────────────────────────────────────

  const handleApi = useCallback((api: ExcalidrawImperativeAPI) => {
    apiRef.current = api;
    if (bufferedRef.current.length > 0) {
      const buffered = bufferedRef.current;
      bufferedRef.current = [];
      applyRemote(buffered);
    }
  }, [applyRemote]);

  /** Sends only elements whose version moved past what the server last saw from us. */
  const handleChange = useCallback((elements: readonly OrderedExcalidrawElement[], appState: AppState) => {
    const vp = viewportRef.current;
    if (vp.scrollX !== appState.scrollX || vp.scrollY !== appState.scrollY || vp.zoom !== appState.zoom.value) {
      viewportRef.current = { scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom.value };
      setViewport(viewportRef.current);
    }
    if (!canEditRef.current) return;

    for (const el of elements) {
      const sent = lastSentRef.current.get(el.id);
      if (sent === undefined || el.version > sent) pendingRef.current.set(el.id, el);
    }
    if (pendingRef.current.size > 0 && !sendTimerRef.current) {
      sendTimerRef.current = setTimeout(flushPending, SEND_BATCH_MS);
    }
  }, [flushPending]);

  const handlePointer = useCallback((pointer: { x: number; y: number }) => {
    const c = cursorRef.current;
    const emit = (pos: { x: number; y: number }) => { c.last = Date.now(); socketRef.current?.emit("cursor:move", pos); };
    if (Date.now() - c.last >= CURSOR_MS) { emit(pointer); return; }
    c.pending = pointer;
    if (!c.timer) {
      c.timer = setTimeout(() => {
        c.timer = null;
        if (c.pending) { emit(c.pending); c.pending = null; }
      }, CURSOR_MS);
    }
  }, []);

  // ─── Host actions ──────────────────────────────────────────────────────────

  function togglePermission(userId: string, canEdit: boolean) {
    socketRef.current?.emit("permission:set", { userId, canEdit });
  }

  async function endSession() {
    setEnding(true);
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("session:end");   // server saves the final scene, then broadcasts session:ended
      return;
    }
    // Offline fallback: end it through the API; the realtime room closes on its next flush
    try {
      if (sessionIdRef.current) await liveSessionsApi.end(sessionIdRef.current);
      setPhaseBoth("ended");
    } catch (err) {
      toastError("Couldn't end the session", err instanceof Error ? err.message : undefined);
    } finally {
      setEnding(false);
      setConfirmEnd(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (phase === "starting" || (phase === "live" && !initialElements)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-brand-500" />
        <p className="text-sm text-gray-500">Joining the live session…</p>
      </div>
    );
  }

  if (phase === "ended" || phase === "error") {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-sm rounded-2xl border border-surface-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
            {phase === "ended" ? <Power size={24} className="text-brand-500" /> : <WifiOff size={24} className="text-red-500" />}
          </div>
          <h2 className="mb-1 font-display text-lg font-bold text-gray-900">
            {phase === "ended" ? "This live session has ended" : "Couldn't join the session"}
          </h2>
          <p className="mb-6 text-sm text-gray-500">
            {phase === "ended" ? "The final board has been saved." : errorMsg}
          </p>
          <Link href={basePath} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 transition-colors">
            <ArrowLeft size={14} /> Back to My Whiteboards
          </Link>
        </div>
      </div>
    );
  }

  const isHost       = you?.role === "host";
  const canEdit      = you?.canEdit ?? false;
  const onlineCount  = Object.values(roster).filter((p) => p.online).length;
  const rosterSorted = Object.values(roster).sort((a, b) =>
    Number(b.role === "host") - Number(a.role === "host") || Number(b.online) - Number(a.online) || a.name.localeCompare(b.name));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-surface-100 bg-white px-4 py-3 sm:px-6">
        <Link href={basePath} aria-label="Leave session"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-surface-100 hover:text-gray-900 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          {session?.courseTitle && (
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-brand-500">{session.courseTitle}</p>
          )}
          <h1 className="truncate font-display text-base font-bold text-gray-900">
            {session?.courseSessionTitle ?? session?.whiteboardTitle ?? "Live session"}
          </h1>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500" title={`Connection: ${connection}`}>
            <span className={cn("h-2 w-2 rounded-full",
              connection === "connected" ? "bg-emerald-500" : connection === "reconnecting" ? "bg-amber-500 animate-pulse" : "bg-red-500")} />
            <span className="hidden sm:inline">{connection === "connected" ? "Live" : connection === "reconnecting" ? "Reconnecting" : "Offline"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-gray-600">
            <Users size={13} /> {onlineCount}
          </span>
          {isHost && (
            <Button size="sm" variant="danger" leftIcon={<Power size={14} />} onClick={() => setConfirmEnd(true)}>
              End Session
            </Button>
          )}
        </div>
      </header>

      {/* Banners */}
      {connection === "reconnecting" && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 sm:px-6">
          <Loader2 size={14} className="animate-spin" /> Reconnecting…
        </div>
      )}
      {connection === "offline" && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 sm:px-6">
          <span className="flex items-center gap-2"><WifiOff size={14} /> Lost connection to the live session.</span>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      )}
      {!canEdit && connection === "connected" && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2 text-sm text-brand-700 sm:px-6">
          <Eye size={14} /> View only — your tutor controls drawing access
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Participant panel */}
        {panelOpen && (
          <aside className="hidden w-[240px] flex-shrink-0 flex-col border-r border-surface-100 bg-white md:flex">
            <div className="flex items-center justify-between border-b border-surface-100 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Participants</p>
              <button onClick={() => setPanelOpen(false)} aria-label="Hide participants"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-100 hover:text-gray-700">
                <PanelLeftClose size={15} />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto py-2">
              {rosterSorted.map((p) => (
                <li key={p.userId} className="flex items-center gap-2.5 px-4 py-2">
                  <span className={cn("h-2 w-2 flex-shrink-0 rounded-full", p.online ? "bg-emerald-500" : "bg-gray-300")}
                    title={p.online ? "Online" : "Offline"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {p.name}{p.userId === you?.userId && <span className="text-gray-400"> (you)</span>}
                    </p>
                    <span className={cn("inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      p.role === "host" ? "bg-brand-100 text-brand-700" : p.role === "editor" ? "bg-emerald-100 text-emerald-700" : "bg-surface-100 text-gray-600")}>
                      {ROLE_LABEL[p.role]}
                    </span>
                  </div>
                  {isHost && p.role !== "host" ? (
                    <button
                      role="switch"
                      aria-checked={p.canEdit}
                      aria-label={`${p.canEdit ? "Revoke" : "Grant"} drawing access for ${p.name}`}
                      onClick={() => togglePermission(p.userId, !p.canEdit)}
                      disabled={connection !== "connected"}
                      className={cn("relative h-5 w-9 flex-shrink-0 rounded-full transition-colors disabled:opacity-50",
                        p.canEdit ? "bg-brand-500" : "bg-surface-200")}
                    >
                      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", p.canEdit ? "left-[18px]" : "left-0.5")} />
                    </button>
                  ) : p.canEdit && p.role !== "host" ? (
                    <Pencil size={13} className="flex-shrink-0 text-brand-500" aria-label="Can draw" />
                  ) : null}
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* Canvas + cursor overlay */}
        <div className="relative min-w-0 flex-1">
          {!panelOpen && (
            <button onClick={() => setPanelOpen(true)} aria-label="Show participants"
              className="absolute bottom-4 left-4 z-20 hidden h-9 w-9 items-center justify-center rounded-xl border border-surface-200 bg-white text-gray-500 shadow-sm hover:text-gray-800 md:flex">
              <PanelLeftOpen size={16} />
            </button>
          )}
          <ExcalidrawCanvas
            initialData={{ elements: initialElements ?? [] }}
            onChange={handleChange}
            onApi={handleApi}
            onPointerUpdate={handlePointer}
            readOnly={!canEdit}
            isCollaborating
          />
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-hidden" aria-hidden>
            {Object.entries(cursors).map(([userId, c]) => {
              const x = (c.x + viewport.scrollX) * viewport.zoom;
              const y = (c.y + viewport.scrollY) * viewport.zoom;
              const labelWidth = c.name.length * 7 + 14;
              return (
                <g key={userId} transform={`translate(${x}, ${y})`}>
                  <path d="M0 0 L0 16 L4.5 12 L7.5 19 L10 18 L7 11 L13 11 Z" fill={c.color} stroke="white" strokeWidth={1.2} />
                  <rect x={12} y={16} rx={4} width={labelWidth} height={18} fill={c.color} />
                  <text x={19} y={29} fill="white" fontSize={11} fontWeight={600} fontFamily="system-ui, sans-serif">{c.name}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <ConfirmModal
        open={confirmEnd}
        onClose={() => !ending && setConfirmEnd(false)}
        onConfirm={endSession}
        title="End the live session?"
        description="Everyone will be disconnected. The final board is saved to this whiteboard."
        confirmLabel="End Session"
        variant="danger"
        loading={ending}
        icon={<Power size={22} />}
      />
    </div>
  );
}
