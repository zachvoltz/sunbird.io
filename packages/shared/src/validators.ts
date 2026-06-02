import { z } from "zod";

// ─── Auth ───

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  referralSource: z.string().max(200).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// Post-signup role picker — the user chooses student vs coach on
// /onboarding/role. Only STUDENT/COACH are pickable (ADMIN is assigned
// out-of-band, never self-selected).
export const setRoleSchema = z.object({
  role: z.enum(["STUDENT", "COACH"]),
});

// Move an existing booking to a new start time (same coach, same lesson).
// The slot is re-validated against the coach's availability server-side.
export const rescheduleBookingSchema = z.object({
  newStartsAt: z.string().datetime(),
});

// Coach pins an annotation on a take — a reaction (love/watch/try-this) at a
// position (a score bar or a timeline second), with optional text.
export const createTakeAnnotationSchema = z.object({
  kind: z.enum(["LOVE", "WATCH", "TRY_THIS"]),
  targetType: z.enum(["SCORE_BAR", "TIMELINE"]).default("TIMELINE"),
  targetBar: z.number().int().min(0).max(2000).optional(),
  targetTimeSec: z.number().min(0).max(36000).optional(),
  text: z.string().max(2000).optional(),
});

// Coach's written reply on a student's take. At least one of text/summaryText
// must be present so an empty reply can't be posted.
export const createTakeReplySchema = z
  .object({
    text: z.string().max(4000).optional(),
    starRating: z.number().int().min(1).max(5).optional(),
    summaryText: z.string().max(1000).optional(),
  })
  .refine((v) => !!(v.text?.trim() || v.summaryText?.trim()), {
    message: "A reply needs either text or a summary",
    path: ["text"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

// ─── Profile ───

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().optional(),
});

// ─── Contact ───

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  subject: z.enum([
    "lessons",
    "workshops",
    "collaboration",
    "general",
    "other",
  ]),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(5000),
});

// ─── Booking ───

export const createBookingSchema = z.object({
  categoryId: z.string().min(1),
  skillTreeId: z.string().nullish(),
  nodeId: z.string().nullish(),
  coachId: z.string().optional(),
  startsAt: z.string().datetime(),
  mode: z.enum(["ONLINE", "IN_PERSON"]).default("IN_PERSON"),
  studentNote: z.string().max(500).optional(),
  // When true, pay for this lesson with a package credit instead of a
  // per-session charge — requires an active subscription with the coach that
  // still has credits this period.
  usePackage: z.boolean().optional(),
});

export const createRecurringScheduleSchema = z.object({
  categoryId: z.string().min(1),
  skillTreeId: z.string().nullish(),
  nodeId: z.string().nullish(),
  coachId: z.string().min(1),
  startsAt: z.string().datetime(),
  frequency: z.enum(["WEEKLY", "BIWEEKLY"]),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  mode: z.enum(["ONLINE", "IN_PERSON"]).default("IN_PERSON"),
  studentNote: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ─── Packages (subscription plan tiers) ───

// Coach creates a package tier. priceMonthly is in cents ($1–$10,000/mo).
export const createPlanSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  lessonsPerMonth: z.number().int().min(1).max(31),
  priceMonthly: z.number().int().min(100).max(1_000_000),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

// All fields optional for a partial edit; same bounds as create.
export const updatePlanSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  lessonsPerMonth: z.number().int().min(1).max(31).optional(),
  priceMonthly: z.number().int().min(100).max(1_000_000).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

// Sectioned lesson notes — five labeled fields the coach fills in.
// Each section is optional, but at least one must be non-empty.
export const noteSectionsSchema = z.object({
  intro: z.string().max(2000).optional(),
  scalesExercises: z.string().max(2000).optional(),
  topics: z.string().max(2000).optional(),
  songWork: z.string().max(2000).optional(),
  nextTime: z.string().max(2000).optional(),
});

export const practiceNotesSchema = z
  .object({
    practiceNotes: z.string().min(1).max(5000).optional(),
    noteSections: noteSectionsSchema.optional(),
  })
  .refine(
    (v) => {
      const hasFlat = (v.practiceNotes ?? "").trim().length > 0;
      const hasSection = v.noteSections
        ? Object.values(v.noteSections).some((s) => (s ?? "").trim().length > 0)
        : false;
      return hasFlat || hasSection;
    },
    { message: "Add at least one note before sending." },
  );

export const createAvailabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  isActive: z.boolean().default(true),
});

// ── Paths · Khan-style lesson trees inside the Library ──

const pathLessonNodeSchema = z.object({
  id: z.string().min(1).max(40),
  col: z.number().int().min(0).max(10),
  row: z.number().int().min(0).max(40),
  title: z.string().min(1).max(60),
  titleB: z.string().max(60).optional().default(""),
  meta: z.string().max(60).optional().default(""),
  state: z.enum(["done", "current", "locked"]).optional(),
});
const pathEdgeSchema = z.tuple([z.string().min(1), z.string().min(1)]);

export const createPathSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/i, "Slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().min(1).max(120),
  sub: z.string().max(240).optional(),
  shape: z.enum(["linear", "branch", "spiral"]).default("linear"),
  status: z.enum(["draft", "published"]).default("draft"),
  coral: z.boolean().optional().default(false),
  nodes: z.array(pathLessonNodeSchema).max(60).default([]),
  edges: z.array(pathEdgeSchema).max(120).default([]),
});

export const updatePathSchema = createPathSchema.partial();

// Enroll a student on a path; advance their current lesson within it.
export const assignPathSchema = z.object({ studentId: z.string().min(1) });
export const advancePathSchema = z.object({ currentLessonId: z.string().min(1) });

// ── Library · warmups, exercises, songs ──

export const libraryItemKindSchema = z.enum(["warmup", "exercise", "song"]);

export const createLibraryItemSchema = z.object({
  kind: libraryItemKindSchema.default("exercise"),
  title: z.string().min(1).max(140),
  subtitle: z.string().max(240).optional(),
  tags: z.array(z.string().min(1).max(30)).max(12).default([]),
  bpmStart: z.number().int().min(20).max(300).optional(),
  bpmEnd: z.number().int().min(20).max(300).optional(),
  durationMin: z.number().int().min(1).max(240).optional(),
  hasMidi: z.boolean().optional().default(false),
  midiUrl: z.string().url().max(500).optional(),
  pdfUrl: z.string().url().max(500).optional(),
  audioUrl: z.string().url().max(500).optional(),
});

export const updateLibraryItemSchema = createLibraryItemSchema.partial();

// Date-specific busy block. Coaches use these to mark vacations, doctor
// appointments, etc. — they take precedence over the recurring weekly
// availability when generating bookable slots.
export const createCoachBusySchema = z
  .object({
    startsAt: z.string().datetime({ message: "startsAt must be ISO 8601" }),
    endsAt: z.string().datetime({ message: "endsAt must be ISO 8601" }),
    label: z.string().max(120).optional(),
  })
  .refine((v) => new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime(), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

// ─── Coach Settings ───

export const updateCoachSettingsSchema = z.object({
  sessionAddress: z.string().max(500).optional(),
});

export const updateCoachProfileSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only").optional(),
  headline: z.string().max(200).optional(),
  longBio: z.string().max(10000).optional(),
  coverImageUrl: z.string().url().optional().or(z.literal("")),
  credentials: z.string().max(5000).optional(),
  socialLinks: z.string().max(2000).optional(),
});

export const createCategorySchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  description: z.string().min(1).max(5000),
  imageUrl: z.string().url().optional(),
});

export const createSkillTreeSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const saveSkillTreeGraphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    positionX: z.number(),
    positionY: z.number(),
    color: z.string().max(20).optional(),
  })),
  edges: z.array(z.object({
    id: z.string().min(1),
    fromNodeId: z.string().min(1),
    toNodeId: z.string().min(1),
  })),
});

export const updateCoachCategoriesSchema = z.object({
  categoryIds: z.array(z.string().min(1)),
});

export const selectBookingNodeSchema = z.object({
  nodeId: z.string().min(1),
});

export const stMarkProgressSchema = z.object({
  nodeId: z.string().min(1),
  studentId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export const stUnmarkProgressSchema = z.object({
  nodeId: z.string().min(1),
  studentId: z.string().min(1),
});

export const updateCoachAvailabilitySchema = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  })),
});


export const createNodeResourceSchema = z.object({
  type: z.enum(["LINK", "PDF", "AUDIO"]),
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL"),
});

export const createPracticeDrillSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  resourceId: z.string().optional(),
});

// ─── Community ───

export const createSongSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  audioUrl: z.string().url().optional(),
  externalUrl: z.string().url().optional(),
  tags: z.string().max(500).optional(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(2000),
});

// ─── Session (messages & resources) ───

export const createSessionMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(5000),
});

export const createSessionResourceSchema = z.object({
  type: z.enum(["LINK", "PDF", "AUDIO"]),
  title: z.string().min(1, "Title is required").max(200),
  url: z.string().url("Must be a valid URL"),
});

// ─── Events ───

export const eventRsvpSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
});

// ── Student goals (set + track, shared with coach) ──

export const createGoalSchema = z.object({
  title: z.string().min(1, "Give your goal a name").max(120),
  detail: z.string().max(500).optional(),
  targetLabel: z.string().max(80).optional(),
});

export const updateGoalSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    detail: z.string().max(500).nullable().optional(),
    targetLabel: z.string().max(80).nullable().optional(),
    progressPct: z.number().int().min(0).max(100).optional(),
    status: z.enum(["ACTIVE", "ACHIEVED", "ARCHIVED"]).optional(),
    isNew: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Nothing to update.",
  });
