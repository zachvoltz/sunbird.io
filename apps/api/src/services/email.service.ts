import { Resend } from "resend";

export function createEmailService(apiKey: string, from: string) {
  const resend = apiKey ? new Resend(apiKey) : null;

  return {
    async sendWelcomeEmail(to: string, name: string) {
      if (!resend) {
        console.log(`[email] Welcome email to ${to} (${name}) — skipped, no API key`);
        return;
      }
      await resend.emails.send({
        from,
        to,
        subject: "Welcome to Sunbird!",
        html: `
          <h2>Welcome to Sunbird, ${name}!</h2>
          <p>We're excited to have you join our music lessons community.</p>
          <p>You can now browse lesson types, book sessions with our teachers, and connect with fellow students.</p>
          <p>— The Sunbird Team</p>
        `.trim(),
      });
    },

    async sendBookingConfirmation(to: string, name: string, lessonType: string, dateTime: string) {
      if (!resend) {
        console.log(`[email] Booking confirmation to ${to} — ${lessonType} on ${dateTime}`);
        return;
      }
      await resend.emails.send({
        from,
        to,
        subject: `Booking confirmed — ${lessonType}`,
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
      if (!resend) {
        console.log(`[email] Booking cancellation to ${to} — ${lessonType} on ${dateTime}`);
        return;
      }
      await resend.emails.send({
        from,
        to,
        subject: `Booking cancelled — ${lessonType}`,
        html: `
          <h2>Booking cancelled</h2>
          <p>Hi ${name}, your ${lessonType} lesson on ${dateTime} has been cancelled.</p>
          <p>If this was a mistake, you can always book again at sunbird.io/book.</p>
          <p>— Sunbird</p>
        `.trim(),
      });
    },

    async sendBookingReschedule(to: string, name: string, lessonType: string, oldDateTime: string, newDateTime: string) {
      if (!resend) {
        console.log(`[email] Booking reschedule to ${to} — ${lessonType} moved from ${oldDateTime} to ${newDateTime}`);
        return;
      }
      await resend.emails.send({
        from,
        to,
        subject: `Booking rescheduled — ${lessonType}`,
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
      if (!resend) {
        console.log(`[email] Practice notes to ${to} — ${lessonType} / ${category}`);
        console.log(notes);
        return;
      }
      const notesHtml = notes.split("\n").map((line) => `<p>${line || "&nbsp;"}</p>`).join("");
      await resend.emails.send({
        from,
        to,
        subject: `Your practice notes — ${lessonType}`,
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

    async sendPasswordResetEmail(to: string, resetUrl: string) {
      if (!resend) {
        console.log(`[email] Password reset for ${to}: ${resetUrl}`);
        return;
      }
      await resend.emails.send({
        from,
        to,
        subject: "Reset your Sunbird password",
        html: `
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the link below to set a new password:</p>
          <p><a href="${resetUrl}">Reset my password</a></p>
          <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          <p>— The Sunbird Team</p>
        `.trim(),
      });
    },
  };
}
