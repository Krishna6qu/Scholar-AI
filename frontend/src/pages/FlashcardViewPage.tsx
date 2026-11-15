import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, RotateCw, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

interface FlashcardItem {
  id: string;
  front_text: string;
  back_text: string;
  order_number: number;
}

interface FlashcardSet {
  id: string;
  title: string;
  items: FlashcardItem[];
  reviewed_at: string | null;
}

export default function FlashcardViewPage() {
  const { flashcardId } = useParams<{ flashcardId: string }>();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    api.get(`/flashcards/${flashcardId}`).then(({ data }) => setSet(data));
  }, [flashcardId]);

  useEffect(() => {
    if (!set || !flashcardId || completedRef.current) return;
    if (index === set.items.length - 1) {
      completedRef.current = true;
      api.post(`/flashcards/${flashcardId}/complete`).then(({ data }) => {
        setSet((prev) => (prev ? { ...prev, reviewed_at: data.reviewed_at } : prev));
      }).catch((err) => console.error("Failed to mark flashcard set reviewed:", err));
    }
  }, [index, set, flashcardId]);

  const next = useCallback(() => {
    if (!set) return;
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, set.items.length - 1));
  }, [set]);

  const prev = useCallback(() => {
    if (!set) return;
    setFlipped(false);
    setIndex((i) => Math.max(i - 1, 0));
  }, [set]);

  const toggleFlip = useCallback(() => {
    setFlipped((f) => !f);
  }, []);

  const restart = useCallback(() => {
    setIndex(0);
    setFlipped(false);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        toggleFlip();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFlip, next, prev]);

  if (!set) {
    return (
      <div className="min-h-screen bg-void-950 flex flex-col items-center justify-center text-void-300 gap-3">
        <Sparkles className="w-6 h-6 text-neon-pink animate-spin" />
        <span className="text-sm font-medium">Loading your flashcards…</span>
      </div>
    );
  }

  const card = set.items[index];
  const progressPercent = Math.round(((index + 1) / set.items.length) * 100);
  const isFinished = index === set.items.length - 1;

  return (
    <div className="min-h-screen bg-void-950 bg-neon-glow flex flex-col items-center justify-center px-4 py-10 select-none">
      <div className="w-full max-w-xl">
        <Link
          to="/study"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-void-300 hover:text-white transition-colors mb-6 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Study Pack</span>
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate max-w-md">
              {set.title}
            </h1>
            {set.reviewed_at && (
              <span title="Deck completed" className="shrink-0">
                <CheckCircle2 className="w-5 h-5 text-neon-lime" />
              </span>
            )}
          </div>
          <button
            onClick={restart}
            title="Restart deck"
            className="flex items-center gap-1 text-xs text-void-400 hover:text-white px-2 py-1 rounded-lg hover:bg-void-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restart</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center text-xs text-void-400 mb-1.5 font-mono">
            <span>Card {index + 1} of {set.items.length}</span>
            <span>{progressPercent}% completed</span>
          </div>
          <div className="h-1.5 w-full bg-void-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-pink to-neon-violet transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 3D Flip Card Container */}
        <div
          className="perspective-1000 w-full min-h-[300px] cursor-pointer group"
          onClick={toggleFlip}
        >
          <div
            className={`relative w-full min-h-[300px] rounded-2xl transition-transform duration-500 transform-style-3d ${
              flipped ? "rotate-y-180" : ""
            }`}
          >
            {/* FRONT FACE (Question) */}
            <div className="absolute inset-0 backface-hidden glass rounded-2xl p-8 md:p-10 flex flex-col justify-between items-center text-center border border-void-700/80 shadow-2xl hover:border-neon-pink/50 transition-colors">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neon-pink/10 border border-neon-pink/30 text-neon-pink text-xs font-semibold uppercase tracking-wider">
                <span>Question</span>
              </div>

              <p className="text-white text-lg md:text-xl font-medium leading-relaxed max-w-md my-6">
                {card.front_text}
              </p>

              <div className="text-void-400 text-xs flex items-center gap-1.5 group-hover:text-void-200 transition-colors">
                <RotateCw className="w-3.5 h-3.5 text-neon-pink" />
                <span>Click or tap Space to flip answer</span>
              </div>
            </div>

            {/* BACK FACE (Answer) */}
            <div className="absolute inset-0 backface-hidden rotate-y-180 glass rounded-2xl p-8 md:p-10 flex flex-col justify-between items-center text-center border border-neon-cyan/40 shadow-2xl shadow-neon-cyan/10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs font-semibold uppercase tracking-wider">
                <span>Answer</span>
              </div>

              <p className="text-void-100 text-lg md:text-xl font-medium leading-relaxed max-w-md my-6">
                {card.back_text}
              </p>

              <div className="text-void-400 text-xs flex items-center gap-1.5">
                <RotateCw className="w-3.5 h-3.5 text-neon-cyan" />
                <span>Click or tap Space to flip back</span>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={prev}
            disabled={index === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-void-200 bg-void-900 border border-void-700 hover:border-void-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {/* Card Indicator Dots */}
          <div className="flex gap-1.5 max-w-[200px] overflow-x-auto py-1">
            {set.items.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setFlipped(false);
                  setIndex(i);
                }}
                className={`h-2 rounded-full transition-all ${
                  i === index
                    ? "w-6 bg-neon-pink"
                    : "w-2 bg-void-700 hover:bg-void-500"
                }`}
                title={`Go to card ${i + 1}`}
              />
            ))}
          </div>

          {isFinished ? (
            <button
              onClick={restart}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-neon-pink to-neon-violet text-white hover:opacity-90 shadow-md shadow-neon-pink/20 transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" /> Finish & Review
            </button>
          ) : (
            <button
              onClick={next}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-void-950 bg-gradient-to-r from-neon-violet to-neon-cyan hover:opacity-90 transition-all active:scale-95 shadow-md shadow-neon-cyan/20"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-center text-[11px] text-void-400 mt-6 font-mono">
          Pro-tip: Use <kbd className="px-1 py-0.5 rounded bg-void-800 border border-void-700 text-void-300">Space</kbd> to flip, and <kbd className="px-1 py-0.5 rounded bg-void-800 border border-void-700 text-void-300">←</kbd> <kbd className="px-1 py-0.5 rounded bg-void-800 border border-void-700 text-void-300">→</kbd> to navigate
        </p>
      </div>
    </div>
  );
}
