import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Radio,
  Minimize2,
  Maximize2,
  X,
} from "lucide-react";

interface AudioSummaryPlayerProps {
  scriptText: string;
  sourceTitle?: string;
  className?: string;
}

export const AudioSummaryPlayer: React.FC<AudioSummaryPlayerProps> = ({
  scriptText,
  sourceTitle = "Audio Overview",
  className = "",
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [rate, setRate] = useState<number>(1.0);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState<number>(0);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [isFloating, setIsFloating] = useState(false);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressTimerRef = useRef<number | null>(null);

  // Load available speech synthesis voices
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechSupported(false);
      return;
    }

    const loadVoices = () => {
      const avail = window.speechSynthesis.getVoices();
      if (avail.length > 0) {
        const enVoices = avail.filter((v) => v.lang.startsWith("en"));
        const list = enVoices.length > 0 ? enVoices : avail;
        setVoices(list);
        const naturalIdx = list.findIndex(
          (v) =>
            v.name.toLowerCase().includes("natural") ||
            v.name.toLowerCase().includes("neural") ||
            v.name.toLowerCase().includes("google") ||
            v.name.toLowerCase().includes("samantha") ||
            v.name.toLowerCase().includes("jenny")
        );
        setSelectedVoiceIndex(naturalIdx !== -1 ? naturalIdx : 0);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  // Clean raw script of any lingering markdown brackets
  const cleanScript = React.useMemo(() => {
    return scriptText
      .replace(/\[\[audio_script:\s*/gi, "")
      .replace(/\]\]/g, "")
      .replace(/[*_#`>]/g, "")
      .trim();
  }, [scriptText]);

  // Estimated spoken duration based on ~140 words per min
  const estimatedSeconds = React.useMemo(() => {
    const wordCount = cleanScript.split(/\s+/).filter(Boolean).length;
    return Math.max(15, Math.round((wordCount / (140 * rate)) * 60));
  }, [cleanScript, rate]);

  const handlePlayPause = () => {
    if (!speechSupported || !cleanScript) return;

    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
      return;
    }

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      startProgressTracking();
      return;
    }

    // Start fresh
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleanScript);
    utter.rate = rate;
    utter.pitch = 1.0;
    utter.volume = isMuted ? 0 : 1.0;

    if (voices[selectedVoiceIndex]) {
      utter.voice = voices[selectedVoiceIndex];
    }

    utter.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      startProgressTracking();
    };

    utter.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    };

    utter.onerror = (e) => {
      console.warn("SpeechSynthesis error:", e);
      setIsPlaying(false);
      setIsPaused(false);
      if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    };

    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
  };

  const startProgressTracking = () => {
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    const intervalMs = 250;
    const step = 100 / ((estimatedSeconds * 1000) / intervalMs);

    progressTimerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return 98;
        return prev + step;
      });
    }, intervalMs);
  };

  const handleRestart = () => {
    if (!speechSupported) return;
    window.speechSynthesis.cancel();
    setProgress(0);
    setIsPlaying(false);
    setIsPaused(false);
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    setTimeout(handlePlayPause, 100);
  };

  const handleStop = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
  };

  const handleSpeedChange = (newRate: number) => {
    setRate(newRate);
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setTimeout(handlePlayPause, 50);
    }
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (utteranceRef.current) {
      utteranceRef.current.volume = nextMuted ? 0 : 1.0;
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(cleanScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy audio script:", e);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const currentSeconds = Math.round((progress / 100) * estimatedSeconds);

  return (
    <>
      {/* 1. Inline Player in Message Bubble */}
      <div
        className={`glass-modern rounded-2xl p-4 border border-neon-violet/30 bg-gradient-to-r from-neon-violet/[0.08] via-void-900/90 to-neon-cyan/[0.08] shadow-lg shadow-neon-violet/10 relative overflow-hidden my-4 ${className}`}
      >
        {/* Ambient background glow orb */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-neon-cyan/20 blur-2xl rounded-full pointer-events-none" />

        {/* Header bar */}
        <div className="flex items-center justify-between gap-3 mb-3 relative z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center shadow-glow-violet shrink-0">
              <Radio className="w-4 h-4 text-void-950 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>Audio Summary</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-neon-cyan/20 text-[9px] font-mono text-neon-cyan border border-neon-cyan/40">
                    AI Narration
                  </span>
                </h4>
              </div>
              <p className="text-[11px] text-void-300 truncate max-w-xs md:max-w-md">
                {sourceTitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Equalizer animation */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-void-950/60 border border-white/[0.06]">
              {[40, 75, 100, 60, 85, 45, 95, 30].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full transition-all duration-300 ${
                    isPlaying && !isPaused
                      ? "bg-gradient-to-t from-neon-violet to-neon-cyan animate-pulse"
                      : "bg-void-600"
                  }`}
                  style={{
                    height: isPlaying && !isPaused ? `${Math.max(6, (h * (i % 2 === 0 ? 0.9 : 0.6)) / 4)}px` : "6px",
                    animationDelay: `${i * 120}ms`,
                  }}
                />
              ))}
            </div>

            {/* Float / Dock Capsule Toggle Button */}
            <button
              type="button"
              onClick={() => setIsFloating(!isFloating)}
              title={isFloating ? "Dock inline" : "Float audio capsule"}
              className={`p-1.5 rounded-xl border transition-all ${
                isFloating
                  ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40 shadow-sm shadow-neon-cyan/20"
                  : "bg-void-950/60 text-void-300 border-white/[0.08] hover:text-white"
              }`}
            >
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Playback Controls & Scrubber */}
        <div className="space-y-2.5 relative z-10">
          {/* Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-void-400 w-8 text-right shrink-0">
              {formatTime(currentSeconds)}
            </span>
            <div className="relative flex-1 h-1.5 bg-void-800 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-neon-violet to-neon-cyan rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-void-400 w-8 shrink-0">
              {formatTime(estimatedSeconds)}
            </span>
          </div>

          {/* Button Dock */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2">
              {/* Play/Pause Button */}
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={!speechSupported}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-semibold text-xs shadow-glow-violet hover:opacity-95 active:scale-95 transition-all"
              >
                {isPlaying && !isPaused ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{progress > 0 && progress < 100 ? "Resume" : "Play Audio"}</span>
                  </>
                )}
              </button>

              {/* Restart Button */}
              <button
                type="button"
                onClick={handleRestart}
                title="Restart from beginning"
                className="p-1.5 rounded-lg text-void-400 hover:text-white hover:bg-void-800 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Mute/Unmute */}
              <button
                type="button"
                onClick={handleMuteToggle}
                title={isMuted ? "Unmute" : "Mute"}
                className="p-1.5 rounded-lg text-void-400 hover:text-white hover:bg-void-800 transition-colors"
              >
                {isMuted ? (
                  <VolumeX className="w-3.5 h-3.5 text-neon-pink" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Speed selector */}
              <div className="flex items-center bg-void-950/80 border border-white/[0.08] rounded-xl p-0.5 text-[10px] font-mono">
                {[0.75, 1.0, 1.25, 1.5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSpeedChange(s)}
                    className={`px-1.5 py-0.5 rounded-lg transition-colors ${
                      rate === s
                        ? "bg-neon-cyan/20 text-neon-cyan font-bold"
                        : "text-void-400 hover:text-white"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              {/* Voice dropdown if multiple voices available */}
              {voices.length > 1 && (
                <select
                  aria-label="Voice narrator"
                  value={selectedVoiceIndex}
                  onChange={(e) => setSelectedVoiceIndex(Number(e.target.value))}
                  className="bg-void-950/80 border border-white/[0.08] rounded-xl text-[10px] text-void-300 px-2 py-1 focus:outline-none focus:border-neon-cyan transition-colors max-w-[100px] truncate"
                >
                  {voices.slice(0, 10).map((v, i) => (
                    <option key={v.name} value={i} className="bg-void-900 text-white">
                      {v.name.split(" ")[0]} ({v.lang.slice(0, 2)})
                    </option>
                  ))}
                </select>
              )}

              {/* Copy Script Button */}
              <button
                type="button"
                onClick={handleCopyScript}
                title="Copy Audio Script text"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-void-400 hover:text-white hover:bg-void-800/80 border border-transparent hover:border-white/[0.08] transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-neon-lime" />
                    <span className="text-neon-lime">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Script</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {!speechSupported && (
          <p className="text-[11px] text-neon-pink/80 mt-2">
            Note: Your browser does not natively support Speech Synthesis, but you can copy and read the script text above.
          </p>
        )}
      </div>

      {/* 2. Floating Dynamic Island Capsule (Rendered via React Portal onto document.body) */}
      {isFloating && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-24 right-4 md:right-8 left-4 md:left-auto md:w-96 z-50 animate-slide-up">
            <div className="glass-modern rounded-2xl p-3 border border-neon-cyan/40 bg-void-950/95 backdrop-blur-2xl shadow-2xl shadow-black/80 flex items-center justify-between gap-3">
              {/* Play / Pause Mini Button */}
              <button
                type="button"
                onClick={handlePlayPause}
                disabled={!speechSupported}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 flex items-center justify-center shrink-0 shadow-md shadow-neon-violet/30 active:scale-95 transition-transform"
                title={isPlaying && !isPaused ? "Pause" : "Play"}
              >
                {isPlaying && !isPaused ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              {/* Title & Progress info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan animate-pulse" />
                  <p className="text-xs font-semibold text-white truncate">{sourceTitle}</p>
                </div>
                {/* Thin progress track */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-void-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-neon-violet to-neon-cyan rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-void-400 tabular-nums">
                    {formatTime(currentSeconds)} / {formatTime(estimatedSeconds)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFloating(false)}
                  title="Expand inline"
                  className="p-2 rounded-xl text-void-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleStop();
                    setIsFloating(false);
                  }}
                  title="Close audio"
                  className="p-2 rounded-xl text-void-400 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
