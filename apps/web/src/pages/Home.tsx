import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "@/components/Wordmark";
import { Mic, PenLine, Music, Theater, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const lessonTypes: Array<{
  slug: string;
  title: string;
  aside: string;
  icon: LucideIcon;
}> = [
  {
    slug: "voice",
    title: "Voice",
    aside: "The instrument you already own.",
    icon: Mic,
  },
  {
    slug: "songwriting",
    title: "Songwriting",
    aside: "From first line to finished thing.",
    icon: PenLine,
  },
  {
    slug: "theory",
    title: "Theory",
    aside: "The why behind the sound.",
    icon: Music,
  },
  {
    slug: "performance",
    title: "Performance",
    aside: "Stage fright sold separately.",
    icon: Theater,
  },
  {
    slug: "poetry-in-song",
    title: "Poetry in Song",
    aside: "Where lyrics earn their keep.",
    icon: BookOpen,
  },
];

const navLinks = [
  { to: "/lessons", label: "lessons", primary: true },
  { to: "/workshops", label: "workshops", primary: false },
  { to: "/events", label: "events", primary: false },
];

function NavBar({ size = "lg" }: { size?: "lg" | "sm" }) {
  const isSmall = size === "sm";
  return (
    <div className={`flex items-center ${isSmall ? "gap-2 text-[13px]" : "gap-3 text-[15px]"} tracking-[0.05em]`}>
      {navLinks.map((link, i) => (
        <span key={link.to} className="contents">
          {i > 0 && <span className={`text-charcoal/15 ${isSmall ? "" : "mx-1"}`}>/</span>}
          <Link
            to={link.to}
            className={
              link.primary
                ? `font-semibold text-cream bg-iris ${isSmall ? "px-3 py-1" : "px-5 py-2"} rounded-full hover:bg-iris-hover transition-all duration-300 shadow-sm hover:shadow-md`
                : `font-medium text-charcoal ${isSmall ? "px-3 py-1" : "px-5 py-2"} rounded-full border border-charcoal/15 hover:border-charcoal/40 hover:bg-charcoal hover:text-cream transition-all duration-300`
            }
          >
            {link.label}
          </Link>
        </span>
      ))}
    </div>
  );
}

export function Home() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showStickyNav, setShowStickyNav] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyNav(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* ── Sticky nav ── */}
      <div
        className={`sticky top-14 z-40 transition-all duration-300 ${
          showStickyNav
            ? "bg-cream/95 backdrop-blur-sm shadow-header opacity-100 translate-y-0"
            : "opacity-0 -translate-y-2 pointer-events-none"
        }`}
      >
        <div className="mx-auto max-w-[1200px] px-6 md:px-10 py-3 flex justify-center">
          <NavBar size="sm" />
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="min-h-[85vh] flex flex-col pb-0 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px] w-full flex flex-col items-center text-center">
          <img
            src="/sunbird-icon.png"
            alt="Sunbird logo"
            className="w-40 md:w-56 h-auto object-contain mb-8"
          />
          <h1 className="font-display text-[clamp(3rem,8vw,6.5rem)] font-bold leading-[0.95] tracking-tight mb-2">
            <Wordmark />
          </h1>
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] mb-8">
            <span className="text-iris">Voice &middot; Music &middot; Songwriting</span>
            <span className="text-text-secondary"> &middot; Nashville, TN or Online</span>
          </p>
          <p className="text-lg text-text-secondary leading-relaxed mb-10 max-w-lg">
            Lessons in voice, songwriting, and the art of meaning it.
          </p>
          <div ref={sentinelRef}>
            <NavBar size="lg" />
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {lessonTypes.map((lesson) => {
              const Icon = lesson.icon;
              return (
              <Link
                key={lesson.slug}
                to={`/lessons/${lesson.slug}`}
                className="group text-center px-4 py-8 bg-surface rounded-card shadow-card hover:shadow-elevated transition-all duration-300"
              >
                <Icon className="w-6 h-6 text-text-secondary group-hover:text-gold transition-colors mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="font-display text-lg font-semibold group-hover:text-gold transition-colors mb-2">
                  {lesson.title}
                </h3>
                <p className="text-sm text-text-secondary italic">
                  {lesson.aside}
                </p>
              </Link>
              );
            })}
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
              Ellisa has spent the last decade teaching people to sing the way
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
      <section className="py-24 px-6 md:px-10 bg-blush">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
            <div className="md:col-span-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-charcoal/50 mb-6">
                The community
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-6 leading-tight text-charcoal">
                A room full of first drafts
                <span className="font-handwritten text-gold text-[0.7em] ml-2">
                  (the brave kind)
                </span>
              </h2>
              <p className="text-charcoal/70 leading-relaxed mb-8 max-w-sm">
                Students share original songs, offer gentle feedback, and occasionally
                surprise themselves. It's part open mic, part group chat, part proof
                that you actually did the thing.
              </p>
              <Link
                to="/community"
                className="text-[13px] font-medium text-charcoal border border-charcoal/40 px-6 py-2.5 hover:bg-charcoal hover:text-blush transition-all duration-300 tracking-wide inline-block"
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
                    className="flex items-center gap-5 p-5 bg-surface/20 border border-surface/30"
                  >
                    <div className="w-10 h-10 rounded-full bg-surface/30 flex items-center justify-center text-[11px] font-medium text-charcoal/60 shrink-0">
                      {song.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{song.title}</p>
                      <p className="text-[12px] text-charcoal/50">{song.name}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-charcoal/40 border border-charcoal/15 px-2 py-0.5 shrink-0">
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
