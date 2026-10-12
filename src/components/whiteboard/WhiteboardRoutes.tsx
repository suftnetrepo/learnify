import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { WhiteboardService } from "@/services/whiteboard.service";
import { WhiteboardList } from "./WhiteboardList";
import { WhiteboardEditor } from "./WhiteboardEditor";

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

  const [boards, courses] = await Promise.all([
    WhiteboardService.list(session.user.id),
    WhiteboardService.courseOptions(session.user.id, session.user.role),
  ]);

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

  return <WhiteboardEditor id={id} basePath={basePath} />;
}

/** Tab title — only revealed to someone who can read the board. */
export async function whiteboardTitle(id: string): Promise<string> {
  const session = await auth();
  if (!session?.user || !UUID.test(id)) return "Whiteboard";
  const board = await WhiteboardService.findById(id).catch(() => null);
  return board && WhiteboardService.canRead(board, session.user.id, session.user.role) ? board.title : "Whiteboard";
}
