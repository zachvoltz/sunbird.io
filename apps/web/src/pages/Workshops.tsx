import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PenLine, Compass, Heart } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const workshops: Array<{
  slug: string;
  title: string;
  tagline: string;
  duration: string;
  format: string;
  endsIn: string;
  description: string;
  icon: LucideIcon;
  weeks: Array<{ label: string; title: string; detail: string }>;
  note: string;
}> = [
  {
    slug: "expressive-songwriting",
    title: "Expressive Songwriting",
    icon: PenLine,
    tagline: "Write every day. See what shows up.",
    duration: "4 weeks",
    format: "In person or online",
    endsIn: "Songshare",
    description:
      "A month built around one deceptively simple habit: writing daily. Not performing, not polishing — just writing. By the end, you'll have pages of raw material and at least one song you didn't know was in you.",
    weeks: [
      {
        label: "Week 1",
        title: "The Daily Free-Write",
        detail:
          "Ten minutes every morning (or night — we're not prescriptive). Write about imagery you love, a feeling you can't name, a memory that won't leave. Anything that keeps the pen moving. The only rule: jump around for the first five minutes, then commit to one idea for the last five.",
      },
      {
        label: "Week 2",
        title: "Finding the Thread",
        detail:
          "Look back at what you've written. Circle the lines that surprise you. We'll start pulling themes from the raw material — not forcing a song yet, just noticing what keeps coming back.",
      },
      {
        label: "Week 3",
        title: "Shaping",
        detail:
          "Take your strongest thread and give it structure. Melody, rhythm, form — whatever the words are asking for. We'll work through it together in group sessions.",
      },
      {
        label: "Week 4",
        title: "Songshare",
        detail:
          "Perform what you've made — finished or not. The room is gentle. The point isn't perfection, it's proof that you showed up every day and something came of it.",
      },
    ],
    note: "Jump around if you want to for the first five minutes, then commit for the last ten to one idea. The habit matters more than the output.",
  },
  {
    slug: "exploration",
    title: "Exploration",
    icon: Compass,
    tagline: "Take a daytrip. Write a song about it.",
    duration: "4 weeks",
    format: "In person or online",
    endsIn: "Songshare",
    description:
      "Go somewhere you've never been — or somewhere you know too well to actually see anymore. Spend the day paying attention. Write about what you notice, how your body feels, what you overhear. The next month, we turn that day into a song.",
    weeks: [
      {
        label: "Week 1",
        title: "The Daytrip",
        detail:
          "Take a trip — a new neighborhood, a state park, a town you've driven past a hundred times. Bring a notebook. Write about your day as it happens: what you see, how you're feeling, the conversations you overhear. Don't worry about making it poetic. Just be honest.",
      },
      {
        label: "Week 2",
        title: "The Raw Material",
        detail:
          "Bring your notes to the group. Read them out loud. We'll find the moments that land — the images, the details, the emotional turns you didn't plan.",
      },
      {
        label: "Week 3",
        title: "From Place to Song",
        detail:
          "Shape your experience into lyrics. We'll explore how setting becomes metaphor, how a real place can hold a feeling bigger than itself.",
      },
      {
        label: "Week 4",
        title: "Songshare",
        detail:
          "Share what the trip became. Some songs will be about the place. Some will be about what you were carrying when you got there. Both count.",
      },
    ],
    note: "The daytrip isn't the destination — it's the interruption. New input makes new songs possible.",
  },
  {
    slug: "healing",
    title: "Healing",
    icon: Heart,
    tagline: "Songwriting and yoga. Body and voice together.",
    duration: "4 weeks",
    format: "In person",
    endsIn: "Songshare",
    description:
      "A month of slowing down. Each session begins with yoga — grounding in the body, releasing what's held — and moves into songwriting from that opened-up place. The songs that come out tend to be quieter, stranger, and more honest than anything you'd write at a desk.",
    weeks: [
      {
        label: "Week 1",
        title: "Arriving",
        detail:
          "Gentle yoga focused on breath and grounding. Then we write from the body — not about it, from it. What does your chest want to say? Your hands? We start with sensation and let language follow.",
      },
      {
        label: "Week 2",
        title: "Release",
        detail:
          "Deeper stretches, longer holds. The writing moves into letting go — of narratives, of tension, of songs you think you're supposed to write. We make space for the ones that actually want to come through.",
      },
      {
        label: "Week 3",
        title: "Integration",
        detail:
          "Yoga and writing start to blur. We'll move between the mat and the page, letting the rhythm of one inform the other. Melody starts to enter.",
      },
      {
        label: "Week 4",
        title: "Songshare",
        detail:
          "A quiet share. Some songs will be whispered. Some will be read, not sung. The room holds all of it.",
      },
    ],
    note: "No yoga experience necessary. No flexibility required. Just willingness.",
  },
];

function WorkshopNav() {
  const [collapsed, setCollapsed] = useState(false);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Collapse when the sentinel scrolls out of view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  // Track which workshop section is in view
  useEffect(() => {
    const sections = workshops.map((w) => document.getElementById(w.slug));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSlug(entry.target.id);
          }
        }
      },
      { threshold: 0.1, rootMargin: "-100px 0px -60% 0px" },
    );
    sections.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Sentinel — marks where the nav starts in the document flow */}
      <div ref={sentinelRef} />

      <div
        className={`sticky top-14 z-40 transition-all duration-500 ${
          collapsed
            ? "bg-cream/95 backdrop-blur-sm shadow-header -mx-6 md:-mx-10 px-6 md:px-10"
            : ""
        }`}
      >
        {/* Expanded view */}
        <div
          className={`overflow-hidden transition-all duration-500 ${
            collapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
          }`}
        >
          <div className="flex flex-col sm:flex-row justify-center gap-6 py-6">
            {workshops.map((workshop) => {
              const Icon = workshop.icon;
              return (
              <a
                key={workshop.slug}
                href={`#${workshop.slug}`}
                className="group flex-1 text-center px-6 py-8 hover:bg-warm-gray/30 transition-colors rounded-card"
              >
                <Icon className="w-6 h-6 text-text-secondary group-hover:text-gold transition-colors mx-auto mb-4" strokeWidth={1.5} />
                <h3 className="font-display text-lg md:text-xl font-semibold group-hover:text-gold transition-colors mb-2">
                  {workshop.title}
                </h3>
                <p className="text-sm text-text-secondary italic">
                  {workshop.tagline}
                </p>
              </a>
              );
            })}
          </div>
        </div>

        {/* Collapsed one-line view */}
        <div
          className={`flex items-center gap-6 overflow-hidden transition-all duration-500 ${
            collapsed ? "max-h-16 opacity-100 py-4" : "max-h-0 opacity-0"
          }`}
        >
          {workshops.map((workshop) => {
            const Icon = workshop.icon;
            return (
            <a
              key={workshop.slug}
              href={`#${workshop.slug}`}
              className={`flex items-center gap-2 whitespace-nowrap text-[13px] font-medium tracking-wide transition-colors ${
                activeSlug === workshop.slug
                  ? "text-charcoal"
                  : "text-text-secondary hover:text-charcoal"
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.5} />
              {workshop.title}
              {activeSlug === workshop.slug && (
                <span className="block w-1 h-1 rounded-full bg-gold" />
              )}
            </a>
            );
          })}
        </div>
      </div>
    </>
  );
}

export function Workshops() {
  return (
    <div className="px-6 md:px-10">
      <div className="mx-auto max-w-[1200px]">
        {/* Header + nav fill the first screen */}
        <div className="min-h-[calc(100vh-3.5rem)] flex flex-col pt-16">
          <div className="mb-auto flex flex-col items-center text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
              Workshops
            </p>
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight">
              A month at a time
            </h1>
            <p className="text-lg text-text-secondary max-w-xl leading-relaxed">
              Each workshop is a four-week arc — a daily practice, weekly sessions,
              and a songshare at the end. You come in with nothing prepared.
              You leave with a song.
            </p>
          </div>

          {/* Workshop nav — pushed to bottom of viewport */}
          <div className="pb-10">
            <WorkshopNav />
          </div>
        </div>

        <div className="h-20" />

        {/* Workshop list */}
        <div className="space-y-32">
          {workshops.map((workshop, wi) => {
            const Icon = workshop.icon;
            return (
            <section key={workshop.slug} id={workshop.slug}>
              {wi > 0 && (
                <div className="mb-20">
                  <hr className="editorial-rule" />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-16">
                {/* Left column — overview */}
                <div className="md:col-span-4">
                  <Icon className="w-6 h-6 text-gold mb-3" strokeWidth={1.5} />
                  <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 leading-tight">
                    {workshop.title}
                  </h2>
                  <p className="font-handwritten text-xl text-gold mb-6">
                    {workshop.tagline}
                  </p>

                  <div className="space-y-2 text-sm text-text-secondary mb-8">
                    <p>
                      <span className="text-[11px] uppercase tracking-[0.1em] text-charcoal/40 mr-2">
                        Duration
                      </span>
                      {workshop.duration}
                    </p>
                    <p>
                      <span className="text-[11px] uppercase tracking-[0.1em] text-charcoal/40 mr-2">
                        Format
                      </span>
                      {workshop.format}
                    </p>
                    <p>
                      <span className="text-[11px] uppercase tracking-[0.1em] text-charcoal/40 mr-2">
                        Ends in
                      </span>
                      {workshop.endsIn}
                    </p>
                  </div>

                  <Link
                    to="/book"
                    className="text-[13px] font-medium text-charcoal border border-charcoal px-5 py-2 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide inline-block"
                  >
                    Sign up
                  </Link>
                </div>

                {/* Right column — details */}
                <div className="md:col-span-8">
                  <p className="text-text-secondary leading-relaxed mb-10">
                    {workshop.description}
                  </p>

                  {/* Week-by-week */}
                  <div className="border-t border-charcoal/10">
                    {workshop.weeks.map((week) => (
                      <div
                        key={week.label}
                        className="py-6 border-b border-charcoal/10"
                      >
                        <div className="flex items-baseline gap-4 mb-2">
                          <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-text-secondary shrink-0">
                            {week.label}
                          </span>
                          <h3 className="font-display text-lg font-semibold">
                            {week.title}
                          </h3>
                        </div>
                        <p className="text-sm text-text-secondary leading-relaxed pl-[calc(0.5rem+3.5ch+1rem)]">
                          {week.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Note */}
                  {workshop.note && (
                    <p className="mt-8 text-sm text-text-secondary italic border-l-2 border-gold/30 pl-4">
                      {workshop.note}
                    </p>
                  )}
                </div>
              </div>
            </section>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-32 text-center">
          <hr className="editorial-rule mb-16" />
          <p className="font-handwritten text-2xl text-charcoal mb-4">
            Not sure which one?
          </p>
          <p className="text-text-secondary mb-8 max-w-md mx-auto">
            Reach out and we'll figure out where you are and which month
            makes sense to start with.
          </p>
          <Link
            to="/contact"
            className="text-[13px] font-medium text-charcoal border border-charcoal px-6 py-2.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide inline-block"
          >
            Get in touch
          </Link>
        </div>
      </div>
    </div>
  );
}
