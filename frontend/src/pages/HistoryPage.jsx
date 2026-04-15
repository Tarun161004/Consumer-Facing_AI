import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  Clock,
  Wallet,
  ArrowRightLeft,
  TrendingUp,
  BarChart3,
  CreditCard,
  PiggyBank,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
  MessageSquare,
  Search,
  X,
  Calendar,
  Sparkles,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/* ─── Type Metadata ─── */
const TYPE_META = {
  fetch_net_worth:          { label: "Net Worth",     icon: Wallet,         color: "text-violet-400", bg: "bg-violet-500/10",  tag: "💰" },
  fetch_bank_transactions:  { label: "Transactions",  icon: ArrowRightLeft, color: "text-blue-400",   bg: "bg-blue-500/10",    tag: "🏦" },
  fetch_mf_transactions:    { label: "Mutual Funds",  icon: TrendingUp,     color: "text-emerald-400",bg: "bg-emerald-500/10", tag: "📈" },
  fetch_stock_transactions: { label: "Stocks",        icon: BarChart3,      color: "text-amber-400",  bg: "bg-amber-500/10",   tag: "📊" },
  fetch_credit_report:      { label: "Credit Report", icon: CreditCard,     color: "text-red-400",    bg: "bg-red-500/10",     tag: "💳" },
  fetch_epf_details:        { label: "EPF Details",   icon: PiggyBank,      color: "text-teal-400",   bg: "bg-teal-500/10",    tag: "🏛️" },
};

/* ─── Helpers ─── */
function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return ts;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function getDateGroup(ts) {
  if (!ts) return "Older";
  const d = new Date(ts);
  if (isNaN(d)) return "Older";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 7);

  if (d >= today) return "Today";
  if (d >= yesterday) return "Yesterday";
  if (d >= weekStart) return "This Week";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "This Week", "Older"];

function getDataPreview(data) {
  if (!data || typeof data !== "object") return "";
  const entries = Object.entries(data);
  if (entries.length === 0) return "No data";
  const first = entries[0];
  const val = typeof first[1] === "object" ? JSON.stringify(first[1]).slice(0, 50) : String(first[1]);
  return `${first[0].replace(/_/g, " ")}: ${val}${entries.length > 1 ? ` · +${entries.length - 1} more` : ""}`;
}

/* ─── Data Preview (expandable) ─── */
function DataPreview({ data }) {
  if (!data || typeof data !== "object") {
    return <span className="text-text-muted text-xs">{String(data ?? "No data")}</span>;
  }
  return (
    <div className="space-y-1 max-h-64 overflow-y-auto pr-2">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex justify-between gap-4 text-xs">
          <span className="text-text-muted truncate">{key.replace(/_/g, " ")}</span>
          <span className="text-white font-medium text-right truncate max-w-[60%]">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Finance History Card ─── */
function HistoryCard({ entry, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const meta = TYPE_META[entry.type] || { label: entry.type, icon: Clock, color: "text-text-muted", bg: "bg-white/5", tag: "📄" };
  const Icon = meta.icon;

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    await onDelete(entry.id);
  };

  return (
    <div className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.003] animate-fadein"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
        <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center ${meta.color} flex-shrink-0`}>
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">{meta.label}</p>
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${meta.bg} ${meta.color} font-medium`}>
              {meta.tag}
            </span>
          </div>
          <p className="text-[10px] text-text-muted mt-0.5 truncate">
            {getDataPreview(entry.data)}
          </p>
        </div>
        <span className="text-[10px] text-text-muted whitespace-nowrap">{formatTime(entry.timestamp)}</span>
        <button onClick={handleDelete}
          className={`p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors ${deleting ? "opacity-30" : ""}`}>
          <Trash2 size={12} />
        </button>
        <div className="text-text-muted">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-white/5">
          <DataPreview data={entry.data} />
        </div>
      )}
    </div>
  );
}

/* ─── Chat Conversation Card ─── */
function ChatCard({ conv, onDelete, onOpen }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (deleting) return;
    setDeleting(true);
    await onDelete(conv.id);
  };

  return (
    <div className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.003] animate-fadein"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => onOpen(conv.id)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors">
        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 flex-shrink-0">
          <MessageSquare size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{conv.title}</p>
          <p className="text-[10px] text-text-muted mt-0.5">
            {conv.message_count} messages · {formatDate(conv.created_at)}
          </p>
        </div>
        <button onClick={handleDelete}
          className={`p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors ${deleting ? "opacity-30" : ""}`}>
          <Trash2 size={12} />
        </button>
      </button>
    </div>
  );
}

/* ─── Date Group Header ─── */
function GroupHeader({ label, count }) {
  return (
    <div className="flex items-center gap-2 pt-2 pb-1">
      <Calendar size={11} className="text-text-muted" />
      <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
      <span className="text-[9px] text-text-muted px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
        {count}
      </span>
      <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
    </div>
  );
}

/* ─── Main History Page ─── */
export default function HistoryPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [tab, setTab] = useState("finance");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const [finRes, chatRes] = await Promise.allSettled([
        fetch(`${API_BASE}/api/finance/history?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE}/api/chat-history?limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (finRes.status === "fulfilled" && finRes.value.ok) {
        const data = await finRes.value.json();
        setHistory(data.history || []);
      }
      if (chatRes.status === "fulfilled" && chatRes.value.ok) {
        const data = await chatRes.value.json();
        setChats(data.conversations || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const deleteEntry = async (id) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/finance/history/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      setHistory((p) => p.filter((h) => h.id !== id));
    } catch { /* stay */ }
  };

  const deleteChat = async (id) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/api/chat-history/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      setChats((p) => p.filter((c) => c.id !== id));
    } catch { /* stay */ }
  };

  const clearAll = async () => {
    const list = tab === "finance" ? history : chats;
    if (!list.length) return;
    try {
      const token = await getToken();
      const endpoint = tab === "finance" ? "/api/finance/history" : "/api/chat-history";
      const res = await fetch(`${API_BASE}${endpoint}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      if (tab === "finance") { setHistory([]); setFilter("all"); } else setChats([]);
    } catch { /* stay */ }
  };

  const openChat = (id) => navigate(`/chat?load=${id}`);

  /* ─── Filtering + Searching ─── */
  const types = [...new Set(history.map((h) => h.type))];
  const searchLower = search.toLowerCase();

  const filteredHistory = useMemo(() => {
    let items = filter === "all" ? history : history.filter((h) => h.type === filter);
    if (search) {
      items = items.filter((h) => {
        const meta = TYPE_META[h.type] || {};
        return (meta.label || h.type || "").toLowerCase().includes(searchLower)
          || JSON.stringify(h.data || {}).toLowerCase().includes(searchLower);
      });
    }
    return items;
  }, [history, filter, searchLower]);

  const filteredChats = useMemo(() => {
    if (!search) return chats;
    return chats.filter((c) => (c.title || "").toLowerCase().includes(searchLower));
  }, [chats, searchLower]);

  /* ─── Date Grouping ─── */
  const groupedHistory = useMemo(() => {
    const groups = {};
    filteredHistory.forEach((entry) => {
      const group = getDateGroup(entry.timestamp);
      if (!groups[group]) groups[group] = [];
      groups[group].push(entry);
    });
    return GROUP_ORDER.filter((g) => groups[g]).map((g) => ({ label: g, items: groups[g] }));
  }, [filteredHistory]);

  const groupedChats = useMemo(() => {
    const groups = {};
    filteredChats.forEach((conv) => {
      const group = getDateGroup(conv.created_at);
      if (!groups[group]) groups[group] = [];
      groups[group].push(conv);
    });
    return GROUP_ORDER.filter((g) => groups[g]).map((g) => ({ label: g, items: groups[g] }));
  }, [filteredChats]);

  if (authLoading) return null;

  const currentItems = tab === "finance" ? filteredHistory : filteredChats;
  const totalItems = tab === "finance" ? history.length : chats.length;

  return (
    <div className="flex h-screen bg-bg-primary">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-white/5 glass">
          <button onClick={() => navigate("/chat")}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center glow-accent-sm">
            <Clock size={14} className="text-white" />
          </div>
          <h1 className="text-base font-semibold gradient-text">History</h1>
          <div className="flex-1" />
          <button onClick={() => { setShowSearch(!showSearch); setSearch(""); }}
            className={`p-2 rounded-lg transition-colors ${showSearch ? "bg-violet-500/10 text-violet-400" : "hover:bg-white/5 text-text-muted hover:text-text-primary"}`}>
            {showSearch ? <X size={16} /> : <Search size={16} />}
          </button>
          {totalItems > 0 && (
            <button onClick={clearAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
          <button onClick={fetchHistory} disabled={loading}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-40">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-6 py-2.5 border-b border-white/5 animate-fadein">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input type="text" placeholder={`Search ${tab === "finance" ? "finance data" : "conversations"}...`}
                value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm text-white placeholder-text-muted outline-none focus:ring-1 focus:ring-violet-500/30"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          {[
            { key: "finance", label: "Finance Data", count: history.length, icon: "💰" },
            { key: "chats", label: "Conversations", count: chats.length, icon: "💬" },
          ].map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setSearch(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-all ${
                tab === t.key
                  ? "border-b-2 border-violet-400 text-violet-400"
                  : "text-text-muted hover:text-text-secondary"
              }`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                tab === t.key ? "bg-violet-500/10 text-violet-400" : "bg-white/5 text-text-muted"
              }`}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* Filter Chips (finance tab only) */}
        {tab === "finance" && types.length > 1 && (
          <div className="flex gap-1.5 px-6 py-2.5 overflow-x-auto border-b border-white/5">
            <button onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap ${
                filter === "all" ? "bg-white/10 text-white" : "text-text-muted hover:text-white hover:bg-white/5"
              }`}>
              All ({history.length})
            </button>
            {types.map((type) => {
              const meta = TYPE_META[type] || { label: type, tag: "📄", bg: "bg-white/5", color: "text-text-muted" };
              const count = history.filter((h) => h.type === type).length;
              return (
                <button key={type} onClick={() => setFilter(type)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap ${
                    filter === type ? `${meta.bg} ${meta.color}` : "text-text-muted hover:text-white hover:bg-white/5"
                  }`}>
                  <span>{meta.tag}</span> {meta.label} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <RefreshCw size={24} className="animate-spin text-violet-400" />
              <p className="text-xs text-text-muted">Loading history...</p>
            </div>
          )}

          {!loading && error && (
            <div className="text-center py-20">
              <p className="text-red-400 text-sm mb-2">{error}</p>
              <button onClick={fetchHistory} className="text-xs text-violet-400 hover:underline">Try again</button>
            </div>
          )}

          {/* Empty States */}
          {!loading && !error && currentItems.length === 0 && (
            <div className="text-center py-20 animate-fadein">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                style={{ background: "rgba(124,58,237,0.08)" }}>
                {tab === "finance" ? <Clock size={28} className="text-violet-400 opacity-50" /> : <MessageSquare size={28} className="text-violet-400 opacity-50" />}
              </div>
              <p className="text-sm text-text-secondary font-medium">
                {search ? "No results found" : tab === "finance" ? "No finance history yet" : "No saved conversations"}
              </p>
              <p className="text-xs text-text-muted mt-1.5">
                {search ? `No matches for "${search}"` : tab === "finance" ? "Chat with Fi AI to fetch your financial data" : "Your conversations will appear here"}
              </p>
              {!search && (
                <button onClick={() => navigate("/chat")}
                  className="mt-4 px-4 py-2 rounded-lg text-xs font-medium text-white transition-all hover:scale-105"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}>
                  <span className="flex items-center gap-1.5"><Sparkles size={12} /> Start Chatting</span>
                </button>
              )}
            </div>
          )}

          {/* Finance Tab - Grouped by Date */}
          {!loading && !error && tab === "finance" && groupedHistory.map((group) => (
            <div key={group.label}>
              <GroupHeader label={group.label} count={group.items.length} />
              <div className="space-y-1.5 mb-2">
                {group.items.map((entry) => (
                  <HistoryCard key={entry.id} entry={entry} onDelete={deleteEntry} />
                ))}
              </div>
            </div>
          ))}

          {/* Chats Tab - Grouped by Date */}
          {!loading && !error && tab === "chats" && groupedChats.map((group) => (
            <div key={group.label}>
              <GroupHeader label={group.label} count={group.items.length} />
              <div className="space-y-1.5 mb-2">
                {group.items.map((conv) => (
                  <ChatCard key={conv.id} conv={conv} onDelete={deleteChat} onOpen={openChat} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {!loading && currentItems.length > 0 && (
          <div className="px-6 py-2.5 border-t border-white/5">
            <p className="text-[10px] text-text-muted text-center">
              {search
                ? `${currentItems.length} result${currentItems.length !== 1 ? "s" : ""} for "${search}"`
                : `${currentItems.length} ${tab === "finance" ? "record" : "conversation"}${currentItems.length !== 1 ? "s" : ""}`
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
