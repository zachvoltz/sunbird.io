// Minimal HTML→text fallback for the plain-text MIME part. Our templates are
// simple (headings, paragraphs, links), so a tag strip with light spacing
// cleanup is enough — this is not a general-purpose converter.
function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/h\d|hr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

// `emailBinding` is the Cloudflare Email Sending binding (env.EMAIL) — native to
// the Workers runtime, no API key. It's absent in local Node dev and tests, in
// which case sends are skipped (see deliver()).
export function createEmailService(emailBinding: SendEmail | null | undefined, from: string) {
  // Single send path for every templated email, backed by env.EMAIL. The binding
  // is only present in the Workers runtime; in local Node dev and tests it's
  // undefined, so we skip and log (the same result shape the old no-API-key path
  // returned). Unlike Resend, the binding THROWS on an API-level rejection
  // (unverified sender, suppressed recipient, daily-limit, etc.), so we catch and
  // convert it into a returned { error } — the many fire-and-forget callers rely
  // on deliver() never throwing. Failures are logged (visible via `wrangler tail`
  // / CF logs) and returned for callers that inspect the result.
  async function deliver(opts: {
    to: string;
    subject: string;
    html: string;
    logLabel: string;
  }): Promise<{ skipped?: boolean; id?: string; error?: string }> {
    if (!emailBinding) {
      console.log(`[email] ${opts.logLabel} — skipped, no EMAIL binding`);
      return { skipped: true };
    }
    try {
      const { messageId } = await emailBinding.send({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        // A plain-text alternative materially helps spam scoring and renders in
        // clients that don't display HTML. Derived from the HTML so every
        // template gets one for free.
        text: htmlToText(opts.html),
      });
      return { id: messageId };
    } catch (err: any) {
      const reason = err?.message ?? String(err);
      console.error(`[email] send FAILED → ${opts.to} (${opts.logLabel}) from "${from}": ${reason}`);
      return { error: reason };
    }
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

    async sendBookingConfirmation(
      to: string,
      name: string,
      lessonType: string,
      dateTime: string,
      // Optional enrichment so the email matches the on-screen success page:
      // who/where, a one-click add-to-calendar, and a link to the session.
      extra?: {
        coachName?: string | null;
        format?: string; // "Online" | "In person"
        location?: string | null; // address for in-person
        manageUrl?: string; // {origin}/my-bookings/{id}
        googleCalUrl?: string;
        isOnline?: boolean;
      },
    ) {
      const e = extra ?? {};
      const detail = [
        e.coachName ? `<p>With <strong>${e.coachName}</strong></p>` : "",
        e.format
          ? `<p>${e.format}${e.location && !e.isOnline ? ` · ${e.location}` : ""}</p>`
          : "",
      ].join("");
      const actions = [
        e.googleCalUrl ? `<p><a href="${e.googleCalUrl}">Add to Google Calendar</a></p>` : "",
        e.manageUrl
          ? `<p><a href="${e.manageUrl}">${e.isOnline ? "Join or manage your lesson" : "View or manage your lesson"}</a></p>`
          : "",
        e.isOnline && e.manageUrl
          ? `<p style="color:#666;font-size:13px">Your online lesson opens 15 minutes before the start time.</p>`
          : "",
      ].join("");
      return deliver({
        to,
        subject: `Booking confirmed — ${lessonType}`,
        logLabel: `Booking confirmation to ${to} — ${lessonType} on ${dateTime}`,
        html: `
          <h2>You're booked, ${name}!</h2>
          <p><strong>${lessonType}</strong></p>
          <p>${dateTime}</p>
          ${detail}
          ${actions}
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
          <p>If this was a mistake, you can always book again at usesunbird.com/book.</p>
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

    // A new chat message/activity arrived while the recipient was away. Sent
    // by the notification dispatcher only after the away+unread debounce.
    async sendNewMessage(to: string, name: string, senderName: string, preview: string, link: string) {
      const safePreview = preview.length > 280 ? `${preview.slice(0, 277)}…` : preview;
      return deliver({
        to,
        subject: `New message from ${senderName}`,
        logLabel: `New message to ${to} from ${senderName}`,
        html: `
          <h2>${senderName} sent you a message</h2>
          <p>Hi ${name},</p>
          <blockquote style="margin:0;padding:8px 12px;border-left:3px solid #ddd;color:#444">${safePreview}</blockquote>
          <p><a href="${link}">Open the conversation</a></p>
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
        error: r.skipped ? "EMAIL binding not configured" : r.error,
      };
    },
  };
}
