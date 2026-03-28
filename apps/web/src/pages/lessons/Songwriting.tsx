import { Link } from "react-router-dom";

export function Songwriting() {
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
            <p className="text-[12px] font-mono text-text-secondary mb-4">02</p>
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-4 leading-tight">
              Songwriting
            </h1>
            <p className="font-handwritten text-2xl text-gold mb-8">
              From first line to finished thing.
            </p>
            <p className="text-lg text-text-secondary leading-relaxed max-w-lg">
              A song isn't waiting to be found. It's waiting to be built — one
              honest line at a time. These lessons are about developing a writing
              practice, not chasing inspiration.
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="aspect-[4/5] bg-warm-gray/50 flex items-end p-6">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-secondary">
                Photo: notebook and guitar
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
                How to start — which is the hardest part, and the part we'll practice
                the most. Free-writing, prompt-based writing, writing from images,
                writing from memory, writing from overheard conversations on the bus.
                The point is to generate material before your inner critic wakes up.
              </p>
              <p className="text-text-secondary leading-relaxed mb-6">
                Then: structure. Verse, chorus, bridge — not as rules but as containers.
                How repetition creates meaning. How a bridge can reframe everything that
                came before it. How to know when a song needs one more section and when
                it needs one fewer.
              </p>
              <p className="text-text-secondary leading-relaxed mb-6">
                Melody and lyrics together — how they serve each other, where they
                should fight, and the moment when a line finally lands in the right
                place on the right note and you feel it in your chest.
              </p>
              <p className="text-text-secondary leading-relaxed">
                We'll also talk about finishing. The difference between "this isn't
                done" and "I'm afraid to call it done." Both are real. Only one of
                them is useful.
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
                People with notebooks full of half-finished ideas. People with no
                notebooks at all who just feel like something is in there. Singer-songwriters
                who can perform but struggle to write consistently. Poets who want
                to add melody. Instrumentalists who've never written lyrics and are
                terrified to try.
              </p>
              <p className="text-text-secondary leading-relaxed">
                All levels. Truly. Some of the most interesting songs come from people
                who don't know enough theory to second-guess themselves.
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
                      "A writing prompt. Five to ten minutes of uninterrupted writing — pen on paper, no editing, no stopping. This is warm-up for the creative brain.",
                  },
                  {
                    time: "Next 15 min",
                    description:
                      "We look at what you wrote. Not to judge it, but to find the alive parts — the images, the rhythms, the lines that surprise you. We circle those.",
                  },
                  {
                    time: "Next 25 min",
                    description:
                      "Building. We take the strongest thread and start shaping it — melody, chord movement, structure. This is collaborative: I'll suggest, you'll decide. Sometimes we'll work on a piece you brought in. Sometimes we'll start from scratch.",
                  },
                  {
                    time: "Last 10 min",
                    description:
                      "Play it back. Hear what you've made so far. Talk about what's working, what's not, and what to explore before next time. You'll leave with a clear direction, not homework.",
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
            Book a songwriting lesson
          </Link>
        </div>
      </div>
    </div>
  );
}
