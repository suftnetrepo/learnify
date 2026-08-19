/**
 * api-client.ts
 *
 * All client-side API calls live here as typed functions.
 * Hooks import from here — never call fetch() directly in hooks or components.
 *
 * Every function returns the typed data on success or throws an ApiError.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status:  number,
    public code?:   string,
    public errors?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data:    T;
  code?:   string;
  errors?: Record<string, string[]>;
}

async function request<T>(
  url:     string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Handle non-JSON (e.g. 502 gateway errors)
  const contentType = res.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    throw new ApiError(`Server error (${res.status})`, res.status);
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new ApiError(json.message ?? "Something went wrong", res.status, json.code, json.errors);
  }

  return json.data;
}

function get<T>(url: string)                    { return request<T>(url); }
function post<T>(url: string, body?: unknown)   { return request<T>(url, { method: "POST",   body: body !== undefined ? JSON.stringify(body) : undefined }); }
function patch<T>(url: string, body?: unknown)  { return request<T>(url, { method: "PATCH",  body: body !== undefined ? JSON.stringify(body) : undefined }); }
function del<T = void>(url: string)             { return request<T>(url, { method: "DELETE" }); }

// ─── Users ─────────────────────────────────────────────────────────────────────
import type { UserListResult, UserFilters, UpdateUserPayload, User } from "@/types";

export const usersApi = {
  list:   (filters?: UserFilters) => {
    const p = new URLSearchParams(filters as Record<string, string>);
    return get<UserListResult>(`/api/users?${p}`);
  },
  update: (id: string, payload: UpdateUserPayload) => patch<User>(`/api/users/${id}`, payload),
  remove: (id: string)                             => del(`/api/users/${id}`),
};

// ─── Courses ───────────────────────────────────────────────────────────────────
import type {
  CourseListResult, CourseFilters, CourseDetail,
  CreateCoursePayload, UpdateCoursePayload,
  CourseSection, CourseLecture,
  CreateSectionPayload, CreateLecturePayload, UpdateLecturePayload,
} from "@/types";

export const coursesApi = {
  list:            (filters?: CourseFilters) => {
    const p = new URLSearchParams(filters as Record<string, string>);
    return get<CourseListResult>(`/api/courses?${p}`);
  },
  create:          (payload: CreateCoursePayload)              => post<CourseDetail>("/api/courses", payload),
  update:          (id: string, payload: UpdateCoursePayload)  => patch<CourseDetail>(`/api/courses/${id}`, payload),
  remove:          (id: string)                                => del(`/api/courses/${id}`),
  getSections:     (courseId: string)                          => get<CourseSection[]>(`/api/courses/${courseId}/sections`),
  createSection:   (courseId: string, p: CreateSectionPayload) => post<CourseSection>(`/api/courses/${courseId}/sections`, p),
  updateSection:   (id: string, p: Partial<CreateSectionPayload>) => patch<CourseSection>(`/api/sections/${id}`, p),
  deleteSection:   (id: string)                                => del(`/api/sections/${id}`),
  createLecture:   (sectionId: string, p: CreateLecturePayload) => post<CourseLecture>(`/api/sections/${sectionId}/lectures`, p),
  updateLecture:   (id: string, p: UpdateLecturePayload)       => patch<CourseLecture>(`/api/lectures/${id}`, p),
  deleteLecture:   (id: string)                                => del(`/api/lectures/${id}`),
};

// ─── Tutors ────────────────────────────────────────────────────────────────────
import type { TutorAssignmentWithDetails, TutorInvitation, AssignTutorPayload } from "@/types";

export const tutorsApi = {
  assign:          (payload: AssignTutorPayload)      => post<TutorAssignmentWithDetails>("/api/tutors/assign", payload),
  cancelAssignment:(id: string)                       => del(`/api/tutors/assign?id=${id}`),
  invite:          (email: string)                    => post<TutorInvitation>("/api/tutors/invite", { email }),
  revokeInvite:    (id: string)                       => del(`/api/tutors/invite/${id}`),
};

// ─── Payments ──────────────────────────────────────────────────────────────────
export const paymentsApi = {
  refund: (id: string) => post<void>(`/api/payments/${id}/refund`),
};

// ─── Stripe ────────────────────────────────────────────────────────────────────
export const stripeApi = {
  checkout:       (courseId: string, sessionId?: string) => post<{ url: string }>("/api/stripe/checkout", { courseId, sessionId }),
  connectOnboard: ()                 => post<{ url: string }>("/api/stripe/connect"),
};

// ─── Upload ────────────────────────────────────────────────────────────────────
interface UploadParams {
  signature: string; timestamp: number; apiKey: string;
  cloudName: string; folder: string; resourceType: string;
}

export const uploadApi = {
  getSignedParams: (type: string, folder: string) =>
    get<UploadParams>(`/api/upload?type=${type}&folder=${folder}`),
};

// ─── Lecture progress ──────────────────────────────────────────────────────────
export const progressApi = {
  get: (lectureId: string) =>
    get<{ completed: boolean; lastPosition: number }>(`/api/lectures/${lectureId}/progress`),
  update: (lectureId: string, payload: { completed?: boolean; position?: number }) =>
    post<{ progress: number }>(`/api/lectures/${lectureId}/progress`, payload),
};

// ─── Lecture resources ─────────────────────────────────────────────────────────
import type { LectureResource, CreateResourcePayload, LectureNote } from "@/types";

export const resourcesApi = {
  list:   (lectureId: string)                          => get<LectureResource[]>(`/api/lectures/${lectureId}/resources`),
  create: (lectureId: string, p: CreateResourcePayload) => post<LectureResource>(`/api/lectures/${lectureId}/resources`, p),
  remove: (id: string)                                  => del(`/api/resources/${id}`),
};

// ─── Lecture notes ──────────────────────────────────────────────────────────────
export const notesApi = {
  get:  (lectureId: string)                    => get<LectureNote | null>(`/api/lectures/${lectureId}/notes`),
  save: (lectureId: string, content: string)   => post<LectureNote>(`/api/lectures/${lectureId}/notes`, { content }),
};
