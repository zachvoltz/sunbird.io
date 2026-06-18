// Notification dispatch for the messaging system. A message/card triggers an
// "away" notification only after the Durable Object's debounce confirms the
// recipient is offline and the message is still unread (see conversation-room).
// This module owns channel preferences, quiet-hours math, and fan-out across
// email / Web Push / SMS.
import { createEmailService } from "./email.service";
import { sendWebPush, type VapidKeys } from "../lib/web-push";

export type NotificationEnv = {
  EMAIL?: SendEmail;
  EMAIL_FROM?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  PUBLIC_APP_URL?: string;
};

export type NotificationPrefRow = {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timezone: string;
  phone: string | null;
  phoneVerified: boolean;
};

const DEFAULT_PREF: NotificationPrefRow = {
  pushEnabled: true,
  smsEnabled: false,
  emailEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
  timezone: "America/Chicago",
  phone: null,
  phoneVerified: false,
};

/** Load a user's prefs, falling back to defaults if no row exists yet. */
export async function getNotificationPref(db: any, userId: string): Promise<NotificationPrefRow> {
  const row = await db.notificationPreference.findUnique({ where: { userId } });
  return row ?? { ...DEFAULT_PREF };
}

/** Create-on-read: returns the persisted row, creating defaults if absent. */
export async function ensureNotificationPref(db: any, userId: string): Promise<NotificationPrefRow> {
  return db.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId, ...DEFAULT_PREF },
  });
}

export function serializeNotificationPref(p: NotificationPrefRow) {
  return {
    pushEnabled: p.pushEnabled,
    smsEnabled: p.smsEnabled,
    emailEnabled: p.emailEnabled,
    quietHoursStart: p.quietHoursStart,
    quietHoursEnd: p.quietHoursEnd,
    timezone: p.timezone,
    phone: p.phone ?? null,
    phoneVerified: p.phoneVerified,
  };
}

// ─── Quiet hours ───

/** Minutes-from-midnight (0..1439) for `date` in the given IANA timezone. */
export function minutesInTimezone(timezone: string, date: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return h * 60 + m;
  } catch {
    // Bad timezone string — treat as UTC rather than throwing.
    return date.getUTCHours() * 60 + date.getUTCMinutes();
  }
}

/** True when `date` falls inside the user's daily do-not-disturb window. */
export function isWithinQuietHours(pref: NotificationPrefRow, date: Date): boolean {
  const { quietHoursStart: s, quietHoursEnd: e } = pref;
  if (s == null || e == null || s === e) return false;
  const now = minutesInTimezone(pref.timezone, date);
  // Non-wrapping window (e.g. 60→480): inside if start ≤ now < end.
  if (s < e) return now >= s && now < e;
  // Wrapping window (e.g. 1320→420, 22:00→07:00): inside if now ≥ start OR now < end.
  return now >= s || now < e;
}

/**
 * When `date` is inside quiet hours, returns the Date the window ends so the
 * caller can defer delivery to then. Returns null when not in quiet hours.
 */
export function quietHoursEndsAt(pref: NotificationPrefRow, date: Date): Date | null {
  if (!isWithinQuietHours(pref, date)) return null;
  const now = minutesInTimezone(pref.timezone, date);
  const end = pref.quietHoursEnd!;
  // Minutes remaining until the window's end, accounting for midnight wrap.
  const remaining = end > now ? end - now : 1440 - now + end;
  return new Date(date.getTime() + remaining * 60_000);
}

// ─── Dispatch ───

export type DispatchArgs = {
  recipient: { id: string; email: string; name: string };
  senderName: string;
  preview: string;
  conversationId: string;
};

function vapidFromEnv(env: NotificationEnv): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || "mailto:noreply@usesunbird.com",
  };
}

/**
 * Fan a single "new activity" notification out across the recipient's enabled
 * channels. Quiet-hours gating happens upstream (the DO defers the alarm); this
 * only consults channel on/off switches. Best-effort: every channel is
 * independently try/caught so one failure never blocks the others.
 */
export async function dispatchNotification(env: NotificationEnv, db: any, args: DispatchArgs): Promise<void> {
  const pref = await getNotificationPref(db, args.recipient.id);
  const appUrl = env.PUBLIC_APP_URL || "https://usesunbird.com";
  const link = `${appUrl}/messages/${args.conversationId}`;

  // Email
  if (pref.emailEnabled && args.recipient.email) {
    try {
      const email = createEmailService(env.EMAIL, env.EMAIL_FROM || "noreply@usesunbird.com");
      await email.sendNewMessage(args.recipient.email, args.recipient.name, args.senderName, args.preview, link);
    } catch (err) {
      console.error("[notify] email failed:", err);
    }
  }

  // Web Push
  if (pref.pushEnabled) {
    const vapid = vapidFromEnv(env);
    if (vapid) {
      try {
        const subs = await db.pushSubscription.findMany({ where: { userId: args.recipient.id } });
        const payload = JSON.stringify({
          title: args.senderName,
          body: args.preview,
          url: link,
          conversationId: args.conversationId,
        });
        await Promise.all(
          subs.map(async (s: any) => {
            const res = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, payload, vapid);
            // Prune dead subscriptions so we stop retrying them.
            if (res.expired) {
              await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
            }
          }),
        );
      } catch (err) {
        console.error("[notify] web push failed:", err);
      }
    }
  }

  // SMS — fast-follow. Cloudflare has no first-party SMS product, so this will
  // call a third party (Twilio-style) over fetch once phone verification ships.
  if (pref.smsEnabled && pref.phone && pref.phoneVerified) {
    console.log(`[notify] SMS pending (fast-follow) → ${pref.phone}: ${args.senderName}: ${args.preview}`);
  }
}
