export interface PlatformStats {
  totalRevenue:     number;
  monthRevenue:     number;
  revenueChange:    number;
  totalStudents:    number;
  newStudents:      number;
  totalEnrollments: number;
  avgRating:        string;
  publishedCourses: number;
  totalReviews:     number;
}

export interface AdminDashboardStats {
  totalUsers:       number;
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
