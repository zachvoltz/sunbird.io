// Standalone notification-settings page for students (coaches get the same
// NotificationSettings component embedded in their Account page). Wrapped in
// the student STFrame chrome.

import { Link } from "react-router-dom";
import { STFrame } from "../components/STFrame";
import { NotificationSettings } from "../components/NotificationSettings";

export function NotificationSettingsPage() {
  return (
    <STFrame side="home">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Notifications</h2>
          <div className="dt-sub">Choose how Sunbird reaches you.</div>
        </div>
        <Link to="/messages" className="btn small ghost">back to messages</Link>
      </div>
      <div className="dt-main-body">
        <div style={{ maxWidth: 560 }}>
          <NotificationSettings />
        </div>
      </div>
    </STFrame>
  );
}
