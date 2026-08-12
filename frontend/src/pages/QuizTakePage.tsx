import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Clock, Lightbulb, CheckCircle2, XCircle } from "lucide-react";
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

  if (!quiz) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center">
        <p className="text-void-300 text-sm">Loading quiz…</p>
      </div>
    );
  }

  const minutes = secondsLeft !== null ? Math.floor(secondsLeft / 60) : 0;
  const seconds = secondsLeft !== null ? secondsLeft % 60 : 0;
  const timeCritical = secondsLeft !== null && secondsLeft < 60;

  // Results view
  if (result) {
    return (
      <div className="min-h-screen bg-neon-glow px-6 py-10">
        <div className="max-w-2xl mx-auto">
          <div className="glass rounded-2xl p-8 text-center mb-6">
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-3">Results</p>
            <h1 className="text-4xl font-display text-white mb-2">{result.percentage}%</h1>
            <p className="text-void-200">
              {result.correct_count} of {result.total_questions} correct
            </p>
          </div>

          <div className="space-y-4">
            {result.results.map((r, i) => (
              <div key={r.question_id} className="glass rounded-2xl p-5">
                <div className="flex items-start gap-3">
                  {r.is_correct ? (
                    <CheckCircle2 className="w-5 h-5 text-neon-lime shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-neon-pink shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium mb-2">
                      {i + 1}. {r.question_text}
                    </p>
                    <p className="text-xs text-void-300">
                      Your answer: <span className="text-void-100">{r.your_answer ?? "—"}</span>
                    </p>
                    {!r.is_correct && (
                      <p className="text-xs text-neon-lime mt-1">Correct answer: {r.correct_answer}</p>
                    )}
                    {r.explanation && (
                      <p className="text-xs text-void-300 mt-2 italic">{r.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6 justify-center">
            <Link
              to="/study/quiz"
              className="px-5 py-2.5 rounded-full border border-void-600 text-void-100 hover:border-void-400 transition-colors text-sm"
            >
              Create another quiz
            </Link>
            <Link
              to="/study"
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Back to Study Pack
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Taking view
  return (
    <div className="min-h-screen bg-void-950 px-6 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-1">
              {quiz.difficulty.replace("_", " ")}
            </p>
            <h1 className="text-2xl text-white">{quiz.title}</h1>
          </div>
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
              timeCritical ? "border-neon-pink text-neon-pink" : "border-void-600 text-void-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span className="font-mono text-sm">
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="space-y-5">
          {quiz.questions.map((q, i) => (
            <div key={q.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-white text-sm font-medium">
                  {i + 1}. {q.question_text}
                </p>
                {quiz.hints_enabled && q.hint && (
                  <button
                    onClick={() => toggleHint(q.id)}
                    className="shrink-0 text-void-400 hover:text-neon-cyan transition-colors"
                    title="Show hint"
                  >
                    <Lightbulb className="w-4 h-4" />
                  </button>
                )}
              </div>

              {shownHints.has(q.id) && q.hint && (
                <p className="text-xs text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30 rounded-lg px-3 py-2 mb-3">
                  {q.hint}
                </p>
              )}

              {q.question_type === "short_answer" ? (
                <input
                  value={answers[q.id]?.text ?? ""}
                  onChange={(e) => setTextAnswer(q.id, e.target.value)}
                  placeholder="Type your answer"
                  className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-neon-violet"
                />
              ) : (
                <div className="grid gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => selectOption(q.id, opt.id)}
                      className={`text-left px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                        answers[q.id]?.optionId === opt.id
                          ? "border-neon-violet bg-void-800 text-white"
                          : "border-void-600 text-void-300 hover:text-white hover:border-void-400"
                      }`}
                    >
                      {opt.option_text}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full mt-6 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 py-3 font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Grading…" : "Submit Quiz"}
        </button>
      </div>
    </div>
  );
}
