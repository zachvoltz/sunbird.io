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
