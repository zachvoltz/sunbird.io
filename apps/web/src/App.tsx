import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
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
import { StudentSession } from "@/pages/StudentSession";
import { MyCurriculum } from "@/pages/MyCurriculum";
import { AuthGate } from "@/components/AuthGate";
import { RoleGate } from "@/components/RoleGate";
import { Login } from "@/pages/Login";
import { ResetPassword } from "@/pages/ResetPassword";
import { NotFound } from "@/pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="lessons/:slug" element={<LessonDetail />} />
        <Route path="workshops" element={<Workshops />} />
        <Route path="coaches" element={<Coaches />} />
        <Route path="coaches/:slug" element={<CoachProfile />} />
        <Route path="book" element={<AuthGate><BookPage /></AuthGate>} />
        <Route path="my-bookings" element={<AuthGate><MyBookings /></AuthGate>} />
        <Route path="my-bookings/:bookingId" element={<AuthGate><StudentSession /></AuthGate>} />
        <Route path="my-curriculum/:slug" element={<AuthGate><MyCurriculum /></AuthGate>} />
        <Route path="coach" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><TeacherDashboard /></RoleGate></AuthGate>} />
        <Route path="coach/session/:bookingId" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CoachSession /></RoleGate></AuthGate>} />
        <Route path="coach/settings" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CoachSettings /></RoleGate></AuthGate>} />
        <Route path="coach/curriculum" element={<AuthGate><RoleGate roles={["COACH", "ADMIN"]}><CurriculumEditor /></RoleGate></AuthGate>} />
        <Route path="login" element={<Login />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
