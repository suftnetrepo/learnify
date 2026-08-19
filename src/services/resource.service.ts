import { db } from "@/db";
import { lectureResources } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import type { LectureResourceType } from "@/db/schema";

export class ResourceService {
  static async getForLecture(lectureId: string) {
    return db
      .select()
      .from(lectureResources)
      .where(eq(lectureResources.lectureId, lectureId))
      .orderBy(asc(lectureResources.sortOrder));
  }

  static async create(data: {
    lectureId: string;
    type:      LectureResourceType;
    label:     string;
    url:       string;
    sortOrder?: number;
  }) {
    const [resource] = await db
      .insert(lectureResources)
      .values({
        lectureId: data.lectureId,
        type:      data.type,
        label:     data.label,
        url:       data.url,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning();
    return resource;
  }

  static async delete(id: string) {
    await db.delete(lectureResources).where(eq(lectureResources.id, id));
  }

  static async reorder(ids: string[]) {
    await Promise.all(
      ids.map((id, index) =>
        db.update(lectureResources)
          .set({ sortOrder: index })
          .where(eq(lectureResources.id, id))
      )
    );
  }
}
