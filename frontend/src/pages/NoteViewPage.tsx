import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

interface Note {
  id: string;
  title: string;
  content: string;
}

export default function NoteViewPage() {
  const { noteId } = useParams<{ noteId: string }>();
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

  if (!note) {
    return <div className="min-h-screen bg-void-950 flex items-center justify-center text-void-300">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-void-950 px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        <Link to="/study" className="text-sm text-void-300 hover:text-white transition-colors mb-6 inline-block">
          ← Back to Study Pack
        </Link>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl text-white">{note.title}</h1>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-sm text-void-300 hover:text-white border border-void-600 rounded-lg px-3 py-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-neon-lime" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="glass rounded-2xl p-8">
          <div className="prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
