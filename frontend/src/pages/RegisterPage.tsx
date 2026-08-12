import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/register", { full_name: fullName, email, password });
      navigate("/verify-otp", { state: { email } });
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neon-glow flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="font-display text-lg tracking-tight inline-block mb-6">
            Scholar<span className="text-gradient-neon">AI</span>
          </Link>
          <h1 className="text-3xl text-white mb-1">Create your account</h1>
          <p className="text-void-200 text-sm">Start learning with AI at your side.</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-void-200 mb-1" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-violet"
              placeholder="Jane Student"
            />
          </div>

          <div>
            <label className="block text-sm text-void-200 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-violet"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-void-200 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-void-600 bg-void-900 px-3 py-2 text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-violet"
              placeholder="At least 8 characters"
            />
          </div>

          {error && (
            <p className="text-sm text-neon-pink bg-neon-pink/10 border border-neon-pink/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 py-2.5 font-semibold shadow-neon-violet hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Sending code…" : "Create account"}
          </button>
        </form>

        <p className="text-center text-sm text-void-200 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-neon-cyan font-medium hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
