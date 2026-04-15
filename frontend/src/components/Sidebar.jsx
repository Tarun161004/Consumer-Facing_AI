import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  ArrowRightLeft,
  TrendingUp,
  BarChart3,
  CreditCard,
  PiggyBank,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  LayoutDashboard,
  Bell,
  User,
  Info,
  Briefcase,
} from "lucide-react";

const quickActions = [
  { label: "Net Worth", icon: Wallet, prompt: "What's my net worth?" },
  {
    label: "Transactions",
    icon: ArrowRightLeft,
    prompt: "Show my recent transactions",
  },
  {
    label: "Mutual Funds",
    icon: TrendingUp,
    prompt: "How are my mutual fund investments doing?",
  },
  { label: "Stocks", icon: BarChart3, prompt: "Show my stock portfolio" },
  {
    label: "Credit Score",
    icon: CreditCard,
    prompt: "What's my credit score?",
  },
  { label: "EPF Balance", icon: PiggyBank, prompt: "Show my EPF details" },
];

export default function Sidebar({ onQuickAction, collapsed, onToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-56"
      } flex-shrink-0 glass border-r border-white/5 flex flex-col h-screen sidebar-transition`}
    >
      {/* Toggle Button */}
      <div
        className={`flex items-center ${collapsed ? "justify-center" : "justify-end"} px-3 pt-3`}
      >
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
      </div>

      {/* User Profile */}
      <div className={`p-4 border-b border-white/5 ${collapsed ? "px-3" : ""}`}>
        <div
          className={`flex items-center ${collapsed ? "justify-center" : "gap-3"}`}
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl flex-shrink-0 object-cover"
              style={{ border: "2px solid rgba(124,58,237,0.3)" }}
            />
          ) : (
            <div className="w-9 h-9 rounded-xl gradient-accent flex items-center justify-center text-white font-bold text-sm flex-shrink-0 glow-accent-sm">
              {user?.displayName?.[0] || user?.email?.[0] || "U"}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0 flex-1 sidebar-label">
              <p className="text-sm font-medium text-text-primary truncate">
                {user?.displayName || "User"}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-success">Connected</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex-1 p-3 overflow-y-auto">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-2 mb-2">
            Quick Actions
          </p>
        )}
        <nav className="space-y-1">
          {quickActions.map(({ label, icon: Icon, prompt }) => (
            <button
              key={label}
              onClick={() => onQuickAction(prompt)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center ${
                collapsed ? "justify-center px-2" : "gap-2.5 px-3"
              } py-2 rounded-xl text-sm
                         text-text-secondary hover:text-text-primary
                         hover:bg-white/5 transition-all duration-150
                         text-left group`}
            >
              <Icon
                size={16}
                className="flex-shrink-0 opacity-60 group-hover:opacity-100 group-hover:text-accent transition-colors"
              />
              {!collapsed && <span className="sidebar-label">{label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* History */}
      <div className="px-3 pb-1">
        {!collapsed && (
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-2 mb-2">
            Pages
          </p>
        )}
        <nav className="space-y-1">
          {[
            { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
            { label: "Portfolio", icon: Briefcase, path: "/portfolio" },
            { label: "History", icon: Clock, path: "/history" },
            { label: "Notifications", icon: Bell, path: "/notifications" },
            { label: "Profile", icon: User, path: "/profile" },
            { label: "About", icon: Info, path: "/about" },
          ].map(({ label, icon: Icon, path }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center ${
                collapsed ? "justify-center px-2" : "gap-2.5 px-3"
              } py-2 rounded-xl text-sm
                         text-text-secondary hover:text-text-primary
                         hover:bg-white/5 transition-all duration-150
                         text-left group`}
            >
              <Icon
                size={16}
                className="flex-shrink-0 opacity-60 group-hover:opacity-100 group-hover:text-accent transition-colors"
              />
              {!collapsed && <span className="sidebar-label">{label}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-white/5">
        <button
          onClick={logout}
          className={`w-full flex items-center ${
            collapsed ? "justify-center px-2" : "gap-2 px-3"
          } py-2 rounded-xl text-sm
                     text-error hover:bg-error/10 transition-all duration-150`}
        >
          <LogOut size={16} />
          {!collapsed && <span className="sidebar-label">Logout</span>}
        </button>
        {!collapsed && (
          <p className="text-[10px] text-text-muted mt-2 px-2 leading-tight">
            AI-generated analysis, not professional financial advice.
          </p>
        )}
      </div>
    </aside>
  );
}
