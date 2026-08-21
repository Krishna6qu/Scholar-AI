import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Send, Plus, MessageSquare, LayoutDashboard, Brain, LogOut, Trash2, Paperclip, X, Settings, Copy, Check, ThumbsUp, ThumbsDown, Map, UserX } from "lucide-react";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Two race conditions this guards against, both real and reproducible:
  //
  // 1. Switching chats quickly: if chatId changes again before an in-flight
  //    GET /chats/:id resolves, the earlier request's response can land
  //    *after* the newer one and overwrite it with stale messages.
  //    fetchIdRef ignores any response that isn't from the latest request.
  //
  // 2. Sending the first message of a brand-new chat: creating the chat and
  //    navigating to /chat/:id triggers this same effect, whose GET request
  //    races with the in-flight POST /chats/:id/messages call already
  //    building the message list optimistically — causing the assistant's
  //    reply to either flash-and-vanish or appear twice. justCreatedChatId
  //    tells the effect to skip its fetch for a chat this component just
  //    created itself, since local state is already correct for it.
  const fetchIdRef = useRef(0);
  const justCreatedChatId = useRef<string | null>(null);

  // Load the chat list once, and whenever a chat finishes sending (title may
  // have just been set from the first message).
  async function refreshChatList() {
    const { data } = await api.get<ChatSummary[]>("/chats");
    setChats(data);
  }

  useEffect(() => {
    refreshChatList();
  }, []);

  // Load messages whenever the active chat changes.
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
          setMessages(data.messages);
        }
      })
      .finally(() => {
        if (requestId === fetchIdRef.current) setLoadingChat(false);
      });
  }, [chatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ id: string; name: string; content: string | null } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

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
    } finally {
      setFileLoading(false);
    }
  }

  async function handleCopy(id: string, content: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
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
      // Revert on failure
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, feedback: current } : m))
      );
    }
  }

  async function handleDeleteChat(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this chat? This can't be undone.")) return;

    await api.delete(`/chats/${id}`);
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (id === chatId) navigate("/chat");
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if ((!content && !attachedFile) || sending) return;

    setSending(true);
    setDraft("");
    const fileToSend = attachedFile;
    setAttachedFile(null);

    try {
      let activeChatId = chatId;

      // No chat selected yet — this is the "just type and go" flow. Create a
      // new chat first (no title, no upload needed), then send into it.
      if (!activeChatId) {
        const { data: newChat } = await api.post("/chats", {});
        activeChatId = newChat.id;
        justCreatedChatId.current = activeChatId;
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

      const bodyText = content || (fileToSend ? "Please review the attached file and let me know what you can help with." : "");
      const fullContent = fileMarker ? `${fileMarker}\n${bodyText}` : bodyText;

      // Optimistically show the user's message immediately.
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
      const detail = err.response?.data?.detail;
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: "system",
          content: typeof detail === "string" ? detail : "Something went wrong reaching the AI. Please try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-void-950 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-void-700/60 h-screen sticky top-0 px-5 py-6">
        <Link to="/" className="font-display text-lg tracking-tight text-white mb-8">
          Scholar<span className="text-gradient-neon">AI</span>
        </Link>

        <button
          onClick={() => navigate("/chat")}
          className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-semibold mb-5 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New chat
        </button>

        <nav className="space-y-1 text-sm mb-5">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-void-800 text-white">
            <MessageSquare className="w-4 h-4 text-neon-cyan" />
            AI Chat
          </div>
          <Link
            to="/study"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <Brain className="w-4 h-4" />
            Study Pack
          </Link>
          <Link
            to="/roadmap/new"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors"
          >
            <Map className="w-4 h-4" />
            Roadmap
          </Link>
        </nav>

        <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-1">
          <p className="text-xs text-void-400 px-1 mb-2 uppercase tracking-wider">Chats</p>
          {chats.length === 0 && (
            <p className="text-xs text-void-400 px-1">No chats yet — start one below.</p>
          )}
          {chats.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center gap-1 rounded-lg transition-colors ${
                c.id === chatId ? "bg-void-800" : "hover:bg-void-800/60"
              }`}
            >
              <Link
                to={`/chat/${c.id}`}
                className={`flex-1 min-w-0 truncate text-sm px-3 py-2 ${
                  c.id === chatId ? "text-white" : "text-void-300 group-hover:text-white"
                }`}
              >
                {c.title || "New chat"}
              </Link>
              <button
                onClick={(e) => handleDeleteChat(e, c.id)}
                title="Delete chat"
                className="opacity-0 group-hover:opacity-100 text-void-400 hover:text-neon-pink transition-opacity px-2 py-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <Link
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm mt-4"
        >
          <Settings className="w-4 h-4" />
          Profile & Settings
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-void-300 hover:text-white hover:bg-void-800/60 transition-colors text-sm"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
        <Link
          to="/settings"
          state={{ openTab: "security" }}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-neon-pink/70 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors text-sm"
        >
          <UserX className="w-4 h-4" />
          Delete account
        </Link>
      </aside>

      {/* Main chat panel */}
      <main className="flex-1 flex flex-col h-screen">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 md:px-10 py-8">
          {!chatId && messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <p className="font-mono text-xs tracking-[0.3em] uppercase text-neon-cyan mb-3">
                AI Chat
              </p>
              <h1 className="text-3xl text-white mb-3">What are you studying today?</h1>
              <p className="text-void-300 text-sm">
                Ask about any topic, paste a question, or just say hi — no file
                upload needed to get started.
              </p>
            </div>
          ) : loadingChat ? (
            <p className="text-void-300 text-sm text-center mt-10">Loading…</p>
          ) : (
            <div className="max-w-2xl mx-auto space-y-5">
              {messages.map((m) => {
                const fileInfo = m.sender === "user" ? parseFileMarker(m.content) : null;
                const displayText = fileInfo ? fileInfo.rest : m.content;

                return (
                  <div key={m.id} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}>
                    {fileInfo && (
                      <button
                        onClick={() => handleOpenFile(fileInfo.fileId, fileInfo.fileName)}
                        className="flex items-center gap-2 mb-1.5 text-xs bg-void-800 border border-void-600 rounded-xl px-3 py-2 hover:border-neon-violet transition-colors max-w-[80%]"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-neon-cyan shrink-0" />
                        <span className="truncate text-void-100">{fileInfo.fileName}</span>
                      </button>
                    )}

                    {displayText && (
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          m.sender === "user"
                            ? "bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-medium whitespace-pre-wrap"
                            : m.sender === "system"
                            ? "bg-neon-pink/10 border border-neon-pink/30 text-neon-pink whitespace-pre-wrap"
                            : "glass text-void-100"
                        }`}
                      >
                        {m.sender === "assistant" ? (
                          <div className="prose-chat">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayText}</ReactMarkdown>
                          </div>
                        ) : (
                          displayText
                        )}
                      </div>
                    )}

                  {m.sender === "assistant" && (
                    <div className="flex items-center gap-1 mt-1.5 px-1">
                      <button
                        onClick={() => handleCopy(m.id, m.content)}
                        title="Copy"
                        className="p-1.5 rounded-md text-void-400 hover:text-white hover:bg-void-800 transition-colors"
                      >
                        {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-neon-lime" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleFeedback(m.id, "like")}
                        title="Good response"
                        className={`p-1.5 rounded-md transition-colors ${
                          m.feedback === "like" ? "text-neon-lime bg-void-800" : "text-void-400 hover:text-white hover:bg-void-800"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(m.id, "dislike")}
                        title="Bad response"
                        className={`p-1.5 rounded-md transition-colors ${
                          m.feedback === "dislike" ? "text-neon-pink bg-void-800" : "text-void-400 hover:text-white hover:bg-void-800"
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-start">
                  <div className="glass rounded-2xl px-4 py-3 text-sm text-void-300">
                    Thinking…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="border-t border-void-700/60 px-6 md:px-10 py-4"
        >
          <div className="max-w-2xl mx-auto">
            {attachedFile && (
              <div className="flex items-center gap-2 mb-2 text-xs text-void-200 bg-void-800 border border-void-600 rounded-full px-3 py-1.5 w-fit">
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-[200px]">{attachedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-void-400 hover:text-neon-pink"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
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
                title="Attach a file"
                className="w-11 h-11 shrink-0 rounded-full border border-void-600 flex items-center justify-center text-void-300 hover:text-white hover:border-void-400 transition-colors"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about any topic — e.g. 'Explain photosynthesis' or 'Help me with derivatives'"
                className="flex-1 rounded-full border border-void-600 bg-void-900 px-5 py-3 text-sm text-white placeholder-void-400 focus:outline-none focus:ring-2 focus:ring-neon-violet"
              />
              <button
                type="submit"
                disabled={sending || (!draft.trim() && !attachedFile)}
                className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan flex items-center justify-center text-void-950 disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* File viewer modal */}
      {viewingFile && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setViewingFile(null)}
        >
          <div
            className="glass rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-void-700/60">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="w-4 h-4 text-neon-cyan shrink-0" />
                <span className="text-white text-sm truncate">{viewingFile.name}</span>
              </div>
              <button
                onClick={() => setViewingFile(null)}
                className="text-void-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {fileLoading ? (
                <p className="text-sm text-void-300">Loading…</p>
              ) : viewingFile.content ? (
                <pre className="text-sm text-void-100 whitespace-pre-wrap font-mono">{viewingFile.content}</pre>
              ) : (
                <p className="text-sm text-void-300">
                  This file type isn't supported for preview yet — only the file itself was stored.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
