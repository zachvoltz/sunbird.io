import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { DTFrame } from "../components/DTFrame";
import { Squiggle } from "../components/Squiggle";
import { Tag } from "../components/Tag";

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

type PlanTier = "individual" | "group";

const PRICES = {
  individualBase: 12,
  groupBase: 18,
  perExtraCoach: 4,
  aiPerStudent: 3,
};

function computeMonthly(tier: PlanTier, coachCount: number): number {
  if (tier === "individual") return PRICES.individualBase;
  const extra = Math.max(0, coachCount - 1);
  return PRICES.groupBase + extra * PRICES.perExtraCoach;
}

// ── Profile section ───────────────────────────────────────

type ProfileState = {
  slug: string;
  headline: string;
  longBio: string;
  credentials: string;
  coverImageUrl: string;
  socialLinks: string;
  isPublished: boolean;
};

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

function ProfileSection() {
  const [loaded, setLoaded] = useState(false);
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [saved, setSaved] = useState<ProfileState>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

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
      })
      .catch(() => { /* leave at defaults */ })
      .finally(() => setLoaded(true));
  }, []);

  const dirty = useMemo(() => {
    return (Object.keys(profile) as Array<keyof ProfileState>).some(
      (k) => k !== "isPublished" && profile[k] !== saved[k],
    );
  }, [profile, saved]);

  const publicUrl = profile.slug
    ? `${window.location.origin}/coaches/${profile.slug}`
    : null;

  const update = <K extends keyof ProfileState>(k: K, v: ProfileState[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

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
          {publicUrl && (
            <a
              href={`/coaches/${profile.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn small ghost"
            >
              view ↗
            </a>
          )}
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

export function AccountPage() {
  const { user, logout } = useAuth();

  // All state local — billing isn't wired to a backend yet, so this is the
  // sketchy front-end coaches will see while plumbing is built.
  const [tier, setTier] = useState<PlanTier>("individual");
  const [coachCount, setCoachCount] = useState(1);
  const [studioName, setStudioName] = useState("");
  const [billingEmail, setBillingEmail] = useState(user?.email ?? "");
  const [aiEnabled, setAiEnabled] = useState(false);
  const [optedInStudents] = useState(0); // mock: will come from API later
  const [cancelOpen, setCancelOpen] = useState(false);

  const monthly = computeMonthly(tier, coachCount);
  const nextBillDate = new Date();
  nextBillDate.setDate(nextBillDate.getDate() + 14);
  const nextBillLabel = nextBillDate.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <DTFrame side="account">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Account</h2>
          <div className="dt-sub">
            Your plan, your seats, and how you get billed.
          </div>
        </div>
        <div className="row gap-2">
          <Link to="/pricing" target="_blank" className="btn small ghost">
            see public pricing ↗
          </Link>
          <button className="btn small" onClick={() => logout()}>
            sign out
          </button>
        </div>
      </div>

      <div className="dt-main-body">
        <div
          className="dt-cols"
          style={{ gridTemplateColumns: "2fr 1fr", height: "100%", gap: 18 }}
        >
          {/* ── Left column ── */}
          <div
            className="col gap-3"
            style={{
              paddingRight: 4,
              minHeight: 0,
              overflowY: "auto",
            }}
          >
            {/* Trial banner */}
            <div
              className="box"
              style={{
                background: "var(--highlight)",
                borderColor: "var(--ink)",
              }}
            >
              <div className="row between">
                <div>
                  <div className="bold">Free trial · 14 days left</div>
                  <div className="small muted">
                    No card on file yet. First bill on {nextBillLabel} if you
                    don't add one.
                  </div>
                </div>
                <button className="btn small primary">add card →</button>
              </div>
            </div>

            {/* Public profile */}
            <ProfileSection />

            {/* Plan picker */}
            <div className="box">
              <div className="row between">
                <div className="small muted">PLAN</div>
                <Tag>{tier === "individual" ? "individual" : "group"}</Tag>
              </div>
              <Squiggle w={60} color="var(--ink-faint)" />

              <div
                className="row gap-3 mt-2"
                style={{ alignItems: "stretch" }}
              >
                <PlanTile
                  active={tier === "individual"}
                  onClick={() => {
                    setTier("individual");
                    setCoachCount(1);
                  }}
                  title="Individual"
                  price="$12"
                  sub="per month · one coach"
                  blurb="Just you. Unlimited students, all the studio tools."
                />
                <PlanTile
                  active={tier === "group"}
                  onClick={() => {
                    setTier("group");
                    if (coachCount < 2) setCoachCount(2);
                  }}
                  title="Group / company"
                  price="$18"
                  sub={`per month + $${PRICES.perExtraCoach} per extra coach`}
                  blurb="Shared library, multiple coaches, one bill."
                />
              </div>

              {tier === "group" && (
                <>
                  <div className="hr-hand mt-3" />
                  <div className="row between mt-2">
                    <div>
                      <div className="small bold">Studio name</div>
                      <div className="tiny muted">
                        Shown on shared invoices and the studio dashboard.
                      </div>
                    </div>
                  </div>
                  <input
                    value={studioName}
                    onChange={(e) => setStudioName(e.target.value)}
                    placeholder="e.g. Sunbird Studios"
                    className="mt-2"
                    style={{ ...inputStyle, maxWidth: "100%" }}
                  />

                  <div className="row between mt-3">
                    <div>
                      <div className="small bold">Coach seats</div>
                      <div className="tiny muted">
                        $18 covers the first seat. Each additional coach is
                        +${PRICES.perExtraCoach}/mo.
                      </div>
                    </div>
                    <div className="row gap-2">
                      <button
                        className="btn icon"
                        onClick={() =>
                          setCoachCount((c) => Math.max(1, c - 1))
                        }
                        aria-label="remove a seat"
                      >
                        −
                      </button>
                      <div
                        className="box small center"
                        style={{
                          minWidth: 44,
                          padding: "4px 10px",
                          fontWeight: 700,
                        }}
                      >
                        {coachCount}
                      </div>
                      <button
                        className="btn icon"
                        onClick={() => setCoachCount((c) => c + 1)}
                        aria-label="add a seat"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* AI add-on */}
            <div className="box dashed">
              <div className="row between">
                <div>
                  <div className="small muted">COMING SOON</div>
                  <div className="bold">AI practice tools for students</div>
                </div>
                <Tag color="yellow">preview</Tag>
              </div>
              <div className="small muted mt-1">
                $3/mo per student + opt-in token overages. Students enable it
                themselves and are billed directly — never your studio.
              </div>

              <div className="hr-hand mt-2" />

              <div className="row between mt-2">
                <div className="small">
                  <span className="muted">Allow students to opt in</span>
                </div>
                <button
                  className={"btn small" + (aiEnabled ? " primary" : "")}
                  onClick={() => setAiEnabled((v) => !v)}
                >
                  {aiEnabled ? "enabled" : "off"}
                </button>
              </div>
              {aiEnabled && (
                <div className="small muted mt-2">
                  {optedInStudents} student
                  {optedInStudents === 1 ? "" : "s"} opted in · $0 owed by you
                </div>
              )}
            </div>

            {/* Billing details */}
            <div className="box">
              <div className="small muted">BILLING</div>
              <Squiggle w={60} color="var(--ink-faint)" />
              <div className="col gap-2 mt-2 small">
                <div className="row between">
                  <span className="muted">Billing email</span>
                  <input
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="you@studio.com"
                    style={inputStyle}
                  />
                </div>
                <div className="row between">
                  <span className="muted">Card on file</span>
                  <span className="muted">— none —</span>
                </div>
                <div className="row between">
                  <span className="muted">Next bill</span>
                  <span className="bold">{nextBillLabel}</span>
                </div>
              </div>
              <div className="row gap-2 mt-3">
                <button className="btn small primary">add payment method</button>
                <button className="btn small ghost">view invoices</button>
              </div>
            </div>

            {/* Danger zone */}
            <div className="box" style={{ borderColor: "var(--accent)" }}>
              <div className="row between">
                <div>
                  <div className="bold" style={{ color: "var(--accent)" }}>
                    Cancel subscription
                  </div>
                  <div className="tiny muted">
                    Keeps your account read-only after the current period.
                  </div>
                </div>
                <button
                  className="btn small"
                  onClick={() => setCancelOpen((v) => !v)}
                >
                  {cancelOpen ? "nevermind" : "cancel…"}
                </button>
              </div>
              {cancelOpen && (
                <div className="box dashed mt-2">
                  <div className="small">
                    Are you sure? You'll keep access until {nextBillLabel}.
                  </div>
                  <div className="row gap-2 mt-2">
                    <button className="btn small accent">
                      yes, cancel
                    </button>
                    <button
                      className="btn small ghost"
                      onClick={() => setCancelOpen(false)}
                    >
                      keep my plan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right column: summary ── */}
          <div className="col gap-3">
            <div
              className="box thick"
              style={{ position: "sticky", top: 0 }}
            >
              <div className="small muted">YOU'LL BE BILLED</div>
              <Squiggle w={50} color="var(--ink-faint)" />
              <div
                className="wf-scrawl bold mt-2"
                style={{ fontSize: 44, lineHeight: 1 }}
              >
                ${monthly}
                <span
                  className="muted"
                  style={{
                    fontFamily: "var(--hand)",
                    fontSize: 14,
                    fontWeight: 500,
                    marginLeft: 6,
                  }}
                >
                  / mo
                </span>
              </div>
              <div className="tiny muted mt-1">
                starts {nextBillLabel}
              </div>

              <div className="hr-hand mt-3" />

              <div className="col gap-2 mt-2 small">
                {tier === "individual" ? (
                  <div className="row between">
                    <span className="muted">Individual coach</span>
                    <span>${PRICES.individualBase}</span>
                  </div>
                ) : (
                  <>
                    <div className="row between">
                      <span className="muted">Group base (1 seat)</span>
                      <span>${PRICES.groupBase}</span>
                    </div>
                    {coachCount > 1 && (
                      <div className="row between">
                        <span className="muted">
                          +{coachCount - 1} extra coach
                          {coachCount - 1 === 1 ? "" : "es"} × $
                          {PRICES.perExtraCoach}
                        </span>
                        <span>
                          ${(coachCount - 1) * PRICES.perExtraCoach}
                        </span>
                      </div>
                    )}
                  </>
                )}
                <div className="row between">
                  <span className="muted">Students</span>
                  <span className="muted">free</span>
                </div>
                {aiEnabled && (
                  <div className="row between">
                    <span className="muted">AI student opt-ins</span>
                    <span className="muted">billed to student</span>
                  </div>
                )}
              </div>

              <div className="hr-hand mt-3" />

              <button className="btn primary mt-2" style={{ width: "100%" }}>
                save changes
              </button>
              <div className="tiny muted mt-2 center">
                You won't be charged until your trial ends.
              </div>
            </div>

            <div className="box small">
              <div className="row gap-2">
                <span
                  style={{
                    fontFamily: "var(--hand)",
                    fontWeight: 700,
                    color: "var(--ink-soft)",
                    width: 16,
                    flex: "0 0 16px",
                    textAlign: "center",
                  }}
                >
                  ?
                </span>
                <div>
                  <div className="bold">Need a custom plan?</div>
                  <div className="muted tiny mt-1">
                    Schools and larger studios — email{" "}
                    <a
                      href="mailto:hello@sunbird.studio"
                      style={{ color: "var(--ink)" }}
                    >
                      hello@sunbird.studio
                    </a>
                    .
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function PlanTile({
  active,
  onClick,
  title,
  price,
  sub,
  blurb,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  price: string;
  sub: string;
  blurb: string;
}) {
  return (
    <button
      onClick={onClick}
      className={"box grow text-left" + (active ? " thick accent" : "")}
      style={{
        flex: 1,
        cursor: "pointer",
        background: active ? "var(--accent-soft)" : "var(--paper)",
        textAlign: "left",
        fontFamily: "inherit",
      }}
    >
      <div className="row between">
        <div className="bold">{title}</div>
        {active && <Tag color="coral">selected</Tag>}
      </div>
      <div
        className="wf-scrawl bold mt-1"
        style={{ fontSize: 26, lineHeight: 1 }}
      >
        {price}
      </div>
      <div className="tiny muted mt-1">{sub}</div>
      <div className="small mt-2">{blurb}</div>
    </button>
  );
}
