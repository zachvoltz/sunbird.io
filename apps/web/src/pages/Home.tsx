import { Link } from "react-router-dom";

const lessonTypes = [
  {
    slug: "voice",
    title: "Voice",
    aside: "The instrument you already own.",
  },
  {
    slug: "songwriting",
    title: "Songwriting",
    aside: "From first line to finished thing.",
  },
  {
    slug: "theory",
    title: "Theory",
    aside: "The why behind the sound.",
  },
  {
    slug: "performance",
    title: "Performance",
    aside: "Stage fright sold separately.",
  },
  {
    slug: "poetry-in-song",
    title: "Poetry in Song",
    aside: "Where lyrics earn their keep.",
  },
];

export function Home() {
  return (
    <>
      {/* ── Hero ── */}
      <section className="min-h-[85vh] flex flex-col justify-end pb-20 px-6 md:px-10 relative">
        <div className="mx-auto max-w-[1200px] w-full">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
            Voice &middot; Music &middot; Songwriting &middot; Nashville, TN
          </p>
          <h1 className="font-display text-[clamp(3rem,8vw,6.5rem)] font-bold leading-[0.95] tracking-tight mb-8">
            Ellisa
            <br />
            Sun
          </h1>
          <div className="flex flex-col sm:flex-row items-start gap-8">
            <p className="text-lg text-text-secondary max-w-md leading-relaxed">
              Lessons in voice, songwriting, and the art of meaning it.
              Rooted in soul, neo-soul, and folk — shaped by whoever
              walks through the door.
            </p>
            <div className="flex items-center gap-5 text-2xl font-medium tracking-wide">
              <Link
                to="/lessons"
                className="text-charcoal border-b border-charcoal hover:text-gold hover:border-gold transition-colors"
              >
                lessons
              </Link>
              <span className="text-charcoal/20">|</span>
              <Link
                to="/workshops"
                className="text-charcoal hover:text-gold transition-colors"
              >
                workshops
              </Link>
              <span className="text-charcoal/20">|</span>
              <Link
                to="/events"
                className="text-charcoal hover:text-gold transition-colors"
              >
                events
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <hr className="editorial-rule" />
      </div>

      {/* ── Philosophy ── */}
      <section className="py-20 px-6 md:px-10">
        <div className="mx-auto max-w-[700px] text-center">
          <p className="font-handwritten text-2xl md:text-3xl text-charcoal leading-snug">
            &ldquo;A song is a question you sing until
            the answer changes you.&rdquo;
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <hr className="editorial-rule" />
      </div>

      {/* ── What I Teach ── */}
      <section className="py-24 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-baseline justify-between mb-16">
            <h2 className="font-display text-3xl md:text-5xl font-bold">
              What I teach
            </h2>
            <Link
              to="/lessons"
              className="hidden sm:block text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors tracking-wide"
            >
              View all &rarr;
            </Link>
          </div>

          <div className="space-y-0 border-t border-charcoal/10">
            {lessonTypes.map((lesson, i) => (
              <Link
                key={lesson.slug}
                to={`/lessons/${lesson.slug}`}
                className="group flex items-baseline justify-between py-6 border-b border-charcoal/10 hover:border-charcoal/30 transition-colors"
              >
                <div className="flex items-baseline gap-4">
                  <span className="text-[12px] text-text-secondary font-mono tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-display text-xl md:text-2xl font-semibold group-hover:text-gold transition-colors">
                    {lesson.title}
                  </h3>
                </div>
                <span className="text-sm text-text-secondary italic hidden sm:block group-hover:text-charcoal transition-colors">
                  {lesson.aside}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── About Preview ── */}
      <section className="py-24 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px] grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16">
          <div className="md:col-span-5">
            <div className="aspect-[3/4] bg-warm-gray/60 flex items-end p-6">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-secondary">
                Photo: portrait of Ellisa
              </p>
            </div>
          </div>
          <div className="md:col-span-7 flex flex-col justify-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
              About
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-8 leading-tight">
              A voice teacher who actually
              <br className="hidden md:block" />
              listens first.
            </h2>
            <p className="text-text-secondary leading-relaxed mb-4 max-w-lg">
              Ellisa Sun has spent the last decade teaching people to sing the way
              they talk — honestly. Her studio is part classroom, part living room,
              part gentle dare. Students come for technique and stay for the
              songwriting prompts they didn't know they needed.
            </p>
            <p className="text-text-secondary leading-relaxed mb-8 max-w-lg">
              Rooted in soul, neo-soul, and folk. Informed by poetry, conversation,
              and a frankly unreasonable number of Joni Mitchell records.
            </p>
            <Link
              to="/about"
              className="text-[13px] font-medium text-charcoal hover:text-gold transition-colors tracking-wide"
            >
              Full bio &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <hr className="editorial-rule" />
      </div>

      {/* ── Upcoming ── */}
      <section className="py-24 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
            Coming up
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-charcoal/10">
            <div className="bg-cream p-10 md:p-12">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-gold mb-4">
                Workshop
              </p>
              <h3 className="font-display text-2xl font-semibold mb-2">
                Finding Your Songwriting Voice
              </h3>
              <p className="text-sm text-text-secondary mb-6">
                April 12, 2026 &middot; 2 hours &middot; Small group
              </p>
              <Link
                to="/workshops"
                className="text-[13px] font-medium text-charcoal border border-charcoal px-5 py-2 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide inline-block"
              >
                Sign up
              </Link>
            </div>
            <div className="bg-cream p-10 md:p-12">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-sage mb-4">
                Free event
              </p>
              <h3 className="font-display text-2xl font-semibold mb-2">
                Open Mic & Listening Circle
              </h3>
              <p className="text-sm text-text-secondary mb-6">
                April 5, 2026 &middot; 1.5 hours &middot; All welcome
              </p>
              <Link
                to="/events"
                className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors tracking-wide"
              >
                RSVP &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Community ── */}
      <section className="py-24 px-6 md:px-10 bg-charcoal text-cream">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
                The community
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 leading-tight">
                A room full of first drafts
                <span className="font-handwritten text-gold text-[0.7em] ml-2">
                  (the brave kind)
                </span>
              </h2>
              <p className="text-warm-gray leading-relaxed mb-8 max-w-sm">
                Students share original songs, offer gentle feedback, and occasionally
                surprise themselves. It's part open mic, part group chat, part proof
                that you actually did the thing.
              </p>
              <Link
                to="/community"
                className="text-[13px] font-medium text-cream border border-cream/40 px-6 py-2.5 hover:bg-cream hover:text-charcoal transition-all duration-300 tracking-wide inline-block"
              >
                Join the community
              </Link>
            </div>
            <div className="md:col-span-7">
              <div className="space-y-4">
                {[
                  { name: "Maya R.", title: "Unfinished Lullaby", tag: "voice" },
                  { name: "Jordan T.", title: "3am on the F Train", tag: "songwriting" },
                  { name: "Sam K.", title: "Letter to My Younger Self", tag: "poetry" },
                ].map((song) => (
                  <div
                    key={song.title}
                    className="flex items-center gap-5 p-5 bg-cream/5 border border-cream/10"
                  >
                    <div className="w-10 h-10 rounded-full bg-cream/10 flex items-center justify-center text-[11px] font-medium text-cream/60 shrink-0">
                      {song.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{song.title}</p>
                      <p className="text-[12px] text-cream/50">{song.name}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-cream/30 border border-cream/10 px-2 py-0.5 shrink-0">
                      {song.tag}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials (placeholder) ── */}
      <section className="py-24 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px] text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
            Kind words
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            What students say
          </h2>
          <p className="text-text-secondary italic">
            Coming soon — they're still figuring out how to put it into words.
          </p>
        </div>
      </section>
    </>
  );
}
