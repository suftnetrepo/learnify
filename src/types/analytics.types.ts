export type Trend = "up" | "down" | "neutral";

export interface PlatformStats {
  totalRevenue:     number;
  monthRevenue:     number;       // completed sales, last 30 days
  prevMonthRevenue: number;       // completed sales, the 30 days before that
  revenueChange:    number | null; // % vs previous 30 days; null when there's nothing to compare
  revenueTrend:     Trend;
  totalStudents:    number;       // active, non-deleted students
  newStudents:      number;
  prevNewStudents:  number;
  studentsTrend:    Trend;
  enrolledStudents: number;       // active students with at least one enrollment
  totalEnrollments: number;
  avgRating:        string;       // published reviews only
  publishedCourses: number;
  totalReviews:     number;       // published reviews only
}

export interface AdminDashboardStats {
  totalStudents:    number;   // active, non-deleted students
  totalCourses:     number;
  publishedCourses: number;
  totalRevenue:     number;
  monthRevenue:     number;
  totalEnrollments: number;
  pendingTutors:    number;
  pendingReviewCourses: number;
}

export interface TopCourse {
  id:              string;
  title:           string;
  enrollmentCount: number | null;
  averageRating:   string | null;
  revenue:         string | null;
  status:          string;
}

export interface RecentTransaction {
  id:          string;
  amount:      string;
  status:      string;
  createdAt:   Date;
  courseTitle: string | null;
  studentName: string | null;
}

export interface PlatformHealth {
  conversionRate:       string;
  avgRevenuePerStudent: string;
  publishedCourses:     number;
  totalReviews:         number;
  avgRating:            string;
}

export interface InstructorStats {
  allTimeEarnings: number;
  monthEarnings:   number;
  weekEarnings:    number;
  totalStudents:   number;
}

export interface InstructorTopCourse {
  courseId:  string;
  title:     string;
  students:  number;
  earnings:  number;
}
