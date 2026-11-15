import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { Share2, Sparkles, ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";

export default function MindMapWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialTopic = ((location.state as any)?.topic || searchParams.get("topic") || "").trim();

  const [topic, setTopic] = useState(initialTopic);
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
      const { data } = await api.post("/mindmaps", { topic });
      navigate(`/study/mindmap/${data.id}`);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError(err.response?.data?.detail || "Daily limit reached for mind maps. Features resume after 5 hours.");
      } else {
        setError(err.response?.data?.detail ?? "Could not generate the mind map. Try again.");
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-void-950 flex items-center justify-center px-4 py-12 overflow-hidden selection:bg-neon-lime selection:text-void-950">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-neon-lime/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[300px] bg-neon-cyan/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-lg">
        <Link
          to="/study"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-void-300 hover:text-white transition-colors mb-6 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Study Pack</span>
        </Link>

        <div className="glass-modern rounded-3xl p-8 border border-white/[0.08] shadow-2xl relative">
          <div className="w-10 h-10 rounded-xl bg-neon-lime/10 border border-neon-lime/30 flex items-center justify-center mb-4">
            <Share2 className="w-5 h-5 text-neon-lime" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Generate a mind map</h1>
          <p className="text-void-300 text-sm mb-6 leading-relaxed">
            ScholarAI generates a hierarchical visual tree of core concepts, sub-branches, and key facts.
          </p>

          {initialTopic && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-neon-lime/15 border border-neon-lime/40 text-neon-lime text-xs font-semibold mb-5 shadow-sm shadow-neon-lime/10">
              <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
              <span>Topic pre-filled: "{initialTopic}" — edit anytime or click Generate.</span>
            </div>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 mb-2">
            Central Subject / Topic
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="e.g. The human nervous system, or The French Revolution timeline"
            className="w-full rounded-xl border border-white/[0.08] bg-void-900/90 px-4 py-3 text-sm text-white placeholder-void-500 focus:outline-none focus:ring-2 focus:ring-neon-lime/50 focus:border-neon-lime/60 resize-none mb-6 transition-all"
          />

          {error && (
            <p className="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-xl px-3.5 py-2.5 mb-5 leading-relaxed">
              {error}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || generating}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-lime to-neon-cyan text-void-950 py-3 font-semibold hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-neon-lime/20"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? "Mapping knowledge hierarchy…" : "Generate Mind Map"}
          </button>
        </div>
      </div>
    </div>
  );
}
