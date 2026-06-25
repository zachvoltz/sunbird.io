import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import type { CategoryPublic, AvailableSlot, CoachPublic } from "@sunbird/shared";
import { StepCategory } from "./StepCategory";
import { StepCoach } from "./StepCoach";
import { StepDateTime } from "./StepDateTime";
import { StepConfirm } from "./StepConfirm";
import { BookingSuccess } from "./BookingSuccess";
import { consumeBookingResume } from "./bookingResume";

export type SkillTreeOption = {
  id: string;
  title: string;
  description: string | null;
  nodeCount: number;
  nodes: { id: string; title: string }[];
};

export type BookingState = {
  step: 1 | 2 | 3 | 4 | "success";
  categories: CategoryPublic[];
  coaches: CoachPublic[];
  selectedCategory: CategoryPublic | null;
  selectedSkillTreeId: string | null;
  selectedNodeId: string | null;
  selectedCoachId: string | null;
  availableCoachIds: string[];
  mode: "ONLINE" | "IN_PERSON" | null;
  recurring: boolean;
  frequency: "WEEKLY" | "BIWEEKLY" | null;
  recurringEndDate: string | null;
  notSureCategory: boolean;
  notSureSkillTree: boolean;
  selectedDate: string | null;
  selectedSlot: AvailableSlot | null;
  studentNote: string;
  bookingId: string | null;
  skillTrees: SkillTreeOption[];
};

const initialState: BookingState = {
  step: 1,
  categories: [],
  coaches: [],
  selectedCategory: null,
  selectedSkillTreeId: null,
  selectedNodeId: null,
  selectedCoachId: null,
  availableCoachIds: [],
  mode: null,
  recurring: false,
  frequency: null,
  recurringEndDate: null,
  notSureCategory: false,
  notSureSkillTree: false,
  selectedDate: null,
  selectedSlot: null,
  studentNote: "",
  bookingId: null,
  skillTrees: [],
};

// Flow: 1=Category, 2=DateTime, 3=Coach, 4=Confirm
const TOTAL_STEPS = 4;

export function BookPage() {
  const [state, setState] = useState<BookingState>(initialState);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const qCoachId = searchParams.get("coachId");
    const qCategoryId = searchParams.get("categoryId") || searchParams.get("lessonTypeId");

    Promise.all([
      apiFetch<{ data: CategoryPublic[] }>("/api/categories"),
      apiFetch<{ data: CoachPublic[] }>("/api/coaches?all=true"),
    ])
      .then(([catRes, coachesRes]) => {
        const updates: Partial<BookingState> = {
          categories: catRes.data,
          coaches: coachesRes.data,
        };

        // Returning from the Google sign-in hop: restore the booking the student
        // had in progress and drop them back on the step they left (Confirm).
        const resumed = consumeBookingResume();
        if (resumed) {
          Object.assign(updates, resumed);
        } else {
          if (qCategoryId) {
            const cat = catRes.data.find((c) => c.id === qCategoryId);
            if (cat) {
              updates.selectedCategory = cat;
              updates.notSureSkillTree = true;
              updates.step = 2;
            }
          }

          if (qCoachId) {
            updates.selectedCoachId = qCoachId;
          }
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
      if (partial.availableCoachIds && partial.availableCoachIds.length === 1 && partial.step === 3) {
        next.selectedCoachId = partial.availableCoachIds[0];
        next.step = 4;
      }

      return next;
    });

  const goBack = () => {
    // 1=Category, 2=DateTime, 3=Coach, 4=Confirm
    if (state.step === 2) update({ step: 1 });
    else if (state.step === 3) update({ step: 2 });
    else if (state.step === 4) {
      if (state.availableCoachIds.length > 1) update({ step: 3, selectedCoachId: null });
      else update({ step: 2 });
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
          <StepCategory state={state} update={update} />
        )}
        {state.step === 2 && (
          <StepDateTime state={state} update={update} nextStep={3} />
        )}
        {state.step === 3 && (
          <StepCoach state={state} update={update} />
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
