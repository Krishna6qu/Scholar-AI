import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Copy,
  Check,
  ArrowLeft,
  FileText,
  Clock,
  Layers,
  Brain,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

interface Note {
  id: string;
  title: string;
  content: string;
  word_count?: number;
  created_at?: string;
}

function generateNoteSummary(title: string, content: string): string {
  if (!content) return `Summary of "${title}":\nCan you explain the key concepts and test my understanding?`;

  // Clean lines from markdown code fences and whitespace
  const rawLines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("```"));

  // 1. Extract bullet points (- / * / • or numbered 1. / 2.)
  const bulletCandidates: string[] = [];
  for (const line of rawLines) {
    const match = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+[\.)]\s+(.+)$/);
    if (match) {
      const clean = match[1]
        .replace(/[*_`#]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();
      if (clean.length >= 15 && clean.length <= 250) {
        bulletCandidates.push(clean);
      }
    }
  }

  // If we have bullet points from the notes, format top 3 to 4 lines
  if (bulletCandidates.length >= 2) {
    const selected = bulletCandidates.slice(0, 4);
    return `Summary of "${title}":\n` + selected.map((b) => `• ${b}`).join("\n");
  }

  // 2. Otherwise extract meaningful sentences from non-heading paragraphs
  const paragraphText = rawLines
    .filter((l) => !l.startsWith("#"))
    .join(" ")
    .replace(/[*_`#]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const sentenceRegex = /[^.!?]+[.!?]+(?:\s|$)/g;
  const sentenceMatches = paragraphText.match(sentenceRegex) || [];
  const validSentences = sentenceMatches
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 220 && !s.toLowerCase().startsWith("http"));

  if (validSentences.length >= 2) {
    const selected = validSentences.slice(0, 3);
    return `Summary of "${title}":\n` + selected.map((s) => `• ${s}`).join("\n");
  }

  // 3. Fallback: clean snippet formatted in 3 lines
  const cleanSnippet = paragraphText.slice(0, 220).trim();
  return `Summary of "${title}":\n• ${cleanSnippet}\nCan you explain these key concepts in depth?`;
}

export default function NoteViewPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/notes/${noteId}`).then(({ data }) => setNote(data));
  }, [noteId]);

  async function handleCopy() {
    if (!note) return;
    await navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // Reading time and word count statistics
  const stats = useMemo(() => {
    if (!note?.content) return { words: 0, readTimeMinutes: 1 };
    const words = note.content.trim().split(/\s+/).length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { words, readTimeMinutes };
  }, [note]);

  if (!note) {
    return (
      <div className="min-h-screen bg-void-950 flex items-center justify-center text-void-300">
        <div className="flex flex-col items-center gap-3">
          <FileText className="w-7 h-7 text-neon-cyan animate-pulse" />
          <span className="text-sm font-medium">Retrieving Revision Summary…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void-950 text-void-100 px-4 sm:px-6 py-6 md:py-10">
      <div className="w-full max-w-3xl mx-auto">
        {/* Navigation & Action Bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Link
            to="/study"
            className="text-xs sm:text-sm text-void-300 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl border border-void-700/70 bg-void-900/60 min-h-[38px]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Study Pack</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 text-xs sm:text-sm text-void-200 hover:text-white border border-void-700 hover:border-void-500 bg-void-900/80 rounded-xl px-3.5 py-2 transition-all min-h-[38px] active:scale-95"
              title="Copy markdown text to clipboard"
            >
              {copied ? <Check className="w-4 h-4 text-neon-lime" /> : <Copy className="w-4 h-4 text-neon-cyan" />}
              <span>{copied ? "Copied!" : "Copy Notes"}</span>
            </button>
          </div>
        </div>

        {/* Note Document Card */}
        <div className="glass-modern rounded-3xl p-6 sm:p-10 border border-void-600/90 shadow-2xl relative overflow-hidden bg-void-800/95">
          {/* Subtle Ambient Background Accent */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Metadata */}
          <div className="mb-6 pb-6 border-b border-void-600">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-neon-cyan px-2.5 py-1 rounded-md bg-void-900 border border-void-600 flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3 h-3 text-neon-cyan" />
                Active Recall Notes
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-3">
              {note.title}
            </h1>

            <div className="flex items-center gap-4 text-xs text-slate-200 font-mono font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neon-cyan" />
                <span>{stats.readTimeMinutes} min read</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neon-cyan" />
                <span>{stats.words} words</span>
              </span>
            </div>
          </div>

          {/* Markdown Content Area */}
          <div className="prose-chat leading-relaxed text-sm sm:text-base text-slate-100 font-normal">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          </div>

          {/* Integrated Study Bridge Actions */}
          <div className="mt-10 pt-6 border-t border-void-600">
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-300 font-semibold mb-3">
              Study bridges from these notes
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  const prompt = generateNoteSummary(note.title, note.content);
                  navigate(`/chat?topic=${encodeURIComponent(note.title)}&prompt=${encodeURIComponent(prompt)}`, {
                    state: { initialPrompt: prompt, topic: note.title },
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
                    <p className="text-[10px] text-slate-300 font-medium">Notes summary</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate(`/study/quiz?topic=${encodeURIComponent(note.title)}`, { state: { topic: note.title } })}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-void-800 border border-void-600 hover:border-neon-cyan hover:bg-void-700 text-left transition-all group shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-neon-cyan/15 border border-neon-cyan/40 flex items-center justify-center text-neon-cyan shrink-0">
                    <Brain className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Concept Quiz</p>
                    <p className="text-[10px] text-slate-300 font-medium truncate">Test on "{note.title}"</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => navigate(`/study/flashcards/new?topic=${encodeURIComponent(note.title)}`, { state: { topic: note.title } })}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-void-800 border border-void-600 hover:border-neon-pink hover:bg-void-700 text-left transition-all group shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-neon-pink/15 border border-neon-pink/40 flex items-center justify-center text-neon-pink shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">3D Flashcards</p>
                    <p className="text-[10px] text-slate-300 font-medium truncate">Deck for "{note.title}"</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
