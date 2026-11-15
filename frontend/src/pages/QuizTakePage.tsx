import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Clock,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Brain,
  ArrowRight,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Award,
} from "lucide-react";
import { api } from "@/lib/api";

interface Option {
  id: string;
  option_text: string;
}

interface Question {
  id: string;
  question_text: string;
  question_order: number;
  question_type: "mcq" | "true_false" | "short_answer";
  hint: string | null;
  options: Option[];
}

interface Quiz {
  id: string;
  title: string;
  difficulty: string;
  total_questions: number;
  time_limit_minutes: number;
  hints_enabled: boolean;
  questions: Question[];
}

interface AnswerResult {
  question_id: string;
  question_text: string;
  is_correct: boolean;
  your_answer: string | null;
  correct_answer: string | null;
  explanation: string | null;
}

interface AttemptResult {
  score: number;
  percentage: number;
  total_questions: number;
  correct_count: number;
  results: AnswerResult[];
}

export default function QuizTakePage() {
  const { quizId } = useParams<{ quizId: string }>();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, { optionId?: string; text?: string }>>({});
  const [shownHints, setShownHints] = useState<Set<string>>(new Set());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResult | null>(null);

  useEffect(() => {
    api.get(`/quizzes/${quizId}`).then(({ data }) => {
      setQuiz(data);
      setSecondsLeft(data.time_limit_minutes * 60);
    });
  }, [quizId]);

  useEffect(() => {
    if (secondsLeft === null || result || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => (s !== null ? s - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, result]);

  useEffect(() => {
    if (secondsLeft === 0 && !result) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  function selectOption(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { optionId } }));
  }

  function setTextAnswer(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { text } }));
  }

  function toggleHint(questionId: string) {
    setShownHints((prev) => {
      const next = new Set(prev);
      next.has(questionId) ? next.delete(questionId) : next.add(questionId);
      return next;
    });
  }

  async function handleSubmit() {
    if (!quiz || submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        answers: quiz.questions.map((q) => ({
          question_id: q.id,
          selected_option_id: answers[q.id]?.optionId ?? null,
          text_answer: answers[q.id]?.text ?? null,
        })),
      };
      const { data } = await api.post(`/quizzes/${quiz.id}/attempts`, payload);
      setResult(data);
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = useMemo(() => {
    if (!quiz) return 0;
    return quiz.questions.filter((q) => {
      const ans = answers[q.id];
      if (!ans) return false;
      return (ans.optionId && ans.optionId.length > 0) || (ans.text && ans.text.trim().length > 0);
    }).length;
  }, [quiz, answers]);

  if (!quiz) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center text-void-300">
        <div className="flex flex-col items-center gap-3">
          <Brain className="w-7 h-7 text-neon-cyan animate-pulse" />
          <p className="text-sm">Synthesizing quiz challenge…</p>
        </div>
      </div>
    );
  }

  const minutes = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const seconds = secondsLeft !== null ? secondsLeft % 60 : 0;
  const timeCritical = secondsLeft !== null && secondsLeft < 60;
  const progressPercent = Math.round((answeredCount / (quiz.questions.length || 1)) * 100);

  // Results View
  if (result) {
    const isMastery = result.percentage >= 80;
    const isPassing = result.percentage >= 60;

    let tierBadge = "Apprentice Recall";
    let tierColor = "text-void-300 border-void-600 bg-void-800/80";
    if (result.percentage >= 90) {
      tierBadge = "Solar Archmage (S-Rank)";
      tierColor = "text-neon-lime border-neon-lime/40 bg-neon-lime/10 shadow-glow-lime";
    } else if (result.percentage >= 75) {
      tierBadge = "Scholar Mastery (A-Rank)";
      tierColor = "text-neon-cyan border-neon-cyan/40 bg-neon-cyan/10 shadow-glow-cyan";
    } else if (result.percentage >= 60) {
      tierBadge = "Adept Insight (B-Rank)";
      tierColor = "text-neon-violet border-neon-violet/40 bg-neon-violet/10 shadow-glow-violet";
    }

    return (
      <div className="min-h-screen bg-void-950 text-void-100 px-4 sm:px-6 py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Performance Hero Card */}
          <div className="glass-modern rounded-3xl p-6 sm:p-8 text-center mb-8 border border-void-700/80 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-neon-violet/10 rounded-full blur-3xl pointer-events-none" />

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase mb-4 border tracking-wider shadow-sm">
              <Award className="w-3.5 h-3.5 text-neon-cyan" />
              <span>Assessment Summary</span>
            </div>

            {/* Circular Gauge Representation */}
            <div className="relative w-36 h-36 mx-auto mb-4 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#1B1B24"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={isMastery ? "#A3E635" : isPassing ? "#22D3EE" : "#F472B6"}
                  strokeWidth="8"
                  strokeDasharray={251.2}
                  strokeDashoffset={251.2 - (251.2 * result.percentage) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-display font-bold text-white tracking-tight">
                  {Math.round(result.percentage)}%
                </span>
                <span className="text-[10px] font-mono text-void-400">Score</span>
              </div>
            </div>

            <div className="mb-3">
              <span className={`inline-block text-xs font-mono font-bold px-3 py-1 rounded-full border ${tierColor}`}>
                {tierBadge}
              </span>
            </div>

            <p className="text-void-200 text-sm">
              You correctly solved <span className="text-white font-bold">{result.correct_count}</span> of{" "}
              <span className="text-white font-bold">{result.total_questions}</span> questions.
            </p>
          </div>

          {/* Detailed Question Review */}
          <div className="space-y-4 mb-8">
            <h2 className="text-xs font-mono uppercase tracking-widest text-void-400 px-1">
              Detailed Breakdown
            </h2>

            {result.results.map((r, i) => (
              <div
                key={r.question_id}
                className={`glass-modern rounded-2xl p-4 sm:p-5 border transition-all ${
                  r.is_correct
                    ? "border-neon-lime/30 bg-neon-lime/[0.03]"
                    : "border-neon-pink/30 bg-neon-pink/[0.03]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {r.is_correct ? (
                    <CheckCircle2 className="w-5 h-5 text-neon-lime shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-neon-pink shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-semibold mb-2 leading-snug">
                      {i + 1}. {r.question_text}
                    </p>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-baseline gap-2">
                        <span className="text-slate-300 font-mono text-[11px] shrink-0 font-semibold">Your Answer:</span>
                        <span className={r.is_correct ? "text-neon-lime font-bold" : "text-neon-pink font-bold"}>
                          {r.your_answer ?? "No answer submitted"}
                        </span>
                      </div>

                      {!r.is_correct && r.correct_answer && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-slate-300 font-mono text-[11px] shrink-0 font-semibold">Correct Answer:</span>
                          <span className="text-neon-lime font-bold">{r.correct_answer}</span>
                        </div>
                      )}

                      {r.explanation && (
                        <div className="mt-2.5 pt-2 border-t border-void-600 text-xs sm:text-sm text-slate-100 leading-relaxed bg-void-800/95 p-3.5 rounded-xl border border-void-600 shadow-md">
                          <span className="text-neon-cyan font-bold block mb-1">Explanation:</span>
                          {r.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Navigation */}
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <Link
              to="/study/quiz"
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-void-700 hover:border-void-500 bg-void-900 text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2 transition-all min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4 text-neon-cyan" />
              <span>Generate Another Quiz</span>
            </Link>
            <Link
              to="/study"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity shadow-glow-cyan min-h-[44px]"
            >
              <span>Return to Study Pack</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active Quiz View
  return (
    <div className="min-h-screen bg-void-950 text-void-100 px-4 sm:px-6 py-6 pb-28 md:pb-12">
      <div className="max-w-2xl mx-auto">
        {/* Sticky Header with Timer & Progress */}
        <div className="sticky top-0 z-30 bg-void-950/90 backdrop-blur-xl py-3 border-b border-void-800/80 mb-6 -mx-4 px-4 sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-widest text-neon-cyan font-bold block truncate">
                {quiz.difficulty.replace("_", " ")} Assessment
              </span>
              <h1 className="text-base sm:text-lg font-bold text-white truncate max-w-xs sm:max-w-md">
                {quiz.title}
              </h1>
            </div>

            {/* Glowing Countdown Timer */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-mono text-xs font-bold transition-all shrink-0 ${
                timeCritical
                  ? "border-neon-pink bg-neon-pink/10 text-neon-pink animate-pulse shadow-glow-pink"
                  : "border-void-700 bg-void-900/90 text-void-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>
                {minutes}:{seconds.toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-1.5 bg-void-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-6">
          {quiz.questions.map((q, i) => {
            const isAnswered =
              answers[q.id]?.optionId !== undefined ||
              (answers[q.id]?.text && answers[q.id]!.text!.trim().length > 0);

            return (
              <div
                key={q.id}
                className={`glass-modern rounded-3xl p-5 sm:p-6 border transition-all duration-300 shadow-xl ${
                  isAnswered
                    ? "border-neon-cyan/50 shadow-[0_0_24px_-8px_rgba(34,211,238,0.25)]"
                    : "border-void-600/90"
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-md bg-void-800 text-white border border-void-600">
                      Q{i + 1} of {quiz.questions.length}
                    </span>
                    {isAnswered && (
                      <span className="text-[10px] font-mono text-neon-cyan font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Answered
                      </span>
                    )}
                  </div>

                  {quiz.hints_enabled && q.hint && (
                    <button
                      type="button"
                      onClick={() => toggleHint(q.id)}
                      className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl border text-xs transition-colors ${
                        shownHints.has(q.id)
                          ? "bg-neon-cyan/25 border-neon-cyan text-neon-cyan shadow-glow-cyan"
                          : "border-void-600 bg-void-800 text-slate-200 hover:text-neon-cyan hover:border-void-500"
                      }`}
                      title="Toggle Hint"
                    >
                      <Lightbulb className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <p className="text-white text-base sm:text-lg font-bold mb-4 leading-relaxed">
                  {q.question_text}
                </p>

                {shownHints.has(q.id) && q.hint && (
                  <div className="flex items-start gap-2 text-xs sm:text-sm text-neon-cyan bg-neon-cyan/15 border border-neon-cyan/40 rounded-xl px-3.5 py-2.5 mb-4 animate-in fade-in duration-200 font-medium">
                    <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{q.hint}</span>
                  </div>
                )}

                {/* Multiple Choice / True-False Options */}
                {q.question_type === "short_answer" ? (
                  <input
                    value={answers[q.id]?.text ?? ""}
                    onChange={(e) => setTextAnswer(q.id, e.target.value)}
                    placeholder="Type your response here…"
                    className="w-full rounded-xl border border-void-600 bg-void-800/95 px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan transition-all"
                  />
                ) : (
                  <div className="grid gap-2.5">
                    {q.options.map((opt, optIndex) => {
                      const isSelected = answers[q.id]?.optionId === opt.id;
                      const optionLabel = String.fromCharCode(65 + optIndex);

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => selectOption(q.id, opt.id)}
                          className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border text-xs sm:text-sm transition-all duration-200 flex items-center justify-between gap-3 active:scale-[0.99] min-h-[50px] shadow-sm ${
                            isSelected
                              ? "border-neon-cyan bg-neon-cyan/20 text-white shadow-glow-cyan/40 font-semibold"
                              : "border-void-600/90 bg-void-800/90 text-slate-100 font-medium hover:text-white hover:border-neon-cyan/50 hover:bg-void-700/90"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-colors ${
                                isSelected
                                  ? "bg-neon-cyan text-void-950 font-extrabold"
                                  : "bg-void-700 text-white font-bold border border-void-500"
                              }`}
                            >
                              {optionLabel}
                            </span>
                            <span className="leading-snug">{opt.option_text}</span>
                          </div>

                          <div className="shrink-0 ml-2">
                            <div
                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                isSelected
                                  ? "border-neon-cyan bg-neon-cyan"
                                  : "border-void-500 bg-transparent"
                              }`}
                            >
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-void-950" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Floating / Sticky Mobile & Desktop Submission Dock */}
        <div className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:max-w-2xl sm:w-full sm:left-1/2 sm:-translate-x-1/2 z-40 bg-void-900/95 backdrop-blur-2xl border border-void-700/80 rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 shadow-black/80">
          <div className="flex items-center gap-2 pl-2">
            <Brain className="w-4 h-4 text-neon-cyan" />
            <span className="text-xs text-void-300 font-mono">
              <span className="text-white font-bold">{answeredCount}</span>/{quiz.questions.length} answered
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-bold text-xs sm:text-sm hover:opacity-95 transition-all shadow-glow-cyan disabled:opacity-50 min-h-[42px] flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-void-950 border-t-transparent animate-spin" />
                <span>Grading…</span>
              </>
            ) : (
              <>
                <span>Submit Quiz</span>
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
