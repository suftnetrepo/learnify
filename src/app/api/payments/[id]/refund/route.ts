import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { PaymentService } from "@/services";
import { db } from "@/db";
import { users, courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { log } from "@/lib/logger";
import { successResponse, unauthorized, forbidden, serverError, conflict } from "@/lib/api-response";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "admin") return forbidden();

    const { id } = await params;
    await PaymentService.issueRefund(id, session.user.id);

    // Email admin (non-fatal)
    try {
      const { EmailService } = await import("@/services/email.service");
      const { PaymentService: PS } = await import("@/services/payment.service");
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        const purchase = await PS.findById(id);
        if (purchase) {
              const [[studentRow], [courseRow]] = await Promise.all([
            db.select({ name: users.name }).from(users).where(eq(users.id, purchase.studentId)).limit(1),
            db.select({ title: courses.title }).from(courses).where(eq(courses.id, purchase.courseId)).limit(1),
          ]);
          await EmailService.refundIssued(adminEmail, {
            studentName:  studentRow?.name ?? "Unknown",
            courseTitle:  courseRow?.title ?? "Unknown",
            amount:       `£${Number(purchase.amount).toFixed(2)}`,
            purchaseDate: new Date(purchase.createdAt).toLocaleDateString("en-GB"),
          });
        }
      }
    } catch (emailErr) {
      log.warn("Refund email failed", { emailErr });
    }

    return successResponse(null, "Refund issued successfully");
  } catch (error) {
    if (error instanceof Error && ["Already refunded","Only completed","No payment intent"].some(m => error.message.includes(m))) {
      return conflict(error.message);
    }
    log.error("POST /api/payments/[id]/refund", { error });
    return serverError("Failed to process refund. Please try via the Stripe dashboard.");
  }
}
