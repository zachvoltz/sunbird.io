import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { apiFetch } from "@/lib/api";
import { DTFrame } from "../components/DTFrame";
import { Squiggle } from "../components/Squiggle";
import { Tag } from "../components/Tag";

// Public coach profile editor — was previously a sub-section inside
// Account, split out to its own nav item so billing/plan settings
// don't sit next to the public-facing identity card.

const inputStyle: React.CSSProperties = {
  fontFamily: "var(--hand)",
  fontSize: 14,
  padding: "6px 10px",
  border: "1.5px solid var(--ink-faint)",
  borderRadius: 6,
  background: "var(--paper)",
  color: "var(--ink)",
  outline: "none",
  width: "100%",
  maxWidth: 260,
};

type ProfileState = {
  slug: string;
  headline: string;
  longBio: string;
  credentials: string;
  coverImageUrl: string;
  socialLinks: string;
  isPublished: boolean;
};

type CategoryOption = { id: string; title: string };

const EMPTY_PROFILE: ProfileState = {
  slug: "",
  headline: "",
  longBio: "",
  credentials: "",
  coverImageUrl: "",
  socialLinks: "",
  isPublished: false,
};

function normalizeSlug(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

// QR code for the published public page. Rendered to a PNG data URL so it
// both displays and downloads without any server round-trip.
function PublicQrCode({ url, slug }: { url: string; slug: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { width: 512, margin: 2 })
      .then((d) => alive && setDataUrl(d))
      .catch(() => alive && setDataUrl(null));
    return () => {
      alive = false;
    };
  }, [url]);
  if (!dataUrl) return null;
  return (
    <div className="row gap-3 mt-3" style={{ alignItems: "center" }}>
      <img
        src={dataUrl}
        alt="QR code linking to your public coach page"
        width={120}
        height={120}
        style={{
          border: "1.5px solid var(--ink-faint)",
          borderRadius: 8,
          background: "white",
          flex: "0 0 auto",
        }}
      />
      <div className="col gap-1" style={{ minWidth: 0 }}>
        <div className="small bold">QR code</div>
        <div className="tiny muted" style={{ maxWidth: 240 }}>
          Print it or add it to flyers — scanning opens your public page.
        </div>
        <a
          className="btn small primary"
          href={dataUrl}
          download={`sunbird-${slug || "coach"}-qr.png`}
          style={{ textDecoration: "none", width: "fit-content", marginTop: 2 }}
        >
          ↓ download QR
        </a>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="row between" style={{ alignItems: "baseline" }}>
        <div className="small bold">{label}</div>
        {hint && <div className="tiny muted">{hint}</div>}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ProfilePage() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [saved, setSaved] = useState<ProfileState>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Categories the coach teaches — required before publishing. Selected set is
  // saved separately from the profile fields (PUT /api/coach-settings/categories).
  const [allCategories, setAllCategories] = useState<CategoryOption[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [savedCategoryIds, setSavedCategoryIds] = useState<string[]>([]);
  const [savingCats, setSavingCats] = useState(false);
  const [catsSavedAt, setCatsSavedAt] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{
      data: {
        slug: string | null;
        headline: string | null;
        longBio: string | null;
        credentials: string | null;
        coverImageUrl: string | null;
        socialLinks: string | null;
        isPublished: boolean;
        categoryIds?: string[];
        allCategories?: CategoryOption[];
      };
    }>("/api/coach-settings")
      .then((res) => {
        const next: ProfileState = {
          slug: res.data.slug ?? "",
          headline: res.data.headline ?? "",
          longBio: res.data.longBio ?? "",
          credentials: res.data.credentials ?? "",
          coverImageUrl: res.data.coverImageUrl ?? "",
          socialLinks: res.data.socialLinks ?? "",
          isPublished: !!res.data.isPublished,
        };
        setProfile(next);
        setSaved(next);
        setAllCategories(res.data.allCategories ?? []);
        setSelectedCategoryIds(res.data.categoryIds ?? []);
        setSavedCategoryIds(res.data.categoryIds ?? []);
      })
      .catch(() => { /* leave at defaults */ })
      .finally(() => setLoaded(true));
  }, []);

  const dirty = useMemo(() => {
    return (Object.keys(profile) as Array<keyof ProfileState>).some(
      (k) => k !== "isPublished" && profile[k] !== saved[k],
    );
  }, [profile, saved]);

  const catsDirty = useMemo(() => {
    if (selectedCategoryIds.length !== savedCategoryIds.length) return true;
    const a = [...selectedCategoryIds].sort();
    const b = [...savedCategoryIds].sort();
    return a.some((id, i) => id !== b[i]);
  }, [selectedCategoryIds, savedCategoryIds]);

  const publicUrl = profile.slug
    ? `${window.location.origin}/coaches/${profile.slug}`
    : null;

  const update = <K extends keyof ProfileState>(k: K, v: ProfileState[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  const toggleCategory = (id: string) =>
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const saveCategories = async () => {
    if (savingCats) return;
    setSavingCats(true);
    setError(null);
    try {
      await apiFetch("/api/coach-settings/categories", {
        method: "PUT",
        body: JSON.stringify({ categoryIds: selectedCategoryIds }),
      });
      setSavedCategoryIds([...selectedCategoryIds]);
      setCatsSavedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.body?.error ?? "Couldn't save categories.");
    } finally {
      setSavingCats(false);
    }
  };

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/coach-settings/profile", {
        method: "PATCH",
        body: JSON.stringify({
          slug: profile.slug || undefined,
          headline: profile.headline || undefined,
          longBio: profile.longBio || undefined,
          coverImageUrl: profile.coverImageUrl || undefined,
          credentials: profile.credentials || undefined,
          socialLinks: profile.socialLinks || undefined,
        }),
      });
      setSaved({ ...profile });
      setSavedAt(new Date().toISOString());
    } catch (err: any) {
      setError(err?.body?.error ?? "Couldn't save profile.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (publishing) return;
    setPublishing(true);
    setError(null);
    try {
      if (profile.isPublished) {
        await apiFetch("/api/coach-settings/unpublish", { method: "POST" });
        const next = { ...profile, isPublished: false };
        setProfile(next);
        setSaved((s) => ({ ...s, isPublished: false }));
      } else {
        await apiFetch("/api/coach-settings/publish", { method: "POST" });
        const next = { ...profile, isPublished: true };
        setProfile(next);
        setSaved((s) => ({ ...s, isPublished: true }));
      }
    } catch (err: any) {
      setError(err?.body?.error ?? "Couldn't change publish status.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <DTFrame side="profile">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Profile</h2>
          <div className="dt-sub">
            Your public coach page — what prospective students see before they book.
          </div>
        </div>
        {publicUrl && (
          <div className="row gap-2">
            <a
              href={`/coaches/${profile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn small ghost"
            >
              view ↗
            </a>
          </div>
        )}
      </div>

      <div className="dt-main-body">
        <div
          className="col gap-3"
          style={{ minHeight: 0, overflowY: "auto", maxWidth: 760 }}
        >
          <div className="box">
            <div className="row between">
              <div className="small muted">PUBLIC PROFILE</div>
              <Tag color={profile.isPublished ? "coral" : undefined}>
                {profile.isPublished ? "published" : "draft"}
              </Tag>
            </div>
            <Squiggle w={60} color="var(--ink-faint)" />

            {/* Public URL row */}
            <div className="row between mt-2" style={{ alignItems: "center", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div className="small muted">your public page</div>
                {publicUrl ? (
                  <a
                    href={`/coaches/${profile.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bold"
                    style={{
                      fontFamily: "var(--hand)",
                      fontSize: 15,
                      color: "var(--ink)",
                      wordBreak: "break-all",
                    }}
                  >
                    {publicUrl} ↗
                  </a>
                ) : (
                  <div className="small muted" style={{ fontStyle: "italic" }}>
                    pick a URL slug below to claim your address
                  </div>
                )}
              </div>
              <div className="row gap-2" style={{ flex: "0 0 auto" }}>
                <button
                  className={"btn small" + (profile.isPublished ? " ghost" : " primary")}
                  onClick={togglePublish}
                  disabled={publishing || (!profile.slug && !profile.isPublished)}
                  title={
                    !profile.slug && !profile.isPublished
                      ? "Set a URL slug first"
                      : undefined
                  }
                >
                  {publishing
                    ? "…"
                    : profile.isPublished
                      ? "unpublish"
                      : "publish"}
                </button>
              </div>
            </div>

            {/* QR code — only meaningful once the page is live. */}
            {profile.isPublished && publicUrl && (
              <PublicQrCode url={publicUrl} slug={profile.slug} />
            )}

            <div className="hr-hand mt-3" />

            {/* Form */}
            <div className="col gap-3 mt-2" style={{ opacity: loaded ? 1 : 0.5 }}>
              <Field label="URL slug" hint="lowercase letters, numbers, hyphens">
                <div className="row gap-2" style={{ alignItems: "center" }}>
                  <span className="small muted" style={{ fontFamily: "var(--mono)" }}>
                    /coaches/
                  </span>
                  <input
                    value={profile.slug}
                    onChange={(e) => update("slug", normalizeSlug(e.target.value))}
                    placeholder="your-name"
                    style={{ ...inputStyle, maxWidth: 220 }}
                  />
                </div>
              </Field>

              <Field label="Headline" hint="one line, shown beneath your name">
                <input
                  value={profile.headline}
                  onChange={(e) => update("headline", e.target.value)}
                  placeholder="e.g. Voice coach & songwriter"
                  style={{ ...inputStyle, maxWidth: "100%" }}
                />
              </Field>

              <Field label="About" hint="your teaching philosophy, what students should expect">
                <textarea
                  value={profile.longBio}
                  onChange={(e) => update("longBio", e.target.value)}
                  placeholder="Tell students about yourself, your approach…"
                  rows={4}
                  style={{ ...inputStyle, maxWidth: "100%", resize: "vertical" }}
                />
              </Field>

              <Field label="Credentials" hint="degrees, certifications, performances">
                <textarea
                  value={profile.credentials}
                  onChange={(e) => update("credentials", e.target.value)}
                  placeholder="MM Vocal Performance, Eastman · 10 years private studio · …"
                  rows={3}
                  style={{ ...inputStyle, maxWidth: "100%", resize: "vertical" }}
                />
              </Field>

              <Field label="Cover image URL" hint="a wide image for the top of your page">
                <input
                  value={profile.coverImageUrl}
                  onChange={(e) => update("coverImageUrl", e.target.value)}
                  placeholder="https://…"
                  style={{ ...inputStyle, maxWidth: "100%" }}
                />
              </Field>

              <Field label="Social links" hint="JSON: e.g. {&quot;instagram&quot;: &quot;https://…&quot;}">
                <input
                  value={profile.socialLinks}
                  onChange={(e) => update("socialLinks", e.target.value)}
                  placeholder={`{"instagram": "https://…", "youtube": "https://…"}`}
                  style={{ ...inputStyle, maxWidth: "100%", fontFamily: "var(--mono)", fontSize: 12 }}
                />
              </Field>
            </div>

            <div className="row between mt-3" style={{ alignItems: "center" }}>
              <div className="small">
                {error && <span style={{ color: "var(--accent)" }}>{error}</span>}
                {!error && savedAt && !dirty && (
                  <span className="muted">saved · {new Date(savedAt).toLocaleTimeString()}</span>
                )}
              </div>
              <button
                onClick={saveProfile}
                disabled={saving || !dirty}
                className="btn small primary"
              >
                {saving ? "saving…" : dirty ? "save profile" : "saved"}
              </button>
            </div>
          </div>

          {/* Categories — required before publishing; also power the booking flow. */}
          <div className="box">
            <div className="row between">
              <div className="small muted">CATEGORIES I TEACH</div>
              <Tag color={selectedCategoryIds.length === 0 ? "coral" : undefined}>
                {selectedCategoryIds.length === 0
                  ? "required to publish"
                  : `${selectedCategoryIds.length} selected`}
              </Tag>
            </div>
            <Squiggle w={60} color="var(--ink-faint)" />
            <div className="small muted mt-2">
              Pick what you teach. You need at least one to publish your page, and
              these power the booking flow.
            </div>

            {allCategories.length === 0 ? (
              <div className="small muted mt-2" style={{ fontStyle: "italic" }}>
                No categories are available yet — contact support to add one.
              </div>
            ) : (
              <div className="col gap-1 mt-2" style={{ opacity: loaded ? 1 : 0.5 }}>
                {allCategories.map((cat) => (
                  <label
                    key={cat.id}
                    className="row gap-2"
                    style={{ alignItems: "center", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.includes(cat.id)}
                      onChange={() => toggleCategory(cat.id)}
                    />
                    <span className="small">{cat.title}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="row between mt-3" style={{ alignItems: "center" }}>
              <div className="small">
                {catsSavedAt && !catsDirty && (
                  <span className="muted">
                    saved · {new Date(catsSavedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <button
                onClick={saveCategories}
                disabled={savingCats || !catsDirty || allCategories.length === 0}
                className="btn small primary"
              >
                {savingCats ? "saving…" : catsDirty ? "save categories" : "saved"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}
