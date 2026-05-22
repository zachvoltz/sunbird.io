import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BookingPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { STFrame } from "../components/STFrame";
import { Squiggle } from "../components/Squiggle";

export function MyCurriculumHub() {
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Each category/skill tree the student has touched, dedup'd by category slug.
  const trees = new Map<string, { slug: string; title: string }>();
  for (const b of bookings) {
    if (b.category && !trees.has(b.category.slug)) {
      trees.set(b.category.slug, { slug: b.category.slug, title: b.category.title });
    }
  }
  const treesList = Array.from(trees.values());

  return (
    <STFrame side="curriculum">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Curriculum</h2>
          <div className="dt-sub">
            The skill trees your teacher has set up for you.
          </div>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-body scroll col gap-3" style={{ padding: "12px 4px" }}>
            {loading && <div className="small muted">Loading…</div>}

            {!loading && treesList.length === 0 && (
              <div
                className="box dashed"
                style={{ textAlign: "center", padding: "32px 24px", color: "var(--ink-soft)" }}
              >
                <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
                  No curriculum yet.
                </div>
                <Squiggle w={80} color="var(--ink-faint)" />
                <div className="small muted mt-2" style={{ maxWidth: 380, margin: "8px auto 0" }}>
                  Once you book your first lesson in a category, the skill tree your teacher
                  uses for that subject will show up here.
                </div>
                <div className="row gap-2 mt-3" style={{ justifyContent: "center" }}>
                  <Link to="/book" className="btn small primary">book a lesson</Link>
                  <Link to="/coaches" className="btn small ghost">browse coaches</Link>
                </div>
              </div>
            )}

            {treesList.map((t) => (
              <Link
                key={t.slug}
                to={`/my-curriculum/${t.slug}`}
                className="box"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="row between">
                  <div>
                    <div className="wf-scrawl bold" style={{ fontSize: 22 }}>
                      {t.title}
                    </div>
                    <div className="tiny muted">open skill tree →</div>
                  </div>
                  <span className="chip">view path</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </STFrame>
  );
}
