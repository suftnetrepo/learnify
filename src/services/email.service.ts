import { sendEmail } from "@/lib/email";

const APP = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ─── Helpers ──────────────────────────────────────────────────────────────────
function baseTemplate(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Edquis</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { -ms-interpolation-mode:bicubic; border:0; outline:none; text-decoration:none; }
    table { border-collapse:collapse !important; }
    a { text-decoration:none; }
    @media only screen and (max-width:620px) {
      .email-shell { padding:20px 10px !important; }
      .email-card { border-radius:18px !important; }
      .email-header { padding:22px 22px 20px !important; }
      .email-body { padding:28px 22px 30px !important; }
      .email-footer { padding:20px 22px !important; }
      .email-title { font-size:25px !important; line-height:1.22 !important; }
      .email-button, .email-button a { width:100% !important; box-sizing:border-box !important; text-align:center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f3f5f9;font-family:Arial,'Helvetica Neue',sans-serif;color:#172033">
  ${preheader ? `<div style="display:none;font-size:1px;color:#f3f5f9;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f5f9">
    <tr><td align="center">
      <table role="presentation" class="email-shell" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:44px 20px">
        <tr><td align="center">
      <table role="presentation" class="email-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background:#ffffff;border-radius:24px;border:1px solid #e2e8f0;overflow:hidden;max-width:600px;width:100%;box-shadow:0 18px 50px rgba(15,23,42,0.08)">
        <tr><td height="5" bgcolor="#6366f1" style="height:5px;line-height:5px;font-size:0">&nbsp;</td></tr>
        <!-- Header -->
        <tr>
          <td class="email-header" style="background:#ffffff;padding:25px 36px 23px;border-bottom:1px solid #eef2f7">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="48" valign="middle">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="42" height="42" align="center" valign="middle" bgcolor="#f8fafc" style="width:42px;height:42px;border:1px solid #e2e8f0;border-radius:13px">
                    <img src="${escapeHtml(APP)}/logo.png" alt="" width="32" height="32" style="display:block;width:32px;height:32px;object-fit:contain" />
                  </td></tr></table>
                </td>
                <td valign="middle" style="padding-left:11px">
                  <div style="font-size:19px;line-height:24px;font-weight:800;letter-spacing:-0.02em;color:#111827">Edquis</div>
                  <div style="font-size:11px;line-height:16px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#94a3b8">Learn with purpose</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td class="email-body" style="padding:38px 36px 40px">
            <p style="margin:0 0 13px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6366f1">A message from Edquis</p>
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td class="email-footer" style="padding:22px 36px 24px;border-top:1px solid #eef2f7;background:#f8fafc">
            <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#64748b;text-align:center">
              Need help? <a href="${escapeHtml(APP)}/contact" style="color:#4f46e5;font-weight:600">Contact the Edquis team</a>
            </p>
            <p style="margin:0;font-size:11px;line-height:17px;color:#94a3b8;text-align:center">
              &copy; ${new Date().getFullYear()} Edquis&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${escapeHtml(APP)}/privacy" style="color:#64748b">Privacy</a>
              &nbsp;&nbsp;·&nbsp;&nbsp;<a href="${escapeHtml(APP)}/terms" style="color:#64748b">Terms</a>
              <br />This transactional email was sent to your registered address.
            </p>
          </td>
        </tr>
      </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(text: string, url: string): string {
  return `<table role="presentation" class="email-button" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px"><tr><td align="center" bgcolor="#4f46e5" style="border-radius:12px;box-shadow:0 7px 18px rgba(79,70,229,0.18)"><a href="${escapeHtml(url)}" style="display:inline-block;border:1px solid #4f46e5;border-radius:12px;color:#ffffff;padding:13px 24px;font-size:14px;line-height:20px;font-weight:700;text-decoration:none">${escapeHtml(text)}</a></td></tr></table>`;
}

function h1(text: string): string {
  return `<h1 class="email-title" style="margin:0 0 12px;font-family:Arial,'Helvetica Neue',sans-serif;font-size:29px;line-height:1.2;font-weight:800;letter-spacing:-0.025em;color:#111827">${text}</h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 17px;font-size:15px;line-height:1.68;color:#475569">${text}</p>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function send(to: string, subject: string, html: string) {
  await sendEmail(to, subject, html);
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
      h1("Your enrolment is confirmed") +
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
    await send(to, `Enrolment confirmed: ${data.courseTitle}`, html);
  },

  /** Sent when a student's course progress reaches 100%. */
  async courseCompleted(to: string, data: {
    studentName:  string;
    courseTitle:  string;
    certificateUrl?: string;
  }) {
    const dashUrl = `${APP}/dashboard`;
    const html = baseTemplate(
      h1("You've completed the course") +
      p(`Congratulations ${data.studentName}! You've successfully completed <strong>${data.courseTitle}</strong>.`) +
      (data.certificateUrl
        ? p("Your certificate is ready to download and share.") + btn("Download Certificate", data.certificateUrl)
        : p("Your certificate is being generated and will be available in your dashboard shortly.") + btn("Go to Dashboard", dashUrl)
      ),
      `You've completed ${data.courseTitle}`
    );
    await send(to, `Course completed: ${data.courseTitle}`, html);
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
    await send(to, `New course assignment: ${data.courseTitle}`, html);
  },

  /** Sent to admin when a new tutor applies. */
  async newTutorApplication(to: string, data: {
    applicantName:  string;
    applicantEmail: string;
  }) {
    const html = baseTemplate(
      h1("New tutor application") +
      p(`<strong>${data.applicantName}</strong> (${data.applicantEmail}) has applied to become a tutor on Edquis.`) +
      p("Review and approve or reject their application from the admin panel.") +
      btn("Review Application", `${APP}/admin/tutors`),
      `New tutor application from ${data.applicantName}`
    );
    await send(to, `New tutor application: ${data.applicantName}`, html);
  },

  /** Sent to a tutor when they're invited to the platform. */
  async tutorInvitation(to: string, data: {
    inviteUrl: string;
    expiresIn: string;
  }) {
    const html = baseTemplate(
      h1("You're invited to teach on Edquis") +
      p("You've been invited to become an instructor on Edquis — a premium learning platform.") +
      p("Click below to create your account. This link is personal to you and expires in " + data.expiresIn + ".") +
      btn("Accept Invitation", data.inviteUrl) +
      `<p style="margin-top:24px;font-size:13px;color:#9ca3af">If you didn't expect this email, you can safely ignore it.</p>`,
      "You've been invited to teach on Edquis"
    );
    await send(to, "You're invited to teach on Edquis", html);
  },

  /** Sent to a new student after they register. */
  async welcomeEmail(to: string, data: {
    name: string;
  }) {
    const html = baseTemplate(
      h1(`Welcome to Edquis, ${data.name}`) +
      p("Your account is ready. Browse hundreds of expert-led courses and start building skills that move your career forward.") +
      btn("Browse Courses", `${APP}/courses`),
      "Welcome to Edquis"
    );
    await send(to, "Welcome to Edquis", html);
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
    await send(to, `Payment failed: ${data.courseTitle}`, html);
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
      h1("Chargeback dispute created") +
      p(`A chargeback dispute of <strong>${data.amount}</strong> has been filed.`) +
      disputeTable +
      p("You must submit evidence to Stripe before the deadline to contest this dispute.") +
      btn("View in Stripe Dashboard", data.stripeUrl),
      `Chargeback dispute — ${data.amount}`
    );
    await send(to, `Chargeback dispute: ${data.amount}`, html);
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
    await send(to, `Payout transfer failed: ${data.amount}`, html);
  },

  /** Sent to a user who requested a password reset. */
  async passwordReset(to: string, data: { name: string; resetUrl: string }) {
    const html = baseTemplate(
      h1("Reset your password") +
      p(`Hi ${data.name}, we received a request to reset your Edquis password.`) +
      p("Click the button below to choose a new password. This link expires in 1 hour.") +
      btn("Reset Password", data.resetUrl) +
      `<p style="margin-top:24px;font-size:13px;color:#9ca3af">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
      "Reset your Edquis password"
    );
    await send(to, "Reset your Edquis password", html);
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
    await send(to, `Refund issued: ${data.amount}`, html);
  },

  /** Sent to admin when a manager-tutor submits a course for review. */
  async courseSubmittedForReview(to: string, data: {
    courseTitle:    string;
    instructorName: string;
    reviewUrl:      string;
  }) {
    const html = baseTemplate(
      h1("Course submitted for review") +
      p(`<strong>${data.instructorName}</strong> has submitted <strong>${data.courseTitle}</strong> for approval.`) +
      p("Review the course content, pricing, and curriculum before approving.") +
      btn("Review course →", data.reviewUrl),
      `New course pending review: ${data.courseTitle}`
    );
    await send(to, `Course pending review: ${data.courseTitle}`, html);
  },

  /** Sent to a manager-tutor when their submitted course is approved and published. */
  async courseApproved(to: string, data: {
    courseTitle: string;
    courseUrl:   string;
  }) {
    const html = baseTemplate(
      h1("Your course has been approved") +
      p(`Great news — <strong>${data.courseTitle}</strong> has been reviewed and approved by the platform admin.`) +
      p("Your course is now live and available for students to enrol.") +
      btn("View your course →", data.courseUrl),
      `Course approved: ${data.courseTitle}`
    );
    await send(to, `Course approved: ${data.courseTitle}`, html);
  },

  /** Sent to a manager-tutor when their submitted course is rejected with feedback. */
  async courseRejected(to: string, data: {
    courseTitle:   string;
    rejectionNote: string;
    editUrl:       string;
  }) {
    const html = baseTemplate(
      h1("Course needs some changes") +
      p(`Your course <strong>${data.courseTitle}</strong> has been reviewed and needs some changes before it can be published.`) +
      `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:16px;margin:16px 0">
        <p style="font-size:13px;font-weight:600;color:#9a3412;margin-bottom:6px">Feedback from admin:</p>
        <p style="font-size:13px;color:#7c2d12">${data.rejectionNote}</p>
      </div>` +
      p("Please address the feedback and resubmit for review.") +
      btn("Edit course →", data.editUrl),
      `Course needs changes: ${data.courseTitle}`
    );
    await send(to, `Course needs changes: ${data.courseTitle}`, html);
  },

  /** Sent when an admin creates a new account (student/tutor/admin) directly. */
  async adminInvitation(to: string, data: {
    inviterName:  string;
    loginUrl:     string;
    tempPassword: string;
  }) {
    const html = baseTemplate(
      h1("You've been invited to Edquis") +
      p(`${data.inviterName} has invited you to join the Edquis platform.`) +
      `<div style="background:#f8f8fc;border-radius:10px;padding:16px;margin:16px 0">
        <p style="font-size:12px;font-weight:700;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.06em">Your login details</p>
        <p style="font-size:13px;color:#374151;margin-bottom:4px">Email: <strong>${to}</strong></p>
        <p style="font-size:13px;color:#374151">Password: <strong style="font-family:monospace">${data.tempPassword}</strong></p>
      </div>` +
      p("Please log in and change your password immediately from Account Settings.") +
      btn("Log in →", data.loginUrl),
      "You've been invited to Edquis"
    );
    await send(to, "You've been invited to Edquis", html);
  },

  /** Sent after a student joins a full session's waitlist. */
  async waitlistJoined(to: string, data: {
    studentName: string;
    courseTitle: string;
    sessionTitle: string;
    position: number;
  }) {
    const html = baseTemplate(
      h1("You're on the waitlist") +
      p(`Hi ${data.studentName}, we've added you to the waitlist for <strong>${data.courseTitle}</strong>.`) +
      `<div style="background:#f8f8fc;border:1px solid #e4e4ef;border-radius:10px;padding:16px;margin:16px 0">
        <p style="font-size:14px;font-weight:600;color:#13131f;margin:0 0 6px">${data.sessionTitle}</p>
        <p style="font-size:13px;color:#6b7280;margin:0">Current position: <strong>#${data.position}</strong></p>
      </div>` +
      p("We'll email you if a seat becomes available."),
      `Waitlist confirmed for ${data.courseTitle}`
    );
    await send(to, `Waitlist confirmed: ${data.courseTitle}`, html);
  },

  /** Sent to the next waiting student when a seat becomes available. */
  async waitlistSeatAvailable(to: string, data: {
    studentName: string;
    courseTitle: string;
    sessionTitle: string;
  }) {
    const html = baseTemplate(
      h1("A seat is now available") +
      p(`Hi ${data.studentName}, a seat has opened for <strong>${data.courseTitle}</strong> — ${data.sessionTitle}.`) +
      p("Sign in to Edquis to secure it. Availability is not guaranteed until checkout is complete.") +
      btn("View course", `${APP}/courses`),
      `A seat is available for ${data.courseTitle}`
    );
    await send(to, `Seat available: ${data.courseTitle}`, html);
  },

  /** Sent to enrolled students when an administrator cancels their session. */
  async sessionCancelled(to: string, data: {
    studentName: string;
    courseTitle: string;
    sessionTitle: string;
    startDate: string;
  }) {
    const html = baseTemplate(
      h1("Your course session has been cancelled") +
      p(`Hi ${data.studentName}, the <strong>${data.sessionTitle}</strong> session for <strong>${data.courseTitle}</strong>, scheduled for ${data.startDate}, has been cancelled.`) +
      p("Please visit your dashboard for the latest course information. If payment was taken, the support team will contact you about the next steps.") +
      btn("Go to dashboard", `${APP}/dashboard`),
      `Session cancelled: ${data.courseTitle}`
    );
    await send(to, `Session cancelled: ${data.courseTitle}`, html);
  },

  /** Sent to booked students when an administrator changes when/where/how their session runs. */
  async sessionUpdated(to: string, data: {
    studentName:   string;
    courseTitle:   string;
    sessionTitle:  string;
    changes:       string[];   // e.g. ["Date and time", "Join link"]
    dateTime:      string;     // new date/time, already formatted
    venue?:        string;
    venueMapUrl?:  string;
    conferencePlatform?: string;
    conferenceUrl?:      string;
    conferencePassword?: string;
  }) {
    const e = escapeHtml;
    const row = (label: string, value: string, changed: boolean) => `
      <tr>
        <td style="padding:6px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;vertical-align:top;width:120px">${label}</td>
        <td style="padding:6px 0;font-size:14px;color:#13131f">${value}${changed ? ' <span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-size:11px;font-weight:700">Updated</span>' : ""}</td>
      </tr>`;
    const has = (c: string) => data.changes.includes(c);

    const details =
      row("When", e(data.dateTime), has("Date and time")) +
      (data.venue ? row("Venue", e(data.venue) + (data.venueMapUrl ? `<br/><a href="${e(data.venueMapUrl)}" style="color:#6366f1;font-size:13px">Get directions →</a>` : ""), has("Venue")) : "") +
      (data.conferenceUrl ? row("Join online",
        `${e(data.conferencePlatform ?? "Video call")}<br/><a href="${e(data.conferenceUrl)}" style="color:#6366f1;font-size:13px;word-break:break-all">${e(data.conferenceUrl)}</a>`,
        has("Join link") || has("Platform")) : "") +
      (data.conferencePassword ? row("Password", `<span style="font-family:monospace">${e(data.conferencePassword)}</span>`, has("Meeting password")) : "");

    const html = baseTemplate(
      h1("Your session details have changed") +
      p(`Hi ${e(data.studentName)}, the <strong>${e(data.sessionTitle)}</strong> session for <strong>${e(data.courseTitle)}</strong> has been updated.`) +
      p(`What changed: <strong>${e(data.changes.join(", "))}</strong>. Here are the latest details:`) +
      `<table style="width:100%;background:#f8f8fc;border:1px solid #e4e4ef;border-radius:10px;padding:10px 16px;margin:8px 0 20px">${details}</table>` +
      (has("Meeting password") && !data.conferencePassword ? p("This session no longer needs a meeting password.") : "") +
      p("These details are always up to date in My Courses on your dashboard.") +
      btn("View my courses", `${APP}/dashboard/my-courses`),
      `Updated: ${data.sessionTitle} — ${data.changes.join(", ")}`
    );
    await send(to, `Session updated: ${data.courseTitle}`, html);
  },

  /** Administrator-authored message sent privately to session candidates. */
  async sessionCandidateMessage(to: string, data: {
    candidateName: string;
    courseTitle: string;
    sessionTitle: string;
    subject: string;
    message: string;
  }) {
    const safeMessage = escapeHtml(data.message).replace(/\r?\n/g, "<br/>");
    const html = baseTemplate(
      h1(escapeHtml(data.subject)) +
      p(`Hi ${escapeHtml(data.candidateName)},`) +
      `<div style="font-size:15px;line-height:1.7;color:#374151;margin:8px 0 24px">${safeMessage}</div>` +
      `<div style="background:#f8f8fc;border:1px solid #e4e4ef;border-radius:10px;padding:14px 16px">
        <p style="margin:0 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280">Regarding</p>
        <p style="margin:0;font-size:14px;font-weight:600;color:#13131f">${escapeHtml(data.courseTitle)}</p>
        <p style="margin:3px 0 0;font-size:13px;color:#6b7280">${escapeHtml(data.sessionTitle)}</p>
      </div>`,
      data.subject
    );
    await send(to, data.subject, html);
  },
};
