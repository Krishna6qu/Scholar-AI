import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Sparkles, Lightbulb } from "lucide-react";
import { api } from "@/lib/api";

type QType = "mcq" | "true_false" | "short_answer";
type FullType = QType | "mix";
type Difficulty = "easy" | "medium" | "hard" | "interview_hard";

const TYPE_LABELS: Record<QType, string> = {
  mcq: "Multiple Choice",
  true_false: "True / False",
  short_answer: "Short Answer",
};

const DIFFICULTY_OPTIONS: { id: Difficulty; label: string; desc: string }[] = [
  { id: "easy", label: "Easy", desc: "Basic recall and understanding" },
  { id: "medium", label: "Medium", desc: "Applying concepts" },
  { id: "hard", label: "Hard", desc: "Deeper analysis & reasoning" },
  { id: "interview_hard", label: "Interview Hard", desc: "Expert-level, probing questions" },
];

export default function QuizWizardPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [questionType, setQuestionType] = useState<FullType | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [mixTypes, setMixTypes] = useState<QType[]>([]);
  const [mixCounts, setMixCounts] = useState<Record<string, number>>({});
  const [timeLimit, setTimeLimit] = useState(15);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [hintsEnabled, setHintsEnabled] = useState<boolean | null>(null);

  const isMix = questionType === "mix";
  const mixCountSum = mixTypes.reduce((sum, t) => sum + (mixCounts[t] || 0), 0);

  function toggleMixType(t: QType) {
    setMixTypes((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 3) return prev; // cap at 3
      return [...prev, t];
    });
  }

  // Step definitions — each returns whether the step is currently valid to proceed
  const steps = [
    { title: "What's this quiz about?", valid: topic.trim().length > 0 },
    { title: "Choose a question type", valid: questionType !== null },
    { title: "How many questions?", valid: totalQuestions >= 1 && totalQuestions <= 50 },
    ...(isMix
      ? [
          {
            title: "Select 2 or 3 types to mix",
            valid:
              mixTypes.length >= 2 &&
              mixTypes.length <= 3 &&
              mixCountSum === totalQuestions &&
              mixTypes.every((t) => (mixCounts[t] || 0) > 0),
          },
        ]
      : []),
    { title: "Set a time limit", valid: timeLimit >= 2 && timeLimit <= 30 },
    { title: "Pick a difficulty", valid: difficulty !== null },
    { title: "Hints?", valid: hintsEnabled !== null },
  ];

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const payload: any = {
        topic,
        question_type: questionType,
        total_questions: totalQuestions,
        difficulty,
        time_limit_minutes: timeLimit,
        hints_enabled: hintsEnabled,
      };
      if (isMix) {
        payload.mix_breakdown = Object.fromEntries(mixTypes.map((t) => [t, mixCounts[t] || 0]));
      }
      const { data } = await api.post("/quizzes/generate", payload);
      navigate(`/study/quiz/${data.id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Couldn't generate the quiz. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  function next() {
    if (isLastStep) {
      handleGenerate();
    } else {
      setStep((s) => s + 1);
    }
  }

  const suggestedQuestions = Math.max(1, Math.round(timeLimit / 1.5));

  return (
    <div className="min-h-screen bg-neon-glow flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Link to="/study" className="font-display text-lg tracking-tight text-white mb-8 inline-block">
          Scholar<span className="text-gradient-neon">AI</span>
        </Link>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? "bg-gradient-to-r from-neon-violet to-neon-cyan" : "bg-void-700"}`}
            />
          ))}
        </div>

        <div className="glass rounded-2xl p-7">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-2">
            Step {step + 1} of {steps.length}
          </p>
          <h1 className="text-2xl text-white mb-6">{currentStep.title}</h1>

          {/* Step 0: Topic */}
          {step === 0 && (
            <input
              autoFocus
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Photosynthesis, World War II, SQL Joins..."
              className="w-full rounded-lg border border-void-600 bg-void-900 px-4 py-3 text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-violet"
            />
          )}

          {/* Step 1: Question type */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {(["mcq", "true_false", "short_answer", "mix"] as FullType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setQuestionType(t)}
                  className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                    questionType === t
                      ? "border-neon-violet bg-void-800 text-white"
                      : "border-void-600 text-void-300 hover:text-white hover:border-void-400"
                  }`}
                >
                  {t === "mix" ? "Mix of types" : TYPE_LABELS[t as QType]}
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Total questions */}
          {step === 2 && (
            <div>
              <input
                type="number"
                min={1}
                max={50}
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-void-600 bg-void-900 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
              />
              <p className="text-xs text-void-400 mt-2">Choose between 1 and 50 questions.</p>
            </div>
          )}

          {/* Step 3 (mix only): select 2-3 types + per-type counts */}
          {isMix && step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(["mcq", "true_false", "short_answer"] as QType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleMixType(t)}
                    className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                      mixTypes.includes(t)
                        ? "border-transparent bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-medium"
                        : "border-void-600 text-void-300 hover:text-white"
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-void-400">Select 2 or 3 types to combine (not just 1).</p>

              {mixTypes.length >= 2 && (
                <div className="space-y-3 pt-2 border-t border-void-700/60">
                  {mixTypes.map((t) => (
                    <div key={t} className="flex items-center justify-between">
                      <span className="text-sm text-void-200">{TYPE_LABELS[t]} questions</span>
                      <input
                        type="number"
                        min={1}
                        value={mixCounts[t] || ""}
                        onChange={(e) =>
                          setMixCounts((prev) => ({ ...prev, [t]: parseInt(e.target.value) || 0 }))
                        }
                        className="w-20 rounded-lg border border-void-600 bg-void-900 px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-neon-violet"
                      />
                    </div>
                  ))}
                  <p
                    className={`text-xs ${
                      mixCountSum === totalQuestions ? "text-neon-lime" : "text-neon-pink"
                    }`}
                  >
                    {mixCountSum} / {totalQuestions} questions allocated
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Time limit step (index shifts by 1 if mix) */}
          {step === (isMix ? 4 : 3) && (
            <div>
              <input
                type="range"
                min={2}
                max={30}
                value={timeLimit}
                onChange={(e) => setTimeLimit(parseInt(e.target.value))}
                className="w-full accent-neon-violet"
              />
              <div className="flex justify-between text-sm text-void-200 mt-2">
                <span>2 min</span>
                <span className="text-white font-semibold text-lg">{timeLimit} min</span>
                <span>30 min</span>
              </div>
              <p className="text-xs text-void-400 mt-3">
                For a {timeLimit}-minute quiz, we'd suggest around {suggestedQuestions} questions —
                you've set {totalQuestions}.
              </p>
            </div>
          )}

          {/* Difficulty step */}
          {step === (isMix ? 5 : 4) && (
            <div className="grid grid-cols-2 gap-3">
              {DIFFICULTY_OPTIONS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                    difficulty === d.id
                      ? "border-neon-violet bg-void-800 text-white"
                      : "border-void-600 text-void-300 hover:text-white hover:border-void-400"
                  }`}
                >
                  <p className="font-medium">{d.label}</p>
                  <p className="text-xs text-void-400 mt-0.5">{d.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Hints step */}
          {step === (isMix ? 6 : 5) && (
            <div className="space-y-3">
              <button
                onClick={() => setHintsEnabled(false)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  hintsEnabled === false
                    ? "border-neon-violet bg-void-800 text-white"
                    : "border-void-600 text-void-300 hover:text-white"
                }`}
              >
                <p className="font-medium">No hints</p>
                <p className="text-xs text-void-400 mt-0.5">Test yourself without any help</p>
              </button>
              <button
                onClick={() => setHintsEnabled(true)}
                className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                  hintsEnabled === true
                    ? "border-neon-violet bg-void-800 text-white"
                    : "border-void-600 text-void-300 hover:text-white"
                }`}
              >
                <p className="font-medium">Allow hints</p>
                <p className="text-xs text-void-400 mt-0.5">Get a nudge if you're stuck</p>
              </button>
              <div className="flex items-start gap-2 text-xs text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg px-3 py-2 mt-2">
                <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>We'd suggest trying without hints first for a more accurate sense of what you know.</span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-3 py-2 mt-4">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1 text-sm text-void-300 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={next}
              disabled={!currentStep.valid || generating}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 px-5 py-2.5 font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isLastStep ? (
                <>
                  {generating ? "Generating…" : "Generate Quiz"}
                  <Sparkles className="w-4 h-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
