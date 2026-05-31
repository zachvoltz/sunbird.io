import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { STFrame } from "@/wireframe/components/STFrame";
import { GoalCard } from "@/components/GoalCard";
import type { GoalPublic } from "@sunbird/shared";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <STFrame side="goals">
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", background: "var(--color-cream)" }}>
        {children}
      </div>
    </STFrame>
  );
}

export function MyGoalsPage() {
  const [goals, setGoals] = useState<GoalPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New-goal form
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline progress editor — goalId currently being adjusted
  const [progressFor, setProgressFor] = useState<string | null>(null);
  const [progressVal, setProgressVal] = useState(0);

  const load = () =>
    apiFetch<{ data: GoalPublic[] }>("/api/me/goals")
      .then((r) => setGoals(r.data))
      .catch(() => setError("Couldn't load your goals."))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const createGoal = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: GoalPublic }>("/api/me/goals", {
        method: "POST",
        body: JSON.stringify({ title: title.trim(), targetLabel: target.trim() || undefined }),
      });
      setGoals((prev) => [res.data, ...prev]);
      setTitle("");
      setTarget("");
      setAdding(false);
    } catch (err: any) {
      setError(err?.body?.error ?? "Couldn't set that goal. Try booking a lesson first.");
    } finally {
      setSaving(false);
    }
  };

  const patchGoal = async (id: string, body: Record<string, unknown>) => {
    try {
      const res = await apiFetch<{ data: GoalPublic }>(`/api/me/goals/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setGoals((prev) => prev.map((g) => (g.id === id ? res.data : g)));
    } catch {
      /* leave UI as-is on failure */
    }
  };

  const active = goals.filter((g) => g.status === "ACTIVE");
  const newGoals = active.filter((g) => g.isNew);
  const inProgress = active.filter((g) => !g.isNew);
  const achieved = goals.filter((g) => g.status === "ACHIEVED");

  return (
    <Shell>
      <div className="py-10 px-6 md:px-10">
        <div className="mx-auto max-w-[700px]">
          {/* Header */}
          <div className="mb-8 flex items-baseline justify-between">
            <h1 className="font-display text-3xl md:text-4xl font-bold">My goals</h1>
            <span className="text-[11px] uppercase tracking-wider font-medium text-text-secondary">
              shared with your coach · {active.length} active
            </span>
          </div>

          {/* Set a new goal */}
          {adding ? (
            <div className="bg-surface rounded-card shadow-card p-5 mb-8">
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                What do you want to work toward?
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Play River Flows start to finish"
                maxLength={120}
                autoFocus
                className="w-full border border-charcoal/15 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-charcoal/20 focus:outline-none"
              />
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="by when? (optional — e.g. by the June recital)"
                maxLength={80}
                className="w-full border border-charcoal/15 rounded-lg px-4 py-2.5 text-sm mt-2.5 focus:ring-2 focus:ring-charcoal/20 focus:outline-none"
              />
              <p className="text-[11px] text-text-secondary mt-2 italic">
                New goals are shared with your teacher so you can plan how to approach them together.
              </p>
              <div className="flex items-center justify-end gap-3 mt-3">
                <button
                  onClick={() => { setAdding(false); setTitle(""); setTarget(""); }}
                  className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors"
                >
                  cancel
                </button>
                <button
                  onClick={createGoal}
                  disabled={!title.trim() || saving}
                  className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
                >
                  {saving ? "Setting…" : "Set goal"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full text-[13px] font-medium text-cream bg-iris px-5 py-3 rounded-card hover:bg-iris-hover transition-colors mb-8"
            >
              + Set a new goal
            </button>
          )}

          {error && <p className="text-[12px] text-coral mb-4">{error}</p>}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
            </div>
          ) : goals.length === 0 ? (
            <p className="text-sm text-text-secondary text-center py-10">
              No goals yet — set one above and your coach will help you plan it.
            </p>
          ) : (
            <div className="space-y-6">
              {newGoals.length > 0 && (
                <section>
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                    New · to discuss
                  </h2>
                  <div className="space-y-3">
                    {newGoals.map((g) => (
                      <GoalCard key={g.id} goal={g} onEdit={() => setAdding(true)} />
                    ))}
                  </div>
                </section>
              )}

              {inProgress.length > 0 && (
                <section>
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                    In progress
                  </h2>
                  <div className="space-y-3">
                    {inProgress.map((g) => (
                      <div key={g.id}>
                        <GoalCard
                          goal={g}
                          onLogProgress={() => {
                            setProgressFor(g.id);
                            setProgressVal(g.progressPct);
                          }}
                          onAchieve={() => patchGoal(g.id, { status: "ACHIEVED" })}
                        />
                        {progressFor === g.id && (
                          <div className="bg-surface rounded-card shadow-card p-4 mt-1 flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={progressVal}
                              onChange={(e) => setProgressVal(Number(e.target.value))}
                              className="grow accent-iris"
                            />
                            <span className="text-[12px] text-text-secondary w-10 text-right">{progressVal}%</span>
                            <button
                              onClick={() => { patchGoal(g.id, { progressPct: progressVal }); setProgressFor(null); }}
                              className="text-[12px] font-medium text-cream bg-iris px-3 py-1.5 rounded-card hover:bg-iris-hover transition-colors"
                            >
                              save
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {achieved.length > 0 && (
                <section>
                  <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                    Achieved · {achieved.length}
                  </h2>
                  <div className="space-y-2">
                    {achieved.map((g) => (
                      <div
                        key={g.id}
                        className="bg-warm-gray/40 rounded-card px-4 py-2.5 flex items-center gap-2"
                      >
                        <span className="text-sage">✓</span>
                        <span className="grow text-sm text-charcoal">{g.title}</span>
                        <span className="text-[11px] text-text-secondary">
                          {g.achievedAt
                            ? new Date(g.achievedAt).toLocaleDateString("en-US", { month: "short" })
                            : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
