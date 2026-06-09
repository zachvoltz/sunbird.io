// Coach landing — faithful port of the "sunbird" Soft Sunrise marketing page
// from the Claude Design handoff (songbird/project/Coach Landing - sunbird.html
// → sunbird-page.jsx + sunbird-heroes.jsx). Styles live in coach-landing.css,
// scoped under .sunbird-landing.
//
// CoachEntry serves this page at /coach for the public and logged-out visitors,
// and redirects signed-in coaches/admins to their roster at /coach/roster.

import { useState, useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import "./coach-landing.css";

// Real signup entry point — mirrors the Home page's "Teach on Birdie" CTA.
const SIGNUP_COACH = "/login?tab=register&role=coach";
const SIGNIN = "/login";

// ── brand mark (the sunbird bird logo) ────────────────────
const Mark = () => (
  <img className="mark" src="/sunbird-icon.png" alt="sunbird logo" style={{ objectFit: "contain" }} />
);

// ── shared product mock ───────────────────────────────────
const Lesson = ({
  initial,
  name,
  inst,
  time,
  color,
  go,
  paid,
}: {
  initial: string;
  name: string;
  inst: string;
  time: string;
  color: string;
  go?: boolean;
  paid?: boolean;
}) => (
  <div className="pm-row">
    <span className="ava" style={{ background: color }}>{initial}</span>
    <span className="who"><b>{name}</b><span>{inst}</span></span>
    <span className="time">{time}</span>
    {go && <span className="go">Join</span>}
    {paid && <span className="paid">✓ Paid</span>}
  </div>
);

const ProductMock = () => (
  <div className="pm">
    <div className="pm-top">
      <div className="pm-dots"><i /><i /><i /></div>
      <span className="pm-title">sunbird · studio</span>
      <div className="pm-tabs"><span className="on">Today</span><span>Students</span><span>Library</span><span>Payments</span></div>
    </div>
    <div className="pm-body">
      <div className="pm-panel">
        <div className="pm-h">Today · 4 lessons <span className="pill">Tue, Jun 2</span></div>
        <Lesson initial="M" name="Maya R." inst="Piano · 30 min" time="3:00" color="#e0884a" go />
        <Lesson initial="T" name="Theo P." inst="Guitar · 45 min" time="4:00" color="#7b9bd1" paid />
        <Lesson initial="L" name="Lina S." inst="Voice · 30 min" time="5:00" color="#cf6f8a" paid />
        <Lesson initial="J" name="Jonas K." inst="Piano · 30 min" time="5:45" color="#6fa888" paid />
      </div>
      <div className="pm-panel">
        <div className="pm-h">This week</div>
        <div className="pm-ring">
          <svg width="58" height="58" viewBox="0 0 58 58">
            <circle cx="29" cy="29" r="24" fill="none" stroke="var(--pm-bar-dim)" strokeWidth="7" />
            <circle
              cx="29" cy="29" r="24" fill="none" stroke="var(--pm-accent)" strokeWidth="7"
              strokeLinecap="round" strokeDasharray="150.8" strokeDashoffset="36"
              transform="rotate(-90 29 29)"
            />
          </svg>
          <div>
            <div className="num">76%</div>
            <div className="lbl">practiced</div>
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--pm-ink)" }}>Practice streak</div>
        <div className="pm-bars">
          <i style={{ height: "55%" }} /><i style={{ height: "80%" }} /><i style={{ height: "40%" }} />
          <i style={{ height: "95%" }} /><i style={{ height: "70%" }} /><i className="dim" style={{ height: "30%" }} />
          <i className="dim" style={{ height: "20%" }} />
        </div>
        <div className="pm-mini">
          <span className="mv">$1,840</span>
          <span className="ml">collected<br />this month</span>
        </div>
      </div>
    </div>
  </div>
);

// ── nav ───────────────────────────────────────────────────
const PageNav = () => {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={"nav" + (stuck ? " stuck" : "")}>
      <div className="nav-inner">
        <Link className="logo" to="/"><Mark /><span className="name">sunbird</span></Link>
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="nav-right">
          <Link className="signin" to={SIGNIN}>Sign in</Link>
          <Link className="btn btn-primary" to={SIGNUP_COACH}>Start free</Link>
        </div>
      </div>
    </header>
  );
};

// ── hero ──────────────────────────────────────────────────
const Hero = () => (
  <section className="hero">
    <div className="hero-inner">
      <div>
        <span className="eyebrow">☀ teach more, manage less</span>
        <h1 style={{ marginTop: 26 }}>Teaching, minus<br />the <span className="hl">busywork.</span></h1>
        <p className="sub">Booking, recurring payments, practice plans, lesson notes — sunbird quietly runs the studio side of your teaching, so every hour goes to your students.</p>
        <div className="cta-row">
          <Link className="btn btn-primary btn-lg" to={SIGNUP_COACH}>Start free →</Link>
          <a className="btn btn-ghost btn-lg" href="#how">▶ See how it works</a>
        </div>
        <div className="cta-note">Free for 30 days · no card required · cancel anytime</div>
        <div className="trust">
          <div className="avs"><span>R</span><span>D</span><span>M</span><span>S</span></div>
          <div className="trust-txt"><span className="stars">★★★★★</span><br />Trusted by 2,000+ private teachers in 40+ countries</div>
        </div>
      </div>
      <div className="hero-art">
        <div className="bloom" />
        <ProductMock />
        <div className="pm-float" style={{ right: -28, top: -30 }}>
          <span className="ic" style={{ background: "#fde6dc" }}>📅</span>
          <div><b>Weekly lessons booked</b><span>Recurring · auto-reminders</span></div>
        </div>
        <div className="pm-float" style={{ left: -30, bottom: -24 }}>
          <span className="ic" style={{ background: "#e2f1e8" }}>🎵</span>
          <div><b>New take from Theo</b><span>Sent you a recording</span></div>
        </div>
      </div>
    </div>
  </section>
);

// ── trust strip ───────────────────────────────────────────
const Strip = () => (
  <div className="strip">
    <div className="wrap strip-inner">
      <span className="lead">As used in studios teaching</span>
      <div className="marks">
        <span>♪ Piano</span><span>♫ Guitar</span><span>𝄞 Voice</span><span>𝄢 Strings</span><span>♩ Woodwind</span>
      </div>
    </div>
  </div>
);

// ── value props ───────────────────────────────────────────
const VALUES = [
  { ic: "💸", t: "Get paid effortlessly", p: "Stripe-powered recurring billing collects tuition on time — no invoices, no awkward reminders." },
  { ic: "📅", t: "Scheduling that repeats", p: "Set weekly slots once. Reschedules, reminders, and time-zones all handle themselves." },
  { ic: "🔥", t: "Students who practice", p: "Practice paths and streaks turn 'did you practice?' into a habit they actually keep." },
  { ic: "🎙", t: "Record & send takes", p: "Capture lessons, send notes and audio takes home — feedback that lands between sessions." },
  { ic: "📚", t: "Reusable library & paths", p: "Build exercises and lesson paths once, assign them to any student in two clicks." },
  { ic: "📈", t: "Everyone in one place", p: "Every student's progress, notes, and history on a single calm dashboard." },
  { ic: "✦", t: "Your studio, your brand", p: "A polished space that looks like you — not a spreadsheet held together with tape." },
  { ic: "⏱", t: "Hours back each week", p: "Admin that used to eat your evenings runs quietly in the background instead." },
];
const Values = () => (
  <section className="section" id="features">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">everything in one place</span>
        <h2>Your whole studio, gently handled</h2>
        <p>The teaching is yours. sunbird takes care of the rest — quietly, in the background.</p>
      </div>
      <div className="cards">
        {VALUES.map((v) => (
          <div className="card" key={v.t}>
            <div className="ic">{v.ic}</div>
            <h3>{v.t}</h3>
            <p>{v.p}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── how it works ──────────────────────────────────────────
const Steps = () => (
  <section className="section tint-band" id="how">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">up and running in an afternoon</span>
        <h2>Three steps to a calmer studio</h2>
      </div>
      <div className="steps">
        {[
          { n: "1", t: "Set up your studio", p: "Add your instruments, lesson lengths, and rates. Connect Stripe in a couple of taps." },
          { n: "2", t: "Invite your students", p: "Send a link. They book recurring slots, and reminders go out on their own." },
          { n: "3", t: "Teach & get paid", p: "Run lessons, assign practice, send notes. Tuition collects itself, every month." },
        ].map((s) => (
          <div className="step" key={s.n}>
            <div className="n">{s.n}</div>
            <h3>{s.t}</h3>
            <p>{s.p}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── feature mini visuals ──────────────────────────────────
const PracticePathMini = () => {
  const stops = [
    { x: 70, y: 240, st: "done" }, { x: 150, y: 175, st: "done" },
    { x: 235, y: 210, st: "current" }, { x: 320, y: 140, st: "todo" },
    { x: 360, y: 60, st: "todo" },
  ];
  const path = "M70 240 Q110 200 150 175 Q200 150 235 210 Q280 250 320 140 Q345 95 360 60";
  return (
    <div className="panel-soft">
      <div className="pp">
        <div className="pp-flame"><b>🔥 14</b><span>day streak</span></div>
        <svg viewBox="0 0 420 290">
          <path d={path} fill="none" stroke="#f1e6dc" strokeWidth="14" strokeLinecap="round" />
          <path d="M70 240 Q110 200 150 175 Q200 150 235 210" fill="none" stroke="#ee7a52" strokeWidth="14" strokeLinecap="round" />
          {stops.map((s, i) => {
            const done = s.st === "done";
            const cur = s.st === "current";
            return (
              <g key={i}>
                {cur && <circle cx={s.x} cy={s.y} r="22" fill="none" stroke="#ee7a52" strokeWidth="2" strokeDasharray="4 4" />}
                <circle cx={s.x} cy={s.y} r="15" fill={done ? "#ee7a52" : "#fff"} stroke={cur ? "#ee7a52" : "#e7d3c6"} strokeWidth={cur ? 3 : 2} />
                <text x={s.x} y={s.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={done ? "#fff" : "#c98a5f"} fontFamily="Schibsted Grotesk">{done ? "✓" : i + 1}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

const PaymentsMini = () => (
  <div className="panel-soft">
    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>June · auto-collected</div>
    {[
      { i: "M", n: "Maya R.", a: "$120", c: "#e0884a" },
      { i: "T", n: "Theo P.", a: "$180", c: "#7b9bd1" },
      { i: "L", n: "Lina S.", a: "$120", c: "#cf6f8a" },
      { i: "J", n: "Jonas K.", a: "$120", c: "#6fa888" },
    ].map((r) => (
      <div className="pay-row" key={r.i}>
        <div className="who"><span className="ava" style={{ background: r.c }}>{r.i}</span><b>{r.n}</b></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="amt">{r.a}</span><span className="paid">✓ Paid</span>
        </div>
      </div>
    ))}
    <div className="pay-total"><span style={{ fontWeight: 600, color: "var(--ink-2)" }}>Collected this month</span><span className="big">$1,840</span></div>
  </div>
);

const RecordingMini = () => (
  <div className="panel-soft">
    <div className="rec-play">
      <div className="pbtn">▶</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Lesson · River Flows</div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>28:14 · sent to Maya</div>
      </div>
    </div>
    <div className="rec-wave">
      {[40, 70, 55, 90, 60, 80, 45, 95, 70, 50, 85, 60, 75, 40, 65, 88, 52, 72, 46, 80, 58, 92, 48, 68].map((h, i) => (
        <i key={i} className={i > 13 ? "dim" : ""} style={{ height: h + "%" }} />
      ))}
    </div>
    <div className="rec-note">
      <div className="lbl">Note to Maya</div>
      <p>"Bar 20 swell really came through today — keep River at 88 and shape the ending. Send me a take by Wed!"</p>
    </div>
  </div>
);

const Feature = ({
  tag,
  title,
  body,
  points,
  art,
  flip,
}: {
  tag: string;
  title: string;
  body: string;
  points: string[];
  art: ReactNode;
  flip?: boolean;
}) => (
  <div className={"feat" + (flip ? " flip" : "")}>
    <div className="feat-text">
      <span className="tag">{tag}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <ul className="feat-list">
        {points.map((p) => <li key={p}><span className="ck">✓</span><span>{p}</span></li>)}
      </ul>
    </div>
    <div className="feat-art">{art}</div>
  </div>
);

const Features = () => (
  <section className="section">
    <div className="wrap">
      <Feature
        tag="Practice paths"
        title="Practice that actually happens"
        body="Lay out a winding path of exercises and pieces. Students see exactly what's next, build streaks, and arrive to lessons ready."
        points={["Drag exercises into a personalised weekly path", "Streaks and progress that motivate without nagging", "See who practiced — and who needs a nudge"]}
        art={<PracticePathMini />}
      />
      <Feature
        flip
        tag="Payments"
        title="Tuition that collects itself"
        body="Connect Stripe once. sunbird bills recurring lessons automatically and reconciles every payment — so money is never an awkward conversation."
        points={["Recurring billing for weekly & monthly students", "Automatic receipts and gentle reminders", "One clear view of what's collected and pending"]}
        art={<PaymentsMini />}
      />
      <Feature
        tag="Lessons & recordings"
        title="Feedback that lasts the week"
        body="Record a lesson or a quick take, attach a note, and send it home. Your students keep improving between the sessions, not just during them."
        points={["Record audio & video right from a lesson", "Send timestamped notes and takes to students", "Everything saved to each student's history"]}
        art={<RecordingMini />}
      />
    </div>
  </section>
);

// ── social proof ──────────────────────────────────────────
const Social = () => (
  <section className="section tint-band">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">loved by teachers</span>
        <h2>Studios run calmer on sunbird</h2>
      </div>
      <div className="quotes">
        {[
          { q: "I got my evenings back. Billing and reminders just… happen now, and my students practice more than they ever did.", n: "Rosa D.", r: "Piano · 32 students", c: "#e0884a" },
          { q: "The practice paths are the secret. Kids show up prepared because they always know what's next.", n: "Daniel M.", r: "Guitar · 24 students", c: "#7b9bd1" },
          { q: "Setup took an afternoon. It looks like my studio, not some generic app, and parents love the recordings.", n: "Mei S.", r: "Violin · 19 students", c: "#cf6f8a" },
        ].map((t) => (
          <div className="quote" key={t.n}>
            <div className="stars">★★★★★</div>
            <p>"{t.q}"</p>
            <div className="by"><span className="ava" style={{ background: t.c }}>{t.n[0]}</span><div><b>{t.n}</b><span>{t.r}</span></div></div>
          </div>
        ))}
      </div>
      <div className="stats">
        <div className="stat"><div className="v">11 hrs</div><div className="l">admin saved every month</div></div>
        <div className="stat"><div className="v">98%</div><div className="l">of tuition collected on time</div></div>
        <div className="stat"><div className="v">2.3×</div><div className="l">more consistent practice</div></div>
      </div>
    </div>
  </section>
);

// ── pricing ───────────────────────────────────────────────
const Pricing = () => (
  <section className="section" id="pricing">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">simple, honest pricing</span>
        <h2>One calm tool. Two plans.</h2>
        <p>Start free for 30 days. No card required — keep your data whatever you decide.</p>
      </div>
      <div style={{ textAlign: "center" }}>
        <span className="price-trial">✦ 30-day free trial on every plan</span>
      </div>
      <div className="price-wrap">
        <div className="plan">
          <div className="pname">Solo</div>
          <div className="pdesc">Everything one teacher needs to run a tidy, thriving studio.</div>
          <div className="price"><span className="amt">$12</span><span className="per">/month</span></div>
          <div className="price-note">for a single coach · billed monthly</div>
          <Link className="btn btn-primary" to={SIGNUP_COACH}>Start free →</Link>
          <ul className="plist">
            {["Unlimited students", "Scheduling & recurring sessions", "Stripe payments & recurring billing", "Practice paths & streaks", "Lesson recordings & takes", "Reusable library & lesson paths", "Progress tracking & notes", "Your own studio brand"].map((f) => (
              <li key={f}><span className="ck">✓</span><span>{f}</span></li>
            ))}
          </ul>
        </div>
        <div className="plan feature">
          <div className="badge">For studios</div>
          <div className="pname">Studio</div>
          <div className="pdesc">Run a multi-teacher studio with shared content and per-coach payouts.</div>
          <div className="price"><span className="amt">$18</span><span className="per">/month</span></div>
          <div className="price-note">+ $4/month per additional coach</div>
          <Link className="btn btn-primary" to={SIGNUP_COACH}>Start free →</Link>
          <ul className="plist">
            {["Everything in Solo", "Multiple coaches under one studio", "Shared library & lesson paths", "Studio-wide roster & reporting", "Per-coach Stripe payouts", "Admin & teacher roles"].map((f) => (
              <li key={f}><span className="ck">✓</span><span>{f}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  </section>
);

// ── faq ───────────────────────────────────────────────────
const FAQ = () => (
  <section className="section" id="faq">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">good to know</span>
        <h2>Questions, answered</h2>
      </div>
      <div className="faq">
        {[
          { q: "Do I need a credit card to start?", a: "No. The 30-day free trial needs no card — you only add payment details if you decide to keep using sunbird." },
          { q: "How do payments work?", a: "sunbird connects to your own Stripe account. You set each student's rate and schedule, and tuition is billed automatically. Payouts land directly in your bank — sunbird never holds your money." },
          { q: "Can students use sunbird too?", a: "Yes. Students get a simple app to see their practice path, book lessons, receive your notes and recordings, and track their streaks." },
          { q: "What if I teach with other coaches?", a: "The Studio plan lets you add coaches under one roof with shared libraries and per-coach payouts — $18/month plus $4/month for each additional coach." },
          { q: "Can I move my existing students over?", a: "Absolutely. Invite them with a link and import your schedule; most teachers are fully set up in an afternoon." },
          { q: "Is my data mine?", a: "Always. You can export your students, notes, and history at any time, and you keep everything if you cancel." },
        ].map((f, i) => (
          <details key={i} open={i === 0 ? true : undefined}>
            <summary>{f.q}<span className="pm-plus">+</span></summary>
            <div className="ans">{f.a}</div>
          </details>
        ))}
      </div>
    </div>
  </section>
);

// ── closing CTA + footer ──────────────────────────────────
const Closing = () => (
  <section className="section" style={{ paddingTop: 0 }}>
    <div className="wrap">
      <div className="cta-band">
        <h2>Spend your day teaching,<br />not chasing admin.</h2>
        <p>Join thousands of private teachers running a calmer studio with sunbird.</p>
        <Link className="btn btn-light btn-lg" to={SIGNUP_COACH}>Start free for 30 days →</Link>
        <div className="cta-note">No card required · set up in an afternoon</div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="footer">
    <div className="wrap footer-inner">
      <div>
        <div className="logo"><Mark /><span className="name">sunbird</span></div>
        <p className="blurb">The calm studio tool for independent music teachers. Scheduling, payments, and practice — gently handled.</p>
      </div>
      <div><h4>Product</h4><ul><li><a href="#features">Features</a></li><li><a href="#pricing">Pricing</a></li><li><a href="#how">How it works</a></li><li><Link to="/">For students</Link></li></ul></div>
      <div><h4>Company</h4><ul><li><a href="#">About</a></li><li><a href="#">Blog</a></li><li><a href="#">Careers</a></li><li><a href="#">Contact</a></li></ul></div>
      <div><h4>Support</h4><ul><li><a href="#faq">Help center</a></li><li><a href="#">Setup guide</a></li><li><Link to="/privacy">Privacy</Link></li><li><Link to="/terms">Terms</Link></li></ul></div>
    </div>
    <div className="footer-base">
      <span>© 2026 sunbird. Made for teachers.</span>
      <span>♪ Built with care</span>
    </div>
  </footer>
);

export function CoachLanding() {
  return (
    <div className="sunbird-landing">
      <PageNav />
      <Hero />
      <Strip />
      <Values />
      <Steps />
      <Features />
      <Social />
      <Pricing />
      <FAQ />
      <Closing />
      <Footer />
    </div>
  );
}

// Public entry at /coach: signed-in coaches/admins go to their roster; everyone
// else (logged-out visitors, prospective coaches, students) sees the landing.
export function CoachEntry() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user && (user.role === "COACH" || user.role === "ADMIN")) {
    return <Navigate to="/coach/roster" replace />;
  }
  return <CoachLanding />;
}
