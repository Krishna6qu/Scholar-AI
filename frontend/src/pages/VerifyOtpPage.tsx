import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

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
      <div className="min-h-screen bg-void-950 bg-neon-glow flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <Link to="/" className="font-display text-lg tracking-tight inline-block mb-8">
            Scholar<span className="text-gradient-neon">AI</span>
          </Link>
          <div className="glass rounded-2xl p-8">
            <h1 className="text-xl text-white mb-2">Nothing to verify</h1>
            <p className="text-void-300 text-sm mb-6">
              Start by creating an account and we'll send you a code.
            </p>
            <Link
              to="/register"
              className="inline-block rounded-lg bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 px-5 py-2.5 font-semibold hover:opacity-90 transition-opacity"
            >
              Create an account
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
    <div className="min-h-screen bg-neon-glow flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="font-display text-lg tracking-tight inline-block mb-6">
            Scholar<span className="text-gradient-neon">AI</span>
          </Link>
          <h1 className="text-3xl text-white mb-1">Check your email</h1>
          <p className="text-void-200 text-sm">
            We sent a 6-digit code to <span className="text-white">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-void-200 mb-1" htmlFor="code">
              Verification code
            </label>
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
              className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white placeholder-void-400 text-center text-2xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 focus:ring-neon-violet"
              placeholder="000000"
            />
          </div>

          {error && (
            <p className="text-sm text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {resendMessage && !error && (
            <p className="text-sm text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-lg px-3 py-2">
              {resendMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 py-2.5 font-semibold shadow-neon-violet hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Verifying…" : "Verify & create account"}
          </button>
        </form>

        <p className="text-center text-sm text-void-200 mt-6">
          Didn't get a code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="text-neon-cyan font-medium hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending…" : "Resend code"}
          </button>
        </p>
      </div>
    </div>
  );
}
