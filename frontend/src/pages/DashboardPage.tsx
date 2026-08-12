import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Brain,
  Flame,
  Plus,
  Sparkles,
  Bell,
  LogOut,
  LayoutDashboard,
  Settings,
  Map,
  Layers,
  Share2,
  UserX,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";

const STATS = [
  { label: "Chats", value: 0, icon: MessageSquare, accent: "text-neon-violet" },
  { label: "Files uploaded", value: 0, icon: FileText, accent: "text-neon-cyan" },
  { label: "Day streak", value: 0, icon: Flame, accent: "text-neon-lime" },
];

const QUICK_ACTIONS = [
  { label: "New Chat", desc: "Start a conversation on any topic", icon: MessageSquare, to: "/chat", accent: "text-neon-violet" },
  { label: "Quiz", desc: "Custom quiz — topic, type, difficulty, time", icon: Brain, to: "/study/quiz", accent: "text-neon-violet" },
  { label: "Flashcards", desc: "Flip-card set for quick review", icon: Layers, to: "/study/flashcards/new", accent: "text-neon-cyan" },
  { label: "Short Notes", desc: "Dense, skimmable revision notes", icon: FileText, to: "/study/notes/new", accent: "text-neon-cyan" },
  { label: "Mind Map", desc: "Visual, clickable breakdown of a topic", icon: Share2, to: "/study/mindmap/new", accent: "text-neon-pink" },
  { label: "Roadmap", desc: "Step-by-step career/learning plan", icon: Map, to: "/roadmap/new", accent: "text-neon-lime" },
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
}
const USAGE_META = [
  { key: "quiz" as const, label: "Quizzes", icon: Brain, accent: "text-neon-violet", bar: "from-neon-violet to-neon-violet" },
  { key: "flashcards" as const, label: "Flashcards", icon: Layers, accent: "text-neon-cyan", bar: "from-neon-cyan to-neon-cyan" },
  { key: "mindmap" as const, label: "Mind Maps", icon: Share2, accent: "text-neon-pink", bar: "from-neon-pink to-neon-pink" },
  { key: "roadmap" as const, label: "Roadmaps", icon: Map, accent: "text-neon-lime", bar: "from-neon-lime to-neon-lime" },
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
}
interface MindMapSummary {
  id: string;
  title: string;
  created_at: string;
}
interface RoadmapSummary {
  id: string;
  title: string;
  created_at: string;
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

    // Refetch usage whenever the tab regains focus — catches the case where
    // you generated something in another tab/window and came back here.
    function handleFocus() {
      loadUsage();
      loadActivity();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadUsage]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="min-h-screen bg-void-950">
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-void-700/60 h-screen sticky top-0 px-5 py-6">
          <Link to="/" className="font-display text-lg tracking-tight text-white mb-10">
            Scholar<span className="text-gradient-neon">AI</span>
          </Link>
          <nav className="space-y-1 text-sm">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-void-800 text-white">
              <LayoutDashboard className="w-4 h-4 text-neon-cyan" />
              Dashboard
            </div>
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
          <Link
            to="/settings"
            className="mt-auto flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm"
          >
            <Settings className="w-4 h-4" />
            Profile & Settings
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
          <Link
            to="/settings"
            state={{ openTab: "security" }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-neon-pink/70 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors text-sm"
          >
            <UserX className="w-4 h-4" />
            Delete account
          </Link>
        </aside>

        {/* Main content */}
        <main className="flex-1 px-6 md:px-10 py-8 max-w-5xl">
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-2">
                Dashboard
              </p>
              <h1 className="text-3xl text-white">Welcome back, {firstName}</h1>
              <p className="text-void-300 text-sm mt-1">
                {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
            <button className="relative w-10 h-10 rounded-full glass flex items-center justify-center text-void-200 hover:text-white transition-colors">
              <Bell className="w-4 h-4" />
            </button>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {STATS.map((s) => (
              <div key={s.label} className="glass rounded-xl p-4">
                <s.icon className={`w-5 h-5 mb-3 ${s.accent}`} />
                <p className="text-2xl font-display text-white">{s.value}</p>
                <p className="text-xs text-void-300 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Today's usage / limits */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-void-200">Today's usage</h2>
              <button
                onClick={() => { loadUsage(); loadActivity(); }}
                className="flex items-center gap-1.5 text-xs text-void-400 hover:text-white transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${usageLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
            {usageError && (
              <p className="text-sm text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-3 py-2 mb-3">
                {usageError}
              </p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {USAGE_META.map((m) => {
                const u = usage?.[m.key];
                const pct = u && u.limit > 0 ? Math.min((u.used / u.limit) * 100, 100) : 0;
                const atLimit = u ? u.used >= u.limit && u.limit > 0 : false;
                return (
                  <div key={m.key} className="glass rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <m.icon className={`w-4 h-4 ${m.accent}`} />
                      <span className={`text-xs ${atLimit ? "text-neon-pink" : "text-void-300"}`}>
                        {u ? `${u.used}/${u.limit}` : usageLoading ? "…" : "—"}
                      </span>
                    </div>
                    <p className="text-xs text-void-300 mb-2">{m.label}</p>
                    <div className="w-full h-1.5 rounded-full bg-void-700 overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${m.bar} transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions — all 6 tools */}
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-void-200 mb-3">Quick actions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="flex items-start gap-3 rounded-xl border border-void-700 bg-void-900 p-4 hover:border-neon-violet transition-colors"
                >
                  <a.icon className={`w-5 h-5 mt-0.5 shrink-0 ${a.accent}`} />
                  <div>
                    <p className="text-white text-sm font-medium">{a.label}</p>
                    <p className="text-void-400 text-xs mt-0.5">{a.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Recent chats */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Recent chats</h2>
                <Link to="/chat"><Plus className="w-4 h-4 text-void-300 hover:text-white transition-colors" /></Link>
              </div>
              {recentChats.length === 0 ? (
                <p className="text-sm text-void-300">No chats yet — start your first conversation.</p>
              ) : (
                <div className="space-y-2">
                  {recentChats.map((c) => (
                    <Link
                      key={c.id}
                      to={`/chat/${c.id}`}
                      className="block truncate text-sm text-void-200 hover:text-white bg-void-900 border border-void-700 rounded-lg px-3 py-2 transition-colors"
                    >
                      {c.title || "New chat"}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Real quiz results */}
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Recent quiz results</h2>
                <Link to="/study/quiz"><Sparkles className="w-4 h-4 text-void-300 hover:text-white transition-colors" /></Link>
              </div>
              {recentQuizResults.length === 0 ? (
                <p className="text-sm text-void-300">No completed quizzes yet — take one to see your score here.</p>
              ) : (
                <div className="space-y-2">
                  {recentQuizResults.map((r) => (
                    <Link
                      key={r.attempt_id}
                      to={`/study/quiz/${r.quiz_id}`}
                      className="flex items-center justify-between text-sm text-void-200 hover:text-white bg-void-900 border border-void-700 rounded-lg px-3 py-2 transition-colors"
                    >
                      <span className="truncate">{r.quiz_title}</span>
                      {r.percentage != null && (
                        <span className="text-xs text-neon-lime ml-2 shrink-0">{Math.round(r.percentage)}%</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Recent flashcards */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-neon-cyan" /> Flashcards
              </h2>
              {recentFlashcards.length === 0 ? (
                <p className="text-sm text-void-300">None yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentFlashcards.map((f) => (
                    <Link key={f.id} to={`/study/flashcards/${f.id}`} className="block truncate text-sm text-void-200 hover:text-white bg-void-900 border border-void-700 rounded-lg px-3 py-2 transition-colors">
                      {f.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent mind maps */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-neon-pink" /> Mind Maps
              </h2>
              {recentMindMaps.length === 0 ? (
                <p className="text-sm text-void-300">None yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentMindMaps.map((m) => (
                    <Link key={m.id} to={`/study/mindmap/${m.id}`} className="block truncate text-sm text-void-200 hover:text-white bg-void-900 border border-void-700 rounded-lg px-3 py-2 transition-colors">
                      {m.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Recent roadmaps */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Map className="w-4 h-4 text-neon-lime" /> Roadmaps
              </h2>
              {recentRoadmaps.length === 0 ? (
                <p className="text-sm text-void-300">None yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentRoadmaps.map((r) => (
                    <Link key={r.id} to={`/roadmap/${r.id}`} className="block truncate text-sm text-void-200 hover:text-white bg-void-900 border border-void-700 rounded-lg px-3 py-2 transition-colors">
                      {r.title}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
