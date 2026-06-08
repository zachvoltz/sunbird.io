// Overview — the main homepage (usesunbird.com /). Introduces sunbird as one
// place connecting teachers and students, and routes to the coach (/coach) and
// student (/student) landing pages. Faithful port of the "Sunbird - Overview"
// design handoff (overview-page.jsx).
//
// Reuses the shared sunbird-page brand system (coach-landing.css, scoped under
// .sunbird-landing) plus the overview-specific visuals from overview-landing.css
// (hero connection diagram, two audience cards, the loop).

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./coach-landing.css"; // shared sunbird-page base (scoped under .sunbird-landing)
import "./overview-landing.css"; // overview-specific additions

const COACH = "/coach";
const STUDENT = "/student";
const SIGNIN = "/login";

// ── brand mark ────────────────────────────────────────────
const OvMark = () => (
  <svg className="mark" viewBox="0 0 32 32" fill="none">
    <circle cx="16" cy="16" r="15" fill="var(--accent-2)" opacity="0.16" />
    <path
      d="M7 19c3.5 0.4 6-1.2 7.6-4 0.7 2 0.4 3.8-0.7 5.4 2.8-0.3 4.9-1.9 6.4-4.9 0.9 1.8 0.9 3.6 0.1 5.4 1.7-0.6 3-1.8 3.9-3.7"
      stroke="var(--accent)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="22.5" cy="10.5" r="1.6" fill="var(--accent)" />
  </svg>
);

// ── nav ───────────────────────────────────────────────────
const OvNav = () => {
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
        <Link className="logo" to="/"><OvMark /><span className="name">sunbird</span></Link>
        <nav className="nav-links">
          <Link to={COACH}>For teachers</Link>
          <Link to={STUDENT}>For students</Link>
          <a href="#connect">How it works</a>
          <a href="#why">Why sunbird</a>
        </nav>
        <div className="nav-right">
          <Link className="signin" to={SIGNIN}>Sign in</Link>
          <a className="btn btn-primary" href="#choose">Get started</a>
        </div>
      </div>
    </header>
  );
};

// ── hero connection diagram ───────────────────────────────
const ConnectDiagram = () => (
  <div className="ov-diagram">
    <svg className="arc" viewBox="0 0 540 460" fill="none">
      {/* coach → student (down the middle-left) */}
      <path d="M 150 150 C 230 215, 300 235, 380 300" stroke="var(--accent)" strokeWidth="2.5" strokeDasharray="3 7" strokeLinecap="round" />
      {/* student → coach (loops back, right) */}
      <path d="M 388 326 C 320 360, 250 320, 168 196" stroke="var(--accent-light)" strokeWidth="2.5" strokeDasharray="3 7" strokeLinecap="round" />
    </svg>

    {/* coach node */}
    <div className="ov-node ov-node-coach">
      <div className="nh">
        <span className="ava" style={{ background: "#e0884a" }}>K</span>
        <div><b>Mr. Klein</b><span>piano teacher</span></div>
        <span className="role">teaches</span>
      </div>
      <div className="nrow"><span className="ic">🛤</span> Builds Maya's practice path</div>
      <div className="nrow"><span className="ic">💸</span> Tuition auto-collected</div>
    </div>

    {/* student node */}
    <div className="ov-node ov-node-student">
      <div className="nh">
        <span className="ava" style={{ background: "#cf6f8a" }}>M</span>
        <div><b>Maya</b><span>learning piano</span></div>
        <span className="role">practices</span>
      </div>
      <div className="ph-mini">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)" }}>This week</span>
          <span className="pm-flame">🔥 14</span>
        </div>
        <div className="bars">
          <i style={{ height: "55%" }} /><i style={{ height: "80%" }} /><i style={{ height: "45%" }} />
          <i style={{ height: "95%" }} /><i style={{ height: "70%" }} /><i style={{ height: "85%" }} /><i className="dim" style={{ height: "30%" }} />
        </div>
      </div>
    </div>

    <div className="ov-flow ov-flow-down"><span className="dot" /> assigns a path</div>
    <div className="ov-flow ov-flow-up">progress &amp; takes <span className="dot" /></div>
  </div>
);

const OvHero = () => (
  <section className="hero">
    <div className="hero-inner">
      <div>
        <span className="eyebrow">☀ the calm home for music lessons</span>
        <h1 style={{ marginTop: 26 }}>Where teaching<br />and practice <span className="hl">meet.</span></h1>
        <p className="sub">sunbird connects teachers and students in one calm place — lessons, payments, practice paths and progress, all flowing between you. Pick your side to see how it works.</p>
        <div className="cta-row">
          <Link className="btn btn-primary btn-lg" to={COACH}>I'm a teacher →</Link>
          <Link className="btn btn-ghost btn-lg" to={STUDENT}>I'm a student →</Link>
        </div>
        <div className="cta-note">Free for teachers for 30 days · students join by invite</div>
        <div className="trust">
          <div className="avs"><span>R</span><span>D</span><span>M</span><span>S</span></div>
          <div className="trust-txt"><span className="stars">★★★★★</span><br />2,000+ teachers and their students, in 40+ countries</div>
        </div>
      </div>
      <div className="ov-heroart">
        <div className="bloom" />
        <ConnectDiagram />
      </div>
    </div>
  </section>
);

// ── instrument strip ──────────────────────────────────────
const OvStrip = () => (
  <div className="strip">
    <div className="wrap strip-inner">
      <span className="lead">One studio, every instrument</span>
      <div className="marks">
        <span>♪ Piano</span><span>♫ Guitar</span><span>𝄞 Voice</span><span>𝄢 Strings</span><span>♩ Woodwind</span>
      </div>
    </div>
  </div>
);

// ── the two-audience split (the routing cards) ────────────
const OvChoose = () => (
  <section className="section" id="choose">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">two sides, one app</span>
        <h2>Which brings you here?</h2>
        <p>sunbird has a side made for teaching and a side made for practising — built to work together.</p>
      </div>

      <div className="ov-paths">
        {/* TEACHER */}
        <div className="ov-pathcard">
          <span className="pc-eyebrow">For teachers &amp; studios</span>
          <h3>Run a calmer studio</h3>
          <p className="pc-sub">Scheduling, recurring payments, practice plans and lesson notes — the studio side of teaching, quietly handled.</p>
          <ul className="pc-list">
            <li><span className="ck">✓</span><span>Recurring Stripe billing that collects itself</span></li>
            <li><span className="ck">✓</span><span>Weekly scheduling with automatic reminders</span></li>
            <li><span className="ck">✓</span><span>Build practice paths &amp; see who's practising</span></li>
          </ul>
          <div className="pc-visual">
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)", marginBottom: 10 }}>Today · 3 lessons</div>
            <div className="pcv-row"><span className="ava" style={{ background: "#e0884a" }}>M</span><span className="who"><b>Maya R.</b><span>Piano · 3:00</span></span><span className="go">Join</span></div>
            <div className="pcv-row"><span className="ava" style={{ background: "#7b9bd1" }}>T</span><span className="who"><b>Theo P.</b><span>Guitar · 4:00</span></span><span className="paid">✓ Paid</span></div>
            <div className="pcv-row"><span className="ava" style={{ background: "#6fa888" }}>J</span><span className="who"><b>Jonas K.</b><span>Piano · 5:00</span></span><span className="paid">✓ Paid</span></div>
          </div>
          <div className="pc-cta">
            <Link className="btn btn-primary btn-lg" to={COACH}>Explore sunbird for teachers →</Link>
          </div>
        </div>

        {/* STUDENT */}
        <div className="ov-pathcard">
          <span className="pc-eyebrow">For students &amp; families</span>
          <h3>Practice you'll keep up</h3>
          <p className="pc-sub">A daily path from your teacher, streaks that keep you going, and progress you can actually watch grow.</p>
          <ul className="pc-list">
            <li><span className="ck">✓</span><span>Open the app to today's guided practice path</span></li>
            <li><span className="ck">✓</span><span>Streaks &amp; a weekly goal that build the habit</span></li>
            <li><span className="ck">✓</span><span>Send takes and keep every lesson note in one place</span></li>
          </ul>
          <div className="pc-visual">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ink-3)" }}>Tuesday's path</span>
              <span className="pcv-flame">🔥 14</span>
            </div>
            <div className="pcv-path">
              <div className="stops">
                <span className="s done">✓</span><span className="ln done" />
                <span className="s done">✓</span><span className="ln done" />
                <span className="s now">3</span><span className="ln" />
                <span className="s todo">4</span><span className="ln" />
                <span className="s todo">♪</span>
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 12 }}>2 of 5 stops done · about 25 min total</div>
          </div>
          <div className="pc-cta">
            <Link className="btn btn-primary btn-lg" to={STUDENT}>Explore sunbird for students →</Link>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ── how it connects ───────────────────────────────────────
const OvConnect = () => (
  <section className="section tint-band" id="connect">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">how it works</span>
        <h2>One loop between every lesson</h2>
        <p>What the teacher sets flows to the student; what the student does flows back. No chasing, no guessing.</p>
      </div>
      <div className="loop">
        <div className="loop-step">
          <div className="lic">🛤</div>
          <div className="who-tag">Teacher</div>
          <h3>Assigns the week</h3>
          <p>After a lesson, your teacher drops exercises and pieces into a practice path and sends a note — in a couple of taps.</p>
          <div className="loop-arrow">→</div>
        </div>
        <div className="loop-step">
          <div className="lic">🎧</div>
          <div className="who-tag">Student</div>
          <h3>Practises &amp; sends takes</h3>
          <p>The student opens today's path, plays through each stop, keeps their streak, and records a take to send back.</p>
          <div className="loop-arrow">→</div>
        </div>
        <div className="loop-step">
          <div className="lic">📈</div>
          <div className="who-tag">Teacher</div>
          <h3>Sees the progress</h3>
          <p>Streaks, finished stops and new takes land before the next lesson — so teaching picks up right where practice left off.</p>
        </div>
      </div>
    </div>
  </section>
);

// ── shared value cards ────────────────────────────────────
const OV_VALUES = [
  { ic: "🔁", t: "Always in sync", p: "Lesson plans, notes and takes flow between teacher and student automatically." },
  { ic: "💸", t: "Payments, sorted", p: "Recurring Stripe billing collects tuition on time — no invoices, no awkward chats." },
  { ic: "🔥", t: "Practice that sticks", p: "Paths and streaks turn 'did you practice?' into a habit students actually keep." },
  { ic: "🎙", t: "Feedback between lessons", p: "Record and send takes with notes, so progress doesn't pause until next week." },
  { ic: "📱", t: "On every device", p: "Teach from the desktop, practise from a phone — everything stays in step." },
  { ic: "✦", t: "Calm, not cluttered", p: "One gentle, focused space that looks like your studio, not a spreadsheet." },
];
const OvValues = () => (
  <section className="section" id="why">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">why sunbird</span>
        <h2>Better for both sides of the lesson</h2>
        <p>The whole point: teachers and students moving forward together, with less friction in between.</p>
      </div>
      <div className="cards">
        {OV_VALUES.map((v) => (
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

// ── social proof (both sides) ─────────────────────────────
const OvSocial = () => (
  <section className="section tint-band">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">loved on both sides</span>
        <h2>Teachers and students agree</h2>
      </div>
      <div className="quotes">
        {[
          { q: "I got my evenings back. Billing and reminders just happen now, and my students practise more than ever.", n: "Rosa D.", r: "Piano teacher · 32 students", c: "#e0884a" },
          { q: "I just open the path and go — and my streak is at 40 days. I always know what to practise.", n: "Maya, 14", r: "Student · piano", c: "#cf6f8a" },
          { q: "Setup took an afternoon, and parents love the recordings. It looks like my studio, not a generic app.", n: "Mei S.", r: "Violin teacher · 19 students", c: "#7b9bd1" },
        ].map((t) => (
          <div className="quote" key={t.n}>
            <div className="stars">★★★★★</div>
            <p>"{t.q}"</p>
            <div className="by"><span className="ava" style={{ background: t.c }}>{t.n[0]}</span><div><b>{t.n}</b><span>{t.r}</span></div></div>
          </div>
        ))}
      </div>
      <div className="stats">
        <div className="stat"><div className="v">11 hrs</div><div className="l">admin saved per teacher each month</div></div>
        <div className="stat"><div className="v">2.3×</div><div className="l">more consistent student practice</div></div>
        <div className="stat"><div className="v">98%</div><div className="l">of tuition collected on time</div></div>
      </div>
    </div>
  </section>
);

// ── closing CTA (routes both ways) ────────────────────────
const OvClosing = () => (
  <section className="section" style={{ paddingTop: 0 }}>
    <div className="wrap">
      <div className="cta-band">
        <h2>Whether you teach it<br />or you're learning it.</h2>
        <p>Start with the side that's yours — sunbird brings the other along.</p>
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-light btn-lg" to={COACH}>Start as a teacher →</Link>
          <Link className="btn btn-ghostlight btn-lg" to={STUDENT}>I'm a student →</Link>
        </div>
        <div className="cta-note">No card required for teachers · students join by invite</div>
      </div>
    </div>
  </section>
);

const OvFooter = () => (
  <footer className="footer">
    <div className="wrap footer-inner">
      <div>
        <div className="logo"><OvMark /><span className="name">sunbird</span></div>
        <p className="blurb">The calm home for music lessons. Scheduling, payments, practice and progress — flowing between teacher and student.</p>
      </div>
      <div><h4>For teachers</h4><ul><li><Link to={COACH}>Overview</Link></li><li><Link to={`${COACH}#features`}>Features</Link></li><li><Link to={`${COACH}#pricing`}>Pricing</Link></li><li><Link to={`${COACH}#how`}>How it works</Link></li></ul></div>
      <div><h4>For students</h4><ul><li><Link to={STUDENT}>Overview</Link></li><li><Link to={`${STUDENT}#practice`}>Practice path</Link></li><li><Link to={`${STUDENT}#progress`}>Progress</Link></li><li><Link to={`${STUDENT}#families`}>For families</Link></li></ul></div>
      <div><h4>Company</h4><ul><li><a href="#">About</a></li><li><a href="#">Blog</a></li><li><a href="#">Help center</a></li><li><a href="#">Contact</a></li></ul></div>
    </div>
    <div className="footer-base">
      <span>© 2026 sunbird. Made for teachers &amp; their students.</span>
      <span>♪ Built with care</span>
    </div>
  </footer>
);

export function OverviewLanding() {
  return (
    <div className="sunbird-landing">
      <OvNav />
      <OvHero />
      <OvStrip />
      <OvChoose />
      <OvConnect />
      <OvValues />
      <OvSocial />
      <OvClosing />
      <OvFooter />
    </div>
  );
}
