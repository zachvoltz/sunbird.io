import { useState } from "react";
import { useCallsSession } from "@/hooks/useCallsSession";
import { VideoTile } from "./VideoTile";
import { CallControls } from "./CallControls";
import { ToolsPanel } from "./ToolsPanel";

type Props = {
  bookingId: string;
  localUserName: string;
  remoteUserName: string;
};

export function VideoCall({ bookingId, localUserName, remoteUserName }: Props) {
  const {
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
  } = useCallsSession(bookingId);

  const [showTools, setShowTools] = useState(false);

  if (callState === "idle") {
    return (
      <div className="bg-charcoal rounded-card p-8 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-cream/70 text-sm mb-4">Ready to start your video session?</p>
        <button
          onClick={join}
          className="text-[14px] font-medium text-cream bg-iris px-6 py-2.5 rounded-card hover:bg-iris-hover transition-colors"
        >
          Join call
        </button>
      </div>
    );
  }

  if (callState === "joining") {
    return (
      <div className="bg-charcoal rounded-card p-8 flex flex-col items-center justify-center min-h-[200px]">
        <div className="w-8 h-8 border-2 border-iris border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-cream/70 text-sm">Connecting...</p>
      </div>
    );
  }

  if (callState === "error") {
    return (
      <div className="bg-charcoal rounded-card p-8 flex flex-col items-center justify-center min-h-[200px]">
        <p className="text-coral text-sm mb-4">{error || "Failed to connect"}</p>
        <button
          onClick={join}
          className="text-[14px] font-medium text-cream bg-iris px-6 py-2.5 rounded-card hover:bg-iris-hover transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="bg-charcoal rounded-card overflow-hidden relative">
      {/* Video area */}
      <div className="relative">
        {/* Reconnecting banner — shown while recovery is in flight; the last
            video frame stays put underneath. */}
        {callState === "reconnecting" && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 text-[13px] font-medium px-3 py-1.5 rounded-full shadow"
            style={{ background: "#f0a830", color: "#1a1612" }}
          >
            <span className="w-3 h-3 rounded-full animate-spin" style={{ border: "2px solid rgba(26,22,18,0.4)", borderTopColor: "#1a1612" }} />
            Reconnecting…
          </div>
        )}

        {/* Remote video (main) */}
        <VideoTile
          stream={remoteStream}
          name={remoteUserName}
        />

        {/* Local video (picture-in-picture) */}
        <div className="absolute bottom-3 right-3 z-10">
          <VideoTile
            stream={localStream}
            name={localUserName}
            muted
            mirrored
            isLocal
          />
        </div>

        {/* Screen share preview (small, top-left) */}
        {isScreenSharing && screenStream && (
          <div className="absolute top-3 left-3 z-10">
            <div className="relative">
              <VideoTile
                stream={screenStream}
                name="Screen"
                muted
                isLocal
              />
              <button
                onClick={toggleScreenShare}
                className="absolute -top-1 -right-1 w-5 h-5 bg-coral text-cream rounded-full flex items-center justify-center text-[10px]"
                title="Stop sharing"
              >
                &times;
              </button>
            </div>
          </div>
        )}

        {/* Waiting for peer indicator */}
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-10 h-10 border-2 border-cream/30 border-t-cream rounded-full animate-spin mx-auto mb-3" />
              <p className="text-cream/60 text-sm">Waiting for {remoteUserName} to join...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-surface border-t border-charcoal/10">
        <CallControls
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          isScreenSharing={isScreenSharing}
          isConnected={callState === "connected"}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
          onToggleScreenShare={toggleScreenShare}
          onDisconnect={disconnect}
          onToggleTools={() => setShowTools(!showTools)}
          showTools={showTools}
        />
      </div>

      {/* Tools panel */}
      <ToolsPanel isOpen={showTools} onClose={() => setShowTools(false)} />
    </div>
  );
}
