import { Link } from "react-router-dom";

export function Performance() {
  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[1200px]">
        {/* Breadcrumb */}
        <div className="mb-12">
          <Link
            to="/lessons"
            className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
          >
            &larr; Lessons
          </Link>
        </div>

        {/* Hero */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16 mb-24">
          <div className="md:col-span-7">
            <p className="text-[12px] font-mono text-text-secondary mb-4">03</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-4 leading-tight">
              Performance
            </h1>
            <p className="font-handwritten text-2xl text-gold mb-8">
              Stage fright sold separately.
            </p>
            <p className="text-lg text-text-secondary leading-relaxed max-w-lg">
              Performing isn't about being fearless. It's about being present —
              which, it turns out, is harder and more interesting. We work on
              what it means to be in a room with people and actually be there.
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="aspect-[4/5] bg-warm-gray/50 flex items-end p-6">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-secondary">
                Photo: Ellisa on stage
              </p>
            </div>
          </div>
        </div>

        {/* What You'll Explore */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-4">
              <h2 className="font-display text-2xl font-bold">
                What you'll explore
              </h2>
            </div>
            <div className="md:col-span-8">
              <p className="text-text-secondary leading-relaxed mb-6">
                Stage presence — not the performed kind, the real kind. How to stand
                still without looking frozen. How to move without looking choreographed.
                How to make eye contact with an audience and not immediately want to
                leave your body.
              </p>
              <p className="text-text-secondary leading-relaxed mb-6">
                Phrasing and dynamics in a live context. The difference between
                rehearsing a song and inhabiting it. How to recover when something
                goes wrong — a missed lyric, a broken string, a sound system that
                hates you — and make it part of the show instead of a disaster.
              </p>
              <p className="text-text-secondary leading-relaxed mb-6">
                The in-between moments: stage banter, transitions, silence. Most
                performers dread these more than the songs themselves. We'll practice
                them until they feel natural. Or at least until the panic is manageable.
              </p>
              <p className="text-text-secondary leading-relaxed">
                Set design. How to sequence songs so the whole show has an arc —
                not just a playlist, but a story. Where to put the quiet one. Where
                to put the one that makes people cry. Where to put the one where
                you ask people to sing along and pray that they do.
              </p>
            </div>
          </div>
        </section>

        <hr className="editorial-rule mb-24" />

        {/* Who This Is For */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-4">
              <h2 className="font-display text-2xl font-bold">
                Who this is for
              </h2>
            </div>
            <div className="md:col-span-8">
              <p className="text-text-secondary leading-relaxed mb-6">
                Songwriters who have songs but have never played them for anyone.
                Gigging musicians who feel like they're on autopilot. Open mic
                regulars who want to step up to actual shows. Anyone who's been
                told they're "good" but feels like something's missing when they
                get on stage.
              </p>
              <p className="text-text-secondary leading-relaxed">
                This is also for people who are genuinely terrified of performing.
                That's fine. Fear is just information. We'll work with it, not
                around it.
              </p>
            </div>
          </div>
        </section>

        <hr className="editorial-rule mb-24" />

        {/* What a Session Looks Like */}
        <section className="mb-24">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-4">
              <h2 className="font-display text-2xl font-bold">
                What a session looks like
              </h2>
            </div>
            <div className="md:col-span-8">
              <div className="border-t border-charcoal/10">
                {[
                  {
                    time: "First 10 min",
                    description:
                      "Body warm-up. Grounding exercises, posture, breath. Performance starts in the body before it reaches the voice. We get you out of your head and into the room.",
                  },
                  {
                    time: "Next 15 min",
                    description:
                      "Run a song — all the way through, no stopping. I watch. Then we talk about what I saw, not what you think happened. There's usually a gap. That gap is where the work is.",
                  },
                  {
                    time: "Next 25 min",
                    description:
                      "Targeted work. Maybe it's a specific section that falls flat. Maybe it's the transition between songs. Maybe it's learning to hold silence for three seconds instead of rushing to fill it. We drill the hard parts until they feel less hard.",
                  },
                  {
                    time: "Last 10 min",
                    description:
                      "Full run again — same song, different experience. We compare. You'll usually be surprised by how much shifted in under an hour. We talk about what to practice and what to try at your next show or open mic.",
                  },
                ].map((block) => (
                  <div
                    key={block.time}
                    className="py-5 border-b border-charcoal/10 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2 sm:gap-6"
                  >
                    <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-secondary">
                      {block.time}
                    </span>
                    <p className="text-sm text-text-secondary leading-relaxed">
                      {block.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 py-10 border-t border-charcoal/10">
          <div>
            <p className="text-sm text-text-secondary mb-1">
              See pricing for drop-in rates and monthly packages.
            </p>
            <Link
              to="/pricing"
              className="text-[13px] font-medium text-charcoal hover:text-gold transition-colors tracking-wide"
            >
              View pricing &rarr;
            </Link>
          </div>
          <Link
            to="/book"
            className="text-[13px] font-medium text-charcoal border border-charcoal px-6 py-2.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
          >
            Book a performance lesson
          </Link>
        </div>
      </div>
    </div>
  );
}
