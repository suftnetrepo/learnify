import { db } from "@/db";
import {
  whiteboards, whiteboardSnapshots, courses, courseSections, lectures,
  enrollments, tutorAssignments,
} from "@/db/schema";
import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { requireCourseAccess } from "@/lib/access/course";

/** Thrown by update() when the client's version is behind the stored one. */
export class ConflictError extends Error {
  constructor(public currentVersion: number) {
    super("This whiteboard was changed elsewhere since you loaded it");
    this.name = "ConflictError";
  }
}

export type Whiteboard        = typeof whiteboards.$inferSelect;
export const WHITEBOARD_TRIGGERS = ["periodic", "session_end", "manual"] as const;
export type WhiteboardTrigger = (typeof WHITEBOARD_TRIGGERS)[number];

/** List rows skip sceneData — scenes can be megabytes and the grid only needs metadata. */
export interface WhiteboardSummary {
  id:          string;
  title:       string;
  mode:        Whiteboard["mode"];
  courseId:    string | null;
  courseTitle: string | null;
  lectureId:   string | null;
  version:     number;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface WhiteboardCourseOption { id: string; title: string }

export interface WhiteboardUpdate {
  title?:     string;
  courseId?:  string | null;
  lectureId?: string | null;
  sceneData?: unknown;
}

/** Snapshots kept per whiteboard; older ones are pruned on each save. */
const SNAPSHOTS_KEPT = 20;

const summaryColumns = {
  id:          whiteboards.id,
  title:       whiteboards.title,
  mode:        whiteboards.mode,
  courseId:    whiteboards.courseId,
  courseTitle: courses.title,
  lectureId:   whiteboards.lectureId,
  version:     whiteboards.version,
  createdAt:   whiteboards.createdAt,
  updatedAt:   whiteboards.updatedAt,
};

export class WhiteboardService {
  // ─── Queries ────────────────────────────────────────────────────────────────

  static async list(userId: string, filters: { courseId?: string } = {}): Promise<WhiteboardSummary[]> {
    return db
      .select(summaryColumns)
      .from(whiteboards)
      .leftJoin(courses, eq(whiteboards.courseId, courses.id))
      .where(and(
        eq(whiteboards.ownerId, userId),
        eq(whiteboards.isDeleted, false),
        filters.courseId ? eq(whiteboards.courseId, filters.courseId) : undefined,
      ))
      .orderBy(desc(whiteboards.updatedAt));
  }

  /** Null when missing or soft-deleted. */
  static async findById(id: string): Promise<(Whiteboard & { courseTitle: string | null }) | null> {
    const [row] = await db
      .select({ whiteboard: whiteboards, courseTitle: courses.title })
      .from(whiteboards)
      .leftJoin(courses, eq(whiteboards.courseId, courses.id))
      .where(and(eq(whiteboards.id, id), eq(whiteboards.isDeleted, false)))
      .limit(1);
    return row ? { ...row.whiteboard, courseTitle: row.courseTitle } : null;
  }

  // ─── Mutations ──────────────────────────────────────────────────────────────

  static async create(
    ownerId: string,
    data: { title: string; mode?: Whiteboard["mode"]; courseId?: string | null; lectureId?: string | null; sceneData?: unknown },
  ): Promise<Whiteboard> {
    const [created] = await db
      .insert(whiteboards)
      .values({
        ownerId,
        title:     data.title,
        mode:      data.mode ?? "individual",
        courseId:  data.courseId ?? null,
        lectureId: data.lectureId ?? null,
        sceneData: data.sceneData ?? null,
      })
      .returning();
    return created;
  }

  /**
   * Compare-and-swap on `version`: only applies when the stored version still equals
   * expectedVersion, then bumps it. Returns null if the board is missing/deleted.
   */
  static async update(id: string, data: WhiteboardUpdate, expectedVersion: number): Promise<Whiteboard | null> {
    const current = await WhiteboardService.findById(id);
    if (!current) return null;
    if (current.version !== expectedVersion) throw new ConflictError(current.version);

    const [updated] = await db
      .update(whiteboards)
      .set({
        ...(data.title     !== undefined && { title:     data.title }),
        ...(data.courseId  !== undefined && { courseId:  data.courseId }),
        ...(data.lectureId !== undefined && { lectureId: data.lectureId }),
        ...(data.sceneData !== undefined && { sceneData: data.sceneData }),
        version:   expectedVersion + 1,
        updatedAt: new Date(),
      })
      .where(and(
        eq(whiteboards.id, id),
        eq(whiteboards.version, expectedVersion),   // the actual guard — the read above only gives a nicer error
        eq(whiteboards.isDeleted, false),
      ))
      .returning();

    if (!updated) {
      // Lost a race between the read and the write
      const latest = await WhiteboardService.findById(id);
      if (!latest) return null;
      throw new ConflictError(latest.version);
    }
    return updated;
  }

  static async softDelete(id: string): Promise<void> {
    await db
      .update(whiteboards)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(whiteboards.id, id));
  }

  /** Copies title + scene into a new individual board owned by newOwnerId. */
  static async duplicate(id: string, newOwnerId: string): Promise<Whiteboard | null> {
    const source = await WhiteboardService.findById(id);
    if (!source) return null;
    return WhiteboardService.create(newOwnerId, {
      title:     `${source.title} (copy)`.slice(0, 200),
      sceneData: source.sceneData,
    });
  }

  /** Stores a backup and keeps only the newest SNAPSHOTS_KEPT for the board. */
  static async saveSnapshot(whiteboardId: string, sceneData: unknown, trigger: WhiteboardTrigger, version: number) {
    const [snapshot] = await db
      .insert(whiteboardSnapshots)
      .values({ whiteboardId, sceneData, trigger, whiteboardVersion: version })
      .returning({ id: whiteboardSnapshots.id, createdAt: whiteboardSnapshots.createdAt });

    const keep = await db
      .select({ id: whiteboardSnapshots.id })
      .from(whiteboardSnapshots)
      .where(eq(whiteboardSnapshots.whiteboardId, whiteboardId))
      .orderBy(desc(whiteboardSnapshots.createdAt))
      .limit(SNAPSHOTS_KEPT);

    await db
      .delete(whiteboardSnapshots)
      .where(and(
        eq(whiteboardSnapshots.whiteboardId, whiteboardId),
        notInArray(whiteboardSnapshots.id, keep.map((k) => k.id)),
      ));

    return snapshot;
  }

  // ─── Access ─────────────────────────────────────────────────────────────────

  /** Owner, or any tutor/admin. */
  static canRead(board: Pick<Whiteboard, "ownerId">, userId: string, role: string): boolean {
    return board.ownerId === userId || role === "tutor" || role === "admin";
  }

  /**
   * Owner or admin. Tutors never modify someone else's individual board; for classroom
   * boards they need editor access to the board's course.
   */
  static async canModify(board: Pick<Whiteboard, "ownerId" | "mode" | "courseId">, userId: string, role: string): Promise<boolean> {
    if (board.ownerId === userId || role === "admin") return true;
    if (role !== "tutor" || board.mode === "individual" || !board.courseId) return false;
    return requireCourseAccess(userId, board.courseId, role, "editor");
  }

  /** Courses a user may attach a board to: enrolled (students), assigned (tutors), all (admins). */
  static async courseOptions(userId: string, role: string): Promise<WhiteboardCourseOption[]> {
    if (role === "admin") {
      return db.select({ id: courses.id, title: courses.title }).from(courses).orderBy(asc(courses.title));
    }
    if (role === "tutor") {
      return db
        .selectDistinct({ id: courses.id, title: courses.title })
        .from(tutorAssignments)
        .innerJoin(courses, eq(tutorAssignments.courseId, courses.id))
        .where(and(eq(tutorAssignments.tutorId, userId), eq(tutorAssignments.status, "active")))
        .orderBy(asc(courses.title));
    }
    return db
      .select({ id: courses.id, title: courses.title })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .where(eq(enrollments.studentId, userId))
      .orderBy(asc(courses.title));
  }

  /**
   * Validates a requested course/lecture association for this user. Returns an error
   * message, or null when it's allowed. A lecture requires its course.
   */
  static async checkAssociation(
    userId: string, role: string, courseId: string | null | undefined, lectureId: string | null | undefined,
  ): Promise<string | null> {
    if (lectureId && !courseId) return "A lecture can only be linked together with its course";
    if (!courseId) return null;

    const options = await WhiteboardService.courseOptions(userId, role);
    if (!options.some((c) => c.id === courseId)) return "You can't link a whiteboard to that course";

    if (lectureId) {
      const [lecture] = await db
        .select({ id: lectures.id })
        .from(lectures)
        .innerJoin(courseSections, eq(lectures.sectionId, courseSections.id))
        .where(and(eq(lectures.id, lectureId), eq(courseSections.courseId, courseId)))
        .limit(1);
      if (!lecture) return "That lecture isn't part of the selected course";
    }
    return null;
  }
}
