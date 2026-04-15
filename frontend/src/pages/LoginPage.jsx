import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState("signin"); // "signin" | "register"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const clearForm = () => {
    setError("");
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  const switchMode = (m) => {
    setMode(m);
    clearForm();
  };

  /* ─── Google Sign In ─── */
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      navigate("/chat");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Email Sign In ─── */
  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/chat");
    } catch (err) {
      if (err.code === "auth/user-not-found") setError("No account found with this email");
      else if (err.code === "auth/wrong-password") setError("Incorrect password");
      else if (err.code === "auth/invalid-email") setError("Invalid email address");
      else if (err.code === "auth/invalid-credential") setError("Invalid email or password");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Register ─── */
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) { setError("Please fill in all fields"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    // Email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Block obviously fake emails
    const disposableDomains = ["test.com", "fake.com", "example.com", "temp.com", "mailinator.com"];
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (disposableDomains.includes(emailDomain)) {
      setError("Please use a real email address, not a disposable one");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });

      // Send verification email
      const { sendEmailVerification } = await import("firebase/auth");
      await sendEmailVerification(result.user);

      // Show verification message instead of navigating
      setError("");
      alert(`✅ Account created! A verification email has been sent to ${email}. Please verify your email before using all features.`);
      navigate("/chat");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("An account with this email already exists");
      else if (err.code === "auth/invalid-email") setError("Invalid email address");
      else if (err.code === "auth/weak-password") setError("Password is too weak — use at least 6 characters");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ─── Spinner ─── */
  const Spinner = () => (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );

  /* ─── Google Icon SVG ─── */
  const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary px-4 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.4), transparent)", filter: "blur(80px)" }}
      />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-10"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.4), transparent)", filter: "blur(80px)" }}
      />

      <div className="w-full max-w-md animate-fadein relative z-10">
        {/* Card */}
        <div
          className="rounded-2xl p-8 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(124,58,237,0.04))",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 0 60px rgba(124,58,237,0.06), 0 20px 40px rgba(0,0,0,0.4)",
          }}
        >
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
              style={{
                background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.2))",
                boxShadow: "0 0 20px rgba(124,58,237,0.15)",
              }}>
              <span className="text-2xl">💰</span>
            </div>
            <h1 className="text-xl font-bold" style={{
              background: "linear-gradient(135deg, #a78bfa, #60a5fa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Fi AI Agent</h1>
            <p className="text-text-muted text-xs mt-1">Your AI-powered financial advisor</p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: "rgba(255,255,255,0.04)" }}>
            <button
              onClick={() => switchMode("signin")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === "signin"
                  ? "bg-violet-500/20 text-violet-400 shadow-sm"
                  : "text-text-muted hover:text-white"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => switchMode("register")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                mode === "register"
                  ? "bg-violet-500/20 text-violet-400 shadow-sm"
                  : "text-text-muted hover:text-white"
              }`}
            >
              Register
            </button>
          </div>

          {/* Form */}
          <form onSubmit={mode === "signin" ? handleEmailSignIn : handleRegister} className="space-y-3">
            {/* Name (Register only) */}
            {mode === "register" && (
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-text-muted outline-none transition-all duration-200 focus:ring-1 focus:ring-violet-500/50"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="email"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-text-muted outline-none transition-all duration-200 focus:ring-1 focus:ring-violet-500/50"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white placeholder-text-muted outline-none transition-all duration-200 focus:ring-1 focus:ring-violet-500/50"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Confirm Password (Register only) */}
            {mode === "register" && (
              <div className="relative">
                <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-text-muted outline-none transition-all duration-200 focus:ring-1 focus:ring-violet-500/50"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-2.5 rounded-lg text-xs text-red-400 text-center"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                boxShadow: "0 4px 15px rgba(124,58,237,0.3)",
              }}
            >
              {loading ? <Spinner /> : (
                <>
                  {mode === "signin" ? "Login" : "Create Account"}
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-[10px] text-text-muted uppercase tracking-wider">or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 hover:scale-[1.01]"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <GoogleIcon />
            <span className="text-text-secondary">Continue with Google</span>
          </button>

          {/* Footer */}
          <div className="mt-5 text-center">
            <p className="text-[10px] text-text-muted flex items-center justify-center gap-1">
              <Sparkles size={10} className="text-violet-400" />
              Secured by Firebase Authentication
            </p>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-text-muted text-[10px] mt-4">
          AI-generated analysis, not professional financial advice.
        </p>
      </div>
    </div>
  );
}
