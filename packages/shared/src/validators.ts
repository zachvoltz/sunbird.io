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
