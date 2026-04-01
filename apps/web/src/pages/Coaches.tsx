import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { CoachPublic } from "@sunbird/shared";

export function Coaches() {
  const [coaches, setCoaches] = useState<CoachPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: CoachPublic[] }>("/api/coaches")
      .then((res) => setCoaches(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="font-display text-3xl md:text-5xl font-bold mb-4 text-center">
          Our Coaches
        </h1>
        <p className="text-text-secondary text-center mb-16 max-w-lg mx-auto">
          Meet the musicians and educators behind Sunbird.
        </p>

        {coaches.length === 0 ? (
          <p className="text-text-secondary text-center py-12">
            No coaches have published their profiles yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coaches.map((coach) => (
              <Link
                key={coach.id}
                to={`/coaches/${coach.slug}`}
                className="group bg-surface rounded-card shadow-card overflow-hidden hover:shadow-elevated transition-shadow duration-300"
              >
                {coach.coverImageUrl ? (
                  <div className="h-40 bg-warm-gray">
                    <img src={coach.coverImageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-32 bg-warm-gray/30" />
                )}
                <div className="p-6 -mt-8 relative">
                  <div className="shrink-0 w-16 h-16 rounded-full bg-surface shadow-card border-4 border-surface flex items-center justify-center overflow-hidden mb-3">
                    {coach.avatarUrl ? (
                      <img src={coach.avatarUrl} alt={coach.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-xl font-bold text-text-secondary">
                        {coach.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-semibold group-hover:text-iris transition-colors">
                    {coach.name}
                  </h2>
                  {coach.headline && (
                    <p className="text-sm text-text-secondary mt-0.5">{coach.headline}</p>
                  )}
                  {coach.bio && (
                    <p className="text-sm text-text-secondary mt-2 line-clamp-2">{coach.bio}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
