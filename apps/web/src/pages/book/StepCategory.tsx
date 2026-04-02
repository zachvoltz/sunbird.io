import type { BookingState } from "./BookPage";
import type { CategoryPublic } from "@sunbird/shared";

type Props = {
  state: BookingState;
  update: (partial: Partial<BookingState>) => void;
};

export function StepCategory({ state, update }: Props) {
  const select = (cat: CategoryPublic) => {
    update({
      selectedCategory: cat,
      notSureCategory: false,
      step: 2,
    });
  };

  const selectNotSure = () => {
    update({
      selectedCategory: null,
      notSureCategory: true,
      notSureSkillTree: true,
      step: 3,
    });
  };

  return (
    <>
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3 text-center">
        What would you like to work on?
      </h2>
      <p className="text-text-secondary mb-10 text-center">
        Pick a category, or choose "not sure" and we'll figure it out together.
      </p>

      <div className={`grid grid-cols-1 ${state.categories.length <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-4`}>
        {state.categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => select(cat)}
            className="group text-left p-6 bg-surface rounded-card shadow-card hover:shadow-elevated transition-all duration-300"
          >
            <h3 className="font-display text-lg font-semibold group-hover:text-gold transition-colors mb-1">
              {cat.title}
            </h3>
            {cat.subtitle && (
              <p className="text-sm text-text-secondary">{cat.subtitle}</p>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={selectNotSure}
        className="mt-4 w-full p-5 text-left border border-charcoal/10 rounded-card hover:border-charcoal/25 transition-colors"
      >
        <h3 className="font-display text-lg font-semibold mb-1">
          Not sure / Open
        </h3>
        <p className="text-sm text-text-secondary">
          No worries — we'll talk through it and find the right fit.
        </p>
      </button>
    </>
  );
}
