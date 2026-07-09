import { lazy, Suspense, type ComponentType } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AuthGate } from "@/components/AuthGate";
import { RoleGate } from "@/components/RoleGate";
// Homepage stays eager: it's the LCP route, so loading it from the entry chunk
// avoids an extra request on the critical path. Every other route is split into
// its own chunk below and fetched on demand.
import { OverviewLanding } from "@/pages/OverviewLanding";

// Our page components use named exports, so adapt them to the default-export
// shape React.lazy expects. The import() string literal stays inline, so Rollup
// still creates one chunk per route; `name` is key-checked against the module.
function lazyRoute<M extends Record<string, unknown>, K extends keyof M>(
  loader: () => Promise<M>,
  name: K,
) {
  return lazy(() => loader().then((m) => ({ default: m[name] as ComponentType })));
}

const Pricing = lazyRoute(() => import("@/pages/Pricing"), "Pricing");
const Terms = lazyRoute(() => import("@/pages/Legal"), "Terms");
const Privacy = lazyRoute(() => import("@/pages/Legal"), "Privacy");
const Lessons = lazyRoute(() => import("@/pages/Lessons"), "Lessons");
const LessonDetail = lazyRoute(() => import("@/pages/LessonDetail"), "LessonDetail");
const Workshops = lazyRoute(() => import("@/pages/Workshops"), "Workshops");
const Coaches = lazyRoute(() => import("@/pages/Coaches"), "Coaches");
const CoachProfile = lazyRoute(() => import("@/pages/CoachProfile"), "CoachProfile");
const BookPage = lazyRoute(() => import("@/pages/book/BookPage"), "BookPage");
const MyBookings = lazyRoute(() => import("@/pages/MyBookings"), "MyBookings");
const TeacherDashboard = lazyRoute(() => import("@/pages/teacher/Dashboard"), "TeacherDashboard");
const CoachSession = lazyRoute(() => import("@/pages/teacher/Session"), "CoachSession");
const CoachSettings = lazyRoute(() => import("@/pages/teacher/Settings"), "CoachSettings");
const CurriculumEditor = lazyRoute(() => import("@/pages/teacher/CurriculumEditor"), "CurriculumEditor");
const CoachManage = lazyRoute(() => import("@/pages/teacher/Manage"), "CoachManage");
const StudentSession = lazyRoute(() => import("@/pages/StudentSession"), "StudentSession");
const Login = lazyRoute(() => import("@/pages/Login"), "Login");
const ResetPassword = lazyRoute(() => import("@/pages/ResetPassword"), "ResetPassword");
const NotFound = lazyRoute(() => import("@/pages/NotFound"), "NotFound");
const RosterPage = lazyRoute(() => import("@/wireframe/pages/Roster"), "RosterPage");
const StudentPage = lazyRoute(() => import("@/wireframe/pages/StudentPage"), "StudentPage");
const InviteStatusPage = lazyRoute(() => import("@/wireframe/pages/InviteStatusPage"), "InviteStatusPage");
const TakeReviewPage = lazyRoute(() => import("@/wireframe/pages/TakeReview"), "TakeReviewPage");
const MidiEditorPage = lazyRoute(() => import("@/wireframe/pages/MidiEditor"), "MidiEditorPage");
const LibraryPage = lazyRoute(() => import("@/wireframe/pages/Library"), "LibraryPage");
const LessonLivePage = lazyRoute(() => import("@/wireframe/pages/LessonLive"), "LessonLivePage");
const VoiceRangePage = lazyRoute(() => import("@/wireframe/pages/VoiceRange"), "VoiceRangePage");
const InboxPage = lazyRoute(() => import("@/wireframe/pages/Inbox"), "InboxPage");
const CalendarPage = lazyRoute(() => import("@/wireframe/pages/Calendar"), "CalendarPage");
const MyBookingsPage = lazyRoute(() => import("@/wireframe/pages/MyBookingsPage"), "MyBookingsPage");
const MyTakesPage = lazyRoute(() => import("@/wireframe/pages/MyTakes"), "MyTakesPage");
const PracticePathPage = lazyRoute(() => import("@/wireframe/pages/PracticePath"), "PracticePathPage");
const ChordFlashCardsPage = lazyRoute(() => import("@/wireframe/pages/ChordFlashCards"), "ChordFlashCardsPage");
const ExercisePlayerPage = lazyRoute(() => import("@/wireframe/pages/ExercisePlayer"), "ExercisePlayerPage");
const RecordTakePage = lazyRoute(() => import("@/wireframe/pages/RecordTake"), "RecordTakePage");
const TodayPage = lazyRoute(() => import("@/wireframe/pages/TodayPage"), "TodayPage");
const AccountPage = lazyRoute(() => import("@/wireframe/pages/Account"), "AccountPage");
const ProfilePage = lazyRoute(() => import("@/wireframe/pages/Profile"), "ProfilePage");
const MessagesListPage = lazyRoute(() => import("@/wireframe/pages/Messages"), "MessagesListPage");
const MessageThreadPage = lazyRoute(() => import("@/wireframe/pages/Messages"), "MessageThreadPage");
const NotificationSettingsPage = lazyRoute(() => import("@/wireframe/pages/NotificationSettingsPage"), "NotificationSettingsPage");
const PathEditorPage = lazyRoute(() => import("@/wireframe/pages/Paths"), "PathEditorPage");
const PathLessonDetailPage = lazyRoute(() => import("@/wireframe/pages/Paths"), "PathLessonDetailPage");
const PaymentsPage = lazyRoute(() => import("@/wireframe/pages/Payments"), "PaymentsPage");
const RolePicker = lazyRoute(() => import("@/pages/Onboarding"), "RolePicker");
const CoachEntry = lazyRoute(() => import("@/pages/CoachLanding"), "CoachEntry");
const StudentEntry = lazyRoute(() => import("@/pages/StudentLanding"), "StudentEntry");

// Shown while a route's chunk is in flight. Full-viewport and dependency-free so
// it works for both the full-bleed routes and the ones nested under <Layout>.
function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        color: "var(--color-ink-faint, #8a8278)",
        fontFamily: "var(--font-sans, system-ui)",
      }}
    >
      <span>Loading…</span>
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* Homepage — the sunbird Overview. Full-bleed (own nav + footer), so it
            renders outside the main Layout chrome. */}
        <Route path="/" element={<OverviewLanding />} />

        <Route element={<Layout />}>
          <Route path="pricing" element={<Pricing />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="lessons/:slug" element={<LessonDetail />} />
          <Route path="categories" element={<Lessons />} />
          <Route path="categories/:slug" element={<LessonDetail />} />
          <Route path="workshops" element={<Workshops />} />
          <Route path="coaches" element={<Coaches />} />
          <Route path="coaches/:slug" element={<CoachProfile />} />
          {/* Browsable while logged out — sign-in is deferred to the Confirm step. */}
          <Route path="book" element={<BookPage />} />
          <Route path="my-bookings-legacy" element={<AuthGate><MyBookings /></AuthGate>} />
          <Route path="my-curriculum/:slug" element={<Navigate to="/today" replace />} />
          <Route path="coach/dashboard-legacy" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><TeacherDashboard /></RoleGate></AuthGate>} />
          <Route path="coach/settings" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CoachSettings /></RoleGate></AuthGate>} />
          <Route path="coach/manage" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CoachManage /></RoleGate></AuthGate>} />
          <Route path="coach/curriculum" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CurriculumEditor /></RoleGate></AuthGate>} />
          <Route path="login" element={<Login />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Sketchy teacher wireframes — render outside the main Layout so the
            full-bleed desktop chrome (topbar/sidebar) owns the viewport. */}
        {/* Public coach marketing landing. Signed-in coaches/admins are
            redirected to their roster at /coach/roster. */}
        <Route path="/coach" element={<CoachEntry />} />
        <Route path="/coach/roster" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><RosterPage /></RoleGate></AuthGate>} />
        <Route path="/coach/inbox" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><InboxPage /></RoleGate></AuthGate>} />
        <Route path="/coach/calendar" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CalendarPage /></RoleGate></AuthGate>} />
        <Route path="/coach/student/:studentId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><StudentPage /></RoleGate></AuthGate>} />
        <Route path="/coach/student/:studentId/voice" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><VoiceRangePage /></RoleGate></AuthGate>} />
        <Route path="/coach/invite/:inviteId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><InviteStatusPage /></RoleGate></AuthGate>} />
        <Route path="/coach/takes/:takeId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><TakeReviewPage /></RoleGate></AuthGate>} />
        <Route path="/coach/library" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><LibraryPage /></RoleGate></AuthGate>} />
        <Route path="/coach/library/paths/:slug" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><PathEditorPage /></RoleGate></AuthGate>} />
        <Route path="/coach/library/paths/:slug/lessons/:lessonId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><PathLessonDetailPage /></RoleGate></AuthGate>} />
        <Route path="/coach/midi/:mode" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><MidiEditorPage /></RoleGate></AuthGate>} />
        <Route path="/coach/live/:bookingId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><LessonLivePage /></RoleGate></AuthGate>} />
        <Route path="/coach/account" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><AccountPage /></RoleGate></AuthGate>} />
        <Route path="/coach/profile" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><ProfilePage /></RoleGate></AuthGate>} />
        <Route path="/coach/payments" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><PaymentsPage /></RoleGate></AuthGate>} />
        <Route path="/coach/session/:bookingId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CoachSession /></RoleGate></AuthGate>} />

        {/* Direct messaging — one page tree for both roles; the Messages page
            picks coach (DTFrame) vs student (STFrame) chrome from the signed-in
            user's role. Notification email links point at /messages/:id. */}
        <Route path="/messages" element={<AuthGate><MessagesListPage /></AuthGate>} />
        <Route path="/messages/:id" element={<AuthGate><MessageThreadPage /></AuthGate>} />
        <Route path="/settings/notifications" element={<AuthGate><NotificationSettingsPage /></AuthGate>} />

        {/* Post-signup role picker — full-bleed, gated to authed-but-unchosen users. */}
        <Route path="/onboarding/role" element={<AuthGate><RolePicker /></AuthGate>} />

        {/* Public student marketing landing. Signed-in students are redirected
            to their app home at /today. */}
        <Route path="/student" element={<StudentEntry />} />

        {/* Sketchy student wireframes — same chrome-owns-viewport pattern. */}
        <Route path="/today" element={<AuthGate><TodayPage /></AuthGate>} />
        <Route path="/my-bookings" element={<AuthGate><MyBookingsPage /></AuthGate>} />
        <Route path="/my-bookings/:bookingId" element={<AuthGate><StudentSession /></AuthGate>} />
        <Route path="/my-takes" element={<AuthGate><MyTakesPage /></AuthGate>} />
        {/* Disabled student views — hidden from the nav and redirected to Today. */}
        <Route path="/my-inbox" element={<Navigate to="/today" replace />} />
        <Route path="/my-notes" element={<Navigate to="/today" replace />} />
        <Route path="/my-notes/:bookingId" element={<Navigate to="/today" replace />} />
        <Route path="/my-goals" element={<Navigate to="/today" replace />} />
        <Route path="/my-curriculum" element={<Navigate to="/today" replace />} />
        <Route path="/my-profile" element={<Navigate to="/today" replace />} />
        <Route path="/my-calendar" element={<Navigate to="/today" replace />} />
        <Route path="/practice" element={<AuthGate><PracticePathPage /></AuthGate>} />
        <Route path="/practice/chords" element={<AuthGate><ChordFlashCardsPage /></AuthGate>} />
        <Route path="/practice/exercise/:assignmentId" element={<AuthGate><ExercisePlayerPage /></AuthGate>} />
        <Route path="/practice/record/:assignmentId" element={<AuthGate><RecordTakePage /></AuthGate>} />
      </Routes>
    </Suspense>
  );
}
