export type AssignmentStatus  = "active" | "completed" | "cancelled";
export type InvitationStatus  = "pending" | "accepted" | "revoked" | "expired";
export type TutorAccessLevel  = "viewer" | "editor" | "manager";

export interface TutorAssignment {
  id:          string;
  courseId:    string;
  tutorId:     string;
  assignedBy:  string;
  startDate:   Date;
  endDate:     Date;
  status:      AssignmentStatus;
  accessLevel: TutorAccessLevel;
  notes:       string | null;
  createdAt:   Date;
  updatedAt:   Date;
}

export interface TutorAssignmentWithDetails extends TutorAssignment {
  tutorName:    string | null;
  tutorEmail:   string | null;
  courseTitle?: string | null;
}

export interface TutorInvitation {
  id:        string;
  email:     string;
  token:     string;
  status:    InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
}

export interface AssignTutorPayload {
  tutorId:   string;
  courseId:  string;
  startDate: string;
  endDate:   string;
  notes?:    string;
}

export interface TutorListItem {
  id:                     string;
  name:                   string | null;
  email:                  string;
  status:                 string;
  createdAt:              Date;
  stripeOnboardingStatus: string | null;
  stripePayoutsEnabled:   boolean | null;
  stripeChargesEnabled:   boolean | null;
}
