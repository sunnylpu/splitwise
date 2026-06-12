import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { motion, AnimatePresence } from "motion/react";
import { 
  Wallet, 
  LogIn, 
  CheckCircle, 
  ShieldCheck, 
  Users, 
  Mail, 
  Lock, 
  User, 
  ArrowLeft, 
  Sparkles,
  AlertCircle
} from "lucide-react";

export const LoginScreen: React.FC = () => {
  const { loginWithGoogle, signUpWithEmail, signInWithEmail, sendPasswordReset, loading } = useApp();
  
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [localLoading, setLocalLoading] = useState(false);

  // Map Firebase Codes to Clear Help Messages
  const getFriendlyErrorMessage = (err: any): string => {
    if (!err) return "";
    const code = err.code || "";
    switch (code) {
      case "auth/email-already-in-use":
        return "This email is already registered. Try signing in!";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password must be at least 6 characters long.";
      case "auth/user-not-found":
        return "No account exists with this email address.";
      case "auth/wrong-password":
        return "Incorrect password. Please try again.";
      case "auth/invalid-credential":
        return "Incorrect email or password. Please try again.";
      default:
        return err.message || "An unexpected error occurred.";
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    setError("");
    setMessage("");
    setLocalLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLocalLoading(false);
    }
  };

  const handlePasswordSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setError("");
    setMessage("");
    setLocalLoading(true);
    try {
      await signUpWithEmail(email, password, name.trim());
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLocalLoading(false);
    }
  };

  const handlePasswordResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localLoading) return;
    setError("");
    setMessage("");
    setLocalLoading(true);
    try {
      await sendPasswordReset(email);
      setMessage("Success! A password reset link has been dispatched to your email address.");
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLocalLoading(false);
    }
  };

  const handleModeChange = (newMode: "signin" | "signup" | "reset") => {
    setMode(newMode);
    setError("");
    setMessage("");
    // Keep email populated for convenience between signin <-> reset forms
    if (newMode !== "reset" && newMode !== "signin") {
      setEmail("");
    }
    setPassword("");
    setName("");
  };

  const isBtnDisabled = loading || localLoading;

  return (
    <div
      id="login-container"
      className="flex min-h-screen items-center justify-center bg-radial from-slate-50 to-slate-100 p-4 font-sans selection:bg-teal-100"
    >
      <motion.div
        id="login-card"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl bg-white p-7 sm:p-8 shadow-xl border border-slate-200"
      >
        {/* Visual Brand Header */}
        <div id="login-brand-header" className="flex flex-col items-center text-center">
          <div
            id="brand-icon-wrapper"
            className="mb-3.5 flex h-14 w-14 items-center justify-center rounded-xl bg-teal-50 text-teal-600 shadow-xs"
          >
            <Wallet id="brand-icon" className="h-8 w-8 stroke-[1.75]" />
          </div>
          <h1
            id="brand-title"
            className="text-2xl font-black tracking-tight text-slate-800"
          >
            Splitwise <span className="text-teal-700">Pro</span>
          </h1>
          <p id="brand-subtitle" className="mt-1.5 text-xs text-slate-500 leading-relaxed max-w-sm">
            {mode === "signin" && "Share bills, split expenses, and coordinate balances without the awkward cash chat."}
            {mode === "signup" && "Create your secure Splitwise Pro account and start splitting live bills with your peers."}
            {mode === "reset" && "Request a secure password reset link to regain instant access to your lended balances."}
          </p>
        </div>

        {/* Dynamic Alerts */}
        <AnimatePresence mode="popLayout">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              id="login-error-alert"
              className="mt-5 flex items-start gap-2.5 rounded-lg bg-rose-50 border border-rose-100 p-3 text-xs text-rose-700"
            >
              <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-medium leading-normal">{error}</span>
            </motion.div>
          )}

          {message && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              id="login-success-alert"
              className="mt-5 flex items-start gap-2.5 rounded-lg bg-teal-55 border border-teal-100 p-3 text-xs text-teal-800"
            >
              <CheckCircle className="h-4.5 w-4.5 text-teal-600 shrink-0 mt-0.5" />
              <span className="font-semibold leading-normal">{message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Authentication Forms */}
        <div id="auth-forms-holder" className="mt-6">
          {mode === "signin" && (
            <form id="signin-form" onSubmit={handlePasswordSignIn} className="space-y-4">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    disabled={isBtnDisabled}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full pl-9.5 pr-4 py-2.5 text-xs border border-slate-200 bg-white hover:border-slate-350 focus:border-teal-500 focus:outline-none rounded-lg font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-widest">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => handleModeChange("reset")}
                    className="text-[10px] font-extrabold text-teal-600 uppercase hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    disabled={isBtnDisabled}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9.5 pr-4 py-2.5 text-xs border border-slate-200 bg-white hover:border-slate-350 focus:border-teal-500 focus:outline-none rounded-lg font-medium transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isBtnDisabled}
                className="w-full flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-3 rounded-lg cursor-pointer transition-all active:scale-97 disabled:opacity-50 shadow-sm"
              >
                {localLoading ? (
                  <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Log In with Credentials"
                )}
              </button>
            </form>
          )}

          {mode === "signup" && (
            <form id="signup-form" onSubmit={handlePasswordSignUp} className="space-y-4">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Your Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    disabled={isBtnDisabled}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full pl-9.5 pr-4 py-2.5 text-xs border border-slate-200 bg-white hover:border-slate-350 focus:border-teal-500 focus:outline-none rounded-lg font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    disabled={isBtnDisabled}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full pl-9.5 pr-4 py-2.5 text-xs border border-slate-200 bg-white hover:border-slate-350 focus:border-teal-500 focus:outline-none rounded-lg font-medium transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Choose Password (min 6 char)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    disabled={isBtnDisabled}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9.5 pr-4 py-2.5 text-xs border border-slate-200 bg-white hover:border-slate-350 focus:border-teal-500 focus:outline-none rounded-lg font-medium transition-all"
                  />
                </div>
              </div>

              <div className="p-3 bg-teal-50/40 border border-teal-100 rounded-lg">
                <p className="text-[10px] text-teal-800 leading-normal font-semibold flex gap-1.5">
                  <Sparkles className="h-4 w-4 text-teal-600 shrink-0" />
                  Legitimacy Guard: A verification link will be dispatched to your email on submission. Action is necessary to access rosters.
                </p>
              </div>

              <button
                type="submit"
                disabled={isBtnDisabled}
                className="w-full flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-3 rounded-lg cursor-pointer transition-all active:scale-97 disabled:opacity-50 shadow-sm"
              >
                {localLoading ? (
                  <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Create Free Ledger Account"
                )}
              </button>
            </form>
          )}

          {mode === "reset" && (
            <form id="reset-form" onSubmit={handlePasswordResetRequest} className="space-y-4">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
                  Your Account Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    disabled={isBtnDisabled}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full pl-9.5 pr-4 py-2.5 text-xs border border-slate-200 bg-white hover:border-slate-350 focus:border-teal-500 focus:outline-none rounded-lg font-medium transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isBtnDisabled}
                className="w-full flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold py-3 rounded-lg cursor-pointer transition-all active:scale-97 disabled:opacity-50 shadow-sm"
              >
                {localLoading ? (
                  <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  "Dispatch Password Reset Link"
                )}
              </button>
            </form>
          )}
        </div>

        {/* Separator for Google Login (only for signin/signup modes) */}
        {mode !== "reset" && (
          <>
            <div id="login-separator" className="relative flex py-5 items-center">
              <div className="flex-grow border-t border-slate-100"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">or</span>
              <div className="flex-grow border-t border-slate-100"></div>
            </div>

            {/* Google Authentication */}
            <button
              id="google-signin-btn"
              type="button"
              disabled={isBtnDisabled}
              onClick={loginWithGoogle}
              className="flex w-full items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all cursor-pointer active:scale-98 disabled:opacity-50"
            >
              {loading ? (
                <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
              ) : (
                <>
                  <LogIn className="h-4.5 w-4.5 text-slate-400" />
                  Sign in with Google Account
                </>
              )}
            </button>
          </>
        )}

        {/* Form Footer Action Switches */}
        <div id="login-form-footer" className="mt-6 pt-4 border-t border-slate-100 text-center">
          {mode === "signin" && (
            <p className="text-xs text-slate-500">
              New to Splitwise Pro?{" "}
              <button
                type="button"
                onClick={() => handleModeChange("signup")}
                className="font-bold text-teal-600 hover:underline cursor-pointer"
              >
                Create Account
              </button>
            </p>
          )}

          {mode === "signup" && (
            <p className="text-xs text-slate-500">
              Have an account already?{" "}
              <button
                type="button"
                onClick={() => handleModeChange("signin")}
                className="font-bold text-teal-600 hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </p>
          )}

          {mode === "reset" && (
            <button
              type="button"
              onClick={() => handleModeChange("signin")}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors mx-auto cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </button>
          )}
        </div>
      </motion.div>

      {/* Decorative Value Props (only displayed next to sign-in on desktop layout) */}
      {mode === "signin" && (
        <div id="desktop-value-props" className="hidden lg:flex flex-col ml-12 max-w-sm space-y-6">
          <div className="flex items-center gap-4 text-slate-705">
            <div className="bg-white rounded-xl p-2.5 shadow-xs border border-slate-100 shrink-0">
              <Users className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Custom billing groups</h4>
              <p className="text-xs text-slate-500 mt-0.5">Manage roommates, trips, dinners or relative splits easily.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-705">
            <div className="bg-white rounded-xl p-2.5 shadow-xs border border-slate-100 shrink-0">
              <CheckCircle className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Advanced math calculators</h4>
              <p className="text-xs text-slate-500 mt-0.5">Adjust ratios using percentages, custom shares or equal weightings.</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-slate-705">
            <div className="bg-white rounded-xl p-2.5 shadow-xs border border-slate-100 shrink-0">
              <ShieldCheck className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Real-time database sync</h4>
              <p className="text-xs text-slate-500 mt-0.5">Secure Firestore-backed records with expense-level room chats.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
