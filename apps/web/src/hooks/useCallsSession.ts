import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";

type CallState = "idle" | "joining" | "connected" | "error";

type JoinResponse = {
  data: {
    sessionId: string;
    appId: string;
    userId: string;
    peerId: string | null;
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
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const pullIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulledRef = useRef(false);
  const pulledScreenRef = useRef(false);
  const remoteStreamRef = useRef(new MediaStream());
  const screenTrackSenderRef = useRef<RTCRtpSender | null>(null);

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
    sessionIdRef.current = null;
    pulledRef.current = false;
    pulledScreenRef.current = false;
    screenTrackSenderRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setScreenStream(null);
    setIsScreenSharing(false);
    setCallState("idle");
  }, [localStream, screenStream]);

  // Push local tracks to Cloudflare via our backend
  async function pushLocalTracks(pc: RTCPeerConnection, stream: MediaStream) {
    // Add tracks to PeerConnection
    const transceivers: Array<{ trackName: string; mid: string }> = [];
    for (const track of stream.getTracks()) {
      const transceiver = pc.addTransceiver(track, { direction: "sendonly" });
      transceivers.push({
        trackName: `${userIdRef.current}-${track.kind}`,
        mid: transceiver.mid!,
      });
    }

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send to Cloudflare via our proxy
    const result = await apiFetch<TracksResponse>(`${apiBase}/tracks`, {
      method: "POST",
      body: JSON.stringify({
        sessionDescription: {
          type: offer.type,
          sdp: offer.sdp,
        },
        tracks: transceivers.map((t) => ({
          location: "local",
          trackName: t.trackName,
          mid: t.mid,
        })),
      }),
    });

    // Set the answer
    if (result.data.sessionDescription) {
      await pc.setRemoteDescription(
        new RTCSessionDescription(result.data.sessionDescription as RTCSessionDescriptionInit),
      );
    }

    return result;
  }

  // Pull remote tracks from the peer
  async function pullRemoteTracks(pc: RTCPeerConnection) {
    if (!peerIdRef.current || !sessionIdRef.current) return;

    // Add receive-only transceivers for the remote tracks
    const audioTransceiver = pc.addTransceiver("audio", { direction: "recvonly" });
    const videoTransceiver = pc.addTransceiver("video", { direction: "recvonly" });

    // Create a new offer with the recv transceivers
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    try {
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
              mid: audioTransceiver.mid,
              sessionId: sessionIdRef.current,
            },
            {
              location: "remote",
              trackName: `${peerIdRef.current}-video`,
              mid: videoTransceiver.mid,
              sessionId: sessionIdRef.current,
            },
          ],
        }),
      });

      if (result.data.sessionDescription) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(result.data.sessionDescription as RTCSessionDescriptionInit),
        );
      }

      // Check if any tracks had errors (peer hasn't joined yet)
      const hasErrors = result.data.tracks.some((t) => t.errorCode);
      if (!hasErrors) {
        pulledRef.current = true;
      }

      // Handle renegotiation if needed
      if (result.data.requiresImmediateRenegotiation) {
        const renegOffer = await pc.createOffer();
        await pc.setLocalDescription(renegOffer);

        const renegResult = await apiFetch<RenegotiateResponse>(`${apiBase}/renegotiate`, {
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
      // Peer hasn't pushed tracks yet — will retry on next poll
    }
  }

  const join = useCallback(async () => {
    if (callState !== "idle") return;
    setCallState("joining");
    setError(null);

    try {
      // 1. Get session info from backend
      const joinResult = await apiFetch<JoinResponse>(`${apiBase}/join`, {
        method: "POST",
      });

      sessionIdRef.current = joinResult.data.sessionId;
      userIdRef.current = joinResult.data.userId;
      peerIdRef.current = joinResult.data.peerId;

      // 2. Get local media
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

      // 3. Create PeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      pcRef.current = pc;

      // Listen for remote tracks
      pc.ontrack = (event) => {
        const rs = remoteStreamRef.current;
        // Remove old tracks of same kind before adding new
        for (const existing of rs.getTracks()) {
          if (existing.kind === event.track.kind) {
            rs.removeTrack(existing);
          }
        }
        rs.addTrack(event.track);
        // Trigger React re-render with a new MediaStream reference
        setRemoteStream(new MediaStream(rs.getTracks()));
      };

      // 4. Push local tracks
      await pushLocalTracks(pc, stream);

      setCallState("connected");

      // 5. Start polling to pull remote tracks
      // Try immediately, then every 3 seconds until peer joins
      const tryPull = async () => {
        if (pulledRef.current || !pcRef.current) return;
        await pullRemoteTracks(pcRef.current);
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
    const pc = pcRef.current;
    if (!pc || callState !== "connected") return;

    if (isScreenSharing) {
      // Stop screen sharing
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }
      // Remove the screen track sender from the PeerConnection
      if (screenTrackSenderRef.current) {
        pc.removeTrack(screenTrackSenderRef.current);
        screenTrackSenderRef.current = null;
      }
      setScreenStream(null);
      setIsScreenSharing(false);
      // Renegotiate to inform Cloudflare the track is gone
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const result = await apiFetch<RenegotiateResponse>(`${apiBase}/renegotiate`, {
          method: "PUT",
          body: JSON.stringify({
            sessionDescription: { type: offer.type, sdp: offer.sdp },
          }),
        });
        if (result.data.sessionDescription) {
          await pc.setRemoteDescription(
            new RTCSessionDescription(result.data.sessionDescription as RTCSessionDescriptionInit),
          );
        }
      } catch (err) {
        console.error("Failed to renegotiate after stopping screen share:", err);
      }
    } else {
      // Start screen sharing
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });

        setScreenStream(display);

        const screenTrack = display.getVideoTracks()[0];
        // Push screen track to Cloudflare
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

        // Store the sender so we can remove it later
        screenTrackSenderRef.current = pc.getSenders().find(
          (s) => s.track === screenTrack,
        ) ?? null;

        setIsScreenSharing(true);

        // Auto-stop when user clicks browser's "Stop sharing" button
        screenTrack.onended = () => {
          setScreenStream(null);
          setIsScreenSharing(false);
          screenTrackSenderRef.current = null;
        };
      } catch (err: any) {
        // User cancelled the screen share picker — not an error
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
      if (pcRef.current) pcRef.current.close();
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
