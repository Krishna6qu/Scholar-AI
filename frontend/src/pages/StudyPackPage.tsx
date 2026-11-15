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
  Trash2,
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

  async function handleDeleteFlashcard(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this flashcard deck? This cannot be undone.")) return;
    try {
      await api.delete(`/flashcards/${id}`);
      setFlashcards((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete flashcards:", err);
    }
  }

  async function handleDeleteQuiz(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this quiz? This cannot be undone.")) return;
    try {
      await api.delete(`/quizzes/${id}`);
      setQuizzes((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete quiz:", err);
    }
  }

  async function handleDeleteNote(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this note? This cannot be undone.")) return;
    try {
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  }

  async function handleDeleteMindMap(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this mind map? This cannot be undone.")) return;
    try {
      await api.delete(`/mindmaps/${id}`);
      setMindmaps((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete mind map:", err);
    }
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
    <div className="relative min-h-screen bg-void-950/80 text-void-100 flex flex-col md:flex-row">
      {/* Mobile Top Header Bar */}
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
        <div className="flex items-center gap-2">
          <Link
            to="/settings"
            className="p-2 rounded-xl text-void-300 hover:text-white bg-white/[0.04] border border-white/[0.08]"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-void-300 hover:text-white bg-white/[0.04] border border-white/[0.08]"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Modern Desktop Sidebar */}
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
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            <LayoutDashboard className="w-4 h-4 text-neon-cyan" />
            <span>Dashboard</span>
          </Link>
          <Link
            to="/chat"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            <MessageSquare className="w-4 h-4 text-neon-violet" />
            <span>AI Chat</span>
          </Link>
          <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-white/[0.08] text-white border border-white/10 shadow-sm">
            <Brain className="w-4 h-4 text-neon-pink" />
            <span>Study Pack Hub</span>
          </div>
          <Link
            to="/roadmap/new"
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-void-300 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            <Map className="w-4 h-4 text-neon-lime" />
            <span>Roadmap Builder</span>
          </Link>
        </nav>

        {/* User profile dock */}
        <div className="mt-auto pt-4 border-t border-white/[0.08] space-y-1">
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

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-6xl overflow-hidden pb-28 md:pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono text-neon-cyan mb-2">
          <Brain className="w-3 h-3 text-neon-cyan animate-pulse" />
          <span>STUDY PACK LIBRARY</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">Active Recall & Study Materials</h1>
            <p className="text-void-300 text-xs mt-1">
              Create, review, and organize custom flashcards, quizzes, revision notes, and mind maps.
            </p>
          </div>
        </div>

        {/* Top Creation Cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <Link
            to="/study/quiz"
            className="glass-modern glass-modern-hover rounded-3xl p-5 border border-white/[0.08] hover:border-neon-violet/50 hover:shadow-glow-violet transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-neon-violet/10 border border-neon-violet/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Brain className="w-5 h-5 text-neon-violet" />
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neon-violet/10 text-neon-violet border border-neon-violet/30">
                Practice
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1 group-hover:text-neon-cyan transition-colors">New Quiz</h3>
            <p className="text-void-300 text-xs leading-relaxed mb-4">
              Custom multi-format questions with explanations & timer.
            </p>
            <div className="flex items-center gap-1 text-xs text-neon-cyan font-medium group-hover:translate-x-1 transition-transform">
              <span>Create Quiz</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/study/flashcards/new"
            className="glass-modern glass-modern-hover rounded-3xl p-5 border border-white/[0.08] hover:border-neon-pink/50 hover:shadow-glow-pink transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5 text-neon-pink" />
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neon-pink/10 text-neon-pink border border-neon-pink/30">
                Spaced Recall
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1 group-hover:text-neon-pink transition-colors">3D Flashcards</h3>
            <p className="text-void-300 text-xs leading-relaxed mb-4">
              Interactive 3D flip-card sets with completion tracking.
            </p>
            <div className="flex items-center gap-1 text-xs text-neon-pink font-medium group-hover:translate-x-1 transition-transform">
              <span>Create Deck</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/study/notes/new"
            className="glass-modern glass-modern-hover rounded-3xl p-5 border border-white/[0.08] hover:border-neon-cyan/50 hover:shadow-glow-cyan transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5 text-neon-cyan" />
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30">
                Revision
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1 group-hover:text-neon-cyan transition-colors">Revision Notes</h3>
            <p className="text-void-300 text-xs leading-relaxed mb-4">
              High-yield skimmable notes from your lecture material.
            </p>
            <div className="flex items-center gap-1 text-xs text-neon-cyan font-medium group-hover:translate-x-1 transition-transform">
              <span>Generate Notes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/study/mindmap/new"
            className="glass-modern glass-modern-hover rounded-3xl p-5 border border-white/[0.08] hover:border-neon-lime/50 hover:shadow-glow-lime transition-all duration-300 group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-neon-lime/10 border border-neon-lime/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Share2 className="w-5 h-5 text-neon-lime" />
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neon-lime/10 text-neon-lime border border-neon-lime/30">
                Visual
              </span>
            </div>
            <h3 className="text-sm font-bold text-white mb-1 group-hover:text-neon-lime transition-colors">Mind Map</h3>
            <p className="text-void-300 text-xs leading-relaxed mb-4">
              Interactive concept breakdown with dual layout trees.
            </p>
            <div className="flex items-center gap-1 text-xs text-neon-lime font-medium group-hover:translate-x-1 transition-transform">
              <span>Create Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>

        {/* Study Materials Library Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/[0.08] pb-4">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-void-900/90 border border-white/[0.08] rounded-2xl p-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "all"
                  ? "bg-white/[0.1] text-white shadow-sm border border-white/10"
                  : "text-void-400 hover:text-white"
              }`}
            >
              All ({totalItemsCount})
            </button>
            <button
              onClick={() => setActiveTab("flashcards")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "flashcards"
                  ? "bg-neon-pink/20 text-neon-pink border border-neon-pink/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              Flashcards ({flashcards.length})
            </button>
            <button
              onClick={() => setActiveTab("quizzes")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "quizzes"
                  ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              Quizzes ({quizzes.length})
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "notes"
                  ? "bg-neon-violet/20 text-neon-violet border border-neon-violet/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              Notes ({notes.length})
            </button>
            <button
              onClick={() => setActiveTab("mindmaps")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
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
            <Search className="w-3.5 h-3.5 text-void-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search your library…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-white/[0.08] bg-void-900/90 pl-9 pr-3 py-2 text-xs text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan w-full sm:w-60 transition-all"
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
                  <p className="text-xs text-void-400 glass-modern rounded-2xl p-6 text-center">No flashcards found.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredFlashcards.map((fc) => (
                      <Link
                        key={fc.id}
                        to={`/study/flashcards/${fc.id}`}
                        className="glass-modern rounded-2xl p-4 border border-white/[0.08] hover:border-neon-pink/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow-pink group block"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-white truncate group-hover:text-neon-pink transition-colors">
                            {fc.topic}
                          </h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {fc.reviewed_at && (
                              <span title="Reviewed">
                                <CheckCircle2 className="w-3.5 h-3.5 text-neon-lime" />
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteFlashcard(e, fc.id)}
                              title="Delete deck"
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-neon-pink/20 text-void-400 hover:text-neon-pink transition-all active:scale-90"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-void-400 pt-2 border-t border-white/[0.04]">
                          <span className="font-medium text-void-300">{fc.card_count} cards</span>
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
                  <p className="text-xs text-void-400 glass-modern rounded-2xl p-6 text-center">No quizzes found.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredQuizzes.map((qz) => (
                      <Link
                        key={qz.id}
                        to={`/study/quiz/${qz.id}`}
                        className="glass-modern rounded-2xl p-4 border border-white/[0.08] hover:border-neon-violet/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow-violet group block"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-white truncate group-hover:text-neon-violet transition-colors">
                            {qz.topic}
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteQuiz(e, qz.id)}
                            title="Delete quiz"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-neon-pink/20 text-void-400 hover:text-neon-pink transition-all shrink-0 active:scale-90"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-void-400 pt-2 border-t border-white/[0.04]">
                          <span className="font-medium text-void-300">{qz.question_count} questions</span>
                          <span className="capitalize px-2 py-0.5 rounded-md bg-void-800/80 border border-white/[0.05] text-[10px] font-mono text-neon-violet">
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
                  <p className="text-xs text-void-400 glass-modern rounded-2xl p-6 text-center">No notes found.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredNotes.map((nt) => (
                      <Link
                        key={nt.id}
                        to={`/study/notes/${nt.id}`}
                        className="glass-modern rounded-2xl p-4 border border-white/[0.08] hover:border-neon-cyan/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow-cyan group block"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-white truncate group-hover:text-neon-cyan transition-colors">
                            {nt.title}
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNote(e, nt.id)}
                            title="Delete note"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-neon-pink/20 text-void-400 hover:text-neon-pink transition-all shrink-0 active:scale-90"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-void-400 pt-2 border-t border-white/[0.04]">
                          <span className="font-medium text-void-300">{nt.word_count} words</span>
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
                  <p className="text-xs text-void-400 glass-modern rounded-2xl p-6 text-center">No mind maps found.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredMindmaps.map((mm) => (
                      <Link
                        key={mm.id}
                        to={`/study/mindmap/${mm.id}`}
                        className="glass-modern rounded-2xl p-4 border border-white/[0.08] hover:border-neon-lime/40 transition-all duration-200 hover:-translate-y-1 hover:shadow-glow-lime group block"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="text-sm font-semibold text-white truncate group-hover:text-neon-lime transition-colors">
                            {mm.title}
                          </h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {mm.viewed_at && (
                              <span title="Viewed">
                                <CheckCircle2 className="w-3.5 h-3.5 text-neon-lime" />
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteMindMap(e, mm.id)}
                              title="Delete map"
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-neon-pink/20 text-void-400 hover:text-neon-pink transition-all active:scale-90"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-void-400 pt-2 border-t border-white/[0.04]">
                          <span className="font-medium text-neon-lime/90">Interactive Visualizer</span>
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
          className="flex flex-col items-center gap-1 min-w-[56px] py-1 text-neon-pink transition-all active:scale-95"
        >
          <div className="relative">
            <Brain className="w-5 h-5" />
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-neon-pink" />
          </div>
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
