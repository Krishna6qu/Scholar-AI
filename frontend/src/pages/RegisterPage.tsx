import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Sparkles, ArrowRight, Lock, Mail, User, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        full_name: fullName.trim() || undefined,
        email: email.trim(),
        password,
      });

      // Simple direct registration: save tokens and go to dashboard
      setTokens(data.access_token, data.refresh_token);

      const me = await api.get("/auth/me");
      setUser(me.data);

      navigate("/dashboard");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg || "Invalid input").join(", "));
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setLoading(false);
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
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">Create your account</h1>
          <p className="text-void-300 text-sm">Join thousands of students mastering their studies with AI</p>
        </div>

        {/* Register Card */}
        <div className="glass-modern rounded-3xl p-8 border border-white/[0.08] shadow-2xl relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 mb-1.5" htmlFor="fullName">
                Full Name <span className="text-void-500 font-normal lowercase">(optional)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-void-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-void-900/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-void-500 focus:outline-none focus:ring-2 focus:ring-neon-violet/50 focus:border-neon-violet/60 transition-all"
                  placeholder="Jane Student"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 mb-1.5" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-void-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-void-900/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-void-500 focus:outline-none focus:ring-2 focus:ring-neon-violet/50 focus:border-neon-violet/60 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-void-300 mb-1.5" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-void-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-void-900/90 pl-10 pr-11 py-2.5 text-sm text-white placeholder-void-500 focus:outline-none focus:ring-2 focus:ring-neon-violet/50 focus:border-neon-violet/60 transition-all"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3.5 top-3 text-void-400 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-void-400 hover:text-white" />
                  ) : (
                    <Eye className="w-4 h-4 text-void-400 hover:text-white" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-void-400 mt-1.5">
                Must be at least 8 characters long
              </p>
            </div>

            {error && (
              <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan py-3 px-4 font-semibold text-void-950 text-sm shadow-glow-violet hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-void-950/30 border-t-void-950 rounded-full animate-spin" />
                  <span>Creating your account…</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-void-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-neon-cyan font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
