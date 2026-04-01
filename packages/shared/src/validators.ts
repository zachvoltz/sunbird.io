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
  lessonTypeId: z.string().min(1),
  lessonCategoryId: z.string().nullish(),
  coachId: z.string().optional(),
  startsAt: z.string().datetime(),
  mode: z.enum(["ONLINE", "IN_PERSON"]).default("IN_PERSON"),
  studentNote: z.string().max(500).optional(),
});

export const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const practiceNotesSchema = z.object({
  practiceNotes: z.string().min(1, "Practice notes are required").max(5000),
});

export const createAvailabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  isActive: z.boolean().default(true),
});

// ─── Coach Settings ───

export const updateCoachSettingsSchema = z.object({
  sessionAddress: z.string().max(500).optional(),
});

export const updateCoachAvailabilitySchema = z.object({
  slots: z.array(z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM format"),
  })),
});

export const updateCoachLessonTypesSchema = z.object({
  lessonTypeIds: z.array(z.string().min(1)),
});

// ─── Curriculum ───

export const createCurriculumSchema = z.object({
  lessonTypeId: z.string().min(1),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
});

export const saveCurriculumGraphSchema = z.object({
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

export const markProgressSchema = z.object({
  nodeId: z.string().min(1),
  studentId: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export const unmarkProgressSchema = z.object({
  nodeId: z.string().min(1),
  studentId: z.string().min(1),
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
