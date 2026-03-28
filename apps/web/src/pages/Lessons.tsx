import { Link } from "react-router-dom";

const lessons = [
  {
    slug: "voice",
    title: "Voice",
    tagline: "The instrument you already own.",
    description:
      "Learn to sing the way you speak — honestly, with your whole body behind it. We'll work on breath, tone, range, and the thing no one teaches: trusting the sound that's already yours.",
  },
  {
    slug: "songwriting",
    title: "Songwriting",
    tagline: "From first line to finished thing.",
    description:
      "Melody, lyrics, structure — but also the harder stuff: starting, staying with an idea, knowing when it's done. We write in the room together. You leave with songs, not just notes about songs.",
  },
  {
    slug: "performance",
    title: "Performance",
    tagline: "Stage fright sold separately.",
    description:
      "Presence, phrasing, how to hold a room without holding your breath. We work on what happens between songs, too — the talking, the silence, the part where you decide to stay instead of run.",
  },
  {
    slug: "theory",
    title: "Theory",
    tagline: "The why behind the sound.",
    description:
      "Chords, scales, rhythm, form — taught as tools for making, not rules for following. You'll understand why your favorite songs work, and how to steal from them gracefully.",
  },
  {
    slug: "poetry-in-song",
    title: "Poetry in Song",
    tagline: "Where lyrics earn their keep.",
    description:
      "The line between a poem and a lyric is thinner than people think. We read, we write, we blur the edges. For students who want their words to carry weight even without the melody.",
  },
];

export function Lessons() {
  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[1200px]">
        {/* Header */}
        <div className="mb-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
            Lessons
          </p>
          <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight">
            What I teach
          </h1>
          <p className="text-lg text-text-secondary max-w-xl leading-relaxed">
            One-on-one lessons tailored to where you are and where you
            want to go. No fixed syllabus — just a conversation that
            happens to involve music.
          </p>
        </div>

        {/* Lesson cards */}
        <div className="space-y-0 border-t border-charcoal/10">
          {lessons.map((lesson, i) => (
            <Link
              key={lesson.slug}
              to={`/lessons/${lesson.slug}`}
              className="group block py-10 border-b border-charcoal/10 hover:border-charcoal/25 transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
                <div className="md:col-span-1">
                  <span className="text-[12px] font-mono text-text-secondary tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="md:col-span-4">
                  <h2 className="font-display text-2xl md:text-3xl font-bold group-hover:text-gold transition-colors">
                    {lesson.title}
                  </h2>
                  <p className="font-handwritten text-lg text-gold mt-1">
                    {lesson.tagline}
                  </p>
                </div>
                <div className="md:col-span-6">
                  <p className="text-text-secondary leading-relaxed">
                    {lesson.description}
                  </p>
                </div>
                <div className="md:col-span-1 flex items-center justify-end">
                  <span className="text-text-secondary group-hover:text-charcoal group-hover:translate-x-1 transition-all">
                    &rarr;
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 py-10 border-t border-charcoal/10">
          <div>
            <p className="font-handwritten text-xl text-charcoal mb-1">
              Ready to start?
            </p>
            <p className="text-sm text-text-secondary">
              Book a single lesson, or ask about monthly packages.
            </p>
          </div>
          <Link
            to="/book"
            className="text-[13px] font-medium text-charcoal border border-charcoal px-6 py-2.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
          >
            Book a lesson
          </Link>
        </div>
      </div>
    </div>
  );
}
