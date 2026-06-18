import type {
  ConversationMessagePublic,
  ConversationSummary,
  MessageAttachment,
  NotificationPreferencePublic,
  UserPublic,
} from "@sunbird/shared";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error: string; details?: Record<string, string[]> },
  ) {
    super(body.error);
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, json);
  }

  return json as T;
}

// ─── Conversations / messaging ───
//
// Cookie-auth JSON endpoints, all shaped `{ data }` or `{ error }`. The
// thread UI in wireframe/pages/Messages.tsx and the useConversationSocket
// hook drive these.

export type ConversationDetail = {
  id: string;
  counterpart: UserPublic;
  lastActivityAt: string;
};

export const conversationsApi = {
  list() {
    return apiFetch<{ data: { items: ConversationSummary[] } }>(
      "/api/conversations",
    ).then((r) => r.data.items);
  },

  // Open (or create) the thread with another user — used by the "Message"
  // buttons on roster / student / coach-profile views.
  with(userId: string) {
    return apiFetch<{ data: { id: string } }>(
      `/api/conversations/with/${userId}`,
      { method: "POST" },
    ).then((r) => r.data.id);
  },

  get(id: string) {
    return apiFetch<{ data: ConversationDetail }>(
      `/api/conversations/${id}`,
    ).then((r) => r.data);
  },

  // Page backwards through history. `before` is the createdAt of the oldest
  // message already loaded; omit it for the latest page. Items come back
  // oldest-first within the page.
  messages(id: string, before?: string, limit = 40) {
    const qs = new URLSearchParams();
    if (before) qs.set("before", before);
    qs.set("limit", String(limit));
    return apiFetch<{
      data: { items: ConversationMessagePublic[]; hasMore: boolean };
    }>(`/api/conversations/${id}/messages?${qs.toString()}`).then((r) => r.data);
  },

  send(
    id: string,
    body: { content?: string; attachments?: MessageAttachment[] },
  ) {
    return apiFetch<{ data: ConversationMessagePublic }>(
      `/api/conversations/${id}/messages`,
      { method: "POST", body: JSON.stringify(body) },
    ).then((r) => r.data);
  },

  read(id: string) {
    return apiFetch<{ data: { read: boolean } }>(
      `/api/conversations/${id}/read`,
      { method: "POST" },
    ).then((r) => r.data.read);
  },

  // Multipart upload of a single file. Returns the attachment to fold into a
  // subsequent send() body. We must NOT set Content-Type so the browser fills
  // in the multipart boundary, hence the bare fetch instead of apiFetch.
  async uploadAttachment(id: string, file: File): Promise<MessageAttachment> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/conversations/${id}/attachments`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const json = await res.json();
    if (!res.ok) throw new ApiError(res.status, json);
    return (json as { data: MessageAttachment }).data;
  },

  // Same-origin WebSocket URL for a conversation's live feed. ws/wss is
  // chosen to match the page protocol.
  wsUrl(id: string): string {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/api/conversations/${id}/ws`;
  },
};

// ─── Notification preferences + web push ───

export const notificationsApi = {
  getPreferences() {
    return apiFetch<{ data: NotificationPreferencePublic }>(
      "/api/me/notification-preferences",
    ).then((r) => r.data);
  },

  updatePreferences(
    patch: Partial<{
      pushEnabled: boolean;
      smsEnabled: boolean;
      emailEnabled: boolean;
      quietHoursStart: number | null;
      quietHoursEnd: number | null;
      timezone: string;
      phone: string | null;
    }>,
  ) {
    return apiFetch<{ data: NotificationPreferencePublic }>(
      "/api/me/notification-preferences",
      { method: "PATCH", body: JSON.stringify(patch) },
    ).then((r) => r.data);
  },

  // base64url VAPID key; empty string means push isn't configured server-side.
  vapidPublicKey() {
    return apiFetch<{ data: { key: string } }>(
      "/api/me/push/vapid-public-key",
    ).then((r) => r.data.key);
  },

  // `sub` is exactly pushSubscription.toJSON().
  addPushSubscription(sub: {
    endpoint?: string | null;
    keys?: { p256dh?: string; auth?: string };
  }) {
    return apiFetch("/api/me/push/subscriptions", {
      method: "POST",
      body: JSON.stringify(sub),
    });
  },

  removePushSubscription(endpoint: string) {
    return apiFetch("/api/me/push/subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    });
  },
};
