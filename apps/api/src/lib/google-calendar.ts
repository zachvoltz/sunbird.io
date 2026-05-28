// Hand-rolled Google Calendar OAuth + REST helpers. We don't reach for
// arctic here because we need access_type=offline + prompt=consent for
// refresh tokens, and the calendar.events scope. Plain fetch keeps the
// surface minimal and Workers-friendly.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const GOOGLE_CALENDAR_PROVIDER = "google_calendar";

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope?: string;
};

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    redirect_uri: opts.redirectUri,
    code: opts.code,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  const json: any = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
    scope: json.scope,
  };
}

export async function refreshAccessToken(opts: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresAt: Date }> {
  const body = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    refresh_token: opts.refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }
  const json: any = await res.json();
  return {
    accessToken: json.access_token,
    expiresAt: new Date(Date.now() + (json.expires_in ?? 3600) * 1000),
  };
}

// Fetch a fresh access token, refreshing first if the cached one is
// within 60s of expiry. Persists the new token back to the OAuthAccount
// row via the provided onRefresh callback (which the route layer wires
// to a Prisma update).
export async function ensureAccessToken(args: {
  account: {
    accessToken: string | null;
    refreshToken: string | null;
    accessTokenExpiresAt: Date | null;
  };
  clientId: string;
  clientSecret: string;
  onRefresh: (next: { accessToken: string; expiresAt: Date }) => Promise<void>;
}): Promise<string> {
  const { account, clientId, clientSecret, onRefresh } = args;
  if (!account.accessToken) {
    throw new Error("Calendar not connected (no access token)");
  }
  const exp = account.accessTokenExpiresAt?.getTime() ?? 0;
  const skewMs = 60 * 1000;
  if (exp > Date.now() + skewMs) return account.accessToken;
  if (!account.refreshToken) {
    throw new Error("Access token expired and no refresh token available");
  }
  const next = await refreshAccessToken({
    clientId,
    clientSecret,
    refreshToken: account.refreshToken,
  });
  await onRefresh(next);
  return next.accessToken;
}

// ── Calendar API wrappers ─────────────────────────────────

export type GCalEvent = {
  id: string;
  summary?: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  status?: string;
};

export async function listEvents(args: {
  accessToken: string;
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<GCalEvent[]> {
  const cal = args.calendarId ?? "primary";
  const url = new URL(`${CAL_API}/calendars/${encodeURIComponent(cal)}/events`);
  url.searchParams.set("timeMin", args.timeMin.toISOString());
  url.searchParams.set("timeMax", args.timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");
  const res = await fetch(url.toString(), {
    headers: { authorization: `Bearer ${args.accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar list failed: ${res.status} ${text}`);
  }
  const json: any = await res.json();
  return (json.items ?? []) as GCalEvent[];
}

export async function createEvent(args: {
  accessToken: string;
  calendarId?: string;
  summary: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<GCalEvent> {
  const cal = args.calendarId ?? "primary";
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(cal)}/events`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${args.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        summary: args.summary,
        description: args.description,
        start: { dateTime: args.startsAt.toISOString() },
        end:   { dateTime: args.endsAt.toISOString() },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Calendar create failed: ${res.status} ${text}`);
  }
  return (await res.json()) as GCalEvent;
}

export async function deleteEvent(args: {
  accessToken: string;
  calendarId?: string;
  eventId: string;
}): Promise<void> {
  const cal = args.calendarId ?? "primary";
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(args.eventId)}`,
    {
      method: "DELETE",
      headers: { authorization: `Bearer ${args.accessToken}` },
    },
  );
  // 404 = already gone. 410 = deleted. Treat both as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Google Calendar delete failed: ${res.status} ${text}`);
  }
}
