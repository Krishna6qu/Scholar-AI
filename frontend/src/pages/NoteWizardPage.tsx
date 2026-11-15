import { useState, useEffect } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { FileText, Sparkles, ChevronLeft, AlertTriangle, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { DailyLimitModal } from "@/components/DailyLimitModal";
import { useUsageStore } from "@/store/useUsageStore";

export default function NoteWizardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const initialTopic = ((location.state as any)?.topic || searchParams.get("topic") || "").trim();

  const [topic, setTopic] = useState(initialTopic);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const usageData = useUsageStore((s) => s.usage);
  const fetchUsage = useUsageStore((s) => s.fetchUsage);
  const consumeEnergy = useUsageStore((s) => s.consumeEnergy);
  const usage = usageData?.note ?? null;

  useEffect(() => {
    if (initialTopic) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

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
      const { data } = await api.post("/notes", { topic });
      consumeEnergy("note");
      navigate(`/study/notes/${data.id}`);
    } catch (err: any) {
      if (err.response?.status === 429) {
        setShowLimitModal(true);
        setError(err.response?.data?.detail || "Daily limit is reached. Please wait 5 hours to use it again.");
      } else {
        const detail = err.response?.data?.detail;
        if (err.response?.status === 502 || err.message?.includes("502")) {
          setError("The server was warming up or reconnecting. Please tap 'Generate Notes' again.");
        } else {
          setError(typeof detail === "string" ? detail : "Could not generate notes. Try again.");
        }
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-void-950 flex items-center justify-center px-4 py-12 overflow-hidden selection:bg-neon-violet selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-neon-violet/15 blur-[120px] rounded-full pointer-events-none" />
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

          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-neon-violet/10 border border-neon-violet/30 flex items-center justify-center">
              <FileText className="w-5 h-5 text-neon-violet" />
            </div>
            {usage && (
              <span
                onClick={() => {
                  if (usage.used >= usage.limit) setShowLimitModal(true);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border ${
                  usage.used >= usage.limit
                    ? "bg-neon-pink/15 border-neon-pink/40 text-neon-pink font-bold cursor-pointer"
                    : "bg-void-900 border-white/10 text-void-300"
                }`}
              >
                <Zap className="w-3 h-3 text-neon-violet" />
                <span>
                  Quota: <strong className="text-white">{usage.used}/{usage.limit}</strong> Used
                </span>
              </span>
            )}
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">Generate revision notes</h1>
          <p className="text-void-300 text-sm mb-6 leading-relaxed">
            Dense, skimmable notes structured for last-minute revision — with core definitions, formulas, and high-yield bullet points.
          </p>

          {initialTopic && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-neon-violet/15 border border-neon-violet/40 text-neon-violet text-xs font-semibold mb-5 shadow-sm shadow-neon-violet/10">
              <Sparkles className="w-4 h-4 shrink-0 animate-pulse" />
              <span>Topic pre-filled: "{initialTopic}" — edit anytime or click Generate.</span>
            </div>
          )}

          <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 mb-2">
            Revision Topic
          </label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="e.g. Newton's three laws of motion with real-world examples"
            className="w-full rounded-xl border border-white/[0.08] bg-void-900/90 px-4 py-3 text-sm text-white placeholder-void-500 focus:outline-none focus:ring-2 focus:ring-neon-violet/50 focus:border-neon-violet/60 resize-none mb-6 transition-all"
          />

          {error && (
            <p className="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-xl px-3.5 py-2.5 mb-5 leading-relaxed">
              {error}
            </p>
          )}

          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || generating}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 py-3 font-semibold hover:opacity-95 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-neon-violet/20"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? "Synthesizing notes…" : "Generate Revision Notes"}
          </button>
        </div>
      </div>

      <DailyLimitModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        featureName="Revision Notes"
        used={usage?.used ?? 6}
        limit={usage?.limit ?? 6}
        resetsInHours={5}
      />
    </div>
  );
}
