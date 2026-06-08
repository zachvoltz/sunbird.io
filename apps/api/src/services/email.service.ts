import { Resend } from "resend";

export function createEmailService(apiKey: string, from: string) {
  const resend = apiKey ? new Resend(apiKey) : null;

  // Single send path for every templated email. Crucially, it inspects Resend's
  // returned { error } — the SDK does NOT throw on API-level rejections (e.g.
  // unverified domain, recipient not allowed on the test sender), it returns
  // them — so without this check a rejected send looks identical to a delivered
  // one. We log failures (visible via `wrangler tail` / CF logs) and return a
  // result the caller can inspect, but do NOT throw on a Resend error so the
  // many fire-and-forget callers keep their current control flow. Network-level
  // exceptions still propagate (callers already `.catch` those).
  async function deliver(opts: {
    to: string;
    subject: string;
    html: string;
    logLabel: string;
  }): Promise<{ skipped?: boolean; id?: string; error?: string }> {
    if (!resend) {
      console.log(`[email] ${opts.logLabel} — skipped, no API key`);
      return { skipped: true };
    }
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      const reason = (error as any).message ?? JSON.stringify(error);
      console.error(`[email] send FAILED → ${opts.to} (${opts.logLabel}) from "${from}": ${reason}`);
      return { error: reason };
    }
    return { id: data?.id };
  }

  return {
    async sendWelcomeEmail(to: string, name: string) {
      return deliver({
        to,
        subject: "Welcome to Sunbird!",
        logLabel: `Welcome email to ${to} (${name})`,
        html: `
          <h2>Welcome to Sunbird, ${name}!</h2>
          <p>We're excited to have you join our music lessons community.</p>
          <p>You can now browse lesson types, book sessions with our teachers, and connect with fellow students.</p>
          <p>— The Sunbird Team</p>
        `.trim(),
      });
    },

    async sendBookingConfirmation(to: string, name: string, lessonType: string, dateTime: string) {
      return deliver({
        to,
        subject: `Booking confirmed — ${lessonType}`,
        logLabel: `Booking confirmation to ${to} — ${lessonType} on ${dateTime}`,
        html: `
          <h2>You're booked, ${name}!</h2>
          <p><strong>${lessonType}</strong></p>
          <p>${dateTime}</p>
          <p>Come ready to work. Come ready to play. We'll figure out the rest together.</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendBookingCancellation(to: string, name: string, lessonType: string, dateTime: string) {
      return deliver({
        to,
        subject: `Booking cancelled — ${lessonType}`,
        logLabel: `Booking cancellation to ${to} — ${lessonType} on ${dateTime}`,
        html: `
          <h2>Booking cancelled</h2>
          <p>Hi ${name}, your ${lessonType} lesson on ${dateTime} has been cancelled.</p>
          <p>If this was a mistake, you can always book again at sunbird.io/book.</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendBookingReschedule(to: string, name: string, lessonType: string, oldDateTime: string, newDateTime: string) {
      return deliver({
        to,
        subject: `Booking rescheduled — ${lessonType}`,
        logLabel: `Booking reschedule to ${to} — ${lessonType} moved from ${oldDateTime} to ${newDateTime}`,
        html: `
          <h2>Your lesson moved</h2>
          <p>Hi ${name}, your <strong>${lessonType}</strong> lesson has been rescheduled.</p>
          <p><s>${oldDateTime}</s></p>
          <p><strong>Now: ${newDateTime}</strong></p>
          <p>See you then!</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendPracticeNotes(to: string, name: string, lessonType: string, category: string, notes: string) {
      const notesHtml = notes.split("\n").map((line) => `<p>${line || "&nbsp;"}</p>`).join("");
      return deliver({
        to,
        subject: `Your practice notes — ${lessonType}`,
        logLabel: `Practice notes to ${to} — ${lessonType} / ${category}`,
        html: `
          <h2>Practice Notes</h2>
          <p>Hi ${name}, here are your practice suggestions from your <strong>${lessonType}</strong> lesson (${category}):</p>
          <hr />
          ${notesHtml}
          <hr />
          <p>The goal isn't perfection — it's showing up. Even ten minutes a day changes things.</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendNewTakeToCoach(to: string, coachName: string, studentName: string, pieceTitle: string) {
      return deliver({
        to,
        subject: `New take from ${studentName} — ${pieceTitle}`,
        logLabel: `New take to coach ${to} — ${studentName} submitted "${pieceTitle}"`,
        html: `
          <h2>New take to review</h2>
          <p>Hi ${coachName}, ${studentName} just submitted a take on <strong>${pieceTitle}</strong>.</p>
          <p>Hop in and leave them some feedback.</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendTakeReply(to: string, studentName: string, coachName: string, pieceTitle: string) {
      return deliver({
        to,
        subject: `${coachName} replied on your take — ${pieceTitle}`,
        logLabel: `Take reply to ${to} — ${coachName} replied on "${pieceTitle}"`,
        html: `
          <h2>You've got feedback</h2>
          <p>Hi ${studentName}, ${coachName} left feedback on your <strong>${pieceTitle}</strong> take.</p>
          <p>Open Sunbird to listen and read their notes.</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendLessonReminder(to: string, name: string, lessonType: string, dateTime: string, whenLabel: string) {
      return deliver({
        to,
        subject: `Reminder: ${lessonType} ${whenLabel}`,
        logLabel: `Lesson reminder to ${to} — ${lessonType} ${whenLabel} (${dateTime})`,
        html: `
          <h2>Lesson ${whenLabel}</h2>
          <p>Hi ${name}, this is a reminder that your <strong>${lessonType}</strong> lesson is ${whenLabel}.</p>
          <p>${dateTime}</p>
          <p>See you soon!</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendPaymentFailed(to: string, name: string, lessonType: string, detail: string) {
      return deliver({
        to,
        subject: `Payment issue — ${lessonType}`,
        logLabel: `Payment failed to ${to} — ${lessonType}: ${detail}`,
        html: `
          <h2>There was a payment problem</h2>
          <p>Hi ${name}, ${detail}</p>
          <p>Lesson: <strong>${lessonType}</strong></p>
          <p>Please update your payment details or rebook to keep your lessons on track.</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendPasswordResetEmail(to: string, resetUrl: string) {
      // Keep the URL in the skip log so local dev (no API key) can still grab
      // the reset link from the console.
      return deliver({
        to,
        subject: "Reset your Sunbird password",
        logLabel: `Password reset for ${to}: ${resetUrl}`,
        html: `
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}">Reset my password</a></p>
          <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          <p>— The Sunbird Team</p>
        `.trim(),
      });
    },

    // A coach invites someone who doesn't have an account yet. The link lands on
    // signup pre-filled with the invite token; once they sign up, the invite is
    // claimed and they appear as an active student in the coach's list.
    async sendStudentInviteEmail(to: string, coachName: string, inviteUrl: string, studentName?: string) {
      const greeting = studentName ? `Hi ${studentName},` : "Hi there,";
      return deliver({
        to,
        subject: `${coachName} invited you to Sunbird`,
        logLabel: `Student invite to ${to} from ${coachName}: ${inviteUrl}`,
        html: `
          <h2>${coachName} invited you to Sunbird</h2>
          <p>${greeting}</p>
          <p>${coachName} would like to work with you on Sunbird. Create your account to see your lessons, practice plans, and progress in one place.</p>
          <p><a href="${inviteUrl}">Accept the invitation</a></p>
          <p>If you weren't expecting this, you can safely ignore this email.</p>
          <p>— The Sunbird Team</p>
        `.trim(),
      });
    },

    // A coach invites someone who already has an account — they're linked
    // immediately, so this is just a heads-up rather than a call to action.
    async sendStudentAddedEmail(to: string, coachName: string) {
      return deliver({
        to,
        subject: `${coachName} added you as a student`,
        logLabel: `Student added notice to ${to} from ${coachName}`,
        html: `
          <h2>${coachName} added you as a student</h2>
          <p>${coachName} added you to their student roster on Sunbird. Log in any time to see your lessons and practice plans.</p>
          <p>— The Sunbird Team</p>
        `.trim(),
      });
    },

    // Diagnostic send used by POST /api/health/email. Returns the result
    // (id on success, error reason on failure) so the endpoint can surface it.
    async sendTest(to: string): Promise<{ skipped: boolean; from: string; id?: string; error?: string }> {
      const r = await deliver({
        to,
        subject: "Birdie email test ✅",
        logLabel: `Test email to ${to}`,
        html: `<p>If you're reading this, Birdie email delivery is working. 🎉</p>
               <p style="color:#888;font-size:12px">Sent from <code>${from}</code> via the /api/health/email diagnostic.</p>`.trim(),
      });
      return {
        skipped: !!r.skipped,
        from,
        id: r.id,
        error: r.skipped ? "RESEND_API_KEY not set" : r.error,
      };
    },
  };
}
