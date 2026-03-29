import type { z } from "zod";
import type {
  registerSchema,
  loginSchema,
  contactSchema,
  createBookingSchema,
  createSongSchema,
  createCommentSchema,
  eventRsvpSchema,
  updateProfileSchema,
} from "./validators";

// ─── Inferred request types ───

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateSongInput = z.infer<typeof createSongSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type EventRsvpInput = z.infer<typeof eventRsvpSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ─── Shared enums (mirroring DB values) ───

export type Role = "STUDENT" | "TEACHER" | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: Role;
}

export type BookingStatus = "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

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

export interface BookingPublic {
  id: string;
  lessonType: LessonTypePublic;
  startsAt: string;
  endsAt: string;
  status: BookingStatus;
  usedSubscription: boolean;
  createdAt: string;
}
