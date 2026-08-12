import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  User as UserIcon,
  Bell,
  Lock,
  Sparkles,
  LayoutDashboard,
  MessageSquare,
  Brain,
  LogOut,
  Check,
  Map,
  UserX,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Tab = "profile" | "ai" | "notifications" | "security";

interface SettingsData {
  theme: string;
  response_length: string;
  temperature: number;
  language: string;
  notifications_enabled: boolean;
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const initialTab = (location.state as { openTab?: Tab } | null)?.openTab ?? "profile";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [savedFlash, setSavedFlash] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState("");
  const [college, setCollege] = useState("");
  const [course, setCourse] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Settings
  const [settings, setSettings] = useState<SettingsData | null>(null);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get("/auth/me/settings").then(({ data }) => setSettings(data));
  }, []);

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const { data } = await api.patch("/auth/me", {
        full_name: fullName,
        username: username || null,
        bio: bio || null,
        college: college || null,
        course: course || null,
      });
      setUser(data);
      flashSaved();
    } finally {
      setProfileSaving(false);
    }
  }

  async function updateSetting(patch: Partial<SettingsData>) {
    if (!settings) return;
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    try {
      const { data } = await api.patch("/auth/me/settings", patch);
      setSettings(data);
      flashSaved();
    } catch {
      setSettings(settings);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSaving(true);
    try {
      await api.post("/auth/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      flashSaved();
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail ?? "Could not change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await api.delete("/auth/me", { data: { password: deletePassword } });
      logout();
      navigate("/");
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail ?? "Could not delete account.");
    } finally {
      setDeleting(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const TABS: { id: Tab; label: string; icon: typeof UserIcon }[] = [
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "ai", label: "AI preferences", icon: Sparkles },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-void-950 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-void-700/60 h-screen sticky top-0 px-5 py-6">
        <Link to="/" className="font-display text-lg tracking-tight text-white mb-10">
          Scholar<span className="text-gradient-neon">AI</span>
        </Link>
        <nav className="space-y-1 text-sm">
          <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link to="/chat" className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors">
            <MessageSquare className="w-4 h-4" />
            AI Chat
          </Link>
          <Link to="/study" className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors">
            <Brain className="w-4 h-4" />
            Study Pack
          </Link>
          <Link to="/roadmap/new" className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors">
            <Map className="w-4 h-4" />
            Roadmap
          </Link>
        </nav>
        <button
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
        <button
          onClick={() => setTab("security")}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-neon-pink/70 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors text-sm"
        >
          <UserX className="w-4 h-4" />
          Delete account
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 px-6 md:px-10 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-2">
              Account
            </p>
            <h1 className="text-3xl text-white">Profile & Settings</h1>
          </div>
          {savedFlash && (
            <span className="flex items-center gap-1.5 text-xs text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-full px-3 py-1.5">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2 mb-8">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-full border transition-colors ${
                tab === t.id
                  ? "border-transparent bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-medium"
                  : "border-void-600 text-void-300 hover:text-white hover:border-void-400"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {tab === "profile" && (
          <div className="glass rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-white font-semibold mb-1">Learning statistics</h2>
              <p className="text-sm text-void-300 mb-4">
                A snapshot of your activity so far.
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-void-900 border border-void-700 p-4 text-center">
                  <p className="text-2xl font-display text-white">0</p>
                  <p className="text-xs text-void-400 mt-1">Chats</p>
                </div>
                <div className="rounded-xl bg-void-900 border border-void-700 p-4 text-center">
                  <p className="text-2xl font-display text-white">0</p>
                  <p className="text-xs text-void-400 mt-1">Quizzes</p>
                </div>
                <div className="rounded-xl bg-void-900 border border-void-700 p-4 text-center">
                  <p className="text-2xl font-display text-white">0</p>
                  <p className="text-xs text-void-400 mt-1">Day streak</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-2 border-t border-void-700/60">
              <div className="grid md:grid-cols-2 gap-4 pt-6">
                <div>
                  <label className="block text-sm text-void-200 mb-1">Full name</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
                  />
                </div>
                <div>
                  <label className="block text-sm text-void-200 mb-1">Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-void-200 mb-1">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet resize-none"
                  placeholder="Tell ScholarAI a bit about what you're studying"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-void-200 mb-1">College</label>
                  <input
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
                  />
                </div>
                <div>
                  <label className="block text-sm text-void-200 mb-1">Course</label>
                  <input
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="rounded-lg bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 px-5 py-2.5 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {profileSaving ? "Saving…" : "Save profile"}
              </button>
            </form>
          </div>
        )}


        {/* AI preferences tab */}
        {tab === "ai" && settings && (
          <div className="glass rounded-2xl p-6 space-y-6">
            <h2 className="text-white font-semibold">AI preferences</h2>

            <div>
              <label className="block text-sm text-void-200 mb-2">Response length</label>
              <div className="flex gap-2">
                {["concise", "balanced", "detailed"].map((v) => (
                  <button
                    key={v}
                    onClick={() => updateSetting({ response_length: v })}
                    className={`px-4 py-2 rounded-lg text-sm capitalize border transition-colors ${
                      settings.response_length === v
                        ? "border-neon-violet text-white bg-void-800"
                        : "border-void-600 text-void-400 hover:text-white"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-void-200 mb-2">
                Creativity (temperature): {settings.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.temperature}
                onChange={(e) => updateSetting({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-neon-violet"
              />
              <div className="flex justify-between text-xs text-void-400 mt-1">
                <span>More focused</span>
                <span>More creative</span>
              </div>
            </div>

            <div>
              <label className="block text-sm text-void-200 mb-2">Language</label>
              <select
                value={settings.language}
                onChange={(e) => updateSetting({ language: e.target.value })}
                className="rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
              </select>
            </div>
          </div>
        )}

        {/* Notifications tab */}
        {tab === "notifications" && settings && (
          <div className="glass rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Notifications</h2>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm text-white">Enable notifications</p>
                <p className="text-xs text-void-400 mt-0.5">
                  Quiz reminders, streak alerts, and study nudges.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications_enabled}
                onChange={(e) => updateSetting({ notifications_enabled: e.target.checked })}
                className="w-5 h-5 accent-neon-violet"
              />
            </label>
          </div>
        )}

        {/* Security tab */}
        {tab === "security" && (
          <div className="space-y-6">
            <div className="glass rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-1">Change password</h2>
              <p className="text-sm text-void-300 mb-5">
                Choose a strong password you're not using elsewhere.
              </p>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
                <div>
                  <label className="block text-sm text-void-200 mb-1">Current password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
                  />
                </div>
                <div>
                  <label className="block text-sm text-void-200 mb-1">New password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
                    placeholder="At least 8 characters"
                  />
                </div>
                {passwordError && (
                  <p className="text-sm text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-3 py-2">
                    {passwordError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-lg bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 px-5 py-2.5 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {passwordSaving ? "Updating…" : "Update password"}
                </button>
              </form>
            </div>

            {/* Danger zone */}
            <div className="rounded-2xl border border-neon-pink/30 bg-neon-pink/5 p-6">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-neon-pink" />
                <h2 className="text-white font-semibold">Danger zone</h2>
              </div>
              <p className="text-sm text-void-300 mb-5">
                Deleting your account is permanent — your chats, quizzes, flashcards, notes,
                mind maps, and roadmaps will no longer be accessible.
              </p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-neon-pink/50 text-neon-pink hover:bg-neon-pink/10 transition-colors"
                >
                  <UserX className="w-4 h-4" />
                  Delete my account
                </button>
              ) : (
                <form onSubmit={handleDeleteAccount} className="space-y-3 max-w-sm">
                  <label className="block text-sm text-void-200">
                    Enter your password to confirm — this can't be undone.
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-lg border border-neon-pink/40 bg-void-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-neon-pink"
                    placeholder="Your password"
                  />
                  {deleteError && (
                    <p className="text-sm text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-3 py-2">
                      {deleteError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={deleting}
                      className="text-sm px-4 py-2 rounded-lg bg-neon-pink text-void-950 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Permanently delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword("");
                        setDeleteError(null);
                      }}
                      className="text-sm px-4 py-2 rounded-lg border border-void-600 text-void-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
