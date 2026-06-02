// Payments — Stripe Connect (Express) coach onboarding flow.
//
// Default behaviour is driven by real status from
//   GET /api/coach-payments/status
// which mirrors the User row's Stripe flags onto the UI stage:
//   no account              → entry  (button: "begin setup")
//   account, no details     → entry  (button: "resume setup")
//   submitted, not enabled  → verifying (polls every 3s)
//   payouts enabled         → connected
//
// `?stage=entry|bank|verifying|connected` still works as a demo
// override so the design pages stay browsable without real Stripe.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { useIsMobile } from "../hooks/useIsMobile";
import { apiFetch } from "@/lib/api";

type Stage = "entry" | "bank" | "verifying" | "connected";

type ProviderId = "STRIPE" | "SQUARE";

// Provider-neutral connection status (mirrors the API's serializeStatus). Field
// names are generic so the same UI drives Stripe Connect and Square; `provider`
// selects the copy.
type PaymentStatus = {
  provider: ProviderId;
  hasAccount: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId: string | null;
  sessionPrice: number | null;
};

const EMPTY_STATUS: PaymentStatus = {
  provider: "STRIPE",
  hasAccount: false,
  detailsSubmitted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  accountId: null,
  sessionPrice: null,
};

// Coach's flat per-session rate editor. Reads the current value from
// /status, saves via PATCH /rate. Dollars in the UI, cents on the wire.
function SessionRateCard() {
  const [dollars, setDollars] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<{ data: PaymentStatus }>("/api/coach-payments/status")
      .then((r) => setDollars(r.data.sessionPrice ? (r.data.sessionPrice / 100).toString() : ""))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const n = parseFloat(dollars);
      const sessionPrice = !dollars || isNaN(n) || n <= 0 ? null : Math.round(n * 100);
      await apiFetch("/api/coach-payments/rate", { method: "PATCH", body: JSON.stringify({ sessionPrice }) });
      setSaved(true);
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't save your rate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="box" style={{ margin: "0 0 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 220px" }}>
        <div className="bold">Session rate</div>
        <div className="tiny muted">
          What students pay per lesson. Leave blank to keep lessons free.
        </div>
      </div>
      <div className="row gap-2" style={{ alignItems: "center" }}>
        <span className="bold">$</span>
        <input
          type="number"
          min={0}
          step="1"
          value={dollars}
          disabled={!loaded}
          onChange={(e) => { setDollars(e.target.value); setSaved(false); }}
          placeholder="0"
          style={{
            width: 90, fontFamily: "var(--hand)", fontSize: 14, padding: "6px 8px",
            border: "1.5px solid var(--ink-faint)", borderRadius: 6, background: "var(--paper)", color: "var(--ink)",
          }}
        />
        <button className="btn small primary" onClick={save} disabled={saving || !loaded}>
          {saving ? "saving…" : saved ? "saved ✓" : "save"}
        </button>
      </div>
    </div>
  );
}

// Coach's N-per-month package tiers (Model B). Coexists with the per-session
// rate above — a coach can offer both. Each tier: name, lessons/month, monthly
// price. "subscribable" reflects whether students can actually buy it yet
// (active + Stripe charges enabled).
type PlanRow = {
  id: string;
  name: string;
  lessonsPerMonth: number;
  priceMonthly: number;
  isActive: boolean;
  subscribable: boolean;
};

function PackagePlansCard() {
  const [plans, setPlans] = useState<PlanRow[] | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiFetch<{ data: PlanRow[] }>("/api/coach-plans")
      .then((r) => setPlans(r.data))
      .catch(() => setPlans([]));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const addPlan = async () => {
    setBusyId("new");
    try {
      await apiFetch("/api/coach-plans", {
        method: "POST",
        body: JSON.stringify({ name: "New package", lessonsPerMonth: 4, priceMonthly: 8000 }),
      });
      refresh();
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't create the package");
    } finally {
      setBusyId(null);
    }
  };

  const savePlan = async (p: PlanRow, patch: Partial<PlanRow>) => {
    setBusyId(p.id);
    try {
      const updated = await apiFetch<{ data: PlanRow }>(`/api/coach-plans/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setPlans((prev) => prev?.map((x) => (x.id === p.id ? updated.data : x)));
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't save the package");
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const deletePlan = async (p: PlanRow) => {
    if (!window.confirm(`Delete "${p.name}"?`)) return;
    setBusyId(p.id);
    try {
      await apiFetch(`/api/coach-plans/${p.id}`, { method: "DELETE" });
      setPlans((prev) => prev?.filter((x) => x.id !== p.id));
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't delete the package");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="box" style={{ margin: "0 0 14px" }}>
      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div className="bold">Monthly packages</div>
          <div className="tiny muted">
            Sell bundles of lessons per month (e.g. 4 lessons for $80). Students
            can subscribe to a package or pay per session.
          </div>
        </div>
        <button
          className="btn small primary"
          onClick={addPlan}
          disabled={busyId === "new"}
        >
          {busyId === "new" ? "adding…" : "＋ add package"}
        </button>
      </div>

      {plans === undefined ? (
        <div className="tiny muted" style={{ padding: 8 }}>loading packages…</div>
      ) : plans.length === 0 ? (
        <div className="tiny muted" style={{ padding: 8 }}>
          No packages yet. Add one to offer monthly lesson bundles alongside your
          per-session rate.
        </div>
      ) : (
        <div className="col gap-2">
          {plans.map((p) => (
            <PlanEditorRow
              key={p.id}
              plan={p}
              busy={busyId === p.id}
              onSave={(patch) => savePlan(p, patch)}
              onDelete={() => deletePlan(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanEditorRow({
  plan,
  busy,
  onSave,
  onDelete,
}: {
  plan: PlanRow;
  busy: boolean;
  onSave: (patch: Partial<PlanRow>) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(plan.name);
  const [lessons, setLessons] = useState(String(plan.lessonsPerMonth));
  const [dollars, setDollars] = useState((plan.priceMonthly / 100).toString());

  const dirty =
    name !== plan.name ||
    lessons !== String(plan.lessonsPerMonth) ||
    dollars !== (plan.priceMonthly / 100).toString();

  const save = () => {
    const lpm = parseInt(lessons, 10);
    const cents = Math.round(parseFloat(dollars) * 100);
    if (!name.trim() || !Number.isFinite(lpm) || lpm < 1 || !Number.isFinite(cents) || cents < 100) {
      window.alert("Need a name, ≥1 lesson/month, and a price of at least $1.");
      return;
    }
    onSave({ name: name.trim(), lessonsPerMonth: lpm, priceMonthly: cents });
  };

  const inputStyle = {
    fontFamily: "var(--hand)", fontSize: 14, padding: "6px 8px",
    border: "1.5px solid var(--ink-faint)", borderRadius: 6,
    background: "var(--paper)", color: "var(--ink)",
  } as const;

  return (
    <div
      className="row gap-2"
      style={{ alignItems: "center", flexWrap: "wrap", opacity: plan.isActive ? 1 : 0.6 }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="package name"
        style={{ ...inputStyle, flex: "1 1 140px", minWidth: 120 }}
      />
      <input
        type="number" min={1} step="1" value={lessons}
        onChange={(e) => setLessons(e.target.value)}
        style={{ ...inputStyle, width: 64 }}
        title="lessons per month"
      />
      <span className="tiny muted">/mo</span>
      <span className="bold">$</span>
      <input
        type="number" min={1} step="1" value={dollars}
        onChange={(e) => setDollars(e.target.value)}
        style={{ ...inputStyle, width: 80 }}
        title="monthly price"
      />
      <label className="tiny row gap-1" style={{ alignItems: "center" }} title="visible to students">
        <input
          type="checkbox"
          checked={plan.isActive}
          disabled={busy}
          onChange={(e) => onSave({ isActive: e.target.checked })}
          style={{ accentColor: "var(--accent)" }}
        />
        active
      </label>
      {plan.isActive && !plan.subscribable && (
        <span className="chip tiny" title="connect Stripe + finish onboarding to take charges">
          needs Stripe
        </span>
      )}
      <button className="btn small primary" onClick={save} disabled={busy || !dirty}>
        {busy ? "…" : "save"}
      </button>
      <button className="btn small ghost" onClick={onDelete} disabled={busy} title="delete package">
        ✕
      </button>
    </div>
  );
}

function stageFromStatus(s: PaymentStatus): Stage {
  if (!s.hasAccount) return "entry";
  if (!s.detailsSubmitted) return "entry";
  if (!s.payoutsEnabled || !s.chargesEnabled) return "verifying";
  return "connected";
}

function usePaymentStatus(opts: { poll?: boolean; refresh?: boolean }) {
  const [status, setStatus] = useState<PaymentStatus | undefined>();
  const [loading, setLoading] = useState(true);
  const [unconfigured, setUnconfigured] = useState(false);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: PaymentStatus }>(
        `/api/coach-payments/status${opts.refresh ? "?refresh=1" : ""}`,
      );
      setStatus(res.data);
      setUnconfigured(false);
    } catch (err: any) {
      if (err?.status === 501) {
        setUnconfigured(true);
        setStatus(EMPTY_STATUS);
      } else {
        setStatus(EMPTY_STATUS);
      }
    } finally {
      setLoading(false);
    }
  }, [opts.refresh]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);

  // Poll while the caller wants it (verifying view does this).
  useEffect(() => {
    if (!opts.poll) return;
    const handle = window.setInterval(() => {
      apiFetch<{ data: PaymentStatus }>("/api/coach-payments/status?refresh=1")
        .then((r) => setStatus(r.data))
        .catch(() => { /* keep last known */ });
    }, 3000);
    return () => window.clearInterval(handle);
  }, [opts.poll]);

  return { status: status ?? EMPTY_STATUS, loading, unconfigured, refresh: fetchOnce };
}

async function beginSetup(): Promise<string | null> {
  try {
    const res = await apiFetch<{ data: { url: string } }>(
      "/api/coach-payments/onboarding-link",
      { method: "POST" },
    );
    return res.data.url;
  } catch (err: any) {
    window.alert(
      err?.body?.error ??
        (err?.status === 501
          ? "Stripe isn't configured yet on the server."
          : "Couldn't start Stripe onboarding."),
    );
    return null;
  }
}

async function openStripeDashboard(): Promise<void> {
  try {
    const res = await apiFetch<{ data: { url: string } }>(
      "/api/coach-payments/dashboard-link",
      { method: "POST" },
    );
    window.open(res.data.url, "_blank", "noopener,noreferrer");
  } catch (err: any) {
    window.alert(err?.body?.error ?? "Couldn't open Stripe dashboard.");
  }
}

// ── Shared building blocks ────────────────────────────────

function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="onb-stepper">
      {steps.map((s, i) => (
        <span key={s} style={{ display: "contents" }}>
          <div className={"onb-step" + (i < current ? " done" : i === current ? " on" : "")}>
            <div className="onb-step-dot">{i < current ? "✓" : i + 1}</div>
            <div className="onb-step-lbl">{s}</div>
          </div>
          {i < steps.length - 1 && (
            <div className={"onb-step-line" + (i < current ? " done" : "")} />
          )}
        </span>
      ))}
    </div>
  );
}

function PoweredByStripe() {
  return (
    <div className="onb-poweredby">
      <span className="tiny muted">payouts handled by</span>
      <span className="onb-stripe-mark">stripe</span>
      <span className="tiny muted">· bank-grade · we never see your account #</span>
    </div>
  );
}

// Provider-aware variant of the trust line for the entry view.
function PoweredBy({ provider }: { provider: ProviderId }) {
  return (
    <div className="onb-poweredby">
      <span className="tiny muted">payments handled by</span>
      <span className="onb-stripe-mark">{provider === "SQUARE" ? "square" : "stripe"}</span>
      <span className="tiny muted">· bank-grade · we never see your account #</span>
    </div>
  );
}

type SideKey = "business" | "personal" | "bank" | "verify" | "review";
function SideBenefits({ active }: { active: SideKey }) {
  const benefits: Array<{ k: SideKey; t: string; b: string }> = [
    { k: "business", t: "why we ask",     b: "Your government requires us to verify who's getting paid. Stripe handles this so Songbird never stores your SSN or bank details." },
    { k: "personal", t: "identity check", b: "Last 4 of SSN is enough for most coaches under $20k/yr. Full SSN only if asked later." },
    { k: "bank",     t: "payouts schedule", b: "Daily, weekly, or monthly — your choice. Most coaches pick weekly. First payout takes 7 days, then 2 days after that." },
    { k: "verify",   t: "document upload", b: "Driver's license or passport. Photo of front + back. Stripe verifies, we get a green check." },
    { k: "review",   t: "all set",         b: "Submit to Stripe. Most accounts approve in under a minute. You'll get an email when payouts unlock." },
  ];
  return (
    <div className="onb-side">
      <div className="panel-title" style={{ fontSize: 18, marginBottom: 8 }}>About this step</div>
      {benefits.map((b) => (
        <div key={b.k} className={"onb-side-row" + (b.k === active ? " on" : "")}>
          <div className="onb-side-t">{b.t}</div>
          {b.k === active && <div className="onb-side-b small muted mt-1">{b.b}</div>}
        </div>
      ))}
      <div className="hr-hand" />
      <div
        className="postit wf-scrawl"
        style={{ transform: "rotate(-0.6deg)", fontSize: 14 }}
      >
        Songbird's cut: 2.9% + 30¢ per charge (Stripe's standard fees, no markup).
      </div>
    </div>
  );
}

// ── A · Entry / promotional landing ───────────────────────

function EntryView({
  onBegin,
  resume,
  starting,
  provider,
  onSelectProvider,
}: {
  onBegin: () => void;
  resume?: boolean;
  starting?: boolean;
  provider: ProviderId;
  onSelectProvider: (p: ProviderId) => void;
}) {
  const isSquare = provider === "SQUARE";
  return (
    <DTFrame side="payments">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Payments</h2>
          <div className="dt-sub">Set up payouts to start charging your students</div>
        </div>
        <div className="row gap-2">
          <span
            className="chip tiny"
            style={{
              background: "var(--accent-soft)",
              borderColor: "var(--accent)",
              color: "var(--accent)",
            }}
          >
            payouts not set up
          </span>
        </div>
      </div>
      <div className="dt-main-body">
        <div className="onb-hero">
          <div className="onb-hero-left">
            <div className="onb-hero-tag">
              <span style={{ fontFamily: "var(--scrawl)", fontSize: 20 }}>♪</span>
              <span className="bold">Get paid by your students</span>
            </div>
            <h1 className="onb-hero-h">
              Connect your bank<br />
              <span className="hi">in about 4 minutes</span>
            </h1>
            {/* Provider chooser — pick the processor before connecting. */}
            <div className="row gap-2 mt-2" role="radiogroup" aria-label="Payment provider">
              {(["STRIPE", "SQUARE"] as ProviderId[]).map((p) => (
                <button
                  key={p}
                  className={"btn small" + (provider === p ? " primary" : " ghost")}
                  onClick={() => onSelectProvider(p)}
                  aria-pressed={provider === p}
                >
                  {p === "STRIPE" ? "Stripe" : "Square"}
                </button>
              ))}
            </div>
            <div className="onb-hero-sub mt-2">
              We use <span className="bold">{isSquare ? "Square" : "Stripe"}</span> to move
              money safely. You'll need:
            </div>
            <ul className="onb-list">
              {isSquare ? (
                <>
                  <li><span className="onb-bullet">①</span> A Square account (we'll connect it)</li>
                  <li><span className="onb-bullet">②</span> Your business / payout details on Square</li>
                  <li><span className="onb-bullet">③</span> About 2 minutes to authorize</li>
                </>
              ) : (
                <>
                  <li><span className="onb-bullet">①</span> Legal name + date of birth</li>
                  <li><span className="onb-bullet">②</span> A US bank account (checking)</li>
                  <li><span className="onb-bullet">③</span> A photo ID (driver's license or passport)</li>
                  <li><span className="onb-bullet">④</span> Last 4 of SSN (for tax reporting)</li>
                </>
              )}
            </ul>
            <div className="row gap-2 mt-3">
              <button className="btn primary big" onClick={onBegin} disabled={starting}>
                {starting
                  ? `opening ${isSquare ? "Square" : "Stripe"}…`
                  : resume
                    ? "resume setup →"
                    : isSquare
                      ? "connect Square →"
                      : "begin setup →"}
              </button>
              <button className="btn ghost big">I'll do this later</button>
            </div>
            <div className="mt-3">
              <PoweredBy provider={provider} />
            </div>
          </div>

          <div className="onb-hero-right">
            <div className="onb-preview">
              <div className="onb-preview-head">
                <div className="row gap-2">
                  <div className="dt-brand" style={{ fontSize: 16 }}>
                    <span className="bird" style={{ width: 18, height: 18, fontSize: 11 }}>♪</span>
                    Songbird
                  </div>
                  <span className="muted small">/ payouts</span>
                </div>
              </div>
              <div>
                <div className="muted small">when connected, your dashboard shows:</div>
                <div className="box mt-2" style={{ padding: 10 }}>
                  <div className="row between">
                    <div className="bold">Next payout</div>
                    <span
                      className="chip tiny"
                      style={{ background: "var(--highlight)" }}
                    >
                      Mon Apr 22
                    </span>
                  </div>
                  <div
                    className="huge"
                    style={{ fontFamily: "var(--scrawl)", lineHeight: 1, marginTop: 6 }}
                  >
                    $1,642.<span style={{ fontSize: 20, color: "var(--ink-faint)" }}>20</span>
                  </div>
                  <div className="small muted mt-1">→ Chase •••• 4419</div>
                </div>
                <div className="box mt-2" style={{ padding: 10 }}>
                  <div className="bold small">Recent payouts</div>
                  <div className="col gap-2 mt-2">
                    {[
                      { d: "Apr 15", a: 1380 },
                      { d: "Apr 08", a: 1240 },
                      { d: "Apr 01", a: 1620 },
                    ].map((p) => (
                      <div key={p.d} className="row between small">
                        <span className="muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                          {p.d}
                        </span>
                        <span className="bold">${p.a.toLocaleString()}.00</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="onb-preview-tag wf-scrawl">↑ what you'll see after setup</div>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

// ── B · Bank account wizard step ──────────────────────────

function BankView({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  return (
    <DTFrame side="payments">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Set up payouts</h2>
          <div className="dt-sub">Step 3 of 5 · about 90 seconds left</div>
        </div>
        <button className="btn small ghost" onClick={onBack}>save &amp; exit</button>
      </div>
      <div className="dt-main-body">
        <div className="col gap-3" style={{ height: "100%" }}>
          <Stepper steps={["Business", "Personal", "Bank", "Verify ID", "Review"]} current={2} />
          <div className="onb-cols">
            <div className="panel onb-card">
              <div className="panel-head" style={{ marginBottom: 4 }}>
                <div className="panel-title">Where should we send your money?</div>
                <span className="chip tiny">US bank · checking</span>
              </div>
              <div className="small muted">
                This is where Stripe deposits your student payments. Routing &amp; account
                number stay encrypted at Stripe — we never see them.
              </div>

              <div className="onb-form mt-3">
                <div className="onb-field">
                  <label>Country</label>
                  <div className="onb-input">
                    <span className="onb-flag">🇺🇸</span>
                    <span>United States</span>
                    <span className="onb-caret">▾</span>
                  </div>
                </div>
                <div className="onb-field">
                  <label>Currency</label>
                  <div className="onb-input"><span>USD — US Dollar</span><span className="onb-caret">▾</span></div>
                </div>

                <div className="onb-field span-2">
                  <label>Routing number <span className="muted small">· 9 digits</span></label>
                  <div className="onb-input focused">
                    <span className="mono-input">021000021</span>
                    <span
                      className="chip tiny"
                      style={{ background: "#e6f1e9", borderColor: "#4a8a5a", color: "#2f6a3f" }}
                    >
                      ✓ JPMorgan Chase
                    </span>
                  </div>
                </div>

                <div className="onb-field span-2">
                  <label>Account number</label>
                  <div className="onb-input">
                    <span className="mono-input">••••••••••4419</span>
                    <span className="muted small">checking</span>
                  </div>
                </div>

                <div className="onb-field span-2">
                  <label>Confirm account number</label>
                  <div className="onb-input">
                    <span className="mono-input">••••••••••4419</span>
                    <span
                      className="chip tiny"
                      style={{ background: "#e6f1e9", borderColor: "#4a8a5a", color: "#2f6a3f" }}
                    >
                      ✓ matches
                    </span>
                  </div>
                </div>

                <div className="onb-field span-2">
                  <label>Payout schedule</label>
                  <div className="onb-radios">
                    {[
                      { l: "Daily",   s: "funds arrive in 2 business days" },
                      { l: "Weekly",  s: "every Monday · most popular", on: true },
                      { l: "Monthly", s: "1st of each month" },
                    ].map((o) => (
                      <div key={o.l} className={"onb-radio" + (o.on ? " on" : "")}>
                        <span className={"onb-radio-dot" + (o.on ? " on" : "")} />
                        <div>
                          <div className="bold small">{o.l}</div>
                          <div className="tiny muted">{o.s}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="onb-field span-2 onb-disclosure">
                  <span style={{ fontSize: 18, lineHeight: 1 }}>🔒</span>
                  <div className="tiny muted">
                    Stripe stores your bank info securely. Songbird only receives a
                    token referring to this account. You can change or remove your bank
                    anytime in Settings.
                  </div>
                </div>
              </div>

              <div className="row between mt-3">
                <button className="btn ghost" onClick={onBack}>← back</button>
                <div className="row gap-2">
                  <button className="btn ghost small">verify with micro-deposits instead</button>
                  <button className="btn primary big" onClick={onContinue}>continue →</button>
                </div>
              </div>
            </div>

            <SideBenefits active="bank" />
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

// ── C · Verifying ─────────────────────────────────────────

function VerifyingView() {
  return (
    <DTFrame side="payments">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Payments</h2>
          <div className="dt-sub">Submitted — Stripe is verifying your account</div>
        </div>
        <span className="chip tiny" style={{ background: "var(--highlight)" }}>● verifying</span>
      </div>
      <div className="dt-main-body">
        <div className="col gap-3" style={{ height: "100%" }}>
          <div className="onb-banner">
            <div className="row gap-3" style={{ alignItems: "flex-start" }}>
              <div className="onb-spinner">
                <div className="onb-spinner-dot" />
                <div className="onb-spinner-dot" />
                <div className="onb-spinner-dot" />
              </div>
              <div className="grow">
                <div className="bold big">Verifying with Stripe</div>
                <div className="small muted mt-1">
                  Usually under a minute. We'll email you and unlock payouts as soon as
                  it clears.
                </div>
              </div>
              <div className="onb-eta">
                <div className="tiny muted">est. wait</div>
                <div className="bold" style={{ fontFamily: "var(--scrawl)", fontSize: 24 }}>~ 40s</div>
              </div>
            </div>
          </div>

          <div className="onb-cols">
            <div className="panel">
              <div className="panel-title" style={{ marginBottom: 8 }}>What's checked</div>
              <div className="col gap-3">
                {[
                  { l: "Business type",      v: "Individual / Sole prop",        done: true },
                  { l: "Identity",           v: "Klein, K. · DOB ••/••/1987",     done: true },
                  { l: "Address",            v: "Brooklyn, NY 11215",             done: true },
                  { l: "Bank account",       v: "Chase •••• 4419 · checking",     done: true },
                  { l: "Photo ID",           v: "Driver's license · NY",          done: true, sub: "front + back uploaded" },
                  { l: "Tax info (W-9)",     v: "SSN last 4 · ••••6042",          done: true },
                  { l: "Stripe risk review", v: "in progress",                    spinning: true },
                ].map((r, i) => (
                  <div key={i} className="onb-check-row">
                    <div className={"onb-check" + (r.done ? " done" : r.spinning ? " spinning" : "")}>
                      {r.done ? "✓" : r.spinning ? "◐" : "·"}
                    </div>
                    <div className="grow">
                      <div className="bold small">{r.l}</div>
                      <div className="tiny muted">
                        {r.v}{r.sub ? <span> · {r.sub}</span> : null}
                      </div>
                    </div>
                    {r.done && <span className="tiny muted" style={{ fontFamily: "var(--mono)" }}>verified</span>}
                    {r.spinning && <span className="tiny" style={{ color: "var(--accent)" }}>checking…</span>}
                  </div>
                ))}
              </div>
              <div className="hr-hand" />
              <div className="small muted">
                You can close this tab — we'll email you when it's done.
              </div>
            </div>

            <div className="col gap-3">
              <div className="panel">
                <div className="panel-title" style={{ fontSize: 18, marginBottom: 6 }}>
                  While you wait
                </div>
                <div className="col gap-2">
                  <a className="onb-link-row" href="#">
                    <span style={{ fontSize: 18 }}>＋</span>
                    <div className="grow">
                      <div className="bold small">Set your hourly rate</div>
                      <div className="tiny muted">defaults applied to new students</div>
                    </div>
                    <span>→</span>
                  </a>
                  <a className="onb-link-row" href="#">
                    <span style={{ fontSize: 18 }}>♪</span>
                    <div className="grow">
                      <div className="bold small">Invite your first student</div>
                      <div className="tiny muted">they can pay you as soon as you're verified</div>
                    </div>
                    <span>→</span>
                  </a>
                  <a className="onb-link-row" href="#">
                    <span style={{ fontSize: 18 }}>☱</span>
                    <div className="grow">
                      <div className="bold small">Set cancellation policy</div>
                      <div className="tiny muted">24h notice · 50% fee · etc.</div>
                    </div>
                    <span>→</span>
                  </a>
                </div>
              </div>
              <div className="panel tinted" style={{ flex: 1 }}>
                <div className="panel-title" style={{ fontSize: 18, marginBottom: 6 }}>
                  If Stripe needs more info
                </div>
                <div className="small muted">
                  Sometimes Stripe asks for an additional document — a utility bill, a
                  photo of you holding your ID, or your full SSN. If that happens, we'll
                  show a banner here and email you. No action needed for now.
                </div>
                <div className="postit wf-scrawl mt-3" style={{ transform: "rotate(0.4deg)" }}>
                  ~92% of coaches verify on the first try.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

// ── D · Connected ─────────────────────────────────────────

function ConnectedView({ onViewPayments }: { onViewPayments?: () => void }) {
  return (
    <DTFrame side="payments">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Payments</h2>
          <div className="dt-sub">Connected · payouts unlocked</div>
        </div>
        <div className="row gap-2">
          <span
            className="chip tiny"
            style={{ background: "#e6f1e9", borderColor: "#4a8a5a", color: "#2f6a3f" }}
          >
            ● connected to Stripe
          </span>
          <button className="btn small ghost" onClick={openStripeDashboard}>
            manage account ↗
          </button>
        </div>
      </div>
      <div className="dt-main-body">
        <div className="col gap-3" style={{ height: "100%" }}>
          <div className="onb-success">
            <div className="onb-success-burst">
              <div className="onb-burst-check">✓</div>
              <svg className="onb-burst-rays" viewBox="0 0 100 100" width="100" height="100">
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => (
                  <line
                    key={a}
                    x1="50" y1="14" x2="50" y2="6"
                    stroke="var(--accent)" strokeWidth="2" strokeLinecap="round"
                    transform={`rotate(${a} 50 50)`}
                  />
                ))}
              </svg>
            </div>
            <div>
              <h1 className="onb-success-h">You're all set.</h1>
              <div className="onb-success-sub">
                Send your first invoice or share your booking link — money lands in{" "}
                <span className="bold">Chase •••• 4419</span> every Monday.
              </div>
              <div className="row gap-2 mt-3">
                <button className="btn primary big" onClick={onViewPayments}>
                  view payments →
                </button>
                <Link to="/book" className="btn big" style={{ textDecoration: "none" }}>
                  share booking link
                </Link>
              </div>
            </div>
          </div>

          <div className="onb-cols" style={{ flex: 1 }}>
            <div className="panel">
              <div className="panel-head" style={{ marginBottom: 6 }}>
                <div className="panel-title">Account summary</div>
                <span className="tiny muted">connected just now</span>
              </div>
              <div className="onb-summary">
                <div>
                  <div className="onb-sum-lbl">Business</div>
                  <div className="bold">Klein Music Studio</div>
                  <div className="tiny muted">Individual · sole proprietor</div>
                </div>
                <div>
                  <div className="onb-sum-lbl">Payout bank</div>
                  <div className="bold">Chase •••• 4419</div>
                  <div className="tiny muted">checking · weekly</div>
                </div>
                <div>
                  <div className="onb-sum-lbl">Tax form</div>
                  <div className="bold">W-9 on file</div>
                  <div className="tiny muted">1099-K issued ≥ $5k/yr</div>
                </div>
                <div>
                  <div className="onb-sum-lbl">Stripe account</div>
                  <div className="bold mono-input" style={{ fontSize: 12 }}>acct_1OZw•••pQ4r</div>
                  <div className="tiny muted">verified by Stripe</div>
                </div>
                <div>
                  <div className="onb-sum-lbl">Fees</div>
                  <div className="bold">2.9% + 30¢</div>
                  <div className="tiny muted">per successful charge</div>
                </div>
                <div>
                  <div className="onb-sum-lbl">Payout speed</div>
                  <div className="bold">2 business days</div>
                  <div className="tiny muted">first payout: 7 days</div>
                </div>
              </div>
            </div>

            <div className="col gap-3">
              <div className="panel">
                <div className="panel-title" style={{ fontSize: 18, marginBottom: 6 }}>
                  What unlocked
                </div>
                <div className="col gap-2">
                  {[
                    "Accept card payments from students",
                    "Send invoices & payment requests",
                    "Set up autopay / recurring monthly billing",
                    "Receive payouts to your bank",
                    "Issue refunds & partial credits",
                  ].map((t) => (
                    <div key={t} className="row gap-2 small">
                      <span className="checkbox done" style={{ width: 18, height: 18 }} />
                      <span>{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel tinted">
                <div className="row gap-2">
                  <span style={{ fontSize: 24 }}>♪</span>
                  <div>
                    <div className="bold">Your first payout</div>
                    <div className="small muted">
                      arrives Mon, Apr 29 — about 7 days after your first charge
                      clears.
                    </div>
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

// ── Mobile · wizard step ──────────────────────────────────

function PaymentsMobile() {
  return (
    <WFFrame navActive="home">
      <div className="wf-status">
        <span>9:41</span><span className="dots">• • •</span><span>⌁ 87%</span>
      </div>
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Get paid</h2>
          <div className="wf-subtitle">Step 3 of 5 · Bank</div>
        </div>
        <div className="wf-avatar">K</div>
      </div>
      <div className="wf-body col gap-3 scroll-y">
        <div className="onb-stepper mobile">
          {["Biz", "You", "Bank", "ID", "Done"].map((s, i) => (
            <div key={s} className={"onb-step-mb" + (i < 2 ? " done" : i === 2 ? " on" : "")}>
              <div className="onb-step-dot">{i < 2 ? "✓" : i + 1}</div>
              <div className="tiny">{s}</div>
            </div>
          ))}
        </div>

        <div className="box">
          <div className="bold big">Where to send payouts?</div>
          <div className="tiny muted mt-1">Stripe encrypts this. We never see your account #.</div>

          <div className="onb-form mt-3" style={{ gridTemplateColumns: "1fr" }}>
            <div className="onb-field">
              <label>Routing number</label>
              <div className="onb-input"><span className="mono-input">021000021</span></div>
              <div className="tiny" style={{ color: "#2f6a3f" }}>✓ JPMorgan Chase</div>
            </div>
            <div className="onb-field">
              <label>Account number</label>
              <div className="onb-input"><span className="mono-input">••••••••••4419</span></div>
            </div>
            <div className="onb-field">
              <label>Payout schedule</label>
              <div className="onb-radios mobile">
                <div className="onb-radio">
                  <span className="onb-radio-dot" />
                  <span className="small">Daily</span>
                </div>
                <div className="onb-radio on">
                  <span className="onb-radio-dot on" />
                  <span className="small bold">Weekly</span>
                </div>
                <div className="onb-radio">
                  <span className="onb-radio-dot" />
                  <span className="small">Monthly</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row gap-2" style={{ marginTop: "auto" }}>
          <button className="btn ghost grow">← back</button>
          <button className="btn primary grow">continue</button>
        </div>

        <div className="center">
          <PoweredByStripe />
        </div>
      </div>
    </WFFrame>
  );
}

// ── Payments overview (post-connection dashboard) ────────
//
// Once the coach is connected to Stripe we replace the celebratory
// Connected view with this ledger: KPIs, monthly invoice table,
// trailing-7-month chart, and a year view. Data here is mock for
// now — real Stripe charges + invoices will replace it later.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type PayStatus = "paid" | "pending" | "requested" | "expected" | "overdue";
type Invoice = {
  who: string;
  amt: number;
  status: PayStatus;
  method: string;
  date: string;
  note: string;
};

const DEMO_INVOICES: Invoice[] = [
  { who: "Lina S.",  amt: 240, status: "paid",      method: "card",    date: "Apr 02", note: "4× lessons · monthly" },
  { who: "Diego H.", amt: 180, status: "paid",      method: "card",    date: "Apr 03", note: "3× lessons" },
  { who: "Yuna T.",  amt: 240, status: "paid",      method: "bank",    date: "Apr 05", note: "4× lessons · monthly" },
  { who: "Iris L.",  amt: 240, status: "paid",      method: "card",    date: "Apr 07", note: "4× lessons" },
  { who: "Beck J.",  amt: 320, status: "paid",      method: "cash",    date: "Apr 08", note: "recital prep block" },
  { who: "Cara N.",  amt: 180, status: "paid",      method: "card",    date: "Apr 12", note: "3× lessons" },
  { who: "Maya R.",  amt: 240, status: "paid",      method: "card",    date: "Apr 14", note: "4× lessons · autopay" },
  { who: "Jonas K.", amt: 240, status: "pending",   method: "card",    date: "sent Apr 15", note: "4× lessons · due Apr 22" },
  { who: "Theo P.",  amt: 240, status: "pending",   method: "bank",    date: "sent Apr 16", note: "4× lessons · due Apr 23" },
  { who: "Ana B.",   amt: 200, status: "pending",   method: "card",    date: "sent Apr 17", note: "voice block · due Apr 24" },
  { who: "Reza M.",  amt: 180, status: "requested", method: "draft",   date: "draft",       note: "3× lessons · ready to send" },
  { who: "Sam W.",   amt: 240, status: "requested", method: "draft",   date: "draft",       note: "4× lessons · adjusted -1 makeup" },
  { who: "Mira O.",  amt: 240, status: "expected",  method: "autopay", date: "Apr 28",      note: "4× lessons · autopay scheduled" },
  { who: "Owen V.",  amt: 180, status: "expected",  method: "autopay", date: "Apr 29",      note: "3× lessons · autopay scheduled" },
  { who: "Felix B.", amt: 240, status: "overdue",   method: "card",    date: "due Apr 10",  note: "4× lessons · 5d late · auto-retry tomorrow" },
];

const TRAILING_YEAR_STRIP = [
  { m: "Oct '25", paid: 1840, expected: 1920 },
  { m: "Nov '25", paid: 1760, expected: 1800 },
  { m: "Dec '25", paid: 1680, expected: 1920 },
  { m: "Jan '26", paid: 2010, expected: 2040 },
  { m: "Feb '26", paid: 2080, expected: 2080 },
  { m: "Mar '26", paid: 2140, expected: 2160 },
  { m: "Apr '26", paid: 1620, expected: 2240, current: true },
];

const FUTURE_EXPECTED = [
  { m: "May '26", lessons: 76, students: 19, est: 2280, note: "+ Owen V. switching to 4×" },
  { m: "Jun '26", lessons: 72, students: 19, est: 2160, note: "Iris off 1 wk (vacation)" },
  { m: "Jul '26", lessons: 56, students: 16, est: 1680, note: "summer schedule · 3 students pause" },
];

function KpiCard({
  label, amount, sub, tone, warn,
}: {
  label: string;
  amount: number;
  sub: string;
  tone: "paid" | "pending" | "requested" | "expected" | "overdue" | "total";
  warn?: boolean;
}) {
  return (
    <div className={"kpi kpi-" + tone}>
      <div className="kpi-lbl">{label}{warn ? <span className="kpi-warn">!</span> : null}</div>
      <div className="kpi-amt">${amount.toLocaleString()}</div>
      <div className="kpi-sub">{sub}</div>
    </div>
  );
}

function PayRow({ inv }: { inv: Invoice }) {
  return (
    <tr className={"pay-row pay-row-" + inv.status}>
      <td><Avatar name={inv.who} size={26} /></td>
      <td>
        <div className="bold">{inv.who}</div>
        <span className={"pay-pill pay-pill-" + inv.status}>{inv.status}</span>
      </td>
      <td className="muted small">{inv.note}</td>
      <td className="small muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{inv.date}</td>
      <td className="small muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{inv.method}</td>
      <td className="bold" style={{ textAlign: "right", fontFamily: "var(--scrawl)", fontSize: 20 }}>
        ${inv.amt}
      </td>
      <td>
        <button className="btn icon ghost" style={{ width: 24, height: 24, border: "none", fontSize: 14 }}>⋯</button>
      </td>
    </tr>
  );
}

function YearBars({
  data, onPick,
}: {
  data: typeof TRAILING_YEAR_STRIP;
  onPick?: (i: number) => void;
}) {
  const max = Math.max(...data.map((d) => d.expected));
  return (
    <div className="year-bars">
      {data.map((d, i) => {
        const paidH = (d.paid / max) * 100;
        const expH = (d.expected / max) * 100;
        return (
          <div
            key={d.m}
            className={"yb" + (d.current ? " yb-current" : "")}
            onClick={() => onPick && onPick(i)}
          >
            <div className="yb-stack">
              <div className="yb-exp" style={{ height: expH + "%" }} />
              <div className="yb-paid" style={{ height: paidH + "%" }} />
            </div>
            <div className="yb-lbl">{d.m}</div>
            <div className="yb-amt">${(d.paid / 1000).toFixed(1)}k</div>
          </div>
        );
      })}
    </div>
  );
}

type YearMonth = {
  m: string;
  paid: number;
  pending: number;
  requested: number;
  expected: number;
  overdue: number;
  lessons: number;
  students: number;
  current?: boolean;
  future?: boolean;
};

function StackBar({ m, total, max }: { m: YearMonth; total: number; max: number }) {
  const seg = (n: number) => (total ? (n / total) * 100 : 0);
  const width = max ? (total / max) * 100 : 0;
  return (
    <div className="stack-bar" style={{ width: width + "%" }}>
      {m.paid     > 0 && <div className="sb sb-paid"     style={{ flex: seg(m.paid)     }} />}
      {m.pending  > 0 && <div className="sb sb-pending"  style={{ flex: seg(m.pending)  }} />}
      {m.expected > 0 && <div className="sb sb-expected" style={{ flex: seg(m.expected) }} />}
      {m.overdue  > 0 && <div className="sb sb-overdue"  style={{ flex: seg(m.overdue)  }} />}
    </div>
  );
}

function YearChart({
  months, max, onPick,
}: {
  months: YearMonth[];
  max: number;
  onPick: (i: number) => void;
}) {
  return (
    <div className="year-chart">
      {months.map((m, i) => {
        const h = (v: number) => (max ? (v / max) * 100 : 0);
        return (
          <div
            key={m.m}
            className={"yc" + (m.current ? " is-current" : "") + (m.future ? " is-future" : "")}
            onClick={() => onPick(i)}
          >
            <div className="yc-stack">
              {m.expected > 0 && <div className="yc-seg yc-expected" style={{ height: h(m.expected) + "%" }} />}
              {m.pending  > 0 && <div className="yc-seg yc-pending"  style={{ height: h(m.pending)  + "%" }} />}
              {m.overdue  > 0 && <div className="yc-seg yc-overdue"  style={{ height: h(m.overdue)  + "%" }} />}
              {m.paid     > 0 && <div className="yc-seg yc-paid"     style={{ height: h(m.paid)     + "%" }} />}
            </div>
            <div className="yc-lbl">{m.m}</div>
          </div>
        );
      })}
    </div>
  );
}

function YearView({
  year, months, totals, grandTotal, ytdActual, bestMonth, onPickMonth,
}: {
  year: number;
  months: YearMonth[];
  totals: { paid: number; pending: number; requested: number; expected: number; overdue: number; lessons: number };
  grandTotal: number;
  ytdActual: number;
  bestMonth: YearMonth;
  onPickMonth: (i: number) => void;
}) {
  const realizedPct = Math.round((ytdActual / grandTotal) * 100);
  const maxMonth = Math.max(
    ...months.map((m) => m.paid + m.pending + m.requested + m.expected + m.overdue),
  );
  return (
    <div className="col gap-3" style={{ height: "100%" }}>
      <div className="pay-kpis">
        <KpiCard label={`paid in ${year}`} amount={totals.paid} sub="realized · YTD" tone="paid" />
        <KpiCard
          label="open pipeline"
          amount={totals.pending + totals.requested + totals.overdue}
          sub={
            `${totals.pending ? `pending $${totals.pending}` : ""}` +
            `${totals.overdue ? ` · overdue $${totals.overdue}` : ""}`.trim() || "—"
          }
          tone="pending"
        />
        <KpiCard
          label="expected remaining"
          amount={totals.expected}
          sub={`${months.filter((m) => m.future).length} months ahead`}
          tone="expected"
        />
        <KpiCard label={`${year} total`} amount={grandTotal} sub={`${totals.lessons} lessons across the year`} tone="total" />
      </div>

      <div className="dt-cols" style={{ flex: 1, gridTemplateColumns: "1.55fr 1fr", gap: 14, minHeight: 0 }}>
        <div className="panel" style={{ padding: "12px 14px" }}>
          <div className="panel-head" style={{ marginBottom: 6 }}>
            <div className="row gap-3">
              <div className="panel-title">{year} · monthly breakdown</div>
              <span className="chip tiny">12 months</span>
            </div>
            <span className="tiny muted">click a month →</span>
          </div>

          <div className="panel-body scroll">
            <table className="pay-tbl pay-tbl-year">
              <thead>
                <tr>
                  <th style={{ width: 54 }}>month</th>
                  <th style={{ textAlign: "right" }}>paid</th>
                  <th style={{ textAlign: "right" }}>pending</th>
                  <th style={{ textAlign: "right" }}>expected</th>
                  <th style={{ textAlign: "right" }}>overdue</th>
                  <th style={{ textAlign: "right", width: 110 }}>total</th>
                  <th style={{ width: 160 }}>composition</th>
                  <th style={{ width: 28 }}></th>
                </tr>
              </thead>
              <tbody>
                {months.map((m, i) => {
                  const total = m.paid + m.pending + m.requested + m.expected + m.overdue;
                  return (
                    <tr
                      key={m.m}
                      className={"pay-row pay-row-year" + (m.current ? " is-current" : "") + (m.future ? " is-future" : "")}
                      onClick={() => onPickMonth(i)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <div className="bold">{m.m}</div>
                        {m.current && <span className="pay-pill pay-pill-pending">current</span>}
                        {m.future && <span className="pay-pill pay-pill-expected">future</span>}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                        {m.paid ? `$${m.paid.toLocaleString()}` : <span className="muted">—</span>}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                        {m.pending ? `$${m.pending}` : <span className="muted">—</span>}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                        {m.expected ? `$${m.expected.toLocaleString()}` : <span className="muted">—</span>}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>
                        {m.overdue ? <span style={{ color: "var(--accent)" }}>${m.overdue}</span> : <span className="muted">—</span>}
                      </td>
                      <td className="bold" style={{ textAlign: "right", fontFamily: "var(--scrawl)", fontSize: 20 }}>
                        ${total.toLocaleString()}
                      </td>
                      <td><StackBar m={m} total={total} max={maxMonth} /></td>
                      <td><span className="muted small">›</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="pay-row-total">
                  <td className="bold">total</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>${totals.paid.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>${totals.pending}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>${totals.expected.toLocaleString()}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>${totals.overdue}</td>
                  <td className="bold" style={{ textAlign: "right", fontFamily: "var(--scrawl)", fontSize: 22 }}>
                    ${grandTotal.toLocaleString()}
                  </td>
                  <td colSpan={2}>
                    <div className="tiny muted">{realizedPct}% realized · {100 - realizedPct}% projected</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="col gap-3" style={{ minHeight: 0 }}>
          <div className="panel" style={{ padding: "12px 14px", flex: "0 0 auto" }}>
            <div className="panel-head" style={{ marginBottom: 6 }}>
              <div className="panel-title">{year} chart</div>
              <div className="row gap-2 tiny">
                <span className="row gap-1"><span className="legend-sw paid" /> paid</span>
                <span className="row gap-1"><span className="legend-sw pending" /> pending</span>
                <span className="row gap-1"><span className="legend-sw expected" /> expected</span>
              </div>
            </div>
            <YearChart months={months} max={maxMonth} onPick={onPickMonth} />
          </div>

          <div className="panel" style={{ padding: "12px 14px", flex: "1 1 auto", minHeight: 0 }}>
            <div className="panel-head" style={{ marginBottom: 6 }}>
              <div className="panel-title">year-in-review</div>
            </div>
            <div className="panel-body scroll col gap-3">
              <div className="row gap-3">
                <div className="yr-stat">
                  <div className="yr-stat-lbl">avg / month</div>
                  <div className="yr-stat-val">${Math.round(grandTotal / 12).toLocaleString()}</div>
                </div>
                <div className="yr-stat">
                  <div className="yr-stat-lbl">best month</div>
                  <div className="yr-stat-val">{bestMonth.m}</div>
                  <div className="tiny muted">
                    ${(bestMonth.paid + bestMonth.pending + bestMonth.expected).toLocaleString()}
                  </div>
                </div>
                <div className="yr-stat">
                  <div className="yr-stat-lbl">vs last yr</div>
                  <div className="yr-stat-val" style={{ color: "#2f6a3f" }}>+18%</div>
                  <div className="tiny muted">$3,840 more</div>
                </div>
              </div>

              <div className="hr-hand" />

              <div>
                <div className="small muted mb-2">NOTABLE</div>
                <div className="col gap-2">
                  <div className="row gap-2 small">
                    <span className="bullet-dot">●</span>
                    <span><span className="bold">Mar</span> was your strongest month — 22 active students.</span>
                  </div>
                  <div className="row gap-2 small">
                    <span className="bullet-dot">●</span>
                    <span>Summer dip projected — <span className="bold">Jul/Aug</span> ~30% lighter.</span>
                  </div>
                  <div className="row gap-2 small">
                    <span className="bullet-dot" style={{ color: "var(--accent)" }}>●</span>
                    <span>Recital prep blocks add <span className="hi">~$1,200</span> in Apr &amp; Dec.</span>
                  </div>
                </div>
              </div>

              <div className="postit wf-scrawl" style={{ transform: "rotate(0.4deg)" }}>
                Tax estimate ({year}): <span className="hi">~$5,400</span> set aside · 22% self-emp bracket
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentsOverviewDesktop() {
  const [monthIdx, setMonthIdx] = useState(3); // Apr
  const [year, setYear] = useState(2026);
  const [scope, setScope] = useState<"month" | "year">("month");
  const [scopeOpen, setScopeOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | PayStatus>("all");

  const totalsByStatus = useMemo(() => {
    const acc: Record<PayStatus, number> = { paid: 0, pending: 0, requested: 0, expected: 0, overdue: 0 };
    for (const inv of DEMO_INVOICES) acc[inv.status] += inv.amt;
    return acc;
  }, []);
  const countsByStatus = useMemo(() => {
    const acc: Record<PayStatus, number> = { paid: 0, pending: 0, requested: 0, expected: 0, overdue: 0 };
    for (const inv of DEMO_INVOICES) acc[inv.status] += 1;
    return acc;
  }, []);
  const collected = totalsByStatus.paid;
  const pending = totalsByStatus.pending;
  const requested = totalsByStatus.requested;
  const expectedSoon = totalsByStatus.expected;
  const overdue = totalsByStatus.overdue;
  const projected = collected + pending + requested + expectedSoon + overdue;

  const filtered = filter === "all" ? DEMO_INVOICES : DEMO_INVOICES.filter((i) => i.status === filter);

  const yearMonths: YearMonth[] = [
    { m: "Jan", paid: 2010, pending: 0, requested: 0, expected: 0,    overdue: 0, lessons: 78, students: 21 },
    { m: "Feb", paid: 2080, pending: 0, requested: 0, expected: 0,    overdue: 0, lessons: 80, students: 22 },
    { m: "Mar", paid: 2140, pending: 0, requested: 0, expected: 0,    overdue: 0, lessons: 82, students: 22 },
    { m: "Apr", paid: collected, pending, requested, expected: expectedSoon, overdue, lessons: 74, students: 23, current: true },
    { m: "May", paid: 0, pending: 0, requested: 0, expected: 2280, overdue: 0, lessons: 76, students: 19, future: true },
    { m: "Jun", paid: 0, pending: 0, requested: 0, expected: 2160, overdue: 0, lessons: 72, students: 19, future: true },
    { m: "Jul", paid: 0, pending: 0, requested: 0, expected: 1680, overdue: 0, lessons: 56, students: 16, future: true },
    { m: "Aug", paid: 0, pending: 0, requested: 0, expected: 1560, overdue: 0, lessons: 52, students: 15, future: true },
    { m: "Sep", paid: 0, pending: 0, requested: 0, expected: 2160, overdue: 0, lessons: 74, students: 20, future: true },
    { m: "Oct", paid: 0, pending: 0, requested: 0, expected: 2280, overdue: 0, lessons: 78, students: 21, future: true },
    { m: "Nov", paid: 0, pending: 0, requested: 0, expected: 2160, overdue: 0, lessons: 72, students: 21, future: true },
    { m: "Dec", paid: 0, pending: 0, requested: 0, expected: 1920, overdue: 0, lessons: 64, students: 20, future: true },
  ];
  const yrTotals = yearMonths.reduce(
    (a, m) => ({
      paid: a.paid + m.paid,
      pending: a.pending + m.pending,
      requested: a.requested + m.requested,
      expected: a.expected + m.expected,
      overdue: a.overdue + m.overdue,
      lessons: a.lessons + m.lessons,
    }),
    { paid: 0, pending: 0, requested: 0, expected: 0, overdue: 0, lessons: 0 },
  );
  const yrTotal = yrTotals.paid + yrTotals.pending + yrTotals.requested + yrTotals.expected + yrTotals.overdue;
  const ytdActual = yrTotals.paid + yrTotals.pending + yrTotals.overdue;
  const bestMonth = [...yearMonths].sort(
    (a, b) => (b.paid + b.pending + b.expected) - (a.paid + a.pending + a.expected),
  )[0];

  return (
    <DTFrame side="payments">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Payments</h2>
          <div className="dt-sub">
            {scope === "month"
              ? "Collected, requested, and expected · all in your studio's pocket"
              : `${year} at a glance — what came in, what's still owed, what's coming`}
          </div>
        </div>
        <div className="row gap-2">
          {/* scope dropdown */}
          <div className="scope-dd" style={{ position: "relative" }}>
            <button className="scope-trigger" onClick={() => setScopeOpen((o) => !o)}>
              <span className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>view</span>
              <span className="bold">by {scope}</span>
              <span className="scope-caret">▾</span>
            </button>
            {scopeOpen && (
              <>
                <div className="scope-backdrop" onClick={() => setScopeOpen(false)} />
                <div className="scope-menu">
                  <div
                    className={"scope-opt" + (scope === "month" ? " on" : "")}
                    onClick={() => { setScope("month"); setScopeOpen(false); }}
                  >
                    <span className="scope-opt-ico">▦</span>
                    <div>
                      <div className="bold small">By month</div>
                      <div className="tiny muted">individual invoices · ledger view</div>
                    </div>
                    {scope === "month" && <span className="scope-check">✓</span>}
                  </div>
                  <div
                    className={"scope-opt" + (scope === "year" ? " on" : "")}
                    onClick={() => { setScope("year"); setScopeOpen(false); }}
                  >
                    <span className="scope-opt-ico">▤</span>
                    <div>
                      <div className="bold small">By year</div>
                      <div className="tiny muted">monthly totals · annual outlook</div>
                    </div>
                    {scope === "year" && <span className="scope-check">✓</span>}
                  </div>
                  <div className="scope-divider" />
                  <div className="scope-opt disabled">
                    <span className="scope-opt-ico">◰</span>
                    <div>
                      <div className="bold small">By quarter</div>
                      <div className="tiny muted">coming soon</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* period picker — month or year */}
          {scope === "month" ? (
            <div className="row gap-2" style={{ border: "1.5px solid var(--ink)", borderRadius: 999, padding: "3px 6px 3px 4px", background: "var(--paper)" }}>
              <button
                className="btn icon ghost"
                style={{ width: 26, height: 26, border: "none", fontSize: 14 }}
                onClick={() => setMonthIdx((i) => Math.max(0, i - 1))}
              >‹</button>
              <span className="bold" style={{ minWidth: 96, textAlign: "center", fontSize: 15 }}>
                {MONTHS[monthIdx]} {year}
              </span>
              <button
                className="btn icon ghost"
                style={{ width: 26, height: 26, border: "none", fontSize: 14 }}
                onClick={() => setMonthIdx((i) => Math.min(11, i + 1))}
              >›</button>
            </div>
          ) : (
            <div className="row gap-2" style={{ border: "1.5px solid var(--ink)", borderRadius: 999, padding: "3px 6px 3px 4px", background: "var(--paper)" }}>
              <button
                className="btn icon ghost"
                style={{ width: 26, height: 26, border: "none", fontSize: 14 }}
                onClick={() => setYear((y) => y - 1)}
              >‹</button>
              <span className="bold" style={{ minWidth: 72, textAlign: "center", fontSize: 15 }}>{year}</span>
              <button
                className="btn icon ghost"
                style={{ width: 26, height: 26, border: "none", fontSize: 14 }}
                onClick={() => setYear((y) => y + 1)}
              >›</button>
            </div>
          )}
          <button className="btn small ghost">export CSV</button>
          <button className="btn small primary">＋ send request</button>
        </div>
      </div>

      <div className="dt-main-body">
        <SessionRateCard />
        <PackagePlansCard />
        {scope === "month" ? (
          <div className="col gap-3" style={{ height: "100%" }}>
            <div className="pay-kpis">
              <KpiCard label="collected"   amount={collected}    sub={`${countsByStatus.paid} paid`} tone="paid" />
              <KpiCard label="pending"     amount={pending}      sub={`${countsByStatus.pending} sent · awaiting`} tone="pending" />
              <KpiCard label="requested"   amount={requested}    sub={`${countsByStatus.requested} ready to send`} tone="requested" warn />
              <KpiCard label="expected"    amount={expectedSoon} sub={`${countsByStatus.expected} autopay · later this mo`} tone="expected" />
              <KpiCard label="overdue"     amount={overdue}      sub={`${countsByStatus.overdue} late`} tone="overdue" />
              <KpiCard label="month total" amount={projected}    sub={`projected for ${MONTHS[monthIdx]}`} tone="total" />
            </div>

            <div className="dt-cols" style={{ flex: 1, gridTemplateColumns: "1.55fr 1fr", gap: 14, minHeight: 0 }}>
              <div className="panel" style={{ padding: "12px 14px" }}>
                <div className="panel-head" style={{ marginBottom: 6 }}>
                  <div className="row gap-3">
                    <div className="panel-title">{MONTHS[monthIdx]} ledger</div>
                    <span className="chip tiny">{DEMO_INVOICES.length} items</span>
                  </div>
                  <div className="row gap-2">
                    <div className="pill-row">
                      {(["all", "paid", "pending", "requested", "expected", "overdue"] as const).map((f) => (
                        <span
                          key={f}
                          className={"p" + (filter === f ? " on" : "")}
                          onClick={() => setFilter(f)}
                          style={{ cursor: "pointer" }}
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="panel-body scroll">
                  <table className="pay-tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 30 }}></th>
                        <th>student</th>
                        <th>note</th>
                        <th style={{ width: 90 }}>when</th>
                        <th style={{ width: 70 }}>method</th>
                        <th style={{ width: 100, textAlign: "right" }}>amount</th>
                        <th style={{ width: 30 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((inv) => (
                        <PayRow key={`${inv.who}-${inv.date}`} inv={inv} />
                      ))}
                    </tbody>
                  </table>

                  {filtered.length === 0 && (
                    <div className="small muted center" style={{ padding: "20px 0" }}>
                      nothing in this bucket this month
                    </div>
                  )}
                </div>
              </div>

              <div className="col gap-3" style={{ minHeight: 0 }}>
                <div className="panel" style={{ padding: "12px 14px", flex: "0 0 auto" }}>
                  <div className="panel-head" style={{ marginBottom: 6 }}>
                    <div className="panel-title">trailing 7 months</div>
                    <span className="tiny muted">paid · expected</span>
                  </div>
                  <YearBars
                    data={TRAILING_YEAR_STRIP}
                    onPick={(i) => {
                      // Map the strip index back to a real month index.
                      const map = [9, 10, 11, 0, 1, 2, 3];
                      setMonthIdx(map[i]);
                    }}
                  />
                </div>

                <div className="panel" style={{ padding: "12px 14px", flex: "1 1 auto", minHeight: 0 }}>
                  <div className="panel-head" style={{ marginBottom: 6 }}>
                    <div className="panel-title">expected — looking ahead</div>
                    <span className="chip tiny">3 mo</span>
                  </div>
                  <div className="panel-body scroll col gap-3">
                    {FUTURE_EXPECTED.map((f) => (
                      <div key={f.m} className="box" style={{ padding: "10px 12px" }}>
                        <div className="row between">
                          <div className="row gap-2">
                            <span className="bold big" style={{ fontFamily: "var(--scrawl)" }}>{f.m}</span>
                            <span className="tiny muted">{f.lessons} lessons · {f.students} students</span>
                          </div>
                          <div className="bold" style={{ fontFamily: "var(--scrawl)", fontSize: 22 }}>
                            ~${f.est.toLocaleString()}
                          </div>
                        </div>
                        <div className="small muted mt-1">{f.note}</div>
                        <div className="pay-bar mt-2">
                          <div className="pay-bar-fill" style={{ width: Math.min(100, (f.est / 2400) * 100) + "%" }} />
                        </div>
                      </div>
                    ))}

                    <div className="postit wf-scrawl" style={{ transform: "rotate(-0.6deg)" }}>
                      Quarterly outlook: <span className="hi">$6,120</span> projected · 22% vs last Q
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <YearView
            year={year}
            months={yearMonths}
            totals={yrTotals}
            grandTotal={yrTotal}
            ytdActual={ytdActual}
            bestMonth={bestMonth}
            onPickMonth={(i) => { setMonthIdx(i); setScope("month"); }}
          />
        )}
      </div>
    </DTFrame>
  );
}

function PaymentsOverviewMobile() {
  const summary = [
    { lbl: "collected", amt: "$1,640", tone: "paid",      n: 7 },
    { lbl: "pending",   amt: "$680",   tone: "pending",   n: 3 },
    { lbl: "requested", amt: "$420",   tone: "requested", n: 2 },
    { lbl: "expected",  amt: "$420",   tone: "expected",  n: 2 },
  ] as const;
  const rows: Array<{ who: string; amt: number; st: PayStatus; sub: string }> = [
    { who: "Lina S.",  amt: 240, st: "paid",      sub: "Apr 02 · card" },
    { who: "Maya R.",  amt: 240, st: "paid",      sub: "Apr 14 · autopay" },
    { who: "Jonas K.", amt: 240, st: "pending",   sub: "due Apr 22" },
    { who: "Ana B.",   amt: 200, st: "pending",   sub: "due Apr 24" },
    { who: "Sam W.",   amt: 240, st: "requested", sub: "draft · ready" },
    { who: "Mira O.",  amt: 240, st: "expected",  sub: "autopay Apr 28" },
    { who: "Felix B.", amt: 240, st: "overdue",   sub: "5d late · retry tmrw" },
  ];
  return (
    <WFFrame navActive="home">
      <div className="wf-status">
        <span>9:41</span><span className="dots">• • •</span><span>⌁ 87%</span>
      </div>
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Payments</h2>
          <div className="wf-subtitle">Apr 2026 · ‹ ›</div>
        </div>
        <div className="wf-avatar">K</div>
      </div>
      <div className="wf-body col gap-3 scroll-y">
        <div className="pay-kpis mobile">
          {summary.map((s) => (
            <div key={s.lbl} className={"kpi kpi-" + s.tone}>
              <div className="kpi-lbl">{s.lbl}</div>
              <div className="kpi-amt" style={{ fontSize: 22 }}>{s.amt}</div>
              <div className="kpi-sub">{s.n} items</div>
            </div>
          ))}
        </div>

        <div className="seg">
          <div className="s on">this month</div>
          <div className="s">upcoming</div>
        </div>

        <div className="col gap-2">
          {rows.map((r) => (
            <div key={r.who} className={"box pay-row-mb pay-row-" + r.st} style={{ padding: "10px 12px" }}>
              <div className="row gap-2">
                <Avatar name={r.who} size={30} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="bold">{r.who}</div>
                  <div className="tiny muted">{r.sub}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="bold" style={{ fontFamily: "var(--scrawl)", fontSize: 20, lineHeight: 1 }}>${r.amt}</div>
                  <span className={"pay-pill pay-pill-" + r.st}>{r.st}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="postit wf-scrawl" style={{ transform: "rotate(-0.6deg)" }}>
          Looking ahead: ~$2,280 expected in May
        </div>
      </div>
    </WFFrame>
  );
}

// ── Page entry ────────────────────────────────────────────

export function PaymentsPage() {
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const demoRaw = params.get("stage");
  const demoStage: Stage | null =
    demoRaw === "entry" || demoRaw === "bank" ||
    demoRaw === "verifying" || demoRaw === "connected"
      ? demoRaw
      : null;

  // `?stage=verifying` is also what Stripe redirects back to after
  // hosted onboarding. We poll status while we're in that state and
  // keep the param on the URL so the post-onboarding "celebration"
  // (ConnectedView) renders until the coach explicitly clicks
  // "view payments →".
  const isAfterReturn = demoRaw === "verifying";
  const { status, refresh } = usePaymentStatus({
    poll: isAfterReturn,
    refresh: isAfterReturn,
  });

  const [starting, setStarting] = useState(false);
  const startOnboarding = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    const url = await beginSetup();
    if (url) {
      window.location.href = url;
      return;
    }
    setStarting(false);
  }, [starting]);

  // Switch the coach's processor before they connect, then re-read status so the
  // entry copy + onboarding button follow the new provider.
  const selectProvider = useCallback(async (provider: ProviderId) => {
    if (provider === status.provider) return;
    try {
      await apiFetch("/api/coach-payments/provider", { method: "PATCH", body: JSON.stringify({ provider }) });
      await refresh();
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't switch payment provider.");
    }
  }, [status.provider, refresh]);

  const clearStage = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("stage");
    setParams(next, { replace: true });
  }, [params, setParams]);

  if (isMobile) {
    return status.payoutsEnabled ? <PaymentsOverviewMobile /> : <PaymentsMobile />;
  }

  // Pure-demo overrides for design review.
  if (demoStage === "bank") {
    return (
      <BankView
        onBack={clearStage}
        onContinue={() => {
          const next = new URLSearchParams(params);
          next.set("stage", "verifying");
          setParams(next, { replace: true });
        }}
      />
    );
  }
  if (demoStage === "connected" && !isAfterReturn) {
    return <ConnectedView onViewPayments={clearStage} />;
  }
  if (demoStage === "entry") {
    return (
      <EntryView
        onBegin={startOnboarding}
        resume={false}
        starting={starting}
        provider={status.provider}
        onSelectProvider={selectProvider}
      />
    );
  }

  // Real-status path.
  // After returning from Stripe with payouts enabled, show the
  // ConnectedView celebration; the "view payments →" button drops
  // the stage param and renders the overview.
  if (isAfterReturn && status.payoutsEnabled) {
    return <ConnectedView onViewPayments={clearStage} />;
  }
  if (isAfterReturn) return <VerifyingView />;

  const derived = stageFromStatus(status);
  if (derived === "verifying") return <VerifyingView />;
  if (derived === "connected") return <PaymentsOverviewDesktop />;
  return (
    <EntryView
      onBegin={startOnboarding}
      resume={status.hasAccount}
      starting={starting}
      provider={status.provider}
      onSelectProvider={selectProvider}
    />
  );
}
