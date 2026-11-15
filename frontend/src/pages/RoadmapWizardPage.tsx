import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Map, Sparkles, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { DailyLimitModal } from "@/components/DailyLimitModal";

export default function RoadmapWizardPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    api.get("/auth/me/usage")
      .then(({ data }) => {
        if (data?.roadmap) setUsage(data.roadmap);
      })
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!topic.trim()) return;
    if (usage && usage.used >= usage.limit) {
      setShowLimitModal(true);
      setError("Daily limit is reached. Please wait 5 hours to use it again.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/roadmaps", { topic });
      navigate(`/roadmap/${data.id}`);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setShowLimitModal(true);
        setError(err.response?.data?.detail || "Daily limit is reached. Please wait 5 hours to use it again.");
      } else {
        const detail = err.response?.data?.detail;
        if (err.response?.status === 502 || err.message?.includes("502")) {
          setError("The server was warming up or reconnecting. Please tap 'Generate Roadmap' again.");
        } else {
          setError(typeof detail === "string" ? detail : "Could not generate the roadmap. Try again.");
        }
      }
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
          {usage && usage.used >= usage.limit && (
            <div
              onClick={() => setShowLimitModal(true)}
              className="flex items-center justify-between mb-4 px-3.5 py-2.5 rounded-2xl bg-neon-pink/10 border border-neon-pink/40 text-xs text-neon-pink cursor-pointer hover:bg-neon-pink/15 transition-all shadow-sm shadow-neon-pink/10"
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Daily limit is reached ({usage.used}/{usage.limit}). Wait 5 hours to use it again.</span>
              </span>
              <span className="underline font-mono text-[10px] font-bold">Details</span>
            </div>
          )}

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
            <div className="bg-neon-pink/10 border border-neon-pink/30 rounded-xl p-4 mb-4">
              <p className="text-sm text-neon-pink font-medium">{error}</p>
              {error.includes("limit") && (
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-neon-pink/20">
                  <span className="text-xs text-void-300">Features resume after 5 hours</span>
                  <Link
                    to="/dashboard"
                    className="text-xs px-3 py-1.5 rounded-lg bg-void-800 text-neon-cyan hover:bg-void-700 transition-colors font-medium border border-void-700"
                  >
                    View saved roadmaps →
                  </Link>
                </div>
              )}
            </div>
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

      <DailyLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        featureName="Career Roadmaps"
        used={usage?.used ?? 6}
        limit={usage?.limit ?? 6}
        resetsInHours={5}
      />
    </div>
  );
}
