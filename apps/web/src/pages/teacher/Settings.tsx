import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch } from "@/lib/api";

type CoachSettings = {
  sessionAddress: string | null;
  zoomConnected: boolean;
};

export function CoachSettings() {
  const [settings, setSettings] = useState<CoachSettings | null>(null);
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();

  const zoomStatus = searchParams.get("zoom");
  const error = searchParams.get("error");

  useEffect(() => {
    apiFetch<{ data: CoachSettings }>("/api/coach-settings")
      .then((res) => {
        setSettings(res.data);
        setAddress(res.data.sessionAddress ?? "");
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const saveAddress = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await apiFetch("/api/coach-settings", {
        method: "PATCH",
        body: JSON.stringify({ sessionAddress: address || undefined }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const disconnectZoom = async () => {
    if (!confirm("Disconnect your Zoom account?")) return;
    try {
      await apiFetch("/api/coach-settings/zoom/disconnect", { method: "POST" });
      setSettings((s) => s ? { ...s, zoomConnected: false } : s);
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-16 px-6 md:px-10">
      <div className="mx-auto max-w-[700px]">
        <Link
          to="/coach"
          className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary hover:text-charcoal transition-colors"
        >
          &larr; Dashboard
        </Link>

        <h1 className="font-display text-3xl md:text-4xl font-bold mt-8 mb-10">
          Settings
        </h1>

        {error === "oauth_failed" && (
          <div className="bg-coral/10 text-coral text-sm px-4 py-3 rounded-lg mb-8">
            Zoom connection failed. Please try again.
          </div>
        )}

        {zoomStatus === "connected" && (
          <div className="bg-sage/10 text-sage text-sm px-4 py-3 rounded-lg mb-8">
            Zoom connected successfully!
          </div>
        )}

        {/* Session Address */}
        <section className="mb-12">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
            Session Address
          </h2>
          <div className="bg-surface rounded-card shadow-card p-6">
            <p className="text-sm text-text-secondary mb-4">
              This address will be shown to students who book in-person lessons.
            </p>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. 123 Main St, Austin, TX 78701"
              className="w-full px-4 py-2.5 text-sm bg-cream border border-charcoal/10 rounded-card focus:border-charcoal/30 focus:outline-none transition-colors mb-4"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={saveAddress}
                disabled={saving}
                className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {saved && (
                <span className="text-[12px] text-sage">Saved</span>
              )}
            </div>
          </div>
        </section>

        {/* Video Platform */}
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4">
            Video Platform
          </h2>
          <div className="bg-surface rounded-card shadow-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold mb-1">Zoom</h3>
                {settings?.zoomConnected ? (
                  <p className="text-sm text-sage">Connected</p>
                ) : (
                  <p className="text-sm text-text-secondary">
                    Connect your Zoom account to offer online lessons.
                  </p>
                )}
              </div>
              {settings?.zoomConnected ? (
                <button
                  onClick={disconnectZoom}
                  className="text-[12px] font-medium text-coral hover:text-coral/80 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <a
                  href="/api/coach-settings/zoom/connect"
                  className="text-[13px] font-medium text-cream bg-iris px-5 py-2 rounded-card hover:bg-iris-hover transition-colors inline-block"
                >
                  Connect Zoom
                </a>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
