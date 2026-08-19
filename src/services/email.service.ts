import { Resend } from "resend";
import { log } from "@/lib/logger";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM ?? "noreply@learnify.dev";
const APP    = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function baseTemplate(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Learnify</title>
</head>
<body style="margin:0;padding:0;background:#f8f8fc;font-family:'Inter',system-ui,sans-serif">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ""}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8fc;padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;border:1px solid #e4e4ef;overflow:hidden;max-width:560px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:#111126;padding:24px 32px">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <span style="font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:18px;font-weight:700;color:#fff">Learnify</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f1f1f8;background:#f8f8fc">
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
              © ${new Date().getFullYear()} Learnify · <a href="${APP}" style="color:#6366f1">Visit Learnify</a>
              &nbsp;·&nbsp; <a href="${APP}/privacy" style="color:#6366f1">Privacy</a>
              &nbsp;·&nbsp; <a href="${APP}/terms" style="color:#6366f1">Terms</a>
              <br/>This is a transactional email sent to your registered address.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-top:8px">${text}</a>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-size:24px;font-weight:700;color:#13131f">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151">${text}</p>`;
}

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_placeholder") {
    log.warn("Email not sent — RESEND_API_KEY not configured", { to, subject });
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    log.info("Email sent", { to, subject });
  } catch (err) {
    // Non-fatal — log but don't throw
    log.error("Email send failed", { to, subject, err });
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const EmailService = {

  /** Sent after a student successfully purchases a course. */
  async purchaseConfirmation(to: string, data: {
    studentName:  string;
    courseTitle:  string;
    courseSlug:   string;
    amount:       string;
    courseFormat?: string;
    // Session details for in-person / hybrid
    sessionTitle?:    string;
    sessionDate?:     string;
    sessionTime?:     string;
    venueName?:       string;
    venueAddress?:    string;
    venueCity?:       string;
    venuePostcode?:   string;
    venueMapUrl?:     string;
    // Online session details
    conferencePlatform?: string;
    conferenceUrl?:      string;
    conferencePassword?: string;
  }) {
    const courseUrl = `${APP}/learn`;

    const isInPerson = data.courseFormat === "in_person" || data.courseFormat === "hybrid";
    const isOnline   = data.courseFormat === "online"    || data.courseFormat === "hybrid";

    const sessionBlock = data.sessionTitle ? `
      <table style="width:100%;background:#f8f8fc;border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid #e4e4ef">
        <tr><td style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6366f1;padding-bottom:8px">
          Your Session
        </td></tr>
        <tr><td style="font-size:15px;font-weight:600;color:#13131f;padding-bottom:4px">${data.sessionTitle}</td></tr>
        ${data.sessionDate ? `<tr><td style="font-size:13px;color:#374151;padding-bottom:2px">📅 ${data.sessionDate}</td></tr>` : ""}
        ${data.sessionTime ? `<tr><td style="font-size:13px;color:#374151;padding-bottom:8px">🕐 ${data.sessionTime}</td></tr>` : ""}
        ${isInPerson && data.venueAddress ? `
          <tr><td style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;padding-top:8px;padding-bottom:4px">Venue</td></tr>
          ${data.venueName    ? `<tr><td style="font-size:13px;font-weight:600;color:#13131f">${data.venueName}</td></tr>` : ""}
          ${data.venueAddress ? `<tr><td style="font-size:13px;color:#374151">${data.venueAddress}</td></tr>` : ""}
          ${data.venueCity    ? `<tr><td style="font-size:13px;color:#374151">${data.venueCity}${data.venuePostcode ? `, ${data.venuePostcode}` : ""}</td></tr>` : ""}
          ${data.venueMapUrl  ? `<tr><td style="padding-top:8px"><a href="${data.venueMapUrl}" style="color:#6366f1;font-size:13px;font-weight:500">📍 Get directions →</a></td></tr>` : ""}
        ` : ""}
        ${isOnline && data.conferenceUrl ? `
          <tr><td style="font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;padding-top:8px;padding-bottom:4px">Join online</td></tr>
          <tr><td style="font-size:13px;color:#374151">${data.conferencePlatform ?? "Video call"}</td></tr>
          <tr><td style="padding-top:6px"><a href="${data.conferenceUrl}" style="color:#6366f1;font-size:13px;font-weight:500">🔗 Join link →</a></td></tr>
          ${data.conferencePassword ? `<tr><td style="font-size:12px;color:#6b7280;padding-top:4px">Password: <span style="font-family:monospace">${data.conferencePassword}</span></td></tr>` : ""}
        ` : ""}
      </table>
    ` : "";

    const html = baseTemplate(
      h1("Your enrolment is confirmed! 🎉") +
      p(`Hi ${data.studentName}, you're now enrolled in <strong>${data.courseTitle}</strong>.`) +
      p(`Amount paid: <strong>${data.amount}</strong>`) +
      sessionBlock +
      (isInPerson
        ? p("Please arrive 10 minutes before the session starts. Bring a laptop if you have one.")
        : p("You can start learning right away — your progress is saved automatically.")
      ) +
      btn("Go to my courses →", courseUrl) +
      `<p style="margin-top:24px;font-size:13px;color:#9ca3af">Remember: we offer a 30-day money-back guarantee if you're not satisfied.</p>`,
      `You're enrolled in ${data.courseTitle}`
    );
    await send(to, `✅ Enrolled in "${data.courseTitle}"`, html);
  },

  /** Sent when a student's course progress reaches 100%. */
  async courseCompleted(to: string, data: {
    studentName:  string;
    courseTitle:  string;
    certificateUrl?: string;
  }) {
    const dashUrl = `${APP}/dashboard`;
    const html = baseTemplate(
      h1("You've completed the course! 🏆") +
      p(`Congratulations ${data.studentName}! You've successfully completed <strong>${data.courseTitle}</strong>.`) +
      (data.certificateUrl
        ? p("Your certificate is ready to download and share.") + btn("Download Certificate", data.certificateUrl)
        : p("Your certificate is being generated and will be available in your dashboard shortly.") + btn("Go to Dashboard", dashUrl)
      ),
      `You've completed ${data.courseTitle}`
    );
    await send(to, `🏆 Course completed: "${data.courseTitle}"`, html);
  },

  /** Sent to a tutor when they're assigned to a course. */
  async tutorAssigned(to: string, data: {
    tutorName:   string;
    courseTitle: string;
    startDate:   string;
    endDate:     string;
  }) {
    const html = baseTemplate(
      h1("You've been assigned to a course") +
      p(`Hi ${data.tutorName}, you've been assigned to deliver <strong>${data.courseTitle}</strong>.`) +
      `<table style="width:100%;background:#f8f8fc;border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid #e4e4ef">
        <tr><td style="font-size:13px;color:#6b7280;padding:4px 0">Assignment period</td></tr>
        <tr><td style="font-size:14px;font-weight:600;color:#13131f">${data.startDate} – ${data.endDate}</td></tr>
      </table>` +
      p("Log in to your instructor dashboard to view your students and manage course content.") +
      btn("Go to Instructor Dashboard", `${APP}/instructor/courses`),
      `New course assignment: ${data.courseTitle}`
    );
    await send(to, `📚 New assignment: "${data.courseTitle}"`, html);
  },

  /** Sent to admin when a new tutor applies. */
  async newTutorApplication(to: string, data: {
    applicantName:  string;
    applicantEmail: string;
  }) {
    const html = baseTemplate(
      h1("New tutor application") +
      p(`<strong>${data.applicantName}</strong> (${data.applicantEmail}) has applied to become a tutor on Learnify.`) +
      p("Review and approve or reject their application from the admin panel.") +
      btn("Review Application", `${APP}/admin/tutors`),
      `New tutor application from ${data.applicantName}`
    );
    await send(to, `👋 New tutor application: ${data.applicantName}`, html);
  },

  /** Sent to a tutor when they're invited to the platform. */
  async tutorInvitation(to: string, data: {
    inviteUrl: string;
    expiresIn: string;
  }) {
    const html = baseTemplate(
      h1("You're invited to teach on Learnify") +
      p("You've been invited to become an instructor on Learnify — a premium learning platform.") +
      p("Click below to create your account. This link is personal to you and expires in " + data.expiresIn + ".") +
      btn("Accept Invitation", data.inviteUrl) +
      `<p style="margin-top:24px;font-size:13px;color:#9ca3af">If you didn't expect this email, you can safely ignore it.</p>`,
      "You've been invited to teach on Learnify"
    );
    await send(to, "🎓 You're invited to teach on Learnify", html);
  },

  /** Sent to a new student after they register. */
  async welcomeEmail(to: string, data: {
    name: string;
  }) {
    const html = baseTemplate(
      h1(`Welcome to Learnify, ${data.name}! 👋`) +
      p("Your account is ready. Browse hundreds of expert-led courses and start building skills that move your career forward.") +
      btn("Browse Courses", `${APP}/courses`),
      "Welcome to Learnify"
    );
    await send(to, "Welcome to Learnify 🎉", html);
  },

  /** Sent to a student when their payment fails. */
  async paymentFailed(to: string, data: { studentName: string; courseTitle: string }) {
    const html = baseTemplate(
      h1("Your payment didn\'t go through") +
      p(`Hi ${data.studentName}, unfortunately your payment for <strong>${data.courseTitle}</strong> was unsuccessful.`) +
      p("This can happen if your card was declined, expired, or your bank blocked the transaction. Please try again with a different payment method.") +
      btn("Try enrolling again", `${APP}/courses`),
      `Payment failed for ${data.courseTitle}`
    );
    await send(to, `⚠️ Payment failed — "${data.courseTitle}"`, html);
  },

  /** Sent to admin when a chargeback dispute is created. */
  async disputeAlert(to: string, data: {
    disputeId: string; amount: string; reason: string; dueBy: string; stripeUrl: string;
  }) {
    const disputeTable = [
      `<table style="width:100%;background:#fef9f0;border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid #fde68a">`,
      `<tr><td style="font-size:13px;color:#92400e;padding:4px 0">Dispute ID</td><td style="font-size:13px;font-weight:600;color:#92400e">${data.disputeId}</td></tr>`,
      `<tr><td style="font-size:13px;color:#92400e;padding:4px 0">Reason</td><td style="font-size:13px;font-weight:600;color:#92400e">${data.reason}</td></tr>`,
      `<tr><td style="font-size:13px;color:#92400e;padding:4px 0">Evidence due by</td><td style="font-size:13px;font-weight:600;color:#92400e">${data.dueBy}</td></tr>`,
      `</table>`,
    ].join("");
    const html = baseTemplate(
      h1("Chargeback dispute created ⚠️") +
      p(`A chargeback dispute of <strong>${data.amount}</strong> has been filed.`) +
      disputeTable +
      p("You must submit evidence to Stripe before the deadline to contest this dispute.") +
      btn("View in Stripe Dashboard", data.stripeUrl),
      `Chargeback dispute — ${data.amount}`
    );
    await send(to, `🚨 Chargeback dispute: ${data.amount}`, html);
  },

  /** Sent to admin when a tutor payout transfer fails. */
  async transferFailed(to: string, data: {
    transferId: string; amount: string; destination: string; stripeUrl: string;
  }) {
    const html = baseTemplate(
      h1("Tutor payout failed") +
      p(`A transfer of <strong>${data.amount}</strong> to tutor account <code>${data.destination}</code> has failed.`) +
      p("The tutor has not received their payment. Please investigate and retry from the Stripe dashboard.") +
      btn("View Transfer in Stripe", data.stripeUrl),
      `Payout transfer failed — ${data.amount}`
    );
    await send(to, `💸 Payout transfer failed — ${data.amount}`, html);
  },

  /** Sent to a user who requested a password reset. */
  async passwordReset(to: string, data: { name: string; resetUrl: string }) {
    const html = baseTemplate(
      h1("Reset your password") +
      p(`Hi ${data.name}, we received a request to reset your Learnify password.`) +
      p("Click the button below to choose a new password. This link expires in 1 hour.") +
      btn("Reset Password", data.resetUrl) +
      `<p style="margin-top:24px;font-size:13px;color:#9ca3af">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
      "Reset your Learnify password"
    );
    await send(to, "🔐 Reset your Learnify password", html);
  },

  /** Sent to admin when a payment is refunded. */
  async refundIssued(to: string, data: {
    studentName:  string;
    courseTitle:  string;
    amount:       string;
    purchaseDate: string;
  }) {
    const html = baseTemplate(
      h1("Refund issued") +
      p(`A refund of <strong>${data.amount}</strong> has been issued to <strong>${data.studentName}</strong> for <strong>${data.courseTitle}</strong>.`) +
      `<table style="width:100%;background:#f8f8fc;border-radius:10px;padding:16px;margin-bottom:16px;border:1px solid #e4e4ef">
        <tr><td style="font-size:13px;color:#6b7280;padding:4px 0">Original purchase date</td></tr>
        <tr><td style="font-size:14px;font-weight:600;color:#13131f">${data.purchaseDate}</td></tr>
      </table>` +
      btn("View in Payments", `${APP}/admin/payments`),
      `Refund: ${data.studentName} — ${data.courseTitle}`
    );
    await send(to, `💳 Refund issued — ${data.amount}`, html);
  },
};
