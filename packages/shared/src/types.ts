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
  slug: string | null;
  headline: string | null;
  coverImageUrl: string | null;
  isPublished: boolean;
  sessionAddress: string | null;
  categoryIds: string[];
}

// ─── New Hierarchy Types ───

export interface CategoryPublic {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string;
  imageUrl: string | null;
}

export interface SkillTreeSummary {
  id: string;
  title: string;
  description: string | null;
  nodeCount: number;
}

export interface SkillTreeNodeST {
  id: string;
  title: string;
  description: string | null;
  positionX: number;
  positionY: number;
  color: string | null;
  resources: CoachResourcePublic[];
  drills: PracticeDrillPublic[];
}

export interface SkillTreeEdgeST {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface SkillTreeFull {
  id: string;
  coachId: string;
  categoryId: string;
  title: string;
  description: string | null;
  nodes: SkillTreeNodeST[];
  edges: SkillTreeEdgeST[];
}

export interface SkillTreeWithProgress extends SkillTreeFull {
  progress: StudentProgressPublic[];
}

export interface CoachProfilePublic {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  longBio: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  credentials: string | null;
  socialLinks: Record<string, string> | null;
  sessionAddress: string | null;
  categories: (CategoryPublic & { skillTreeCount: number })[];
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
  category: CategoryPublic | null;
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
  scheduleId: string | null;
  category: CategoryPublic | null;
  skillTree: { id: string; title: string } | null;
  node: { id: string; title: string } | null;
  createdAt: string;
  user?: UserPublic;
  coach?: UserPublic;
}

export type RecurringFrequency = "WEEKLY" | "BIWEEKLY";

export interface RecurringSchedulePublic {
  id: string;
  frequency: RecurringFrequency;
  dayOfWeek: number;
  startTime: string;
  startsOn: string;
  endsOn: string;
  status: string;
  category: CategoryPublic | null;
  coach: UserPublic;
  bookingCount: number;
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

// ─── Curriculum ───

export interface CoachResourcePublic {
  id: string;
  type: SessionResourceType;
  title: string;
  url: string;
  createdAt: string;
}

export interface PracticeDrillPublic {
  id: string;
  nodeId: string;
  title: string;
  description: string | null;
  resourceId: string | null;
}

export interface StudentProgressPublic {
  id: string;
  studentId: string;
  nodeId: string;
  coachId: string;
  completedAt: string;
  notes: string | null;
}

