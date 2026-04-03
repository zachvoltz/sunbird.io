import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";

type CallState = "idle" | "joining" | "connected" | "error";

type JoinResponse = {
  data: {
    userId: string;
    peerId: string | null;
    peerSessionId: string | null;
  };
};

type TracksResponse = {
  data: {
    sessionDescription?: { type: string; sdp: string };
    tracks: Array<{
      trackName: string;
      mid?: string;
      errorCode?: string;
      errorDescription?: string;
    }>;
    requiresImmediateRenegotiation?: boolean;
    mySessionId?: string;
    peerSessionId?: string | null;
  };
};

type RenegotiateResponse = {
  data: {
    sessionDescription: { type: string; sdp: string };
  };
};

export function useCallsSession(bookingId: string) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const userIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const peerSessionIdRef = useRef<string | null>(null);
  const pullIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulledRef = useRef(false);
  const remoteStreamRef = useRef(new MediaStream());
  // Whether recv transceivers have been added to the PeerConnection
  const recvAddedRef = useRef(false);

  const apiBase = `/api/bookings/${bookingId}/call`;

  const cleanup = useCallback(() => {
    if (pullIntervalRef.current) {
      clearInterval(pullIntervalRef.current);
      pullIntervalRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
    }
    peerSessionIdRef.current = null;
    pulledRef.current = false;
    recvAddedRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
    setCallState("idle");
  }, [localStream, screenStream]);

  // Push local tracks only — recv transceivers are added later during pull
  async function pushLocalTracks(pc: RTCPeerConnection, stream: MediaStream) {
    const sendTransceivers: Array<{ trackName: string; transceiver: RTCRtpTransceiver }> = [];
    for (const track of stream.getTracks()) {
      const transceiver = pc.addTransceiver(track, { direction: "sendonly" });
      sendTransceivers.push({
        trackName: `${userIdRef.current}-${track.kind}`,
        transceiver,
      });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const result = await apiFetch<TracksResponse>(`${apiBase}/tracks`, {
      method: "POST",
      body: JSON.stringify({
        sessionDescription: {
          type: offer.type,
          sdp: offer.sdp,
        },
        tracks: sendTransceivers.map((t) => ({
          location: "local",
          trackName: t.trackName,
          mid: t.transceiver.mid,
        })),
      }),
    });

    if (result.data.peerSessionId) {
      peerSessionIdRef.current = result.data.peerSessionId;
    }

    if (result.data.sessionDescription) {
      await pc.setRemoteDescription(
        new RTCSessionDescription(result.data.sessionDescription as RTCSessionDescriptionInit),
      );
    }

    if (result.data.requiresImmediateRenegotiation) {
      const renegOffer = await pc.createOffer();
      await pc.setLocalDescription(renegOffer);
      const renegResult = await apiFetch<TracksResponse>(`${apiBase}/tracks`, {
        method: "POST",
        body: JSON.stringify({
          sessionDescription: { type: renegOffer.type, sdp: renegOffer.sdp },
          tracks: [],
        }),
      });
      if (renegResult.data.sessionDescription) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(renegResult.data.sessionDescription as RTCSessionDescriptionInit),
        );
      }
    }

    return result;
  }

  // Pull remote tracks — add recv transceivers and pull in a single tracks/new call
  async function pullRemoteTracks() {
    if (!peerIdRef.current) return;

    // Discover peer's push session ID
    if (!peerSessionIdRef.current) {
      try {
        const joinResult = await apiFetch<JoinResponse>(`${apiBase}/join`, { method: "POST" });
        if (joinResult.data.peerSessionId) {
          peerSessionIdRef.current = joinResult.data.peerSessionId;
        } else {
          return; // Peer hasn't joined yet
        }
      } catch {
        return;
      }
    }

    const pc = pcRef.current;
    if (!pc) return;

    // Add recv transceivers if not yet created
    if (!recvAddedRef.current) {
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });
      recvAddedRef.current = true;
    }

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Don't specify mid for remote tracks — Cloudflare auto-assigns from recv m-sections
      const result = await apiFetch<TracksResponse>(`${apiBase}/tracks`, {
        method: "POST",
        body: JSON.stringify({
          sessionDescription: {
            type: offer.type,
            sdp: offer.sdp,
          },
          tracks: [
            {
              location: "remote",
              trackName: `${peerIdRef.current}-audio`,
              sessionId: peerSessionIdRef.current,
            },
            {
              location: "remote",
              trackName: `${peerIdRef.current}-video`,
              sessionId: peerSessionIdRef.current,
            },
          ],
        }),
      });

      if (result.data.sessionDescription) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(result.data.sessionDescription as RTCSessionDescriptionInit),
        );
      }

      const hasErrors = result.data.tracks.some((t) => t.errorCode);
      if (!hasErrors) {
        pulledRef.current = true;
      }

      if (result.data.requiresImmediateRenegotiation) {
        // Cloudflare-initiated renegotiation: create new offer, get answer via tracks/new
        const renegOffer = await pc.createOffer();
        await pc.setLocalDescription(renegOffer);
        const renegResult = await apiFetch<TracksResponse>(`${apiBase}/tracks`, {
          method: "POST",
          body: JSON.stringify({
            sessionDescription: { type: renegOffer.type, sdp: renegOffer.sdp },
            tracks: [],
          }),
        });
        if (renegResult.data.sessionDescription) {
          await pc.setRemoteDescription(
            new RTCSessionDescription(renegResult.data.sessionDescription as RTCSessionDescriptionInit),
          );
        }
      }
    } catch {
      // Will retry on next poll
    }
  }

  const join = useCallback(async () => {
    if (callState !== "idle") return;
    setCallState("joining");
    setError(null);

    try {
      const joinResult = await apiFetch<JoinResponse>(`${apiBase}/join`, { method: "POST" });
      userIdRef.current = joinResult.data.userId;
      peerIdRef.current = joinResult.data.peerId;
      peerSessionIdRef.current = joinResult.data.peerSessionId;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      });
      setLocalStream(stream);

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        const rs = remoteStreamRef.current;
        for (const existing of rs.getTracks()) {
          if (existing.kind === event.track.kind) {
            rs.removeTrack(existing);
          }
        }
        rs.addTrack(event.track);
        setRemoteStream(new MediaStream(rs.getTracks()));
      };

      // Push local tracks (also sets up recv transceivers for later pull)
      await pushLocalTracks(pc, stream);
      setCallState("connected");

      // Poll to pull remote tracks
      const tryPull = async () => {
        if (pulledRef.current) return;
        await pullRemoteTracks();
      };

      tryPull();
      pullIntervalRef.current = setInterval(async () => {
        if (pulledRef.current) {
          if (pullIntervalRef.current) clearInterval(pullIntervalRef.current);
          return;
        }
        await tryPull();
      }, 3000);
    } catch (err: any) {
      console.error("Failed to join call:", err);
      setError(err.message || "Failed to join call");
      setCallState("error");
    }
  }, [callState, apiBase]);

  const disconnect = useCallback(() => { cleanup(); }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  }, [localStream]);

  const toggleScreenShare = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || callState !== "connected") return;

    if (isScreenSharing) {
      if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        setScreenStream(display);
        setIsScreenSharing(true);

        const screenTrack = display.getVideoTracks()[0];
        const transceiver = pc.addTransceiver(screenTrack, { direction: "sendonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const result = await apiFetch<TracksResponse>(`${apiBase}/tracks`, {
          method: "POST",
          body: JSON.stringify({
            sessionDescription: { type: offer.type, sdp: offer.sdp },
            tracks: [{
              location: "local",
              trackName: `${userIdRef.current}-screen`,
              mid: transceiver.mid,
            }],
          }),
        });

        if (result.data.sessionDescription) {
          await pc.setRemoteDescription(
            new RTCSessionDescription(result.data.sessionDescription as RTCSessionDescriptionInit),
          );
        }

        screenTrack.onended = () => {
          setScreenStream(null);
          setIsScreenSharing(false);
        };
      } catch (err: any) {
        if (err.name !== "NotAllowedError") console.error("Screen share failed:", err);
      }
    }
  }, [callState, isScreenSharing, screenStream, apiBase]);

  useEffect(() => {
    return () => {
      if (pullIntervalRef.current) clearInterval(pullIntervalRef.current);
      if (pcRef.current) pcRef.current.close();
    };
  }, []);

  return {
    callState, error, localStream, remoteStream,
    isMuted, isVideoOff, isScreenSharing, screenStream,
    join, disconnect, toggleMute, toggleVideo, toggleScreenShare,
  };
}
