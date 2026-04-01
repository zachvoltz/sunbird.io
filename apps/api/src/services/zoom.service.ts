import type { Zoom } from "arctic";

type MeetingOptions = {
  topic: string;
  startTime: string;
  duration: number;
  inviteeEmail: string;
};

type MeetingResult = {
  meetingId: string;
  joinUrl: string;
};

export function createZoomService(db: any, zoomClient: Zoom) {
  async function getValidToken(userId: string): Promise<string> {
    const account = await db.oAuthAccount.findFirst({
      where: { userId, provider: "zoom" },
    });

    if (!account?.accessToken) {
      throw new Error("Zoom not connected for this user");
    }

    // Refresh if expired or expiring within 5 minutes
    const expiresAt = account.accessTokenExpiresAt
      ? new Date(account.accessTokenExpiresAt).getTime()
      : 0;
    const fiveMinFromNow = Date.now() + 5 * 60 * 1000;

    if (expiresAt < fiveMinFromNow && account.refreshToken) {
      const tokens = await zoomClient.refreshAccessToken(account.refreshToken);
      const newAccessToken = tokens.accessToken();
      const newRefreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : account.refreshToken;
      const newExpiresAt = tokens.accessTokenExpiresAt();

      await db.oAuthAccount.update({
        where: { id: account.id },
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          accessTokenExpiresAt: newExpiresAt,
        },
      });

      return newAccessToken;
    }

    return account.accessToken;
  }

  async function createMeeting(userId: string, options: MeetingOptions): Promise<MeetingResult> {
    const token = await getValidToken(userId);

    const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: options.topic,
        type: 2,
        start_time: options.startTime,
        duration: options.duration,
        settings: {
          join_before_host: true,
          meeting_invitees: [{ email: options.inviteeEmail }],
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Zoom API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as { id: number; join_url: string };
    return { meetingId: String(data.id), joinUrl: data.join_url };
  }

  async function deleteMeeting(userId: string, meetingId: string): Promise<void> {
    const token = await getValidToken(userId);

    await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return { getValidToken, createMeeting, deleteMeeting };
}
