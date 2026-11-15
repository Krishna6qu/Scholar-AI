import { useState } from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  FileText,
  Brain,
  Layers,
  Share2,
  Map,
  Sparkles,
  Github,
  Twitter,
  Linkedin,
  ArrowRight,
  Check,
  ChevronRight,
  GraduationCap,
  RotateCw,
} from "lucide-react";

const BENTO_FEATURES = [
  {
    icon: MessageSquare,
    title: "AI Study Partner",
    badge: "Most Popular",
    desc: "Chat naturally about any concept or paste problem sets. Ground explanations directly in your uploaded lecture PDFs and slides.",
    accent: "text-neon-violet",
    borderGlow: "hover:border-neon-violet/50 hover:shadow-glow-violet",
    tag: "File Grounded",
    colSpan: "md:col-span-2",
  },
  {
    icon: Layers,
    title: "3D Flashcard Decks",
    badge: "Active Recall",
    desc: "Generate flip-cards with spaced repetition in seconds. Practice with smooth 3D animations and full keyboard shortcuts.",
    accent: "text-neon-pink",
    borderGlow: "hover:border-neon-pink/50 hover:shadow-glow-pink",
    tag: "3D Perspective",
    colSpan: "md:col-span-1",
  },
  {
    icon: Brain,
    title: "Adaptive Quizzes",
    badge: "Exam Mode",
    desc: "Custom test generator with MCQs, True/False, and short-answers across 4 difficulty tiers from easy to interview-hard.",
    accent: "text-neon-cyan",
    borderGlow: "hover:border-neon-cyan/50 hover:shadow-glow-cyan",
    tag: "Timed & Scored",
    colSpan: "md:col-span-1",
  },
  {
    icon: FileText,
    title: "Revision Notes",
    badge: "High Yield",
    desc: "Skimmable, formatted study notes tailored for last-minute exam prep — core formulas, bolded key terms, and summaries.",
    accent: "text-neon-violet",
    borderGlow: "hover:border-neon-violet/50 hover:shadow-glow-violet",
    tag: "Quick Review",
    colSpan: "md:col-span-1",
  },
  {
    icon: Share2,
    title: "Interactive Mind Maps",
    badge: "Visual Learning",
    desc: "Break down complex topics into an intuitive visual hierarchy of branches and nodes that you can zoom and explore.",
    accent: "text-neon-lime",
    borderGlow: "hover:border-neon-lime/50 hover:shadow-glow-lime",
    tag: "Visual Tree",
    colSpan: "md:col-span-1",
  },
  {
    icon: Map,
    title: "Career & Syllabus Roadmaps",
    badge: "Milestone Guided",
    desc: "Target your dream role or master an entire semester syllabus with step-by-step milestones, verified links, and PDF export.",
    accent: "text-neon-cyan",
    borderGlow: "hover:border-neon-cyan/50 hover:shadow-glow-cyan",
    tag: "Structured Path",
    colSpan: "md:col-span-3",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Ask or Upload",
    desc: "Drop in your lecture slides, notes, or simply ask a question on any academic subject.",
    icon: MessageSquare,
  },
  {
    num: "02",
    title: "1-Click Transformation",
    desc: "With a single tap, turn any AI response into a full quiz, flashcard deck, or mind map.",
    icon: Sparkles,
  },
  {
    num: "03",
    title: "Retain & Excel",
    desc: "Track your streaks, test yourself with active recall, and conquer exams with confidence.",
    icon: GraduationCap,
  },
];

const TESTIMONIALS = [
  {
    quote: "ScholarAI turned my 80-page pathology syllabus into manageable flashcards and practice quizzes in 5 minutes.",
    author: "Elena R.",
    role: "Medical Student",
    school: "Johns Hopkins",
  },
  {
    quote: "The one-click study conversion is magic. I ask a tricky algorithm question, click 'Quiz', and instantly test myself.",
    author: "David K.",
    role: "Computer Science Junior",
    school: "UC Berkeley",
  },
  {
    quote: "Being able to upload my professor's slides and get grounded answers without hallucination changed how I prep for finals.",
    author: "Maya T.",
    role: "Biochemistry Senior",
    school: "Univ of Toronto",
  },
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"quiz" | "flashcard" | "mindmap">("flashcard");

  return (
    <div className="bg-void-950 text-void-100 min-h-screen relative selection:bg-neon-cyan/30 selection:text-white">
      {/* Floating Island Navbar */}
      <div className="sticky top-4 z-50 px-4 max-w-5xl mx-auto">
        <nav className="glass-modern rounded-full px-5 py-3 flex items-center justify-between shadow-2xl border border-white/10 transition-all duration-300">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neon-violet to-neon-cyan flex items-center justify-center p-0.5 shadow-sm shadow-neon-violet/30 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-void-950 rounded-full flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-neon-cyan" />
              </div>
            </div>
            <span className="font-display text-lg tracking-tight text-white">
              Scholar<span className="text-gradient-neon font-bold">AI</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-7 text-xs font-medium text-void-300">
            <a href="#features" className="hover:text-white transition-colors">
              Study Tools
            </a>
            <a href="#demo" className="hover:text-white transition-colors">
              Live Demo
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How it works
            </a>
            <a href="#testimonials" className="hover:text-white transition-colors">
              Testimonials
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs font-medium text-void-200 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-xs font-semibold px-4 py-2 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 hover:opacity-95 shadow-md shadow-neon-violet/20 hover:scale-[1.03] active:scale-[0.98] transition-all"
            >
              Get Started Free
            </Link>
          </div>
        </nav>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
        {/* Ambient background glow halos */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[42rem] h-[22rem] bg-neon-violet/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-48 left-1/4 w-[28rem] h-[18rem] bg-neon-cyan/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 text-center z-10">
          {/* Announcement pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/10 text-xs font-medium text-void-200 mb-8 backdrop-blur-md hover:border-white/20 transition-all shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-neon-lime animate-pulse" />
            <span className="text-neon-cyan font-semibold">ScholarAI 2.0</span>
            <span className="text-void-400">•</span>
            <span>Autonomous AI Study Partner & Active Recall Hub</span>
          </div>

          {/* Hero Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-display font-semibold tracking-tight text-white leading-[1.1] mb-6">
            Learn faster with an
            <br />
            <span className="text-gradient-animated">intelligent study partner</span>
          </h1>

          {/* Subtitle */}
          <p className="text-void-200 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10 font-normal">
            Upload your lecture slides, paste problems, or ask any concept.
            ScholarAI turns your study material into <span className="text-white font-medium">adaptive quizzes</span>,{" "}
            <span className="text-white font-medium">3D flashcards</span>, and{" "}
            <span className="text-white font-medium">interactive mind maps</span> with zero manual re-typing.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-neon-violet via-neon-cyan to-neon-violet bg-[length:200%_auto] hover:bg-right text-void-950 text-sm font-bold shadow-xl shadow-neon-violet/25 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300"
            >
              <span>Start Studying Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#demo"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/[0.04] text-void-200 hover:text-white text-sm font-medium transition-all"
            >
              <span>See Live Preview</span>
              <Sparkles className="w-4 h-4 text-neon-cyan" />
            </a>
          </div>

          {/* Key metrics strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-6 border-t border-white/[0.06]">
            <div className="glass-modern rounded-2xl p-4 border border-white/5">
              <p className="text-2xl font-display font-bold text-white">6 Tools</p>
              <p className="text-xs text-void-300 mt-0.5">Unified Study Hub</p>
            </div>
            <div className="glass-modern rounded-2xl p-4 border border-white/5">
              <p className="text-2xl font-display font-bold text-neon-cyan">Instant</p>
              <p className="text-xs text-void-300 mt-0.5">1-Click Conversions</p>
            </div>
            <div className="glass-modern rounded-2xl p-4 border border-white/5">
              <p className="text-2xl font-display font-bold text-neon-lime">100%</p>
              <p className="text-xs text-void-300 mt-0.5">Private Account Data</p>
            </div>
            <div className="glass-modern rounded-2xl p-4 border border-white/5">
              <p className="text-2xl font-display font-bold text-neon-pink">24/7</p>
              <p className="text-xs text-void-300 mt-0.5">Grounded AI Tutor</p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Live Demo Simulation Section */}
      <section id="demo" className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <span className="font-mono text-xs tracking-[0.25em] uppercase text-neon-cyan font-semibold">
            Interactive Experience
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mt-1">
            See the One-Click Study Engine in Action
          </h2>
          <p className="text-void-300 text-sm max-w-lg mx-auto mt-2">
            Ask any question in AI Chat — ScholarAI automatically creates custom study packs without re-typing.
          </p>
        </div>

        {/* Demo Mockup Container */}
        <div className="glass-modern rounded-3xl p-5 md:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
          {/* Decorative glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none" />

          {/* Window Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-2 text-xs font-mono text-void-400">ScholarAI • Chat & Study Deck Session</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-void-300">
              <span className="w-2 h-2 rounded-full bg-neon-lime animate-pulse" />
              <span className="font-mono text-[11px]">AI Model: Online</span>
            </div>
          </div>

          {/* Chat Stream Mockup */}
          <div className="space-y-4 mb-6">
            {/* User message */}
            <div className="flex justify-end">
              <div className="max-w-md rounded-2xl px-5 py-3 bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-medium text-sm shadow-md">
                Can you explain the key differences between Mitosis and Meiosis for my exam?
              </div>
            </div>

            {/* AI Assistant response */}
            <div className="flex flex-col items-start max-w-2xl">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-full bg-neon-cyan/20 border border-neon-cyan/40 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-neon-cyan" />
                </div>
                <span className="text-xs font-semibold text-white">ScholarAI</span>
                <span className="text-[10px] text-void-400 font-mono">Grounded Summary</span>
              </div>

              <div className="glass-modern rounded-2xl p-5 border border-white/[0.08] text-sm text-void-100 space-y-2.5 leading-relaxed">
                <p>
                  <strong className="text-white">Mitosis</strong> produces <strong className="text-neon-cyan">two genetically identical diploid cells</strong> used for cellular growth and tissue repair.
                </p>
                <p>
                  <strong className="text-white">Meiosis</strong> involves two rounds of division to produce <strong className="text-neon-pink">four genetically diverse haploid gametes</strong> (sperm/egg), featuring genetic crossover in Prophase I.
                </p>
              </div>

              {/* Live Study Conversion Shelf */}
              <div className="mt-3 p-2.5 rounded-2xl bg-void-900/90 border border-white/10 w-full flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-void-300 flex items-center gap-1.5 px-2">
                  <Sparkles className="w-3.5 h-3.5 text-neon-cyan" />
                  Convert to Study Pack:
                </span>

                <button
                  onClick={() => setActiveTab("quiz")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "quiz"
                      ? "bg-neon-cyan text-void-950 shadow-sm shadow-neon-cyan/30"
                      : "bg-void-800 text-void-300 hover:text-white border border-white/5"
                  }`}
                >
                  <Brain className="w-3.5 h-3.5" />
                  <span>Generate Quiz</span>
                </button>

                <button
                  onClick={() => setActiveTab("flashcard")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "flashcard"
                      ? "bg-neon-pink text-void-950 shadow-sm shadow-neon-pink/30"
                      : "bg-void-800 text-void-300 hover:text-white border border-white/5"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Make Flashcards</span>
                </button>

                <button
                  onClick={() => setActiveTab("mindmap")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === "mindmap"
                      ? "bg-neon-lime text-void-950 shadow-sm shadow-neon-lime/30"
                      : "bg-void-800 text-void-300 hover:text-white border border-white/5"
                  }`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Create Mind Map</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Simulation Preview Box */}
          <div className="rounded-2xl p-5 bg-void-950/80 border border-white/[0.08] backdrop-blur-md">
            <div className="flex items-center justify-between mb-3 text-xs text-void-400">
              <span className="font-mono uppercase tracking-wider">
                Generated Preview: {activeTab.toUpperCase()}
              </span>
              <span className="text-neon-cyan font-medium flex items-center gap-1">
                <Check className="w-3 h-3" /> Topic Pre-filled: "Mitosis vs Meiosis"
              </span>
            </div>

            {activeTab === "flashcard" && (
              <div className="glass-modern rounded-xl p-5 border border-neon-pink/30 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neon-pink uppercase tracking-wider">Card 1 of 12</span>
                  <p className="text-sm font-semibold text-white">
                    What primary mechanism in Prophase I introduces genetic diversity in Meiosis?
                  </p>
                  <p className="text-xs text-void-300 mt-1">Answer: Homologous crossover (chiasmata exchange)</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-neon-pink/10 border border-neon-pink/30 flex items-center justify-center shrink-0">
                  <RotateCw className="w-4 h-4 text-neon-pink animate-spin" style={{ animationDuration: "10s" }} />
                </div>
              </div>
            )}

            {activeTab === "quiz" && (
              <div className="glass-modern rounded-xl p-5 border border-neon-cyan/30 space-y-2">
                <span className="text-[10px] font-mono text-neon-cyan uppercase tracking-wider">Sample MCQ Question</span>
                <p className="text-sm font-semibold text-white">
                  Which process results in daughter cells identical to the parent cell?
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="p-2 rounded-lg bg-neon-cyan/10 border border-neon-cyan/40 text-xs text-white font-medium">
                    ✓ A) Mitosis
                  </div>
                  <div className="p-2 rounded-lg bg-void-900 border border-white/5 text-xs text-void-400">
                    B) Meiosis I
                  </div>
                </div>
              </div>
            )}

            {activeTab === "mindmap" && (
              <div className="glass-modern rounded-xl p-5 border border-neon-lime/30 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-neon-lime uppercase tracking-wider">Visual Tree</span>
                  <p className="text-sm font-semibold text-white">
                    Cell Division Hierarchy $\rightarrow$ Mitosis (2n) vs. Meiosis (n)
                  </p>
                  <p className="text-xs text-void-300">Branches: Prophase, Metaphase, Anaphase, Telophase, Crossover</p>
                </div>
                <Share2 className="w-5 h-5 text-neon-lime shrink-0" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bento Grid Feature Showcase */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <span className="font-mono text-xs tracking-[0.25em] uppercase text-neon-violet font-semibold">
            All-In-One Study Suite
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mt-1">
            Built for how top students actually study
          </h2>
          <p className="text-void-300 text-sm max-w-xl mx-auto mt-2">
            No fragmented tools. Everything lives under one unified AI roof, fully synchronized.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {BENTO_FEATURES.map((f) => (
            <div
              key={f.title}
              className={`glass-bento rounded-3xl p-7 flex flex-col justify-between border border-white/[0.08] transition-all duration-300 hover:-translate-y-1.5 ${f.borderGlow} ${f.colSpan} group`}
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <f.icon className={`w-6 h-6 ${f.accent}`} />
                  </div>
                  <span className="text-[11px] font-mono font-medium text-void-300 bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1">
                    {f.badge}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-neon-cyan transition-colors">
                  {f.title}
                </h3>
                <p className="text-void-300 text-sm leading-relaxed mb-6">
                  {f.desc}
                </p>
              </div>

              <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
                <span className="font-mono text-void-400">{f.tag}</span>
                <span className="text-white font-medium flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Explore <ChevronRight className="w-3.5 h-3.5 text-neon-cyan" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Journey */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <span className="font-mono text-xs tracking-[0.25em] uppercase text-neon-cyan font-semibold">
            Simple 3-Step Flow
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mt-1">
            From lecture notes to mastery in minutes
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 relative">
          {STEPS.map((s) => (
            <div
              key={s.num}
              className="glass-modern rounded-3xl p-8 border border-white/[0.08] relative group hover:border-neon-cyan/40 transition-all duration-300"
            >
              <span className="text-4xl font-display font-black text-white/10 group-hover:text-neon-cyan/30 transition-colors">
                {s.num}
              </span>
              <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center my-4">
                <s.icon className="w-5 h-5 text-neon-cyan" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-void-300 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Student Testimonials */}
      <section id="testimonials" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <span className="font-mono text-xs tracking-[0.25em] uppercase text-neon-pink font-semibold">
            Student Proof
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mt-1">
            Loved by ambitious students worldwide
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.author}
              className="glass-modern rounded-3xl p-7 border border-white/[0.08] flex flex-col justify-between"
            >
              <p className="text-void-200 text-sm leading-relaxed italic mb-6">
                "{t.quote}"
              </p>
              <div>
                <p className="text-white font-semibold text-sm">{t.author}</p>
                <p className="text-void-400 text-xs mt-0.5">
                  {t.role} • <span className="text-neon-cyan">{t.school}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Grand Call to Action */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <div className="glass-modern rounded-3xl p-10 md:p-14 border border-neon-violet/30 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -left-20 w-60 h-60 bg-neon-violet/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-neon-cyan/20 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
            Ready to upgrade your GPA?
          </h2>
          <p className="text-void-200 text-base max-w-lg mx-auto mb-8 leading-relaxed">
            Join thousands of students studying smarter with personalized AI tutor sessions, flashcards, and quizzes.
          </p>

          <Link
            to="/register"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-bold text-sm shadow-xl shadow-neon-violet/30 hover:scale-105 active:scale-95 transition-all"
          >
            <span>Create Your Free Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-void-400 mt-4 font-mono">No credit card required • Instant setup</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-void-950/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="font-display text-lg tracking-tight text-white inline-block mb-3">
              Scholar<span className="text-gradient-neon font-bold">AI</span>
            </Link>
            <p className="text-void-300 text-xs leading-relaxed max-w-xs mb-4">
              Autonomous AI study partner built for rapid comprehension and active recall.
            </p>
            <div className="flex items-center gap-2 text-xs text-neon-lime font-mono">
              <span className="w-2 h-2 rounded-full bg-neon-lime animate-pulse" />
              <span>All Systems Operational</span>
            </div>
          </div>

          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Study Suite</h4>
            <ul className="space-y-2 text-xs text-void-300">
              <li><Link to="/study/quiz" className="hover:text-white transition-colors">Quiz Generator</Link></li>
              <li><Link to="/study/flashcards/new" className="hover:text-white transition-colors">3D Flashcards</Link></li>
              <li><Link to="/study/notes/new" className="hover:text-white transition-colors">Revision Notes</Link></li>
              <li><Link to="/study/mindmap/new" className="hover:text-white transition-colors">Mind Maps</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Resources</h4>
            <ul className="space-y-2 text-xs text-void-300">
              <li><a href="#features" className="hover:text-white transition-colors">Core Features</a></li>
              <li><a href="#demo" className="hover:text-white transition-colors">Interactive Demo</a></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Student Login</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Free Registration</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Community</h4>
            <div className="flex items-center gap-3 text-void-300 mb-4">
              <Github className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
              <Twitter className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
              <Linkedin className="w-4 h-4 hover:text-white transition-colors cursor-pointer" />
            </div>
            <p className="text-[11px] text-void-400 font-mono">
              © {new Date().getFullYear()} ScholarAI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
