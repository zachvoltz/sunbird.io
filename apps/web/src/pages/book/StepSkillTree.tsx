import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { BookingState, SkillTreeOption } from "./BookPage";

type Props = {
  state: BookingState;
  update: (partial: Partial<BookingState>) => void;
};

export function StepSkillTree({ state, update }: Props) {
  const [trees, setTrees] = useState<SkillTreeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTreeId, setExpandedTreeId] = useState<string | null>(null);

  useEffect(() => {
    if (!state.selectedCategory) {
      setLoading(false);
      return;
    }

    // Fetch all skill trees for this category (across all coaches)
    apiFetch<{ data: any }>(
      `/api/skill-trees/preview/${state.selectedCategory.slug}`,
    )
      .then((res) => {
        if (res.data) {
          setTrees([{
            id: res.data.id,
            title: res.data.title ?? state.selectedCategory!.title,
            description: res.data.description ?? null,
            nodeCount: res.data.nodes?.length ?? 0,
            nodes: (res.data.nodes ?? []).map((n: any) => ({ id: n.id, title: n.title })),
          }]);
        }
      })
      .catch(() => setTrees([]))
      .finally(() => setLoading(false));
  }, [state.selectedCategory]);

  const selectTree = (treeId: string, nodeId?: string) => {
    update({
      selectedSkillTreeId: treeId,
      selectedNodeId: nodeId ?? null,
      notSureSkillTree: false,
      skillTrees: trees,
      step: 3,
    });
  };

  const selectNotSure = () => {
    update({
      selectedSkillTreeId: null,
      selectedNodeId: null,
      notSureSkillTree: true,
      step: 3,
    });
  };

  const categoryName = state.selectedCategory?.title ?? "this category";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
        Choose a focus
      </h2>
      <p className="text-text-secondary mb-10">
        Pick a skill tree to work on in {categoryName}, or choose "open" for a general session.
      </p>

      <div className="space-y-3">
        {trees.map((tree) => (
          <div key={tree.id} className="bg-surface rounded-card shadow-card overflow-hidden">
            <button
              onClick={() => {
                if (tree.nodes.length > 0) {
                  setExpandedTreeId(expandedTreeId === tree.id ? null : tree.id);
                } else {
                  selectTree(tree.id);
                }
              }}
              className="w-full text-left p-6 hover:bg-warm-gray/10 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-semibold">
                    {tree.title}
                  </h3>
                  {tree.description && (
                    <p className="text-sm text-text-secondary mt-0.5">{tree.description}</p>
                  )}
                  <p className="text-[11px] text-iris mt-1">{tree.nodeCount} skills</p>
                </div>
                {tree.nodes.length > 0 && (
                  <span className="text-text-secondary text-sm">
                    {expandedTreeId === tree.id ? "▲" : "▼"}
                  </span>
                )}
              </div>
            </button>

            {expandedTreeId === tree.id && tree.nodes.length > 0 && (
              <div className="border-t border-charcoal/5 px-6 py-3 space-y-1">
                <button
                  onClick={() => selectTree(tree.id)}
                  className="w-full text-left py-2 px-3 rounded text-sm font-medium text-iris hover:bg-iris/5 transition-colors"
                >
                  Work on this skill tree (open)
                </button>
                {tree.nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => selectTree(tree.id, node.id)}
                    className="w-full text-left py-2 px-3 rounded text-sm text-charcoal hover:bg-warm-gray/20 transition-colors"
                  >
                    {node.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={selectNotSure}
        className="mt-4 w-full p-5 text-left border border-charcoal/10 rounded-card hover:border-charcoal/25 transition-colors"
      >
        <h3 className="font-display text-lg font-semibold mb-1">
          Not sure / Open
        </h3>
        <p className="text-sm text-text-secondary">
          We'll figure out what to work on together.
        </p>
      </button>
    </>
  );
}
