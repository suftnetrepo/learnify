import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { WhiteboardService } from "@/services/whiteboard.service";
import { WhiteboardSessionService } from "@/services/whiteboard-session.service";
import { WhiteboardList } from "./WhiteboardList";
import { WhiteboardEditor } from "./WhiteboardEditor";
import { LiveClassroom } from "./LiveClassroom";

/**
 * Server halves of the whiteboard routes, shared by /dashboard/whiteboards (students)
 * and /instructor/whiteboards (tutors/admins) — only the breadcrumbs and base path differ.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function WhiteboardListRoute({ basePath, homeCrumb }: {
  basePath:  string;
  homeCrumb: { label: string; href: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [boards, courses, joinable] = await Promise.all([
    WhiteboardService.list(session.user.id),
    WhiteboardService.courseOptions(session.user.id, session.user.role),
    WhiteboardSessionService.listJoinable(session.user.id, session.user.role),
  ]);
  const liveOnOwn = await WhiteboardSessionService.activeSessionIds(boards.map((b) => b.id));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Topbar breadcrumbs={[homeCrumb, { label: "My Whiteboards" }]} />
      <div className="flex-1 overflow-y-auto">
        <WhiteboardList
          basePath={basePath}
          courses={courses}
          initialBoards={boards.map((b) => ({
            ...b,
            createdAt: b.createdAt.toISOString(),
            updatedAt: b.updatedAt.toISOString(),
          }))}
          liveBoardIds={[...liveOnOwn.keys()]}
          joinable={joinable}
        />
      </div>
    </div>
  );
}

/** Checks access server-side (404 otherwise); the editor loads the scene from the API on mount. */
export async function WhiteboardEditorRoute({ id, basePath }: { id: string; basePath: string }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!UUID.test(id)) notFound();

  const board = await WhiteboardService.findById(id);
  if (!board || !WhiteboardService.canRead(board, session.user.id, session.user.role)) notFound();

  const { id: userId, role } = session.user;
  const [active, canCreate] = await Promise.all([
    WhiteboardSessionService.findActiveForWhiteboard(id),
    WhiteboardSessionService.canCreate(board, userId, role),
  ]);
  // Launching is a teaching action: tutors and admins only (students join from their list)
  const canStart = (role === "tutor" || role === "admin") && canCreate;
  const canJoin  = !!active && !!(await WhiteboardSessionService.joinRole(active, userId, role));

  return (
    <WhiteboardEditor
      id={id}
      basePath={basePath}
      live={{ canStart, activeSessionId: active && (canStart || canJoin) ? active.id : null, sessionActive: !!active }}
    />
  );
}

/** Live classroom. The board must exist; joining rights are enforced by the session API. */
export async function WhiteboardClassroomRoute({ id, basePath }: { id: string; basePath: string }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!UUID.test(id)) notFound();

  const board = await WhiteboardService.findById(id);
  if (!board) notFound();

  return <LiveClassroom whiteboardId={id} basePath={basePath} />;
}

/** Tab title — only revealed to someone who can read the board. */
export async function whiteboardTitle(id: string): Promise<string> {
  const session = await auth();
  if (!session?.user || !UUID.test(id)) return "Whiteboard";
  const board = await WhiteboardService.findById(id).catch(() => null);
  return board && WhiteboardService.canRead(board, session.user.id, session.user.role) ? board.title : "Whiteboard";
}
