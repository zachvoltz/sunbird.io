type Props = {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
};

export function ToolsPanel({ isOpen, onClose, children }: Props) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-surface border-l border-charcoal/10 shadow-elevated z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-charcoal/10">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
          Tools
        </h3>
        <button
          onClick={onClose}
          className="text-text-secondary hover:text-charcoal transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {children ?? (
          <p className="text-sm text-text-secondary text-center py-8">
            Session tools coming soon — MIDI player, metronome, and tuner.
          </p>
        )}
      </div>
    </div>
  );
}
