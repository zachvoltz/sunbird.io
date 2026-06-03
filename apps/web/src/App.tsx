import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Pricing } from "@/pages/Pricing";
import { Terms, Privacy } from "@/pages/Legal";
import { Lessons } from "@/pages/Lessons";
import { LessonDetail } from "@/pages/LessonDetail";
import { Workshops } from "@/pages/Workshops";
import { Coaches } from "@/pages/Coaches";
import { CoachProfile } from "@/pages/CoachProfile";
import { BookPage } from "@/pages/book/BookPage";
import { MyBookings } from "@/pages/MyBookings";
import { TeacherDashboard } from "@/pages/teacher/Dashboard";
import { CoachSession } from "@/pages/teacher/Session";
import { CoachSettings } from "@/pages/teacher/Settings";
import { CurriculumEditor } from "@/pages/teacher/CurriculumEditor";
import { CoachManage } from "@/pages/teacher/Manage";
import { StudentSession } from "@/pages/StudentSession";
import { AuthGate } from "@/components/AuthGate";
import { RoleGate } from "@/components/RoleGate";
import { Login } from "@/pages/Login";
import { ResetPassword } from "@/pages/ResetPassword";
import { NotFound } from "@/pages/NotFound";
import { RosterPage } from "@/wireframe/pages/Roster";
import { StudentPage } from "@/wireframe/pages/StudentPage";
import { InviteStatusPage } from "@/wireframe/pages/InviteStatusPage";
import { TakeReviewPage } from "@/wireframe/pages/TakeReview";
import { MidiEditorPage } from "@/wireframe/pages/MidiEditor";
import { LibraryPage } from "@/wireframe/pages/Library";
import { LessonLivePage } from "@/wireframe/pages/LessonLive";
import { VoiceRangePage } from "@/wireframe/pages/VoiceRange";
import { InboxPage } from "@/wireframe/pages/Inbox";
import { CalendarPage } from "@/wireframe/pages/Calendar";
import { MyBookingsPage } from "@/wireframe/pages/MyBookingsPage";
import { MyTakesPage } from "@/wireframe/pages/MyTakes";
import { PracticePathPage } from "@/wireframe/pages/PracticePath";
import { ExercisePlayerPage } from "@/wireframe/pages/ExercisePlayer";
import { RecordTakePage } from "@/wireframe/pages/RecordTake";
import { TodayPage } from "@/wireframe/pages/TodayPage";
import { AccountPage } from "@/wireframe/pages/Account";
import { ProfilePage } from "@/wireframe/pages/Profile";
import { PathEditorPage, PathLessonDetailPage } from "@/wireframe/pages/Paths";
import { PaymentsPage } from "@/wireframe/pages/Payments";
import { RolePicker } from "@/pages/Onboarding";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
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
        <Route path="book" element={<AuthGate><BookPage /></AuthGate>} />
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
      <Route path="/coach" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><RosterPage /></RoleGate></AuthGate>} />
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

      {/* Post-signup role picker — full-bleed, gated to authed-but-unchosen users. */}
      <Route path="/onboarding/role" element={<AuthGate><RolePicker /></AuthGate>} />

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
      <Route path="/practice/exercise/:assignmentId" element={<AuthGate><ExercisePlayerPage /></AuthGate>} />
      <Route path="/practice/record/:assignmentId" element={<AuthGate><RecordTakePage /></AuthGate>} />
    </Routes>
  );
}
