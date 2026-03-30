import type { BookingState } from "./BookPage";

type Props = {
  state: BookingState;
  update: (partial: Partial<BookingState>) => void;
};

export function StepCategory({ state, update }: Props) {
  const type = state.selectedType!;

  const select = (categoryId: string) => {
    update({
      selectedCategoryId: categoryId,
      notSureCategory: false,
      step: 3,
    });
  };

  const selectNotSure = () => {
    update({
      selectedCategoryId: null,
      notSureCategory: true,
      step: 3,
    });
  };

  return (
    <>
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-iris mb-4">
        {type.title}
      </p>
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
        What's your focus?
      </h2>
      <p className="text-text-secondary mb-10">
        Pick the area you'd like to work on, or keep it open.
      </p>

      <div className="space-y-3">
        {type.categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => select(cat.id)}
            className="group w-full text-left p-5 bg-surface rounded-card shadow-card hover:shadow-elevated transition-all duration-300"
          >
            <h3 className="font-display text-lg font-semibold group-hover:text-gold transition-colors mb-1">
              {cat.title}
            </h3>
            {cat.description && (
              <p className="text-sm text-text-secondary">{cat.description}</p>
            )}
          </button>
        ))}

        <button
          onClick={selectNotSure}
          className="w-full p-5 text-left border border-charcoal/10 rounded-card hover:border-charcoal/25 transition-colors"
        >
          <h3 className="font-display text-lg font-semibold mb-1">
            Not sure / Open
          </h3>
          <p className="text-sm text-text-secondary">
            We'll figure out what you need when we meet.
          </p>
        </button>
      </div>
    </>
  );
}
