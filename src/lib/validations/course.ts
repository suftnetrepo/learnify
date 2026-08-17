import { z } from "zod";

export const createCourseSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be less than 200 characters")
    .trim(),
  description: z.string().min(20, "Description must be at least 20 characters").optional(),
  shortDescription: z.string().max(500).optional(),
  price: z
    .number()
    .min(0, "Price must be 0 or greater")
    .max(99999, "Price must be less than 100,000"),
  format: z.enum(["online", "in_person", "hybrid"]),
  location: z.string().max(255).optional(),
  categoryId: z.string().uuid("Invalid category").optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  language: z.string().max(50).default("English"),
  requirements: z.array(z.string()).optional(),
  whatYouLearn: z.array(z.string()).optional(),
});

export const updateCourseSchema = createCourseSchema.partial().extend({
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export const courseQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(12),
  category: z.string().optional(),
  format: z.enum(["online", "in_person", "hybrid"]).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  search: z.string().max(200).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  sortBy: z
    .enum(["createdAt", "price", "averageRating", "enrollmentCount"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const assignTutorSchema = z.object({
  tutorId: z.string().uuid("Invalid tutor ID"),
  courseId: z.string().uuid("Invalid course ID"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
export type CourseQueryInput = z.infer<typeof courseQuerySchema>;
export type AssignTutorInput = z.infer<typeof assignTutorSchema>;
