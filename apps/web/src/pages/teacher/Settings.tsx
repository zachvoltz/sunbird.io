import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { CoachAvailabilitySlot } from "@sunbird/shared";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

type CategoryOption = { id: string; title: string };

type CoachSettingsData = {
  slug: string | null;
  headline: string | null;
  longBio: string | null;
  coverImageUrl: string | null;
  credentials: string | null;
  socialLinks: string | null;
  isPublished: boolean;
  sessionAddress: string | null;
  zoomConnected: boolean;
  availability: CoachAvailabilitySlot[];
  categoryIds: string[];
  allCategories: CategoryOption[];
};

export function CoachSettings() {
  const [settings, setSettings] = useState<CoachSettingsData | null>(null);
  const [address, setAddress] = useState("");

  // Profile state
  const [slug, setSlug] = useState("");
  const [headline, setHeadline] = useState("");
  const [longBio, setLongBio] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [credentials, setCredentials] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [availabilityByDay, setAvailabilityByDay] = useState<Record<number, Set<string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const zoomStatus = searchParams.get("zoom");
  const error = searchParams.get("error");
  const errorDetail = searchParams.get("detail");

  useEffect(() => {
    apiFetch<{ data: CoachSettingsData }>("/api/coach-settings")
      .then((res) => {
        setSettings(res.data);
        setAddress(res.data.sessionAddress ?? "");
        setSlug(res.data.slug ?? "");
        setHeadline(res.data.headline ?? "");
        setLongBio(res.data.longBio ?? "");
        setCoverImageUrl(res.data.coverImageUrl ?? "");
        setCredentials(res.data.credentials ?? "");
        setSocialLinks(res.data.socialLinks ?? "");
        setIsPublished(res.data.isPublished ?? false);
        setSelectedCategoryIds(res.data.categoryIds);

        // Build availability map: dayOfWeek -> Set of startTime strings
        const byDay: Record<number, Set<string>> = {};
        for (let d = 0; d <= 6; d++) byDay[d] = new Set();
        for (const slot of res.data.availability) {
          byDay[slot.dayOfWeek]?.add(slot.startTime);
        }
        setAvailabilityByDay(byDay);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const showSaved = (section: string) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection(null), 3000);
  };

  const saveAddress = async () => {
    setSaving("address");
    try {
      await apiFetch("/api/coach-settings", {
        method: "PATCH",
        body: JSON.stringify({ sessionAddress: address || undefined }),
      });
      showSaved("address");
    } catch {} finally { setSaving(null); }
  };

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const saveCategories = async () => {
    setSaving("categories");
    try {
      await apiFetch("/api/coach-settings/categories", {
        method: "PUT",
        body: JSON.stringify({ categoryIds: selectedCategoryIds }),
      });
      showSaved("categories");
    } catch {} finally { setSaving(null); }
  };

  const toggleHour = (day: number, hour: string) => {
    setAvailabilityByDay((prev) => {
      const next = { ...prev };
      next[day] = new Set(prev[day]);
      if (next[day].has(hour)) {
        next[day].delete(hour);
      } else {
        next[day].add(hour);
      }
      return next;
    });
  };

  const saveAvailability = async () => {
    setSaving("availability");
    const slots: { dayOfWeek: number; startTime: string; endTime: string }[] = [];
    for (let day = 0; day <= 6; day++) {
      for (const hour of availabilityByDay[day] ?? []) {
        const h = parseInt(hour);
        const endH = (h + 1) % 24;
        slots.push({
          dayOfWeek: day,
          startTime: hour,
          endTime: `${String(endH).padStart(2, "0")}:00`,
        });
      }
    }
    try {
      await apiFetch("/api/coach-settings/availability", {
        method: "PUT",
        body: JSON.stringify({ slots }),
      });
      showSaved("availability");
    } catch {} finally { setSaving(null); }
  };

  const disconnectZoom = async () => {
    if (!confirm("Disconnect your Zoom account?")) return;
    try {
      await apiFetch("/api/coach-settings/zoom/disconnect", { method: "POST" });
      setSettings((s) => s ? { ...s, zoomConnected: false } : s);
    } catch {}
  };

  const saveProfile = async () => {
    setSaving("profile");
    try {
      await apiFetch("/api/coach-settings/profile", {
        method: "PATCH",
        body: JSON.stringify({ slug: slug || undefined, headline: headline || undefined, longBio: longBio || undefined, coverImageUrl: coverImageUrl || undefined, credentials: credentials || undefined, socialLinks: socialLinks || undefined }),
      });
      showSaved("profile");
    } catch {} finally { setSaving(null); }
  };

  const togglePublish = async () => {
    try {
      if (isPublished) {
        await apiFetch("/api/coach-settings/unpublish", { method: "POST" });
        setIsPublished(false);
      } else {
        await apiFetch("/api/coach-settings/publish", { method: "POST" });
        setIsPublished(true);
      }
    } catch (err: any) {
      alert(err?.body?.error ?? "Failed to update publish status");
    }
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
          to="/coach"
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
        >
          &larr; Dashboard
        </Link>

        <h1 className="font-display text-3xl md:text-4xl font-bold mt-8 mb-10">
          Settings
        </h1>

        {error === "oauth_failed" && (
          <div className="bg-coral/10 text-coral text-sm px-4 py-3 rounded-lg mb-8">
            Zoom connection failed. {errorDetail && <span className="block mt-1 text-xs opacity-75">{errorDetail}</span>}
          </div>
        )}

        {zoomStatus === "connected" && (
          <div className="bg-sage/10 text-sage text-sm px-4 py-3 rounded-lg mb-8">
            Zoom connected successfully!
          </div>
        )}

        {/* Public Profile */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary">
              Public Profile
            </h2>
            <div className="flex items-center gap-3">
              {slug && (
                <a
                  href={`/coaches/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-medium text-iris hover:text-iris-hover"
                >
                  Preview
                </a>
              )}
              <button
                onClick={togglePublish}
                className={`text-[12px] font-medium px-3 py-1 rounded-card transition-colors ${
                  isPublished
                    ? "text-sage border border-sage/30 hover:bg-sage/10"
                    : "text-text-secondary border border-charcoal/20 hover:border-charcoal/40"
                }`}
              >
                {isPublished ? "Published" : "Publish"}
              </button>
            </div>
          </div>
          <div className="bg-surface rounded-card shadow-card p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">URL Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">/coaches/</span>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="your-name"
                  className="flex-1 px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Headline</label>
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Voice coach & songwriter"
                className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Cover Image URL</label>
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">About (Long Bio)</label>
              <textarea
                value={longBio}
                onChange={(e) => setLongBio(e.target.value)}
                rows={5}
                placeholder="Tell students about yourself, your teaching philosophy, and what makes your lessons special..."
                className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Credentials</label>
              <textarea
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                rows={3}
                placeholder="Degrees, certifications, performance experience..."
                className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Social Links (JSON)</label>
              <input
                value={socialLinks}
                onChange={(e) => setSocialLinks(e.target.value)}
                placeholder='{"instagram": "https://...", "youtube": "https://..."}'
                className="w-full px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveProfile}
                disabled={saving === "profile"}
                className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
              >
                {saving === "profile" ? "Saving..." : "Save Profile"}
              </button>
              {savedSection === "profile" && <span className="text-[12px] text-sage">Saved</span>}
            </div>
          </div>
        </section>

        {/* Categories */}
        {settings?.allCategories && settings.allCategories.length > 0 && (
          <section className="mb-12">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
              Categories I Teach
            </h2>
            <div className="bg-surface rounded-card shadow-card p-6">
              <p className="text-sm text-text-secondary mb-4">
                Select the categories you offer. These replace lesson types for the new booking flow.
              </p>
              <div className="space-y-2 mb-4">
                {settings.allCategories.map((cat) => (
                  <label key={cat.id} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                      className="w-4 h-4 rounded border-warm-gray text-iris focus:ring-iris/20"
                    />
                    <span className="text-sm font-medium">{cat.title}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveCategories}
                  disabled={saving === "categories"}
                  className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
                >
                  {saving === "categories" ? "Saving..." : "Save"}
                </button>
                {savedSection === "categories" && <span className="text-[12px] text-sage">Saved</span>}
              </div>
            </div>
          </section>
        )}

        {/* Weekly Availability */}
        <section className="mb-12">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
            Weekly Availability
          </h2>
          <div className="bg-surface rounded-card shadow-card p-6">
            <p className="text-sm text-text-secondary mb-4">
              Click hours to toggle your availability. Students can only book during these times.
            </p>
            <div className="space-y-4 mb-6">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <div key={day}>
                  <p className="text-[12px] font-medium text-charcoal mb-2">{DAY_NAMES[day]}</p>
                  <div className="flex flex-wrap gap-1">
                    {HOURS.map((hour) => {
                      const isActive = availabilityByDay[day]?.has(hour);
                      const h = parseInt(hour);
                      const label = h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
                      return (
                        <button
                          key={hour}
                          onClick={() => toggleHour(day, hour)}
                          className={`w-10 h-8 text-[10px] font-medium rounded transition-all ${
                            isActive
                              ? "bg-iris text-cream"
                              : "bg-warm-gray/30 text-text-secondary hover:bg-warm-gray/50"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveAvailability}
                disabled={saving === "availability"}
                className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
              >
                {saving === "availability" ? "Saving..." : "Save Availability"}
              </button>
              {savedSection === "availability" && <span className="text-[12px] text-sage">Saved</span>}
            </div>
          </div>
        </section>

        {/* Session Address */}
        <section className="mb-12">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
            Session Address
          </h2>
          <div className="bg-surface rounded-card shadow-card p-6">
            <p className="text-sm text-text-secondary mb-4">
              This address will be shown to students who book in-person lessons.
            </p>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Austin, TX 78701"
              className="w-full px-4 py-2.5 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none transition-colors mb-4"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={saveAddress}
                disabled={saving === "address"}
                className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
              >
                {saving === "address" ? "Saving..." : "Save"}
              </button>
              {savedSection === "address" && <span className="text-[12px] text-sage">Saved</span>}
            </div>
          </div>
        </section>

        {/* Video Platform */}
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
            Video Platform
          </h2>
          <div className="bg-surface rounded-card shadow-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold mb-1">Zoom</h3>
                {settings?.zoomConnected ? (
                  <p className="text-sm text-sage">Connected</p>
                ) : (
                  <p className="text-sm text-text-secondary">
                    Connect your Zoom account to offer online lessons.
                  </p>
                )}
              </div>
              {settings?.zoomConnected ? (
                <button
                  onClick={disconnectZoom}
                  className="text-[12px] font-medium text-coral hover:text-coral/80 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <a
                  href="/api/coach-settings/zoom/connect"
                  className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors inline-block"
                >
                  Connect Zoom
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
