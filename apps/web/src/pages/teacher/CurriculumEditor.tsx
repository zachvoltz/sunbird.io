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
import type { SkillTreeFull, CoachResourcePublic, PracticeDrillPublic, SessionResourceType } from "@sunbird/shared";

type CategoryOption = { id: string; title: string };

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
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [curriculumId, setCurriculumId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Node detail state
  const [nodeResources, setNodeResources] = useState<CoachResourcePublic[]>([]);
  const [nodeDrills, setNodeDrills] = useState<PracticeDrillPublic[]>([]);

  // Resource search state
  const [resSearch, setResSearch] = useState("");
  const [resSearchResults, setResSearchResults] = useState<CoachResourcePublic[]>([]);
  const [showResSearch, setShowResSearch] = useState(false);
  const [showNewResForm, setShowNewResForm] = useState(false);
  const [newResType, setNewResType] = useState<SessionResourceType>("LINK");
  const [newResTitle, setNewResTitle] = useState("");
  const [newResUrl, setNewResUrl] = useState("");

  // Drill state
  const [showDrillForm, setShowDrillForm] = useState(false);
  const [drillTitle, setDrillTitle] = useState("");
  const [drillDesc, setDrillDesc] = useState("");
  const [drillResourceId, setDrillResourceId] = useState("");

  // Load coach's categories
  useEffect(() => {
    apiFetch<{ data: { categoryIds: string[]; allCategories: CategoryOption[] } }>("/api/coach-settings")
      .then((res) => {
        const teachingCats = res.data.allCategories.filter((c) =>
          res.data.categoryIds.includes(c.id),
        );
        setCategories(teachingCats);
        if (teachingCats.length > 0) setSelectedCategoryId(teachingCats[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Load skill tree when category changes
  useEffect(() => {
    if (!selectedCategoryId) return;
    apiFetch<{ data: SkillTreeFull }>(`/api/skill-trees/by-category/${selectedCategoryId}`)
      .then((res) => {
        const c = res.data;
        setCurriculumId(c.id);
        setNodes(
          c.nodes.map((n) => ({
            id: n.id,
            type: "skill",
            position: { x: n.positionX, y: n.positionY },
            data: { title: n.title, description: n.description, color: n.color, resources: n.resources ?? [], drills: n.drills ?? [] } as SkillNodeData,
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
  }, [selectedCategoryId]);

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
      position: { x: 240, y: nodes.length * 120 + 40 },
      data: { title: "New Skill", description: "", color: "iris" } as SkillNodeData,
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const createCurriculum = async () => {
    try {
      const res = await apiFetch<{ data: SkillTreeFull }>("/api/skill-trees", {
        method: "POST",
        body: JSON.stringify({ categoryId: selectedCategoryId }),
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
      await apiFetch(`/api/skill-trees/${curriculumId}/graph`, {
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

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
    const d = node.data as SkillNodeData;
    setNodeResources(d.resources ?? []);
    setNodeDrills(d.drills ?? []);
    setShowResSearch(false);
    setShowNewResForm(false);
    setShowDrillForm(false);
    setResSearch("");
    setResSearchResults([]);
  }, []);

  // Search coach resource library
  const searchResources = async (query: string) => {
    setResSearch(query);
    if (!query.trim()) { setResSearchResults([]); return; }
    try {
      const res = await apiFetch<{ data: CoachResourcePublic[] }>(
        `/api/coach-settings/resources?q=${encodeURIComponent(query)}`,
      );
      // Exclude already-linked resources
      const linkedIds = new Set(nodeResources.map((r) => r.id));
      setResSearchResults(res.data.filter((r) => !linkedIds.has(r.id)));
    } catch {}
  };

  // Link existing resource to node
  const linkResourceToNode = async (resource: CoachResourcePublic) => {
    if (!curriculumId || !selectedNode) return;
    try {
      await apiFetch(
        `/api/skill-trees/${curriculumId}/nodes/${selectedNode.id}/resources`,
        { method: "POST", body: JSON.stringify({ resourceId: resource.id }) },
      );
      setNodeResources((prev) => [...prev, resource]);
      setNodes((nds) => nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, resources: [...(n.data as SkillNodeData).resources ?? [], resource] } } : n,
      ));
      setResSearch(""); setResSearchResults([]); setShowResSearch(false);
    } catch {}
  };

  // Create new resource in library and link to node
  const createAndLinkResource = async () => {
    if (!curriculumId || !selectedNode || !newResTitle.trim() || !newResUrl.trim()) return;
    try {
      // Create in library
      const res = await apiFetch<{ data: CoachResourcePublic }>(
        "/api/coach-settings/resources",
        { method: "POST", body: JSON.stringify({ type: newResType, title: newResTitle.trim(), url: newResUrl.trim() }) },
      );
      // Link to node
      await apiFetch(
        `/api/skill-trees/${curriculumId}/nodes/${selectedNode.id}/resources`,
        { method: "POST", body: JSON.stringify({ resourceId: res.data.id }) },
      );
      setNodeResources((prev) => [...prev, res.data]);
      setNodes((nds) => nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, resources: [...(n.data as SkillNodeData).resources ?? [], res.data] } } : n,
      ));
      setNewResTitle(""); setNewResUrl(""); setNewResType("LINK"); setShowNewResForm(false); setShowResSearch(false);
    } catch {}
  };

  const unlinkResource = async (resourceId: string) => {
    if (!curriculumId || !selectedNode) return;
    try {
      await apiFetch(`/api/skill-trees/${curriculumId}/nodes/${selectedNode.id}/resources/${resourceId}`, { method: "DELETE" });
      setNodeResources((prev) => prev.filter((r) => r.id !== resourceId));
      setNodes((nds) => nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, resources: ((n.data as SkillNodeData).resources ?? []).filter((r: any) => r.id !== resourceId) } } : n,
      ));
    } catch {}
  };

  const addDrill = async () => {
    if (!curriculumId || !selectedNode || !drillTitle.trim()) return;
    try {
      const res = await apiFetch<{ data: PracticeDrillPublic }>(
        `/api/skill-trees/${curriculumId}/nodes/${selectedNode.id}/drills`,
        { method: "POST", body: JSON.stringify({ title: drillTitle.trim(), description: drillDesc.trim() || undefined, resourceId: drillResourceId || undefined }) },
      );
      setNodeDrills((prev) => [...prev, res.data]);
      setNodes((nds) => nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, drills: [...(n.data as SkillNodeData).drills ?? [], res.data] } } : n,
      ));
      setDrillTitle(""); setDrillDesc(""); setDrillResourceId(""); setShowDrillForm(false);
    } catch {}
  };

  const deleteDrill = async (drillId: string) => {
    if (!curriculumId || !selectedNode) return;
    try {
      await apiFetch(`/api/skill-trees/${curriculumId}/nodes/${selectedNode.id}/drills/${drillId}`, { method: "DELETE" });
      setNodeDrills((prev) => prev.filter((d) => d.id !== drillId));
      setNodes((nds) => nds.map((n) =>
        n.id === selectedNode.id ? { ...n, data: { ...n.data, drills: ((n.data as SkillNodeData).drills ?? []).filter((d: any) => d.id !== drillId) } } : n,
      ));
    } catch {}
  };

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
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="ml-4 px-3 py-1.5 text-sm border border-charcoal/10 rounded-card bg-cream"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
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
              snapToGrid
              snapGrid={[20, 20]}
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
              {categories.length === 0
                ? "Set up your categories in Settings first."
                : "Create a curriculum to get started."}
            </div>
          )}
        </div>

        {/* Node edit panel */}
        {selectedNode && selectedData && (
          <div className="w-80 shrink-0 border-l border-charcoal/10 bg-surface p-5 space-y-5 overflow-y-auto">
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
              <label className="block text-sm font-medium text-charcoal mb-1">Summary / Goal</label>
              <textarea
                value={selectedData.description ?? ""}
                onChange={(e) => updateSelectedNode("description", e.target.value)}
                placeholder='e.g. "I can sustain a note for 8 counts with consistent tone"'
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

            {/* Resources */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                  Resources
                </label>
                {!showResSearch && (
                  <button onClick={() => setShowResSearch(true)} className="text-[11px] font-medium text-iris hover:text-iris-hover">
                    + Add
                  </button>
                )}
              </div>

              {/* Search / create combobox */}
              {showResSearch && !showNewResForm && (
                <div className="mb-3">
                  <input
                    value={resSearch}
                    onChange={(e) => searchResources(e.target.value)}
                    placeholder="Search your resources..."
                    autoFocus
                    className="w-full px-2 py-1.5 text-xs bg-cream border border-charcoal/10 rounded mb-1"
                  />
                  {resSearchResults.length > 0 && (
                    <div className="border border-charcoal/10 rounded bg-cream max-h-32 overflow-y-auto">
                      {resSearchResults.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => linkResourceToNode(r)}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-warm-gray/30 flex items-center gap-1.5"
                        >
                          <span>{r.type === "PDF" ? "\u{1F4C4}" : r.type === "AUDIO" ? "\u{1F3B5}" : "\u{1F517}"}</span>
                          <span className="truncate">{r.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {resSearch.trim() && resSearchResults.length === 0 && (
                    <p className="text-[10px] text-text-secondary mt-1">No matches.</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => { setShowNewResForm(true); setNewResTitle(resSearch); }} className="text-[11px] font-medium text-iris hover:text-iris-hover">
                      Create new resource
                    </button>
                    <button onClick={() => { setShowResSearch(false); setResSearch(""); setResSearchResults([]); }} className="text-[11px] text-text-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* New resource form */}
              {showNewResForm && (
                <div className="space-y-2 mb-3 bg-warm-gray/20 rounded-card p-3">
                  <select
                    value={newResType}
                    onChange={(e) => setNewResType(e.target.value as SessionResourceType)}
                    className="w-full px-2 py-1.5 text-xs bg-cream border border-charcoal/10 rounded"
                  >
                    <option value="LINK">Link</option>
                    <option value="PDF">PDF</option>
                    <option value="AUDIO">Audio</option>
                  </select>
                  <input
                    value={newResTitle}
                    onChange={(e) => setNewResTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full px-2 py-1.5 text-xs bg-cream border border-charcoal/10 rounded"
                  />
                  <input
                    value={newResUrl}
                    onChange={(e) => setNewResUrl(e.target.value)}
                    placeholder="URL"
                    className="w-full px-2 py-1.5 text-xs bg-cream border border-charcoal/10 rounded"
                  />
                  <div className="flex gap-2">
                    <button onClick={createAndLinkResource} disabled={!newResTitle.trim() || !newResUrl.trim()} className="text-[11px] font-medium text-cream bg-iris px-3 py-1 rounded hover:bg-iris-hover disabled:opacity-50">Create & Add</button>
                    <button onClick={() => { setShowNewResForm(false); setNewResTitle(""); setNewResUrl(""); }} className="text-[11px] text-text-secondary">Cancel</button>
                  </div>
                </div>
              )}

              {/* Linked resources list */}
              <div className="space-y-1">
                {nodeResources.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 bg-warm-gray/15 px-2 py-1.5 rounded text-xs">
                    <span>{r.type === "PDF" ? "\u{1F4C4}" : r.type === "AUDIO" ? "\u{1F3B5}" : "\u{1F517}"}</span>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate font-medium hover:text-iris">{r.title}</a>
                    <button onClick={() => unlinkResource(r.id)} className="text-coral shrink-0">&times;</button>
                  </div>
                ))}
                {nodeResources.length === 0 && !showResSearch && !showNewResForm && (
                  <p className="text-[11px] text-text-secondary">No resources yet</p>
                )}
              </div>
            </div>

            {/* Practice Drills */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                  Practice Schedule
                </label>
                {!showDrillForm && (
                  <button onClick={() => setShowDrillForm(true)} className="text-[11px] font-medium text-iris hover:text-iris-hover">
                    + Add
                  </button>
                )}
              </div>
              {showDrillForm && (
                <div className="space-y-2 mb-3 bg-warm-gray/20 rounded-card p-3">
                  <input
                    value={drillTitle}
                    onChange={(e) => setDrillTitle(e.target.value)}
                    placeholder="Drill name"
                    className="w-full px-2 py-1.5 text-xs bg-cream border border-charcoal/10 rounded"
                  />
                  <textarea
                    value={drillDesc}
                    onChange={(e) => setDrillDesc(e.target.value)}
                    placeholder="Instructions (optional)"
                    rows={2}
                    className="w-full px-2 py-1.5 text-xs bg-cream border border-charcoal/10 rounded resize-none"
                  />
                  {nodeResources.length > 0 && (
                    <select
                      value={drillResourceId}
                      onChange={(e) => setDrillResourceId(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-cream border border-charcoal/10 rounded"
                    >
                      <option value="">Link to resource (optional)</option>
                      {nodeResources.map((r) => (
                        <option key={r.id} value={r.id}>{r.title}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <button onClick={addDrill} disabled={!drillTitle.trim()} className="text-[11px] font-medium text-cream bg-iris px-3 py-1 rounded hover:bg-iris-hover disabled:opacity-50">Add</button>
                    <button onClick={() => setShowDrillForm(false)} className="text-[11px] text-text-secondary">Cancel</button>
                  </div>
                </div>
              )}
              <div className="space-y-1">
                {nodeDrills.map((d, i) => {
                  const linkedRes = nodeResources.find((r) => r.id === d.resourceId);
                  return (
                    <div key={d.id} className="bg-warm-gray/15 px-2 py-1.5 rounded text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary">{i + 1}.</span>
                        <span className="flex-1 font-medium">{d.title}</span>
                        <button onClick={() => deleteDrill(d.id)} className="text-coral shrink-0">&times;</button>
                      </div>
                      {d.description && <p className="text-text-secondary mt-0.5 ml-4">{d.description}</p>}
                      {linkedRes && (
                        <a href={linkedRes.url} target="_blank" rel="noopener noreferrer" className="text-iris hover:underline ml-4 block mt-0.5">
                          {linkedRes.title}
                        </a>
                      )}
                    </div>
                  );
                })}
                {nodeDrills.length === 0 && !showDrillForm && (
                  <p className="text-[11px] text-text-secondary">No drills yet</p>
                )}
              </div>
            </div>

            <hr className="border-charcoal/10" />
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
