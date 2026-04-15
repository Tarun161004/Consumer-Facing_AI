import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  Briefcase,
  TrendingUp,
  BarChart3,
  PiggyBank,
  Wallet,
  RefreshCw,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

function fmtCurrency(n) {
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function extractUnits(obj) {
  if (!obj) return 0;
  if (typeof obj === "number") return obj;
  if (obj.units) return Number(obj.units) + (obj.nanos || 0) / 1e9;
  return Number(obj) || 0;
}

/* ─── Allocation Colors ─── */
const ALLOC_COLORS = [
  { color: "#a78bfa", glow: "rgba(167,139,250,0.3)" },  // violet
  { color: "#34d399", glow: "rgba(52,211,153,0.3)" },   // emerald
  { color: "#60a5fa", glow: "rgba(96,165,250,0.3)" },   // blue
  { color: "#f472b6", glow: "rgba(244,114,182,0.3)" },  // pink
  { color: "#fbbf24", glow: "rgba(251,191,36,0.3)" },   // amber
  { color: "#fb923c", glow: "rgba(251,146,60,0.3)" },   // orange
  { color: "#94a3b8", glow: "rgba(148,163,184,0.3)" },  // slate
];

/* ─── SVG Donut Chart ─── */
function DonutChart({ segments, centerLabel, centerValue }) {
  const size = 180;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercent = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {segments.map((seg, i) => {
          const offset = circumference * (1 - cumulativePercent / 100);
          const dashLen = circumference * (seg.percent / 100);
          cumulativePercent += seg.percent;
          return (
            <circle
              key={i}
              cx={size / 2} cy={size / 2} r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              style={{
                filter: `drop-shadow(0 0 6px ${seg.glow})`,
                transition: "stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease",
              }}
            />
          );
        })}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs font-medium text-text-muted">{centerLabel}</p>
        <p className="text-sm font-bold text-white">{centerValue}</p>
      </div>
    </div>
  );
}

/* ─── Allocation Card ─── */
function AllocationCard({ title, allocations, totalValue, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl p-5 animate-fadein" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 py-8 justify-center">
          <RefreshCw size={16} className="animate-spin text-text-muted" />
          <span className="text-sm text-text-muted">Loading allocation...</span>
        </div>
      </div>
    );
  }

  if (!allocations || allocations.length === 0) {
    return (
      <div className="rounded-xl p-5 animate-fadein" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-sm font-medium text-white mb-2">{title}</p>
        <p className="text-xs text-text-muted">No allocation data — ask the AI to fetch your data</p>
      </div>
    );
  }

  const segments = allocations.map((a, i) => ({
    ...a,
    color: ALLOC_COLORS[i % ALLOC_COLORS.length].color,
    glow: ALLOC_COLORS[i % ALLOC_COLORS.length].glow,
  }));

  return (
    <div
      className="rounded-xl p-5 animate-fadein"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(124,58,237,0.03))",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-4 mb-5">
        <span className="text-xs font-medium text-white bg-white/10 px-3 py-1.5 rounded-lg">
          {title}
        </span>
        <span className="text-xs text-text-muted">Asset Breakdown</span>
        <span className="ml-auto text-[10px] text-violet-400 cursor-pointer hover:text-violet-300 transition-colors">
          View All
        </span>
      </div>

      {/* Chart + Legend */}
      <div className="flex items-center gap-6 flex-wrap justify-center sm:justify-start">
        {/* Donut */}
        <DonutChart
          segments={segments}
          centerLabel="Total"
          centerValue={totalValue > 0 ? fmtCurrency(totalValue) : "—"}
        />

        {/* Legend */}
        <div className="flex-1 min-w-[180px] space-y-2.5">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center justify-between group">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: seg.color,
                    boxShadow: `0 0 8px ${seg.glow}`,
                  }}
                />
                <span className="text-xs text-text-secondary group-hover:text-white transition-colors">
                  {seg.name}
                </span>
              </div>
              <span className="text-xs font-semibold text-white tabular-nums">
                {seg.percent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Investment Card (Small) ─── */
function InvestmentCard({ icon: Icon, label, iconColor, iconBg, items, loading, notFound }) {
  return (
    <div
      className="rounded-xl p-4 animate-fadein transition-all duration-300 hover:scale-[1.01]"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon size={15} className={iconColor} />
        </div>
        <p className="text-sm font-medium text-white">{label}</p>
      </div>

      {loading && (
        <div className="flex justify-center py-3">
          <RefreshCw size={14} className="animate-spin text-text-muted" />
        </div>
      )}

      {!loading && notFound && (
        <p className="text-xs text-text-muted">{notFound}</p>
      )}

      {!loading && !notFound && items.length === 0 && (
        <p className="text-xs text-text-muted">No data — ask AI to fetch</p>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-1.5">
          {items.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1">
              <span className="text-text-secondary truncate mr-2">{item.name}</span>
              <span className={`font-medium flex-shrink-0 ${iconColor}`}>
                {item.value > 0 ? fmtCurrency(item.value) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Data Extractors (Zerodha + Bank Statement format) ─── */
function extractNetWorth(d) {
  if (!d) return { total: 0, allocations: [] };

  // New Zerodha format: { net_worth, breakdown: { stocks, mutual_funds, bank_balance, epf } }
  if (d?.net_worth || d?.breakdown) {
    const total = d.net_worth || 0;
    const b = d.breakdown || {};
    const allocations = [];
    if (b.stocks > 0) allocations.push({ name: "Stocks", value: b.stocks, percent: total > 0 ? (b.stocks / total) * 100 : 0 });
    if (b.mutual_funds > 0) allocations.push({ name: "Mutual Funds", value: b.mutual_funds, percent: total > 0 ? (b.mutual_funds / total) * 100 : 0 });
    if (b.bank_balance > 0) allocations.push({ name: "Bank Balance", value: b.bank_balance, percent: total > 0 ? (b.bank_balance / total) * 100 : 0 });
    if (b.epf > 0) allocations.push({ name: "EPF", value: b.epf, percent: total > 0 ? (b.epf / total) * 100 : 0 });
    return { total, allocations };
  }

  // Old Fi Money format fallback
  const total = extractUnits(d?.netWorthResponse?.totalNetWorthValue);
  const assets = d?.netWorthResponse?.assetValues || [];
  const allocations = assets
    .map((a) => {
      const val = extractUnits(a?.value);
      return {
        name: (a.netWorthAttribute || "Asset")
          .replace("ASSET_TYPE_", "").replace(/_/g, " ")
          .toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
        value: val,
        percent: total > 0 ? (val / total) * 100 : 0,
      };
    })
    .filter((a) => a.value > 0);

  const accMap = d?.accountDetailsBulkResponse?.accountDetailsMap;
  if (accMap && allocations.length === 0) {
    for (const [, acc] of Object.entries(accMap)) {
      const bankName = acc?.accountDetails?.fipMeta?.displayName || "Bank Account";
      const bal = extractUnits(acc?.depositSummary?.currentBalance);
      if (bal > 0) {
        allocations.push({
          name: bankName,
          value: bal,
          percent: total > 0 ? (bal / total) * 100 : (bal > 0 ? 100 : 0),
        });
      }
    }
  }
  return { total, allocations };
}

function extractMF(d) {
  if (!d) return { items: [] };

  // New Zerodha format: { mf_holdings: [...], total_mf_value }
  if (d?.mf_holdings) {
    return {
      items: d.mf_holdings.map((h) => ({
        name: h.fund || h.tradingsymbol || h.scheme || "Fund",
        value: (h.last_price || 0) * (h.quantity || 0),
      })),
    };
  }

  // Old format fallback
  const txns = d?.mfTransactions || d?.transactions || (Array.isArray(d) ? d : []);
  return {
    items: txns.map((t) => ({
      name: t.schemeName || t.scheme_name || t.fund_name || t.name || "Fund",
      value: extractUnits(t.amount || t.nav || t.value || 0),
    })),
  };
}

function extractStocks(d) {
  if (!d) return { items: [], notFound: null };
  if (d?.error) return { items: [], notFound: d.error };
  if (d?.status === "not_found") return { items: [], notFound: d.message || "No stocks connected" };

  // New Zerodha format: { holdings: [...], total_holdings_value }
  if (d?.holdings) {
    return {
      items: d.holdings.map((h) => ({
        name: h.tradingsymbol || h.instrument_token || h.name || "Stock",
        value: (h.last_price || 0) * (h.quantity || 0),
      })),
      notFound: null,
    };
  }

  // Old format fallback
  const txns = d?.stockTransactions || d?.transactions || (Array.isArray(d) ? d : []);
  return {
    items: txns.map((t) => ({
      name: t.stockName || t.stock_name || t.symbol || t.name || "Stock",
      value: extractUnits(t.amount || t.price || t.value || 0),
    })),
    notFound: null,
  };
}

function extractEPF(d) {
  if (!d) return { items: [] };

  // New format: { epf_balance, source: "manual_entry" }
  if (d?.epf_balance) {
    return { items: [{ name: "EPF Balance", value: d.epf_balance }] };
  }

  // Old format fallback
  const items = [];
  const bal = extractUnits(d?.totalBalance || d?.total || d?.balance || 0);
  if (bal > 0) items.push({ name: "EPF Balance", value: bal });
  if (d?.employeeContribution) items.push({ name: "Employee", value: extractUnits(d.employeeContribution) });
  if (d?.employerContribution) items.push({ name: "Employer", value: extractUnits(d.employerContribution) });
  if (d?.interest) items.push({ name: "Interest", value: extractUnits(d.interest) });
  return { items };
}

/* ─── Main Portfolio Page ─── */
export default function PortfolioPage() {
  const { user, loading: authLoading, getToken } = useAuth();
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  const tools = ["fetch_net_worth", "fetch_mf_transactions", "fetch_stock_transactions", "fetch_epf_details"];

  const fetchAll = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const results = await Promise.allSettled(
        tools.map((t) =>
          fetch(`${API_BASE}/api/finance/snapshot/${t}`, { headers }).then(
            (r) => (r.ok ? r.json() : null)
          )
        )
      );
      const map = {};
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value) map[tools[i]] = r.value.data;
      });
      setSnapshots(map);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  if (authLoading) return null;

  const nw = extractNetWorth(snapshots.fetch_net_worth);
  const mf = extractMF(snapshots.fetch_mf_transactions);
  const stocks = extractStocks(snapshots.fetch_stock_transactions);
  const epf = extractEPF(snapshots.fetch_epf_details);

  return (
    <div className="flex h-screen bg-bg-primary">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-white/5 glass">
          <button onClick={() => navigate("/chat")}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Briefcase size={14} className="text-white" />
          </div>
          <h1 className="text-base font-semibold" style={{
            background: "linear-gradient(135deg, #a78bfa, #60a5fa)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Portfolio</h1>
          <div className="flex-1" />
          <button onClick={() => navigate("/chat")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-xs font-medium transition-colors"
          >
            <MessageCircle size={12} /> Ask AI
          </button>
          <button onClick={fetchAll} disabled={loading}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* Donut Chart — Asset Allocation */}
          <AllocationCard
            title="Asset Allocation"
            allocations={nw.allocations}
            totalValue={nw.total}
            loading={loading}
          />


          {/* Footer */}
          <div className="text-center py-4">
            <p className="text-[11px] text-text-muted">
              💡 Ask AI: <span className="text-violet-400">"Analyze my portfolio risk"</span> or <span className="text-violet-400">"How should I rebalance?"</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
