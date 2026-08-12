import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Share2, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

export default function MindMapWizardPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/mindmaps", { topic });
      navigate(`/study/mindmap/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not generate the mind map. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-void-950 bg-neon-glow flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <Link to="/study" className="text-sm text-void-300 hover:text-white transition-colors mb-6 inline-block">
          ← Back to Study Pack
        </Link>
        <div className="glass rounded-2xl p-8">
          <Share2 className="w-6 h-6 text-neon-pink mb-4" />
          <h1 className="text-2xl text-white mb-2">Generate a mind map</h1>
          <p className="text-void-300 text-sm mb-6">
            A visual breakdown of a topic into its main branches and details.
          </p>

          <label className="block text-sm text-void-200 mb-1">Topic</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="e.g. The water cycle, or the French Revolution"
            className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-pink resize-none mb-6"
          />

          {error && (
            <p className="text-sm text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || generating}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 py-2.5 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? "Generating…" : "Generate mind map"}
          </button>
        </div>
      </div>
    </div>
  );
}
