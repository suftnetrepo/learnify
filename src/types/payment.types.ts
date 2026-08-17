import type { Pagination } from "./user.types";

export type PurchaseStatus = "pending" | "completed" | "refunded" | "failed";

export interface Purchase {
  id:                    string;
  studentId:             string;
  courseId:              string;
  amount:                string;
  platformFee:           string;
  tutorAmount:           string;
  currency:              string;
  status:                PurchaseStatus;
  stripePaymentIntentId: string | null;
  stripeEventId:         string | null;
  refundedAt:            Date | null;
  createdAt:             Date;
  updatedAt:             Date;
}

export interface PurchaseListItem extends Purchase {
  courseTitle:  string | null;
  studentName:  string | null;
  studentEmail: string | null;
}

export interface PaymentListResult {
  purchases:  PurchaseListItem[];
  pagination: Pagination;
}

export interface PaymentFilters {
  page?:   number;
  limit?:  number;
  status?: PurchaseStatus;
  search?: string;
}

export interface PaymentStats {
  totalRevenue:  number;
  monthRevenue:  number;
  refundCount:   number;
}

export interface Enrollment {
  id:              string;
  studentId:       string;
  courseId:        string;
  progress:        number;
  completedAt:     Date | null;
  certificateUrl:  string | null;
  enrolledAt:      Date;
}

export interface EnrolledCourse {
  enrollmentId:   string;
  courseId:       string;
  title:          string;
  slug:           string;
  thumbnailUrl:   string | null;
  totalLectures:  number | null;
  totalDuration:  number | null;
  progress:       number;
  completedAt:    Date | null;
  certificateUrl: string | null;
  categoryName:   string | null;
}
