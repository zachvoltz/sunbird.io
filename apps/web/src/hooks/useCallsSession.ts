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

export function useCallsSession(bookingId: string) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

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

  function newPc() {
    return new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
      bundlePolicy: "max-bundle",
    });
  }

  // Wait for PeerConnection ICE to connect (or fail)
  function waitForConnection(pc: RTCPeerConnection, timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (pc.connectionState === "connected") return resolve();
      const timer = setTimeout(() => reject(new Error("ICE connection timeout")), timeout);
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          clearTimeout(timer);
          resolve();
        } else if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          clearTimeout(timer);
          reject(new Error(`ICE connection ${pc.connectionState}`));
        }
      };
    });
  }

  // Push local tracks on the push PeerConnection/session
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

    // Wait for ICE to connect so tracks are actually deliverable to pullers
    await waitForConnection(pc);

    return result;
  }

  // Pull remote tracks on a dedicated pull PeerConnection/session
  async function pullRemoteTracks() {
    if (!peerIdRef.current) return;

    // Always refresh peer's push session ID (it may have changed due to retry)
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

    // Always start fresh — each attempt gets a new PC and a new CF session
    if (pullPcRef.current) {
      pullPcRef.current.close();
      pullPcRef.current = null;
    }

    const pc = newPc();
    pullPcRef.current = pc;

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

    pc.addTransceiver("audio", { direction: "recvonly" });
    pc.addTransceiver("video", { direction: "recvonly" });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    try {
      const result = await apiFetch<TracksResponse>(`${apiBase}/pull`, {
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
      } else {
        console.warn("Pull tracks had errors:", result.data.tracks);
        pc.close();
        pullPcRef.current = null;
      }
    } catch (err) {
      console.warn("Pull failed, will retry:", err);
      pc.close();
      pullPcRef.current = null;
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

      const pushPc = newPc();
      pushPcRef.current = pushPc;

      await pushLocalTracks(pushPc, stream);
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
    const pc = pushPcRef.current;
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
      if (pushPcRef.current) pushPcRef.current.close();
      if (pullPcRef.current) pullPcRef.current.close();
    };
  }, []);

  return {
    callState, error, localStream, remoteStream,
    isMuted, isVideoOff, isScreenSharing, screenStream,
    join, disconnect, toggleMute, toggleVideo, toggleScreenShare,
  };
}
