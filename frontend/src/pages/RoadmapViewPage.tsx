import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Download, CheckCircle2, Circle } from "lucide-react";
import { toCanvas } from "html-to-image";
import jsPDF from "jspdf";
import { api } from "@/lib/api";

interface Step {
  title: string;
  description: string;
  resources: string[];
  is_completed?: boolean;
}

interface Phase {
  order: number;
  title: string;
  duration_estimate: string;
  description: string;
  steps: Step[];
}

interface Roadmap {
  id: string;
  title: string;
  topic: string;
  progress_percentage: number;
  json_structure: { phases: Phase[] };
}

export default function RoadmapViewPage() {
  const { roadmapId } = useParams<{ roadmapId: string }>();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roadmapId) return;
    setError(null);
    api
      .get(`/roadmaps/${roadmapId}`)
      .then(({ data }) => setRoadmap(data))
      .catch((err) => {
        console.error("Failed to load roadmap:", err);
        setError(err.response?.data?.detail || "Could not load this roadmap.");
      });
  }, [roadmapId]);

  async function toggleStep(phaseIndex: number, stepIndex: number, isCompleted: boolean) {
    if (!roadmapId) return;
    const key = `${phaseIndex}:${stepIndex}`;
    setToggling(key);
    try {
      const { data } = await api.post(`/roadmaps/${roadmapId}/steps/toggle`, {
        phase_index: phaseIndex,
        step_index: stepIndex,
        is_completed: isCompleted,
      });
      setRoadmap(data);
    } catch (err) {
      console.error("Failed to toggle roadmap step:", err);
    } finally {
      setToggling(null);
    }
  }

  async function handleDownload() {
    if (!captureRef.current) return;
    setDownloading(true);
    try {
      const canvas = await toCanvas(captureRef.current, {
        backgroundColor: "#050507",
        pixelRatio: 2,
      });

      // One custom-sized page matching the full roadmap's dimensions —
      // avoids complex multi-page slicing while still producing a real,
      // scrollable PDF rather than a single flat image.
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "l" : "p",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${roadmap?.title?.replace(/\s+/g, "-").toLowerCase() || "roadmap"}.pdf`);
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <p className="text-neon-pink font-semibold mb-2">Roadmap Not Found</p>
          <p className="text-sm text-void-300 mb-6">{error}</p>
          <Link
            to="/dashboard"
            className="px-4 py-2 rounded-lg bg-void-800 border border-void-600 text-white hover:bg-void-700 text-sm inline-block"
          >
            ← Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center text-void-300">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin" />
          <span>Loading roadmap…</span>
        </div>
      </div>
    );
  }

  const phases = roadmap.json_structure.phases;

  return (
    <div className="min-h-screen bg-transparent px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link to="/dashboard" className="text-sm text-void-300 hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloading ? "Preparing PDF…" : "Download as PDF"}
          </button>
        </div>

        <div ref={captureRef} className="bg-void-950 p-6 rounded-2xl">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-lime mb-2">
            Career Roadmap
          </p>
          <h1 className="text-3xl text-white mb-1">{roadmap.title}</h1>
          <p className="text-void-300 text-sm mb-4">Path to becoming: {roadmap.topic}</p>

          <div className="mb-10">
            <div className="flex items-center justify-between text-xs text-void-300 mb-2">
              <span>Overall progress</span>
              <span className="text-neon-lime">{Math.round(roadmap.progress_percentage)}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-void-700 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-all"
                style={{ width: `${roadmap.progress_percentage}%` }}
              />
            </div>
          </div>

          <div className="relative pl-8">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-void-700" />
            {phases.map((phase, i) => (
              <div key={i} className="relative mb-10 last:mb-0">
                <div className="absolute -left-8 top-0 w-6 h-6 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan flex items-center justify-center text-void-950 text-xs font-bold">
                  {phase.order}
                </div>
                <div className="glass rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <h2 className="text-lg font-semibold text-white">{phase.title}</h2>
                    <span className="text-xs text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30 rounded-full px-2.5 py-1">
                      {phase.duration_estimate}
                    </span>
                  </div>
                  <p className="text-void-300 text-sm mb-4">{phase.description}</p>

                  <div className="space-y-3">
                    {phase.steps.map((step, j) => (
                      <div key={j} className="bg-void-900 border border-void-700 rounded-xl p-3.5">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStep(i, j, !step.is_completed)}
                            disabled={toggling === `${i}:${j}`}
                            className="mt-0.5 shrink-0 disabled:opacity-50"
                            aria-label={step.is_completed ? "Mark step incomplete" : "Mark step complete"}
                          >
                            {step.is_completed ? (
                              <CheckCircle2 className="w-4 h-4 text-neon-lime" />
                            ) : (
                              <Circle className="w-4 h-4 text-void-500 hover:text-neon-violet transition-colors" />
                            )}
                          </button>
                          <div className={step.is_completed ? "opacity-70" : ""}>
                            <p className={`text-white text-sm font-medium ${step.is_completed ? "line-through" : ""}`}>
                              {step.title}
                            </p>
                            <p className="text-void-300 text-xs mt-1 leading-relaxed">{step.description}</p>
                            {step.resources?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {step.resources.map((r, k) => (
                                  <span
                                    key={k}
                                    className="text-[11px] text-void-200 bg-void-800 border border-void-600 rounded-full px-2 py-0.5"
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
