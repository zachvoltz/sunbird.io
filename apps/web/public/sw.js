/* Sunbird service worker — web-push only. Served from the site root (this
 * file lives in apps/web/public/, which Vite copies verbatim to the build
 * root) so it controls the whole origin.
 *
 * Push payload shape (sent by the API):
 *   { title, body, url, conversationId }
 */

self.addEventListener("install", () => {
  // Take over without waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    // Non-JSON payloads fall back to a plain-text body.
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Sunbird";
  const url = data.url || "/messages";
  const options = {
    body: data.body || "",
    icon: "/sunbird-icon.png",
    badge: "/sunbird-icon.png",
    // tag by conversation so repeat messages collapse instead of stacking.
    tag: data.conversationId ? `conversation:${data.conversationId}` : undefined,
    renotify: !!data.conversationId,
    data: { url },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/messages";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab on the target URL if we have one; otherwise
        // focus any open tab and navigate it, else open a fresh window.
        for (const client of clients) {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        for (const client of clients) {
          if ("navigate" in client && "focus" in client) {
            return client.navigate(targetUrl).then((c) => (c ? c.focus() : null));
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
        return null;
      }),
  );
});
