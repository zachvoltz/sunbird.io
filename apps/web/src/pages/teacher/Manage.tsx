import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "@/lib/api";
import type { CategoryPublic } from "@sunbird/shared";

type SkillTreeSummary = {
  id: string;
  title: string;
  description: string | null;
  nodeCount: number;
};

type Tab = "categories" | "skills";

export function CoachManage() {
  const [tab, setTab] = useState<Tab>("categories");

  // Categories state
  const [allCategories, setAllCategories] = useState<CategoryPublic[]>([]);
  const [myCategories, setMyCategories] = useState<string[]>([]);
  const [showCatForm, setShowCatForm] = useState(false);
  const [catSlug, setCatSlug] = useState("");
  const [catTitle, setCatTitle] = useState("");
  const [catSubtitle, setCatSubtitle] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Skill trees state
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [skillTrees, setSkillTrees] = useState<SkillTreeSummary[]>([]);
  const [showTreeForm, setShowTreeForm] = useState(false);
  const [treeTitle, setTreeTitle] = useState("");
  const [treeDesc, setTreeDesc] = useState("");
  const [treeSaving, setTreeSaving] = useState(false);

  const [loading, setLoading] = useState(true);

  // Load categories + coach's assignments
  const loadData = async () => {
    try {
      const [catRes, settingsRes] = await Promise.all([
        apiFetch<{ data: CategoryPublic[] }>("/api/categories"),
        apiFetch<{ data: { categoryIds?: string[] } }>("/api/coach-settings"),
      ]);
      setAllCategories(catRes.data);
      setMyCategories(settingsRes.data.categoryIds ?? []);
      if (catRes.data.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(catRes.data[0].id);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Load skill trees when category changes
  useEffect(() => {
    if (!selectedCategoryId) { setSkillTrees([]); return; }
    apiFetch<{ data: SkillTreeSummary[] }>(`/api/skill-trees/by-category/${selectedCategoryId}`)
      .then((res) => setSkillTrees(res.data))
      .catch(() => setSkillTrees([]));
  }, [selectedCategoryId]);

  // Create category
  const createCategory = async () => {
    if (!catTitle.trim() || !catDescription.trim()) return;
    setCatSaving(true);
    setCatError(null);
    try {
      const slug = catSlug.trim() || catTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await apiFetch("/api/categories", {
        method: "POST",
        body: JSON.stringify({ slug, title: catTitle.trim(), subtitle: catSubtitle.trim() || undefined, description: catDescription.trim() }),
      });

      setCatTitle(""); setCatSlug(""); setCatSubtitle(""); setCatDescription("");
      setShowCatForm(false);
      await loadData();
    } catch (err: any) {
      setCatError(err?.body?.error ?? "Failed to create category");
    } finally {
      setCatSaving(false);
    }
  };

  // Toggle category assignment
  const toggleCategory = async (categoryId: string) => {
    const next = myCategories.includes(categoryId)
      ? myCategories.filter((id) => id !== categoryId)
      : [...myCategories, categoryId];
    setMyCategories(next);
    try {
      await apiFetch("/api/coach-settings/categories", {
        method: "PUT",
        body: JSON.stringify({ categoryIds: next }),
      });
    } catch {}
  };

  // Create skill tree
  const createSkillTree = async () => {
    if (!treeTitle.trim() || !selectedCategoryId) return;
    setTreeSaving(true);
    try {
      await apiFetch("/api/skill-trees", {
        method: "POST",
        body: JSON.stringify({ categoryId: selectedCategoryId, title: treeTitle.trim(), description: treeDesc.trim() || undefined }),
      });
      setTreeTitle(""); setTreeDesc(""); setShowTreeForm(false);
      // Reload trees
      const res = await apiFetch<{ data: SkillTreeSummary[] }>(`/api/skill-trees/by-category/${selectedCategoryId}`);
      setSkillTrees(res.data);
    } catch {} finally {
      setTreeSaving(false);
    }
  };

  // Delete skill tree
  const deleteSkillTree = async (id: string) => {
    if (!confirm("Delete this skill tree and all its nodes?")) return;
    try {
      await apiFetch(`/api/skill-trees/${id}`, { method: "DELETE" });
      setSkillTrees((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[800px]">
        <Link
          to="/coach/roster"
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
        >
          &larr; Dashboard
        </Link>

        <h1 className="font-display text-3xl md:text-4xl font-bold mt-8 mb-8">
          Manage
        </h1>

        {/* Tabs */}
        <div className="flex border-b border-warm-gray mb-10">
          <button
            onClick={() => setTab("categories")}
            className={`pb-3 px-1 mr-8 text-sm font-medium tracking-wide transition-colors ${
              tab === "categories"
                ? "text-charcoal border-b-2 border-charcoal"
                : "text-text-secondary hover:text-charcoal"
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setTab("skills")}
            className={`pb-3 px-1 text-sm font-medium tracking-wide transition-colors ${
              tab === "skills"
                ? "text-charcoal border-b-2 border-charcoal"
                : "text-text-secondary hover:text-charcoal"
            }`}
          >
            Skill Trees
          </button>
        </div>

        {/* Categories Tab */}
        {tab === "categories" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-text-secondary">
                Categories are shared across all coaches. Check the ones you teach.
              </p>
              {!showCatForm && (
                <button
                  onClick={() => setShowCatForm(true)}
                  className="text-[13px] font-medium text-iris hover:text-iris-hover transition-colors shrink-0"
                >
                  + New Category
                </button>
              )}
            </div>

            {showCatForm && (
              <div className="bg-surface rounded-card shadow-card p-6 mb-6 space-y-3">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                  Create Category
                </h3>
                <input
                  value={catTitle}
                  onChange={(e) => setCatTitle(e.target.value)}
                  placeholder="Title (e.g., Voice)"
                  className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
                />
                <input
                  value={catSubtitle}
                  onChange={(e) => setCatSubtitle(e.target.value)}
                  placeholder="Subtitle (optional)"
                  className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
                />
                <textarea
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  placeholder="Description"
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none resize-none"
                />
                <input
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="URL slug (auto-generated if empty)"
                  className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
                />
                {catError && <p className="text-coral text-xs">{catError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={createCategory}
                    disabled={catSaving || !catTitle.trim() || !catDescription.trim()}
                    className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
                  >
                    {catSaving ? "Creating..." : "Create"}
                  </button>
                  <button onClick={() => setShowCatForm(false)} className="text-[13px] text-text-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {allCategories.map((cat) => (
                <div key={cat.id} className="bg-surface rounded-card shadow-card p-5 flex items-center gap-4">
                  <input
                    type="checkbox"
                    checked={myCategories.includes(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-4 h-4 rounded border-warm-gray text-iris focus:ring-iris/20"
                  />
                  <div className="flex-1">
                    <h3 className="font-display text-base font-semibold">{cat.title}</h3>
                    {cat.subtitle && <p className="text-sm text-text-secondary">{cat.subtitle}</p>}
                  </div>
                </div>
              ))}
              {allCategories.length === 0 && !showCatForm && (
                <p className="text-text-secondary text-sm py-8 text-center">
                  No categories yet. Create one to get started.
                </p>
              )}
            </div>
          </>
        )}

        {/* Skill Trees Tab */}
        {tab === "skills" && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="px-3 py-2 text-sm border border-charcoal/10 rounded-card bg-cream"
              >
                {allCategories.filter((c) => myCategories.includes(c.id)).length === 0 && (
                  <option value="">Select a category you teach first</option>
                )}
                {allCategories
                  .filter((c) => myCategories.includes(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
              </select>
              {selectedCategoryId && !showTreeForm && (
                <button
                  onClick={() => setShowTreeForm(true)}
                  className="text-[13px] font-medium text-iris hover:text-iris-hover transition-colors"
                >
                  + New Skill Tree
                </button>
              )}
            </div>

            {showTreeForm && (
              <div className="bg-surface rounded-card shadow-card p-6 mb-6 space-y-3">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
                  Create Skill Tree
                </h3>
                <input
                  value={treeTitle}
                  onChange={(e) => setTreeTitle(e.target.value)}
                  placeholder="Title (e.g., Breath Control)"
                  className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
                />
                <textarea
                  value={treeDesc}
                  onChange={(e) => setTreeDesc(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none resize-none"
                />
                <div className="flex gap-3">
                  <button
                    onClick={createSkillTree}
                    disabled={treeSaving || !treeTitle.trim()}
                    className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
                  >
                    {treeSaving ? "Creating..." : "Create"}
                  </button>
                  <button onClick={() => setShowTreeForm(false)} className="text-[13px] text-text-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {!selectedCategoryId ? (
              <p className="text-text-secondary text-sm py-8 text-center">
                Select a category above, or go to the Categories tab to assign one.
              </p>
            ) : skillTrees.length === 0 && !showTreeForm ? (
              <p className="text-text-secondary text-sm py-8 text-center">
                No skill trees in this category yet.
              </p>
            ) : (
              <div className="space-y-3">
                {skillTrees.map((tree) => (
                  <div key={tree.id} className="bg-surface rounded-card shadow-card p-5 flex items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-display text-base font-semibold">{tree.title}</h3>
                      {tree.description && <p className="text-sm text-text-secondary">{tree.description}</p>}
                      <p className="text-[11px] text-iris mt-1">{tree.nodeCount} skills</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Link
                        to={`/coach/curriculum?skillTreeId=${tree.id}`}
                        className="text-[12px] font-medium text-iris hover:text-iris-hover transition-colors"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => deleteSkillTree(tree.id)}
                        className="text-[11px] text-text-secondary hover:text-coral transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
