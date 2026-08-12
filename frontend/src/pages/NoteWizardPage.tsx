import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

export default function NoteWizardPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post("/notes", { topic });
      navigate(`/study/notes/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Could not generate notes. Try again.");
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
          <FileText className="w-6 h-6 text-neon-cyan mb-4" />
          <h1 className="text-2xl text-white mb-2">Generate revision notes</h1>
          <p className="text-void-300 text-sm mb-6">
            Dense, skimmable notes for last-minute revision — headings, bullets, and bolded key terms.
          </p>

          <label className="block text-sm text-void-200 mb-1">Topic</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={3}
            placeholder="e.g. Newton's three laws of motion with examples"
            className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-cyan resize-none mb-6"
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
            {generating ? "Generating…" : "Generate notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
