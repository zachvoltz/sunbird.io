import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Pricing } from "@/pages/Pricing";
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
import { MyCurriculum } from "@/pages/MyCurriculum";
import { AuthGate } from "@/components/AuthGate";
import { RoleGate } from "@/components/RoleGate";
import { Login } from "@/pages/Login";
import { ResetPassword } from "@/pages/ResetPassword";
import { NotFound } from "@/pages/NotFound";
import { RosterPage } from "@/wireframe/pages/Roster";
import { StudentPage } from "@/wireframe/pages/StudentPage";
import { TakeReviewPage } from "@/wireframe/pages/TakeReview";
import { MidiEditorPage } from "@/wireframe/pages/MidiEditor";
import { LibraryPage } from "@/wireframe/pages/Library";
import { LessonLivePage } from "@/wireframe/pages/LessonLive";
import { VoiceRangePage } from "@/wireframe/pages/VoiceRange";
import { InboxPage } from "@/wireframe/pages/Inbox";
import { CalendarPage } from "@/wireframe/pages/Calendar";
import { MyBookingsPage } from "@/wireframe/pages/MyBookingsPage";
import { MyNotesPage, MyNoteExpandedPage } from "@/wireframe/pages/MyNotes";
import { MyTakesPage } from "@/wireframe/pages/MyTakes";
import { MyCurriculumHub } from "@/wireframe/pages/MyCurriculumHub";
import { MyProfilePage } from "@/wireframe/pages/MyProfile";
import { PracticePathPage } from "@/wireframe/pages/PracticePath";
import { ExercisePlayerPage } from "@/wireframe/pages/ExercisePlayer";
import { RecordTakePage } from "@/wireframe/pages/RecordTake";
import { TodayPage } from "@/wireframe/pages/TodayPage";
import { AccountPage } from "@/wireframe/pages/Account";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="pricing" element={<Pricing />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="lessons/:slug" element={<LessonDetail />} />
        <Route path="categories" element={<Lessons />} />
        <Route path="categories/:slug" element={<LessonDetail />} />
        <Route path="workshops" element={<Workshops />} />
        <Route path="coaches" element={<Coaches />} />
        <Route path="coaches/:slug" element={<CoachProfile />} />
        <Route path="book" element={<AuthGate><BookPage /></AuthGate>} />
        <Route path="my-bookings-legacy" element={<AuthGate><MyBookings /></AuthGate>} />
        <Route path="my-curriculum/:slug" element={<AuthGate><MyCurriculum /></AuthGate>} />
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
      <Route path="/coach/takes/:takeId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><TakeReviewPage /></RoleGate></AuthGate>} />
      <Route path="/coach/library" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><LibraryPage /></RoleGate></AuthGate>} />
      <Route path="/coach/midi/:mode" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><MidiEditorPage /></RoleGate></AuthGate>} />
      <Route path="/coach/live/:bookingId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><LessonLivePage /></RoleGate></AuthGate>} />
      <Route path="/coach/account" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><AccountPage /></RoleGate></AuthGate>} />
      <Route path="/coach/session/:bookingId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CoachSession /></RoleGate></AuthGate>} />

      {/* Sketchy student wireframes — same chrome-owns-viewport pattern. */}
      <Route path="/today" element={<AuthGate><TodayPage /></AuthGate>} />
      <Route path="/my-bookings" element={<AuthGate><MyBookingsPage /></AuthGate>} />
      <Route path="/my-bookings/:bookingId" element={<AuthGate><StudentSession /></AuthGate>} />
      <Route path="/my-notes" element={<AuthGate><MyNotesPage /></AuthGate>} />
      <Route path="/my-notes/:bookingId" element={<AuthGate><MyNoteExpandedPage /></AuthGate>} />
      <Route path="/my-takes" element={<AuthGate><MyTakesPage /></AuthGate>} />
      <Route path="/my-curriculum" element={<AuthGate><MyCurriculumHub /></AuthGate>} />
      <Route path="/my-profile" element={<AuthGate><MyProfilePage /></AuthGate>} />
      <Route path="/practice" element={<AuthGate><PracticePathPage /></AuthGate>} />
      <Route path="/practice/exercise/:assignmentId" element={<AuthGate><ExercisePlayerPage /></AuthGate>} />
      <Route path="/practice/record/:assignmentId" element={<AuthGate><RecordTakePage /></AuthGate>} />
    </Routes>
  );
}
