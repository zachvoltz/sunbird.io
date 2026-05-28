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

export interface CoachBusyPublic {
  id: string;
  coachId: string;
  startsAt: string;
  endsAt: string;
  label: string | null;
  createdAt: string;
}

// ── Paths · Khan-style lesson trees ──

export type PathShape = "linear" | "branch" | "spiral";
export type PathStatus = "draft" | "published";
export type PathLessonState = "done" | "current" | "locked";

export interface PathLessonNode {
  id: string;
  col: number;
  row: number;
  title: string;
  titleB: string;
  meta: string;
  state?: PathLessonState;
}

export type PathEdge = [string, string];

export interface PathSummary {
  id: string;
  slug: string;
  title: string;
  sub: string | null;
  shape: PathShape;
  status: PathStatus;
  coral: boolean;
  lessons: number;
  students: number;
  createdAt: string;
  updatedAt: string;
}

export interface PathStudentRef {
  id: string;
  name: string;
  avatarUrl: string | null;
  currentLessonId: string | null;
  startedAt: string;
}

export interface PathDetail extends PathSummary {
  coachId: string;
  nodes: PathLessonNode[];
  edges: PathEdge[];
  studentsOnIt: PathStudentRef[];
}

// ── Library · warmups, exercises, songs ──

export type LibraryItemKind = "warmup" | "exercise" | "song";

export interface LibraryItemPublic {
  id: string;
  coachId: string;
  kind: LibraryItemKind;
  title: string;
  subtitle: string | null;
  tags: string[];
  bpmStart: number | null;
  bpmEnd: number | null;
  durationMin: number | null;
  hasMidi: boolean;
  midiUrl: string | null;
  pdfUrl: string | null;
  audioUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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
  noteSections: NoteSections | null;
  // Routine the coach set at the end of this session (snapshot at that time).
  // Null for sessions saved before a routine was ever attached.
  routineSnapshot: RoutinePublic | null;
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

// ─── Coach UI (Practice / Assignments / Takes / Notes) ───

export type AssignmentType = "WARMUP" | "EXERCISE" | "SONG";
export type AssignmentStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export interface AssignmentPublic {
  id: string;
  studentId: string;
  coachId: string;
  type: AssignmentType;
  title: string;
  subtitle: string | null;
  bars: string | null;
  weekStartsOn: string;
  tempoBpmStart: number | null;
  tempoBpmEnd: number | null;
  durationMin: number | null;
  status: AssignmentStatus;
  completionCount: number;
  noteText: string | null;
  sortOrder: number;
  hasMidi: boolean;
  hasNotePinned: boolean;
  dueAt: string | null;
  bookingId: string | null;
  resourceId: string | null;
  createdAt: string;
}

export type TakeStatus = "UNREVIEWED" | "REVIEWING" | "REPLIED";
export type TakeAnnotationKind = "LOVE" | "WATCH" | "TRY_THIS";
export type TakeAnnotationTarget = "SCORE_BAR" | "TIMELINE";

export interface TakeAnnotationPublic {
  id: string;
  takeId: string;
  kind: TakeAnnotationKind;
  targetType: TakeAnnotationTarget;
  targetBar: number | null;
  targetTimeSec: number | null;
  text: string | null;
  voiceUrl: string | null;
  voiceDurSec: number | null;
  createdAt: string;
  author: UserPublic;
}

export interface TakeReplyPublic {
  id: string;
  takeId: string;
  text: string | null;
  voiceUrl: string | null;
  voiceDurSec: number | null;
  starRating: number | null;
  summaryText: string | null;
  createdAt: string;
  author: UserPublic;
}

export interface TakePublic {
  id: string;
  studentId: string;
  coachId: string;
  assignmentId: string | null;
  pieceTitle: string;
  bars: string | null;
  takeNumber: number;
  durationSec: number;
  audioUrl: string | null;
  selfRating: number | null;
  selfNote: string | null;
  status: TakeStatus;
  reviewedAt: string | null;
  createdAt: string;
  annotations: TakeAnnotationPublic[];
  replies: TakeReplyPublic[];
}

export interface NoteSections {
  intro?: string;
  scalesExercises?: string;
  topics?: string;
  songWork?: string;
  otherSongs?: string;
  nextTime?: string;
}

export type LessonSummaryStatus = "PENDING" | "READY" | "EDITED";

export interface LessonSummaryPublic {
  id: string;
  bookingId: string;
  bullets: string[];
  status: LessonSummaryStatus;
  durationMin: number | null;
  recordingUrl: string | null;
  editedBy: UserPublic | null;
  generatedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface PracticeStreakPublic {
  currentDays: number;
  longestDays: number;
  lastPracticedAt: string | null;
}

export interface NoteReadReceiptPublic {
  id: string;
  bookingId: string;
  user: UserPublic;
  readAt: string;
}

export interface NoteVoiceMemoPublic {
  id: string;
  bookingId: string;
  audioUrl: string;
  durationSec: number;
  createdAt: string;
  addedBy: UserPublic;
}

export interface UnreviewedTakeItem {
  take: TakePublic;
  student: UserPublic;
  ageHours: number;
}

export interface MissingNotesItem {
  booking: BookingPublic;
  daysAgo: number;
}

export interface PlanGapItem {
  student: UserPublic;
  lastBookingAt: string | null;
}

export interface WeekDensityDay {
  dayLabel: string;
  date: string;
  lessonCount: number;
  isToday: boolean;
}

export type ActivityKind = "TAKE_SENT" | "BOOKING_COMPLETED" | "ASSIGNMENT_COMPLETED";

export interface ActivityItem {
  kind: ActivityKind;
  student: UserPublic;
  text: string;
  at: string;
}

/** Aggregate for /coach (Roster) — fuels the "needs you" + "this week" columns. */
export interface CoachDashboardPublic {
  unreviewedTakes: UnreviewedTakeItem[];
  bookingsMissingNotes: MissingNotesItem[];
  studentsWithoutPlan: PlanGapItem[];
  weekStats: {
    totalStudents: number;
    activeThisWeek: number;
    takesReceivedThisWeek: number;
    bookingsThisWeek: number;
  };
  weekDensity: WeekDensityDay[];
  recentActivity: ActivityItem[];
  weekStartsOn: string;
}

/** Aggregate for the Student page. */
export interface StudentDetailPublic {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  age: number | null;
  instrument: string | null;
  bookingCount: number;
  firstLessonAt: string | null;
  lastLessonAt: string | null;
  streak: PracticeStreakPublic | null;
  assignments: AssignmentPublic[];
  takes: TakePublic[];
  latestNoteBookingId: string | null;
  latestNoteSections: NoteSections | null;
  latestNotePracticeNotes: string | null;
  latestNoteStartsAt: string | null;
  latestNoteSentAt: string | null;
  latestNoteReadCount: number;
  latestLessonSummary: LessonSummaryPublic | null;
  latestNoteVoiceMemos: NoteVoiceMemoPublic[];
  routine: RoutinePublic;
}

// ── Current Routine ──
//
// Ordered list of exercises the coach has set for the student. Stored
// on the student User row as a JSON blob (see User.currentRoutine) so
// reorders/edits are atomic. Items are snapshots — copying title/tempo
// at the time the coach drops them from the library — so a renamed or
// deleted library item doesn't corrupt the routine.

export interface RoutineItem {
  id: string;
  libraryItemId: string | null;
  kind: LibraryItemKind;
  title: string;
  bars: string | null;
  bpmStart: number | null;
  bpmEnd: number | null;
  durationMin: number | null;
  note: string | null;
  // Read-only enrichments populated by GET /api/me/student-data (resolved
  // from the linked LibraryItem + today's RoutineCompletion). Never written
  // back via serializeRoutine — they're presentation-only.
  audioUrl?: string | null;
  midiUrl?: string | null;
  pdfUrl?: string | null;
  hasMidi?: boolean;
  completedToday?: boolean;
}

export interface RoutinePublic {
  items: RoutineItem[];
  updatedAt: string | null;
}

