import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiFetch, conversationsApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import type { CoachProfilePublic, SubscriptionPlanPublic } from "@sunbird/shared";

// Monthly lesson packages a coach sells (Model B). Coexists with per-session
// booking — a student can subscribe here or just "Book a lesson" below. The
// list endpoint is auth-gated, so logged-out visitors simply see no section.
function PackagesSection({ coachId, coachName }: { coachId: string; coachName: string }) {
  const [plans, setPlans] = useState<SubscriptionPlanPublic[]>([]);
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: SubscriptionPlanPublic[] }>(`/api/packages?coachId=${coachId}`)
      .then((r) => setPlans(r.data.filter((p) => p.subscribable)))
      .catch(() => setPlans([]));
  }, [coachId]);

  if (plans.length === 0) return null;

  const subscribe = async (planId: string) => {
    setSubscribingId(planId);
    try {
      const res = await apiFetch<{ data: { checkoutUrl: string | null } }>(
        "/api/packages/subscribe",
        { method: "POST", body: JSON.stringify({ planId }) },
      );
      if (res.data.checkoutUrl) {
        window.location.href = res.data.checkoutUrl;
        return;
      }
      window.alert("Couldn't start checkout — please try again.");
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't start checkout.");
    } finally {
      setSubscribingId(null);
    }
  };

  return (
    <section className="mb-16">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
        Monthly packages
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="bg-surface rounded-card shadow-card p-6 flex flex-col">
            <h3 className="font-display text-lg font-semibold mb-1">{p.name}</h3>
            <p className="font-handwritten text-gold mb-2">
              {p.lessonsPerMonth} lessons / month
            </p>
            <div className="text-2xl font-display font-bold mb-4">
              ${(p.priceMonthly / 100).toFixed(0)}
              <span className="text-sm font-normal text-text-secondary">/mo</span>
            </div>
            <button
              onClick={() => subscribe(p.id)}
              disabled={subscribingId === p.id}
              className="mt-auto text-[13px] font-medium text-charcoal border border-charcoal px-4 py-2 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide disabled:opacity-50"
            >
              {subscribingId === p.id ? "Starting…" : `Subscribe — ${coachName}`}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CoachProfile() {
  const { slug } = useParams<{ slug: string }>();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [coach, setCoach] = useState<CoachProfilePublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [messaging, setMessaging] = useState(false);

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

          {/* Monthly packages */}
          <PackagesSection coachId={coach.id} coachName={coach.name} />

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
          <div className="text-center py-10 border-t border-charcoal/10 flex flex-wrap gap-3 justify-center">
            <Link
              to={`/book?coachId=${coach.id}`}
              className="inline-block text-[14px] font-medium text-charcoal border border-charcoal px-8 py-3 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
            >
              Book a lesson with {coach.name}
            </Link>
            {/* Direct message — only for signed-in users (the endpoint is
                cookie-auth). Opens or creates the thread, then navigates. */}
            {isAuthenticated && (
              <button
                disabled={messaging}
                onClick={async () => {
                  setMessaging(true);
                  try {
                    const id = await conversationsApi.with(coach.id);
                    navigate(`/messages/${id}`);
                  } catch (err: any) {
                    window.alert(err?.body?.error ?? "Couldn't open the conversation");
                    setMessaging(false);
                  }
                }}
                className="inline-block text-[14px] font-medium text-charcoal border border-charcoal px-8 py-3 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide disabled:opacity-50"
              >
                {messaging ? "Opening…" : `Message ${coach.name}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
