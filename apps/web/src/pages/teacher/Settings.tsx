import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { CoachAvailabilitySlot } from "@sunbird/shared";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

type CoachSettingsData = {
  slug: string | null;
  headline: string | null;
  longBio: string | null;
  coverImageUrl: string | null;
  credentials: string | null;
  socialLinks: string | null;
  isPublished: boolean;
  sessionAddress: string | null;
  availability: CoachAvailabilitySlot[];
};

export function CoachSettings() {
  const [address, setAddress] = useState("");

  // Profile state
  const [slug, setSlug] = useState("");
  const [headline, setHeadline] = useState("");
  const [longBio, setLongBio] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [credentials, setCredentials] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [availabilityByDay, setAvailabilityByDay] = useState<Record<number, Set<string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedSection, setSavedSection] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Upload a cover image to R2 (plain fetch — apiFetch forces JSON which would
  // break the multipart boundary). On success the returned URL replaces the
  // field value; the coach still clicks "Save profile" to persist on the row
  // (the upload already stamps it, but this keeps the form consistent).
  const uploadCover = async (file: File) => {
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const res = await fetch("/api/coach-settings/cover-image", {
        method: "POST", body: fd, credentials: "include",
      });
      const j: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j?.error ?? "Couldn't upload the image.");
        return;
      }
      setCoverImageUrl(j.data.coverImageUrl);
    } catch {
      alert("Couldn't upload the image. Please try again.");
    } finally {
      setUploadingCover(false);
    }
  };

  useEffect(() => {
    apiFetch<{ data: CoachSettingsData }>("/api/coach-settings")
      .then((res) => {
        setAddress(res.data.sessionAddress ?? "");
        setSlug(res.data.slug ?? "");
        setHeadline(res.data.headline ?? "");
        setLongBio(res.data.longBio ?? "");
        setCoverImageUrl(res.data.coverImageUrl ?? "");
        setCredentials(res.data.credentials ?? "");
        setSocialLinks(res.data.socialLinks ?? "");
        setIsPublished(res.data.isPublished ?? false);

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
          to="/coach/roster"
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
        >
          &larr; Dashboard
        </Link>

        <h1 className="font-display text-3xl md:text-4xl font-bold mt-8 mb-10">
          Settings
        </h1>

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
              <label className="block text-sm font-medium text-charcoal mb-1">Cover Image</label>
              {coverImageUrl && (
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  className="w-full h-32 object-cover rounded-card mb-2 border border-charcoal/10"
                />
              )}
              <div className="flex items-center gap-3">
                <label className="text-[13px] font-medium text-charcoal border border-charcoal/30 px-3 py-1.5 rounded-card cursor-pointer hover:bg-charcoal/5 transition-colors">
                  {uploadingCover ? "Uploading…" : coverImageUrl ? "Replace image" : "Upload image"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploadingCover}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }}
                    className="hidden"
                  />
                </label>
                {coverImageUrl && (
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl("")}
                    className="text-[13px] text-text-secondary hover:text-coral transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="…or paste an image URL"
                className="w-full mt-2 px-3 py-2 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none"
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

      </div>
    </div>
  );
}
