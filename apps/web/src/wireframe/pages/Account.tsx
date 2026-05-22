import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
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
          <div className="col gap-3 scroll" style={{ paddingRight: 4 }}>
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
