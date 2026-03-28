import { Link } from "react-router-dom";

export function Voice() {
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
            <p className="text-[12px] font-mono text-text-secondary mb-4">01</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-4 leading-tight">
              Voice
            </h1>
            <p className="font-handwritten text-2xl text-gold mb-8">
              The instrument you already own.
            </p>
            <p className="text-lg text-text-secondary leading-relaxed max-w-lg">
              This isn't about becoming a different singer. It's about becoming
              a more honest one. We start with what your voice already does well
              and build from there — technically, emotionally, and musically.
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="aspect-[4/5] bg-warm-gray/50 flex items-end p-6">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-secondary">
                Photo: voice lesson in session
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
                We'll work on breath support — not the gym-class kind, but the kind
                that lets you hold a phrase without thinking about it. Tone and
                resonance, finding the places in your body where your voice lives.
                Range expansion, gently and without strain. Pitch and ear training,
                not as correction but as awareness.
              </p>
              <p className="text-text-secondary leading-relaxed mb-6">
                And the stuff that doesn't fit in a textbook: vocal identity, emotional
                commitment, the difference between singing <em>at</em> someone and singing
                <em> to</em> them. How to be vulnerable without being fragile. How to belt
                without shouting.
              </p>
              <p className="text-text-secondary leading-relaxed">
                We'll pull from soul, folk, neo-soul, gospel — whatever opens the door for
                you. The genre doesn't matter. The honesty does.
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
                Beginners who've always wanted to sing but never had permission.
                Experienced singers who feel technically fine but emotionally stuck.
                Songwriters who want their voice to match what they hear in their head.
                People who sing in the car and wonder what would happen if they took it
                seriously.
              </p>
              <p className="text-text-secondary leading-relaxed">
                You don't need to read music. You don't need to have a "good" voice.
                You need to be willing to make sounds in a room with another person and
                see what happens.
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
                      "Warm-up. Breath work, vocal exercises, waking the body up. We check in — how's your voice today, what are you carrying.",
                  },
                  {
                    time: "Next 20 min",
                    description:
                      "Technical work on whatever we're building: breath support, tone placement, range, dynamics. This is where the focused practice happens.",
                  },
                  {
                    time: "Next 20 min",
                    description:
                      "Application. We take a song — yours or someone else's — and put the technique into practice. This is where it stops being exercise and starts being music.",
                  },
                  {
                    time: "Last 10 min",
                    description:
                      "Cool-down and reflection. What clicked, what to practice this week, what to listen to. You leave with a clear next step, not a vague feeling.",
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
            Book a voice lesson
          </Link>
        </div>
      </div>
    </div>
  );
}
