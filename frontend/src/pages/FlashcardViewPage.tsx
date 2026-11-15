import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  HelpCircle,
  Layers,
  MessageSquare,
  Brain,
  FileText,
} from "lucide-react";
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
  const navigate = useNavigate();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<Record<string, boolean>>({});
  const completedRef = useRef(false);

  // Swipe & Drag physics state
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);

  useEffect(() => {
    api.get(`/flashcards/${flashcardId}`).then(({ data }) => setSet(data));
  }, [flashcardId]);

  useEffect(() => {
    if (!set || !flashcardId || completedRef.current) return;
    if (index === set.items.length - 1) {
      completedRef.current = true;
      api
        .post(`/flashcards/${flashcardId}/complete`)
        .then(({ data }) => {
          setSet((prev) => (prev ? { ...prev, reviewed_at: data.reviewed_at } : prev));
        })
        .catch((err) => console.error("Failed to mark flashcard set reviewed:", err));
    }
  }, [index, set, flashcardId]);

  const next = useCallback(() => {
    if (!set) return;
    setFlipped(false);
    setDragOffset(0);
    setIndex((i) => Math.min(i + 1, set.items.length - 1));
  }, [set]);

  const prev = useCallback(() => {
    if (!set) return;
    setFlipped(false);
    setDragOffset(0);
    setIndex((i) => Math.max(i - 1, 0));
  }, [set]);

  const toggleFlip = useCallback(() => {
    if (Math.abs(dragOffset) > 10) return; // Don't flip on drag release
    setFlipped((f) => !f);
  }, [dragOffset]);

  const restart = useCallback(() => {
    setIndex(0);
    setFlipped(false);
    setDragOffset(0);
  }, []);

  const markMastery = useCallback((id: string, mastered: boolean) => {
    setMasteredIds((prev) => ({ ...prev, [id]: mastered }));
    next();
  }, [next]);

  // Touch Swipe Handlers (Mobile & Tablet)
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Detect if user is swiping horizontally vs scrolling vertically
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
        isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipe.current) {
      // Damped spring resistance
      setDragOffset(deltaX * 0.8);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (Math.abs(dragOffset) > 70) {
      if (dragOffset > 0) {
        prev();
      } else {
        next();
      }
    }
    setDragOffset(0);
    isHorizontalSwipe.current = null;
  };

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        next();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "1") {
        if (set && set.items[index]) markMastery(set.items[index].id, false);
      } else if (e.key === "2") {
        if (set && set.items[index]) markMastery(set.items[index].id, true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, prev, set, index, markMastery]);

  if (!set) {
    return (
      <div className="min-h-screen bg-void-950 flex flex-col items-center justify-center text-void-300 gap-3">
        <Sparkles className="w-6 h-6 text-neon-pink animate-spin" />
        <span className="text-sm font-medium">Loading your flashcards…</span>
      </div>
    );
  }

  const totalCards = set.items.length;
  const card = set.items[index];
  const progressPercent = Math.round(((index + 1) / totalCards) * 100);
  const isFinished = index === totalCards - 1;

  const masteredCount = Object.values(masteredIds).filter(Boolean).length;
  const learningCount = Object.keys(masteredIds).length - masteredCount;

  // Swipe gesture visual cues
  const swipeGlow =
    dragOffset > 30
      ? "border-neon-cyan/50 shadow-neon-cyan/20"
      : dragOffset < -30
      ? "border-neon-pink/50 shadow-neon-pink/20"
      : "";

  return (
    <div className="min-h-screen bg-void-950 bg-neon-glow flex flex-col items-center justify-center px-4 py-8 md:py-12 select-none overflow-x-hidden">
      <div className="w-full max-w-xl">
        {/* Back Link */}
        <Link
          to="/study"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-void-300 hover:text-white transition-colors mb-5 group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Study Hub</span>
        </Link>

        {/* Deck Header & Retention Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center text-neon-pink shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-lg md:text-xl font-bold text-white tracking-tight truncate">
              {set.title}
            </h1>
            {set.reviewed_at && (
              <span title="Deck completed" className="shrink-0">
                <CheckCircle2 className="w-4 h-4 text-neon-lime" />
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {masteredCount > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neon-lime/10 border border-neon-lime/30 text-neon-lime font-semibold">
                {masteredCount} Mastered
              </span>
            )}
            {learningCount > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-semibold">
                {learningCount} Learning
              </span>
            )}
            <button
              onClick={restart}
              title="Restart deck"
              className="flex items-center gap-1 text-xs text-void-300 hover:text-white px-2.5 py-1.5 rounded-xl bg-void-900 border border-white/[0.08] hover:border-white/20 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="font-mono text-[11px]">Restart</span>
            </button>
          </div>
        </div>

        {/* Progress Tracker */}
        <div className="mb-5">
          <div className="flex justify-between items-center text-xs text-void-300 mb-1.5 font-mono">
            <span className="font-semibold text-white">
              Card {index + 1} <span className="text-void-400">/ {totalCards}</span>
            </span>
            <span className="text-neon-cyan">{progressPercent}% reviewed</span>
          </div>
          <div className="h-1.5 w-full bg-void-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-neon-pink via-neon-violet to-neon-cyan transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 3D Physics Flip Card & Touch Gesture Viewport */}
        <div
          className="perspective-1000 w-full min-h-[320px] sm:min-h-[360px] cursor-pointer group relative"
          onClick={toggleFlip}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Edge Swipe Indicators */}
          {dragOffset < -25 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-30 px-3 py-1.5 rounded-xl bg-neon-pink/90 text-void-950 font-bold text-xs shadow-lg animate-pulse pointer-events-none">
              Next →
            </div>
          )}
          {dragOffset > 25 && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-30 px-3 py-1.5 rounded-xl bg-neon-cyan/90 text-void-950 font-bold text-xs shadow-lg animate-pulse pointer-events-none">
              ← Previous
            </div>
          )}

          {/* Interactive Card Body with 3D Flip & Horizontal Swipe Offset */}
          <div
            className={`relative w-full min-h-[320px] sm:min-h-[360px] rounded-3xl transform-style-3d ${
              flipped ? "rotate-y-180" : ""
            }`}
            style={{
              transform: `translateX(${dragOffset}px) rotate(${dragOffset * 0.04}deg) ${
                flipped ? "rotateY(180deg)" : "rotateY(0deg)"
              }`,
              transition: isDragging
                ? "none"
                : "transform 0.55s cubic-bezier(0.34, 1.45, 0.64, 1)",
              willChange: "transform",
            }}
          >
            {/* FRONT FACE (Question) */}
            <div
              className={`absolute inset-0 backface-hidden glass-modern rounded-3xl p-6 sm:p-10 flex flex-col justify-between items-center text-center border transition-all bg-void-800/95 ${
                swipeGlow || "border-void-500/80 hover:border-neon-pink/70 shadow-2xl"
              }`}
            >
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neon-pink/15 border border-neon-pink/40 text-neon-pink text-xs font-bold uppercase tracking-wider shadow-sm">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Question</span>
              </div>

              <div className="my-auto py-4">
                <p className="text-white text-xl sm:text-2xl md:text-3xl font-bold leading-relaxed max-w-lg">
                  {card.front_text}
                </p>
              </div>

              <div className="text-slate-300 text-xs flex items-center gap-1.5 group-hover:text-white transition-colors font-medium">
                <RotateCw className="w-3.5 h-3.5 text-neon-pink animate-pulse" />
                <span className="font-mono text-[11px]">Click / Tap to reveal answer</span>
              </div>
            </div>

            {/* BACK FACE (Answer) */}
            <div
              className={`absolute inset-0 backface-hidden rotate-y-180 glass-modern rounded-3xl p-6 sm:p-10 flex flex-col justify-between items-center text-center border transition-all bg-void-800/95 ${
                swipeGlow || "border-neon-cyan/60 shadow-2xl shadow-neon-cyan/20"
              }`}
            >
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neon-cyan/15 border border-neon-cyan/40 text-neon-cyan text-xs font-bold uppercase tracking-wider shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Answer</span>
              </div>

              <div className="my-auto py-4">
                <p className="text-white text-lg sm:text-2xl font-semibold leading-relaxed max-w-lg">
                  {card.back_text}
                </p>
              </div>

              <div className="text-slate-300 text-xs flex items-center gap-1.5 font-medium">
                <RotateCw className="w-3.5 h-3.5 text-neon-cyan" />
                <span className="font-mono text-[11px]">Click / Tap to flip back</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mastery Feedback Bar (Active on Flip) */}
        {flipped && (
          <div className="flex items-center justify-center gap-3 mt-4 animate-fade-in">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                markMastery(card.id, false);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-void-900 border border-amber-500/30 text-amber-300 text-xs font-semibold hover:bg-amber-500/10 active:scale-95 transition-all shadow-sm"
            >
              <span>Still Learning (1)</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                markMastery(card.id, true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-neon-lime/10 border border-neon-lime/40 text-neon-lime text-xs font-semibold hover:bg-neon-lime/20 active:scale-95 transition-all shadow-sm"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              <span>Mastered (2)</span>
            </button>
          </div>
        )}

        {/* Primary Navigation Controls */}
        <div className="flex items-center justify-between mt-6 gap-3">
          <button
            onClick={prev}
            disabled={index === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium text-void-200 bg-void-900 border border-white/[0.08] hover:border-white/20 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[44px]"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {/* Card Indicator Dots (Desktop & Tablet) */}
          <div className="hidden sm:flex gap-1.5 max-w-[200px] overflow-x-auto py-1">
            {set.items.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setFlipped(false);
                  setIndex(i);
                }}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-6 bg-neon-pink" : "w-2 bg-void-700 hover:bg-void-500"
                }`}
                title={`Go to card ${i + 1}`}
              />
            ))}
          </div>

          {isFinished ? (
            <button
              onClick={restart}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium bg-gradient-to-r from-neon-pink to-neon-violet text-white hover:opacity-90 shadow-md shadow-neon-pink/20 transition-all active:scale-95 min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4" /> Finish &amp; Review
            </button>
          ) : (
            <button
              onClick={next}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-medium text-void-950 bg-gradient-to-r from-neon-violet to-neon-cyan hover:opacity-90 transition-all active:scale-95 shadow-md shadow-neon-cyan/20 min-h-[44px]"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Keyboard & Swipe Ergonomics Footer */}
        <p className="text-center text-[11px] text-slate-300 mt-5 font-mono">
          <span className="hidden sm:inline">
            Use <kbd className="px-1 py-0.5 rounded bg-void-800 border border-void-600 text-white font-bold">Space</kbd> to flip, and <kbd className="px-1 py-0.5 rounded bg-void-800 border border-void-600 text-white font-bold">←</kbd> <kbd className="px-1 py-0.5 rounded bg-void-800 border border-void-600 text-white font-bold">→</kbd> to navigate
          </span>
          <span className="sm:hidden">
            Swipe left/right to navigate • Tap to flip
          </span>
        </p>

        {/* Cross-Feature Study Bridges */}
        <div className="mt-8 pt-6 border-t border-void-600 w-full">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold mb-3">
            Cross-study actions for "{set.title}"
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => {
                const sampleCards = (set.items || []).slice(0, 3);
                let prompt = `Summary of "${set.title}" Flashcards:\n`;
                if (sampleCards.length > 0) {
                  prompt += sampleCards.map((c: FlashcardItem) => `• ${c.front_text}: ${c.back_text.slice(0, 120)}`).join("\n");
                } else {
                  prompt += `• Key flashcard concepts and definitions for ${set.title}`;
                }
                navigate(`/chat?topic=${encodeURIComponent(set.title)}&prompt=${encodeURIComponent(prompt)}`, {
                  state: { initialPrompt: prompt, topic: set.title },
                });
              }}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-void-800 border border-void-600 hover:border-neon-violet hover:bg-void-700 text-left transition-all group shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-neon-violet/15 border border-neon-violet/40 flex items-center justify-center text-neon-violet shrink-0">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">Ask AI Chat</p>
                  <p className="text-[10px] text-slate-300 font-medium truncate">Cards summary</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(`/study/quiz?topic=${encodeURIComponent(set.title)}`, { state: { topic: set.title } })}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-void-800 border border-void-600 hover:border-neon-cyan hover:bg-void-700 text-left transition-all group shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-neon-cyan/15 border border-neon-cyan/40 flex items-center justify-center text-neon-cyan shrink-0">
                  <Brain className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">Generate Quiz</p>
                  <p className="text-[10px] text-slate-300 font-medium truncate">Test on "{set.title}"</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => navigate(`/study/notes/new?topic=${encodeURIComponent(set.title)}`, { state: { topic: set.title } })}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-void-800 border border-void-600 hover:border-neon-pink hover:bg-void-700 text-left transition-all group shadow-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-neon-pink/15 border border-neon-pink/40 flex items-center justify-center text-neon-pink shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">Create Notes</p>
                  <p className="text-[10px] text-slate-300 font-medium truncate">Revision summary</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
