import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { LessonTypeWithCategories, CategoryPublic, SkillTreeSummary } from "@sunbird/shared";

type CategoryDetail = CategoryPublic & {
  pricePerSession?: number;
  skillTrees?: SkillTreeSummary[];
  categories?: never;
};

type LessonOrCategory = (LessonTypeWithCategories | CategoryDetail) & {
  pricePerSession?: number;
};

export function LessonDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [lesson, setLesson] = useState<LessonOrCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    // Try category endpoint first, fall back to legacy lessons
    apiFetch<{ data: CategoryDetail }>(`/api/categories/${slug}`)
      .then((res) => setLesson(res.data as LessonOrCategory))
      .catch(() =>
        apiFetch<{ data: LessonTypeWithCategories }>(`/api/lessons/${slug}`)
          .then((res) => setLesson(res.data))
          .catch(() => setNotFound(true)),
      )
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="py-16 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px] animate-pulse">
          <div className="h-4 w-20 bg-warm-gray rounded mb-12" />
          <div className="h-12 w-64 bg-warm-gray rounded mb-4" />
          <div className="h-6 w-80 bg-warm-gray/60 rounded mb-8" />
          <div className="h-4 w-full max-w-lg bg-warm-gray/50 rounded mb-2" />
          <div className="h-4 w-3/4 max-w-lg bg-warm-gray/50 rounded" />
        </div>
      </div>
    );
  }

  if (notFound || !lesson) {
    return (
      <div className="py-16 px-6 md:px-10">
        <div className="mx-auto max-w-[1200px]">
          <Link
            to="/lessons"
            className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
          >
            &larr; Lessons
          </Link>
          <div className="mt-20 text-center">
            <h1 className="font-display text-4xl font-bold text-charcoal mb-4">
              Lesson not found
            </h1>
            <p className="text-text-secondary mb-8">
              We couldn't find a lesson type with that name.
            </p>
            <Link
              to="/lessons"
              className="text-[13px] font-medium text-charcoal border border-charcoal px-6 py-2.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
            >
              Browse all lessons
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const priceDisplay = lesson.pricePerSession ? `$${(lesson.pricePerSession / 100).toFixed(0)}` : null;

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
            <h1 className="font-display text-4xl md:text-6xl font-bold mb-4 leading-tight">
              {lesson.title}
            </h1>
            {lesson.subtitle && (
              <p className="font-handwritten text-2xl text-gold mb-8">
                {lesson.subtitle}
              </p>
            )}
            <p className="text-lg text-text-secondary leading-relaxed max-w-lg">
              {lesson.description}
            </p>
          </div>
          <div className="md:col-span-5">
            <div className="aspect-[4/5] bg-warm-gray/50 flex items-end p-6">
              <p className="text-[11px] uppercase tracking-[0.12em] text-text-secondary">
                Photo: {lesson.title.toLowerCase()} lesson in session
              </p>
            </div>
          </div>
        </div>

        {/* Skill Trees (new) or Categories (legacy) */}
        {(('skillTrees' in lesson && (lesson.skillTrees?.length ?? 0) > 0) ||
          ('categories' in lesson && (lesson.categories?.length ?? 0) > 1)) && (
          <>
            <section className="mb-24">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                <div className="md:col-span-4">
                  <h2 className="font-display text-2xl font-bold">
                    Ways to study
                  </h2>
                </div>
                <div className="md:col-span-8">
                  <div className="border-t border-charcoal/10">
                    {'skillTrees' in lesson && lesson.skillTrees?.map((st) => (
                      <div
                        key={st.id}
                        className="py-5 border-b border-charcoal/10"
                      >
                        <h3 className="font-display text-lg font-semibold mb-1">
                          {st.title}
                        </h3>
                        {st.description && (
                          <p className="text-sm text-text-secondary leading-relaxed">
                            {st.description}
                          </p>
                        )}
                        {st.nodeCount > 0 && (
                          <p className="text-xs text-iris mt-1">{st.nodeCount} skills</p>
                        )}
                      </div>
                    ))}
                    {'categories' in lesson && !('skillTrees' in lesson) && lesson.categories?.map((cat) => (
                      <div
                        key={cat.id}
                        className="py-5 border-b border-charcoal/10"
                      >
                        <h3 className="font-display text-lg font-semibold mb-1">
                          {cat.title}
                        </h3>
                        {cat.description && (
                          <p className="text-sm text-text-secondary leading-relaxed">
                            {cat.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <hr className="editorial-rule mb-24" />
          </>
        )}

        {/* Pricing & CTA */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 py-10 border-t border-charcoal/10">
          <div>
            {priceDisplay && (
            <p className="text-lg font-display font-semibold text-charcoal mb-1">
              {priceDisplay} per session
            </p>
            )}
            <p className="text-sm text-text-secondary">
              60-minute one-on-one lesson. See pricing for monthly packages.
            </p>
          </div>
          <Link
            to="/book"
            className="text-[13px] font-medium text-charcoal border border-charcoal px-6 py-2.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
          >
            Book a {lesson.title.toLowerCase()} lesson
          </Link>
        </div>
      </div>
    </div>
  );
}
