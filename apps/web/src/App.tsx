import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Lessons } from "@/pages/Lessons";
import { Voice } from "@/pages/lessons/Voice";
import { Songwriting } from "@/pages/lessons/Songwriting";
import { Performance } from "@/pages/lessons/Performance";
import { Workshops } from "@/pages/Workshops";
import { NotFound } from "@/pages/NotFound";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="lessons" element={<Lessons />} />
        <Route path="lessons/voice" element={<Voice />} />
        <Route path="lessons/songwriting" element={<Songwriting />} />
        <Route path="lessons/performance" element={<Performance />} />
        <Route path="workshops" element={<Workshops />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
