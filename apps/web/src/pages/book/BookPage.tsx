import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import type { LessonTypeWithCategories, AvailableSlot, UserPublic } from "@sunbird/shared";
import { StepLessonType } from "./StepLessonType";
import { StepCategory } from "./StepCategory";
import { StepCoach } from "./StepCoach";
import { StepDateTime } from "./StepDateTime";
import { StepConfirm } from "./StepConfirm";
import { BookingSuccess } from "./BookingSuccess";

export type BookingState = {
  step: 1 | 2 | 3 | 4 | 5 | "success";
  lessonTypes: LessonTypeWithCategories[];
  coaches: UserPublic[];
  selectedType: LessonTypeWithCategories | null;
  selectedCategoryId: string | null;
  selectedCoachId: string | null;
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
  coaches: [],
  selectedType: null,
  selectedCategoryId: null,
  selectedCoachId: null,
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
    Promise.all([
      apiFetch<{ data: LessonTypeWithCategories[] }>("/api/lessons"),
      apiFetch<{ data: UserPublic[] }>("/api/coaches"),
    ])
      .then(([lessonsRes, coachesRes]) => {
        const coaches = coachesRes.data;
        setState((s) => ({
          ...s,
          lessonTypes: lessonsRes.data,
          coaches,
          // Auto-select if only one coach
          selectedCoachId: coaches.length === 1 ? coaches[0].id : null,
        }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const update = (partial: Partial<BookingState>) =>
    setState((s) => ({ ...s, ...partial }));

  // Determine if we should show the coach step
  const showCoachStep = state.coaches.length > 1;
  // Total steps: 4 if coach auto-selected, 5 if coach selection needed
  const totalSteps = showCoachStep ? 5 : 4;

  const goBack = () => {
    if (showCoachStep) {
      // Steps: 1=lesson, 2=category, 3=coach, 4=datetime, 5=confirm
      if (state.step === 2) update({ step: 1 });
      else if (state.step === 3) {
        if (state.notSureType) update({ step: 1 });
        else update({ step: 2 });
      }
      else if (state.step === 4) update({ step: 3 });
      else if (state.step === 5) update({ step: 4 });
    } else {
      // Steps: 1=lesson, 2=category, 3=datetime, 4=confirm
      if (state.step === 2) update({ step: 1 });
      else if (state.step === 3) {
        if (state.notSureType) update({ step: 1 });
        else update({ step: 2 });
      }
      else if (state.step === 4) update({ step: 3 });
    }
  };

  // Map logical step to display step number
  const displayStep = typeof state.step === "number" ? state.step : 0;

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
            {displayStep > 1 && (
              <button
                onClick={goBack}
                className="text-[13px] font-medium text-text-secondary hover:text-charcoal transition-colors"
              >
                &larr; Back
              </button>
            )}
            <span className="ml-auto text-[12px] font-mono text-text-secondary">
              {String(displayStep).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
            </span>
          </div>
        )}

        {state.step === 1 && (
          <StepLessonType state={state} update={update} />
        )}
        {state.step === 2 && (
          <StepCategory state={state} update={update} />
        )}
        {state.step === 3 && showCoachStep && (
          <StepCoach state={state} update={update} />
        )}
        {state.step === (showCoachStep ? 4 : 3) && (
          <StepDateTime state={state} update={update} nextStep={showCoachStep ? 5 : 4} />
        )}
        {state.step === (showCoachStep ? 5 : 4) && (
          <StepConfirm state={state} update={update} />
        )}
        {state.step === "success" && (
          <BookingSuccess state={state} />
        )}
      </div>
    </div>
  );
}
