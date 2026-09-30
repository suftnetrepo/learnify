import type { WorkExperience } from "@/db/schema";
import type { ProfilePayload } from "@/lib/validation/profile";

export type UserRole   = "student" | "tutor" | "admin";
export type UserStatus = "active" | "pending" | "suspended" | "invited";

export interface User {
  id:                     string;
  name:                   string | null;
  email:                  string;
  role:                   UserRole;
  status:                 UserStatus;
  bio:                    string | null;
  avatarUrl:              string | null;
  headline:               string | null;
  location:               string | null;
  website:                string | null;
  linkedinUrl:            string | null;
  githubUrl:              string | null;
  twitterUrl:             string | null;
  yearsExperience:        number | null;
  languages:              string[] | null;
  expertise:              string[] | null;
  experience:             WorkExperience[] | null;
  createdAt:              Date;
  updatedAt:              Date;
  lastLoginAt:            Date | null;
  stripeOnboardingStatus: string | null;
  stripePayoutsEnabled:   boolean | null;
  stripeChargesEnabled:   boolean | null;
  stripeAccountId:        string | null;
}

export interface UserListItem extends Pick<User,
  "id" | "name" | "email" | "role" | "status" | "createdAt" | "lastLoginAt" |
  "stripeOnboardingStatus" | "stripePayoutsEnabled"
> {}

export interface UserListResult {
  users:      UserListItem[];
  pagination: Pagination;
}

export interface UserFilters {
  page?:    number;
  limit?:   number;
  role?:    UserRole;
  status?:  UserStatus;
  search?:  string;
  sortBy?:  "createdAt" | "name" | "email";
}

export interface UpdateUserPayload extends ProfilePayload {
  name?:   string;
  email?:  string;
  bio?:    string;
  status?: UserStatus;
  role?:   UserRole;
}

export interface CreateUserPayload {
  name:      string;
  email:     string;
  role:      UserRole;
  status?:   UserStatus;
  password?: string;
}

export interface Pagination {
  total:           number;
  page:            number;
  limit:           number;
  totalPages:      number;
  hasNextPage:     boolean;
  hasPreviousPage: boolean;
}
