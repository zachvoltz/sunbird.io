type CallsSession = {
  sessionId: string;
};

type TrackRequest = {
  sessionDescription?: { type: string; sdp: string };
  tracks: Array<{
    location: "local" | "remote";
    trackName: string;
    mid?: string;
    sessionId?: string;
  }>;
};

type TrackResponse = {
  sessionDescription?: { type: string; sdp: string };
  tracks: Array<{
    trackName: string;
    mid?: string;
    errorCode?: string;
    errorDescription?: string;
  }>;
  requiresImmediateRenegotiation?: boolean;
};

export function createCallsService(appId: string, appToken: string) {
  const baseUrl = `https://rtc.live.cloudflare.com/v1/apps/${appId}`;

  const headers = {
    Authorization: `Bearer ${appToken}`,
    "Content-Type": "application/json",
  };

  async function createSession(): Promise<CallsSession> {
    const res = await fetch(`${baseUrl}/sessions/new`, {
      method: "POST",
      headers: { Authorization: `Bearer ${appToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare Calls API error: ${res.status} ${text}`);
    }

    const data = (await res.json()) as { sessionId: string };
    return { sessionId: data.sessionId };
  }

  async function newTracks(sessionId: string, request: TrackRequest): Promise<TrackResponse> {
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/tracks/new`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare Calls tracks error: ${res.status} ${text}`);
    }

    return (await res.json()) as TrackResponse;
  }

  async function renegotiate(sessionId: string, sdp: { type: string; sdp: string }): Promise<{ sessionDescription: { type: string; sdp: string } }> {
    const res = await fetch(`${baseUrl}/sessions/${sessionId}/renegotiate`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ sessionDescription: sdp }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudflare Calls renegotiate error: ${res.status} ${text}`);
    }

    return (await res.json()) as { sessionDescription: { type: string; sdp: string } };
  }

  return { createSession, newTracks, renegotiate };
}
