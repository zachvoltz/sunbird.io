// Notification preferences — three channel switches (push / SMS / email),
// quiet-hours window, timezone, and phone. Reused by the coach Account page
// and the student notification-settings route. All writes hit /api/me/* so
// they're per-user regardless of role.

import { useEffect, useState } from "react";
import type { NotificationPreferencePublic } from "@sunbird/shared";
import { Squiggle } from "./Squiggle";
import { notificationsApi } from "@/lib/api";
import {
  pushSupported,
  registerServiceWorker,
  urlBase64ToUint8Array,
} from "@/lib/push";

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--hand)",
  fontSize: 14,
  padding: "6px 10px",
  border: "1.5px solid var(--ink-faint)",
  borderRadius: 6,
  background: "var(--paper)",
  color: "var(--ink)",
  outline: "none",
};

// minutes-from-midnight ⇄ "HH:MM" for the <input type="time"> pickers.
function minutesToHHMM(mins: number | null): string {
  if (mins == null) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function hhmmToMinutes(value: string): number | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function Switch({
  on,
  onClick,
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={"nf-switch" + (on ? " on" : "") + (disabled ? " disabled" : "")}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      role="switch"
      aria-checked={on}
    />
  );
}

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferencePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  // null = not checked yet, "" = configured-but-empty (push unavailable).
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      notificationsApi.getPreferences(),
      notificationsApi.vapidPublicKey().catch(() => ""),
    ])
      .then(([p, key]) => {
        if (cancelled) return;
        setPrefs(p);
        setVapidKey(key);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Persist a patch and fold the canonical result back into state.
  const patch = async (
    body: Parameters<typeof notificationsApi.updatePreferences>[0],
  ) => {
    setSaving(true);
    try {
      const updated = await notificationsApi.updatePreferences(body);
      setPrefs(updated);
      return updated;
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't save notification settings");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Push subscribe/unsubscribe flow. Persists the prefs flag only after the
  // browser-side subscription succeeds so the toggle reflects reality.
  const togglePush = async () => {
    if (!prefs) return;
    if (prefs.pushEnabled) {
      // Turn OFF: unsubscribe locally, drop the server subscription, clear flag.
      try {
        if (pushSupported()) {
          const reg = await navigator.serviceWorker.getRegistration("/");
          const sub = await reg?.pushManager.getSubscription();
          if (sub) {
            await notificationsApi.removePushSubscription(sub.endpoint).catch(() => {});
            await sub.unsubscribe().catch(() => {});
          }
        }
      } finally {
        await patch({ pushEnabled: false }).catch(() => {});
      }
      return;
    }

    // Turn ON.
    if (!pushSupported() || !vapidKey) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        window.alert("Notifications are blocked in your browser settings.");
        return;
      }
      const reg = await registerServiceWorker();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await notificationsApi.addPushSubscription(sub.toJSON());
      await patch({ pushEnabled: true });
    } catch (err: any) {
      window.alert(err?.message ?? "Couldn't enable push notifications");
    }
  };

  if (loading) {
    return <div className="small muted" style={{ padding: 8 }}>loading notification settings…</div>;
  }
  if (error || !prefs) {
    return <div className="small muted" style={{ padding: 8 }}>Couldn't load notification settings.</div>;
  }

  const pushUnavailable = !pushSupported() || vapidKey === "";

  return (
    <div className="box">
      <div className="small muted">NOTIFICATIONS</div>
      <Squiggle w={60} color="var(--ink-faint)" />

      <div className="col gap-3 mt-2">
        {/* Push */}
        <div className="row between">
          <div>
            <div className="small bold">Push notifications</div>
            <div className="tiny muted">
              {pushUnavailable
                ? "Not configured on this device / server."
                : "Get notified in your browser when a new message arrives."}
            </div>
          </div>
          <Switch on={prefs.pushEnabled} onClick={togglePush} disabled={pushUnavailable} />
        </div>

        {/* SMS — toggle persists but delivery isn't wired yet. */}
        <div className="row between">
          <div>
            <div className="small bold">
              SMS <span className="muted">· coming soon</span>
            </div>
            <div className="tiny muted">
              Text alerts aren't delivering yet — your preference is saved for when they are.
            </div>
          </div>
          <Switch
            on={prefs.smsEnabled}
            onClick={() => patch({ smsEnabled: !prefs.smsEnabled }).catch(() => {})}
          />
        </div>

        {/* Email */}
        <div className="row between">
          <div>
            <div className="small bold">Email</div>
            <div className="tiny muted">Summaries and message notifications by email.</div>
          </div>
          <Switch
            on={prefs.emailEnabled}
            onClick={() => patch({ emailEnabled: !prefs.emailEnabled }).catch(() => {})}
          />
        </div>

        <div className="hr-hand" />

        {/* Quiet hours — clearing both ends disables them. */}
        <div>
          <div className="small bold">Quiet hours</div>
          <div className="tiny muted">
            No notifications during this window. Clear both to disable.
          </div>
          <div className="row gap-2 mt-2" style={{ alignItems: "center" }}>
            <input
              type="time"
              value={minutesToHHMM(prefs.quietHoursStart)}
              onChange={(e) => {
                const start = hhmmToMinutes(e.target.value);
                // Clearing the start with no end set turns quiet hours off.
                patch({
                  quietHoursStart: start,
                  quietHoursEnd: start == null ? null : prefs.quietHoursEnd,
                }).catch(() => {});
              }}
              style={inputStyle}
            />
            <span className="muted small">to</span>
            <input
              type="time"
              value={minutesToHHMM(prefs.quietHoursEnd)}
              onChange={(e) => {
                const end = hhmmToMinutes(e.target.value);
                patch({
                  quietHoursEnd: end,
                  quietHoursStart: end == null ? null : prefs.quietHoursStart,
                }).catch(() => {});
              }}
              style={inputStyle}
            />
            {(prefs.quietHoursStart != null || prefs.quietHoursEnd != null) && (
              <button
                className="btn small ghost"
                onClick={() =>
                  patch({ quietHoursStart: null, quietHoursEnd: null }).catch(() => {})
                }
              >
                clear
              </button>
            )}
          </div>
        </div>

        {/* Timezone */}
        <div className="row between" style={{ alignItems: "center" }}>
          <div>
            <div className="small bold">Timezone</div>
            <div className="tiny muted">Used to apply your quiet hours.</div>
          </div>
          <input
            value={prefs.timezone}
            onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
            onBlur={(e) => patch({ timezone: e.target.value }).catch(() => {})}
            placeholder="America/Chicago"
            style={{ ...inputStyle, maxWidth: 200 }}
          />
        </div>

        {/* Phone */}
        <div className="row between" style={{ alignItems: "center" }}>
          <div>
            <div className="small bold">Phone</div>
            <div className="tiny muted">
              For SMS once it's live.
              {prefs.phone && (prefs.phoneVerified ? " · verified" : " · unverified")}
            </div>
          </div>
          <input
            value={prefs.phone ?? ""}
            onChange={(e) => setPrefs({ ...prefs, phone: e.target.value || null })}
            onBlur={(e) => patch({ phone: e.target.value || null }).catch(() => {})}
            placeholder="+1 555 123 4567"
            style={{ ...inputStyle, maxWidth: 200 }}
          />
        </div>

        {saving && <div className="tiny muted">saving…</div>}
      </div>
    </div>
  );
}
