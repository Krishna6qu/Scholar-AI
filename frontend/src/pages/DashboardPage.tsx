import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Brain,
  Plus,
  Sparkles,
  LogOut,
  LayoutDashboard,
  Settings,
  Map,
  Layers,
  Share2,
  UserX,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Activity,
  Compass,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import { TiltCard } from "@/components/TiltCard";
import { StreakEnergyCore } from "@/components/StreakEnergyCore";

const QUICK_ACTIONS = [
  {
    label: "AI Chat",
    desc: "Ask questions, explore deep academic concepts",
    icon: MessageSquare,
    to: "/chat",
    accent: "text-neon-violet",
    glow: "violet" as const,
    badge: "Chat",
    keyHint: "C",
  },
  {
    label: "Smart Quiz",
    desc: "AI practice tests with difficulty scaling",
    icon: Brain,
    to: "/study/quiz",
    accent: "text-neon-cyan",
    glow: "cyan" as const,
    badge: "Practice",
    keyHint: "Q",
  },
  {
    label: "Flashcards",
    desc: "Spaced repetition decks for fast memorization",
    icon: Layers,
    to: "/study/flashcards/new",
    accent: "text-neon-pink",
    glow: "pink" as const,
    badge: "Review",
    keyHint: "F",
  },
  {
    label: "Revision Notes",
    desc: "Dense, structured study summaries",
    icon: FileText,
    to: "/study/notes/new",
    accent: "text-neon-cyan",
    glow: "cyan" as const,
    badge: "Synthesize",
    keyHint: "N",
  },
  {
    label: "Mind Maps",
    desc: "Visual knowledge tree and topic breakdown",
    icon: Share2,
    to: "/study/mindmap/new",
    accent: "text-neon-lime",
    glow: "lime" as const,
    badge: "Explore",
    keyHint: "M",
  },
  {
    label: "Career Roadmap",
    desc: "Milestone learning path with progress tracking",
    icon: Map,
    to: "/roadmap/new",
    accent: "text-neon-violet",
    glow: "violet" as const,
    badge: "Plan",
    keyHint: "R",
  },
];

interface FeatureUsage {
  used: number;
  limit: number;
}
interface Usage {
  quiz: FeatureUsage;
  flashcards: FeatureUsage;
  mindmap: FeatureUsage;
  roadmap: FeatureUsage;
  note: FeatureUsage;
  resets_in_hours?: number;
  any_limit_reached?: boolean;
  limit_reached_features?: string[];
}
const USAGE_META = [
  { key: "quiz" as const, label: "Quizzes", icon: Brain, accent: "text-neon-violet", bar: "from-neon-violet to-neon-violet" },
  { key: "flashcards" as const, label: "Flashcards", icon: Layers, accent: "text-neon-cyan", bar: "from-neon-cyan to-neon-cyan" },
  { key: "mindmap" as const, label: "Mind Maps", icon: Share2, accent: "text-neon-pink", bar: "from-neon-pink to-neon-pink" },
  { key: "roadmap" as const, label: "Roadmaps", icon: Map, accent: "text-neon-lime", bar: "from-neon-lime to-neon-lime" },
  { key: "note" as const, label: "Revision Notes", icon: FileText, accent: "text-neon-cyan", bar: "from-neon-cyan to-neon-cyan" },
];

interface ChatSummary {
  id: string;
  title: string | null;
  updated_at: string;
}
interface QuizHistoryItem {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  score: number | null;
  percentage: number | null;
  completed_at: string | null;
}
interface FlashcardSummary {
  id: string;
  title: string;
  created_at: string;
  reviewed_at?: string | null;
  times_reviewed?: number;
}
interface MindMapSummary {
  id: string;
  title: string;
  created_at: string;
  viewed_at?: string | null;
}
interface RoadmapSummary {
  id: string;
  title: string;
  created_at: string;
  progress_percentage?: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [usage, setUsage] = useState<Usage | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  const [recentChats, setRecentChats] = useState<ChatSummary[]>([]);
  const [recentQuizResults, setRecentQuizResults] = useState<QuizHistoryItem[]>([]);
  const [recentFlashcards, setRecentFlashcards] = useState<FlashcardSummary[]>([]);
  const [recentMindMaps, setRecentMindMaps] = useState<MindMapSummary[]>([]);
  const [recentRoadmaps, setRecentRoadmaps] = useState<RoadmapSummary[]>([]);

  const [learningStats, setLearningStats] = useState<{ total_chats: number; total_quizzes: number; day_streak: number } | null>(null);
  const [learningStatsLoading, setLearningStatsLoading] = useState(true);

  const loadUsage = useCallback(() => {
    setUsageLoading(true);
    setUsageError(null);
    api
      .get("/auth/me/usage")
      .then(({ data }) => setUsage(data))
      .catch((err) => {
        console.error("Failed to load usage:", err);
        setUsageError(err.response?.data?.detail ?? "Could not load usage — check the console.");
      })
      .finally(() => setUsageLoading(false));
  }, []);

  function loadStats() {
    setLearningStatsLoading(true);
    api
      .get("/auth/me/stats")
      .then(({ data }) => setLearningStats(data))
      .catch((err) => console.error("Failed to load stats:", err))
      .finally(() => setLearningStatsLoading(false));
  }

  function loadActivity() {
    api.get("/chats").then(({ data }) => setRecentChats(data.slice(0, 4))).catch(() => {});
    api.get("/quizzes/history/recent").then(({ data }) => setRecentQuizResults(data)).catch(() => {});
    api.get("/flashcards").then(({ data }) => setRecentFlashcards(data.slice(0, 3))).catch(() => {});
    api.get("/mindmaps").then(({ data }) => setRecentMindMaps(data.slice(0, 3))).catch(() => {});
    api.get("/roadmaps").then(({ data }) => setRecentRoadmaps(data.slice(0, 3))).catch(() => {});
  }

  useEffect(() => {
    loadUsage();
    loadActivity();
    loadStats();

    function handleFocus() {
      loadUsage();
      loadActivity();
      loadStats();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadUsage]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const firstName = user?.full_name?.split(" ")[0] ?? "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Quick resume target: most recent chat or study pack
  const lastActiveChat = recentChats[0];

  return (
    <div className="min-h-screen bg-void-950/80 text-void-100 flex flex-col">
      {/* Mobile Top App Bar */}
      <header className="md:hidden sticky top-0 z-30 px-4 py-3 bg-void-950/85 backdrop-blur-xl border-b border-white/[0.08] flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center p-0.5 shadow-sm shadow-neon-violet/30">
            <div className="w-full h-full bg-void-950 rounded-full flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-neon-cyan" />
            </div>
          </div>
          <span className="font-display text-base tracking-tight text-white font-bold">
            Scholar<span className="text-gradient-neon">AI</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-void-300 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-violet/30 to-neon-cyan/30 border border-white/20 flex items-center justify-center text-xs font-bold text-white uppercase">
            {firstName[0]}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Modern Glass Sidebar (Desktop) */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/[0.08] h-screen sticky top-0 px-5 py-6 bg-void-950/90 backdrop-blur-xl z-20">
          <Link to="/" className="flex items-center gap-2 group mb-10 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center p-0.5 shadow-sm shadow-neon-violet/30 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-void-950 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-neon-cyan" />
              </div>
            </div>
            <span className="font-display text-lg tracking-tight text-white">
              Scholar<span className="text-gradient-neon font-bold">AI</span>
            </span>
          </Link>

          <nav className="space-y-1.5 text-xs font-medium">
            <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.08] text-white border border-white/10 shadow-sm">
              <LayoutDashboard className="w-4 h-4 text-neon-cyan" />
              <span>Dashboard</span>
            </div>
            <Link
              to="/chat"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              <MessageSquare className="w-4 h-4 text-neon-violet" />
              <span>AI Chat</span>
            </Link>
            <Link
              to="/study"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              <Brain className="w-4 h-4 text-neon-pink" />
              <span>Study Pack Hub</span>
            </Link>
            <Link
              to="/roadmap/new"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-white/[0.04] transition-all"
            >
              <Map className="w-4 h-4 text-neon-lime" />
              <span>Roadmap Builder</span>
            </Link>
          </nav>

          {/* User Profile Dock */}
          <div className="mt-auto pt-4 border-t border-white/[0.08] space-y-1">
            <div className="px-3 py-2 flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-violet/30 to-neon-cyan/30 border border-white/20 flex items-center justify-center text-xs font-bold text-white uppercase">
                {firstName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.full_name ?? "Student"}</p>
                <p className="text-[10px] text-neon-lime font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-lime animate-pulse" /> Active Session
                </p>
              </div>
            </div>

            <Link
              to="/settings"
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-void-300 hover:text-white hover:bg-white/[0.04] transition-colors text-xs font-medium"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-void-300 hover:text-white hover:bg-white/[0.04] transition-colors text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
            <Link
              to="/settings"
              state={{ openTab: "security" }}
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-neon-pink/70 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors text-xs font-medium"
            >
              <UserX className="w-3.5 h-3.5" />
              <span>Delete account</span>
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="relative flex-1 px-4 sm:px-6 md:px-10 py-6 md:py-8 pb-28 md:pb-8 max-w-6xl overflow-hidden">
          {/* Subtle Ambient Background Lighting */}
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-neon-violet/[0.04] blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -left-32 w-96 h-96 rounded-full bg-neon-cyan/[0.04] blur-3xl pointer-events-none" />

          {/* Section 1: Observatory Header */}
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-neon-cyan mb-2 backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-neon-cyan animate-pulse" />
                <span>CYBER-ACADEMIC OBSERVATORY</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight">
                {greeting}, {firstName}
              </h1>
              <p className="text-void-300 text-xs mt-1 font-mono">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>

            {/* Quick Resume CTA Button */}
            {lastActiveChat && (
              <Link
                to={`/chat/${lastActiveChat.id}`}
                className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl glass-modern border border-neon-cyan/30 hover:border-neon-cyan/60 transition-all group self-start md:self-auto shadow-sm shadow-neon-cyan/10"
              >
                <div className="w-7 h-7 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan group-hover:scale-110 transition-transform">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] uppercase font-mono tracking-wider text-neon-cyan font-semibold">Resume Study</p>
                  <p className="text-xs font-medium text-white max-w-[180px] truncate">{lastActiveChat.title || "Continue Conversation"}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-neon-cyan ml-1 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
          </div>

          {/* Section 2: Top Bento Grid (Streak Energy Core + Lifetime Intel) */}
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
            {/* Bento Col 1 & 2: Interactive Streak Energy Core */}
            <div className="lg:col-span-2">
              <StreakEnergyCore
                dayStreak={learningStats?.day_streak ?? 0}
                totalQuizzes={learningStats?.total_quizzes ?? 0}
                totalChats={learningStats?.total_chats ?? 0}
                loading={learningStatsLoading}
              />
            </div>

            {/* Bento Col 3: Lifetime Intelligence Tile */}
            <TiltCard glowColor="cyan" className="p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-void-300 font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-neon-cyan" />
                    Lifetime Intelligence
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan">
                    Verified
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-void-900/80 border border-white/[0.05]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neon-violet/10 border border-neon-violet/30 flex items-center justify-center text-neon-violet">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-void-200">Chat Sessions</span>
                    </div>
                    <span className="text-lg font-display font-bold text-white tabular-nums">
                      {learningStatsLoading ? "…" : learningStats?.total_chats ?? 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-void-900/80 border border-white/[0.05]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan">
                        <Brain className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-void-200">Quizzes Mastered</span>
                    </div>
                    <span className="text-lg font-display font-bold text-white tabular-nums">
                      {learningStatsLoading ? "…" : learningStats?.total_quizzes ?? 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-void-900/80 border border-white/[0.05]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neon-lime/10 border border-neon-lime/30 flex items-center justify-center text-neon-lime">
                        <Compass className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-void-200">Active Study Days</span>
                    </div>
                    <span className="text-lg font-display font-bold text-white tabular-nums">
                      {learningStatsLoading ? "…" : learningStats?.day_streak ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-void-300 font-mono">
                <span>Rhythm sync</span>
                <span className="text-neon-lime">Realtime</span>
              </div>
            </TiltCard>
          </div>

          {/* Section 3: Daily Quotas & Refresh Cycle Bento Tile */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-void-300 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-neon-cyan" />
                Daily Energy & Usage Quotas
              </h2>
              <button
                onClick={() => {
                  loadUsage();
                  loadActivity();
                  loadStats();
                }}
                className="flex items-center gap-1.5 text-xs text-void-400 hover:text-white transition-colors"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-3 h-3 ${usageLoading ? "animate-spin" : ""}`} />
                <span className="font-mono text-[11px]">Sync</span>
              </button>
            </div>

            {usageError && (
              <p className="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-xl px-3.5 py-2.5 mb-3 leading-relaxed">
                {usageError}
              </p>
            )}

            {/* Limit Reached Alert Banner */}
            {(() => {
              const reachedLabels = USAGE_META.filter((m) => {
                const u = usage?.[m.key];
                return u && u.used >= u.limit && u.limit > 0;
              }).map((m) => m.label);
              const hasReachedLimit = reachedLabels.length > 0;
              const resumeHours = usage?.resets_in_hours ?? 5;

              if (!hasReachedLimit) return null;

              return (
                <div className="mb-4 glass-modern rounded-2xl p-4 border border-neon-pink/50 bg-neon-pink/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-neon-pink/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-neon-pink/20 border border-neon-pink/30 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-4 h-4 text-neon-pink" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-white">
                        Daily capacity reached for {reachedLabels.join(", ")}
                      </p>
                      <p className="text-[11px] text-void-300 mt-0.5">
                        Counters automatically replenish after {resumeHours} hours at cycle reset.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-neon-pink px-3 py-1 rounded-full border border-neon-pink/30 bg-void-950/80 self-start sm:self-auto shrink-0">
                    Replenishes in {resumeHours}h
                  </span>
                </div>
              );
            })()}

            {/* Usage Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              {USAGE_META.map((m) => {
                const u = usage?.[m.key];
                const pct = u && u.limit > 0 ? Math.min((u.used / u.limit) * 100, 100) : 0;
                const atLimit = u ? u.used >= u.limit && u.limit > 0 : false;
                return (
                  <TiltCard
                    key={m.key}
                    glowColor={atLimit ? "pink" : "cyan"}
                    className={`p-4 transition-all ${atLimit ? "border-neon-pink/60 bg-neon-pink/5" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <m.icon className={`w-4 h-4 ${m.accent}`} />
                      <span className={`text-xs font-mono font-semibold ${atLimit ? "text-neon-pink" : "text-void-200"}`}>
                        {u ? `${u.used}/${u.limit}` : usageLoading ? "…" : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-void-200 mb-2 font-medium truncate">{m.label}</p>
                    <div className="w-full h-1.5 rounded-full bg-void-800 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${
                          atLimit ? "from-neon-pink to-neon-pink" : m.bar
                        } transition-all duration-500 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </TiltCard>
                );
              })}
            </div>
          </div>

          {/* Section 4: Study Tool Launcher Bento Tiles (6 Tools with 3D Tilt) */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-void-300 mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-neon-violet" />
              Academic Tool Launcher
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {QUICK_ACTIONS.map((a) => (
                <Link key={a.label} to={a.to} className="block group">
                  <TiltCard
                    glowColor={a.glow}
                    className="p-4 flex items-start gap-3.5 border-white/[0.08] group-hover:border-white/20 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform shadow-sm">
                      <a.icon className={`w-5 h-5 ${a.accent}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-white text-sm font-semibold group-hover:text-neon-cyan transition-colors truncate">
                          {a.label}
                        </p>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-void-300 opacity-60 group-hover:opacity-100 transition-opacity">
                          {a.keyHint}
                        </span>
                      </div>
                      <p className="text-void-300 text-xs leading-relaxed line-clamp-2">{a.desc}</p>
                    </div>
                  </TiltCard>
                </Link>
              ))}
            </div>
          </div>

          {/* Section 5: Activity & Knowledge Hub */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Recent Conversations */}
            <TiltCard glowColor="violet" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-neon-violet" />
                  Recent Conversations
                </h2>
                <Link to="/chat" title="New Chat" className="p-1 rounded-lg hover:bg-white/[0.05] transition-colors">
                  <Plus className="w-4 h-4 text-void-300 hover:text-white" />
                </Link>
              </div>

              {recentChats.length === 0 ? (
                <p className="text-xs text-void-300 py-6 text-center">No active chats yet — initiate your first discussion.</p>
              ) : (
                <div className="space-y-2">
                  {recentChats.map((c) => (
                    <Link
                      key={c.id}
                      to={`/chat/${c.id}`}
                      className="flex items-center justify-between text-xs font-medium text-void-200 hover:text-white bg-void-900/90 border border-white/[0.06] hover:border-neon-violet/40 rounded-xl px-3.5 py-2.5 transition-all group"
                    >
                      <span className="truncate group-hover:text-neon-cyan transition-colors">{c.title || "New chat"}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-void-400 group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                    </Link>
                  ))}
                </div>
              )}
            </TiltCard>

            {/* Recent Quiz Scores */}
            <TiltCard glowColor="cyan" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-sm flex items-center gap-2">
                  <Brain className="w-4 h-4 text-neon-cyan" />
                  Recent Quiz Mastery
                </h2>
                <Link to="/study/quiz" title="Create Quiz" className="p-1 rounded-lg hover:bg-white/[0.05] transition-colors">
                  <Sparkles className="w-4 h-4 text-void-300 hover:text-white" />
                </Link>
              </div>

              {recentQuizResults.length === 0 ? (
                <p className="text-xs text-void-300 py-6 text-center">No quiz attempts yet — test your knowledge!</p>
              ) : (
                <div className="space-y-2">
                  {recentQuizResults.map((r) => {
                    const pct = r.percentage != null ? Math.round(r.percentage) : null;
                    const badgeColor =
                      pct != null && pct >= 80
                        ? "text-neon-lime bg-neon-lime/10 border-neon-lime/30"
                        : pct != null && pct >= 60
                        ? "text-neon-cyan bg-neon-cyan/10 border-neon-cyan/30"
                        : "text-neon-pink bg-neon-pink/10 border-neon-pink/30";
                    return (
                      <Link
                        key={r.attempt_id}
                        to={`/study/quiz/${r.quiz_id}`}
                        className="flex items-center justify-between text-xs font-medium text-void-200 hover:text-white bg-void-900/90 border border-white/[0.06] hover:border-neon-cyan/40 rounded-xl px-3.5 py-2.5 transition-all group"
                      >
                        <span className="truncate group-hover:text-neon-cyan transition-colors">{r.quiz_title}</span>
                        {pct != null && (
                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${badgeColor} ml-2 shrink-0`}>
                            {pct}%
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </TiltCard>
          </div>

          {/* Section 6: Artifact Decks (Flashcards, Mind Maps, Roadmaps) */}
          <div className="grid md:grid-cols-3 gap-6">
            {/* Flashcard Decks */}
            <TiltCard glowColor="pink" className="p-6">
              <h2 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-neon-pink" /> Flashcard Sets
              </h2>
              {recentFlashcards.length === 0 ? (
                <p className="text-xs text-void-300 py-4 text-center">No active sets yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentFlashcards.map((f) => (
                    <Link
                      key={f.id}
                      to={`/study/flashcards/${f.id}`}
                      className="flex items-center justify-between text-xs font-medium text-void-200 hover:text-white bg-void-900/90 border border-white/[0.06] hover:border-neon-pink/40 rounded-xl px-3 py-2 transition-all"
                    >
                      <span className="truncate">{f.title}</span>
                      {f.reviewed_at && (
                        <span title="Deck reviewed" className="ml-2 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-neon-lime" />
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </TiltCard>

            {/* Mind Maps */}
            <TiltCard glowColor="lime" className="p-6">
              <h2 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-neon-lime" /> Mind Maps
              </h2>
              {recentMindMaps.length === 0 ? (
                <p className="text-xs text-void-300 py-4 text-center">No visual maps yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentMindMaps.map((m) => (
                    <Link
                      key={m.id}
                      to={`/study/mindmap/${m.id}`}
                      className="flex items-center justify-between text-xs font-medium text-void-200 hover:text-white bg-void-900/90 border border-white/[0.06] hover:border-neon-lime/40 rounded-xl px-3 py-2 transition-all"
                    >
                      <span className="truncate">{m.title}</span>
                      {m.viewed_at && (
                        <span title="Mind map viewed" className="ml-2 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5 text-neon-lime" />
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </TiltCard>

            {/* Roadmaps */}
            <TiltCard glowColor="cyan" className="p-6">
              <h2 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                <Map className="w-4 h-4 text-neon-cyan" /> Roadmaps
              </h2>
              {recentRoadmaps.length === 0 ? (
                <p className="text-xs text-void-300 py-4 text-center">No roadmaps created yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentRoadmaps.map((r) => (
                    <Link
                      key={r.id}
                      to={`/roadmap/${r.id}`}
                      className="flex items-center justify-between text-xs font-medium text-void-200 hover:text-white bg-void-900/90 border border-white/[0.06] hover:border-neon-cyan/40 rounded-xl px-3 py-2 transition-all"
                    >
                      <span className="truncate">{r.title}</span>
                      {r.progress_percentage != null && (
                        <span className="text-[10px] font-mono text-neon-cyan ml-2 shrink-0 font-semibold">
                          {Math.round(r.progress_percentage)}%
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </TiltCard>
          </div>
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation Dock */}
      <nav className="md:hidden fixed bottom-3 inset-x-3 z-40 bg-void-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl px-3 py-2 shadow-2xl flex items-center justify-around shadow-black/80">
        <Link
          to="/dashboard"
          className="flex flex-col items-center gap-1 min-w-[56px] py-1 text-neon-cyan transition-all active:scale-95"
        >
          <div className="relative">
            <LayoutDashboard className="w-5 h-5" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neon-cyan" />
          </div>
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
