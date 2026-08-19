import { db } from "@/db";
import { lectureNotes } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export class NoteService {
  static async get(userId: string, lectureId: string) {
    const [note] = await db
      .select()
      .from(lectureNotes)
      .where(
        and(
          eq(lectureNotes.userId, userId),
          eq(lectureNotes.lectureId, lectureId)
        )
      )
      .limit(1);
    return note ?? null;
  }

  static async save(userId: string, lectureId: string, content: string) {
    const existing = await NoteService.get(userId, lectureId);
    if (existing) {
      const [updated] = await db
        .update(lectureNotes)
        .set({ content, updatedAt: new Date() })
        .where(eq(lectureNotes.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(lectureNotes)
      .values({ userId, lectureId, content })
      .returning();
    return created;
  }
}
