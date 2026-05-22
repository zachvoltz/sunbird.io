import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";

type PlanId = "individual" | "group" | "student";

type Plan = {
  id: PlanId;
  eyebrow: string;
  name: string;
  priceLabel: string;
  cadence: string;
  extraLine: string | null;
  description: string;
  features: string[];
  cta: { label: string; to: string };
  highlight?: boolean;
  accent: "iris" | "gold" | "sage";
};

const plans: Plan[] = [
  {
    id: "individual",
    eyebrow: "For solo teachers",
    name: "Individual",
    priceLabel: "$12",
    cadence: "per month",
    extraLine: null,
    description:
      "Everything one coach needs to run a studio — roster, lessons, notes, takes.",
    features: [
      "Unlimited students",
      "Scheduling & weekly availability",
      "Practice plans & lesson notes",
      "Take review with voice replies",
      "Public coach profile page",
    ],
    cta: { label: "Start as an individual", to: "/login?plan=individual" },
    accent: "iris",
    highlight: true,
  },
  {
    id: "group",
    eyebrow: "For studios & companies",
    name: "Group",
    priceLabel: "$18",
    cadence: "per month",
    extraLine: "+ $4 per additional coach",
    description:
      "A shared studio for teams of teachers, with one bill and a shared library.",
    features: [
      "Everything in Individual",
      "Shared exercise & MIDI library",
      "Multiple coach accounts",
      "Studio-wide roster view",
      "Centralized billing",
    ],
    cta: { label: "Set up a studio", to: "/login?plan=group" },
    accent: "gold",
  },
  {
    id: "student",
    eyebrow: "For learners",
    name: "Students",
    priceLabel: "Free",
    cadence: "always",
    extraLine: null,
    description:
      "Students join their coach's studio at no cost — booking, notes, and takes included.",
    features: [
      "Book lessons with your coach",
      "Receive practice plans",
      "Record & send takes",
      "Voice range & curriculum tools",
      "Your own private dashboard",
    ],
    cta: { label: "Find a coach", to: "/coaches" },
    accent: "sage",
  },
];

const accentClasses = {
  iris: {
    eyebrow: "text-iris",
    ring: "ring-iris/40",
    check: "text-iris",
    button:
      "text-cream bg-iris hover:bg-iris-hover shadow-sm hover:shadow-md",
  },
  gold: {
    eyebrow: "text-gold",
    ring: "ring-gold/40",
    check: "text-gold",
    button:
      "text-charcoal border border-charcoal hover:bg-charcoal hover:text-cream",
  },
  sage: {
    eyebrow: "text-sage",
    ring: "ring-sage/40",
    check: "text-sage",
    button:
      "text-charcoal border border-charcoal hover:bg-charcoal hover:text-cream",
  },
} as const;

const faqs = [
  {
    q: "How does billing work for studios?",
    a: "The studio owner is billed monthly. The base $18 covers the first coach seat; each additional coach is $4/month, prorated when they join.",
  },
  {
    q: "Do students ever pay?",
    a: "No — student accounts are free. The only exception is the optional AI practice tools (coming soon), which are billed directly to students who opt in.",
  },
  {
    q: "Can I switch between Individual and Group later?",
    a: "Yes. You can upgrade an individual account into a studio, or scale a studio down to a single seat. Changes take effect on your next billing cycle.",
  },
  {
    q: "Is there a free trial?",
    a: "The first 14 days are free for any new coach account. No card required to start.",
  },
];

export function Pricing() {
  const [showAi, setShowAi] = useState(false);

  return (
    <>
      {/* ── Hero ── */}
      <section className="pt-20 pb-12 px-6 md:px-10">
        <div className="mx-auto max-w-[900px] text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
            Pricing
          </p>
          <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-bold leading-[1.05] tracking-tight mb-6">
            Built for coaches.
            <br />
            <span className="text-iris">Free for students.</span>
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed max-w-xl mx-auto">
            One simple price per coach. Students never pay to join a studio,
            book lessons, or follow a practice plan.
          </p>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <hr className="editorial-rule" />
      </div>

      {/* ── Plans ── */}
      <section className="py-20 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {plans.map((plan) => {
              const accent = accentClasses[plan.accent];
              return (
                <div
                  key={plan.id}
                  className={`relative bg-surface rounded-card shadow-card hover:shadow-elevated transition-all duration-300 p-8 md:p-10 flex flex-col ${
                    plan.highlight ? `ring-1 ${accent.ring}` : ""
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.15em] font-medium text-cream bg-iris px-3 py-1 rounded-full">
                      Most coaches
                    </span>
                  )}

                  <p
                    className={`text-[11px] font-medium uppercase tracking-[0.15em] mb-3 ${accent.eyebrow}`}
                  >
                    {plan.eyebrow}
                  </p>
                  <h2 className="font-display text-3xl font-bold mb-4">
                    {plan.name}
                  </h2>

                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="font-display text-5xl font-bold">
                      {plan.priceLabel}
                    </span>
                    <span className="text-sm text-text-secondary">
                      {plan.cadence}
                    </span>
                  </div>
                  {plan.extraLine ? (
                    <p className="text-[12px] text-text-secondary italic mb-6">
                      {plan.extraLine}
                    </p>
                  ) : (
                    <div className="mb-6 h-[18px]" />
                  )}

                  <p className="text-sm text-text-secondary leading-relaxed mb-6">
                    {plan.description}
                  </p>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm">
                        <Check
                          className={`w-4 h-4 mt-0.5 shrink-0 ${accent.check}`}
                          strokeWidth={2}
                        />
                        <span className="text-charcoal">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={plan.cta.to}
                    className={`block text-center text-[13px] font-medium px-5 py-3 rounded-card tracking-wide transition-all duration-300 ${accent.button}`}
                  >
                    {plan.cta.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI add-on (coming soon) ── */}
      <section className="py-16 px-6 md:px-10 bg-blush">
        <div className="mx-auto max-w-[900px]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-gold" strokeWidth={1.75} />
                <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-charcoal/60">
                  Coming soon · AI practice tools
                </p>
              </div>
              <h3 className="font-display text-2xl md:text-3xl font-semibold mb-3 text-charcoal leading-tight">
                Optional AI tools for students,
                <br className="hidden md:block" /> billed only if they opt in.
              </h3>
              <p className="text-charcoal/70 leading-relaxed max-w-lg">
                A flat $3/month per student covers the practice partner,
                listening feedback, and exercise generation. Heavier token
                usage is billed as an opt-in overage, directly to the student —
                never to your studio.
              </p>
              <button
                onClick={() => setShowAi((v) => !v)}
                className="mt-4 text-[12px] font-medium text-charcoal underline underline-offset-4 hover:text-iris transition-colors"
              >
                {showAi ? "Hide details" : "How will overages work?"}
              </button>
              {showAi && (
                <div className="mt-4 text-sm text-charcoal/75 leading-relaxed border-l-2 border-charcoal/20 pl-4 max-w-lg">
                  Students set a monthly cap. Below the cap, the $3 base covers
                  normal practice. Above the cap, the student is prompted to
                  approve additional usage before any extra tokens are charged.
                  Coaches see usage at the studio level but never pay it.
                </div>
              )}
            </div>
            <div className="shrink-0">
              <span className="inline-block text-[11px] uppercase tracking-[0.15em] font-medium text-charcoal/50 border border-charcoal/20 px-4 py-2 rounded-full">
                Not yet available
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison strip ── */}
      <section className="py-20 px-6 md:px-10">
        <div className="mx-auto max-w-[900px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6 text-center">
            What's included
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-12 text-center">
            Everything a teaching studio needs.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-6">
            {[
              "Lesson scheduling & calendar",
              "Practice plans per student",
              "Lesson notes & voice memos",
              "Take review with replies",
              "Exercise & MIDI library",
              "Voice range tracking",
              "Skill trees & curriculum",
              "Public coach profile",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <Check
                  className="w-4 h-4 mt-0.5 shrink-0 text-iris"
                  strokeWidth={2}
                />
                <span className="text-sm text-charcoal">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <hr className="editorial-rule" />
      </div>

      {/* ── FAQ ── */}
      <section className="py-20 px-6 md:px-10">
        <div className="mx-auto max-w-[760px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6 text-center">
            Questions
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-12 text-center">
            Good things to know.
          </h2>
          <div className="space-y-8">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-display text-lg font-semibold mb-2 text-charcoal">
                  {f.q}
                </h3>
                <p className="text-text-secondary leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 md:px-10 bg-cream">
        <div className="mx-auto max-w-[700px] text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4 leading-tight">
            Start free for 14 days.
          </h2>
          <p className="text-text-secondary leading-relaxed mb-8 max-w-md mx-auto">
            No card required. Add students, run a few lessons, and decide
            later.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login?plan=individual"
              className="text-[13px] font-medium text-cream bg-iris px-6 py-3 rounded-full hover:bg-iris-hover transition-all duration-300 shadow-sm hover:shadow-md tracking-wide"
            >
              Start as a coach
            </Link>
            <Link
              to="/coaches"
              className="text-[13px] font-medium text-charcoal border border-charcoal/30 px-6 py-3 rounded-full hover:border-charcoal hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
            >
              I'm a student
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
