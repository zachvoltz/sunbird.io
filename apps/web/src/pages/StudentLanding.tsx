// Student landing — faithful port of the "sunbird" student marketing page from
// the Claude Design handoff (songbird/project/Student Landing - sunbird.html →
// student-page.jsx). Speaks to students & families; spotlights the daily
// practice path and progress tracking.
//
// It reuses the shared sunbird-page brand system (coach-landing.css, scoped
// under .sunbird-landing) and layers on the student-specific visuals from
// student-landing.css (phone mock, practice path, streak/ring, journal).
//
// StudentEntry serves this at /student for the public and logged-out visitors,
// and redirects signed-in students to their app home at /today.

import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import "./coach-landing.css"; // shared sunbird-page base (scoped under .sunbird-landing)
import "./student-landing.css"; // student-specific additions

// Real entry points. "Open the app" is for students already invited by their
// teacher → sign in. "Tell your teacher" points at the coach landing.
const OPEN_APP = "/login";
const SIGNIN = "/login";
const COACH_LANDING = "/coach";

// ── brand mark (the sunbird bird logo) ────────────────────
const BirdMark = () => (
  <img className="mark" src="/sunbird-icon.png" alt="sunbird logo" style={{ objectFit: "contain" }} />
);

// ── reusable winding-path SVG ─────────────────────────────
const PATH_D = "M 56 36 Q 250 70 70 138 Q -28 200 250 236 Q 320 296 64 332 Q -22 388 250 420";
const STOPS = [
  { x: 56, y: 36, label: "Warm-up", st: "done" },
  { x: 70, y: 138, label: "C major scale", st: "done" },
  { x: 250, y: 236, label: "Hanon № 4", st: "now" },
  { x: 64, y: 332, label: "Sight-reading", st: "todo" },
  { x: 250, y: 420, label: "River Flows ♪", st: "todo" },
];
const PathFigure = () => {
  // solid "done" overlay up to the current stop
  const doneD = "M 56 36 Q 250 70 70 138 Q -28 200 250 236";
  return (
    <div className="path-wrap" style={{ height: "100%" }}>
      <svg viewBox="0 0 306 456">
        <path className="path-base" d={PATH_D} />
        <path className="path-done" d={doneD} />
        {STOPS.map((s, i) => {
          const done = s.st === "done";
          const now = s.st === "now";
          const r = now ? 21 : 18;
          const isSong = i === STOPS.length - 1;
          return (
            <g key={i}>
              {now && <circle cx={s.x} cy={s.y} r={r + 7} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="4 4" />}
              <circle cx={s.x} cy={s.y} r={r} fill={done ? "var(--accent)" : "#fff"} stroke={now ? "var(--accent)" : done ? "var(--accent)" : "var(--line-2)"} strokeWidth={now ? 3 : 2} />
              <text className="path-stop-num" x={s.x} y={s.y + 5} textAnchor="middle" fontSize="15" fill={done ? "#fff" : now ? "var(--accent-deep)" : "var(--ink-3)"}>
                {done ? "✓" : isSong ? "♪" : i + 1}
              </text>
              <text className="path-stop-label" x={s.x} y={s.y + r + 17} textAnchor="middle" fontSize="12.5">{s.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ── nav ───────────────────────────────────────────────────
const StudentNav = () => {
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
        <Link className="logo" to="/"><BirdMark /><span className="name">sunbird</span></Link>
        <nav className="nav-links">
          <a href="#practice">Practice</a>
          <a href="#progress">Progress</a>
          <a href="#how">How it works</a>
          <a href="#families">For families</a>
        </nav>
        <div className="nav-right">
          <Link className="signin" to={SIGNIN}>Sign in</Link>
          <Link className="btn btn-primary" to={OPEN_APP}>Open the app</Link>
        </div>
      </div>
    </header>
  );
};

// ── hero ──────────────────────────────────────────────────
const StudentHero = () => (
  <section className="hero">
    <div className="hero-inner">
      <div>
        <span className="eyebrow">♪ for students &amp; families</span>
        <h1 style={{ marginTop: 26 }}>Practice you'll<br />actually <span className="hl">look forward to.</span></h1>
        <p className="sub">Open sunbird and your teacher's plan for the day is already waiting — a short, guided path to play through. Tick off each step, keep your streak alive, and watch yourself get better, week after week.</p>
        <div className="cta-row">
          <Link className="btn btn-primary btn-lg" to={OPEN_APP}>Open the app →</Link>
          <a className="btn btn-ghost btn-lg" href="#practice">▶ See a day of practice</a>
        </div>
        <div className="cta-note">Invited by your teacher · works on phone, tablet &amp; web</div>
        <div className="trust">
          <div className="avs"><span>M</span><span>T</span><span>L</span><span>J</span></div>
          <div className="trust-txt"><span className="stars">★★★★★</span><br />Students practice 2.3× more consistently on sunbird</div>
        </div>
      </div>

      <div className="sp-heroart">
        <div className="bloom" />
        <div className="phone">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="ph-top"><span>9:41</span><span>● ● ●  ⌁</span></div>
            <div className="ph-head">
              <div>
                <div className="h-t">Tuesday's path</div>
                <div className="h-s">5 stops · about 25 min</div>
              </div>
              <span className="ph-flame">🔥 14</span>
            </div>
            <div style={{ position: "relative", height: 466 }}>
              <PathFigure />
              <div className="ph-pin">
                <div className="pin-from">Mr. Klein</div>
                <div className="pin-msg">start slow on Hanon today 🐢</div>
              </div>
              <a className="ph-begin" href="#practice">▶ Continue · stop 3</a>
            </div>
          </div>
        </div>

        <div className="pm-float" style={{ right: -26, top: 8, zIndex: 4 }}>
          <span className="ic" style={{ background: "var(--accent-soft)" }}>🔥</span>
          <div><b>14-day streak!</b><span>Your longest yet</span></div>
        </div>
        <div className="pm-float" style={{ left: -30, bottom: 20, zIndex: 4 }}>
          <span className="ic" style={{ background: "var(--ok-soft)" }}>✓</span>
          <div><b>Take sent to Mr. Klein</b><span>River Flows · bars 16–24</span></div>
        </div>
      </div>
    </div>
  </section>
);

// ── instrument strip ──────────────────────────────────────
const Strip = () => (
  <div className="strip">
    <div className="wrap strip-inner">
      <span className="lead">Practice that fits any instrument</span>
      <div className="marks">
        <span>♪ Piano</span><span>♫ Guitar</span><span>𝄞 Voice</span><span>𝄢 Strings</span><span>♩ Woodwind</span>
      </div>
    </div>
  </div>
);

// ── FEATURE 1 · routine practice tool ─────────────────────
const PracticeFeature = () => (
  <section className="section" id="practice">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">your daily routine</span>
        <h2>Never wonder "what should I practice?"</h2>
        <p>Your teacher builds a path of bite-sized stops. You just press play and follow it — warm-ups, scales, the tricky bar, then the fun part.</p>
      </div>

      <div className="feat">
        <div className="feat-text">
          <span className="tag">The practice path</span>
          <h2>One clear path, every day</h2>
          <p>No blank page, no guesswork. Each stop is a small, doable task with a timer and a tip — so a session feels like a quick journey, not a chore.</p>
          <ul className="feat-list">
            <li><span className="ck">✓</span><span>A fresh path set by your teacher, ready when you open the app</span></li>
            <li><span className="ck">✓</span><span>Short stops with timers, tempos and notes — about 25 minutes total</span></li>
            <li><span className="ck">✓</span><span>Tick each one off and feel the path fill in behind you</span></li>
            <li><span className="ck">✓</span><span>Finish to a little celebration — and a streak day earned</span></li>
          </ul>
        </div>
        <div className="feat-art">
          <div className="panel-soft path-panel">
            <div className="pp-head">
              <div><div className="t">Tuesday's path</div><div className="s">2 of 5 done · 12 min in</div></div>
              <span className="ph-flame">🔥 14</span>
            </div>
            <div className="path-figure"><PathFigure /></div>
          </div>
        </div>
      </div>

      {/* stop checklist row */}
      <div className="feat flip" style={{ marginTop: 96 }}>
        <div className="feat-text">
          <span className="tag">Step by step</span>
          <h2>Small wins that add up fast</h2>
          <p>Each stop tells you exactly what to do and for how long. Done with one? It checks itself off and slides you to the next — momentum without the nagging.</p>
          <ul className="feat-list">
            <li><span className="ck">✓</span><span>Built-in metronome &amp; target tempos for every exercise</span></li>
            <li><span className="ck">✓</span><span>Record a take right inside a stop and send it to your teacher</span></li>
            <li><span className="ck">✓</span><span>Pinned tips from your last lesson, right where you need them</span></li>
          </ul>
        </div>
        <div className="feat-art">
          <div className="panel-soft" style={{ padding: 20 }}>
            <div className="stop-list">
              <div className="stop-item done"><span className="stop-dot done">✓</span><div><div className="si-t">Warm-up &amp; breathing</div><div className="si-s">3 min · loosen up</div></div></div>
              <div className="stop-item done"><span className="stop-dot done">✓</span><div><div className="si-t">C major scale</div><div className="si-s">2 octaves · 80 bpm</div></div></div>
              <div className="stop-item now"><span className="stop-dot now">3</span><div><div className="si-t">Hanon № 4</div><div className="si-s">slow on bar 12 · 60 bpm</div></div><span className="si-go">play →</span></div>
              <div className="stop-item"><span className="stop-dot todo">4</span><div><div className="si-t">Sight-reading</div><div className="si-s">1 short piece</div></div></div>
              <div className="stop-item"><span className="stop-dot todo">♪</span><div><div className="si-t">River Flows</div><div className="si-s">bars 16–24 · record a take</div></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ── FEATURE 2 · progress tracking ─────────────────────────
const STREAK_CELLS = [
  "full", "full", "full", "full", "half", "full", "full",
  "full", "full", "miss", "full", "full", "full", "full",
  "full", "half", "full", "full", "today", "todo", "todo",
];
const ProgressFeature = () => (
  <section className="section tint-band" id="progress">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">see yourself improve</span>
        <h2>Progress you can actually watch grow</h2>
        <p>Every session counts toward your streak, your week, and your story. Look back and see how far you've come — and your teacher sees it too.</p>
      </div>

      <div className="feat">
        <div className="feat-text">
          <span className="tag">Streaks &amp; weekly goal</span>
          <h2>Keep the flame alive</h2>
          <p>A streak for every day you practice, and a simple weekly ring that fills as you go. Tiny, satisfying nudges that turn practice into a habit you keep.</p>
          <ul className="feat-list">
            <li><span className="ck">✓</span><span>Daily streaks with gentle reminders — never a guilt trip</span></li>
            <li><span className="ck">✓</span><span>A weekly goal you and your teacher set together</span></li>
            <li><span className="ck">✓</span><span>Badges and milestones for the streaks worth bragging about</span></li>
          </ul>
        </div>
        <div className="feat-art">
          <div className="prog-grid">
            <div className="prog-ringcard">
              <div className="prog-ring">
                <svg width="104" height="104" viewBox="0 0 104 104">
                  <circle cx="52" cy="52" r="44" fill="none" stroke="var(--line-2)" strokeWidth="11" />
                  <circle
                    cx="52" cy="52" r="44" fill="none" stroke="var(--accent)" strokeWidth="11" strokeLinecap="round"
                    strokeDasharray="276.5" strokeDashoffset="69" transform="rotate(-90 52 52)"
                  />
                </svg>
                <div className="rv"><div><b>76%</b><span>this week</span></div></div>
              </div>
              <div>
                <div className="rc-t">5 of 7 days</div>
                <div className="rc-p">Two more sessions hits your weekly goal. You've got this.</div>
              </div>
            </div>

            <div className="streak-card">
              <div className="streak-top">
                <span className="big">🔥 14</span>
                <span className="lbl">day streak · best yet</span>
              </div>
              <div className="streak-cells">
                {STREAK_CELLS.map((s, i) => (
                  <div key={i} className={"streak-cell " + (s === "today" ? "full today" : s === "todo" ? "miss" : s)}>
                    {s === "miss" ? "" : s === "todo" ? "" : "♪"}
                  </div>
                ))}
              </div>
              <div className="streak-legend">
                <span><i style={{ background: "var(--accent)" }} /> practiced</span>
                <span><i style={{ background: "var(--accent-soft)" }} /> short day</span>
                <span><i style={{ background: "var(--line)" }} /> rest</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="feat flip" style={{ marginTop: 96 }}>
        <div className="feat-text">
          <span className="tag">Practice journal</span>
          <h2>Every lesson &amp; take, in one timeline</h2>
          <p>Your teacher's notes, the takes you send, and your own logged sessions all line up in one place. Scroll back any time to see what you worked on and how it went.</p>
          <ul className="feat-list">
            <li><span className="ck">✓</span><span>Lesson notes land in your journal right after each lesson</span></li>
            <li><span className="ck">✓</span><span>Listen back to takes and hear yourself improve over weeks</span></li>
            <li><span className="ck">✓</span><span>Auto-logged sessions — minutes, stops, and your own notes</span></li>
          </ul>
        </div>
        <div className="feat-art">
          <div className="panel-soft" style={{ padding: 22 }}>
            <div className="tl">
              <div className="tl-row">
                <div className="tl-dot coach">K</div>
                <div className="tl-card note">
                  <div className="tl-head"><b>Note from Mr. Klein</b><span className="when">Mon</span></div>
                  <p>"Lovely shaping today. Before Friday: <span className="hl">Hanon № 4</span> slow on bar 12, and send a take of <span className="hl">River Flows</span>."</p>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot you">♪</div>
                <div className="tl-card">
                  <div className="tl-head"><b>You sent a take</b><span className="when">Wed</span></div>
                  <p>River Flows · bars 16–24</p>
                  <div className="tl-take">
                    <span className="pb">▶</span>
                    <span className="tl-wave">
                      {[40, 70, 55, 90, 60, 80, 45, 95, 70, 50, 85, 60, 75, 55, 65, 88, 52].map((h, i) => (
                        <i key={i} className={i > 11 ? "dim" : ""} style={{ height: h + "%" }} />
                      ))}
                    </span>
                    <span className="dur">0:38</span>
                  </div>
                </div>
              </div>
              <div className="tl-row">
                <div className="tl-dot auto">✓</div>
                <div className="tl-card">
                  <div className="tl-head"><b>Practice logged</b><span className="when">Wed</span></div>
                  <p>28 min · 5 of 5 stops · "Hanon felt easier today!"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ── how it works ──────────────────────────────────────────
const How = () => (
  <section className="section" id="how">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">a day on sunbird</span>
        <h2>Practice in three easy beats</h2>
      </div>
      <div className="steps">
        {[
          { n: "1", t: "Open today's path", p: "Your teacher's plan is already there. No setup, no deciding — just press play." },
          { n: "2", t: "Play through the stops", p: "Follow each short step with its timer and tip. Record a take if one's due." },
          { n: "3", t: "Watch your progress grow", p: "Finish to a streak day and a fuller week. Your teacher sees it before your next lesson." },
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

// ── supporting value cards ────────────────────────────────
const VALUES = [
  { ic: "🔔", t: "Gentle reminders", p: "A friendly nudge at your usual practice time — easy to keep, never naggy." },
  { ic: "🎙", t: "Send takes home", p: "Record yourself in a tap and send it to your teacher for feedback between lessons." },
  { ic: "📝", t: "Lesson notes that stay", p: "Everything your teacher said, saved — so 'what was I meant to do?' never happens again." },
  { ic: "🎯", t: "Know exactly what's next", p: "Assignments and due takes are front and centre, so nothing slips through." },
  { ic: "📱", t: "Works anywhere", p: "Phone, tablet, or the web — your path and progress follow you everywhere." },
  { ic: "🎉", t: "Celebrate the wins", p: "Streaks, badges and finished pieces — the little moments that keep you going." },
];
const Values = () => (
  <section className="section tint-band">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">everything in your pocket</span>
        <h2>Made for the days between lessons</h2>
        <p>The good stuff that keeps you connected to your teacher and moving forward all week.</p>
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

// ── for families ──────────────────────────────────────────
const Families = () => (
  <section className="section" id="families">
    <div className="wrap">
      <div className="fam">
        <div>
          <span className="eyebrow">for parents &amp; guardians</span>
          <h2 style={{ fontSize: "clamp(30px,3.4vw,42px)", margin: "16px 0 0" }}>Follow along without the nagging</h2>
          <p style={{ fontSize: 18, color: "var(--ink-2)", margin: "18px 0 0" }}>Set younger learners up in a minute and let sunbird carry the "did you practice?" conversation. You can see the streak grow and hear the takes — encouragement, made easy.</p>
          <ul className="feat-list" style={{ marginTop: 24 }}>
            <li><span className="ck">✓</span><span>Your teacher invites you — you set the login and you're in</span></li>
            <li><span className="ck">✓</span><span>A simple progress view: streaks, this week, and recent takes</span></li>
            <li><span className="ck">✓</span><span>Lesson payments handled in the same calm place, if your teacher uses them</span></li>
          </ul>
        </div>
        <div className="fam-card">
          <div className="fam-line"><span className="fic">🔥</span><div><b>Maya kept a 14-day streak</b><span>practiced 5 of the last 7 days</span></div></div>
          <div className="fam-line"><span className="fic">🎙</span><div><b>New take of River Flows</b><span>sent to Mr. Klein on Wednesday</span></div></div>
          <div className="fam-line"><span className="fic">📈</span><div><b>76% of this week's goal</b><span>two short sessions to go</span></div></div>
          <div className="fam-line"><span className="fic">💳</span><div><b>June lessons paid</b><span>auto-collected · receipt saved</span></div></div>
        </div>
      </div>
    </div>
  </section>
);

// ── social proof ──────────────────────────────────────────
const Social = () => (
  <section className="section tint-band">
    <div className="wrap">
      <div className="section-head">
        <span className="eyebrow">loved by students &amp; families</span>
        <h2>The streak does the convincing</h2>
      </div>
      <div className="quotes">
        {[
          { q: "I used to forget what to practice. Now I just open the path and go — and my streak is at 40 days!", n: "Maya, 14", r: "Piano · 2 years", c: "#e0884a" },
          { q: "Sending takes to my teacher between lessons is the best part. I can actually hear myself getting better.", n: "Theo, 16", r: "Guitar · 1 year", c: "#7b9bd1" },
          { q: "As a parent it's a relief. No more nagging — she sees her streak and just wants to keep it going.", n: "Priya", r: "Maya's mum", c: "#cf6f8a" },
        ].map((t) => (
          <div className="quote" key={t.n}>
            <div className="stars">★★★★★</div>
            <p>"{t.q}"</p>
            <div className="by"><span className="ava" style={{ background: t.c }}>{t.n[0]}</span><div><b>{t.n}</b><span>{t.r}</span></div></div>
          </div>
        ))}
      </div>
      <div className="stats">
        <div className="stat"><div className="v">2.3×</div><div className="l">more consistent practice</div></div>
        <div className="stat"><div className="v">14 days</div><div className="l">average streak after a month</div></div>
        <div className="stat"><div className="v">3 min</div><div className="l">to send a take to your teacher</div></div>
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
          { q: "How do I get started?", a: "Your teacher invites you with a link. Open it, set a password (a parent can do this for younger students), and your practice path is ready to go." },
          { q: "Do I need my own account if I'm young?", a: "Not on your own — a parent or guardian sets up and manages the account, then you practice together. Older students can manage their own login." },
          { q: "Who decides what I practice?", a: "Your teacher builds your path from your lessons. You can always add your own practice on top, but you'll never face a blank page." },
          { q: "What's a streak, exactly?", a: "It's the number of days in a row you've practiced. Even a short session keeps it alive — it's there to make practice a habit, not to stress you out." },
          { q: "Can my teacher really see my practice?", a: "Yes — they see your streak, the stops you finished, and any takes you send, so your lessons can pick up right where your week left off." },
          { q: "What does it cost me?", a: "sunbird is your teacher's tool. Any lesson fees are set by your teacher; the practice and progress features come as part of learning with them." },
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

// ── closing CTA (invite-aware) ────────────────────────────
const Closing = () => (
  <section className="section" id="get" style={{ paddingTop: 0 }}>
    <div className="wrap">
      <div className="cta-band">
        <h2>Your next streak<br />starts today.</h2>
        <p>Already invited by your teacher? Jump straight in and play through today's path.</p>
        <Link className="btn btn-light btn-lg" to={OPEN_APP}>Open the app →</Link>
        <div className="cta-or"><span className="ln" /><span>not invited yet?</span><span className="ln" /></div>
        <div style={{ marginTop: 18 }}>
          <Link className="btn btn-ghostlight btn-lg" to={COACH_LANDING}>Tell your teacher about sunbird</Link>
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="footer">
    <div className="wrap footer-inner">
      <div>
        <div className="logo"><BirdMark /><span className="name">sunbird</span></div>
        <p className="blurb">The practice app that keeps students playing between lessons. Daily paths, streaks, and progress — gently handled.</p>
      </div>
      <div><h4>Students</h4><ul><li><a href="#practice">Practice path</a></li><li><a href="#progress">Progress</a></li><li><a href="#how">How it works</a></li><li><a href="#get">Open the app</a></li></ul></div>
      <div><h4>Families</h4><ul><li><a href="#families">For parents</a></li><li><a href="#faq">FAQ</a></li><li><a href="#how">Getting started</a></li><li><Link to="/privacy">Privacy</Link></li></ul></div>
      <div><h4>Teachers</h4><ul><li><Link to={COACH_LANDING}>sunbird for teachers</Link></li><li><Link to="/pricing">Pricing</Link></li><li><a href="#faq">Help center</a></li><li><a href="#">Contact</a></li></ul></div>
    </div>
    <div className="footer-base">
      <span>© 2026 sunbird. Made for students &amp; their teachers.</span>
      <span>♪ Keep practicing</span>
    </div>
  </footer>
);

export function StudentLanding() {
  return (
    <div className="sunbird-landing">
      <StudentNav />
      <StudentHero />
      <Strip />
      <PracticeFeature />
      <ProgressFeature />
      <How />
      <Values />
      <Families />
      <Social />
      <FAQ />
      <Closing />
      <Footer />
    </div>
  );
}

// Public entry at /student: signed-in students go to their app home; everyone
// else (logged-out visitors, families, coaches) sees the landing.
export function StudentEntry() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user && user.role === "STUDENT") {
    return <Navigate to="/today" replace />;
  }
  return <StudentLanding />;
}
