import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheckCircle, FiEye, FiEyeOff, FiArrowRight, FiMail, FiLock, FiUser, FiBriefcase, FiChevronLeft } from "react-icons/fi";
import { Sparkles } from "lucide-react";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { Button } from "@/components/ui/button";

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

type BusinessUnit = "GCL" | "LSF" | "CAP" | "UFL" | "CHI" | "UAC-Restaurants" | "UPDC" | "UACN";

const DEFAULT_BUSINESS_UNITS: { label: string; value: BusinessUnit }[] = [
  { label: "Grand Cereals Limited (GCL)", value: "GCL" },
  { label: "Livestocks Feeds PLC (LSF)", value: "LSF" },
  { label: "Chemical and Allied Products PLC (CAP)", value: "CAP" },
  { label: "UAC Foods Limited (UFL)", value: "UFL" },
  { label: "CHI Limited", value: "CHI" },
  { label: "UAC Restaurants", value: "UAC-Restaurants" },
  { label: "UPDC", value: "UPDC" },
  { label: "UACN Group (UACN)", value: "UACN" }
];

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const isAdminView = typeof window !== 'undefined' && (window.location.pathname.includes('/admin') || window.location.pathname.includes('/nexa-ai/admin'));
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessUnit, setBusinessUnit] = useState<BusinessUnit | "">("");
  const [businessUnits, setBusinessUnits] = useState<{ label: string; value: BusinessUnit }[]>(DEFAULT_BUSINESS_UNITS);
  /** BU fixed from invite link (?businessUnit= or ?bu=) — employee signup only */
  const [buFromInvite, setBuFromInvite] = useState(false);
  const [inviteBuInvalid, setInviteBuInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationOTP, setVerificationOTP] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    const fetchBusinessUnits = async () => {
      try {
        const response = await axios.get('/api/v1/public/business-units');
        if (response.data.businessUnits && response.data.businessUnits.length > 0) {
          const buList = response.data.businessUnits.map((bu: any) => {
            if (typeof bu === 'string') {
              const defaultBU = DEFAULT_BUSINESS_UNITS.find(dbu => dbu.value === bu);
              return defaultBU || { label: bu, value: bu as BusinessUnit };
            } else {
              return {
                label: bu.label || bu.name,
                value: bu.name || bu.value
              };
            }
          });
          setBusinessUnits(buList);
        }
      } catch (error) {
        setBusinessUnits(DEFAULT_BUSINESS_UNITS);
      }
    };
    fetchBusinessUnits();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || isAdminView) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("register") === "1" || sp.get("signup") === "1") {
      setIsLogin(false);
    }
    const presetEmail = sp.get("email");
    if (presetEmail) {
      try {
        setEmail(decodeURIComponent(presetEmail.trim()));
      } catch {
        setEmail(presetEmail.trim());
      }
    }
  }, [isAdminView]);

  useEffect(() => {
    if (isAdminView) return;
    const raw =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("businessUnit") ||
          new URLSearchParams(window.location.search).get("bu")
        : null;
    if (!raw || !raw.trim()) {
      setBuFromInvite(false);
      setInviteBuInvalid(false);
      return;
    }
    let decoded: string;
    try {
      decoded = decodeURIComponent(raw.trim());
    } catch {
      decoded = raw.trim();
    }
    const match = businessUnits.find(
      (bu) =>
        bu.value === decoded ||
        String(bu.value).toLowerCase() === decoded.toLowerCase()
    );
    if (match) {
      setBusinessUnit(match.value);
      setBuFromInvite(true);
      setInviteBuInvalid(false);
    } else {
      setBuFromInvite(false);
      setInviteBuInvalid(true);
    }
  }, [businessUnits, isAdminView]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(false);
        setIsLogin(true);
        setEmail("");
        setPassword("");
        setFullName("");
        setBusinessUnit("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isLogin) {
      setShowConfirmation(true);
      return;
    }
    setLoading(true);
    localStorage.setItem("authInProgress", "true");
    try {
      const base = isAdminView ? "/api/v1/admin/auth" : "/api/v1/auth";
      const endpoint = `${base}/login`;
      const payload = { email, password };
      const { data } = await axios.post(endpoint, payload);
      localStorage.setItem("nexa-token", data.token);
      localStorage.setItem("nexa-user", JSON.stringify(data.user || data.admin));
      localStorage.removeItem("authInProgress");
      onLoginSuccess(data.token, data.user || data.admin);
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred");
      localStorage.removeItem("authInProgress");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    setConfirmationLoading(true);
    setError("");
    localStorage.setItem("authInProgress", "true");
    try {
      const base = isAdminView ? "/api/v1/admin/auth" : "/api/v1/auth";
      const endpoint = `${base}/register`;
      const payload =
        isAdminView
          ? { email, password, fullName, businessUnit }
          : { email, password, fullName, businessUnit };
      await axios.post(endpoint, payload);
      setShowConfirmation(false);
      setVerificationEmail(email);
      setShowVerification(true);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "An error occurred";
      setError(errorMsg);
      setShowConfirmation(false);
      localStorage.removeItem("authInProgress");
    } finally {
      setConfirmationLoading(false);
    }
  };

  const handleEditSignUp = () => {
    setShowConfirmation(false);
    setError("");
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const base = isAdminView ? "/api/v1/admin/auth" : "/api/v1/auth";
      await axios.post(`${base}/forgot-password`, { email: forgotEmail });
      setForgotSuccess(true);
      setForgotEmail("");
      setTimeout(() => {
        setForgotSuccess(false);
        setShowForgotPassword(false);
      }, 5000);
    } catch (err: any) {
      setForgotError(err.response?.data?.error || "An error occurred");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError("");
    setVerificationLoading(true);
    try {
      const base = isAdminView ? "/api/v1/admin/auth" : "/api/v1/auth";
      const { data } = await axios.post(`${base}/verify-email`, {
        email: verificationEmail,
        otp: verificationOTP
      });
      setVerificationSuccess(true);
      setVerificationOTP("");
      // Prefer the auto-login path when the backend returns a fresh token — drops the user
      // straight into their chat interface without having to log in again. Falls back to the
      // old "go back to login" flow for older backends that only return a message.
      if (data?.token && (data?.user || data?.admin)) {
        setTimeout(() => onLoginSuccess(data.token, data.user || data.admin), 800);
      } else {
        setTimeout(() => {
          setShowVerification(false);
          setVerificationSuccess(false);
          setIsLogin(true);
          setEmail("");
          setPassword("");
          setFullName("");
          setBusinessUnit("");
        }, 3000);
      }
    } catch (err: any) {
      setVerificationError(err.response?.data?.error || "Invalid or expired OTP");
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setVerificationError("");
    setVerificationLoading(true);
    try {
      const base = isAdminView ? "/api/v1/admin/auth" : "/api/v1/auth";
      await axios.post(`${base}/resend-verification`, {
        email: verificationEmail
      });
      setVerificationError("");
      alert("OTP resent to your email!");
    } catch (err: any) {
      setVerificationError(err.response?.data?.error || "Failed to resend OTP");
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* Left Side: Visual/Content */}
      <div className="lg:w-1/2 relative flex flex-col justify-center p-8 md:p-16 lg:p-24 overflow-hidden min-h-[500px] lg:min-h-screen">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2000&auto=format&fit=crop" 
            alt="Abstract AI Background" 
            className="w-full h-full object-cover opacity-20 grayscale brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#F8F9FF]/60 via-white/40 to-transparent" />
        </div>

        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[150px] -mr-96 -mt-96 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl mx-auto lg:mx-0 w-full">
          <div className="flex items-center gap-4 mb-16">
            <div className="flex items-center justify-center">
              <img src="/1879-22.png" alt="Nexa AI Logo" className="w-12 h-12 object-contain" />
            </div>
            <span className="font-bold text-3xl text-[#1A1A1A] tracking-tight">nexa.ai</span>
          </div>

          <div className="space-y-10">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-[#1A1A1A] leading-[1.05] font-sans">
              {isLogin ? (
                <>The future of <br /><span className="gradient-text italic font-normal">work</span> is here.</>
              ) : (
                <>Unlock your <br /><span className="gradient-text italic font-normal">workforce efficiency</span>.</>
              )}
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-xl font-normal">
              {isLogin 
                ? "Sign in to Nexa to access your organization's collective knowledge and transform your productivity."
                : "Create an account to start building your private AI knowledge base and empower your team with instant answers."}
            </p>
          </div>

          {/* Mock UI Visual inspired by screenshots - Scaled Up */}
          <div className="relative mt-24 w-full max-w-xl">
            <motion.div 
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              className="bg-white rounded-[3rem] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.12)] border border-border/40 p-10 relative z-10 w-full"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="h-3.5 w-48 bg-[#1A1A1A]/10 rounded-full" />
                  <div className="h-2.5 w-28 bg-[#1A1A1A]/5 rounded-full" />
                </div>
              </div>
              <div className="space-y-5">
                <div className="h-3 w-full bg-[#1A1A1A]/5 rounded-full" />
                <div className="h-3 w-11/12 bg-[#1A1A1A]/5 rounded-full" />
                <div className="h-3 w-4/5 bg-[#1A1A1A]/5 rounded-full" />
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ x: 30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="bg-primary text-white rounded-[2.5rem] shadow-2xl p-10 max-w-md absolute -bottom-20 -right-4 lg:-right-20 z-20 border-8 border-white"
            >
              <p className="text-base font-black uppercase tracking-[0.2em] mb-4 opacity-80">Nexa Insight</p>
              <p className="text-xl font-bold leading-relaxed">
                "Based on our internal documents, we can reduce project timelines by 30% using the new Nexa workflow."
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="lg:w-1/2 flex flex-col justify-center p-8 md:p-16 lg:p-24 bg-white relative z-10">
        <div className="max-w-xl mx-auto w-full">
          <button 
            onClick={() => window.location.href = '/'}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-900 transition-colors mb-12 group w-fit"
          >
            <FiChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-base font-semibold">Back</span>
          </button>

          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-[#1A1A1A] mb-3 font-sans tracking-tight">
              {isLogin ? "Sign In" : "Get Started"}
            </h2>
            <p className="text-lg text-muted-foreground font-normal">
              {isLogin ? "Enter your credentials to access Nexa" : "Empower your organization with Nexa AI."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && !isAdminView && inviteBuInvalid && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 text-sm font-medium">
                This invite link includes an organization code we don&apos;t recognize. Choose your business unit below,
                or ask your admin for an updated link.
              </div>
            )}
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#1A1A1A] ml-1">Full Name</label>
                  <div className="relative group">
                    <FiUser className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      placeholder="e.g. Alex Johnson"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required={!isLogin}
                      className="w-full pl-14 pr-5 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-[#1A1A1A]"
                    />
                  </div>
                </div>
                {!isAdminView && buFromInvite ? (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A] ml-1">Organization</label>
                    <div className="relative flex items-center gap-3 pl-14 pr-5 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl font-medium text-[#1A1A1A]">
                      <FiBriefcase className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <span>
                        {businessUnits.find((bu) => bu.value === businessUnit)?.label || businessUnit}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-1">
                      Set from your invite link. Access to documents is managed by your team&apos;s groups.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A] ml-1">Business Unit</label>
                    <div className="relative group">
                      <FiBriefcase className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <select
                        value={businessUnit || ""}
                        onChange={(e) => setBusinessUnit(e.target.value as BusinessUnit)}
                        required={!isLogin}
                        className="w-full pl-14 pr-12 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-[#1A1A1A] appearance-none cursor-pointer"
                      >
                        <option value="">Select your department</option>
                        {businessUnits.map((bu) => (
                          <option key={bu.value} value={bu.value}>
                            {bu.label}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                        <FiArrowRight className="rotate-90 w-4 h-4" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#1A1A1A] ml-1">Email Address</label>
              <div className="relative group">
                <FiMail className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-14 pr-5 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-[#1A1A1A]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-bold text-[#1A1A1A]">Password</label>
                {isLogin && (
                  <button 
                    type="button" 
                    onClick={() => setShowForgotPassword(true)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative group">
                <FiLock className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-14 pr-14 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-[#1A1A1A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                >
                  {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-5 rounded-2xl bg-destructive/5 border border-destructive/20 text-destructive text-sm font-bold flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <FiX size={14} />
                </div>
                {error}
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-green-500/5 border border-green-500/20 text-green-600 text-sm font-bold flex items-center gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <FiCheckCircle size={14} />
                </div>
                Account created successfully! You can now sign in.
              </motion.div>
            )}

            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full py-7 rounded-2xl bg-primary hover:bg-primary/90 text-white font-semibold text-lg shadow-2xl shadow-primary/20 transition-all flex items-center justify-center gap-3 group mt-4"
            >
              {loading ? "Please wait..." : (
                <>
                  {isLogin ? "Sign In" : "Create Account"}
                  <FiArrowRight className="group-hover:translate-x-1 transition-transform w-5 h-5" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground font-medium text-base">
              {isLogin ? "New to Nexa? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="text-primary font-bold hover:underline"
              >
                {isLogin ? "Create an account" : "Sign in instead"}
              </button>
            </p>
          </div>

          <div className="mt-12 pt-8 border-t border-border/40 text-center">
            <button
              type="button"
              onClick={() => setShowPolicy(true)}
              className="text-xs font-bold text-muted-foreground/60 hover:text-primary transition-colors uppercase tracking-widest"
            >
              Privacy Policy & Terms
            </button>
          </div>
        </div>
      </div>

      {/* Modals (Forgot Password, Confirmation, Verification) */}
      <AnimatePresence>
        {showForgotPassword && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
            onClick={() => !forgotSuccess && setShowForgotPassword(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 md:p-12 shadow-2xl border border-border/40 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {forgotSuccess ? (
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                    <FiCheckCircle size={40} className="text-green-500" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#1A1A1A] mb-4">Check Your Email</h2>
                  <p className="text-muted-foreground mb-8 leading-relaxed">
                    We've sent a password reset link to <strong>{forgotEmail}</strong>.
                  </p>
                  <Button onClick={() => setShowForgotPassword(false)} className="w-full py-6 rounded-2xl font-bold">
                    Got it
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-extrabold text-[#1A1A1A]">Reset Password</h2>
                    <button onClick={() => setShowForgotPassword(false)} className="text-muted-foreground hover:text-primary">
                      <FiX size={24} />
                    </button>
                  </div>
                  <form onSubmit={handleForgotPassword} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#1A1A1A] ml-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="name@company.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        className="w-full px-6 py-4 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 transition-all font-medium"
                      />
                    </div>
                    {forgotError && <div className="text-destructive text-sm font-bold">{forgotError}</div>}
                    <Button type="submit" disabled={forgotLoading} className="w-full py-6 rounded-2xl font-bold">
                      {forgotLoading ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </form>
                </>
              )}
            </motion.div>
          </motion.div>
        )}

        {showConfirmation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 md:p-12 shadow-2xl border border-border/40 w-full max-w-lg"
            >
              <h2 className="text-2xl font-extrabold text-[#1A1A1A] mb-2 text-center">Confirm Details</h2>
              <p className="text-muted-foreground text-center mb-10">Please verify your information before proceeding.</p>
              
              <div className="space-y-4 mb-10">
                {[
                  { label: "Full Name", value: fullName },
                  { label: "Business Unit", value: businessUnits.find(bu => bu.value === businessUnit)?.label || businessUnit },
                  { label: "Email", value: email }
                ].map((item, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-[#F8F9FF] border border-border/40">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{item.label}</p>
                    <p className="font-bold text-[#1A1A1A]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={handleEditSignUp} className="flex-1 py-6 rounded-2xl font-bold border-2">Edit</Button>
                <Button onClick={handleConfirmSignUp} disabled={confirmationLoading} className="flex-1 py-6 rounded-2xl font-bold">
                  {confirmationLoading ? "Processing..." : "Proceed"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showVerification && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 md:p-12 shadow-2xl border border-border/40 w-full max-w-md"
            >
              {verificationSuccess ? (
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                    <FiCheckCircle size={40} className="text-green-500" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-[#1A1A1A] mb-4">Email Verified!</h2>
                  <p className="text-muted-foreground leading-relaxed">Redirecting to login...</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-extrabold text-[#1A1A1A]">Verify Email</h2>
                    <button onClick={() => setShowVerification(false)} className="text-muted-foreground hover:text-primary">
                      <FiX size={24} />
                    </button>
                  </div>
                  <p className="text-muted-foreground mb-8">Enter the 6-digit code sent to <strong>{verificationEmail}</strong></p>
                  <form onSubmit={handleVerifyEmail} className="space-y-8">
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={verificationOTP}
                      onChange={(e) => setVerificationOTP(e.target.value.replace(/\D/g, ''))}
                      required
                      className="w-full text-center text-4xl font-black tracking-[0.5em] py-6 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 transition-all"
                    />
                    {verificationError && <div className="text-destructive text-sm font-bold text-center">{verificationError}</div>}
                    <Button type="submit" disabled={verificationLoading} className="w-full py-6 rounded-2xl font-bold">
                      {verificationLoading ? "Verifying..." : "Verify"}
                    </Button>
                  </form>
                  <div className="mt-8 text-center">
                    <button onClick={handleResendOTP} className="text-sm font-bold text-primary hover:underline">Resend Code</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPolicy && (
        <PrivacyPolicy isOpen={showPolicy} onClose={() => setShowPolicy(false)} type="user" variant="light" />
      )}
    </div>
  );
};
