import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { STFrame } from "../components/STFrame";
import { Avatar } from "../components/Avatar";
import { Squiggle } from "../components/Squiggle";
import { MockTag } from "../components/MockTag";

export function MyProfilePage() {
  const { user, logout } = useAuth();

  return (
    <STFrame side="profile">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Profile</h2>
          <div className="dt-sub">How you appear to your teacher.</div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost" onClick={() => logout()}>sign out</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-body scroll col gap-3" style={{ padding: "12px 4px" }}>
            <div className="box">
              <div className="row gap-3">
                <Avatar name={user?.name ?? "?"} size={56} />
                <div>
                  <div className="wf-scrawl bold" style={{ fontSize: 26 }}>
                    {user?.name ?? "—"}
                  </div>
                  <div className="small muted">{user?.email ?? "—"}</div>
                </div>
              </div>
            </div>

            <div className="box">
              <div className="small muted">DETAILS</div>
              <Squiggle w={50} color="var(--ink-faint)" />
              <div className="col gap-2 mt-2 small">
                <div className="row between">
                  <span className="muted">role</span>
                  <span className="bold">{(user?.role ?? "STUDENT").toLowerCase()}</span>
                </div>
                <div className="row between">
                  <span className="muted">age</span>
                  <MockTag>not set</MockTag>
                </div>
                <div className="row between">
                  <span className="muted">instrument</span>
                  <MockTag>not set</MockTag>
                </div>
              </div>
            </div>

            <div className="box dashed">
              <div className="small">
                Profile editing UI is coming. For now, you can update your email or password
                via the auth flow.
              </div>
              <div className="row gap-2 mt-2">
                <Link to="/reset-password" className="btn small">reset password</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </STFrame>
  );
}
