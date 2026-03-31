import type { BookingState } from "./BookPage";

type Props = {
  state: BookingState;
  update: (partial: Partial<BookingState>) => void;
};

export function StepCoach({ state, update }: Props) {
  const select = (coachId: string) => {
    update({ selectedCoachId: coachId, step: 4 });
  };

  return (
    <>
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
        Choose your coach
      </h2>
      <p className="text-text-secondary mb-10">
        Pick the coach you'd like to work with.
      </p>

      <div className="space-y-3">
        {state.coaches.map((coach) => (
          <button
            key={coach.id}
            onClick={() => select(coach.id)}
            className="group w-full text-left p-6 bg-surface rounded-card shadow-card hover:shadow-elevated transition-all duration-300 flex items-center gap-5"
          >
            <div className="shrink-0 w-12 h-12 rounded-full bg-warm-gray flex items-center justify-center">
              {coach.avatarUrl ? (
                <img
                  src={coach.avatarUrl}
                  alt={coach.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <span className="font-display text-lg font-semibold text-text-secondary">
                  {coach.name.charAt(0)}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold group-hover:text-gold transition-colors">
                {coach.name}
              </h3>
              {coach.bio && (
                <p className="text-sm text-text-secondary mt-0.5">
                  {coach.bio}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
