import type { z } from "zod";
import type {
  registerSchema,
  loginSchema,
  setRoleSchema,
  rescheduleBookingSchema,
  createTakeReplySchema,
  createTakeAnnotationSchema,
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
  createGoalSchema,
  updateGoalSchema,
  createStudentInviteSchema,
  assignPathSchema,
  advancePathSchema,
} from "./validators";

// ─── Inferred request types ───

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SetRoleInput = z.infer<typeof setRoleSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingSchema>;
export type CreateTakeReplyInput = z.infer<typeof createTakeReplySchema>;
export type CreateTakeAnnotationInput = z.infer<typeof createTakeAnnotationSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type CreateStudentInviteInput = z.infer<typeof createStudentInviteSchema>;
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
  roleChosen: boolean;
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

// A path as seen by an enrolled student — the tree plus where they are on it.
export interface StudentPathPublic extends PathSummary {
  nodes: PathLessonNode[];
  edges: PathEdge[];
  currentLessonId: string | null;
}

export type AssignPathInput = z.infer<typeof assignPathSchema>;
export type AdvancePathInput = z.infer<typeof advancePathSchema>;

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
  // Set when this booking was paid with a package credit — links the
  // Subscription the credit came from (null for per-session/free bookings).
  subscriptionId: string | null;
  paymentStatus: "NOT_REQUIRED" | "PENDING" | "PAID" | "FAILED" | "REFUNDED";
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

// ─── Messaging ───

export type MessageKind =
  | "TEXT"
  | "TAKE_SUBMITTED"
  | "TAKE_REPLY"
  | "NOTES_SENT"
  | "ASSIGNMENT"
  | "SYSTEM";

export interface MessageAttachment {
  r2Key: string;
  url: string;
  mime: string;
  name: string;
  size: number;
  durationSec?: number;
}

export interface ConversationMessagePublic {
  id: string;
  conversationId: string;
  sender: UserPublic;
  content: string;
  kind: MessageKind;
  refType: string | null;
  refId: string | null;
  attachments: MessageAttachment[];
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  // The other participant from the caller's perspective.
  counterpart: UserPublic;
  lastActivityAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface NotificationPreferencePublic {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  timezone: string;
  phone: string | null;
  phoneVerified: boolean;
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

/** Student whose most recent past session has no future booking on the books. */
export interface NextSessionTodoItem {
  student: UserPublic;
  lastBookingId: string;
  lastBookingAt: string;
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
  bookingsNeedingNextSession: NextSessionTodoItem[];
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

/** Student practice goal, shared with the coach. */
export type GoalStatus = "ACTIVE" | "ACHIEVED" | "ARCHIVED";

export interface GoalPublic {
  id: string;
  title: string;
  detail: string | null;
  targetLabel: string | null;
  progressPct: number;
  status: GoalStatus;
  isNew: boolean;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Suggested next session for the book-next gate / student book card. */
export interface NextSuggestedSessionPublic {
  /** A future slot to offer, or null if nothing sensible could be derived. */
  suggested: { startsAt: string; endsAt: string } | null;
  /** The active recurring schedule this booking belongs to, if any. */
  recurring: RecurringSchedulePublic | null;
  /** True when there is already a future confirmed booking (gate not needed). */
  alreadyBooked: boolean;
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
  // True when the student has self-added a Chord Flash Cards stop to their
  // daily practice (shown read-only on the coach's view; it isn't part of the
  // coach-managed routine). Optional for back-compat.
  chordFlashcardsInRoutine?: boolean;
  // Practice goals the student set, shared with this coach. New (un-discussed)
  // goals are surfaced on the coach's session-prep agenda.
  goals: GoalPublic[];
  // Distinct calendar days (UTC `YYYY-MM-DD`) in the last ~2 weeks on which
  // the student completed at least one routine exercise. Drives the
  // Practice-page streak row. Optional for back-compat with the coach
  // student-detail endpoint, which doesn't populate it.
  recentPracticeDays?: string[];
  // Fully-complete practice days (UTC `YYYY-MM-DD`) over the last ~120 days —
  // drives the student practice Calendar heatmap. Optional for back-compat.
  practiceDays?: string[];
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

// ─── Packages (N-per-month subscription plans) ───

// A coach-defined package tier, e.g. "4 lessons/month for $80". priceMonthly
// is in cents. stripePriceId is null while the plan is a draft or when Stripe
// is unconfigured (dev) — such a plan can't be subscribed to yet.
export interface SubscriptionPlanPublic {
  id: string;
  coachId: string;
  name: string;
  lessonsPerMonth: number;
  priceMonthly: number;
  isActive: boolean;
  sortOrder: number;
  // Whether the plan is actually subscribable (active + has a Stripe Price).
  subscribable: boolean;
  createdAt: string;
  updatedAt: string;
}

// A student's active package with a given coach, plus remaining credits this
// period (lessonsPerMonth - lessonsUsedThisPeriod, floored at 0).
export interface SubscriptionPublic {
  id: string;
  coachId: string;
  planId: string;
  plan: SubscriptionPlanPublic;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  lessonsUsedThisPeriod: number;
  creditsRemaining: number;
  createdAt: string;
}

// ─── Chord Flash Cards (spaced-repetition chord trainer) ───

// A single fretboard voicing. `fingering` has one entry per string, ordered
// low-E → high-E: a fret number, 0 for an open string, or "x" for muted.
// `fingers` (optional, parallel to `fingering`) is the fretting-hand finger
// per string. `baseFret` shifts the diagram up the neck; `barre` draws a bar.
export interface ChordShape {
  fingering: (number | "x")[];
  fingers?: (string | null)[];
  baseFret?: number;
  barre?: { fret: number; from: number; to: number };
}

// Per-student learning state of one chord card.
export type ChordCardStatus = "new" | "learning" | "known";
// The four self-grades on the reveal screen (Missed / Hard / Got it / Easy).
export type ChordGrade = "again" | "hard" | "good" | "easy";

// A chord tone shown by the front note-detector: the note name plus its
// scale degree, e.g. { note: "E", degree: "3rd" }.
export interface ChordTone {
  note: string;
  degree: string;
}

export interface ChordVoicingPublic {
  id: string;
  label: string;
  shape: ChordShape;
  recommended: boolean;
}

// A full card as served to the session player.
export interface ChordCardPublic {
  id: string;
  name: string;
  levelId: number;
  tones: ChordTone[];
  voicings: ChordVoicingPublic[];
  status: ChordCardStatus;
}

export interface ChordLevelSummaryPublic {
  id: number;
  name: string;
  desc: string;
  masteryPct: number; // 0-100, per student
  dueCount: number;
  chordCount: number;
  locked: boolean;
}

// GET /api/me/chords/decks — the deck-picker screen.
export interface ChordDeckOverviewPublic {
  dueCount: number; // total weak + scheduled cards across unlocked levels
  levels: ChordLevelSummaryPublic[];
}

export interface ChordLevelChordPublic {
  id: string;
  name: string;
  status: ChordCardStatus;
}

// GET /api/me/chords/levels/:levelId — the level-detail screen.
export interface ChordLevelDetailPublic {
  id: number;
  name: string;
  desc: string;
  masteryPct: number;
  dueCount: number;
  chords: ChordLevelChordPublic[];
}

// GET /api/me/chords/session — the ordered review queue.
export interface ChordSessionPublic {
  source: "due" | "level";
  levelId: number | null;
  cards: ChordCardPublic[];
}

// POST /api/me/chords/grade — result of grading one card.
export interface ChordGradeResultPublic {
  chordId: string;
  status: ChordCardStatus;
  intervalDays: number;
  dueAt: string | null;
}

export interface ChordSettingsPublic {
  handedness: "right" | "left";
  notation: "sharp" | "flat";
  theme: "light" | "dark" | "auto";
  newPerDay: number;
  levelGating: boolean;
  micCheck: boolean;
  inDailyRoutine: boolean; // show a Chord Flash Cards stop on the practice path
}

// The id of the synthetic routine item injected into the student's daily
// practice path when they add chord flashcards to their routine.
export const CHORD_ROUTINE_ITEM_ID = "chord-flashcards";

// ─── Chord Library (browse / search reference) ───
export type ChordDifficulty = "beginner" | "intermediate" | "advanced";

// A row in the browse/search list.
export interface ChordLibraryItemPublic {
  id: string;
  name: string;
  qualityLabel: string; // e.g. "Major 7th"
  shapeCount: number;
  root: string;
  shape: ChordShape; // recommended voicing, for the thumbnail
}

export interface ChordLibraryGroupPublic {
  root: string;
  items: ChordLibraryItemPublic[];
}

// GET /api/me/chords/library
export interface ChordLibraryListPublic {
  groups: ChordLibraryGroupPublic[];
  total: number;
}

// One fingering in the chord-detail / variation views, with display metadata.
export interface ChordLibraryVoicingPublic {
  id: string;
  label: string;
  shape: ChordShape;
  recommended: boolean;
  position: string; // "Open position" | "3rd fret (barre)"
  fingersLabel: string; // "1 barre · 2 · 3 · 4"
  rootString: string; // "5th string (A-shape)"
  difficulty: ChordDifficulty;
  notes: string[]; // the chord's spelling
}

// GET /api/me/chords/library/:chordId
export interface ChordLibraryDetailPublic {
  id: string;
  name: string;
  fullName: string; // "C major seventh"
  notes: string[]; // ["C","E","G","B"]
  voicings: ChordLibraryVoicingPublic[];
}

