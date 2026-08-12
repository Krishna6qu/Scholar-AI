import { Link, useNavigate } from "react-router-dom";
import { Brain, MessageSquare, LayoutDashboard, Settings, LogOut, FileText, Layers, Share2, Map, UserX } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export default function StudyPackPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-void-950 flex">
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
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-void-800 text-white">
            <Brain className="w-4 h-4 text-neon-cyan" />
            Study Pack
          </div>
          <Link to="/roadmap/new" className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors">
            <Map className="w-4 h-4" />
            Roadmap
          </Link>
        </nav>
        <Link to="/settings" className="mt-auto flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm">
          <Settings className="w-4 h-4" />
          Profile & Settings
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm">
          <LogOut className="w-4 h-4" />
          Log out
        </button>
        <Link to="/settings" state={{ openTab: "security" }} className="flex items-center gap-3 px-3 py-2 rounded-lg text-neon-pink/70 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors text-sm">
          <UserX className="w-4 h-4" />
          Delete account
        </Link>
      </aside>

      <main className="flex-1 px-6 md:px-10 py-8 max-w-5xl">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-2">Study Pack</p>
        <h1 className="text-3xl text-white mb-8">Turn learning into practice</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link to="/study/quiz" className="group glass rounded-2xl p-6 hover:shadow-neon-violet transition-shadow">
            <Brain className="w-6 h-6 mb-4 text-neon-violet" />
            <h3 className="text-lg font-semibold text-white mb-2">Quiz</h3>
            <p className="text-void-300 text-sm leading-relaxed mb-4">
              Custom quiz — pick topic, question types, difficulty, and time limit.
            </p>
            <span className="text-xs text-neon-cyan font-medium">Create a quiz →</span>
          </Link>

          <Link to="/study/flashcards/new" className="group glass rounded-2xl p-6 hover:shadow-neon-violet transition-shadow">
            <Layers className="w-6 h-6 mb-4 text-neon-violet" />
            <h3 className="text-lg font-semibold text-white mb-2">Flashcards</h3>
            <p className="text-void-300 text-sm leading-relaxed mb-4">
              Turn any topic into a flip-card set for quick review.
            </p>
            <span className="text-xs text-neon-cyan font-medium">Create flashcards →</span>
          </Link>

          <Link to="/study/notes/new" className="group glass rounded-2xl p-6 hover:shadow-neon-cyan transition-shadow">
            <FileText className="w-6 h-6 mb-4 text-neon-cyan" />
            <h3 className="text-lg font-semibold text-white mb-2">Short Notes</h3>
            <p className="text-void-300 text-sm leading-relaxed mb-4">
              Dense, skimmable revision notes for any topic.
            </p>
            <span className="text-xs text-neon-cyan font-medium">Generate notes →</span>
          </Link>

          <Link to="/study/mindmap/new" className="group glass rounded-2xl p-6 hover:shadow-neon-cyan transition-shadow">
            <Share2 className="w-6 h-6 mb-4 text-neon-pink" />
            <h3 className="text-lg font-semibold text-white mb-2">Mind Maps</h3>
            <p className="text-void-300 text-sm leading-relaxed mb-4">
              Visualize how a topic branches into its key concepts.
            </p>
            <span className="text-xs text-neon-cyan font-medium">Create a mind map →</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
