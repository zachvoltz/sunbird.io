import { Mic, PenLine, Heart, Guitar } from "lucide-react";
import type { BookingState } from "./BookPage";
import type { LessonTypeWithCategories } from "@sunbird/shared";

const iconMap: Record<string, typeof Mic> = {
  voice: Mic,
  songwriting: PenLine,
  "yoga-for-singers": Heart,
  "guitar-for-singers": Guitar,
};

type Props = {
  state: BookingState;
  update: (partial: Partial<BookingState>) => void;
};

export function StepLessonType({ state, update }: Props) {
  const select = (type: LessonTypeWithCategories) => {
    // If the type only has one "open" category, skip step 2
    const skipCategory =
      type.categories.length === 1 && type.categories[0].slug === "open";
    update({
      selectedType: type,
      notSureType: false,
      selectedCategoryId: skipCategory ? type.categories[0].id : null,
      notSureCategory: skipCategory,
      step: skipCategory ? 3 : 2,
    });
  };

  const selectNotSure = () => {
    update({
      selectedType: null,
      notSureType: true,
      selectedCategoryId: null,
      notSureCategory: true,
      step: 3,
    });
  };

  return (
    <>
      <h2 className="font-display text-3xl md:text-4xl font-bold mb-3">
        What would you like to work on?
      </h2>
      <p className="text-text-secondary mb-10">
        Pick a lesson type, or choose "not sure" and we'll figure it out together.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {state.lessonTypes.map((type) => {
          const Icon = iconMap[type.slug] || Mic;
          return (
            <button
              key={type.id}
              onClick={() => select(type)}
              className="group text-left p-6 bg-surface rounded-card shadow-card hover:shadow-elevated transition-all duration-300"
            >
              <Icon
                className="w-6 h-6 text-text-secondary group-hover:text-gold transition-colors mb-3"
                strokeWidth={1.5}
              />
              <h3 className="font-display text-lg font-semibold group-hover:text-gold transition-colors mb-1">
                {type.title}
              </h3>
              <p className="text-sm text-text-secondary">{type.subtitle}</p>
            </button>
          );
        })}
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
