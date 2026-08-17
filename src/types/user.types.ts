export type UserRole   = "student" | "tutor" | "admin";
export type UserStatus = "active" | "pending" | "suspended";

export interface User {
  id:                     string;
  name:                   string | null;
  email:                  string;
  role:                   UserRole;
  status:                 UserStatus;
  bio:                    string | null;
  avatarUrl:              string | null;
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

export interface UpdateUserPayload {
  name?:   string;
  bio?:    string;
  status?: UserStatus;
  role?:   UserRole;
}

export interface Pagination {
  total:           number;
  page:            number;
  limit:           number;
  totalPages:      number;
  hasNextPage:     boolean;
  hasPreviousPage: boolean;
}
