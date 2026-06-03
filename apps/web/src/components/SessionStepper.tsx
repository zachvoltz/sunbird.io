// Shared phase stepper for the session workflow (Upcoming → Live → Follow-up).
// Anchors every phase of a session so the coach/student always sees where they
// are. `done` steps get a check, the current step pulses, future steps are
// muted. Steps are clickable when an onSelect handler is provided.

export type StepperPhase = { key: string; label: string };

type Props = {
  steps: StepperPhase[];
  activeKey: string;
  /** Right-aligned context line, e.g. "Maya R. · piano · 30 min". */
  meta?: React.ReactNode;
  onSelect?: (key: string) => void;
  /** Show Prev/Next lesson buttons (for the same coach+student pair). */
  showNav?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
};

const navBtn =
  "text-[12px] font-medium text-text-secondary hover:text-charcoal disabled:opacity-30 disabled:cursor-not-allowed px-2 py-1 rounded-card hover:enabled:bg-warm-gray/40 transition-colors";

export function SessionStepper({
  steps,
  activeKey,
  meta,
  onSelect,
  showNav,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
}: Props) {
  const activeIdx = steps.findIndex((s) => s.key === activeKey);

  return (
    <div className="flex items-center gap-3 flex-wrap mb-8">
      {showNav && (
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className={navBtn}
          title={hasPrev ? "Previous lesson" : "No earlier lesson"}
        >
          ‹ Prev
        </button>
      )}
      <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
        Session
      </span>
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const state = i < activeIdx ? "done" : i === activeIdx ? "on" : "todo";
          const clickable = !!onSelect;
          return (
            <div key={s.key} className="flex items-center gap-1">
              {i > 0 && (
                <span
                  className={`w-6 h-px ${i <= activeIdx ? "bg-sage" : "bg-charcoal/15"}`}
                />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onSelect?.(s.key)}
                className={`flex items-center gap-2 rounded-card px-3 py-1.5 transition-colors ${
                  clickable ? "cursor-pointer" : "cursor-default"
                } ${
                  state === "on"
                    ? "bg-iris/10"
                    : clickable
                      ? "hover:bg-warm-gray/40"
                      : ""
                }`}
              >
                <span
                  className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium border ${
                    state === "done"
                      ? "bg-sage border-sage text-cream"
                      : state === "on"
                        ? "bg-iris border-iris text-cream"
                        : "border-charcoal/30 text-text-secondary"
                  }`}
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                <span
                  className={`text-[13px] font-medium ${
                    state === "on"
                      ? "text-charcoal"
                      : state === "done"
                        ? "text-text-secondary"
                        : "text-charcoal/40"
                  }`}
                >
                  {s.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {meta && <span className="text-[11px] text-text-secondary ml-auto">{meta}</span>}
      {showNav && (
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className={`${navBtn}${meta ? "" : " ml-auto"}`}
          title={hasNext ? "Next lesson" : "No later lesson"}
        >
          Next ›
        </button>
      )}
    </div>
  );
}
