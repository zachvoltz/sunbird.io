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

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { useIsMobile } from "../hooks/useIsMobile";
import { apiFetch } from "@/lib/api";

type Stage = "entry" | "bank" | "verifying" | "connected";

type StripeStatus = {
  hasStripeAccount: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  stripeAccountId: string | null;
};

const EMPTY_STATUS: StripeStatus = {
  hasStripeAccount: false,
  detailsSubmitted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  stripeAccountId: null,
};

function stageFromStatus(s: StripeStatus): Stage {
  if (!s.hasStripeAccount) return "entry";
  if (!s.detailsSubmitted) return "entry";
  if (!s.payoutsEnabled || !s.chargesEnabled) return "verifying";
  return "connected";
}

function useStripeStatus(opts: { poll?: boolean; refresh?: boolean }) {
  const [status, setStatus] = useState<StripeStatus | undefined>();
  const [loading, setLoading] = useState(true);
  const [unconfigured, setUnconfigured] = useState(false);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await apiFetch<{ data: StripeStatus }>(
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
      apiFetch<{ data: StripeStatus }>("/api/coach-payments/status?refresh=1")
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
}: {
  onBegin: () => void;
  resume?: boolean;
  starting?: boolean;
}) {
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
            <div className="onb-hero-sub">
              We use <span className="bold">Stripe</span> to move money safely.
              You'll need:
            </div>
            <ul className="onb-list">
              <li><span className="onb-bullet">①</span> Legal name + date of birth</li>
              <li><span className="onb-bullet">②</span> A US bank account (checking)</li>
              <li><span className="onb-bullet">③</span> A photo ID (driver's license or passport)</li>
              <li><span className="onb-bullet">④</span> Last 4 of SSN (for tax reporting)</li>
            </ul>
            <div className="row gap-2 mt-3">
              <button className="btn primary big" onClick={onBegin} disabled={starting}>
                {starting ? "opening Stripe…" : resume ? "resume setup →" : "begin setup →"}
              </button>
              <button className="btn ghost big">I'll do this later</button>
            </div>
            <div className="mt-3">
              <PoweredByStripe />
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

function ConnectedView() {
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
                <button className="btn primary big">＋ send first invoice</button>
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

  // The `?stage=verifying` URL is also what Stripe redirects back to
  // after hosted onboarding completes. While we're in that state we
  // poll status so the page advances to Connected the moment Stripe
  // flips the account to enabled.
  const isAfterReturn = demoRaw === "verifying";
  const { status } = useStripeStatus({
    poll: isAfterReturn,
    refresh: isAfterReturn,
  });

  // Once Stripe flips payouts enabled, drop the stage param so a
  // future refresh lands on the canonical /coach/payments URL.
  useEffect(() => {
    if (isAfterReturn && status.payoutsEnabled) {
      const next = new URLSearchParams(params);
      next.delete("stage");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAfterReturn, status.payoutsEnabled]);

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

  if (isMobile) return <PaymentsMobile />;

  // Pure-demo overrides — `?stage=bank` etc. without real status. The
  // verifying URL is special-cased above (real status takes over).
  if (demoStage === "bank") {
    return (
      <BankView
        onBack={() => {
          const next = new URLSearchParams(params);
          next.delete("stage");
          setParams(next, { replace: true });
        }}
        onContinue={() => {
          const next = new URLSearchParams(params);
          next.set("stage", "verifying");
          setParams(next, { replace: true });
        }}
      />
    );
  }
  if (demoStage === "connected" && !isAfterReturn) return <ConnectedView />;
  if (demoStage === "entry") {
    return <EntryView onBegin={startOnboarding} resume={false} starting={starting} />;
  }

  // Real-status path.
  const derived = stageFromStatus(status);
  if (isAfterReturn || derived === "verifying") return <VerifyingView />;
  if (derived === "connected") return <ConnectedView />;
  return (
    <EntryView
      onBegin={startOnboarding}
      resume={status.hasStripeAccount}
      starting={starting}
    />
  );
}
