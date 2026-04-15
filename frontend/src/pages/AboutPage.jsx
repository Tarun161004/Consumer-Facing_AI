import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Info,
  Sparkles,
  Shield,
  Cpu,
  ExternalLink,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Analysis",
    desc: "Get instant financial insights powered by LLaMA 3.3 through Groq.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    desc: "Your data is encrypted and stored securely in Firebase. We never share your information.",
  },
  {
    icon: Cpu,
    title: "Zerodha & Bank Integration",
    desc: "Connect your Zerodha account for real-time stocks & mutual funds. Upload bank statements (PDF/CSV) for transaction analysis.",
  },
];

const techStack = [
  "React 19 + Vite",
  "Vanilla CSS",
  "FastAPI (Python)",
  "Firebase Auth & Firestore",
  "Groq LLaMA 3.3-70B-versatile",
  "Zerodha Kite Connect",
  "pdfplumber & pandas",
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen bg-bg-primary">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
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
            <Info size={14} className="text-white" />
          </div>
          <h1 className="text-base font-semibold gradient-text">About</h1>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          {/* Hero */}
          <div className="glass-card rounded-2xl p-6 text-center animate-fadein">
            <div className="w-14 h-14 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-4 glow-accent-sm">
              <Sparkles size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-bold gradient-text mb-2">
              Fi AI Agent
            </h2>
            <p className="text-sm text-text-secondary">
              Fi AI Agent is a full-stack, AI-powered personal finance assistant built specifically for the Indian market. It combines a conversational AI interface with real-time financial data to deliver personalized, data-driven insights — going far beyond generic budgeting tools.
            </p>
            <p className="text-[10px] text-text-muted mt-3">Version 1.0.0</p>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted px-1">
              Features
            </p>
            {features.map((item) => (
              <div
                key={item.title}
                className="glass-card rounded-xl px-5 py-4 flex items-start gap-4 animate-fadein"
              >
                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-accent flex-shrink-0 mt-0.5">
                  <item.icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {item.title}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Tech Stack */}
          <div className="glass-card rounded-2xl p-5 animate-fadein">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-3">
              Tech Stack
            </p>
            <div className="flex flex-wrap gap-2">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 rounded-full text-xs glass text-text-secondary"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="glass-card rounded-2xl p-5 animate-fadein">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
              Disclaimer
            </p>
            <p className="text-xs text-text-secondary leading-relaxed">
              Fi AI Agent provides AI-generated financial analysis and is not a
              substitute for professional financial advice. Always verify
              important financial decisions with a qualified advisor.
            </p>
          </div>

          {/* Links */}
          <div className="glass-card rounded-2xl divide-y divide-white/5 animate-fadein">
            <a
              href="https://kite.trade"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ExternalLink size={14} className="text-accent" />
              Zerodha Kite Connect
            </a>
            <a
              href="https://zerodha.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 py-3 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ExternalLink size={14} className="text-accent" />
              Zerodha Website
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
