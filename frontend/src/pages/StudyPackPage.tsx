import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Brain,
  MessageSquare,
  LayoutDashboard,
  Settings,
  LogOut,
  FileText,
  Layers,
  Share2,
  Map,
  UserX,
  Plus,
  Search,
  CheckCircle2,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface FlashcardDeck {
  id: string;
  topic: string;
  card_count: number;
  reviewed_at: string | null;
  times_reviewed: number;
  created_at: string;
}

interface QuizItem {
  id: string;
  topic: string;
  question_count: number;
  difficulty: string;
  time_limit_mins: number;
  created_at: string;
}

interface NoteItem {
  id: string;
  title: string;
  word_count: number;
  created_at: string;
}

interface MindMapItem {
  id: string;
  title: string;
  viewed_at: string | null;
  created_at: string;
}

type LibraryTab = "all" | "flashcards" | "quizzes" | "notes" | "mindmaps";

export default function StudyPackPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const [activeTab, setActiveTab] = useState<LibraryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [flashcards, setFlashcards] = useState<FlashcardDeck[]>([]);
  const [quizzes, setQuizzes] = useState<QuizItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [mindmaps, setMindmaps] = useState<MindMapItem[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get("/flashcards"),
      api.get("/quizzes"),
      api.get("/notes"),
      api.get("/mindmaps"),
    ])
      .then(([fcRes, qzRes, ntRes, mmRes]) => {
        if (fcRes.status === "fulfilled") setFlashcards(fcRes.value.data || []);
        if (qzRes.status === "fulfilled") setQuizzes(qzRes.value.data || []);
        if (ntRes.status === "fulfilled") setNotes(ntRes.value.data || []);
        if (mmRes.status === "fulfilled") setMindmaps(mmRes.value.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // Filtered lists based on search
  const filteredFlashcards = useMemo(() => {
    if (!searchQuery.trim()) return flashcards;
    return flashcards.filter((f) => f.topic.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [flashcards, searchQuery]);

  const filteredQuizzes = useMemo(() => {
    if (!searchQuery.trim()) return quizzes;
    return quizzes.filter((q) => q.topic.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [quizzes, searchQuery]);

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    return notes.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [notes, searchQuery]);

  const filteredMindmaps = useMemo(() => {
    if (!searchQuery.trim()) return mindmaps;
    return mindmaps.filter((m) => m.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [mindmaps, searchQuery]);

  const totalItemsCount = flashcards.length + quizzes.length + notes.length + mindmaps.length;

  return (
    <div className="relative min-h-screen bg-void-950 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-void-700/60 h-screen sticky top-0 px-5 py-6 backdrop-blur-xl bg-void-950/70">
        <Link to="/" className="font-display text-lg tracking-tight text-white mb-10">
          Scholar<span className="text-gradient-neon">AI</span>
        </Link>
        <nav className="space-y-1 text-sm">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/chat"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Chat</span>
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-void-800 text-white font-medium">
            <Brain className="w-4 h-4 text-neon-cyan" />
            <span>Study Pack</span>
          </div>
          <Link
            to="/roadmap/new"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <Map className="w-4 h-4" />
            <span>Roadmap</span>
          </Link>
        </nav>
        <Link
          to="/settings"
          className="mt-auto flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm"
        >
          <Settings className="w-4 h-4" />
          <span>Profile & Settings</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Log out</span>
        </button>
        <Link
          to="/settings"
          state={{ openTab: "security" }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-neon-pink/70 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors text-sm"
        >
          <UserX className="w-4 h-4" />
          <span>Delete account</span>
        </Link>
      </aside>

      {/* Main Content */}
      <main className="flex-1 px-6 md:px-10 py-8 max-w-6xl">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-2">
          Study Pack Hub
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl text-white">Active Recall & Study Materials</h1>
            <p className="text-void-300 text-sm mt-1">
              Create and review custom flashcards, quizzes, revision notes, and mind maps.
            </p>
          </div>
        </div>

        {/* Top Creation Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <Link
            to="/study/quiz"
            className="group glass rounded-2xl p-5 border border-void-700/70 hover:border-neon-violet hover:shadow-neon-violet/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-3">
              <Brain className="w-6 h-6 text-neon-violet" />
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neon-violet/10 text-neon-violet border border-neon-violet/30">
                Practice
              </span>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">New Quiz</h3>
            <p className="text-void-300 text-xs leading-relaxed mb-4">
              Custom multi-format questions with answer explanations.
            </p>
            <div className="flex items-center gap-1 text-xs text-neon-cyan font-medium group-hover:translate-x-0.5 transition-transform">
              <span>Create Quiz</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/study/flashcards/new"
            className="group glass rounded-2xl p-5 border border-void-700/70 hover:border-neon-pink hover:shadow-neon-pink/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-3">
              <Layers className="w-6 h-6 text-neon-pink" />
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neon-pink/10 text-neon-pink border border-neon-pink/30">
                Spaced Recall
              </span>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">New Flashcards</h3>
            <p className="text-void-300 text-xs leading-relaxed mb-4">
              Interactive flip-card sets with completion tracking.
            </p>
            <div className="flex items-center gap-1 text-xs text-neon-cyan font-medium group-hover:translate-x-0.5 transition-transform">
              <span>Create Deck</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/study/notes/new"
            className="group glass rounded-2xl p-5 border border-void-700/70 hover:border-neon-cyan hover:shadow-neon-cyan/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-3">
              <FileText className="w-6 h-6 text-neon-cyan" />
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">
                Revision
              </span>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Short Notes</h3>
            <p className="text-void-300 text-xs leading-relaxed mb-4">
              High-yield skimmable notes from your lecture material.
            </p>
            <div className="flex items-center gap-1 text-xs text-neon-cyan font-medium group-hover:translate-x-0.5 transition-transform">
              <span>Generate Notes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/study/mindmap/new"
            className="group glass rounded-2xl p-5 border border-void-700/70 hover:border-neon-lime hover:shadow-neon-lime/20 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
          >
            <div className="flex items-center justify-between mb-3">
              <Share2 className="w-6 h-6 text-neon-lime" />
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neon-lime/10 text-neon-lime border border-neon-lime/30">
                Visual
              </span>
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Mind Map</h3>
            <p className="text-void-300 text-xs leading-relaxed mb-4">
              Interactive visual concept breakdown with dual layouts.
            </p>
            <div className="flex items-center gap-1 text-xs text-neon-cyan font-medium group-hover:translate-x-0.5 transition-transform">
              <span>Create Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* Study Materials Library Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-void-700/60 pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-void-900 border border-void-700 rounded-xl p-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              All ({totalItemsCount})
            </button>
            <button
              onClick={() => setActiveTab("flashcards")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "flashcards"
                  ? "bg-neon-pink/20 text-neon-pink border border-neon-pink/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              Flashcards ({flashcards.length})
            </button>
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "quizzes"
                  ? "bg-neon-violet/20 text-neon-violet border border-neon-violet/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              Quizzes ({quizzes.length})
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "notes"
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              Notes ({notes.length})
            </button>
            <button
              onClick={() => setActiveTab("mindmaps")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "mindmaps"
                  ? "bg-neon-lime/20 text-neon-lime border border-neon-lime/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              Mind Maps ({mindmaps.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-void-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search your library…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-void-700 bg-void-900 pl-8 pr-3 py-1.5 text-xs text-white placeholder-void-400 focus:outline-none focus:border-neon-cyan w-full sm:w-56"
            />
          </div>
        </div>

        {/* Library Content */}
        {loading ? (
          <div className="flex items-center justify-center h-48 text-void-300 text-xs">
            <Sparkles className="w-5 h-5 text-neon-cyan animate-spin mr-2" style={{ animationDuration: "3s" }} />
            <span>Loading study library…</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Flashcards Section */}
            {(activeTab === "all" || activeTab === "flashcards") && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-neon-pink" />
                    <h2 className="text-sm font-semibold text-white">Flashcard Decks</h2>
                  </div>
                  <Link to="/study/flashcards/new" className="text-xs text-neon-pink hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> New Deck
                  </Link>
                </div>

                {filteredFlashcards.length === 0 ? (
                  <p className="text-xs text-void-400 glass rounded-xl p-4">No flashcards found.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredFlashcards.map((fc) => (
                      <Link
                        key={fc.id}
                        to={`/study/flashcards/${fc.id}`}
                        className="glass rounded-xl p-4 border border-void-700/60 hover:border-neon-pink transition-all duration-200 hover:-translate-y-0.5 group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-medium text-white truncate group-hover:text-neon-pink transition-colors">
                            {fc.topic}
                          </h4>
                          {fc.reviewed_at && (
                            <span title="Reviewed" className="shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-neon-lime" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-void-300">
                          <span>{fc.card_count} cards</span>
                          <span>{fc.times_reviewed > 0 ? `Reviewed ${fc.times_reviewed}x` : "Unreviewed"}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quizzes Section */}
            {(activeTab === "all" || activeTab === "quizzes") && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-neon-violet" />
                    <h2 className="text-sm font-semibold text-white">Quizzes</h2>
                  </div>
                  <Link to="/study/quiz" className="text-xs text-neon-violet hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> New Quiz
                  </Link>
                </div>

                {filteredQuizzes.length === 0 ? (
                  <p className="text-xs text-void-400 glass rounded-xl p-4">No quizzes found.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredQuizzes.map((qz) => (
                      <Link
                        key={qz.id}
                        to={`/study/quiz/${qz.id}`}
                        className="glass rounded-xl p-4 border border-void-700/60 hover:border-neon-violet transition-all duration-200 hover:-translate-y-0.5 group"
                      >
                        <h4 className="text-sm font-medium text-white truncate group-hover:text-neon-violet transition-colors mb-2">
                          {qz.topic}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-void-300">
                          <span>{qz.question_count} questions</span>
                          <span className="capitalize px-1.5 py-0.5 rounded bg-void-800 text-[10px] font-mono">
                            {qz.difficulty}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Short Notes Section */}
            {(activeTab === "all" || activeTab === "notes") && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-neon-cyan" />
                    <h2 className="text-sm font-semibold text-white">Revision Notes</h2>
                  </div>
                  <Link to="/study/notes/new" className="text-xs text-neon-cyan hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> New Notes
                  </Link>
                </div>

                {filteredNotes.length === 0 ? (
                  <p className="text-xs text-void-400 glass rounded-xl p-4">No notes found.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredNotes.map((nt) => (
                      <Link
                        key={nt.id}
                        to={`/study/notes/${nt.id}`}
                        className="glass rounded-xl p-4 border border-void-700/60 hover:border-neon-cyan transition-all duration-200 hover:-translate-y-0.5 group"
                      >
                        <h4 className="text-sm font-medium text-white truncate group-hover:text-neon-cyan transition-colors mb-2">
                          {nt.title}
                        </h4>
                        <div className="flex items-center justify-between text-xs text-void-300">
                          <span>{nt.word_count} words</span>
                          <span>{new Date(nt.created_at).toLocaleDateString()}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mind Maps Section */}
            {(activeTab === "all" || activeTab === "mindmaps") && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-neon-lime" />
                    <h2 className="text-sm font-semibold text-white">Mind Maps</h2>
                  </div>
                  <Link to="/study/mindmap/new" className="text-xs text-neon-lime hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> New Map
                  </Link>
                </div>

                {filteredMindmaps.length === 0 ? (
                  <p className="text-xs text-void-400 glass rounded-xl p-4">No mind maps found.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredMindmaps.map((mm) => (
                      <Link
                        key={mm.id}
                        to={`/study/mindmap/${mm.id}`}
                        className="glass rounded-xl p-4 border border-void-700/60 hover:border-neon-lime transition-all duration-200 hover:-translate-y-0.5 group"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-medium text-white truncate group-hover:text-neon-lime transition-colors">
                            {mm.title}
                          </h4>
                          {mm.viewed_at && (
                            <span title="Viewed" className="shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5 text-neon-lime" />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-void-300">
                          <span>Interactive Visualizer</span>
                          <span>{new Date(mm.created_at).toLocaleDateString()}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
