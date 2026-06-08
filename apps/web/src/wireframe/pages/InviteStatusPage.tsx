import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { apiFetch, ApiError } from "@/lib/api";
import { DTFrame } from "../components/DTFrame";
import { refreshSidebarStudents } from "../hooks/useSidebarStudents";

type Invite = {
  id: string;
  email: string;
  name: string | null;
  status: "PENDING" | "ACCEPTED";
  createdAt: string;
  acceptedAt: string | null;
};

// Status page for a pending (or just-accepted) invited student. Reached by
// clicking a gray entry in the coach sidebar. Lets the coach resend or revoke.
export function InviteStatusPage() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch<{ data: Invite }>(`/api/coaches/invites/${inviteId}`)
      .then((r) => { if (!cancelled) setInvite(r.data); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [inviteId]);

  const resend = async () => {
    setBusy(true);
    setNotice("");
    try {
      await apiFetch(`/api/coaches/invites/${inviteId}/resend`, { method: "POST" });
      setNotice("Invite re-sent.");
    } catch (err) {
      setNotice(err instanceof ApiError ? (err.body?.error ?? "Couldn't resend") : "Couldn't resend");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!window.confirm("Revoke this invite? They'll no longer be able to join from the email link.")) return;
    setBusy(true);
    try {
      await apiFetch(`/api/coaches/invites/${inviteId}`, { method: "DELETE" });
      refreshSidebarStudents();
      navigate("/coach/roster", { replace: true });
    } catch (err) {
      setNotice(err instanceof ApiError ? (err.body?.error ?? "Couldn't revoke") : "Couldn't revoke");
      setBusy(false);
    }
  };

  const invitedOn = invite
    ? new Date(invite.createdAt).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <DTFrame side="invite">
      <div className="dt-main-head">
        <div>
          <div className="dt-title">
            {loading ? "Loading…" : notFound ? "Invite not found" : invite?.name || invite?.email}
          </div>
          {!loading && !notFound && (
            <div className="dt-sub">
              {invite?.status === "PENDING"
                ? `Invited ${invitedOn} — waiting for them to log in`
                : `Joined — now an active student`}
            </div>
          )}
        </div>
        <Link to="/coach/roster" className="btn small">back to today</Link>
      </div>

      {!loading && !notFound && invite && (
        <div style={{ padding: 20, maxWidth: 460 }}>
          <div style={{ fontFamily: "var(--hand)", fontSize: 14, marginBottom: 16 }}>
            <div><strong>Email:</strong> {invite.email}</div>
            <div style={{ marginTop: 6 }}>
              <strong>Status:</strong>{" "}
              {invite.status === "PENDING" ? "Pending — they haven't logged in yet" : "Active"}
            </div>
          </div>

          {invite.status === "PENDING" && (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn small" onClick={resend} disabled={busy}>resend invite</button>
              <button className="btn small ghost" onClick={revoke} disabled={busy}>revoke</button>
            </div>
          )}

          {notice && (
            <div style={{ fontFamily: "var(--hand)", fontSize: 13, marginTop: 12, color: "var(--ink-faint)" }}>
              {notice}
            </div>
          )}
        </div>
      )}
    </DTFrame>
  );
}
