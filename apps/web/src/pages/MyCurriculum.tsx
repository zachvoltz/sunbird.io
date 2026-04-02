import { useState, useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiFetch } from "@/lib/api";
import type { CurriculumWithProgress } from "@sunbird/shared";
import { SkillNode } from "@/components/curriculum/SkillNode";

const nodeTypes = { skill: SkillNode };

function ProgressNode({ data, selected }: any) {
  const completedSet: Set<string> = data._completedNodeIds;
  const prereqs: string[] = data._prereqNodeIds ?? [];
  const isCompleted = completedSet.has(data._nodeId);
  const isLocked = prereqs.length > 0 && !prereqs.every((p: string) => completedSet.has(p));

  let borderClass = "";
  let opacityClass = "";
  if (isCompleted) borderClass = "ring-2 ring-sage";
  else if (isLocked) opacityClass = "opacity-40";
  else borderClass = "ring-2 ring-iris/50";

  return (
    <div className={`${opacityClass}`}>
      <div className={`bg-surface rounded-card shadow-card w-48 overflow-hidden ${borderClass}`}>
        <div className={`h-1 ${isCompleted ? "bg-sage" : isLocked ? "bg-warm-gray" : "bg-iris"}`} />
        <div className="p-3">
          <div className="flex items-center gap-1.5">
            {isCompleted && <span className="text-sage text-xs">✓</span>}
            <p className="font-display text-sm font-semibold text-charcoal leading-tight">
              {data.title || "Untitled"}
            </p>
          </div>
          {data.description && (
            <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">
              {data.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const progressNodeTypes = { skill: ProgressNode };

export function MyCurriculum() {
  const { slug } = useParams<{ slug: string }>();
  const [curriculum, setCurriculum] = useState<CurriculumWithProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    // Try resolving via category first, then fall back to lesson type
    apiFetch<{ data: { id: string; title: string } }>(`/api/categories/${slug}`)
      .then((res) =>
        apiFetch<{ data: CurriculumWithProgress }>(`/api/skill-trees/for-student/${res.data.id}`),
      )
      .then((res) => setCurriculum(res.data))
      .catch(() => {
        // Fall back to legacy lesson type -> curriculum path
        apiFetch<{ data: { id: string; title: string } }>(`/api/lessons/${slug}`)
          .then((res) =>
            apiFetch<{ data: CurriculumWithProgress }>(`/api/curriculum/for-student/${res.data.id}`),
          )
          .then((res) => setCurriculum(res.data))
          .catch((err: any) => setError(err?.body?.error ?? "Curriculum not available"));
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const completedNodeIds = useMemo(
    () => new Set(curriculum?.progress.map((p) => p.nodeId) ?? []),
    [curriculum],
  );

  // Build prereq map: nodeId -> array of prerequisite nodeIds
  const prereqMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of curriculum?.edges ?? []) {
      const existing = map.get(edge.toNodeId) ?? [];
      existing.push(edge.fromNodeId);
      map.set(edge.toNodeId, existing);
    }
    return map;
  }, [curriculum]);

  const nodes: Node[] = useMemo(
    () =>
      (curriculum?.nodes ?? []).map((n) => ({
        id: n.id,
        type: "skill",
        position: { x: n.positionX, y: n.positionY },
        data: {
          title: n.title,
          description: n.description,
          _nodeId: n.id,
          _completedNodeIds: completedNodeIds,
          _prereqNodeIds: prereqMap.get(n.id) ?? [],
        },
        draggable: false,
        selectable: false,
      })),
    [curriculum, completedNodeIds, prereqMap],
  );

  const edges: Edge[] = useMemo(
    () =>
      (curriculum?.edges ?? []).map((e) => ({
        id: e.id,
        source: e.fromNodeId,
        target: e.toNodeId,
        type: "smoothstep",
        animated: false,
      })),
    [curriculum],
  );

  const totalNodes = curriculum?.nodes.length ?? 0;
  const completedCount = completedNodeIds.size;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !curriculum) {
    return (
      <div className="py-16 px-6 md:px-10">
        <div className="mx-auto max-w-[700px] text-center">
          <h1 className="font-display text-3xl font-bold mb-4">
            {error ?? "Curriculum not available"}
          </h1>
          <Link to="/my-bookings" className="text-sm text-iris hover:text-iris-hover transition-colors">
            Back to my bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="shrink-0 border-b border-charcoal/10 bg-surface px-6 py-3 flex items-center gap-4">
        <Link
          to="/my-bookings"
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
        >
          &larr;
        </Link>
        <h1 className="font-display text-lg font-bold">My Learning Roadmap</h1>
        <span className="ml-auto text-[12px] font-mono text-text-secondary">
          {completedCount} / {totalNodes} skills
        </span>
      </div>

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={progressNodeTypes}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
        >
          <Background gap={20} size={1} color="#E5E2DC" />
          <Controls className="!bg-surface !border-charcoal/10 !shadow-card" />
        </ReactFlow>
      </div>
    </div>
  );
}
