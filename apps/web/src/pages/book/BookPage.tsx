import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { LessonTypeWithCategories, AvailableSlot, CoachPublic } from "@sunbird/shared";
import { StepLessonType } from "./StepLessonType";
import { StepCategory } from "./StepCategory";
import { StepCoach } from "./StepCoach";
import { StepDateTime } from "./StepDateTime";
import { StepConfirm } from "./StepConfirm";
import { BookingSuccess } from "./BookingSuccess";

export type BookingState = {
  step: 1 | 2 | 3 | 4 | 5 | "success";
  lessonTypes: LessonTypeWithCategories[];
  coaches: CoachPublic[];
  selectedType: LessonTypeWithCategories | null;
  selectedCategoryId: string | null;
  selectedCoachId: string | null;
  availableCoachIds: string[];
  mode: "ONLINE" | "IN_PERSON" | null;
  recurring: boolean;
  frequency: "WEEKLY" | "BIWEEKLY" | null;
  recurringEndDate: string | null;
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
  availableCoachIds: [],
  mode: null,
  recurring: false,
  frequency: null,
  recurringEndDate: null,
  notSureType: false,
  notSureCategory: false,
  selectedDate: null,
  selectedSlot: null,
  studentNote: "",
  bookingId: null,
};

// New flow: 1=LessonType, 2=Category, 3=DateTime, 4=Coach, 5=Confirm
const TOTAL_STEPS = 5;

export function BookPage() {
  const [state, setState] = useState<BookingState>(initialState);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const qCoachId = searchParams.get("coachId");
    const qLessonTypeId = searchParams.get("lessonTypeId");

    Promise.all([
      apiFetch<{ data: LessonTypeWithCategories[] }>("/api/lessons"),
      apiFetch<{ data: CoachPublic[] }>("/api/coaches?all=true"),
    ])
      .then(([lessonsRes, coachesRes]) => {
        const updates: Partial<BookingState> = {
          lessonTypes: lessonsRes.data,
          coaches: coachesRes.data,
        };

        // Pre-select lesson type from query param
        if (qLessonTypeId) {
          const lt = lessonsRes.data.find((t) => t.id === qLessonTypeId);
          if (lt) {
            updates.selectedType = lt;
            updates.notSureType = false;
            // Skip to category or datetime
            const skipCategory = lt.categories.length === 1 && lt.categories[0].slug === "open";
            if (skipCategory) {
              updates.selectedCategoryId = lt.categories[0].id;
              updates.notSureCategory = true;
              updates.step = 3;
            } else {
              updates.step = 2;
            }
          }
        }

        // Pre-select coach from query param
        if (qCoachId) {
          updates.selectedCoachId = qCoachId;
        }

        setState((s) => ({ ...s, ...updates }));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const update = (partial: Partial<BookingState>) =>
    setState((s) => {
      const next = { ...s, ...partial };

      // Auto-select coach if only one available after DateTime selection
      if (partial.availableCoachIds && partial.availableCoachIds.length === 1 && partial.step === 4) {
        next.selectedCoachId = partial.availableCoachIds[0];
        next.step = 5; // Skip coach step
      }

      return next;
    });

  const goBack = () => {
    // 1=LessonType, 2=Category, 3=DateTime, 4=Coach, 5=Confirm
    if (state.step === 2) update({ step: 1 });
    else if (state.step === 3) {
      if (state.notSureType) update({ step: 1 });
      else update({ step: 2 });
    }
    else if (state.step === 4) update({ step: 3 });
    else if (state.step === 5) {
      // Go back to coach if multiple were available, otherwise to datetime
      if (state.availableCoachIds.length > 1) update({ step: 4, selectedCoachId: null });
      else update({ step: 3 });
    }
  };

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
              {String(displayStep).padStart(2, "0")} / {String(TOTAL_STEPS).padStart(2, "0")}
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
          <StepDateTime state={state} update={update} nextStep={4} />
        )}
        {state.step === 4 && (
          <StepCoach state={state} update={update} />
        )}
        {state.step === 5 && (
          <StepConfirm state={state} update={update} />
        )}
        {state.step === "success" && (
          <BookingSuccess state={state} />
        )}
      </div>
    </div>
  );
}
