import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, RefreshCw, Mail } from "lucide-react";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const email = (location.state as { email?: string } | null)?.email ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // No email in state means they landed here directly (e.g. page refresh)
  // rather than coming from the register form — send them back.
  if (!email) {
    return (
      <div className="relative min-h-screen bg-void-950 flex items-center justify-center px-4 overflow-hidden selection:bg-neon-violet selection:text-white">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-neon-violet/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative w-full max-w-md text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-md mb-6 group hover:border-white/[0.15] transition-all"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center shadow-glow-violet">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight text-white">
              Scholar<span className="text-gradient-neon">AI</span>
            </span>
          </Link>
          <div className="glass-modern rounded-3xl p-8 border border-white/[0.08] shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Nothing to verify</h1>
            <p className="text-void-300 text-sm mb-6 leading-relaxed">
              Start by creating an account and we'll send a 6-digit confirmation code straight to your inbox.
            </p>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan py-3 px-4 font-semibold text-void-950 text-sm shadow-glow-violet hover:opacity-95 transition-all"
            >
              <span>Create an account</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register/verify", { email, code });
      setTokens(data.access_token, data.refresh_token);

      const me = await api.get("/auth/me");
      setUser(me.data);

      navigate("/dashboard");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResendMessage(null);
    setResending(true);
    try {
      await api.post("/auth/register/resend", { email });
      setResendMessage("A new code is on its way.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Couldn't resend the code. Try again shortly.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-void-950 flex items-center justify-center px-4 overflow-hidden selection:bg-neon-violet selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-neon-violet/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[300px] bg-neon-cyan/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-md py-8">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] backdrop-blur-md mb-6 group hover:border-white/[0.15] transition-all"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center shadow-glow-violet">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight text-white">
              Scholar<span className="text-gradient-neon">AI</span>
            </span>
          </Link>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Check your email</h1>
          <p className="text-void-300 text-sm">
            We sent a 6-digit confirmation code to:
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-void-900/90 border border-white/[0.1] text-xs font-mono text-neon-cyan">
            <Mail className="w-3 h-3" />
            <span>{email}</span>
          </div>
        </div>

        {/* Verification Card */}
        <div className="glass-modern rounded-3xl p-8 border border-white/[0.08] shadow-2xl relative">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 text-center mb-2.5" htmlFor="code">
                Enter 6-Digit Code
              </label>
              <div className="relative">
                <input
                  id="code"
                  ref={inputRef}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full rounded-2xl border border-white/[0.12] bg-void-900/90 pl-[0.5em] pr-0 py-4 text-white placeholder-void-600 text-center text-3xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-neon-violet/60 focus:border-neon-violet transition-all shadow-inner"
                  placeholder="••••••"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            {resendMessage && !error && (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{resendMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan py-3 px-4 font-semibold text-void-950 text-sm shadow-glow-violet hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-void-950/30 border-t-void-950 rounded-full animate-spin" />
                  <span>Verifying code…</span>
                </>
              ) : (
                <>
                  <span>Verify &amp; Continue</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <div className="pt-4 border-t border-white/[0.06] text-center">
              <p className="text-sm text-void-400">
                Didn't receive a code?{" "}
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || cooldown > 0}
                  className="text-neon-cyan font-semibold hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed transition-opacity inline-flex items-center gap-1.5"
                >
                  {resending ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin text-neon-cyan" />
                      <span>Sending code…</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span className="font-mono text-void-300">Resend in {cooldown}s</span>
                  ) : (
                    <span>Resend code</span>
                  )}
                </button>
              </p>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-void-400 mt-6">
          Wrong email address?{" "}
          <Link to="/register" className="text-neon-cyan hover:underline font-medium">
            Register again
          </Link>
        </p>
      </div>
    </div>
  );
}
