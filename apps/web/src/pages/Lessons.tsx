import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { CategoryPublic } from "@sunbird/shared";

export function Lessons() {
  const [lessons, setLessons] = useState<CategoryPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: CategoryPublic[] }>("/api/categories")
      .then((res) => setLessons(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="py-10 border-b border-charcoal/10 animate-pulse">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
                    <div className="md:col-span-1">
                      <div className="h-4 w-6 bg-warm-gray rounded" />
                    </div>
                    <div className="md:col-span-4">
                      <div className="h-8 w-40 bg-warm-gray rounded mb-2" />
                      <div className="h-5 w-52 bg-warm-gray/60 rounded" />
                    </div>
                    <div className="md:col-span-6">
                      <div className="h-4 w-full bg-warm-gray/50 rounded mb-2" />
                      <div className="h-4 w-3/4 bg-warm-gray/50 rounded" />
                    </div>
                  </div>
                </div>
              ))
            : lessons.map((lesson, i) => (
                <Link
                  key={lesson.slug}
                  to={`/categories/${lesson.slug}`}
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
                      {lesson.subtitle && (
                        <p className="font-handwritten text-lg text-gold mt-1">
                          {lesson.subtitle}
                        </p>
                      )}
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
