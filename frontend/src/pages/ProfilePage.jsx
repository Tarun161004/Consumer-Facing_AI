import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateProfile } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Shield,
  LogOut,
  Pencil,
  Save,
  X,
  Camera,
  Zap,
  MessageSquare,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  CheckCircle2,
  Download,
  Trash2,
  ChevronRight,
  Sparkles,
  Briefcase,
  CreditCard,
} from "lucide-react";

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all duration-200 hover:scale-[1.03]"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <Icon size={16} className={color} />
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[10px] text-text-muted">{label}</p>
    </div>
  );
}

/* ─── Info Row ─── */
function InfoRow({ icon: Icon, label, value, color = "text-violet-400" }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
        style={{ background: "rgba(255,255,255,0.04)" }}>
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-text-muted">{label}</p>
        <p className="text-sm text-white truncate">{value}</p>
      </div>
    </div>
  );
}

/* ─── Service Card ─── */
function ServiceCard({ name, icon, connected, desc }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-lg flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{name}</p>
        <p className="text-[10px] text-text-muted">{desc}</p>
      </div>
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium ${
        connected ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
      }`}>
        {connected ? <CheckCircle2 size={10} /> : <WifiOff size={10} />}
        {connected ? "Connected" : "Offline"}
      </div>
    </div>
  );
}

/* ─── Action Button ─── */
function ActionButton({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 group ${
        danger ? "text-red-400 hover:bg-red-500/10" : "text-text-secondary hover:bg-white/[0.03] hover:text-white"
      }`}>
      <Icon size={16} className={danger ? "text-red-400" : "text-text-muted group-hover:text-violet-400 transition-colors"} />
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight size={14} className="text-text-muted opacity-40" />
    </button>
  );
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/* ─── Main Profile Page ─── */
export default function ProfilePage() {
  const { user, loading: authLoading, logout, getToken } = useAuth();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhoto, setEditPhoto] = useState(null);   // preview base64
  const [editPhotoFile, setEditPhotoFile] = useState(null); // small base64 for Firestore
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [firestorePhoto, setFirestorePhoto] = useState(null);
  const [epfBalance, setEpfBalance] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [savingFinData, setSavingFinData] = useState(false);
  const [finDataSaved, setFinDataSaved] = useState(false);

  // Load custom photo + financial data from Firestore on mount
  useEffect(() => {
    if (!user) return;
    // Clear previous user's data first
    setFirestorePhoto(null);
    setEpfBalance("");
    setCreditScore("");
    setFinDataSaved(false);

    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.photoBase64) setFirestorePhoto(data.photoBase64);
        if (data.epf_balance) setEpfBalance(String(data.epf_balance));
        if (data.credit_score) setCreditScore(String(data.credit_score));
      }
    }).catch(() => {});
  }, [user?.uid]);

  const handleSaveFinancialData = async () => {
    setSavingFinData(true);
    setFinDataSaved(false);
    try {
      const token = await getToken();
      await fetch(`${API_BASE}/api/zerodha/manual-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          epf_balance: parseFloat(epfBalance) || 0,
          credit_score: parseInt(creditScore) || 0,
        }),
      });
      setFinDataSaved(true);
      setTimeout(() => setFinDataSaved(false), 3000);
    } catch {
      // silent
    } finally {
      setSavingFinData(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = await getToken();
      const headers = { Authorization: `Bearer ${token}` };
      const tools = ["fetch_net_worth", "fetch_bank_transactions", "fetch_mf_transactions", "fetch_stock_transactions", "fetch_epf_details", "fetch_credit_report"];
      const results = await Promise.allSettled(
        tools.map((t) => fetch(`${API_BASE}/api/finance/snapshot/${t}`, { headers }).then((r) => r.ok ? r.json() : null))
      );
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: { name: user.displayName, email: user.email },
        data: {},
      };
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value?.data) exportData.data[tools[i]] = r.value.data;
      });
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fi_financial_data_${(user.displayName || "user").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  };

  const handleEditProfile = () => {
    setEditName(user.displayName || "");
    setEditPhoto(null);
    setEditing(true);
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 64, 64);
        const smallBase64 = canvas.toDataURL("image/jpeg", 0.5);
        setEditPhoto(smallBase64);
        setEditPhotoFile(smallBase64);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const updates = { displayName: editName.trim() };
      // Save photo to Firestore (small base64)
      if (editPhotoFile) {
        await setDoc(doc(db, "users", user.uid), { photoBase64: editPhotoFile }, { merge: true });
      }
      await updateProfile(auth.currentUser, updates);
      window.location.reload();
    } catch (err) {
      alert("Failed to update profile: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  if (authLoading || !user) return null;

  const joinedDate = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";
  const lastLogin = user.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";
  const provider = user.providerData?.[0]?.providerId === "google.com" ? "Google" :
    user.providerData?.[0]?.providerId === "password" ? "Email/Password" :
    user.providerData?.[0]?.providerId || "—";
  const uid = user.uid || "—";

  // Calculate days since joined
  const daysSinceJoined = user.metadata?.creationTime
    ? Math.floor((Date.now() - new Date(user.metadata.creationTime).getTime()) / 86400000)
    : 0;

  return (
    <div className="flex h-screen bg-bg-primary">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center gap-3 px-6 py-4 border-b border-white/5 glass">
          <button onClick={() => navigate("/chat")}
            className="p-2 rounded-lg hover:bg-white/5 text-text-muted hover:text-text-primary transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="w-8 h-8 rounded-lg gradient-accent flex items-center justify-center glow-accent-sm">
            <User size={14} className="text-white" />
          </div>
          <h1 className="text-base font-semibold gradient-text">Profile</h1>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Hero Banner + Avatar */}
          <div className="relative">
            {/* Banner */}
            <div className="h-28 relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.3), rgba(52,211,153,0.15))",
              }}>
              <div className="absolute inset-0" style={{
                background: "radial-gradient(circle at 30% 50%, rgba(124,58,237,0.2), transparent 60%), radial-gradient(circle at 80% 50%, rgba(59,130,246,0.2), transparent 60%)",
              }} />
              {/* Decorative dots */}
              <div className="absolute top-4 right-6 flex items-center gap-1">
                <Sparkles size={14} className="text-violet-300/40" />
              </div>
            </div>

            {/* Avatar - overlapping banner */}
            <div className="flex flex-col items-center -mt-12 relative z-10">
              {(firestorePhoto || user.photoURL) ? (
                <img src={firestorePhoto || user.photoURL} alt="avatar" referrerPolicy="no-referrer"
                  className="w-20 h-20 rounded-2xl shadow-2xl"
                  style={{ border: "3px solid rgba(124,58,237,0.4)", boxShadow: "0 0 20px rgba(124,58,237,0.2)" }}
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-2xl"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                    border: "3px solid rgba(124,58,237,0.4)",
                    boxShadow: "0 0 20px rgba(124,58,237,0.2)",
                  }}>
                  {user.displayName?.[0] || user.email?.[0] || "U"}
                </div>
              )}
              <h2 className="text-lg font-bold text-white mt-3">{user.displayName || "User"}</h2>
              <p className="text-xs text-text-muted">{user.email}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-medium">Active</span>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">

            {/* Account Details */}
            <div className="animate-fadein">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
                Account Details
              </p>
              <div className="rounded-xl divide-y divide-white/5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <InfoRow icon={User} label="Full Name" value={user.displayName || "—"} color="text-violet-400" />
                <InfoRow icon={Mail} label="Email" value={user.email || "—"} color="text-blue-400" />
                <InfoRow icon={Calendar} label="Joined" value={joinedDate} color="text-emerald-400" />
                <InfoRow icon={Clock} label="Last Login" value={lastLogin} color="text-amber-400" />
                <InfoRow icon={Shield} label="Auth Provider" value={provider} color="text-pink-400" />
                <InfoRow icon={Zap} label="Account ID" value={`...${uid.slice(-8)}`} color="text-cyan-400" />
              </div>
            </div>

            {/* Connected Services */}
            <div className="animate-fadein">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
                Connected Services
              </p>
              <div className="rounded-xl divide-y divide-white/5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <ServiceCard name="Zerodha Kite (MCP)" icon="📈" connected={true} desc="Stocks & Mutual Funds via Kite Connect" />
                <ServiceCard name="Bank Statement" icon="🏦" connected={true} desc="Upload PDF/CSV for bank data" />
                <ServiceCard name="Google Account" icon="🔗" connected={provider === "Google"} desc={provider === "Google" ? `Linked as ${user.email}` : "Not linked"} />
                <ServiceCard name="Firebase Auth" icon="🔐" connected={true} desc="Identity & session management" />
                <ServiceCard name="Groq AI (LLaMA)" icon="🧠" connected={true} desc="AI reasoning engine" />
              </div>
            </div>

            {/* Financial Data Entry */}
            <div className="animate-fadein">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
                📊 My Financial Data (Manual Entry)
              </p>
              <div className="rounded-xl p-4 space-y-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-amber-400"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <Briefcase size={15} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-text-muted mb-1 block">EPF Balance (₹)</label>
                    <input
                      type="number"
                      value={epfBalance}
                      onChange={(e) => setEpfBalance(e.target.value)}
                      placeholder="e.g. 300000"
                      className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted
                                 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20
                                 transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-cyan-400"
                    style={{ background: "rgba(255,255,255,0.04)" }}>
                    <CreditCard size={15} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-text-muted mb-1 block">Credit Score (300-900)</label>
                    <input
                      type="number"
                      value={creditScore}
                      onChange={(e) => setCreditScore(e.target.value)}
                      placeholder="e.g. 750"
                      min="300" max="900"
                      className="w-full px-3 py-2 rounded-lg text-sm text-white placeholder-text-muted
                                 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20
                                 transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleSaveFinancialData}
                  disabled={savingFinData}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium
                             bg-violet-500/15 text-violet-300 hover:bg-violet-500/25
                             border border-violet-500/20 transition-all disabled:opacity-50"
                >
                  {savingFinData ? (
                    <><RefreshCw size={12} className="animate-spin" /> Saving...</>
                  ) : finDataSaved ? (
                    <><CheckCircle2 size={12} className="text-emerald-400" /> Saved!</>
                  ) : (
                    <><Save size={12} /> Save Financial Data</>
                  )}
                </button>
                <p className="text-[10px] text-text-muted text-center">
                  EPF: Check at epfindia.gov.in • Credit Score: Check on CRED or Paytm
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="animate-fadein">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2 px-1">
                Quick Actions
              </p>
              <div className="rounded-xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <ActionButton icon={Pencil} label="Edit Profile" onClick={handleEditProfile} />
                <ActionButton icon={MessageSquare} label="Open AI Chat" onClick={() => navigate("/chat")} />
                <ActionButton icon={Download} label={exporting ? "Exporting..." : "Export Financial Data"} onClick={handleExport} />
                {!showConfirm ? (
                  <ActionButton icon={LogOut} label="Sign Out" onClick={() => setShowConfirm(true)} danger />
                ) : (
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs text-text-secondary text-center">Are you sure?</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowConfirm(false)}
                        className="flex-1 py-2 rounded-lg text-xs text-text-muted hover:text-white transition-colors"
                        style={{ background: "rgba(255,255,255,0.04)" }}>
                        Cancel
                      </button>
                      <button onClick={logout}
                        className="flex-1 py-2 rounded-lg text-xs bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors">
                        Confirm Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Edit Profile Modal */}
            {editing && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="w-full max-w-sm mx-4 rounded-2xl p-6 animate-fadein"
                  style={{ background: "linear-gradient(135deg, rgba(30,20,50,0.98), rgba(20,15,40,0.98))", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Edit Profile</h3>
                    <button onClick={() => setEditing(false)} className="p-1 rounded hover:bg-white/5 text-text-muted"><X size={16} /></button>
                  </div>
                  <div className="space-y-4">
                    {/* Profile Photo */}
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative group cursor-pointer" onClick={() => document.getElementById("photo-input").click()}>
                        {(editPhoto || firestorePhoto || user.photoURL) ? (
                          <img src={editPhoto || firestorePhoto || user.photoURL} alt="avatar" referrerPolicy="no-referrer"
                            className="w-20 h-20 rounded-2xl object-cover"
                            style={{ border: "2px solid rgba(124,58,237,0.4)" }}
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}>
                            {editName?.[0] || "U"}
                          </div>
                        )}
                        <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera size={20} className="text-white" />
                        </div>
                      </div>
                      <input id="photo-input" type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                      <button type="button" onClick={() => document.getElementById("photo-input").click()}
                        className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                        Change Photo
                      </button>
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted uppercase tracking-wider">Display Name</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-violet-500/50"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-text-muted uppercase tracking-wider">Email</label>
                      <input type="email" value={user.email || ""} disabled
                        className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-text-muted outline-none opacity-50 cursor-not-allowed"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      />
                    </div>
                    <button onClick={handleSaveProfile} disabled={saving || !editName.trim()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #3b82f6)" }}>
                      {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="text-center py-3">
              <p className="text-[10px] text-text-muted">
                Fi AI Agent v1.0 • Powered by LLaMA 3.3 via Groq • Firebase + MCP
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
