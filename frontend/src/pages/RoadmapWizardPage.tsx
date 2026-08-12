import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Map, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

export default function RoadmapWizardPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/roadmaps", { topic });
      navigate(`/roadmap/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not generate the roadmap. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-void-950 bg-neon-glow flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <Link to="/dashboard" className="text-sm text-void-300 hover:text-white transition-colors mb-6 inline-block">
          ← Back to Dashboard
        </Link>
        <div className="glass rounded-2xl p-8">
          <Map className="w-6 h-6 text-neon-lime mb-4" />
          <h1 className="text-2xl text-white mb-2">Generate a career roadmap</h1>
          <p className="text-void-300 text-sm mb-6">
            Tell ScholarAI what you want to become — get a detailed, step-by-step path from
            beginner to job-ready, with resources for every step.
          </p>

          <label className="block text-sm text-void-200 mb-1">What do you want to become?</label>
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Data Scientist, Full-Stack Web Developer, UX Designer"
            className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-lime mb-6"
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
            {generating ? "Building your roadmap…" : "Generate roadmap"}
          </button>
          <p className="text-xs text-void-400 mt-3 text-center">
            This can take a bit longer than other tools — it's a detailed, multi-phase plan.
          </p>
        </div>
      </div>
    </div>
  );
}
