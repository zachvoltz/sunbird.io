import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { CoachProfilePublic } from "@sunbird/shared";

export function CoachProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [coach, setCoach] = useState<CoachProfilePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    apiFetch<{ data: CoachProfilePublic }>(`/api/coaches/${slug}`)
      .then((res) => setCoach(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !coach) {
    return (
      <div className="py-16 px-6 md:px-10">
        <div className="mx-auto max-w-[900px] text-center">
          <h1 className="font-display text-3xl font-bold mb-4">Coach not found</h1>
          <Link to="/coaches" className="text-sm text-iris hover:text-iris-hover transition-colors">
            Browse all coaches
          </Link>
        </div>
      </div>
    );
  }

  const priceDisplay = (cents: number) => `$${(cents / 100).toFixed(0)}`;

  return (
    <div>
      {/* Hero */}
      <div className="relative">
        {coach.coverImageUrl ? (
          <div className="h-64 md:h-80 bg-warm-gray">
            <img src={coach.coverImageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="h-48 md:h-64 bg-warm-gray/50" />
        )}
        <div className="mx-auto max-w-[900px] px-6 md:px-10 relative">
          <div className="flex items-end gap-5 -mt-12">
            <div className="shrink-0 w-24 h-24 rounded-full bg-surface shadow-card border-4 border-surface flex items-center justify-center overflow-hidden">
              {coach.avatarUrl ? (
                <img src={coach.avatarUrl} alt={coach.name} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-3xl font-bold text-text-secondary">
                  {coach.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="pb-2">
              <h1 className="font-display text-2xl md:text-3xl font-bold">{coach.name}</h1>
              {coach.headline && (
                <p className="text-text-secondary">{coach.headline}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="py-12 px-6 md:px-10">
        <div className="mx-auto max-w-[900px]">
          {/* About */}
          {(coach.longBio || coach.credentials) && (
            <section className="mb-16">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
                <div className="md:col-span-7">
                  {coach.longBio && (
                    <p className="text-text-secondary leading-relaxed whitespace-pre-line">
                      {coach.longBio}
                    </p>
                  )}
                </div>
                {coach.credentials && (
                  <div className="md:col-span-5">
                    <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-3">
                      Credentials
                    </h2>
                    <p className="text-sm text-text-secondary whitespace-pre-line">
                      {coach.credentials}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Categories (new) */}
          {coach.categories && coach.categories.length > 0 && (
            <section className="mb-16">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
                Courses
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coach.categories.map((cat) => (
                  <div key={cat.id} className="bg-surface rounded-card shadow-card p-6">
                    <h3 className="font-display text-lg font-semibold mb-1">{cat.title}</h3>
                    {cat.subtitle && (
                      <p className="font-handwritten text-gold mb-2">{cat.subtitle}</p>
                    )}
                    <p className="text-sm text-text-secondary leading-relaxed mb-4">
                      {cat.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-text-secondary">
                        {cat.skillTreeCount > 0 && (
                          <span className="text-iris">{cat.skillTreeCount} skill trees</span>
                        )}
                      </div>
                      <Link
                        to={`/book?coachId=${coach.id}&categoryId=${cat.id}`}
                        className="text-[13px] font-medium text-charcoal border border-charcoal px-4 py-1.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
                      >
                        Book
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Courses (legacy lesson types) */}
          {(!coach.categories || coach.categories.length === 0) && coach.lessonTypes.length > 0 && (
            <section className="mb-16">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
                Courses
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coach.lessonTypes.map((lt) => (
                  <div key={lt.id} className="bg-surface rounded-card shadow-card p-6">
                    <h3 className="font-display text-lg font-semibold mb-1">{lt.title}</h3>
                    {lt.subtitle && (
                      <p className="font-handwritten text-gold mb-2">{lt.subtitle}</p>
                    )}
                    <p className="text-sm text-text-secondary leading-relaxed mb-4">
                      {lt.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-text-secondary">
                        {priceDisplay(lt.pricePerSession)}/session
                        {lt.curriculumNodeCount > 0 && (
                          <span className="ml-2 text-iris">{lt.curriculumNodeCount} skills</span>
                        )}
                      </div>
                      <Link
                        to={`/book?coachId=${coach.id}&lessonTypeId=${lt.id}`}
                        className="text-[13px] font-medium text-charcoal border border-charcoal px-4 py-1.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
                      >
                        Book
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Social Links */}
          {coach.socialLinks && Object.keys(coach.socialLinks).length > 0 && (
            <section className="mb-16">
              <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
                Connect
              </h2>
              <div className="flex gap-4">
                {Object.entries(coach.socialLinks).map(([platform, url]) => (
                  <a
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-text-secondary hover:text-charcoal transition-colors capitalize"
                  >
                    {platform}
                  </a>
                ))}
              </div>
            </section>
          )}

          {/* Main CTA */}
          <div className="text-center py-10 border-t border-charcoal/10">
            <Link
              to={`/book?coachId=${coach.id}`}
              className="inline-block text-[14px] font-medium text-charcoal border border-charcoal px-8 py-3 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
            >
              Book a lesson with {coach.name}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
