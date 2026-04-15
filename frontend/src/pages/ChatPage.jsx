import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ChatMessage from "../components/ChatMessage";
import Sidebar from "../components/Sidebar";
import {
  Send,
  Loader2,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Save,
  Plus,
  Upload,
  CheckCircle2,
  FileText,
  X,
  Trash2,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function ChatPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mcpAuth, setMcpAuth] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Check if a statement was previously uploaded
  useEffect(() => {
    if (!user) return;
    const checkUploadStatus = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/api/finance/upload-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.bank_statement_uploaded && data.bank_statement_filename) {
            setUploadedFile({
              name: data.bank_statement_filename,
              balance: data.bank_balance,
            });
          }
        }
      } catch { /* ignore */ }
    };
    checkUploadStatus();
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // Load conversation: from ?load= param or last conversation
  useEffect(() => {
    if (!user) return;
    const loadConversation = async (id) => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/api/chat-history/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const conv = await res.json();
          setMessages(conv.messages || []);
          setConversationId(conv.id);
        }
      } catch {
        // fail silently
      }
    };
    const loadId = searchParams.get("load");
    if (loadId) {
      // Clear the param so refresh doesn't re-load
      setSearchParams({}, { replace: true });
      loadConversation(loadId);
      return;
    }
    // Otherwise load last conversation
    const loadLast = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE}/api/chat-history?limit=1`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.conversations?.length > 0) {
          loadConversation(data.conversations[0].id);
        }
      } catch {
        // fail silently
      }
    };
    loadLast();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;

    const userMessage = {
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setMcpAuth(null); // clear any old auth banner

    try {
      const token = await getToken();
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout for MCP

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text.trim(), history }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errorMsg = `Server error (${res.status})`;
        try {
          const errData = await res.json();
          errorMsg = errData.detail || errorMsg;
        } catch {
          /* not JSON */
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();

      // Check if MCP auth is required
      if (data.requires_mcp_auth && data.auth_url) {
        setMcpAuth({ url: data.auth_url, pendingQuery: text.trim() });
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, timestamp: Date.now() },
      ]);
    } catch (err) {
      const errorText =
        err.name === "AbortError"
          ? "Request timed out. The server took too long to respond."
          : err.message;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${errorText}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryAfterAuth = () => {
    if (mcpAuth?.pendingQuery) {
      const query = mcpAuth.pendingQuery;
      setMcpAuth(null);
      setMessages((prev) => prev.slice(0, -1));
      sendMessage(query);
    }
  };

  const saveConversation = async () => {
    if (!messages.length || saving) return;
    setSaving(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat-history/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages }),
      });
      if (res.ok) {
        const data = await res.json();
        setConversationId(data.id);
      }
    } catch {
      // fail silently
    } finally {
      setSaving(false);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setMcpAuth(null);
    setInput("");
  };

  const handleStatementUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "csv"].includes(ext)) {
      setUploadResult({ error: "Only PDF or CSV files are supported" });
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/api/finance/upload-statement`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Upload failed (${res.status})`);
      }
      const data = await res.json();
      setUploadResult({
        success: true,
        count: data.transaction_count,
        balance: data.bank_balance,
        income: data.monthly_income,
        expenses: data.monthly_expenses,
      });
      setUploadedFile({
        name: data.filename || file.name,
        balance: data.bank_balance,
      });
      setTimeout(() => setUploadResult(null), 8000);
    } catch (err) {
      setUploadResult({ error: err.message });
      setTimeout(() => setUploadResult(null), 5000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <Loader2 size={40} className="text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar
        onQuickAction={sendMessage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-white/5 glass">
          <div className="flex items-center gap-2.5 text-text-primary">
            <div className="w-7 h-7 rounded-lg gradient-accent flex items-center justify-center glow-accent-sm">
              <Sparkles size={14} className="text-white" />
            </div>
            <h2 className="text-base font-semibold gradient-text">
              Fi AI Agent
            </h2>
          </div>
          <span className="text-[10px] text-text-muted glass rounded-full px-3 py-1">
            Powered by LLaMA 3.3
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.csv"
              onChange={handleStatementUpload}
              className="hidden"
            />
            {uploadedFile ? (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                               bg-emerald-500/10 text-emerald-400
                               border border-emerald-500/20">
                  <CheckCircle2 size={12} />
                  <span className="max-w-[120px] truncate" title={uploadedFile.name}>{uploadedFile.name}</span>
                </div>
                <button
                  onClick={async () => {
                    setRemoving(true);
                    try {
                      const token = await getToken();
                      const res = await fetch(`${API_BASE}/api/finance/remove-statement`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      if (res.ok) {
                        setUploadedFile(null);
                        setUploadResult(null);
                      }
                    } catch { /* ignore */ }
                    setRemoving(false);
                  }}
                  disabled={removing}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium
                             bg-red-500/10 text-red-400 hover:bg-red-500/20
                             border border-red-500/20 transition-all disabled:opacity-50"
                  title="Remove Statement"
                >
                  {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium
                             bg-blue-500/10 text-blue-400 hover:bg-blue-500/20
                             border border-blue-500/20 transition-all disabled:opacity-50"
                  title="Replace Statement"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                           bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20
                           border border-emerald-500/20 transition-all disabled:opacity-50"
                title="Upload Bank Statement (PDF/CSV)"
              >
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? "Uploading..." : "📄 Upload Statement"}
              </button>
            )}
            <button
              onClick={startNewChat}
              className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
              title="New Chat"
            >
              <Plus size={16} />
            </button>
            <button
              onClick={saveConversation}
              disabled={saving || !messages.length}
              className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-30"
              title={conversationId ? "Saved" : "Save Chat"}
            >
              <Save size={16} className={saving ? "animate-pulse" : ""} />
            </button>
          </div>
        </header>

        {/* Upload Result Banner */}
        {uploadResult && (
          <div className={`mx-6 mt-4 p-4 glass-card rounded-xl animate-fadein ${
            uploadResult.success ? "border border-emerald-500/30" : "border border-red-500/30"
          }`}>
            {uploadResult.success ? (
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-emerald-400 mb-1">✅ Statement Uploaded!</h4>
                  <p className="text-xs text-text-secondary">
                    {uploadResult.count} transactions imported • Balance: ₹{uploadResult.balance?.toLocaleString("en-IN")} •
                    Monthly Income: ₹{uploadResult.income?.toLocaleString("en-IN")} •
                    Monthly Expenses: ₹{uploadResult.expenses?.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-red-400" />
                <p className="text-xs text-red-400">{uploadResult.error}</p>
              </div>
            )}
          </div>
        )}

        {/* MCP Auth Banner */}
        {mcpAuth && (
          <div className="mx-6 mt-4 p-4 glass-card rounded-xl animate-fadein gradient-border">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center flex-shrink-0 glow-accent-sm">
                <span className="text-xl">🔐</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-text-primary mb-1">
                  Zerodha Authentication Required
                </h4>
                <p className="text-xs text-text-secondary mb-3">
                  Click the button below to login with your Zerodha account, then click "Retry Query".
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={mcpAuth.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 gradient-accent hover:opacity-90
                               text-white text-xs font-medium rounded-lg transition-all glow-accent-sm"
                  >
                    <ExternalLink size={12} />
                    Connect Zerodha
                  </a>
                  <button
                    onClick={handleRetryAfterAuth}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/20 hover:bg-success/30
                               text-success text-xs font-medium rounded-lg transition-colors border border-success/30"
                  >
                    <RefreshCw size={12} />
                    I've Authenticated — Retry Query
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fadein">
              <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mb-4 glow-accent">
                <Sparkles size={30} className="text-white" />
              </div>
              <h3 className="text-xl font-bold gradient-text mb-2">
                Welcome to Fi AI Agent
              </h3>
              <p className="text-sm text-text-secondary max-w-md mb-6">
                Ask me anything about your finances — net worth, transactions,
                investments, credit score, and more.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  "What's my net worth?",
                  "Show recent transactions",
                  "Can I afford a ₹50,000 purchase?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-4 py-2 text-xs rounded-full glass
                               text-text-secondary hover:text-text-primary
                               hover:bg-white/5 hover:border-accent/30
                               transition-all duration-200 gradient-border"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <ChatMessage
              key={idx}
              role={msg.role}
              content={msg.content}
              timestamp={msg.timestamp}
            />
          ))}

          {loading && (
            <div className="flex gap-3 animate-slide-left">
              <div className="w-8 h-8 rounded-xl gradient-accent flex items-center justify-center glow-accent-sm">
                <Sparkles size={14} className="text-white animate-pulse" />
              </div>
              <div className="glass-card rounded-2xl px-4 py-3 typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/5 glass">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              disabled={loading}
              className="flex-1 glass rounded-xl px-4 py-3
                         text-sm text-text-primary placeholder-text-muted
                         focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20
                         disabled:opacity-50 transition-all duration-200"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 gradient-accent hover:opacity-90 rounded-xl
                         text-white transition-all duration-200
                         disabled:opacity-40 disabled:cursor-not-allowed
                         flex items-center justify-center glow-accent-sm"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
