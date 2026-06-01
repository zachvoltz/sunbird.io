import { Hono } from "hono";
import { getDb } from "../lib/db";
import { makeStripe } from "../lib/stripe";
import { createScheduleBookingRows } from "./bookings";
import { createEmailService } from "../services/email.service";

export const paymentsRoutes = new Hono();

// POST /api/webhooks/stripe — Stripe event receiver. Verifies the signature
// against the raw body (Workers needs the async verifier), then hands the
// event to the pure handleStripeEvent so the logic stays unit-testable.
paymentsRoutes.post("/stripe", async (c) => {
  const key = (c.env as any)?.STRIPE_SECRET_KEY as string | undefined;
  const whsec = (c.env as any)?.STRIPE_WEBHOOK_SECRET as string | undefined;
  if (!key || !whsec) {
    return c.json({ error: "Stripe webhooks aren't configured." }, 501);
  }
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.json({ error: "Missing stripe-signature" }, 400);

  const body = await c.req.text();
  const stripe = makeStripe(key);
  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, whsec);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return c.json({ error: "Invalid signature" }, 400);
  }

  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    await handleStripeEvent(getDb(), event, { email: createEmailService(apiKey, from) });
  } catch (err) {
    console.error("Stripe webhook handler error:", err);
    return c.json({ error: "Handler error" }, 500);
  }
  return c.json({ received: true });
});

type EmailLike = {
  sendPaymentFailed(to: string, name: string, lessonType: string, detail: string): Promise<void>;
};

// Notify both sides of a booking about a payment problem: an inbox message in
// each direction (senderId determines who DOESN'T see it) + an email each.
async function notifyPaymentFailed(
  db: any,
  email: EmailLike | undefined,
  booking: any,
  detail: string,
): Promise<void> {
  const lessonType = booking.category?.title ?? "Lesson";
  const content = `⚠️ Payment issue — ${lessonType}`;
  const rows: { bookingId: string; senderId: string; content: string }[] = [];
  if (booking.coachId) rows.push({ bookingId: booking.id, senderId: booking.coachId, content });
  if (booking.userId) rows.push({ bookingId: booking.id, senderId: booking.userId, content });
  for (const data of rows) {
    await db.sessionMessage.create({ data }).catch(() => {});
  }
  if (email) {
    for (const person of [booking.user, booking.coach]) {
      if (person?.email) email.sendPaymentFailed(person.email, person.name, lessonType, detail).catch(() => {});
    }
  }
}

const bookingNotifyInclude = {
  category: { select: { title: true } },
  user: { select: { email: true, name: true } },
  coach: { select: { email: true, name: true } },
};

/**
 * Pure Stripe event handler — no signature work, so tests can drive it with
 * synthetic events. All DB writes are guarded/idempotent so duplicate webhook
 * deliveries are safe. `deps.email` is optional so tests can assert the inbox
 * rows without a mail service.
 */
export async function handleStripeEvent(db: any, event: any, deps: { email?: EmailLike } = {}): Promise<void> {
  switch (event.type) {
    // One-time lesson paid, or a recurring series' first invoice paid.
    case "checkout.session.completed": {
      const s = event.data.object;
      if (s.mode === "payment" && s.metadata?.bookingId) {
        await db.booking.updateMany({
          where: { id: s.metadata.bookingId, paymentStatus: { not: "PAID" } },
          data: {
            paymentStatus: "PAID",
            stripePaymentId: typeof s.payment_intent === "string" ? s.payment_intent : null,
          },
        });
      } else if (s.mode === "subscription" && s.metadata?.scheduleId) {
        // Activate the deferred recurring schedule: mark paid, link the Stripe
        // subscription, and create its bookings (idempotent — skip if already
        // created).
        const schedule = await db.recurringSchedule.findUnique({ where: { id: s.metadata.scheduleId } });
        if (schedule && schedule.paymentStatus !== "PAID") {
          await db.recurringSchedule.update({
            where: { id: schedule.id },
            data: {
              paymentStatus: "PAID",
              stripeSubscriptionId: typeof s.subscription === "string" ? s.subscription : null,
            },
          });
          const existing = await db.booking.count({ where: { scheduleId: schedule.id } });
          if (existing === 0) {
            const rows = await createScheduleBookingRows(db, schedule, { paymentStatus: "PAID" });
            // One inbox nudge to the coach, anchored on the first booking.
            if (rows[0]) {
              await db.sessionMessage
                .create({ data: { bookingId: rows[0].id, senderId: schedule.userId, content: "📅 Recurring lessons booked & paid" } })
                .catch(() => {});
            }
          }
        }
      }
      break;
    }

    // Checkout abandoned/expired before paying — free the slot + notify.
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const s = event.data.object;
      if (s.mode === "payment" && s.metadata?.bookingId) {
        const res = await db.booking.updateMany({
          where: { id: s.metadata.bookingId, paymentStatus: "PENDING" },
          data: { paymentStatus: "FAILED", status: "CANCELLED" },
        });
        if (res.count > 0) {
          const booking = await db.booking.findUnique({ where: { id: s.metadata.bookingId }, include: bookingNotifyInclude });
          if (booking) await notifyPaymentFailed(db, deps.email, booking, "the payment for this lesson didn't go through, so the slot has been released.");
        }
      }
      break;
    }

    // A recurring subscription's invoice failed — mark the schedule past-due
    // and notify both sides (anchored on the schedule's next future booking).
    case "invoice.payment_failed": {
      const inv = event.data.object;
      const subId = typeof inv.subscription === "string" ? inv.subscription : null;
      if (subId) {
        const schedule = await db.recurringSchedule.findUnique({ where: { stripeSubscriptionId: subId } });
        if (schedule && schedule.paymentStatus !== "PAST_DUE") {
          await db.recurringSchedule.update({ where: { id: schedule.id }, data: { paymentStatus: "PAST_DUE" } });
          const anchor = await db.booking.findFirst({
            where: { scheduleId: schedule.id, startsAt: { gt: new Date() } },
            orderBy: { startsAt: "asc" },
            include: bookingNotifyInclude,
          });
          if (anchor) await notifyPaymentFailed(db, deps.email, anchor, "the payment for your recurring lessons failed. Please update your card to avoid interruption.");
        }
      }
      break;
    }

    // Subscription ended (cancelled or final invoice failed) — cancel the
    // schedule and its remaining future bookings.
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const schedule = await db.recurringSchedule.findUnique({ where: { stripeSubscriptionId: sub.id } });
      if (schedule) {
        await db.recurringSchedule.update({ where: { id: schedule.id }, data: { status: "CANCELLED", paymentStatus: "CANCELLED" } });
        await db.booking.updateMany({
          where: { scheduleId: schedule.id, status: "CONFIRMED", startsAt: { gt: new Date() } },
          data: { status: "CANCELLED" },
        });
      }
      break;
    }

    default:
      // Unhandled event types are acknowledged (200) and ignored.
      break;
  }
}
