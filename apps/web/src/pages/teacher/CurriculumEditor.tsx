import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { apiFetch } from "@/lib/api";
import { SkillNode, type SkillNodeData } from "@/components/curriculum/SkillNode";
import type { CurriculumPublic } from "@sunbird/shared";

type LessonTypeOption = { id: string; title: string };

let nodeCounter = 0;
function newNodeId() {
  return `node_${Date.now()}_${++nodeCounter}`;
}
function newEdgeId() {
  return `edge_${Date.now()}_${++nodeCounter}`;
}

const nodeTypes = { skill: SkillNode };

const COLORS = [
  { value: "iris", label: "Purple", bg: "bg-iris" },
  { value: "gold", label: "Gold", bg: "bg-gold" },
  { value: "sage", label: "Green", bg: "bg-sage" },
  { value: "coral", label: "Red", bg: "bg-coral" },
];

export function CurriculumEditor() {
  const [lessonTypes, setLessonTypes] = useState<LessonTypeOption[]>([]);
  const [selectedLessonTypeId, setSelectedLessonTypeId] = useState<string>("");
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load coach's lesson types
  useEffect(() => {
    apiFetch<{ data: { lessonTypeIds: string[]; allLessonTypes: LessonTypeOption[] } }>("/api/coach-settings")
      .then((res) => {
        const teaching = res.data.allLessonTypes.filter((lt) =>
          res.data.lessonTypeIds.includes(lt.id),
        );
        setLessonTypes(teaching);
        if (teaching.length > 0) setSelectedLessonTypeId(teaching[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load curriculum when lesson type changes
  useEffect(() => {
    if (!selectedLessonTypeId) return;
    apiFetch<{ data: CurriculumPublic }>(`/api/curriculum/${selectedLessonTypeId}`)
      .then((res) => {
        const c = res.data;
        setCurriculumId(c.id);
        setNodes(
          c.nodes.map((n) => ({
            id: n.id,
            type: "skill",
            position: { x: n.positionX, y: n.positionY },
            data: { title: n.title, description: n.description, color: n.color } as SkillNodeData,
          })),
        );
        setEdges(
          c.edges.map((e) => ({
            id: e.id,
            source: e.fromNodeId,
            target: e.toNodeId,
            type: "smoothstep",
          })),
        );
      })
      .catch(() => {
        setCurriculumId(null);
        setNodes([]);
        setEdges([]);
      });
  }, [selectedLessonTypeId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  );

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, id: newEdgeId(), type: "smoothstep" }, eds)),
    [],
  );

  const addNode = () => {
    const id = newNodeId();
    const newNode: Node = {
      id,
      type: "skill",
      position: { x: 250, y: nodes.length * 120 + 50 },
      data: { title: "New Skill", description: "", color: "iris" } as SkillNodeData,
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const createCurriculum = async () => {
    try {
      const res = await apiFetch<{ data: CurriculumPublic }>("/api/curriculum", {
        method: "POST",
        body: JSON.stringify({ lessonTypeId: selectedLessonTypeId }),
      });
      setCurriculumId(res.data.id);
      setNodes([]);
      setEdges([]);
      setStatus("Curriculum created");
    } catch {}
  };

  const saveGraph = async () => {
    if (!curriculumId) return;
    setSaving(true);
    setStatus(null);
    try {
      const payload = {
        nodes: nodes.map((n) => ({
          id: n.id,
          title: (n.data as SkillNodeData).title,
          description: (n.data as SkillNodeData).description || undefined,
          positionX: n.position.x,
          positionY: n.position.y,
          color: (n.data as SkillNodeData).color || undefined,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          fromNodeId: e.source,
          toNodeId: e.target,
        })),
      };
      await apiFetch(`/api/curriculum/${curriculumId}/graph`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setStatus("Saved");
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      setStatus(err?.body?.error ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const updateSelectedNode = (field: string, value: string) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, [field]: value } } : n,
      ),
    );
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, [field]: value } } : prev,
    );
  };

  const deleteSelected = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  const onNodeClick = useCallback((_: any, node: Node) => setSelectedNode(node), []);

  const selectedData = selectedNode?.data as SkillNodeData | undefined;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="shrink-0 border-b border-charcoal/10 bg-surface px-6 py-3 flex items-center gap-4">
        <Link
          to="/coach"
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
        >
          &larr;
        </Link>
        <h1 className="font-display text-lg font-bold">Curriculum</h1>

        <select
          value={selectedLessonTypeId}
          onChange={(e) => setSelectedLessonTypeId(e.target.value)}
          className="ml-4 px-3 py-1.5 text-sm border border-charcoal/10 rounded-card bg-cream"
        >
          {lessonTypes.map((lt) => (
            <option key={lt.id} value={lt.id}>{lt.title}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-3">
          {status && (
            <span className={`text-[12px] ${status === "Saved" ? "text-sage" : "text-coral"}`}>
              {status}
            </span>
          )}
          {curriculumId ? (
            <>
              <button
                onClick={addNode}
                className="text-[13px] font-medium text-charcoal border border-charcoal/20 px-4 py-1.5 rounded-card hover:border-charcoal/40 transition-colors"
              >
                + Add Skill
              </button>
              <button
                onClick={saveGraph}
                disabled={saving}
                className="text-[13px] font-medium text-cream bg-iris px-5 py-1.5 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <button
              onClick={createCurriculum}
              className="text-[13px] font-medium text-cream bg-iris px-5 py-1.5 rounded-card hover:bg-iris-hover transition-colors"
            >
              Create Curriculum
            </button>
          )}
        </div>
      </div>

      {/* Canvas + side panel */}
      <div className="flex-1 flex">
        <div className="flex-1 relative">
          {curriculumId ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedNode(null)}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode="Delete"
            >
              <Background gap={20} size={1} color="#E5E2DC" />
              <MiniMap
                nodeColor="#7C6DEB"
                maskColor="rgba(248,246,241,0.7)"
                className="!bg-cream !border-charcoal/10"
              />
              <Controls className="!bg-surface !border-charcoal/10 !shadow-card" />
            </ReactFlow>
          ) : (
            <div className="flex items-center justify-center h-full text-text-secondary">
              {lessonTypes.length === 0
                ? "Set up your lesson types in Settings first."
                : "Create a curriculum to get started."}
            </div>
          )}
        </div>

        {/* Node edit panel */}
        {selectedNode && selectedData && (
          <div className="w-72 shrink-0 border-l border-charcoal/10 bg-surface p-5 space-y-4 overflow-y-auto">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
              Edit Skill
            </h3>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Title</label>
              <input
                type="text"
                value={selectedData.title}
                onChange={(e) => updateSelectedNode("title", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Description</label>
              <textarea
                value={selectedData.description ?? ""}
                onChange={(e) => updateSelectedNode("description", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Color</label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => updateSelectedNode("color", c.value)}
                    className={`w-7 h-7 rounded-full ${c.bg} ${
                      selectedData.color === c.value ? "ring-2 ring-offset-2 ring-charcoal" : ""
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={deleteSelected}
              className="text-[12px] font-medium text-coral hover:text-coral/80 transition-colors"
            >
              Delete this skill
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
