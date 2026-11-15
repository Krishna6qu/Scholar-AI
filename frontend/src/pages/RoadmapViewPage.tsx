import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Download,
  CheckCircle2,
  Circle,
  MapPin,
  Clock,
  Sparkles,
  BookOpen,
  ArrowLeft,
} from "lucide-react";
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
  const [recentlyToggled, setRecentlyToggled] = useState<string | null>(null);
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
    setRecentlyToggled(key);
    setTimeout(() => setRecentlyToggled(null), 800);

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

  // Calculated stats
  const totalStats = useMemo(() => {
    if (!roadmap?.json_structure?.phases) return { totalSteps: 0, completedSteps: 0 };
    let total = 0;
    let completed = 0;
    roadmap.json_structure.phases.forEach((p) => {
      p.steps.forEach((s) => {
        total++;
        if (s.is_completed) completed++;
      });
    });
    return { totalSteps: total, completedSteps: completed };
  }, [roadmap]);

  if (error) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center px-4">
        <div className="glass-modern rounded-2xl p-8 max-w-md text-center border border-void-700 shadow-2xl">
          <p className="text-neon-pink font-semibold mb-2 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-neon-pink" /> Roadmap Unavailable
          </p>
          <p className="text-sm text-void-300 mb-6">{error}</p>
          <Link
            to="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-void-800 border border-void-600 text-white hover:bg-void-700 text-sm inline-flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center text-void-300">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Assembling Curriculum Pathway…</span>
        </div>
      </div>
    );
  }

  const phases = roadmap.json_structure.phases;
  const progressPercent = Math.round(roadmap.progress_percentage || 0);

  return (
    <div className="min-h-screen bg-void-950 text-void-100 px-3 sm:px-6 py-6 md:py-10">
      <div className="max-w-4xl mx-auto">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Link
            to="/dashboard"
            className="text-xs sm:text-sm text-void-300 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl border border-void-700/70 bg-void-900/60"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 text-xs sm:text-sm px-4 py-2.5 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-bold hover:opacity-95 transition-all shadow-glow-cyan/40 disabled:opacity-50 min-h-[40px]"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? "Generating PDF…" : "Download PDF"}</span>
            </button>
          </div>
        </div>

        {/* Capturable Roadmap Canvas */}
        <div ref={captureRef} className="glass-modern p-5 sm:p-8 rounded-3xl border border-void-700/80 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Background Gradient Orbs */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-neon-cyan/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-neon-violet/5 rounded-full blur-3xl pointer-events-none" />

          {/* Roadmap Header Meta */}
          <div className="relative z-10 mb-8 pb-6 border-b border-void-700/60">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
              <span className="font-mono text-[11px] tracking-[0.25em] uppercase text-neon-lime flex items-center gap-1.5 font-bold">
                <MapPin className="w-3.5 h-3.5" /> Career & Learning Roadmap
              </span>
              <span className="text-xs font-mono text-void-300 px-2.5 py-1 rounded-lg bg-void-900/80 border border-void-700">
                {totalStats.completedSteps} of {totalStats.totalSteps} Milestones Done
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
              {roadmap.title}
            </h1>
            <p className="text-void-300 text-xs sm:text-sm flex items-center gap-2">
              <span>Domain Specialty:</span>
              <span className="text-neon-cyan font-medium">{roadmap.topic}</span>
            </p>

            {/* Overall Progress Tracker Bar */}
            <div className="mt-5 bg-void-800/95 rounded-2xl p-4 sm:p-5 border border-void-600 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-200 mb-2">
                <span className="font-semibold text-white">Overall Curriculum Mastery</span>
                <span className="font-mono font-bold text-neon-lime text-sm">{progressPercent}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-void-900 overflow-hidden p-0.5 border border-void-600">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-neon-violet via-neon-cyan to-neon-lime transition-all duration-700 ease-out shadow-glow-cyan"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Vertical Neon Timeline Core */}
          <div className="relative pl-6 sm:pl-10">
            {/* Ambient Spine Line */}
            <div className="absolute left-[13px] sm:left-[19px] top-4 bottom-4 w-1 rounded-full bg-void-800/80" />

            {/* Glowing Active Track Line */}
            <div
              className="absolute left-[13px] sm:left-[19px] top-4 w-1 rounded-full bg-gradient-to-b from-neon-violet via-neon-cyan to-neon-lime transition-all duration-700"
              style={{
                height: `${progressPercent}%`,
                boxShadow: "0 0 12px rgba(34, 211, 238, 0.5)",
              }}
            />

            {/* Phases List */}
            {phases.map((phase, i) => {
              const phaseCompletedSteps = phase.steps.filter((s) => s.is_completed).length;
              const isPhaseFinished = phaseCompletedSteps === phase.steps.length && phase.steps.length > 0;

              return (
                <div key={i} className="relative mb-10 last:mb-2">
                  {/* Phase Order Numerical Orb */}
                  <div
                    className={`absolute -left-6 sm:-left-10 top-0 w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 ring-4 ring-void-950 ${
                      isPhaseFinished
                        ? "bg-neon-lime text-void-950 shadow-glow-lime"
                        : "bg-gradient-to-br from-neon-violet to-neon-cyan text-void-950 shadow-neon-violet"
                    }`}
                  >
                    {isPhaseFinished ? <CheckCircle2 className="w-4 h-4 text-void-950" /> : phase.order}
                  </div>

                  {/* Phase Card */}
                  <div className="glass-modern rounded-2xl p-5 sm:p-7 border border-void-600/90 hover:border-void-500 shadow-xl transition-all">
                    {/* Phase Header */}
                    <div className="flex items-start sm:items-center justify-between mb-2 flex-col sm:flex-row gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-md bg-void-800 text-white font-bold border border-void-600">
                            Phase {phase.order}
                          </span>
                          <h2 className="text-base sm:text-lg font-bold text-white">
                            {phase.title}
                          </h2>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-neon-cyan bg-neon-cyan/15 border border-neon-cyan/40 rounded-full px-2.5 py-1">
                          <Clock className="w-3 h-3" />
                          <span>{phase.duration_estimate}</span>
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-300">
                          {phaseCompletedSteps}/{phase.steps.length}
                        </span>
                      </div>
                    </div>

                    <p className="text-slate-200 text-xs sm:text-sm mb-5 leading-relaxed font-normal">
                      {phase.description}
                    </p>

                    {/* Steps Container */}
                    <div className="space-y-3">
                      {phase.steps.map((step, j) => {
                        const stepKey = `${i}:${j}`;
                        const isTogglingThis = toggling === stepKey;
                        const isJustToggled = recentlyToggled === stepKey;

                        return (
                          <div
                            key={j}
                            className={`rounded-2xl p-3.5 sm:p-4 border transition-all duration-300 shadow-md ${
                              step.is_completed
                                ? "bg-neon-lime/[0.08] border-neon-lime/40 shadow-[0_0_15px_-5px_rgba(163,230,53,0.2)]"
                                : "bg-void-800/90 border-void-600/90 hover:border-void-500 hover:bg-void-700/80"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Touch-Friendly 44px Checkbox Hit Area */}
                              <button
                                type="button"
                                onClick={() => toggleStep(i, j, !step.is_completed)}
                                disabled={isTogglingThis}
                                className="min-w-[36px] min-h-[36px] -ml-1 -mt-1 flex items-center justify-center rounded-xl hover:bg-void-700 active:scale-90 transition-transform shrink-0 disabled:opacity-50"
                                aria-label={step.is_completed ? "Mark step incomplete" : "Mark step complete"}
                              >
                                {isTogglingThis ? (
                                  <div className="w-5 h-5 rounded-full border-2 border-neon-cyan border-t-transparent animate-spin" />
                                ) : step.is_completed ? (
                                  <CheckCircle2
                                    className={`w-5 h-5 text-neon-lime transition-transform duration-300 ${
                                      isJustToggled ? "scale-125" : "scale-100"
                                    }`}
                                  />
                                ) : (
                                  <Circle className="w-5 h-5 text-slate-400 hover:text-neon-cyan transition-colors" />
                                )}
                              </button>

                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-xs sm:text-sm font-bold transition-all ${
                                    step.is_completed
                                      ? "text-slate-400 line-through decoration-neon-lime/60"
                                      : "text-white"
                                  }`}
                                >
                                  {step.title}
                                </p>

                                <p className="text-slate-200 text-xs sm:text-sm mt-1.5 leading-relaxed font-normal">
                                  {step.description}
                                </p>

                                {/* Resources Badges */}
                                {step.resources?.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2.5 border-t border-void-700">
                                    <span className="text-[10px] uppercase font-mono text-slate-300 mr-1 flex items-center gap-1 font-semibold">
                                      <BookOpen className="w-3 h-3 text-neon-cyan" /> Key Topics:
                                    </span>
                                    {step.resources.map((r, k) => (
                                      <span
                                        key={k}
                                        className="text-xs text-white font-medium bg-void-700 border border-void-500 rounded-lg px-2.5 py-1 hover:border-neon-cyan hover:text-neon-cyan transition-colors"
                                      >
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
