import React, { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mail, 
  RotateCw, 
  LogOut, 
  CheckCircle, 
  ShieldCheck, 
  AlertCircle,
  HelpCircle,
  Sparkles
} from "lucide-react";

export const EmailVerificationScreen: React.FC = () => {
  const { currentUser, logout, resendVerificationEmail, reloadCurrentUser } = useApp();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Handle Cooldown Interval countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleCheckStatus = async () => {
    if (checking) return;
    setChecking(true);
    setError("");
    setSuccess("");
    try {
      await reloadCurrentUser();
      // Reload updates currentUser state in Context.
      // If still not verified, show a friendly status update
      if (currentUser && !currentUser.emailVerified) {
        setError("Our ledger hub indicates your email is still unverified. Please tap the confirmation link in your inbox.");
      } else {
        setSuccess("Success! Your email has been validated. Entering Splitwise Pro...");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to check verification status.");
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setSuccess("");
    try {
      await resendVerificationEmail();
      setSuccess("A fresh security link was sent to your email. Check your spam folders if it does not arrive.");
      setCooldown(60); // 60 seconds cooldown to curb spamming
    } catch (err: any) {
      setError(err?.message || "Failed to dispatch verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      id="verification-container"
      className="flex min-h-screen items-center justify-center bg-radial from-slate-50 to-slate-100 p-4 font-sans selection:bg-teal-100"
    >
      <motion.div
        id="verification-card"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-2xl bg-white p-7 sm:p-8 shadow-xl border border-slate-200 text-center"
      >
        {/* Animated Icon Header */}
        <div className="flex flex-col items-center">
          <div className="relative mb-5">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 shadow-xs"
            >
              <Mail className="h-9 w-9 stroke-[1.75]" />
            </motion.div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white shadow-sm ring-2 ring-white">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-slate-800">
            Verify your email address
          </h1>
          <p className="mt-2 text-xs text-slate-500 leading-relaxed max-w-sm">
            We sent a verification link to <span className="font-bold text-slate-700">{currentUser?.email}</span>. Click the link to validate your identity.
          </p>
        </div>

        {/* Action Status Feedbacks */}
        <AnimatePresence mode="popLayout">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-5 flex items-start gap-2.5 rounded-lg bg-rose-50 border border-rose-100 p-3 text-xs text-rose-700 text-left"
            >
              <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
              <span className="font-semibold leading-normal">{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-5 flex items-start gap-2.5 rounded-lg bg-teal-50 border border-teal-100 p-3 text-xs text-teal-800 text-left"
            >
              <CheckCircle className="h-4.5 w-4.5 text-teal-600 shrink-0 mt-0.5" />
              <span className="font-bold leading-normal">{success}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buttons / Actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold py-3 px-4 rounded-lg cursor-pointer transition-all active:scale-97 disabled:opacity-50 shadow-sm"
          >
            {checking ? (
              <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <RotateCw className="h-4 w-4" />
                I have verified my email
              </>
            )}
          </button>

          <button
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="w-full text-xs font-bold py-3 px-4 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {cooldown > 0 ? (
              `Resend email link (${cooldown}s)`
            ) : resending ? (
              <span className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
            ) : (
              "Resend confirmation link"
            )}
          </button>
        </div>

        {/* Help box */}
        <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left">
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
            Ledger safety tip
          </h4>
          <p className="text-[10px] text-slate-500 leading-normal">
            No email received? Be sure to take a peek inside your **Spam** or **Promotions** folder, or query our verification link resender above.
          </p>
        </div>

        {/* Sign Out Back Navigation */}
        <div className="mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={logout}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Log Out from account
          </button>
        </div>
      </motion.div>
    </div>
  );
};
