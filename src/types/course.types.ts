import type { Pagination } from "./user.types";

export type CourseStatus = "draft" | "published" | "archived";
export type CourseFormat = "online" | "in_person" | "hybrid";
export type CourseLevel  = "beginner" | "intermediate" | "advanced";

export interface Course {
  id:               string;
  title:            string;
  slug:             string;
  description:      string | null;
  shortDescription: string | null;
  price:            string;
  format:           CourseFormat;
  status:           CourseStatus;
  level:            CourseLevel | null;
  language:         string | null;
  location:         string | null;
  thumbnailUrl:     string | null;
  totalDuration:    number | null;
  totalLectures:    number | null;
  enrollmentCount:  number;
  averageRating:    string | null;
  reviewCount:      number;
  categoryId:       string | null;
  createdBy:        string | null;
  createdAt:        Date;
  updatedAt:        Date;
}

export interface CourseListItem extends Pick<Course,
  "id" | "title" | "slug" | "price" | "format"
> {
  shortDescription?: string | null;
  status?:           CourseStatus;
  level?:            string | null;
  thumbnailUrl?:     string | null;
  totalDuration?:    number | null;
  totalLectures?:    number | null;
  enrollmentCount?:  number | null;
  averageRating?:    string | number | null;
  reviewCount?:      number | null;
  categoryName?:     string | null;
  createdAt?:        Date;
}

export interface CourseDetail extends Course {
  categoryName:  string | null;
  categorySlug:  string | null;
  sections:      CourseSection[];
  isEnrolled?:   boolean;
  userProgress?: number;
}

export interface CourseSection {
  id:        string;
  title:     string;
  sortOrder: number;
  lectures:  CourseLecture[];
}

export interface CourseLecture {
  id:            string;
  title:         string;
  videoUrl:      string | null;
  videoDuration: number | null;
  videoPublicId: string | null;
  thumbnailUrl:  string | null;
  isFree:        boolean;
  isPublished:   boolean;
  sortOrder:     number;
}

export interface CourseListResult {
  courses:    CourseListItem[];
  pagination: Pagination;
}

export interface CourseFilters {
  page?:       number;
  limit?:      number;
  search?:     string;
  status?:     CourseStatus;
  format?:     CourseFormat;
  level?:      CourseLevel;
  categoryId?: string;
  minPrice?:   number;
  maxPrice?:   number;
  sortBy?:     "createdAt" | "price" | "enrollmentCount" | "averageRating";
  sortOrder?:  "asc" | "desc";
}

export interface CreateCoursePayload {
  title:            string;
  description?:     string;
  shortDescription?: string;
  price:            number;
  format:           CourseFormat;
  location?:        string;
  status?:          CourseStatus;
  categoryId?:      string;
  level?:           CourseLevel;
  language?:        string;
}

export interface UpdateCoursePayload extends Partial<CreateCoursePayload> {}

export interface CreateSectionPayload {
  title:     string;
  sortOrder?: number;
}

export interface CreateLecturePayload {
  title:         string;
  videoUrl?:     string;
  videoPublicId?: string;
  videoDuration?: number;
  thumbnailUrl?:  string;
  isFree?:       boolean;
  isPublished?:  boolean;
  sortOrder?:    number;
}

export interface UpdateLecturePayload extends Partial<CreateLecturePayload> {}
