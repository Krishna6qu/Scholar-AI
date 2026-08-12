import { Link } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Brain,
  Layers,
  Share2,
  Map,
  Sparkles,
  ShieldCheck,
  Zap,
  Github,
  Twitter,
  Linkedin,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Chat",
    desc: "Just type and go — ask about any topic, no setup required. Attach a file to a chat and ScholarAI reads it and answers grounded in your material.",
    accent: "text-neon-violet",
    ring: "group-hover:shadow-neon-violet",
  },
  {
    icon: Brain,
    title: "Custom Quizzes",
    desc: "Pick the topic, question types (MCQ, short answer, true/false, or a mix), difficulty from easy to interview-level, time limit, and whether you want hints.",
    accent: "text-neon-violet",
    ring: "group-hover:shadow-neon-violet",
  },
  {
    icon: Layers,
    title: "Flashcards",
    desc: "Describe what you want to study — get a flip-card set generated in seconds, ready to review.",
    accent: "text-neon-cyan",
    ring: "group-hover:shadow-neon-cyan",
  },
  {
    icon: FileText,
    title: "Revision Notes",
    desc: "Dense, skimmable, markdown-formatted notes for last-minute review — headings, bullets, and bolded key terms.",
    accent: "text-neon-cyan",
    ring: "group-hover:shadow-neon-cyan",
  },
  {
    icon: Share2,
    title: "Interactive Mind Maps",
    desc: "A visual, clickable diagram of how a topic branches into its key concepts — click any node to read more.",
    accent: "text-neon-pink",
    ring: "",
  },
  {
    icon: Map,
    title: "Career Roadmaps",
    desc: "Tell ScholarAI what you want to become — get a detailed, step-by-step plan with resources, exportable as a PDF.",
    accent: "text-neon-lime",
    ring: "",
  },
];

const STEPS = [
  { step: "01", title: "Create your account", desc: "Sign up in seconds — no credit card required." },
  { step: "02", title: "Chat or upload material", desc: "Ask a question, or drop in your notes, slides, or textbooks." },
  { step: "03", title: "Generate & review", desc: "Turn any session into quizzes, flashcards, or notes you can revisit." },
];

export default function HomePage() {
  return (
    <div className="bg-void-950">
      {/* Nav */}
      <nav className="sticky top-0 z-20 backdrop-blur-xl bg-void-950/70 border-b border-void-700/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <span className="font-display text-xl tracking-tight text-white">
            Scholar<span className="text-gradient-neon">AI</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-void-200">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-void-100 hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium px-4 py-2 rounded-full bg-white text-void-950 hover:bg-void-100 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-neon-glow">
        <div className="relative z-10 max-w-4xl mx-auto text-center px-6 pt-24 pb-28">
          <p className="inline-flex items-center gap-2 font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-6 border border-neon-cyan/30 rounded-full px-4 py-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            AI-powered learning
          </p>
          <h1 className="text-5xl md:text-6xl leading-[1.1] text-white mb-6">
            Learn faster with an
            <br />
            <span className="text-gradient-neon">AI study partner</span>
          </h1>
          <p className="text-void-200 text-lg max-w-xl mx-auto mb-10">
            Chat, upload your material, and turn it into quizzes, flashcards, and
            mind maps — all in one focused workspace built for students.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/register"
              className="px-6 py-3 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-semibold shadow-neon-violet hover:opacity-90 transition-opacity"
            >
              Create free account
            </Link>
            <Link
              to="/login"
              className="px-6 py-3 rounded-full border border-void-600 text-void-100 hover:border-void-400 transition-colors"
            >
              I already have one
            </Link>
          </div>

          <dl className="mt-16 grid grid-cols-3 gap-6 max-w-md mx-auto text-center">
            <div>
              <dt className="text-2xl font-display text-white">6</dt>
              <dd className="text-xs text-void-300 mt-1">Study tools</dd>
            </div>
            <div>
              <dt className="text-2xl font-display text-white">24/7</dt>
              <dd className="text-xs text-void-300 mt-1">AI availability</dd>
            </div>
            <div>
              <dt className="text-2xl font-display text-white">100%</dt>
              <dd className="text-xs text-void-300 mt-1">Your own data</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-violet mb-3">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl text-white">Everything you need to study smarter</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`group glass rounded-2xl p-6 transition-shadow ${f.ring}`}
            >
              <f.icon className={`w-6 h-6 mb-4 ${f.accent}`} />
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-void-200 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl text-white">Three steps to your first study pack</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.step} className="relative">
              <span className="font-display text-5xl text-void-700">{s.step}</span>
              <h3 className="text-white font-semibold mt-2 mb-2">{s.title}</h3>
              <p className="text-void-200 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="max-w-4xl mx-auto px-6 py-24 text-center">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-pink mb-3">
          About ScholarAI
        </p>
        <h2 className="text-3xl md:text-4xl text-white mb-6">
          Built for students, not enterprises
        </h2>
        <p className="text-void-200 leading-relaxed max-w-2xl mx-auto">
          ScholarAI exists to close the gap between "I read this once" and "I actually
          understand this." Instead of juggling a chat app, a notes app, and a flashcard
          app separately, everything lives in one workspace — grounded in your own
          material, private to your account, and built to fit how students actually study.
        </p>
        <div className="flex items-center justify-center gap-8 mt-10 text-void-200 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-neon-cyan" /> Your data stays yours
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-neon-violet" /> Built for speed
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <div className="glass rounded-3xl p-12">
          <h2 className="text-2xl md:text-3xl text-white mb-4">Ready to study smarter?</h2>
          <p className="text-void-200 mb-8">Free to start — set up your workspace in under a minute.</p>
          <Link
            to="/register"
            className="inline-block px-8 py-3 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-semibold shadow-neon-violet hover:opacity-90 transition-opacity"
          >
            Create free account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-void-700/60">
        <div className="max-w-6xl mx-auto px-6 py-14 grid md:grid-cols-4 gap-10">
          <div>
            <span className="font-display text-lg tracking-tight text-white">
              Scholar<span className="text-gradient-neon">AI</span>
            </span>
            <p className="text-void-300 text-sm mt-3 leading-relaxed">
              Your intelligent AI learning companion.
            </p>
            <div className="flex items-center gap-4 mt-5 text-void-300">
              <Github className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
              <Twitter className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
              <Linkedin className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
            </div>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-void-300">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Get started</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-void-300">
              <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
              <li><span className="opacity-60">Careers — coming soon</span></li>
              <li><span className="opacity-60">Contact — coming soon</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-void-300">
              <li><span className="opacity-60">Privacy Policy — coming soon</span></li>
              <li><span className="opacity-60">Terms of Service — coming soon</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-void-700/60 px-6 py-6 text-center text-xs text-void-400">
          © {new Date().getFullYear()} ScholarAI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
