import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { refreshSidebarStudents } from "../hooks/useSidebarStudents";

// Modal for a coach to invite a student by email. On success the invite is
// created server-side (PENDING, or ACCEPTED if the email already has an
// account) and the sidebar list is refreshed so the new entry appears.
export function InviteStudentModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    fontFamily: "var(--hand)",
    fontSize: 14,
    padding: "6px 10px",
    border: "1.5px solid var(--ink-faint)",
    borderRadius: 6,
    background: "var(--paper)",
    color: "var(--ink)",
    outline: "none",
    width: "100%",
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/coaches/invites", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined }),
      });
      refreshSidebarStudents();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.error ?? "Couldn't send the invite");
      } else {
        setError("Couldn't send the invite");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--paper)",
          border: "1.5px solid var(--ink)",
          borderRadius: 14,
          boxShadow: "3px 4px 0 rgba(0,0,0,0.18)",
          padding: 20,
          width: 340,
          maxWidth: "90vw",
        }}
      >
        <div className="row between" style={{ marginBottom: 12 }}>
          <strong style={{ fontFamily: "var(--hand)", fontSize: 18 }}>Invite a student</strong>
          <button className="btn icon" onClick={onClose} title="close" style={{ border: 0, background: "transparent" }}>✕</button>
        </div>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label style={{ fontFamily: "var(--hand)", fontSize: 12, color: "var(--ink-faint)" }}>
            Email
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@email.com"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
          <label style={{ fontFamily: "var(--hand)", fontSize: 12, color: "var(--ink-faint)" }}>
            Name (optional)
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="how they'll show in your list"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          </label>
          {error && (
            <div style={{ fontFamily: "var(--hand)", fontSize: 13, color: "var(--accent)" }}>{error}</div>
          )}
          <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button type="button" className="btn small ghost" onClick={onClose} disabled={loading}>cancel</button>
            <button type="submit" className="btn small primary" disabled={loading || !email.trim()}>
              {loading ? "sending…" : "send invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
