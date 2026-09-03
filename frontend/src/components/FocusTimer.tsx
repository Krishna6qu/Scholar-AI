import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Clock, Coffee, Sparkles, ChevronDown, ChevronUp } from "lucide-react";

type TimerMode = "pomodoro" | "shortBreak" | "longBreak";

const MODE_DURATIONS: Record<TimerMode, number> = {
  pomodoro: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_LABELS: Record<TimerMode, { title: string; accent: string; icon: any }> = {
  pomodoro: { title: "Study Focus", accent: "text-neon-violet border-neon-violet/40", icon: Sparkles },
  shortBreak: { title: "Short Break", accent: "text-neon-cyan border-neon-cyan/40", icon: Coffee },
  longBreak: { title: "Long Break", accent: "text-neon-pink border-neon-pink/40", icon: Clock },
};

export default function FocusTimer() {
  const [mode, setMode] = useState<TimerMode>("pomodoro");
  const [timeLeft, setTimeLeft] = useState<number>(MODE_DURATIONS.pomodoro);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(true);
  const [hasFinished, setHasFinished] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      setHasFinished(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeLeft]);

  function switchMode(newMode: TimerMode) {
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(MODE_DURATIONS[newMode]);
    setHasFinished(false);
  }

  function handleReset() {
    setIsRunning(false);
    setTimeLeft(MODE_DURATIONS[mode]);
    setHasFinished(false);
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const totalDuration = MODE_DURATIONS[mode];
  const progressPercent = ((totalDuration - timeLeft) / totalDuration) * 100;
  const currentModeInfo = MODE_LABELS[mode];
  const IconComponent = currentModeInfo.icon;

  return (
    <div className="fixed bottom-6 right-6 z-40 select-none">
      {isMinimized ? (
        /* Minimized floating pill */
        <button
          onClick={() => setIsMinimized(false)}
          className={`flex items-center gap-2.5 glass px-4 py-2.5 rounded-full shadow-2xl border transition-all duration-300 hover:scale-105 ${
            isRunning
              ? "border-neon-cyan shadow-neon-cyan/20 animate-pulse"
              : hasFinished
              ? "border-neon-lime bg-neon-lime/10"
              : "border-void-700 hover:border-void-500"
          }`}
          title="Open Study Focus Timer"
        >
          <IconComponent className="w-4 h-4 text-neon-cyan" />
          <span className="font-mono text-sm font-semibold text-white tracking-wider">
            {formattedTime}
          </span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-void-300 hidden sm:inline">
            {mode === "pomodoro" ? "Focus" : "Break"}
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-void-400" />
        </button>
      ) : (
        /* Expanded full timer card */
        <div className="w-72 glass rounded-2xl p-5 border border-void-600/80 shadow-2xl backdrop-blur-2xl animate-float">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-neon-violet" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Study Pomodoro
              </span>
            </div>
            <button
              onClick={() => setIsMinimized(true)}
              className="text-void-400 hover:text-white p-1 rounded-lg transition-colors"
              title="Minimize"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-void-900/80 p-1 rounded-xl border border-void-700/60 mb-5">
            <button
              onClick={() => switchMode("pomodoro")}
              className={`text-[11px] font-medium py-1.5 rounded-lg transition-colors ${
                mode === "pomodoro"
                  ? "bg-neon-violet/20 text-white font-semibold border border-neon-violet/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              25m Focus
            </button>
            <button
              onClick={() => switchMode("shortBreak")}
              className={`text-[11px] font-medium py-1.5 rounded-lg transition-colors ${
                mode === "shortBreak"
                  ? "bg-neon-cyan/20 text-white font-semibold border border-neon-cyan/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              5m Break
            </button>
            <button
              onClick={() => switchMode("longBreak")}
              className={`text-[11px] font-medium py-1.5 rounded-lg transition-colors ${
                mode === "longBreak"
                  ? "bg-neon-pink/20 text-white font-semibold border border-neon-pink/30"
                  : "text-void-400 hover:text-white"
              }`}
            >
              15m Rest
            </button>
          </div>

          {/* Countdown Clock Display */}
          <div className="text-center my-3">
            <div className="font-mono text-4xl font-bold tracking-tight text-white mb-1">
              {formattedTime}
            </div>
            <p className="text-xs text-void-300 font-medium">
              {hasFinished
                ? "Time's up! Take a well-deserved break 🎉"
                : isRunning
                ? "Keep going, stay in the zone ✨"
                : "Ready to focus?"}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-void-800 rounded-full overflow-hidden my-4">
            <div
              className="h-full bg-gradient-to-r from-neon-violet to-neon-cyan transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              onClick={() => setIsRunning((r) => !r)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all duration-200 ${
                isRunning
                  ? "bg-void-800 text-void-100 hover:bg-void-700 border border-void-600"
                  : "bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 hover:opacity-90 shadow-neon-violet"
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? "Pause" : "Start Focus"}</span>
            </button>

            <button
              onClick={handleReset}
              className="p-2 rounded-xl bg-void-800/80 hover:bg-void-700 text-void-300 hover:text-white border border-void-700 transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
