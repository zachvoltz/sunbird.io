import type { z } from "zod";
import type {
  registerSchema,
  loginSchema,
  contactSchema,
  createBookingSchema,
  practiceNotesSchema,
  createAvailabilitySchema,
  createSongSchema,
  createCommentSchema,
  eventRsvpSchema,
  updateProfileSchema,
  createSessionMessageSchema,
  createSessionResourceSchema,
  updateCoachSettingsSchema,
  updateCoachAvailabilitySchema,
  updateCoachLessonTypesSchema,
} from "./validators";

// ─── Inferred request types ───

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type PracticeNotesInput = z.infer<typeof practiceNotesSchema>;
export type CreateAvailabilityInput = z.infer<typeof createAvailabilitySchema>;
export type CreateSongInput = z.infer<typeof createSongSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type EventRsvpInput = z.infer<typeof eventRsvpSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateSessionMessageInput = z.infer<typeof createSessionMessageSchema>;
export type CreateSessionResourceInput = z.infer<typeof createSessionResourceSchema>;
export type UpdateCoachSettingsInput = z.infer<typeof updateCoachSettingsSchema>;
export type UpdateCoachAvailabilityInput = z.infer<typeof updateCoachAvailabilitySchema>;
export type UpdateCoachLessonTypesInput = z.infer<typeof updateCoachLessonTypesSchema>;

// ─── Shared enums (mirroring DB values) ───

export type Role = "STUDENT" | "COACH" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: Role;
}

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export type BookingMode = "ONLINE" | "IN_PERSON";

export type MeetingProvider = "zoom" | "google_meet";

export type SubscriptionStatus = "ACTIVE" | "PAST_DUE" | "CANCELLED" | "PAUSED";

export type ContactSubject =
  | "lessons"
  | "workshops"
  | "collaboration"
  | "general"
  | "other";

// ─── API response types ───

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}

export interface ApiSuccess<T = void> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface UserPublic {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface CoachPublic extends UserPublic {
  sessionAddress: string | null;
  hasZoomConnected: boolean;
  lessonTypeIds: string[];
}

export interface LessonTypePublic {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  imageUrl: string | null;
  pricePerSession: number;
}

export interface WorkshopPublic {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  durationMins: number;
  maxCapacity: number;
  spotsRemaining: number;
  price: number;
  imageUrl: string | null;
  lessonType: LessonTypePublic | null;
}

export interface EventPublic {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  durationMins: number;
  imageUrl: string | null;
  rsvpCount: number;
}

export interface SongPublic {
  id: string;
  title: string;
  description: string | null;
  audioUrl: string | null;
  externalUrl: string | null;
  tags: string | null;
  createdAt: string;
  user: UserPublic;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
}

export interface LessonCategoryPublic {
  id: string;
  slug: string;
  title: string;
  description: string | null;
}

export interface LessonTypeWithCategories extends LessonTypePublic {
  categories: LessonCategoryPublic[];
}

export interface AvailableSlot {
  startsAt: string;
  endsAt: string;
  coachIds: string[];
}

export interface CoachAvailabilitySlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface BookingPublic {
  id: string;
  lessonType: LessonTypePublic;
  lessonCategory: LessonCategoryPublic | null;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  mode: BookingMode;
  meetingUrl: string | null;
  meetingProvider: string | null;
  studentNote: string | null;
  practiceNotes: string | null;
  completedAt: string | null;
  usedSubscription: boolean;
  createdAt: string;
  user?: UserPublic;
  coach?: UserPublic;
}

export type SessionResourceType = "LINK" | "PDF" | "AUDIO";

export interface SessionMessagePublic {
  id: string;
  bookingId: string;
  sender: UserPublic;
  content: string;
  createdAt: string;
}

export interface SessionResourcePublic {
  id: string;
  bookingId: string;
  type: SessionResourceType;
  title: string;
  url: string;
  addedBy: UserPublic;
  createdAt: string;
}
