import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  LayoutDashboard,
  Wallet,
  TrendingUp,
  CreditCard,
  PiggyBank,
  RefreshCw,
  ArrowRightLeft,
  BarChart3,
  Sparkles,
  Shield,
  MessageCircle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/** Recursively find a numeric value by key name patterns */
function dig(obj, keys, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) return null;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) {
      const n = Number(obj[k]);
      if (!isNaN(n)) return n;
    }
  }
  for (const val of Object.values(obj)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const found = dig(val, keys, depth + 1);
      if (found !== null) return found;
    }
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === "object") {
          const found = dig(item, keys, depth + 1);
          if (found !== null) return found;
        }
      }
    }
  }
  return null;
}

/** Sum all numeric values from an array of objects matching a key */
function sumFromArray(arr, key) {
  if (!Array.isArray(arr)) return null;
  let sum = 0;
  let found = false;
  for (const item of arr) {
    if (item && item[key] != null) {
      const n = Number(item[key]);
      if (!isNaN(n)) {
        sum += n;
        found = true;
      }
    }
  }
  return found ? sum : null;
}

/** Count items in arrays within the data */
function countItems(obj) {
  if (Array.isArray(obj)) return obj.length;
  if (!obj || typeof obj !== "object") return 0;
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0) return val.length;
  }
  return 0;
}

/** Format currency */
function fmtCurrency(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/** Get greeting based on time */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

const SNAPSHOTS = [
  {
    tool: "fetch_net_worth",
    label: "Net Worth",
    icon: Wallet,
    gradient: "from-violet-600/20 to-blue-600/20",
    iconBg: "bg-violet-500/20",
    iconColor: "text-violet-400",
    format: (d) => {
      // Path 0: Zerodha format — { net_worth, breakdown: { stocks, mutual_funds, bank_balance, epf } }
      if (d?.net_worth != null) {
        return { headline: fmtCurrency(d.net_worth), desc: "Total net worth" };
      }

      // Path 1: totalNetWorthValue.units (MCP format)
      const totalUnits = d?.netWorthResponse?.totalNetWorthValue?.units;
      if (totalUnits != null) {
        const nanos = d?.netWorthResponse?.totalNetWorthValue?.nanos || 0;
        const total = Number(totalUnits) + nanos / 1e9;
        if (!isNaN(total)) return { headline: fmtCurrency(total), desc: "Total net worth" };
      }

      // Path 2: Sum asset values from assetValues[].value.units
      const assets = d?.netWorthResponse?.assetValues || d?.assetValues;
      if (Array.isArray(assets)) {
        let total = 0;
        let found = false;
        for (const a of assets) {
          const units = a?.value?.units || a?.netWorthAtAssetAmount;
          if (units != null) { total += Number(units); found = true; }
        }
        if (found && total > 0) return { headline: fmtCurrency(total), desc: "Total across assets" };
      }

      // Path 3: Sum account balances from accountDetailsBulkResponse
      const accMap = d?.accountDetailsBulkResponse?.accountDetailsMap || d?.accountDetailsMap;
      if (accMap && typeof accMap === "object") {
        let total = 0;
        for (const acc of Object.values(accMap)) {
          const units = acc?.depositSummary?.currentBalance?.units
            || acc?.balance || acc?.availableBalance;
          if (units != null) { total += Number(units); }
        }
        if (total > 0) return { headline: fmtCurrency(total), desc: "Total account balance" };
      }

      // Path 4: Fallback — dig for any numeric field
      const nw = dig(d, [
        "netWorthAmount", "net_worth", "netWorth", "totalBalance",
        "total_balance", "totalNetWorth", "total", "amount",
      ]);
      if (nw != null) return { headline: fmtCurrency(nw), desc: "Total net worth" };

      return { headline: "View in Chat", desc: "Data synced — ask AI for details" };
    },
    summarize: (d) => {
      const items = [];

      // Zerodha breakdown format
      if (d?.breakdown) {
        const b = d.breakdown;
        if (b.stocks != null) items.push({ label: "Stocks", value: fmtCurrency(b.stocks) });
        if (b.mutual_funds != null) items.push({ label: "Mutual Funds", value: fmtCurrency(b.mutual_funds) });
        if (b.bank_balance != null) items.push({ label: "Bank Balance", value: fmtCurrency(b.bank_balance) });
        if (b.epf != null) items.push({ label: "EPF", value: fmtCurrency(b.epf) });
        return items;
      }

      // MCP asset categories
      const assets = d?.netWorthResponse?.assetValues || d?.assetValues;
      if (Array.isArray(assets)) {
        assets.forEach((a) => {
          const label = a.netWorthAttribute || a.netWorthAtAssetCategory || "Asset";
          const units = a?.value?.units || a?.netWorthAtAssetAmount;
          if (units != null) {
            const cleanLabel = label.replace("ASSET_TYPE_", "").replace(/_/g, " ")
              .toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            items.push({ label: cleanLabel, value: fmtCurrency(Number(units)) });
          }
        });
      }
      // Accounts from MCP format
      const accMap = d?.accountDetailsBulkResponse?.accountDetailsMap || d?.accountDetailsMap;
      if (accMap && typeof accMap === "object") {
        const entries = Object.entries(accMap);
        items.push({ label: "Accounts", value: String(entries.length) });
        entries.slice(0, 3).forEach(([id, acc]) => {
          const bankName = acc?.accountDetails?.fipMeta?.displayName || `Acc ...${id.slice(-4)}`;
          const units = acc?.depositSummary?.currentBalance?.units
            || acc?.balance || acc?.availableBalance;
          if (units != null) {
            items.push({ label: bankName, value: fmtCurrency(Number(units)) });
          }
        });
      }
      return items;
    },

  },
  {
    tool: "fetch_credit_report",
    label: "Credit Score",
    icon: Shield,
    gradient: "from-amber-600/20 to-orange-600/20",
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400",
    format: (d) => {
      const v = dig(d, ["credit_score", "creditScore", "score", "cibil_score", "cibilScore"]);
      return v ? { headline: String(v), desc: "CIBIL Score" } : { headline: null, desc: null };
    },
  },
  {
    tool: "fetch_mf_transactions",
    label: "Mutual Funds",
    icon: TrendingUp,
    gradient: "from-emerald-600/20 to-teal-600/20",
    iconBg: "bg-emerald-500/20",
    iconColor: "text-emerald-400",
    format: (d) => {
      // Zerodha format
      if (d?.mf_holdings) return { headline: `${d.mf_holdings.length} funds`, desc: d.total_mf_value ? fmtCurrency(d.total_mf_value) : "Tracked" };
      const count = countItems(d?.mfTransactions || d);
      return count > 0
        ? { headline: `${count} funds`, desc: "Tracked" }
        : { headline: null, desc: "Data available" };
    },
  },
  {
    tool: "fetch_stock_transactions",
    label: "Stocks",
    icon: BarChart3,
    gradient: "from-blue-600/20 to-cyan-600/20",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    format: (d) => {
      if (d?.error) return { headline: "N/A", desc: d.error };
      if (d?.status === "not_found") return { headline: "N/A", desc: d.message || "Not connected" };
      // Zerodha format
      if (d?.holdings) return { headline: `${d.holdings.length} stocks`, desc: d.total_holdings_value ? fmtCurrency(d.total_holdings_value) : "Tracked" };
      const count = countItems(d?.stockTransactions || d);
      return count > 0
        ? { headline: `${count} stocks`, desc: "Tracked" }
        : { headline: null, desc: "Data available" };
    },
  },
  {
    tool: "fetch_bank_transactions",
    label: "Transactions",
    icon: ArrowRightLeft,
    gradient: "from-purple-600/20 to-pink-600/20",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    format: (d) => {
      // Bank statement upload format
      if (d?.transaction_count || d?.transactions) {
        const count = d.transaction_count || d.transactions?.length || 0;
        const balance = d.bank_balance ? fmtCurrency(d.bank_balance) : "Uploaded";
        return { headline: `${count} txns`, desc: balance };
      }
      // MCP format
      const txns = d?.transactions || d?.bankTransactions;
      if (Array.isArray(txns) && txns.length > 0) {
        return { headline: `${txns.length} txns`, desc: "Recent" };
      }
      const count = countItems(d);
      return count > 0
        ? { headline: `${count} txns`, desc: "Recent" }
        : { headline: null, desc: "Data available" };
    },
  },
  {
    tool: "fetch_epf_details",
    label: "EPF",
    icon: PiggyBank,
    gradient: "from-rose-600/20 to-red-600/20",
    iconBg: "bg-rose-500/20",
    iconColor: "text-rose-400",
    format: (d) => {
      const bal = dig(d, ["totalBalance", "epf_balance", "balance", "total"]);
      return bal
        ? { headline: fmtCurrency(bal), desc: "EPF Balance" }
        : { headline: null, desc: null };
    },
  },
];

/* ─────── Hero Net Worth Card ─────── */
function HeroCard({ snap, data, loading }) {
  const formatted = data ? snap.format(data) : null;
  const headline = formatted?.headline;
  const desc = formatted?.desc;
  const summary = data && snap.summarize ? snap.summarize(data) : [];

  return (
    <div className="relative overflow-hidden rounded-2xl p-6 animate-fadein"
      style={{
        background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(59,130,246,0.15))",
        border: "1px solid rgba(124,58,237,0.25)",
        boxShadow: "0 0 40px rgba(124,58,237,0.1), 0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      {/* Glow orb */}
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.5), transparent)" }}
      />

      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className="w-11 h-11 rounded-xl bg-violet-500/20 flex items-center justify-center">
          <Wallet size={20} className="text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{snap.label}</p>
          <p className="text-[11px] text-text-muted">Your total financial position</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6 relative z-10">
          <RefreshCw size={18} className="animate-spin text-violet-400" />
          <span className="text-sm text-text-muted">Fetching your data...</span>
        </div>
      )}

      {!loading && !data && (
        <p className="text-sm text-text-muted py-4 relative z-10">
          No data yet — ask the AI to fetch it
        </p>
      )}

      {!loading && data && (
        <div className="relative z-10">
          {headline && (
            <p className="text-4xl font-bold tracking-tight mb-1" style={{
              background: "linear-gradient(135deg, #a78bfa, #60a5fa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
              {headline}
            </p>
          )}
          {desc && <p className="text-xs text-text-muted mb-4">{desc}</p>}
          {summary.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
              {summary.slice(0, 6).map((item) => (
                <div key={item.label} className="flex justify-between text-xs gap-2 py-1">
                  <span className="text-text-muted truncate">{item.label}</span>
                  <span className="text-violet-300 font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────── Small Snapshot Card ─────── */
function SnapshotCard({ snap, data, loading }) {
  const formatted = data ? snap.format(data) : null;
  const headline = formatted?.headline;
  const desc = formatted?.desc;

  return (
    <div className={`relative overflow-hidden rounded-xl p-4 animate-fadein transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-default group`}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      {/* Hover glow */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
        style={{ background: `linear-gradient(135deg, ${snap.gradient.includes('violet') ? 'rgba(124,58,237,0.05)' : 'rgba(255,255,255,0.02)'}, transparent)` }}
      />

      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg ${snap.iconBg} flex items-center justify-center`}>
            <snap.icon size={15} className={snap.iconColor} />
          </div>
          <p className="text-sm font-medium text-white/90">{snap.label}</p>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-3 relative z-10">
          <RefreshCw size={14} className="animate-spin text-text-muted" />
        </div>
      )}

      {!loading && !data && (
        <p className="text-[11px] text-text-muted relative z-10">
          No data yet — ask the AI to fetch it
        </p>
      )}

      {!loading && data && (
        <div className="relative z-10">
          {headline && (
            <p className={`text-xl font-bold ${snap.iconColor}`}>{headline}</p>
          )}
          {desc && <p className="text-[11px] text-text-muted mt-0.5">{desc}</p>}
        </div>
      )}
    </div>
  );
}

/* ─────── Main Dashboard ─────── */
export default function DashboardPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const results = await Promise.allSettled(
        SNAPSHOTS.map((s) =>
          fetch(`${API_BASE}/api/finance/snapshot/${s.tool}`, { headers })
            .then(async (r) => {
              if (!r.ok) {
                const body = await r.json().catch(() => ({}));
                console.warn(`[Dashboard] ${s.tool} → HTTP ${r.status}`, body);
                return null;
              }
              const json = await r.json();
              console.log(`[Dashboard] ${s.tool} → OK`, json);
              return json;
            })
            .catch((err) => {
              console.error(`[Dashboard] ${s.tool} → Error`, err);
              return null;
            }),
        ),
      );
      const map = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value) {
          map[SNAPSHOTS[i].tool] = r.value.data;
        }
      });
      console.log("[Dashboard] Final snapshot map:", map);
      setSnapshots(map);
    } catch (err) {
      console.error("[Dashboard] fetchAll error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (authLoading) return null;

  const heroSnap = SNAPSHOTS[0]; // Net Worth
  const otherSnaps = SNAPSHOTS.slice(1);

  return (
    <div className="flex h-screen bg-bg-primary">
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-white/5 glass">
          <button
            onClick={() => navigate("/chat")}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
            title="Back to Chat"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center glow-accent-sm">
            <LayoutDashboard size={14} className="text-white" />
          </div>
          <h1 className="text-base font-semibold gradient-text">Dashboard</h1>
          <div className="flex-1" />

          {/* Quick action buttons */}
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-medium transition-colors"
          >
            <MessageCircle size={12} />
            Ask AI
          </button>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Welcome */}
          <div className="flex items-center gap-3 animate-fadein">
            <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center glow-accent-sm">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                {getGreeting()}{user?.displayName ? `, ${user.displayName.split(" ")[0]}` : ""}! 👋
              </h2>
              <p className="text-xs text-text-muted">Here's your financial overview</p>
            </div>
          </div>

          {/* Hero Card — Net Worth */}
          <HeroCard
            snap={heroSnap}
            data={snapshots[heroSnap.tool] || null}
            loading={loading}
          />

          {/* Other Cards Grid */}
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Financial Modules</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {otherSnaps.map((snap) => (
                <SnapshotCard
                  key={snap.tool}
                  snap={snap}
                  data={snapshots[snap.tool] || null}
                  loading={loading}
                />
              ))}
            </div>
          </div>

          {/* Footer hint */}
          <div className="text-center py-4">
            <p className="text-[11px] text-text-muted">
              💡 Ask the AI to fetch any missing data — just type your question in the chat
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
