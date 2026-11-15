import React, { useMemo } from "react";
import { Flame, Sparkles, Trophy, Zap, ShieldCheck } from "lucide-react";

interface StreakEnergyCoreProps {
  dayStreak: number;
  totalQuizzes?: number;
  totalChats?: number;
  loading?: boolean;
}

export const StreakEnergyCore: React.FC<StreakEnergyCoreProps> = ({
  dayStreak = 0,
  loading = false,
}) => {
  // Weekly goal: 7 days
  const weeklyTarget = 7;
  const progressRatio = Math.min(dayStreak / weeklyTarget, 1);
  const ringRadius = 46;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - progressRatio * circumference;

  // Streak status & tier badge
  const tier = useMemo(() => {
    if (dayStreak === 0) {
      return {
        label: "Dormant Spark",
        sub: "Complete 1 session today to ignite",
        badge: "bg-void-800 text-void-300 border-white/10",
        flameColor: "text-void-400",
        ringGradient: ["#52525B", "#71717A"],
      };
    }
    if (dayStreak < 4) {
      return {
        label: "Spark Phase",
        sub: "Daily momentum is building",
        badge: "bg-amber-500/10 text-amber-300 border-amber-500/30",
        flameColor: "text-amber-400",
        ringGradient: ["#F59E0B", "#F97316"],
      };
    }
    if (dayStreak < 7) {
      return {
        label: "Steady Blaze",
        sub: "Approaching weekly target",
        badge: "bg-orange-500/10 text-orange-300 border-orange-500/30",
        flameColor: "text-orange-400",
        ringGradient: ["#F97316", "#EF4444"],
      };
    }
    if (dayStreak < 14) {
      return {
        label: "Thermal Surge",
        sub: "Weekly goal conquered! Keep firing",
        badge: "bg-neon-lime/10 text-neon-lime border-neon-lime/30",
        flameColor: "text-neon-lime",
        ringGradient: ["#A3E635", "#22D3EE"],
      };
    }
    return {
      label: "Solar Archmage",
      sub: "Unstoppable academic discipline",
      badge: "bg-neon-violet/10 text-neon-violet border-neon-violet/30",
      flameColor: "text-neon-violet",
      ringGradient: ["#A855F7", "#F472B6"],
    };
  }, [dayStreak]);

  // Current day of week (0 = Sunday, 1 = Monday, etc.)
  const currentDayIndex = (new Date().getDay() + 6) % 7; // 0 = Mon, 6 = Sun
  const dayNames = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <div className="relative overflow-hidden rounded-3xl p-4 sm:p-6 bg-gradient-to-br from-void-900/90 via-void-950/90 to-void-900/90 border border-white/[0.08] shadow-xl">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute -right-10 -bottom-10 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 -top-10 w-44 h-44 rounded-full bg-neon-cyan/5 blur-3xl" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-5 sm:gap-6">
        {/* Left: Concentric Gauge + Flame Core */}
        <div className="flex items-center gap-4 sm:gap-5 w-full md:w-auto">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
            {/* SVG Ring Progress */}
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
              <defs>
                <linearGradient id="streakRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={tier.ringGradient[0]} />
                  <stop offset="100%" stopColor={tier.ringGradient[1]} />
                </linearGradient>
                <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background Track */}
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                fill="none"
                stroke="rgba(255, 255, 255, 0.06)"
                strokeWidth="8"
              />

              {/* Active Animated Progress Arc */}
              <circle
                cx="60"
                cy="60"
                r={ringRadius}
                fill="none"
                stroke="url(#streakRingGrad)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={loading ? circumference : strokeDashoffset}
                filter="url(#ringGlow)"
                style={{
                  transition: "stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </svg>

            {/* Inner Floating Flame Orb */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="relative">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10 ${
                    dayStreak > 0 ? "bg-amber-500/10 shadow-lg shadow-amber-500/20" : "bg-void-800"
                  }`}
                >
                  <Flame
                    className={`w-6 h-6 ${tier.flameColor} ${
                      dayStreak > 0 ? "animate-pulse" : "opacity-40"
                    }`}
                  />
                </div>

                {/* Floating particle sparkle if streak active */}
                {dayStreak > 0 && (
                  <Sparkles className="absolute -top-1.5 -right-1.5 w-4 h-4 text-amber-300 animate-bounce" />
                )}
              </div>
            </div>
          </div>

          {/* Metric Details */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${tier.badge}`}>
                {dayStreak > 6 ? <Trophy className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                <span>{tier.label}</span>
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-display font-bold text-white tracking-tight tabular-nums">
                {loading ? "…" : dayStreak}
              </span>
              <span className="text-xs font-mono uppercase tracking-wider text-void-300 font-semibold">
                {dayStreak === 1 ? "Day Streak" : "Days Streak"}
              </span>
            </div>

            <p className="text-xs text-void-200 mt-1 max-w-xs leading-relaxed">
              {tier.sub}
            </p>
          </div>
        </div>

        {/* Right: Weekly Rhythm Tracker */}
        <div className="w-full md:w-auto flex flex-col items-start md:items-end gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-neon-cyan" />
            <span className="text-xs font-mono text-void-200">
              Weekly Rhythm: <strong className="text-white font-bold">{Math.min(dayStreak, 7)}/7</strong> days
            </span>
          </div>

          {/* 7 Days of Week Capsules */}
          <div className="flex items-center gap-1.5">
            {dayNames.map((name, idx) => {
              const isPastOrToday = idx <= currentDayIndex;
              const isDone = isPastOrToday && dayStreak > 0 && (currentDayIndex - idx < dayStreak);
              const isToday = idx === currentDayIndex;

              return (
                <div key={idx} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-7 h-9 rounded-lg flex items-center justify-center text-xs font-mono font-bold transition-all duration-300 ${
                      isDone
                        ? "bg-gradient-to-t from-amber-500/20 to-orange-500/20 border border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20"
                        : isToday
                        ? "bg-white/[0.08] border border-neon-cyan/50 text-white animate-pulse"
                        : "bg-void-900 border border-white/[0.05] text-void-400"
                    }`}
                  >
                    {isDone ? "✓" : name}
                  </div>
                  <span className={`text-[9px] font-mono ${isToday ? "text-neon-cyan font-bold" : "text-void-400"}`}>
                    {name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
