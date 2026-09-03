import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Send,
  Plus,
  MessageSquare,
  LayoutDashboard,
  Brain,
  LogOut,
  Trash2,
  Paperclip,
  X,
  Settings,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Map,
  UserX,
  Sparkles,
  Download,
  Edit2,
  Search,
  Menu,
  BookOpen,
  Layers,
  GraduationCap,
  Lightbulb,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface ChatSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

interface Message {
  id: string;
  sender: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  feedback?: "like" | "dislike" | null;
}

type StudyMode = "tutor" | "concise" | "socratic";

const STUDY_MODES: Record<StudyMode, { label: string; desc: string; icon: any; promptModifier: string }> = {
  tutor: {
    label: "AI Tutor",
    desc: "Detailed step-by-step explanations with analogies",
    icon: GraduationCap,
    promptModifier: "",
  },
  concise: {
    label: "Fast Revision",
    desc: "Concise bulleted summaries for quick review",
    icon: Zap,
    promptModifier: "[Mode: Provide concise, high-yield bulleted points focused on exam review]\n",
  },
  socratic: {
    label: "Socratic Method",
    desc: "Guides you by asking thoughtful questions",
    icon: Lightbulb,
    promptModifier: "[Mode: Use the Socratic method — ask guiding questions to help me arrive at the answer]\n",
  },
};

const STARTER_PROMPTS = [
  {
    title: "Explain with Real-World Analogies",
    prompt: "Can you explain how neural networks work using a simple real-world analogy?",
    icon: Sparkles,
    accent: "text-neon-violet",
  },
  {
    title: "Generate a 5-Step Study Plan",
    prompt: "Create a 5-step active recall study plan to prepare for a college exam in one week.",
    icon: BookOpen,
    accent: "text-neon-cyan",
  },
  {
    title: "Quiz My Understanding",
    prompt: "Ask me 3 conceptual questions about thermodynamics and wait for my answers before grading them.",
    icon: Brain,
    accent: "text-neon-pink",
  },
  {
    title: "Debug & Explain Code",
    prompt: "I want to understand Dijkstra's shortest path algorithm. Can you break down how it works step-by-step?",
    icon: Zap,
    accent: "text-neon-lime",
  },
];

export default function ChatPage() {
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId?: string }>();
  const logout = useAuthStore((s) => s.logout);

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("tutor");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [codeCopiedIdx, setCodeCopiedIdx] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Inline rename state
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitleDraft, setEditTitleDraft] = useState("");

  // File preview modal
  const [viewingFile, setViewingFile] = useState<{ id: string; name: string; content: string | null } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchIdRef = useRef(0);
  const justCreatedChatId = useRef<string | null>(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
  }, [draft]);

  // Load chat list
  async function refreshChatList() {
    try {
      const { data } = await api.get<ChatSummary[]>("/chats");
      setChats(data);
    } catch (err) {
      console.error("Failed to fetch chat list:", err);
    }
  }

  useEffect(() => {
    refreshChatList();
  }, []);

  // Load active chat messages
  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    if (justCreatedChatId.current === chatId) {
      justCreatedChatId.current = null;
      return;
    }

    const requestId = ++fetchIdRef.current;
    setLoadingChat(true);
    api
      .get(`/chats/${chatId}`)
      .then(({ data }) => {
        if (requestId === fetchIdRef.current) {
          setMessages(data.messages || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load chat:", err);
      })
      .finally(() => {
        if (requestId === fetchIdRef.current) setLoadingChat(false);
      });
  }, [chatId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, sending]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function parseFileMarker(content: string): { fileId: string; fileName: string; rest: string } | null {
    const match = content.match(/^\[\[file:([^|]+)\|([^\]]+)\]\]\n?([\s\S]*)$/);
    if (!match) return null;
    return { fileId: match[1], fileName: match[2], rest: match[3] };
  }

  async function handleOpenFile(fileId: string, fileName: string) {
    setViewingFile({ id: fileId, name: fileName, content: null });
    setFileLoading(true);
    try {
      const { data } = await api.get(`/files/${fileId}`);
      setViewingFile({ id: fileId, name: fileName, content: data.content });
    } catch {
      setViewingFile({ id: fileId, name: fileName, content: "Could not preview file." });
    } finally {
      setFileLoading(false);
    }
  }

  async function handleCopy(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  }

  async function handleCopyCode(codeText: string, idx: number) {
    try {
      await navigator.clipboard.writeText(codeText);
      setCodeCopiedIdx(idx);
      setTimeout(() => setCodeCopiedIdx(null), 1500);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  }

  async function handleFeedback(messageId: string, value: "like" | "dislike") {
    if (!chatId) return;
    const current = messages.find((m) => m.id === messageId)?.feedback;
    const next = current === value ? null : value;

    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback: next } : m))
    );

    try {
      await api.patch(`/chats/${chatId}/messages/${messageId}/feedback`, { feedback: next });
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: current } : m))
      );
    }
  }

  async function handleDeleteChat(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this chat? This can't be undone.")) return;

    try {
      await api.delete(`/chats/${id}`);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (id === chatId) navigate("/chat");
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  }

  async function handleSaveRename(id: string) {
    if (!editTitleDraft.trim()) {
      setEditingChatId(null);
      return;
    }
    try {
      await api.patch(`/chats/${id}`, { title: editTitleDraft.trim() });
      setChats((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: editTitleDraft.trim() } : c))
      );
    } catch (err) {
      console.error("Failed to rename chat:", err);
    } finally {
      setEditingChatId(null);
    }
  }

  // Export conversation transcript as Markdown
  function handleExportChat() {
    if (messages.length === 0) return;
    const activeChat = chats.find((c) => c.id === chatId);
    const title = activeChat?.title || "ScholarAI_Chat";
    let md = `# ${title}\n\n*Exported from ScholarAI on ${new Date().toLocaleDateString()}*\n\n---\n\n`;

    messages.forEach((m) => {
      const senderName = m.sender === "user" ? "Student" : m.sender === "assistant" ? "ScholarAI" : "System";
      md += `### ${senderName} (${new Date(m.created_at).toLocaleTimeString()}):\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Submit Message handler
  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const content = draft.trim();
    if ((!content && !attachedFile) || sending) return;

    setSending(true);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const fileToSend = attachedFile;
    setAttachedFile(null);

    try {
      let activeChatId = chatId;

      // If no active chat, create it first
      if (!activeChatId) {
        const { data: newChat } = await api.post("/chats", {});
        activeChatId = newChat.id;
        justCreatedChatId.current = activeChatId ?? null;
        navigate(`/chat/${activeChatId}`, { replace: true });
      }

      let fileMarker = "";
      if (fileToSend) {
        const formData = new FormData();
        formData.append("file", fileToSend);
        formData.append("chat_id", activeChatId!);
        const { data: uploadedFile } = await api.post("/files", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        fileMarker = `[[file:${uploadedFile.id}|${uploadedFile.original_name}]]`;
      }

      const modePrefix = STUDY_MODES[studyMode].promptModifier;
      const rawText = content || (fileToSend ? "Please analyze this attached document and provide a clear overview." : "");
      const bodyText = modePrefix ? `${modePrefix}${rawText}` : rawText;
      const fullContent = fileMarker ? `${fileMarker}\n${bodyText}` : bodyText;

      // Optimistic user message
      setMessages((prev) => [
        ...prev,
        { id: `temp-${Date.now()}`, sender: "user", content: fullContent, created_at: new Date().toISOString() },
      ]);

      const { data: assistantMessage } = await api.post(`/chats/${activeChatId}/messages`, {
        content: fullContent,
      });

      setMessages((prev) => [...prev, assistantMessage]);
      refreshChatList();
    } catch (err: any) {
      console.error("Chat send error:", err);
      const detail = err.response?.data?.detail;
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: "system",
          content: typeof detail === "string" ? detail : "Something went wrong reaching the AI. Please verify your connection or try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  // Handle textarea enter key
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Filtered chats for sidebar
  const filteredChats = useMemo(() => {
    if (!searchFilter.trim()) return chats;
    const q = searchFilter.toLowerCase();
    return chats.filter((c) => (c.title || "New chat").toLowerCase().includes(q));
  }, [chats, searchFilter]);

  const activeChat = chats.find((c) => c.id === chatId);

  return (
    <div className="relative min-h-screen bg-void-950 flex overflow-hidden">
      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 z-40 h-screen w-72 shrink-0 border-r border-void-700/60 bg-void-950/95 md:bg-void-950/70 backdrop-blur-xl flex flex-col px-5 py-6 transition-transform duration-300 ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="font-display text-lg tracking-tight text-white">
            Scholar<span className="text-gradient-neon">AI</span>
          </Link>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden text-void-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => {
            navigate("/chat");
            setIsMobileMenuOpen(false);
          }}
          className="flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-semibold mb-4 shadow-neon-violet hover:opacity-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>

        {/* Navigation links */}
        <nav className="space-y-1 text-sm mb-4">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-void-800/90 text-white font-medium">
            <MessageSquare className="w-4 h-4 text-neon-cyan" />
            <span>AI Chat</span>
          </div>
          <Link
            to="/study"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <Brain className="w-4 h-4" />
            <span>Study Pack</span>
          </Link>
          <Link
            to="/roadmap/new"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <Map className="w-4 h-4" />
            <span>Roadmap</span>
          </Link>
        </nav>

        {/* Search Chat Input */}
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 text-void-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter chats…"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full rounded-lg border border-void-700 bg-void-900/80 pl-8 pr-3 py-1.5 text-xs text-white placeholder-void-400 focus:outline-none focus:border-neon-cyan"
          />
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
          <p className="text-[11px] font-mono text-void-400 px-1 mb-1 uppercase tracking-wider">
            History ({filteredChats.length})
          </p>

          {filteredChats.length === 0 && (
            <p className="text-xs text-void-400 px-1 py-4 text-center">
              {searchFilter ? "No matching chats" : "No chats yet"}
            </p>
          )}

          {filteredChats.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-xl transition-all duration-200 ${
                c.id === chatId ? "bg-void-800 border border-void-600/60" : "hover:bg-void-800/50"
              }`}
            >
              {editingChatId === c.id ? (
                <div className="flex-1 flex items-center gap-1 px-2 py-1">
                  <input
                    type="text"
                    value={editTitleDraft}
                    onChange={(e) => setEditTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename(c.id);
                      if (e.key === "Escape") setEditingChatId(null);
                    }}
                    autoFocus
                    className="flex-1 bg-void-900 text-xs text-white px-2 py-1 rounded border border-neon-cyan focus:outline-none"
                  />
                  <button
                    onClick={() => handleSaveRename(c.id)}
                    className="text-neon-cyan p-1 hover:text-white"
                    title="Save"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setEditingChatId(null)}
                    className="text-void-400 p-1 hover:text-white"
                    title="Cancel"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to={`/chat/${c.id}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex-1 min-w-0 truncate text-xs px-3 py-2.5 ${
                      c.id === chatId ? "text-white font-medium" : "text-void-300 group-hover:text-white"
                    }`}
                  >
                    {c.title || "New chat"}
                  </Link>

                  <div className="opacity-0 group-hover:opacity-100 flex items-center pr-1 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingChatId(c.id);
                        setEditTitleDraft(c.title || "");
                      }}
                      title="Rename chat"
                      className="text-void-400 hover:text-white p-1"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteChat(e, c.id)}
                      title="Delete chat"
                      className="text-void-400 hover:text-neon-pink p-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Bottom user navigation */}
        <div className="pt-4 border-t border-void-700/60 space-y-1">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-xs"
          >
            <Settings className="w-4 h-4" />
            <span>Profile & Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
          <Link
            to="/settings"
            state={{ openTab: "security" }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-neon-pink/70 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors text-xs"
          >
            <UserX className="w-4 h-4" />
            <span>Delete account</span>
          </Link>
        </div>
      </aside>

      {/* Main Chat Panel */}
      <main className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Chat Header */}
        <header className="px-6 py-3 border-b border-void-700/60 bg-void-950/60 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-void-300 hover:text-white p-1 rounded-lg border border-void-700"
              title="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
                <h2 className="text-sm font-semibold text-white truncate max-w-xs md:max-w-md">
                  {activeChat?.title || "AI Study Partner"}
                </h2>
              </div>
              <p className="text-[11px] text-void-400 font-mono hidden sm:block">
                Powered by Gemini 3.6 Flash
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Study Mode Selector */}
            <div className="flex items-center bg-void-900 border border-void-700/80 rounded-xl p-0.5">
              {(Object.keys(STUDY_MODES) as StudyMode[]).map((mKey) => {
                const item = STUDY_MODES[mKey];
                const Icon = item.icon;
                const isCurrent = studyMode === mKey;
                return (
                  <button
                    key={mKey}
                    onClick={() => setStudyMode(mKey)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isCurrent
                        ? "bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                        : "text-void-400 hover:text-white"
                    }`}
                    title={item.desc}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Export Chat Button */}
            {messages.length > 0 && (
              <button
                onClick={handleExportChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-void-700 bg-void-900/80 text-void-200 hover:text-white text-xs transition-colors"
                title="Export conversation as Markdown"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            )}
          </div>
        </header>

        {/* Message View Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-10 py-6">
          {!chatId && messages.length === 0 ? (
            /* Empty state with engaging starter prompts */
            <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-violet/30 to-neon-cyan/30 border border-neon-cyan/40 flex items-center justify-center mb-4 shadow-neon-cyan/20 shadow-lg animate-float">
                <Sparkles className="w-6 h-6 text-neon-cyan" />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white mb-2">
                What are you studying today?
              </h1>
              <p className="text-void-300 text-sm max-w-md mb-8 leading-relaxed">
                Ask about complex topics, paste practice problems, or attach your lecture notes.
              </p>

              {/* Starter cards */}
              <div className="grid sm:grid-cols-2 gap-3 w-full text-left">
                {STARTER_PROMPTS.map((starter) => (
                  <button
                    key={starter.title}
                    onClick={() => {
                      setDraft(starter.prompt);
                      textareaRef.current?.focus();
                    }}
                    className="glass rounded-xl p-4 border border-void-700/60 hover:border-neon-cyan/50 transition-all duration-200 hover:-translate-y-0.5 text-left group"
                  >
                    <starter.icon className={`w-4 h-4 mb-2 ${starter.accent}`} />
                    <p className="text-xs font-semibold text-white group-hover:text-neon-cyan transition-colors">
                      {starter.title}
                    </p>
                    <p className="text-[11px] text-void-400 mt-1 line-clamp-2">
                      {starter.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : loadingChat ? (
            <div className="flex flex-col items-center justify-center h-64 text-void-300 text-xs">
              <Sparkles className="w-5 h-5 text-neon-cyan animate-spin mb-2" style={{ animationDuration: "3s" }} />
              <span>Loading conversation…</span>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m) => {
                const fileInfo = m.sender === "user" ? parseFileMarker(m.content) : null;
                const displayText = fileInfo ? fileInfo.rest : m.content;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* Attached file card preview */}
                    {fileInfo && (
                      <button
                        onClick={() => handleOpenFile(fileInfo.fileId, fileInfo.fileName)}
                        className="flex items-center gap-2 mb-1.5 text-xs bg-void-800 border border-void-600 rounded-xl px-3 py-2 hover:border-neon-violet transition-colors max-w-[85%]"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                        <span className="truncate text-void-100 font-medium">{fileInfo.fileName}</span>
                      </button>
                    )}

                    {/* Message Bubble */}
                    {displayText && (
                      <div
                        className={`max-w-[88%] md:max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-lg ${
                          m.sender === "user"
                            ? "bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-medium whitespace-pre-wrap"
                            : m.sender === "system"
                            ? "bg-neon-pink/10 border border-neon-pink/30 text-neon-pink whitespace-pre-wrap"
                            : "glass text-void-100 border border-void-700/60"
                        }`}
                      >
                        {m.sender === "assistant" ? (
                          <div className="prose-chat overflow-x-auto">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || "");
                                  const codeContent = String(children).replace(/\n$/, "");
                                  if (!inline && match) {
                                    return (
                                      <div className="my-3 rounded-xl overflow-hidden border border-void-700 bg-void-950">
                                        <div className="flex items-center justify-between px-3.5 py-1.5 bg-void-900 border-b border-void-700/60 text-[11px] font-mono text-void-300">
                                          <span>{match[1]}</span>
                                          <button
                                            onClick={() => handleCopyCode(codeContent, m.id.length)}
                                            className="flex items-center gap-1 text-void-400 hover:text-white"
                                          >
                                            {codeCopiedIdx === m.id.length ? (
                                              <>
                                                <Check className="w-3 h-3 text-neon-lime" />
                                                <span className="text-neon-lime">Copied</span>
                                              </>
                                            ) : (
                                              <>
                                                <Copy className="w-3 h-3" />
                                                <span>Copy</span>
                                              </>
                                            )}
                                          </button>
                                        </div>
                                        <pre className="p-3.5 text-xs text-void-100 overflow-x-auto font-mono leading-relaxed">
                                          <code>{children}</code>
                                        </pre>
                                      </div>
                                    );
                                  }
                                  return (
                                    <code className="bg-void-800 px-1.5 py-0.5 rounded text-neon-cyan font-mono text-xs" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                              }}
                            >
                              {displayText}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          displayText
                        )}
                      </div>
                    )}

                    {/* Assistant Message Quick Actions */}
                    {m.sender === "assistant" && (
                      <div className="flex items-center gap-1.5 mt-2 px-1 text-xs text-void-400">
                        <button
                          onClick={() => handleCopy(m.id, m.content)}
                          title="Copy answer"
                          className="flex items-center gap-1 p-1.5 rounded-lg hover:text-white hover:bg-void-800 transition-colors"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3.5 h-3.5 text-neon-lime" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleFeedback(m.id, "like")}
                          title="Helpful response"
                          className={`p-1.5 rounded-lg transition-colors ${
                            m.feedback === "like"
                              ? "text-neon-lime bg-void-800"
                              : "hover:text-white hover:bg-void-800"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleFeedback(m.id, "dislike")}
                          title="Unhelpful response"
                          className={`p-1.5 rounded-lg transition-colors ${
                            m.feedback === "dislike"
                              ? "text-neon-pink bg-void-800"
                              : "hover:text-white hover:bg-void-800"
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>

                        <span className="w-px h-3 bg-void-700 mx-1" />

                        {/* One-click study conversions */}
                        <button
                          onClick={() => navigate("/study/flashcards/new")}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-void-900 border border-void-700 hover:border-neon-pink text-void-300 hover:text-white transition-colors"
                          title="Create flashcards from this topic"
                        >
                          <Layers className="w-3 h-3 text-neon-pink" />
                          <span>Make Flashcards</span>
                        </button>

                        <button
                          onClick={() => navigate("/study/quiz")}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-void-900 border border-void-700 hover:border-neon-cyan text-void-300 hover:text-white transition-colors"
                          title="Generate a quiz on this topic"
                        >
                          <Brain className="w-3 h-3 text-neon-cyan" />
                          <span>Quiz Me</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Animated 3-dot Typing Indicator */}
              {sending && (
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-void-800 border border-void-600 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-neon-cyan animate-pulse" />
                  </div>
                  <div className="glass rounded-2xl px-4 py-3 flex items-center gap-1.5 shadow-md">
                    <span className="w-2 h-2 rounded-full bg-neon-cyan animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-neon-violet animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-neon-pink animate-bounce" style={{ animationDelay: "300ms" }} />
                    <span className="text-xs text-void-300 ml-2 font-mono">ScholarAI is thinking…</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Multi-Line Expanding Composer */}
        <form
          onSubmit={handleSend}
          className="border-t border-void-700/60 bg-void-950/70 backdrop-blur-xl px-4 md:px-10 py-4"
        >
          <div className="max-w-3xl mx-auto">
            {/* Attached file chip */}
            {attachedFile && (
              <div className="flex items-center gap-2 mb-2 text-xs text-void-200 bg-void-800 border border-void-600 rounded-full px-3 py-1.5 w-fit">
                <Paperclip className="w-3 h-3 text-neon-cyan" />
                <span className="truncate max-w-[220px] font-medium">{attachedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-void-400 hover:text-neon-pink"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className="relative flex items-end gap-2 bg-void-900 border border-void-600 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-neon-cyan focus-within:border-transparent transition-all">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => setAttachedFile(e.target.files?.[0] ?? null)}
                className="hidden"
                accept=".txt,.md,.csv,.pdf,.docx,.pptx,.xlsx"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach document or notes"
                className="p-2.5 rounded-xl text-void-400 hover:text-white hover:bg-void-800 transition-colors shrink-0 mb-0.5"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder="Ask about any concept, problem, or topic… (Shift+Enter for newline)"
                className="flex-1 bg-transparent text-sm text-white placeholder-void-400 focus:outline-none resize-none py-2 px-1 max-h-40 leading-relaxed font-sans"
              />

              <button
                type="submit"
                disabled={sending || (!draft.trim() && !attachedFile)}
                className="p-2.5 rounded-xl bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0 mb-0.5 shadow-md shadow-neon-violet/20"
                title="Send message (Enter)"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] text-void-400 text-center mt-2 font-mono">
              Press <kbd className="px-1 py-0.5 rounded bg-void-800 border border-void-700">Enter</kbd> to send • <kbd className="px-1 py-0.5 rounded bg-void-800 border border-void-700">Shift + Enter</kbd> for new line
            </p>
          </div>
        </form>
      </main>

      {/* File Viewer Modal */}
      {viewingFile && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setViewingFile(null)}
        >
          <div
            className="glass rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-void-600 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-void-700/60">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 text-neon-cyan shrink-0" />
                <span className="text-white text-sm font-semibold truncate">{viewingFile.name}</span>
              </div>
              <button
                onClick={() => setViewingFile(null)}
                className="text-void-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 flex-1">
              {fileLoading ? (
                <p className="text-sm text-void-300">Loading document content…</p>
              ) : viewingFile.content ? (
                <pre className="text-xs text-void-100 whitespace-pre-wrap font-mono leading-relaxed bg-void-950 p-4 rounded-xl border border-void-800">
                  {viewingFile.content}
                </pre>
              ) : (
                <p className="text-sm text-void-300">
                  This file format preview is not available directly, but its contents are grounded in your AI session.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
