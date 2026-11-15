import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  User as UserIcon,
  Bell,
  Sparkles,
  LayoutDashboard,
  MessageSquare,
  Brain,
  LogOut,
  Check,
  Map,
  UserX,
  AlertTriangle,
  Download,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Laptop,
  Globe,
  Trash2,
  Volume2,
  Gauge,
  FileText,
  Database,
  Sliders,
  Palette,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

type Tab = "profile" | "ai" | "security" | "privacy" | "appearance";

interface SettingsData {
  theme: string;
  response_length: string;
  temperature: number;
  language: string;
  notifications_enabled: boolean;
  study_mode?: string;
  default_quiz_difficulty?: string;
  default_flashcard_count?: number;
  audio_speed?: number;
  audio_voice?: string;
  data_retention_days?: number;
  telemetry_opt_out?: boolean;
}

interface LearningStats {
  total_chats: number;
  total_quizzes: number;
  day_streak: number;
}

interface SessionItem {
  id: string;
  device_name: string | null;
  browser: string | null;
  ip_address: string | null;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

interface AuditLogItem {
  id: string;
  action: string;
  entity_type: string | null;
  ip_address: string | null;
  created_at: string;
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

  // Profile state
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [college, setCollege] = useState(user?.college ?? "");
  const [course, setCourse] = useState(user?.course ?? "");
  const [semester, setSemester] = useState<number | string>(user?.semester ?? "");
  const [profileSaving, setProfileSaving] = useState(false);

  // Learning stats
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<SettingsData | null>(null);

  // Reduced motion
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    return localStorage.getItem("scholarai_reduced_motion") === "true";
  });

  // Security: Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Security: Sessions state
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [sessionsMessage, setSessionsMessage] = useState<string | null>(null);

  // Security: Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  // Privacy: Data export
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingMd, setExportingMd] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Privacy: Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadStats = useCallback(() => {
    setStatsLoading(true);
    setStatsError(null);
    api
      .get("/auth/me/stats")
      .then(({ data }) => setStats(data))
      .catch((err) => {
        console.error("Failed to load learning stats:", err);
        setStatsError(err.response?.data?.detail ?? "Could not load stats.");
      })
      .finally(() => setStatsLoading(false));
  }, []);

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    api
      .get("/auth/me/sessions")
      .then(({ data }) => setSessions(data))
      .catch((err) => console.error("Failed to fetch sessions:", err))
      .finally(() => setSessionsLoading(false));
  }, []);

  const loadAuditLogs = useCallback(() => {
    setAuditLogsLoading(true);
    api
      .get("/auth/me/audit-logs")
      .then(({ data }) => setAuditLogs(data))
      .catch((err) => console.error("Failed to fetch audit logs:", err))
      .finally(() => setAuditLogsLoading(false));
  }, []);

  useEffect(() => {
    api.get("/auth/me/settings").then(({ data }) => setSettings(data));
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === "security") {
      loadSessions();
      loadAuditLogs();
    }
  }, [tab, loadSessions, loadAuditLogs]);

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  function toggleReducedMotion(enabled: boolean) {
    setReducedMotion(enabled);
    if (enabled) {
      localStorage.setItem("scholarai_reduced_motion", "true");
      document.documentElement.setAttribute("data-reduced-motion", "true");
    } else {
      localStorage.removeItem("scholarai_reduced_motion");
      document.documentElement.removeAttribute("data-reduced-motion");
    }
    window.dispatchEvent(new Event("scholarai_reduced_motion_changed"));
  }

  async function updateSetting(patch: Partial<SettingsData>) {
    if (!settings) return;
    const optimistic = { ...settings, ...patch };
    setSettings(optimistic);
    try {
      const { data } = await api.patch("/auth/me/settings", patch);
      setSettings(data);
      flashSaved();
    } catch (err) {
      console.error("Settings update failed:", err);
      setSettings(settings);
    }
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
        semester: semester ? Number(semester) : null,
      });
      setUser(data);
      flashSaved();
    } finally {
      setProfileSaving(false);
    }
  }

  // Password strength calculation
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumberOrSymbol = /[\d!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const strengthScore = [hasMinLength, hasUpper, hasLower, hasNumberOrSymbol].filter(Boolean).length;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (strengthScore < 4) {
      setPasswordError("Password does not meet the complexity requirements below.");
      return;
    }

    setPasswordSaving(true);
    try {
      await api.post("/auth/me/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated successfully! All other active sessions have been revoked.");
      flashSaved();
      loadSessions();
      loadAuditLogs();
    } catch (err: any) {
      setPasswordError(err.response?.data?.detail ?? "Could not change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleRevokeOthers() {
    setRevokingOthers(true);
    setSessionsMessage(null);
    try {
      const { data } = await api.post("/auth/me/sessions/revoke-others");
      setSessionsMessage(data.message || "Revoked all other active sessions.");
      loadSessions();
      loadAuditLogs();
    } catch (err: any) {
      setSessionsMessage(err.response?.data?.detail ?? "Failed to revoke sessions.");
    } finally {
      setRevokingOthers(false);
    }
  }

  async function handleRevokeSession(sessionId: string) {
    setRevokingId(sessionId);
    try {
      await api.delete(`/auth/me/sessions/${sessionId}`);
      loadSessions();
      loadAuditLogs();
    } catch (err) {
      console.error("Failed to revoke session:", err);
    } finally {
      setRevokingId(null);
    }
  }

  async function handleExportJson() {
    setExportingJson(true);
    setExportError(null);
    try {
      const { data } = await api.get("/auth/me/export?format=json");
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scholarai-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.response?.data?.detail ?? "Failed to export JSON data.");
    } finally {
      setExportingJson(false);
    }
  }

  async function handleExportMarkdown() {
    setExportingMd(true);
    setExportError(null);
    try {
      const res = await api.get("/auth/me/export?format=markdown", { responseType: "text" });
      const blob = new Blob([res.data], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scholarai-export-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExportError(err.response?.data?.detail ?? "Failed to export Markdown report.");
    } finally {
      setExportingMd(false);
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

  const TABS: { id: Tab; label: string; icon: typeof UserIcon; badge?: string }[] = [
    { id: "profile", label: "Profile & Identity", icon: UserIcon },
    { id: "ai", label: "AI Study Intelligence", icon: Sparkles, badge: "Advanced" },
    { id: "security", label: "Security & Devices", icon: ShieldCheck, badge: "Hardened" },
    { id: "privacy", label: "Data & Privacy", icon: Database },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  return (
    <div className="min-h-screen bg-void-950 flex flex-col md:flex-row text-void-100 selection:bg-neon-violet/30 selection:text-white relative overflow-x-hidden">
      {/* Ambient background glow orbs */}
      <div className="absolute -top-40 right-10 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-20 w-80 h-80 bg-neon-violet/5 rounded-full blur-3xl pointer-events-none" />

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-void-950/90 backdrop-blur-xl sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center p-0.5 shadow-sm shadow-neon-violet/30">
            <div className="w-full h-full bg-void-950 rounded-full flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-neon-cyan" />
            </div>
          </div>
          <span className="font-display text-base tracking-tight text-white">
            Scholar<span className="text-gradient-neon font-bold">AI</span>
          </span>
        </Link>
        <Link
          to="/dashboard"
          className="text-xs text-void-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04]"
        >
          Dashboard →
        </Link>
      </header>

      {/* Modern Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-void-800/80 bg-void-950/90 backdrop-blur-xl h-screen sticky top-0 px-5 py-6 z-20">
        <Link to="/" className="flex items-center gap-2 font-display text-xl tracking-tight text-white mb-8 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center text-void-950 font-bold shadow-[0_0_15px_rgba(139,92,246,0.3)] group-hover:scale-105 transition-transform">
            S
          </div>
          <span>
            Scholar<span className="text-gradient-neon">AI</span>
          </span>
        </Link>

        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-void-400 px-3 mb-2">Navigation</p>
        <nav className="space-y-1 text-sm mb-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-void-900/80 transition-all"
          >
            <LayoutDashboard className="w-4 h-4 text-neon-cyan" />
            Dashboard
          </Link>
          <Link
            to="/chat"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-void-900/80 transition-all"
          >
            <MessageSquare className="w-4 h-4 text-neon-violet" />
            AI Chat
          </Link>
          <Link
            to="/study"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-void-900/80 transition-all"
          >
            <Brain className="w-4 h-4 text-neon-pink" />
            Study Pack
          </Link>
          <Link
            to="/roadmap/new"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-void-900/80 transition-all"
          >
            <Map className="w-4 h-4 text-neon-lime" />
            Roadmap
          </Link>
        </nav>

        <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-void-400 px-3 mb-2">Settings Suite</p>
        <div className="space-y-1 text-sm">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-neon-violet/15 text-white border border-neon-violet/30 font-medium shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                    : "text-void-300 hover:text-white hover:bg-void-900/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-neon-cyan" : "text-void-400"}`} />
                  <span>{t.label}</span>
                </div>
                {t.badge && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-void-800 text-void-300 border border-void-700/60">
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-auto pt-4 border-t border-void-800/80 space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-void-300 hover:text-white hover:bg-void-900/80 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4 text-void-400" />
            Log out
          </button>
          <button
            onClick={() => setTab("privacy")}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-neon-pink/70 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors text-sm"
          >
            <UserX className="w-4 h-4" />
            Delete account
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 px-4 sm:px-8 md:px-12 py-6 md:py-8 max-w-4xl min-w-0 z-10 pb-28 md:pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-[0.25em] uppercase text-neon-cyan mb-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Control Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-white tracking-tight">
              Settings & Security
            </h1>
            <p className="text-sm text-void-300 mt-1">
              Configure your academic profile, AI reasoning, security shields, and privacy governance.
            </p>
          </div>
          {savedFlash && (
            <span className="self-start sm:self-auto flex items-center gap-1.5 text-xs text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-full px-3.5 py-1.5 shadow-[0_0_12px_rgba(132,204,22,0.2)] animate-pulse">
              <Check className="w-3.5 h-3.5" />
              Changes saved
            </span>
          )}
        </div>

        {/* Mobile Tab Selector */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl border transition-all ${
                tab === t.id
                  ? "border-neon-cyan/50 bg-neon-cyan/15 text-white font-medium"
                  : "border-void-800 bg-void-900/80 text-void-300"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: PROFILE & ACADEMIC IDENTITY */}
        {/* ------------------------------------------------------------- */}
        {tab === "profile" && (
          <div className="space-y-6">
            {/* Learning statistics banner */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-white font-semibold text-base flex items-center gap-2">
                    <Brain className="w-4 h-4 text-neon-violet" />
                    Academic Milestones
                  </h2>
                  <p className="text-xs text-void-300 mt-0.5">Your study activity synchronized across all sessions.</p>
                </div>
                <button
                  type="button"
                  onClick={loadStats}
                  disabled={statsLoading}
                  className="p-1.5 rounded-lg border border-void-700 hover:bg-void-800 text-void-300 hover:text-white transition-colors"
                  title="Refresh statistics"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {statsLoading ? (
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl bg-void-900/80 border border-void-800 p-4 text-center animate-pulse">
                      <div className="h-7 w-12 bg-void-800 rounded mx-auto mb-2" />
                      <div className="h-3 w-16 bg-void-800 rounded mx-auto" />
                    </div>
                  ))}
                </div>
              ) : statsError ? (
                <div className="rounded-xl bg-void-900 border border-neon-pink/30 p-4 flex items-center justify-between">
                  <span className="text-xs text-neon-pink">{statsError}</span>
                  <button
                    type="button"
                    onClick={loadStats}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-neon-pink/20 hover:bg-neon-pink/30 text-white font-medium"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-void-950/60 border border-void-800/80 p-4 text-center">
                    <p className="text-2xl font-display font-bold text-white">{stats?.total_chats ?? 0}</p>
                    <p className="text-xs text-void-400 mt-1">Study Chats</p>
                  </div>
                  <div className="rounded-xl bg-void-950/60 border border-void-800/80 p-4 text-center">
                    <p className="text-2xl font-display font-bold text-neon-cyan">{stats?.total_quizzes ?? 0}</p>
                    <p className="text-xs text-void-400 mt-1">Quizzes Mastered</p>
                  </div>
                  <div className="rounded-xl bg-void-950/60 border border-void-800/80 p-4 text-center">
                    <p className="text-2xl font-display font-bold text-neon-lime flex items-center justify-center gap-1">
                      <span>🔥</span>
                      {stats?.day_streak ?? 0}
                    </p>
                    <p className="text-xs text-void-400 mt-1">Day Streak</p>
                  </div>
                </div>
              )}
            </div>

            {/* Profile form */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-neon-cyan" />
                  Personal & Academic Details
                </h2>
                <p className="text-xs text-void-300 mt-0.5">
                  Helps ScholarAI customize curriculum context and recommendations.
                </p>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-void-200 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet focus:border-neon-violet transition-all"
                      placeholder="e.g. Alex Rivera"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-void-200 mb-1.5">Username</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet focus:border-neon-violet transition-all"
                      placeholder="Optional handle"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-void-200 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email ?? ""}
                    className="w-full rounded-xl border border-void-800 bg-void-950/40 px-3.5 py-2 text-sm text-void-400 cursor-not-allowed"
                  />
                  <p className="text-[11px] text-void-500 mt-1">Verified primary login email.</p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-void-200 mb-1.5">College / University</label>
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet focus:border-neon-violet transition-all"
                      placeholder="e.g. Stanford University"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-void-200 mb-1.5">Semester</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet focus:border-neon-violet transition-all"
                      placeholder="e.g. 4"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-void-200 mb-1.5">Major / Course</label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet focus:border-neon-violet transition-all"
                    placeholder="e.g. B.Tech Computer Science & AI"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-void-200 mb-1.5">Academic Bio & Focus Areas</label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet focus:border-neon-violet transition-all resize-none"
                    placeholder="Tell ScholarAI what topics or exams you are preparing for..."
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 px-6 py-2.5 text-sm font-semibold hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50"
                  >
                    {profileSaving ? "Saving Profile…" : "Save Profile Details"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: AI STUDY INTELLIGENCE */}
        {/* ------------------------------------------------------------- */}
        {tab === "ai" && settings && (
          <div className="space-y-6">
            {/* Explanation Personas / Study Modes */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-neon-cyan" />
                  Study Mode & Pedagogical Persona
                </h2>
                <p className="text-xs text-void-300 mt-0.5">
                  Select how ScholarAI breaks down concepts, solves problems, and guides your revision.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                {[
                  {
                    id: "balanced",
                    name: "Balanced Scholar",
                    desc: "Rigorous yet intuitive explanations with real-world analogies and clear summaries.",
                    badge: "Default",
                  },
                  {
                    id: "concise",
                    name: "Concise & High-Yield",
                    desc: "Punchy, formula-first bullet points designed for rapid revision and exam cramming.",
                    badge: "Fast",
                  },
                  {
                    id: "socratic",
                    name: "Socratic Inquiry",
                    desc: "Teaches through probing questions and thought experiments to build deep mastery.",
                    badge: "Deep",
                  },
                  {
                    id: "step_by_step",
                    name: "Step-by-Step Solver",
                    desc: "Exhaustive proofs, mathematical derivations, code traces, and edge-case breakdowns.",
                    badge: "Technical",
                  },
                ].map((mode) => {
                  const isSelected = (settings.study_mode || "balanced") === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => updateSetting({ study_mode: mode.id })}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "border-neon-cyan bg-neon-cyan/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                          : "border-void-800 bg-void-950/60 hover:border-void-700 hover:bg-void-950/90"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-void-200"}`}>
                          {mode.name}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-void-800 border border-void-700 text-void-300">
                          {mode.badge}
                        </span>
                      </div>
                      <p className="text-xs text-void-400 leading-relaxed">{mode.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Response Depth & Creativity */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-neon-violet" />
                  Response Dynamics & Temperature
                </h2>
                <p className="text-xs text-void-300 mt-0.5">Control the elaboration depth and exploration creativity.</p>
              </div>

              {/* Response Length */}
              <div>
                <label className="block text-xs font-medium text-void-200 mb-2">Default Response Length</label>
                <div className="grid grid-cols-3 gap-3">
                  {["concise", "balanced", "detailed"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => updateSetting({ response_length: v })}
                      className={`py-2 rounded-xl text-xs font-medium capitalize border transition-all ${
                        settings.response_length === v
                          ? "border-neon-violet bg-neon-violet/15 text-white font-semibold shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                          : "border-void-800 bg-void-950/60 text-void-400 hover:text-white hover:border-void-700"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Temperature Slider */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-void-200">
                    Creativity / Determinism Index:{" "}
                    <span className="font-mono text-neon-cyan font-bold">{settings.temperature}</span>
                  </label>
                  <span className="text-[11px] font-mono text-void-400">
                    {settings.temperature < 0.4
                      ? "Strictly Factual & Deterministic"
                      : settings.temperature > 0.7
                      ? "Creative & Divergent"
                      : "Balanced Synthesis"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.temperature}
                  onChange={(e) => updateSetting({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-neon-cyan bg-void-800 h-2 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-void-400 mt-1">
                  <span>0.0 (Strict Precision)</span>
                  <span>0.5 (Balanced)</span>
                  <span>1.0 (High Exploration)</span>
                </div>
              </div>

              {/* Language */}
              <div className="pt-2 border-t border-void-800">
                <label className="block text-xs font-medium text-void-200 mb-2">Primary Explanation Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSetting({ language: e.target.value })}
                  className="rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neon-violet focus:border-neon-violet transition-all"
                >
                  <option value="en">English (US / Academic)</option>
                  <option value="hi">Hindi (हिन्दी)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                </select>
              </div>
            </div>

            {/* Study Tool Defaults */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-neon-lime" />
                  Study Pack & Audio Overview Presets
                </h2>
                <p className="text-xs text-void-300 mt-0.5">Configure default presets when generating quizzes, flashcards, and audio digests.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-void-200 mb-1.5">Default Quiz Difficulty</label>
                  <select
                    value={settings.default_quiz_difficulty || "medium"}
                    onChange={(e) => updateSetting({ default_quiz_difficulty: e.target.value })}
                    className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neon-violet"
                  >
                    <option value="easy">Easy (Fundamentals & Definitions)</option>
                    <option value="medium">Medium (Application & Problem Solving)</option>
                    <option value="hard">Hard (Synthesis & Tricky Edge Cases)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-void-200 mb-1.5">Flashcard Batch Size</label>
                  <select
                    value={settings.default_flashcard_count || 10}
                    onChange={(e) => updateSetting({ default_flashcard_count: parseInt(e.target.value, 10) })}
                    className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neon-violet"
                  >
                    <option value={5}>5 Cards (Bite-sized review)</option>
                    <option value={10}>10 Cards (Balanced study set)</option>
                    <option value={15}>15 Cards (Comprehensive chapter)</option>
                    <option value={20}>20 Cards (Deep exam drill)</option>
                  </select>
                </div>
              </div>

              {/* Audio Overview settings */}
              <div className="pt-4 border-t border-void-800 grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-void-200 mb-1.5 flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5 text-neon-cyan" />
                    Audio Overview Narration Speed
                  </label>
                  <select
                    value={settings.audio_speed || 1.0}
                    onChange={(e) => updateSetting({ audio_speed: parseFloat(e.target.value) })}
                    className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neon-violet"
                  >
                    <option value={0.8}>0.8x (Deliberate pace)</option>
                    <option value={1.0}>1.0x (Standard conversational)</option>
                    <option value={1.25}>1.25x (Accelerated review)</option>
                    <option value={1.5}>1.5x (High speed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-void-200 mb-1.5">Voice Persona</label>
                  <select
                    value={settings.audio_voice || "system"}
                    onChange={(e) => updateSetting({ audio_voice: e.target.value })}
                    className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neon-violet"
                  >
                    <option value="system">Natural Academic Narrator</option>
                    <option value="mentor">Interactive Socratic Mentor</option>
                    <option value="executive">Concise Executive Briefing</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: SECURITY & HARDENED SESSIONS */}
        {/* ------------------------------------------------------------- */}
        {tab === "security" && (
          <div className="space-y-6">
            {/* Active Devices & Session Manager */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-white font-semibold text-base flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-neon-cyan" />
                    Active Logins & Device Shield
                  </h2>
                  <p className="text-xs text-void-300 mt-0.5">
                    Manage active authentication sessions. You can revoke unrecognized devices in real time.
                  </p>
                </div>
                {sessions.length > 1 && (
                  <button
                    type="button"
                    onClick={handleRevokeOthers}
                    disabled={revokingOthers}
                    className="shrink-0 flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl border border-neon-pink/40 bg-neon-pink/10 text-neon-pink hover:bg-neon-pink/20 transition-all disabled:opacity-50 font-medium"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {revokingOthers ? "Revoking…" : "Log Out Other Devices"}
                  </button>
                )}
              </div>

              {sessionsMessage && (
                <div className="p-3 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-xs text-neon-cyan">
                  {sessionsMessage}
                </div>
              )}

              {/* Sessions list */}
              {sessionsLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="rounded-xl bg-void-950/60 border border-void-800 p-4 animate-pulse h-16" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-void-400 py-3 text-center">No other active sessions detected.</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((s) => {
                    const isMobile = s.device_name?.toLowerCase().includes("mobile") || s.browser?.toLowerCase().includes("mobile");
                    const DeviceIcon = isMobile ? Smartphone : Laptop;
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                          s.is_current
                            ? "border-neon-cyan/40 bg-neon-cyan/5 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                            : "border-void-800/80 bg-void-950/60 hover:border-void-700"
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={`p-2.5 rounded-xl ${s.is_current ? "bg-neon-cyan/20 text-neon-cyan" : "bg-void-800 text-void-400"}`}>
                            <DeviceIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{s.device_name || "Web Client"}</span>
                              {s.is_current && (
                                <span className="flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neon-lime/20 border border-neon-lime/40 text-neon-lime">
                                  <span className="w-1.5 h-1.5 rounded-full bg-neon-lime animate-ping" />
                                  Active Now
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-void-400 mt-0.5 font-mono">
                              <span>{s.browser || "Browser"}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3 text-void-500" />
                                {s.ip_address || "Unknown IP"}
                              </span>
                              <span>•</span>
                              <span>{new Date(s.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {!s.is_current && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(s.id)}
                            disabled={revokingId === s.id}
                            className="text-xs px-3 py-1.5 rounded-lg border border-void-700 hover:border-neon-pink hover:bg-neon-pink/10 hover:text-neon-pink text-void-400 transition-colors disabled:opacity-50"
                          >
                            {revokingId === s.id ? "Revoking…" : "Revoke"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Password Change with Live Strength Check */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-5">
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-neon-violet" />
                  Hardened Password Policy
                </h2>
                <p className="text-xs text-void-300 mt-0.5">
                  Passwords must be at least 8 characters and include uppercase, lowercase, and numeric or symbol characters.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-medium text-void-200 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet"
                    placeholder="Enter current password"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-void-200 mb-1.5">New Password</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet"
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-void-200 mb-1.5">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-violet"
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>

                {/* Password Strength Checklist */}
                {newPassword && (
                  <div className="p-3.5 rounded-xl bg-void-950/80 border border-void-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-void-400">Password Strength:</span>
                      <span
                        className={`font-semibold ${
                          strengthScore === 4
                            ? "text-neon-lime"
                            : strengthScore >= 2
                            ? "text-neon-cyan"
                            : "text-neon-pink"
                        }`}
                      >
                        {strengthScore === 4 ? "Strong & Compliant" : strengthScore >= 2 ? "Moderate" : "Weak"}
                      </span>
                    </div>

                    {/* Strength meter bars */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`h-1.5 rounded-full transition-all ${
                            step <= strengthScore
                              ? strengthScore === 4
                                ? "bg-neon-lime"
                                : strengthScore >= 2
                                ? "bg-neon-cyan"
                                : "bg-neon-pink"
                              : "bg-void-800"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Criteria checks */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <span className={`flex items-center gap-1.5 ${hasMinLength ? "text-neon-lime" : "text-void-500"}`}>
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        8+ characters
                      </span>
                      <span className={`flex items-center gap-1.5 ${hasUpper ? "text-neon-lime" : "text-void-500"}`}>
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        Uppercase letter
                      </span>
                      <span className={`flex items-center gap-1.5 ${hasLower ? "text-neon-lime" : "text-void-500"}`}>
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        Lowercase letter
                      </span>
                      <span className={`flex items-center gap-1.5 ${hasNumberOrSymbol ? "text-neon-lime" : "text-void-500"}`}>
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        Digit or symbol
                      </span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-void-400">
                  <span className="text-neon-cyan font-medium">Security Notice:</span> Changing your password will
                  automatically terminate all other active device sessions for your protection.
                </p>

                {passwordError && (
                  <p className="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-xl px-3.5 py-2.5">
                    {passwordError}
                  </p>
                )}
                {passwordSuccess && (
                  <p className="text-xs text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-xl px-3.5 py-2.5">
                    {passwordSuccess}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 px-6 py-2.5 text-sm font-semibold hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50"
                >
                  {passwordSaving ? "Updating Password…" : "Update Password & Shield"}
                </button>
              </form>
            </div>

            {/* Security Audit Log */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-white font-semibold text-base flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-neon-lime" />
                    Security Event Audit Log
                  </h2>
                  <p className="text-xs text-void-300 mt-0.5">Timeline of recent security and authentication operations.</p>
                </div>
                <button
                  type="button"
                  onClick={loadAuditLogs}
                  disabled={auditLogsLoading}
                  className="p-1.5 rounded-lg border border-void-700 hover:bg-void-800 text-void-300 hover:text-white transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${auditLogsLoading ? "animate-spin" : ""}`} />
                </button>
              </div>

              {auditLogsLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 rounded-lg bg-void-950/60 border border-void-800 animate-pulse" />
                  ))}
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-void-400 py-3 text-center">No security audit records logged yet.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-void-800/80 bg-void-950/60 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-void-800 text-neon-cyan border border-void-700/60">
                          {log.action}
                        </span>
                        <span className="text-void-300 font-mono">{log.ip_address || "Direct Client"}</span>
                      </div>
                      <span className="text-void-500 font-mono text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 4: DATA GOVERNANCE & PRIVACY */}
        {/* ------------------------------------------------------------- */}
        {tab === "privacy" && settings && (
          <div className="space-y-6">
            {/* Retention & Telemetry */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <Database className="w-4 h-4 text-neon-cyan" />
                  Data Retention & Governance Policy
                </h2>
                <p className="text-xs text-void-300 mt-0.5">Control how long your study records are kept and how AI telemetry is treated.</p>
              </div>

              {/* Retention selector */}
              <div>
                <label className="block text-xs font-medium text-void-200 mb-1.5">Study History Retention Horizon</label>
                <select
                  value={settings.data_retention_days || 0}
                  onChange={(e) => updateSetting({ data_retention_days: parseInt(e.target.value, 10) })}
                  className="rounded-xl border border-void-700 bg-void-950/80 px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-neon-violet"
                >
                  <option value={0}>Retain Indefinitely (Recommended for lifetime stats)</option>
                  <option value={30}>Auto-expire after 30 days</option>
                  <option value={90}>Auto-expire after 90 days (1 Academic Semester)</option>
                  <option value={180}>Auto-expire after 180 days (1 Academic Year)</option>
                </select>
              </div>

              {/* Telemetry toggle */}
              <div className="pt-4 border-t border-void-800">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-white">Telemetry & AI Training Opt-Out</p>
                    <p className="text-xs text-void-400 mt-0.5">
                      When enabled, your anonymized study logs and interactions will never be used for continuous AI fine-tuning.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.telemetry_opt_out || false}
                    onChange={(e) => updateSetting({ telemetry_opt_out: e.target.checked })}
                    className="w-5 h-5 accent-neon-cyan cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Multi-format Data Export */}
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <Download className="w-4 h-4 text-neon-violet" />
                  Full Archive Data Export
                </h2>
                <p className="text-xs text-void-300 mt-0.5">
                  Download an offline backup of all your chats, revision notes, flashcards, quizzes, mind maps, and roadmaps.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  disabled={exportingJson}
                  className="flex items-center justify-between p-4 rounded-xl border border-void-800 bg-void-950/60 hover:border-void-700 hover:bg-void-950 transition-all text-left group"
                >
                  <div>
                    <span className="text-sm font-semibold text-white group-hover:text-neon-cyan transition-colors">
                      JSON Database Dump
                    </span>
                    <p className="text-xs text-void-400 mt-0.5">Complete structured database format for backups and imports.</p>
                  </div>
                  <Download className={`w-4 h-4 text-neon-cyan shrink-0 ml-2 ${exportingJson ? "animate-bounce" : ""}`} />
                </button>

                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  disabled={exportingMd}
                  className="flex items-center justify-between p-4 rounded-xl border border-void-800 bg-void-950/60 hover:border-void-700 hover:bg-void-950 transition-all text-left group"
                >
                  <div>
                    <span className="text-sm font-semibold text-white group-hover:text-neon-violet transition-colors">
                      Markdown Study Digest
                    </span>
                    <p className="text-xs text-void-400 mt-0.5">Formatted text report for Obsidian, Notion, or printing.</p>
                  </div>
                  <FileText className={`w-4 h-4 text-neon-violet shrink-0 ml-2 ${exportingMd ? "animate-bounce" : ""}`} />
                </button>
              </div>

              {exportError && (
                <p className="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-xl px-3.5 py-2.5">
                  {exportError}
                </p>
              )}
            </div>

            {/* Danger Zone: Hard Account Deletion */}
            <div className="rounded-2xl border border-neon-pink/30 bg-neon-pink/5 backdrop-blur-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-neon-pink" />
                <h2 className="text-white font-semibold text-base">Danger Zone: Permanent Account Deletion</h2>
              </div>
              <p className="text-xs text-void-300 leading-relaxed">
                Permanently deletes your account, personal data, and all study materials (chats, notes, flashcards, quizzes,
                mind maps, and roadmaps). This action cannot be reversed.
              </p>

              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl border border-neon-pink/50 text-neon-pink hover:bg-neon-pink/15 transition-colors font-medium"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete My Account Permanently
                </button>
              ) : (
                <form onSubmit={handleDeleteAccount} className="space-y-3 max-w-sm pt-2">
                  <label className="block text-xs text-void-200">
                    Confirm by entering your current account password:
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="w-full rounded-xl border border-neon-pink/40 bg-void-950 px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-neon-pink"
                    placeholder="Account password"
                  />
                  {deleteError && (
                    <p className="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-3 py-2">
                      {deleteError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={deleting}
                      className="text-xs px-4 py-2 rounded-xl bg-neon-pink text-void-950 font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Confirm Permanent Deletion"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword("");
                        setDeleteError(null);
                      }}
                      className="text-xs px-4 py-2 rounded-xl border border-void-700 text-void-300 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* TAB 5: APPEARANCE & EXPERIENCE */}
        {/* ------------------------------------------------------------- */}
        {tab === "appearance" && settings && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-void-700/60 bg-void-900/60 backdrop-blur-xl p-6 shadow-xl space-y-6">
              <div>
                <h2 className="text-white font-semibold text-base flex items-center gap-2">
                  <Palette className="w-4 h-4 text-neon-violet" />
                  Theme & Visual Luminescence
                </h2>
                <p className="text-xs text-void-300 mt-0.5">Personalize the platform interface contrast and animation speeds.</p>
              </div>

              {/* Theme Mode */}
              <div>
                <label className="block text-xs font-medium text-void-200 mb-2">Display Theme</label>
                <div className="grid grid-cols-2 gap-3 max-w-sm">
                  {[
                    { id: "dark", label: "Cosmic Dark (Default)", desc: "Deep space obsidian with neon accents" },
                    { id: "system", label: "System Sync", desc: "Matches operating system preferences" },
                  ].map((t) => {
                    const isSelected = settings.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => updateSetting({ theme: t.id })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "border-neon-cyan bg-neon-cyan/10 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                            : "border-void-800 bg-void-950/60 hover:border-void-700"
                        }`}
                      >
                        <p className={`text-xs font-semibold ${isSelected ? "text-white" : "text-void-300"}`}>{t.label}</p>
                        <p className="text-[11px] text-void-400 mt-0.5">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reduced Motion toggle */}
              <div className="pt-4 border-t border-void-800">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-white">Reduced Motion Mode</p>
                    <p className="text-xs text-void-400 mt-0.5">
                      Calms 3D background effects and eliminates rapid card transforms for accessibility.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={reducedMotion}
                    onChange={(e) => toggleReducedMotion(e.target.checked)}
                    className="w-5 h-5 accent-neon-cyan cursor-pointer"
                  />
                </label>
              </div>

              {/* Notification reminders */}
              <div className="pt-4 border-t border-void-800">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-white flex items-center gap-2">
                      <Bell className="w-4 h-4 text-neon-cyan" />
                      Study Reminders & Streak Nudges
                    </p>
                    <p className="text-xs text-void-400 mt-0.5">
                      Receive gentle alerts when your study streak is about to lapse or when quiz reviews are due.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.notifications_enabled}
                    onChange={(e) => updateSetting({ notifications_enabled: e.target.checked })}
                    className="w-5 h-5 accent-neon-cyan cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Floating Bottom Navigation Dock */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 z-40 bg-void-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl px-3 py-2 shadow-2xl flex items-center justify-around shadow-black/80">
        <Link
          to="/dashboard"
          className="flex flex-col items-center gap-1 min-w-[56px] py-1 text-void-300 hover:text-white transition-all active:scale-95"
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium font-mono">Home</span>
        </Link>

        <Link
          to="/chat"
          className="flex flex-col items-center gap-1 min-w-[56px] py-1 text-void-300 hover:text-white transition-all active:scale-95"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium font-mono">Chat</span>
        </Link>

        <Link
          to="/study"
          className="flex flex-col items-center gap-1 min-w-[56px] py-1 text-void-300 hover:text-white transition-all active:scale-95"
        >
          <Brain className="w-5 h-5" />
          <span className="text-[10px] font-medium font-mono">Study</span>
        </Link>

        <Link
          to="/roadmap/new"
          className="flex flex-col items-center gap-1 min-w-[56px] py-1 text-void-300 hover:text-white transition-all active:scale-95"
        >
          <Map className="w-5 h-5" />
          <span className="text-[10px] font-medium font-mono">Roadmap</span>
        </Link>
      </nav>
    </div>
  );
}
