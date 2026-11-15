import React, { useState, useEffect } from "react";
import {
  Link2,
  Youtube,
  FileText,
  Globe,
  Sparkles,
  X,
  ArrowRight,
  Radio,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";

interface LinkPreview {
  url: string;
  title: string;
  source_type: "youtube" | "pdf" | "article";
  author_or_domain?: string | null;
  thumbnail_url?: string | null;
}

export interface LinkSummarizeResult {
  chat_id: string;
  chat_title: string;
  source_title: string;
  source_type: string;
  user_message: any;
  assistant_message: any;
  audio_script: string;
}

interface LinkIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeChatId?: string | null;
  initialUrl?: string;
  onSuccess: (result: LinkSummarizeResult) => void;
}

export const LinkIngestModal: React.FC<LinkIngestModalProps> = ({
  isOpen,
  onClose,
  activeChatId,
  initialUrl = "",
  onSuccess,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [customNotes, setCustomNotes] = useState("");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState<number>(0);

  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      fetchPreview(initialUrl);
    }
  }, [initialUrl]);

  if (!isOpen) return null;

  const detectType = (testUrl: string): "youtube" | "pdf" | "article" => {
    if (/(?:youtube\.com|youtu\.be)/i.test(testUrl)) return "youtube";
    if (/\.pdf($|\?)/i.test(testUrl)) return "pdf";
    return "article";
  };

  const fetchPreview = async (targetUrl: string) => {
    if (!targetUrl.trim() || !/^https?:\/\//i.test(targetUrl.trim())) {
      setPreview(null);
      return;
    }

    setLoadingPreview(true);
    setError(null);
    try {
      const { data } = await api.post<LinkPreview>("/links/preview", {
        url: targetUrl.trim(),
      });
      setPreview(data);
    } catch {
      // Fallback local preview
      const type = detectType(targetUrl);
      try {
        const parsed = new URL(targetUrl);
        setPreview({
          url: targetUrl,
          title: `${type === "youtube" ? "YouTube Video" : type === "pdf" ? "PDF Document" : "Web Article"} from ${parsed.hostname}`,
          source_type: type,
          author_or_domain: parsed.hostname,
          thumbnail_url: null,
        });
      } catch {
        setPreview(null);
      }
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    if (/^https?:\/\/.+/i.test(val.trim())) {
      const timer = setTimeout(() => fetchPreview(val.trim()), 400);
      return () => clearTimeout(timer);
    } else {
      setPreview(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        fetchPreview(text.trim());
      }
    } catch (e) {
      console.warn("Could not read clipboard:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || submitting) return;

    if (!/^https?:\/\//i.test(url.trim())) {
      setError("Please provide a valid URL starting with http:// or https://");
      return;
    }

    setSubmitting(true);
    setError(null);
    setProgressStep(1);

    // Simulated progress steps for smooth UX
    const t1 = setTimeout(() => setProgressStep(2), 2200);
    const t2 = setTimeout(() => setProgressStep(3), 5000);

    try {
      const { data } = await api.post<LinkSummarizeResult>("/links/summarize", {
        url: url.trim(),
        chat_id: activeChatId || null,
        custom_instructions: customNotes.trim() || null,
      });

      clearTimeout(t1);
      clearTimeout(t2);
      onSuccess(data);
      onClose();
    } catch (err: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      console.error("Link summarize error:", err);
      const detail = err.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : "Could not analyze the provided link. Please ensure the link is publicly accessible and try again."
      );
    } finally {
      setSubmitting(false);
      setProgressStep(0);
    }
  };

  const quickSamples = [
    {
      label: "YouTube Lecture",
      icon: Youtube,
      sample: "https://www.youtube.com/watch?v=aircAruvnKk",
    },
    {
      label: "Wikipedia Article",
      icon: Globe,
      sample: "https://en.wikipedia.org/wiki/Neural_network",
    },
    {
      label: "Research Paper",
      icon: FileText,
      sample: "https://arxiv.org/pdf/1706.03762.pdf",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 selection:bg-neon-violet selection:text-white animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-modern rounded-3xl w-full max-w-xl border border-white/[0.1] shadow-2xl overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient background glows */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-neon-cyan/20 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-neon-violet/20 blur-3xl rounded-full pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08] relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center shadow-glow-violet">
              <Link2 className="w-5 h-5 text-void-950 font-bold" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Drop Video or Resource Link</span>
                <span className="px-2 py-0.5 rounded-full bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 text-[10px] font-mono">
                  New Feature
                </span>
              </h2>
              <p className="text-xs text-void-300">
                Detailed study summary + interactive audio overview
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-xl text-void-400 hover:text-white hover:bg-void-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 relative z-10">
          {/* Quick presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-void-400">Try sample:</span>
            {quickSamples.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => {
                    setUrl(q.sample);
                    fetchPreview(q.sample);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-void-900 border border-white/[0.08] hover:border-neon-cyan/50 text-[11px] text-void-300 hover:text-white transition-colors"
                >
                  <Icon className="w-3 h-3 text-neon-cyan" />
                  <span>{q.label}</span>
                </button>
              );
            })}
          </div>

          {/* URL Input Bar */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 mb-1.5">
              Paste Video or Document Link
            </label>
            <div className="relative flex items-center">
              <input
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=... or web article URL"
                value={url}
                onChange={handleUrlChange}
                disabled={submitting}
                className="w-full rounded-2xl border border-white/[0.1] bg-void-950/80 pl-4 pr-20 py-3 text-sm text-white placeholder-void-500 focus:outline-none focus:ring-2 focus:ring-neon-cyan/50 focus:border-neon-cyan transition-all"
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={submitting}
                className="absolute right-2 px-3 py-1 rounded-xl bg-void-800 border border-white/[0.08] hover:bg-void-700 text-xs font-medium text-void-200 hover:text-white transition-colors"
              >
                Paste
              </button>
            </div>
          </div>

          {/* Live Preview Card */}
          {loadingPreview ? (
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-void-900/80 border border-white/[0.06] text-xs text-void-400">
              <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
              <span>Fetching link metadata…</span>
            </div>
          ) : preview ? (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-void-900/90 border border-neon-cyan/30 shadow-inner">
              {preview.thumbnail_url ? (
                <img
                  src={preview.thumbnail_url}
                  alt={preview.title}
                  className="w-20 h-14 rounded-xl object-cover shrink-0 border border-white/[0.1]"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-void-800 border border-white/[0.08] flex items-center justify-center shrink-0">
                  {preview.source_type === "youtube" ? (
                    <Youtube className="w-5 h-5 text-rose-400" />
                  ) : preview.source_type === "pdf" ? (
                    <FileText className="w-5 h-5 text-neon-pink" />
                  ) : (
                    <Globe className="w-5 h-5 text-neon-cyan" />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-void-800 border border-white/[0.06] text-[10px] font-mono uppercase text-neon-cyan">
                    {preview.source_type}
                  </span>
                  <span className="text-[11px] text-void-400 truncate">
                    {preview.author_or_domain}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-white truncate">
                  {preview.title}
                </h4>
                <a
                  href={preview.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-void-400 hover:text-neon-cyan inline-flex items-center gap-1 mt-0.5"
                >
                  <span>Open original</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          ) : null}

          {/* Optional notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 mb-1.5">
              Specific Study Focus (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Focus on the core equations, or explain for high school physics"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-white/[0.08] bg-void-950/80 px-3.5 py-2 text-xs text-white placeholder-void-500 focus:outline-none focus:ring-2 focus:ring-neon-violet/50 transition-all"
            />
          </div>

          {/* Error Banner */}
          {error && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          {/* Submitting Progress Indicator */}
          {submitting && (
            <div className="glass-modern rounded-2xl p-4 border border-neon-cyan/40 bg-void-950/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-neon-cyan animate-spin" />
                  <span>Processing resource…</span>
                </span>
                <span className="text-[11px] font-mono text-neon-cyan">
                  Step {progressStep} of 3
                </span>
              </div>
              <div className="w-full h-1.5 bg-void-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon-violet to-neon-cyan rounded-full transition-all duration-700"
                  style={{ width: `${(progressStep / 3) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-void-300">
                {progressStep === 1 && "Fetching transcript & source document text…"}
                {progressStep === 2 && "Synthesizing deep concepts & study takeaways…"}
                {progressStep === 3 && "Composing radio-style audio overview script…"}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-void-300 hover:text-white hover:bg-void-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim() || submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-bold text-xs shadow-glow-violet hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing &amp; Narrating…</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5" />
                  <span>Summarize &amp; Generate Audio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
