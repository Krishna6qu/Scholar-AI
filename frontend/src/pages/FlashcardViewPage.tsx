import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
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
}

export default function FlashcardViewPage() {
  const { flashcardId } = useParams<{ flashcardId: string }>();
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    api.get(`/flashcards/${flashcardId}`).then(({ data }) => setSet(data));
  }, [flashcardId]);

  function next() {
    if (!set) return;
    setFlipped(false);
    setIndex((i) => Math.min(i + 1, set.items.length - 1));
  }

  function prev() {
    setFlipped(false);
    setIndex((i) => Math.max(i - 1, 0));
  }

  if (!set) {
    return <div className="min-h-screen bg-void-950 flex items-center justify-center text-void-300">Loading…</div>;
  }

  const card = set.items[index];

  return (
    <div className="min-h-screen bg-void-950 bg-neon-glow flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <Link to="/study" className="text-sm text-void-300 hover:text-white transition-colors mb-6 inline-block">
          ← Back to Study Pack
        </Link>
        <h1 className="text-2xl text-white mb-1">{set.title}</h1>
        <p className="text-void-300 text-sm mb-8">
          Card {index + 1} of {set.items.length} — click the card to flip it
        </p>

        <button
          onClick={() => setFlipped((f) => !f)}
          className="w-full glass rounded-2xl p-10 min-h-[240px] flex flex-col items-center justify-center text-center hover:border-neon-violet transition-colors"
        >
          <p className="text-xs text-void-400 uppercase tracking-widest mb-4">
            {flipped ? "Answer" : "Question"}
          </p>
          <p className="text-white text-lg leading-relaxed">
            {flipped ? card.back_text : card.front_text}
          </p>
          <p className="text-void-400 text-xs mt-6 flex items-center gap-1">
            <RotateCw className="w-3 h-3" /> Click to flip
          </p>
        </button>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={prev}
            disabled={index === 0}
            className="flex items-center gap-1 text-sm text-void-300 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <div className="flex gap-1">
            {set.items.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${i === index ? "bg-neon-cyan" : "bg-void-600"}`}
              />
            ))}
          </div>
          <button
            onClick={next}
            disabled={index === set.items.length - 1}
            className="flex items-center gap-1 text-sm text-void-300 hover:text-white disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
