import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { Layers, Sparkles, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";

const CARD_PRESETS = [5, 10, 15, 20, 30];

export default function FlashcardWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialTopic = ((location.state as any)?.topic || searchParams.get("topic") || "").trim();

  const [topic, setTopic] = useState(initialTopic);
  const [count, setCount] = useState(12);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialTopic) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/flashcards", { topic, count });
      navigate(`/study/flashcards/${data.id}`);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response?.data?.detail || "Daily limit reached for flashcards. Features resume after 5 hours.");
      } else {
        setError(err.response?.data?.detail ?? "Could not generate flashcards. Try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-void-950 flex items-center justify-center px-4 py-12 overflow-hidden selection:bg-neon-pink selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-neon-pink/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[300px] bg-neon-violet/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-lg">
        <Link
          to="/study"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-void-300 hover:text-white transition-colors mb-6 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Study Pack</span>
        </Link>

        <div className="glass-modern rounded-3xl p-8 border border-white/[0.08] shadow-2xl relative">
          <div className="w-10 h-10 rounded-xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center mb-4">
            <Layers className="w-5 h-5 text-neon-pink" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Generate flashcards</h1>
          <p className="text-void-300 text-sm mb-6 leading-relaxed">
            ScholarAI will generate focused question & answer flashcard pairs to test your active recall.
          </p>

          {initialTopic && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-xs font-medium mb-5 shadow-sm shadow-neon-pink/10">
              <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
              <span>Topic pre-filled from your AI Chat session — edit anytime or proceed.</span>
            </div>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 mb-2">
            Study Topic
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="e.g. Mitosis vs Meiosis stages, or AWS Core Services"
            className="w-full rounded-xl border border-white/[0.08] bg-void-900/90 px-4 py-3 text-sm text-white placeholder-void-500 focus:outline-none focus:ring-2 focus:ring-neon-pink/50 focus:border-neon-pink/60 resize-none mb-6 transition-all"
          />

          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-void-300">
              Deck Size
            </label>
            <span className="text-sm font-bold text-white font-mono">{count} cards</span>
          </div>

          {/* Quick count presets */}
          <div className="flex gap-2 mb-3">
            {CARD_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCount(preset)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  count === preset
                    ? "bg-neon-pink text-void-950 shadow-sm shadow-neon-pink/30"
                    : "bg-void-900 border border-void-700 text-void-300 hover:text-white hover:border-void-500"
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <input
            type="range"
            min={5}
            max={40}
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value))}
            className="w-full accent-neon-pink mb-6"
          />

          {error && (
            <p className="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-xl px-3.5 py-2.5 mb-5 leading-relaxed">
              {error}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || generating}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-pink to-neon-violet text-white py-3 font-semibold hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-neon-pink/20"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? "Crafting your deck…" : "Generate Flashcards"}
          </button>
        </div>
      </div>
    </div>
  );
}
