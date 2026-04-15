import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  Bell,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Trash2,
  X,
} from "lucide-react";

/* ─── Notification Data ─── */
const CATEGORIES = [
  {
    id: "alert",
    label: "Alerts",
    emoji: "🔴",
    icon: ShieldAlert,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    glow: "rgba(239,68,68,0.08)",
    dot: "bg-red-400",
  },
  {
    id: "warning",
    label: "Warnings",
    emoji: "🟡",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "rgba(251,191,36,0.08)",
    dot: "bg-amber-400",
  },
  {
    id: "positive",
    label: "Positive",
    emoji: "🟢",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "rgba(52,211,153,0.08)",
    dot: "bg-emerald-400",
  },
  {
    id: "insight",
    label: "Smart Insights",
    emoji: "💡",
    icon: Lightbulb,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    glow: "rgba(167,139,250,0.08)",
    dot: "bg-violet-400",
  },
];

const INITIAL_NOTIFICATIONS = [
  // 🔴 ALERTS
  {
    id: "a1",
    category: "alert",
    title: "Low Balance Alert",
    message: "Your account balance dropped below ₹5,000. Current: ₹3,200",
    time: "2 min ago",
    read: false,
  },
  {
    id: "a2",
    category: "alert",
    title: "Negative Cash Flow",
    message: "Your expenses exceeded income by ₹4,500 this month",
    time: "1 hr ago",
    read: false,
  },
  {
    id: "a3",
    category: "alert",
    title: "Runway Warning",
    message: "At current spending, your funds will last only 18 days",
    time: "3 hr ago",
    read: false,
  },
  {
    id: "a4",
    category: "alert",
    title: "Large Unusual Transaction",
    message: "Unusual spend of ₹12,000 at Amazon detected today",
    time: "5 hr ago",
    read: true,
  },
  {
    id: "a5",
    category: "alert",
    title: "Bill Due Soon",
    message: "Your LIC premium of ₹8,400 is due in 3 days",
    time: "6 hr ago",
    read: true,
  },

  // 🟡 WARNINGS
  {
    id: "w1",
    category: "warning",
    title: "Overspending Category",
    message: "Food delivery spend is 40% higher than last month (₹3,200 vs ₹2,300)",
    time: "30 min ago",
    read: false,
  },
  {
    id: "w2",
    category: "warning",
    title: "Subscription Detected",
    message: "New recurring charge: Netflix ₹649 — added to your subscriptions",
    time: "2 hr ago",
    read: false,
  },
  {
    id: "w3",
    category: "warning",
    title: "Lifestyle Creep Detected",
    message: "Your discretionary spending grew 22% since your last salary hike",
    time: "4 hr ago",
    read: true,
  },
  {
    id: "w4",
    category: "warning",
    title: "Savings Rate Dropped",
    message: "Your savings rate fell from 28% to 14% this month",
    time: "8 hr ago",
    read: true,
  },
  {
    id: "w5",
    category: "warning",
    title: "EMI Ratio High",
    message: "EMIs now consume 45% of your income — above the safe 40% threshold",
    time: "1 day ago",
    read: true,
  },

  // 🟢 POSITIVE
  {
    id: "p1",
    category: "positive",
    title: "Savings Milestone! 🎉",
    message: "You saved ₹50,000 this quarter — your best quarter yet!",
    time: "15 min ago",
    read: false,
  },
  {
    id: "p2",
    category: "positive",
    title: "Goal Progress",
    message: "You are 67% toward your house down payment goal",
    time: "1 hr ago",
    read: false,
  },
  {
    id: "p3",
    category: "positive",
    title: "SIP Success",
    message: "Your SIP of ₹5,000 was processed successfully this month",
    time: "3 hr ago",
    read: true,
  },
  {
    id: "p4",
    category: "positive",
    title: "Net Worth Increase",
    message: "Your net worth grew by ₹18,000 this month",
    time: "5 hr ago",
    read: true,
  },
  {
    id: "p5",
    category: "positive",
    title: "Budget Streak 🔥",
    message: "You stayed under budget for 3 months in a row",
    time: "1 day ago",
    read: true,
  },

  // 💡 SMART INSIGHTS
  {
    id: "i1",
    category: "insight",
    title: "Idle Cash Alert",
    message: "₹85,000 has been sitting in your savings account for 60 days — consider moving to a liquid fund for better returns",
    time: "10 min ago",
    read: false,
  },
  {
    id: "i2",
    category: "insight",
    title: "Subscription Audit",
    message: "You have 3 subscriptions totalling ₹1,847/month that haven't been used in 30 days",
    time: "45 min ago",
    read: false,
  },
  {
    id: "i3",
    category: "insight",
    title: "Tax Saving Reminder",
    message: "Only ₹45,000 more investment needed to max your 80C limit before March 31",
    time: "2 hr ago",
    read: false,
  },
  {
    id: "i4",
    category: "insight",
    title: "Festival Spending Warning",
    message: "Diwali is in 3 weeks — based on last year you spent ₹22,000. Plan accordingly",
    time: "6 hr ago",
    read: true,
  },
  {
    id: "i5",
    category: "insight",
    title: "Salary Credited",
    message: "Salary of ₹65,000 credited. Suggested: move ₹15,000 to SIP + ₹10,000 to emergency fund",
    time: "1 day ago",
    read: true,
  },
];

/* ─── Notification Card ─── */
function NotifCard({ notif, catMeta, onDismiss, onRead }) {
  const Icon = catMeta.icon;
  return (
    <div
      onClick={() => onRead(notif.id)}
      className={`rounded-xl px-4 py-3.5 flex items-start gap-3 cursor-pointer transition-all duration-200 animate-fadein border ${catMeta.border} ${
        notif.read ? "opacity-50" : "hover:scale-[1.005]"
      }`}
      style={{
        background: notif.read
          ? "rgba(255,255,255,0.01)"
          : `linear-gradient(135deg, ${catMeta.glow}, rgba(255,255,255,0.02))`,
      }}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg ${catMeta.bg} flex items-center justify-center ${catMeta.color} flex-shrink-0 mt-0.5`}>
        <Icon size={15} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium ${notif.read ? "text-text-muted" : "text-white"}`}>
            {notif.title}
          </p>
          {!notif.read && (
            <span className={`w-1.5 h-1.5 rounded-full ${catMeta.dot} flex-shrink-0 animate-pulse`} />
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{notif.message}</p>
        <p className="text-[10px] text-text-muted/60 mt-1">{notif.time}</p>
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(notif.id); }}
        className="p-1 rounded hover:bg-white/5 text-text-muted hover:text-red-400 transition-colors flex-shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ─── Main Page ─── */
export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const dismiss = (id) => setNotifications((p) => p.filter((n) => n.id !== id));
  const markRead = (id) => setNotifications((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const clearAll = () => setNotifications([]);
  const markAllRead = () => setNotifications((p) => p.map((n) => ({ ...n, read: true })));

  const filtered = activeFilter === "all"
    ? notifications
    : notifications.filter((n) => n.category === activeFilter);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const catCounts = {};
  CATEGORIES.forEach((c) => { catCounts[c.id] = notifications.filter((n) => n.category === c.id && !n.read).length; });

  if (authLoading) return null;

  return (
    <div className="flex h-screen bg-bg-primary">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-white/5 glass">
          <button onClick={() => navigate("/chat")}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center glow-accent-sm relative">
            <Bell size={14} className="text-white" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <h1 className="text-base font-semibold gradient-text">Notifications</h1>
          <div className="flex-1" />
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded transition-colors"
            >
              Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={13} /> Clear
            </button>
          )}
        </header>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-white/5 overflow-x-auto">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeFilter === "all"
                ? "bg-white/10 text-white" : "text-text-muted hover:text-white hover:bg-white/5"
            }`}
          >
            All ({notifications.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveFilter(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                activeFilter === cat.id
                  ? `${cat.bg} ${cat.color}` : "text-text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              {catCounts[cat.id] > 0 && (
                <span className={`w-4 h-4 rounded-full ${cat.bg} ${cat.color} text-[9px] flex items-center justify-center font-bold`}>
                  {catCounts[cat.id]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Bell size={36} className="mx-auto text-text-muted mb-3 opacity-30" />
              <p className="text-sm text-text-secondary">No notifications</p>
              <p className="text-xs text-text-muted mt-1">
                {activeFilter === "all" ? "You're all caught up!" : "No notifications in this category"}
              </p>
            </div>
          )}

          {filtered.map((n) => {
            const catMeta = CATEGORIES.find((c) => c.id === n.category) || CATEGORIES[0];
            return (
              <NotifCard
                key={n.id}
                notif={n}
                catMeta={catMeta}
                onDismiss={dismiss}
                onRead={markRead}
              />
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5">
          <p className="text-[10px] text-text-muted text-center">
            🤖 Notifications are generated by AI based on your financial activity and spending patterns
          </p>
        </div>
      </div>
    </div>
  );
}
