import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { LessonTypeWithCategories, AvailableSlot } from "@sunbird/shared";
import { StepLessonType } from "./StepLessonType";
import { StepCategory } from "./StepCategory";
import { StepDateTime } from "./StepDateTime";
import { StepConfirm } from "./StepConfirm";
import { BookingSuccess } from "./BookingSuccess";

export type BookingState = {
  step: 1 | 2 | 3 | 4 | "success";
  lessonTypes: LessonTypeWithCategories[];
  selectedType: LessonTypeWithCategories | null;
  selectedCategoryId: string | null;
  notSureType: boolean;
  notSureCategory: boolean;
  selectedDate: string | null;
  selectedSlot: AvailableSlot | null;
  studentNote: string;
  bookingId: string | null;
};

const initialState: BookingState = {
  step: 1,
  lessonTypes: [],
  selectedType: null,
  selectedCategoryId: null,
  notSureType: false,
  notSureCategory: false,
  selectedDate: null,
  selectedSlot: null,
  studentNote: "",
  bookingId: null,
};

export function BookPage() {
  const [state, setState] = useState<BookingState>(initialState);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: LessonTypeWithCategories[] }>("/api/lessons")
      .then((res) => setState((s) => ({ ...s, lessonTypes: res.data })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const update = (partial: Partial<BookingState>) =>
    setState((s) => ({ ...s, ...partial }));

  const goBack = () => {
    if (state.step === 2) update({ step: 1 });
    else if (state.step === 3) {
      if (state.notSureType) update({ step: 1 });
      else update({ step: 2 });
    } else if (state.step === 4) update({ step: 3 });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[800px]">
        {/* Step indicator */}
        {state.step !== "success" && (
          <div className="flex items-center gap-3 mb-12">
            {state.step > 1 && (
              <button
                onClick={goBack}
                className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors"
              >
                &larr; Back
              </button>
            )}
            <span className="ml-auto text-[12px] font-mono text-text-secondary">
              {String(state.step).padStart(2, "0")} / 04
            </span>
          </div>
        )}

        {state.step === 1 && (
          <StepLessonType state={state} update={update} />
        )}
        {state.step === 2 && (
          <StepCategory state={state} update={update} />
        )}
        {state.step === 3 && (
          <StepDateTime state={state} update={update} />
        )}
        {state.step === 4 && (
          <StepConfirm state={state} update={update} />
        )}
        {state.step === "success" && (
          <BookingSuccess state={state} />
        )}
      </div>
    </div>
  );
}
