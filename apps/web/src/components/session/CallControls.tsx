type Props = {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isConnected: boolean;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onDisconnect: () => void;
  onToggleTools?: () => void;
  showTools?: boolean;
};

export function CallControls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  isConnected,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  onDisconnect,
  onToggleTools,
  showTools,
}: Props) {
  if (!isConnected) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button
        onClick={onToggleMute}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isMuted
            ? "bg-coral/20 text-coral"
            : "bg-charcoal/10 text-charcoal hover:bg-charcoal/20"
        }`}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.13 1.49-.36 2.18" />
            <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      <button
        onClick={onToggleVideo}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          isVideoOff
            ? "bg-coral/20 text-coral"
            : "bg-charcoal/10 text-charcoal hover:bg-charcoal/20"
        }`}
        title={isVideoOff ? "Turn on camera" : "Turn off camera"}
      >
        {isVideoOff ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        )}
      </button>

      {/* Screen share — hidden on mobile (not supported) */}
      {"getDisplayMedia" in navigator.mediaDevices && (
        <button
          onClick={onToggleScreenShare}
          className={`hidden md:flex w-10 h-10 rounded-full items-center justify-center transition-colors ${
            isScreenSharing
              ? "bg-iris/20 text-iris"
              : "bg-charcoal/10 text-charcoal hover:bg-charcoal/20"
          }`}
          title={isScreenSharing ? "Stop sharing" : "Share screen"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </button>
      )}

      {onToggleTools && (
        <button
          onClick={onToggleTools}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            showTools
              ? "bg-iris/20 text-iris"
              : "bg-charcoal/10 text-charcoal hover:bg-charcoal/20"
          }`}
          title="Toggle tools"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" />
          </svg>
        </button>
      )}

      <button
        onClick={onDisconnect}
        className="w-10 h-10 rounded-full bg-coral text-cream flex items-center justify-center hover:bg-coral/90 transition-colors"
        title="End call"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            <line x1="23" y1="1" x2="1" y2="23" />
          </svg>
      </button>
    </div>
  );
}
