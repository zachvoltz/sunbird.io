import { useEffect, useRef } from "react";

type Props = {
  stream: MediaStream | null;
  name?: string;
  muted?: boolean;
  mirrored?: boolean;
  isLocal?: boolean;
};

export function VideoTile({ stream, name, muted = false, mirrored = false, isLocal = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-charcoal overflow-hidden ${isLocal ? "w-36 h-28 md:w-48 md:h-36 rounded-card" : "w-full h-full"}`}>
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className={`w-full h-full object-cover ${mirrored ? "scale-x-[-1]" : ""}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-iris/20 flex items-center justify-center">
            <span className="text-cream text-lg font-display font-semibold">
              {name?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        </div>
      )}
      {name && (
        <div className="absolute bottom-2 left-2 bg-charcoal/70 text-cream text-[11px] px-2 py-0.5 rounded-pill">
          {name}
        </div>
      )}
    </div>
  );
}
