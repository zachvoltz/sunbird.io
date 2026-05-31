import type { GoalPublic } from "@sunbird/shared";

type Props = {
  goal: GoalPublic;
  /** Compact: hide actions + note (used in the session-prep sidebar). */
  compact?: boolean;
  /** Show the "↔ shared" badge (hidden on the coach side where it's implied). */
  showShared?: boolean;
  onLogProgress?: (goal: GoalPublic) => void;
  onEdit?: (goal: GoalPublic) => void;
  onAchieve?: (goal: GoalPublic) => void;
};

// A freshly-set goal gets a sparkle and the "talk it through" treatment; an
// in-progress goal shows its progress bar. Mirrors the design's GoalCard.
export function GoalCard({
  goal,
  compact = false,
  showShared = true,
  onLogProgress,
  onEdit,
  onAchieve,
}: Props) {
  const isNew = goal.isNew && goal.status === "ACTIVE";
  const achieved = goal.status === "ACHIEVED";

  return (
    <div
      className={`bg-surface rounded-card p-4 border ${
        isNew ? "border-iris shadow-elevated" : "border-charcoal/10 shadow-card"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-lg leading-none shrink-0" aria-hidden>
          {achieved ? "✓" : isNew ? "✨" : "🎯"}
        </span>
        <div className="min-w-0 grow">
          <div className="text-[13.5px] font-medium text-charcoal leading-tight">
            {goal.title}
          </div>
          {goal.targetLabel && (
            <div className="text-[11px] text-text-secondary mt-0.5">{goal.targetLabel}</div>
          )}
        </div>
        {showShared && (
          <span
            className="text-[10px] text-text-secondary whitespace-nowrap shrink-0"
            title="shared with your teacher"
          >
            ↔ shared
          </span>
        )}
      </div>

      {isNew ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-card bg-blush border border-iris px-2.5 py-1.5">
          <span className="text-iris">✨</span>
          <span className="text-[11px] font-medium text-iris leading-snug">
            new — we'll talk through how to approach this next lesson
          </span>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="grow h-1.5 rounded-pill bg-warm-gray overflow-hidden">
            <div
              className={achieved ? "h-full bg-sage" : "h-full bg-iris"}
              style={{ width: `${achieved ? 100 : goal.progressPct}%` }}
            />
          </div>
          <span className="text-[11px] text-text-secondary shrink-0">
            {achieved ? "done" : `${goal.progressPct}%`}
          </span>
        </div>
      )}

      {!compact && goal.detail && !isNew && (
        <div className="mt-1.5 text-[11px] text-text-secondary">{goal.detail}</div>
      )}

      {!compact && (onLogProgress || onEdit || onAchieve) && (
        <div className="mt-2.5 flex items-center gap-2">
          {isNew && onEdit && (
            <button
              onClick={() => onEdit(goal)}
              className="text-[12px] font-medium text-text-secondary hover:text-charcoal transition-colors"
            >
              ✎ edit goal
            </button>
          )}
          {!isNew && !achieved && onLogProgress && (
            <button
              onClick={() => onLogProgress(goal)}
              className="text-[12px] font-medium text-text-secondary hover:text-charcoal transition-colors"
            >
              + log progress
            </button>
          )}
          {!achieved && onAchieve && (
            <button
              onClick={() => onAchieve(goal)}
              className="text-[12px] font-medium text-sage hover:text-charcoal transition-colors ml-auto"
            >
              mark achieved ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}
