import type { GoalPublic, GoalStatus } from "@sunbird/shared";

// Prisma's Goal row is structurally narrower than the client type (Dates,
// loose status string). Keep the mapping in one place so /api/me/goals and
// the coach student-detail endpoint serialize goals identically.
type GoalRow = {
  id: string;
  title: string;
  detail: string | null;
  targetLabel: string | null;
  progressPct: number;
  status: string;
  isNew: boolean;
  achievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeGoal(g: GoalRow): GoalPublic {
  return {
    id: g.id,
    title: g.title,
    detail: g.detail,
    targetLabel: g.targetLabel,
    progressPct: g.progressPct,
    status: g.status as GoalStatus,
    isNew: g.isNew,
    achievedAt: g.achievedAt?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}
