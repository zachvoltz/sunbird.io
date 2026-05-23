import { useNow } from "../hooks/useNow";

/**
 * Mobile-frame status bar showing the live clock. Re-renders every 15 s via
 * useNow so the time stays current without a page refresh.
 */
export function MobileStatusBar() {
  const now = useNow();
  return (
    <div className="wf-status">
      <span>
        {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
      </span>
      <span className="dots">• • •</span>
      <span>⌁ 87%</span>
    </div>
  );
}
