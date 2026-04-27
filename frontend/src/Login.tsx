import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheckCircle, FiEye, FiEyeOff, FiArrowRight, FiMail, FiLock, FiUser, FiBriefcase, FiChevronLeft } from "react-icons/fi";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { PrivacyPolicy } from "./components/PrivacyPolicy";
import { Button } from "@/components/ui/button";

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const isAdminView = typeof window !== 'undefined' && (window.location.pathname.includes('/admin') || window.location.pathname.includes('/nexa-ai/admin'));
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  // Request-access (public business signup) — replaces the old self-register flow.
  const [companyName, setCompanyName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [requestSubmitted, setRequestSubmitted] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isLogin) {
      const employees = parseInt(employeeCount, 10);
      if (!Number.isFinite(employees) || employees <= 0) {
        setError("Number of employees must be a positive number.");
        return;
      }
      setLoading(true);
      try {
        await axios.post("/api/v1/public/request-access", {
          companyName: companyName.trim(),
          workEmail: workEmail.trim(),
          phone: phone.trim(),
          employeeCount: employees,
        });
        setRequestSubmitted(true);
        setCompanyName("");
        setWorkEmail("");
        setPhone("");
        setEmployeeCount("");
      } catch (err: any) {
        setError(err.response?.data?.error || "Could not submit your request. Please try again.");
      } finally {
        setLoading(false);
      }
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

  return (
    <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row overflow-hidden font-sans">
      {/* Left Side: Visual/Content — hidden on mobile */}
      <div className="lg:w-1/2 relative hidden lg:flex flex-col justify-center p-8 md:p-16 lg:p-24 overflow-hidden min-h-[500px] lg:min-h-screen">
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
          <Link to="/" className="flex items-center gap-4 mb-16 w-fit">
            <div className="flex items-center justify-center">
              <img src="/1879-22.png" alt="1879 Tech Hub" className="w-12 h-12 object-contain" />
            </div>
            <span className="font-bold text-3xl text-[#1A1A1A] tracking-tight">nexa.ai</span>
          </Link>

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
              {isLogin ? "Sign In" : requestSubmitted ? "Request Received" : "Request Access"}
            </h2>
            <p className="text-lg text-muted-foreground font-normal">
              {isLogin
                ? "Enter your credentials to access Nexa"
                : requestSubmitted
                  ? "Thanks — we've got your details and will get back to you soon."
                  : "Tell us about your business and we'll get back to you."}
            </p>
          </div>

          {!isLogin && requestSubmitted ? (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-green-500/5 border border-green-500/20 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <FiCheckCircle size={22} className="text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-[#1A1A1A] mb-1">We received your request</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A confirmation email is on its way to your inbox. Our team will be in touch shortly to walk you
                    through next steps.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => {
                  setIsLogin(true);
                  setRequestSubmitted(false);
                  setError("");
                }}
                className="w-full py-7 rounded-2xl bg-primary hover:bg-primary/90 text-white font-semibold text-lg shadow-2xl shadow-primary/20 transition-all flex items-center justify-center gap-3 group mt-2"
              >
                Back to sign in
                <FiArrowRight className="group-hover:translate-x-1 transition-transform w-5 h-5" />
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A] ml-1">Company Name</label>
                    <div className="relative group">
                      <FiBriefcase className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        placeholder="e.g. Acme Industries"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required
                        className="w-full pl-14 pr-5 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-[#1A1A1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A] ml-1">Work Email</label>
                    <div className="relative group">
                      <FiMail className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="email"
                        placeholder="you@company.com"
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        required
                        className="w-full pl-14 pr-5 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-[#1A1A1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A] ml-1">Phone Number</label>
                    <div className="relative group">
                      <FiUser className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="tel"
                        placeholder="+1 555 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        className="w-full pl-14 pr-5 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-[#1A1A1A]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#1A1A1A] ml-1">Number of Employees</label>
                    <div className="relative group">
                      <FiBriefcase className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="number"
                        min={1}
                        placeholder="e.g. 250"
                        value={employeeCount}
                        onChange={(e) => setEmployeeCount(e.target.value)}
                        required
                        className="w-full pl-14 pr-5 py-5 bg-[#F8F9FF] border border-border/60 rounded-2xl focus:outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/5 transition-all font-medium text-[#1A1A1A]"
                      />
                    </div>
                  </div>
                </>
              )}

              {isLogin && (
                <>
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
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs font-bold text-primary hover:underline"
                      >
                        Forgot Password?
                      </button>
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
                </>
              )}

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

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-7 rounded-2xl bg-primary hover:bg-primary/90 text-white font-semibold text-lg shadow-2xl shadow-primary/20 transition-all flex items-center justify-center gap-3 group mt-4"
              >
                {loading ? "Please wait..." : (
                  <>
                    {isLogin ? "Sign In" : "Submit Request"}
                    <FiArrowRight className="group-hover:translate-x-1 transition-transform w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-12 text-center">
            <p className="text-muted-foreground font-medium text-base">
              {isLogin ? "New to Nexa? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setRequestSubmitted(false);
                }}
                className="text-primary font-bold hover:underline"
              >
                {isLogin ? "Request access" : "Sign in instead"}
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

      </AnimatePresence>

      {showPolicy && (
        <PrivacyPolicy isOpen={showPolicy} onClose={() => setShowPolicy(false)} type="user" variant="light" />
      )}
    </div>
  );
};
