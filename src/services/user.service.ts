import { db } from "@/db";
import { users, tutorInvitations } from "@/db/schema";
import { eq, and, like, desc, count, isNull, sql } from "drizzle-orm";
import { log } from "@/lib/logger";
import type {
  UserListItem, UserListResult, UserFilters, UpdateUserPayload, User,
} from "@/types";

export class UserService {
  /**
   * Paginated list of users with optional filters.
   * Admin-only.
   */
  static async list(filters: UserFilters = {}): Promise<UserListResult> {
    const {
      page   = 1,
      limit  = 20,
      role,
      status,
      search,
    } = filters;

    const conditions = [isNull(users.deletedAt)];
    if (role)   conditions.push(eq(users.role,   role));
    if (status) conditions.push(eq(users.status, status));
    if (search) conditions.push(like(users.email, `%${search}%`));
    const where = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          id:                     users.id,
          name:                   users.name,
          email:                  users.email,
          role:                   users.role,
          status:                 users.status,
          createdAt:              users.createdAt,
          lastLoginAt:            users.lastLoginAt,
          stripeOnboardingStatus: users.stripeOnboardingStatus,
          stripePayoutsEnabled:   users.stripePayoutsEnabled,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),

      db.select({ total: count() }).from(users).where(where),
    ]);

    return {
      users: rows as UserListItem[],
      pagination: {
        total,
        page,
        limit,
        totalPages:      Math.ceil(total / limit),
        hasNextPage:     page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Fetch a single user by ID.
   */
  static async findById(id: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .limit(1);
    return (user as User) ?? null;
  }

  /**
   * Fetch a single user by email.
   */
  static async findByEmail(email: string): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return (user as User) ?? null;
  }

  /**
   * Update name, status, or role.
   */
  static async update(id: string, payload: UpdateUserPayload): Promise<User> {
    const { name, bio, status, role } = payload;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name   !== undefined) updateData.name   = name;
    if (bio    !== undefined) updateData.bio    = bio;
    if (status !== undefined) updateData.status = status;
    if (role   !== undefined) updateData.role   = role;
    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    log.info("User updated", { userId: id, changes: Object.keys(payload) });
    return updated as User;
  }

  /**
   * Soft-delete — sets deletedAt timestamp.
   */
  static async softDelete(id: string): Promise<void> {
    await db
      .update(users)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));

    log.info("User soft-deleted", { userId: id });
  }

  /**
   * All active tutors — used in dropdowns.
   */
  static async getActiveTutors(): Promise<
    { id: string; name: string | null; email: string }[]
  > {
    return db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.role,   "tutor"),
          eq(users.status, "active"),
          isNull(users.deletedAt)
        )
      )
      .orderBy(users.name);
  }

  /**
   * All tutors grouped by status — used on the admin tutors page.
   */
  static async getTutors() {
    return db
      .select({
        id:                     users.id,
        name:                   users.name,
        email:                  users.email,
        status:                 users.status,
        createdAt:              users.createdAt,
        stripeOnboardingStatus: users.stripeOnboardingStatus,
        stripePayoutsEnabled:   users.stripePayoutsEnabled,
        stripeChargesEnabled:   users.stripeChargesEnabled,
      })
      .from(users)
      .where(and(eq(users.role, "tutor"), isNull(users.deletedAt)))
      .orderBy(desc(users.createdAt));
  }

  /**
   * Record the last login timestamp.
   */
  static async recordLogin(id: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  /**
   * Register a new user — validates email uniqueness, invitation token for tutors,
   * hashes password, creates user, marks invitation accepted, sends emails.
   */
  static async registerUser(params: {
    name:            string;
    email:           string;
    password:        string;
    role:            "student" | "tutor";
    invitationToken?: string;
  }): Promise<{
    success: boolean;
    code?:   string;
    message?: string;
    user?:   { id: string; email: string; name: string | null; role: string };
    status?: "active" | "pending";
  }> {
    const { name, email, password, role, invitationToken } = params;

    // Check email already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return { success: false, code: "CONFLICT", message: "An account with this email already exists" };
    }

    // Validate tutor invitation
    let invitation: typeof tutorInvitations.$inferSelect | null = null;
    if (role === "tutor" && invitationToken) {
      const [inv] = await db
        .select()
        .from(tutorInvitations)
        .where(
          and(
            eq(tutorInvitations.token, invitationToken),
            eq(tutorInvitations.email, email),
            eq(tutorInvitations.status, "pending")
          )
        )
        .limit(1);

      if (!inv || inv.expiresAt < new Date()) {
        return { success: false, code: "INVALID_INVITATION", message: "This invitation link is invalid or has expired" };
      }
      invitation = inv;
    }

    const { hashPassword } = await import("@/lib/utils");
    const passwordHash = await hashPassword(password);
    const status: "active" | "pending" = role === "tutor" && !invitation ? "pending" : "active";

    const [user] = await db
      .insert(users)
      .values({ name, email, passwordHash, role, status })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role });

    // Mark invitation accepted
    if (invitation) {
      await db
        .update(tutorInvitations)
        .set({ status: "accepted", inviteeId: user.id, acceptedAt: new Date() })
        .where(eq(tutorInvitations.id, invitation.id));
    }

    // Send emails (non-fatal)
    try {
      const { EmailService } = await import("@/services/email.service");
      if (role === "student") {
        await EmailService.welcomeEmail(user.email, { name: user.name ?? "there" });
      } else if (role === "tutor") {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          await EmailService.newTutorApplication(adminEmail, {
            applicantName:  user.name ?? "Unknown",
            applicantEmail: user.email,
          });
        }
      }
    } catch { /* non-fatal */ }

    return { success: true, user, status };
  }

}