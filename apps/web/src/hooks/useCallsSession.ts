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

function createPC() {
  return new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
    bundlePolicy: "max-bundle",
  });
}

export function useCallsSession(bookingId: string) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  // Separate PeerConnections for push (send) and pull (recv)
  const pushPcRef = useRef<RTCPeerConnection | null>(null);
  const pullPcRef = useRef<RTCPeerConnection | null>(null);
  const userIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const peerSessionIdRef = useRef<string | null>(null);
  const pullIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulledRef = useRef(false);
  const remoteStreamRef = useRef(new MediaStream());

  const apiBase = `/api/bookings/${bookingId}/call`;

  const cleanup = useCallback(() => {
    if (pullIntervalRef.current) {
      clearInterval(pullIntervalRef.current);
      pullIntervalRef.current = null;
    }
    if (pushPcRef.current) {
      pushPcRef.current.close();
      pushPcRef.current = null;
    }
    if (pullPcRef.current) {
      pullPcRef.current.close();
      pullPcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
    }
    peerSessionIdRef.current = null;
    pulledRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
    setCallState("idle");
  }, [localStream, screenStream]);

  // Push local tracks using the push PeerConnection
  async function pushLocalTracks(pc: RTCPeerConnection, stream: MediaStream) {
    const trackTransceivers: Array<{ trackName: string; transceiver: RTCRtpTransceiver }> = [];
    for (const track of stream.getTracks()) {
      const transceiver = pc.addTransceiver(track, { direction: "sendonly" });
      trackTransceivers.push({
        trackName: `${userIdRef.current}-${track.kind}`,
        transceiver,
      });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // role=push tells backend to use/create the push session
    const result = await apiFetch<TracksResponse>(`${apiBase}/tracks?role=push`, {
      method: "POST",
      body: JSON.stringify({
        sessionDescription: {
          type: offer.type,
          sdp: offer.sdp,
        },
        tracks: trackTransceivers.map((t) => ({
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

    return result;
  }

  // Pull remote tracks using a SEPARATE PeerConnection and CF session
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

    // Create a dedicated pull PeerConnection if we don't have one
    if (!pullPcRef.current) {
      const pullPc = createPC();
      pullPcRef.current = pullPc;

      pullPc.ontrack = (event) => {
        const rs = remoteStreamRef.current;
        for (const existing of rs.getTracks()) {
          if (existing.kind === event.track.kind) {
            rs.removeTrack(existing);
          }
        }
        rs.addTrack(event.track);
        setRemoteStream(new MediaStream(rs.getTracks()));
      };
    }

    const pc = pullPcRef.current;

    // Add recv transceivers (only if PC is fresh — no transceivers yet)
    if (pc.getTransceivers().length === 0) {
      pc.addTransceiver("audio", { direction: "recvonly" });
      pc.addTransceiver("video", { direction: "recvonly" });
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const transceivers = pc.getTransceivers();
    const audioMid = transceivers.find((t) => t.receiver.track.kind === "audio")?.mid;
    const videoMid = transceivers.find((t) => t.receiver.track.kind === "video")?.mid;

    try {
      // role=pull tells backend to use/create the pull session (separate from push)
      const result = await apiFetch<TracksResponse>(`${apiBase}/tracks?role=pull`, {
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
              mid: audioMid,
              sessionId: peerSessionIdRef.current,
            },
            {
              location: "remote",
              trackName: `${peerIdRef.current}-video`,
              mid: videoMid,
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
        const renegOffer = await pc.createOffer();
        await pc.setLocalDescription(renegOffer);

        const renegResult = await apiFetch<RenegotiateResponse>(`${apiBase}/renegotiate?role=pull`, {
          method: "PUT",
          body: JSON.stringify({
            sessionDescription: {
              type: renegOffer.type,
              sdp: renegOffer.sdp,
            },
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
      const joinResult = await apiFetch<JoinResponse>(`${apiBase}/join`, {
        method: "POST",
      });

      userIdRef.current = joinResult.data.userId;
      peerIdRef.current = joinResult.data.peerId;
      peerSessionIdRef.current = joinResult.data.peerSessionId;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });

      setLocalStream(stream);

      // Push PC — send-only
      const pushPc = createPC();
      pushPcRef.current = pushPc;

      await pushLocalTracks(pushPc, stream);

      setCallState("connected");

      // Poll to pull remote tracks (uses its own separate PC + CF session)
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

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

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
    const pc = pushPcRef.current;
    if (!pc || callState !== "connected") return;

    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
      setScreenStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        setScreenStream(display);
        setIsScreenSharing(true);

        const screenTrack = display.getVideoTracks()[0];
        const transceiver = pc.addTransceiver(screenTrack, { direction: "sendonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const result = await apiFetch<TracksResponse>(`${apiBase}/tracks?role=push`, {
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
        if (err.name !== "NotAllowedError") {
          console.error("Screen share failed:", err);
        }
      }
    }
  }, [callState, isScreenSharing, screenStream, apiBase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pullIntervalRef.current) clearInterval(pullIntervalRef.current);
      if (pushPcRef.current) pushPcRef.current.close();
      if (pullPcRef.current) pullPcRef.current.close();
    };
  }, []);

  return {
    callState,
    error,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isScreenSharing,
    screenStream,
    join,
    disconnect,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  };
}
