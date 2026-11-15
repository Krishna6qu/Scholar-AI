import React from "react";
import { useNavigate } from "react-router-dom";
import { ZapOff, Clock, LayoutDashboard, BookOpen, X, RefreshCw } from "lucide-react";

interface DailyLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  resetsInHours?: number;
  used?: number;
  limit?: number;
}

export const DailyLimitModal: React.FC<DailyLimitModalProps> = ({
  isOpen,
  onClose,
  featureName = "this feature",
  resetsInHours = 5,
  used = 6,
  limit = 6,
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass-modern rounded-3xl p-6 sm:p-7 border border-neon-pink/40 bg-void-950/95 shadow-2xl shadow-neon-pink/20 text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-neon-pink/20 blur-3xl pointer-events-none rounded-full" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-void-400 hover:text-white hover:bg-void-800 transition-colors"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Depleted Energy Orb */}
        <div className="relative mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-pink/20 to-amber-500/20 border border-neon-pink/50 flex items-center justify-center shadow-lg shadow-neon-pink/30">
          <ZapOff className="w-8 h-8 text-neon-pink animate-pulse" />
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-void-900 border border-amber-400/50 flex items-center justify-center text-amber-400">
            <Clock className="w-3 h-3" />
          </div>
        </div>

        {/* Status Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider text-neon-pink bg-neon-pink/15 border border-neon-pink/30 mb-3">
          <span>Daily Energy Depleted</span>
          <span className="text-void-400">•</span>
          <span>{used}/{limit} Used</span>
        </div>

        {/* Header & Core Message */}
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 tracking-tight">
          Daily Limit Reached
        </h3>
        <p className="text-sm font-semibold text-neon-pink mb-2">
          Limit is reached. Wait {resetsInHours} hours to use it again.
        </p>
        <p className="text-xs text-void-300 leading-relaxed max-w-sm mx-auto mb-6">
          You've consumed all daily energy quotas for <span className="text-white font-medium">{featureName}</span>. Your daily energy capacity replenishes automatically every cycle reset.
        </p>

        {/* Timer / Replenish Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-void-900/90 border border-void-700/80 mb-6 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Next Energy Refill</p>
              <p className="text-[10px] text-void-400">Automatic quota replenishment</p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold text-amber-400 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
            In ~{resetsInHours}h
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/dashboard");
            }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-bold text-xs sm:text-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-2 shadow-glow-cyan"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Check Daily Energy & Quotas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              navigate("/study");
            }}
            className="w-full py-2.5 px-4 rounded-xl border border-void-700 hover:border-void-500 bg-void-900/80 text-void-200 hover:text-white font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4 text-neon-cyan" />
            <span>Review Saved Study Sets (Unlimited)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-xs text-void-400 hover:text-void-200 transition-colors py-1 font-mono"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
