import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiX, FiCheckCircle, FiEye, FiEyeOff } from "react-icons/fi";
import { PrivacyPolicyFooter, PrivacyPolicy } from "./components/PrivacyPolicy";

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
  // If the app is loaded under an admin route, show admin-only login UI
  const isAdminView = typeof window !== 'undefined' && (window.location.pathname.includes('/admin') || window.location.pathname.includes('/nexa-ai/admin'));
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessUnit, setBusinessUnit] = useState<BusinessUnit | "">();
  const [businessUnits, setBusinessUnits] = useState<{ label: string; value: BusinessUnit }[]>(DEFAULT_BUSINESS_UNITS);
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchBusinessUnits = async () => {
      try {
        const response = await axios.get('/api/v1/public/business-units');
        if (response.data.businessUnits && response.data.businessUnits.length > 0) {
          // Handle both old format (array of strings) and new format (array of objects)
          const buList = response.data.businessUnits.map((bu: any) => {
            if (typeof bu === 'string') {
              // Old format: just the name
              const defaultBU = DEFAULT_BUSINESS_UNITS.find(dbu => dbu.value === bu);
              return defaultBU || { label: bu, value: bu as BusinessUnit };
            } else {
              // New format: object with name, label, value
              return {
                label: bu.label || bu.name,
                value: bu.name || bu.value
              };
            }
          });
          setBusinessUnits(buList);
        }
      } catch (error) {
        console.error('Error fetching business units:', error);
        setBusinessUnits(DEFAULT_BUSINESS_UNITS);
      }
    };

    fetchBusinessUnits();
  }, []);

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

    // If signing up, show confirmation screen instead of submitting
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

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || data.admin));
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
      const payload = { email, password, fullName, businessUnit };

      await axios.post(endpoint, payload);

      // Show OTP verification modal
      setShowConfirmation(false);
      setVerificationEmail(email);
      setShowVerification(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "An error occurred");
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
      await axios.post(`${base}/verify-email`, {
        email: verificationEmail,
        otp: verificationOTP
      });
      setVerificationSuccess(true);
      setVerificationOTP("");

      setTimeout(() => {
        setShowVerification(false);
        setVerificationSuccess(false);
        setIsLogin(true);
        setEmail("");
        setPassword("");
        setFullName("");
        setBusinessUnit("");
      }, 3000);
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
      setVerificationError(""); // Clear any previous errors
      alert("OTP resent to your email!");
    } catch (err: any) {
      setVerificationError(err.response?.data?.error || "Failed to resend OTP");
    } finally {
      setVerificationLoading(false);
    }
  };

  return (
    <>
      <div
        className={`min-h-screen w-full text-slate-100 bg-[radial-gradient(circle_at_20%_20%,_rgba(94,92,229,0.25),_transparent_45%),linear-gradient(120deg,#0b1d3f,#102948)] overflow-x-hidden transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}
      >
        <div className="grid grid-cols-1 md:grid-cols-10 min-h-screen">
          <div className="order-2 md:order-1 md:col-span-6 flex flex-col justify-center px-6 md:px-12 lg:px-16 py-12 md:py-24 gap-8 bg-[linear-gradient(135deg,rgba(5,16,38,0.96),rgba(9,22,50,0.95))]">
            <div className="max-w-xl space-y-5">
              <p className="text-sm sm:text-base font-semibold uppercase tracking-wide text-cyan-300">Nexa AI</p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">Modern AI-Powered Business Insights</h1>
              <p className="text-slate-200 text-base sm:text-lg leading-relaxed">Securely sign in or create your account to get access to analytics, workflows, and document automation — built for enterprise teams.</p>
            </div>
            <div className="w-full max-w-2xl">
              <img
                src="/hero-bg.jpg"
                alt="AI assistant illustration"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.src = '/avatar-1.png';
                }}
                className="w-full rounded-3xl shadow-2xl border border-white/10 object-cover"
              />
            </div>
          </div>

          <div className="order-1 md:order-2 md:col-span-4 flex items-center justify-center px-4 sm:px-8 md:px-10 py-10 md:py-20 bg-white/5 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white/95 border border-slate-200/70 backdrop-blur-sm rounded-2xl shadow-2xl p-8 sm:p-10 text-slate-900">
              {success && (
                <div className="mb-5 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-700">
                  <p className="font-semibold">Account created successfully!</p>
                  <p className="text-sm">Redirecting to login page in 3 seconds…</p>
                </div>
              )}

              <div className="mb-8">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">{isAdminView ? (isLogin ? "Admin Sign In" : "Create Admin Account") : isLogin ? "Welcome Back" : "Create Account"}</h2>
                <p className="mt-2 text-sm sm:text-base text-slate-600">{isLogin ? "Sign in to your account" : "Create a new Nexa AI account"}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-slate-700" htmlFor="fullName">Full Name</label>
                      <input
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={!isLogin}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-700" htmlFor="businessUnit">Business Unit</label>
                      <select
                        id="businessUnit"
                        value={businessUnit || ""}
                        onChange={(e) => setBusinessUnit(e.target.value as BusinessUnit)}
                        required={!isLogin}
                        className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      >
                        <option value="">Select a Business Unit</option>
                        {businessUnits.map((bu) => (
                          <option key={bu.value} value={bu.value}>{bu.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label className="text-sm font-semibold text-slate-700" htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
                  <div className="relative mt-1">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      required
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="text-right">
                    <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm text-indigo-600 hover:text-indigo-700">
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-4 py-3 text-base font-semibold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "Please wait…" : isLogin ? "Sign In" : "Create Account"}
                </button>
              </form>

              <div className="mt-6 border-t border-slate-200 pt-4 text-center text-sm text-slate-600">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError("");
                  }}
                  className="ml-1 font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </div>

              <div className="pt-3 text-center text-xs text-slate-500">
                <button onClick={() => setShowPolicy(true)} className="underline hover:text-slate-700">Privacy Policy</button>
              </div>
            </div>
          </div>
        </div>

        {showForgotPassword && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Reset Password</h3>
                <button onClick={() => setShowForgotPassword(false)} className="text-slate-400 hover:text-slate-600"><FiX size={20}/></button>
              </div>
              <p className="mb-4 text-sm text-slate-600">Enter your email address to receive a reset link.</p>
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  placeholder="Email address"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  disabled={forgotLoading}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                {forgotError && <p className="text-sm text-rose-600">{forgotError}</p>}
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-70"
                >
                  {forgotLoading ? "Sending…" : "Send Reset Link"}
                </button>
              </form>
            </div>
          </div>
        )}

        {showConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-900">Confirm Your Information</h3>
              <p className="text-sm text-slate-600 mt-2 mb-4">Please verify that your information is correct before proceeding.</p>
              <div className="space-y-2 mb-4 text-sm text-slate-700">
                <p><span className="font-semibold">Full Name:</span> {fullName}</p>
                <p><span className="font-semibold">Business Unit:</span> {businessUnits.find(bu => bu.value === businessUnit)?.label || businessUnit}</p>
                <p><span className="font-semibold">Email:</span> {email}</p>
              </div>
              {error && <p className="mb-3 rounded-lg bg-rose-50 border border-rose-200 p-2 text-sm text-rose-700">{error}</p>}
              <div className="flex gap-3">
                <button onClick={handleEditSignUp} disabled={confirmationLoading} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-70">Edit</button>
                <button onClick={handleConfirmSignUp} disabled={confirmationLoading} className="flex-1 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-70">{confirmationLoading ? "Processing…" : "Proceed"}</button>
              </div>
            </div>
          </div>
        )}

        {showVerification && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              {verificationSuccess ? (
                <div className="text-center">
                  <FiCheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
                  <h3 className="text-lg font-semibold text-slate-900">Email Verified!</h3>
                  <p className="mt-2 text-sm text-slate-600">Your email has been verified successfully. Redirecting to login…</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Verify Your Email</h3>
                    <button onClick={() => setShowVerification(false)} className="text-slate-400 hover:text-slate-600"><FiX size={20}/></button>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">Enter the 6-digit code sent to <strong>{verificationEmail}</strong>.</p>
                  <form onSubmit={handleVerifyEmail} className="space-y-3">
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      value={verificationOTP}
                      onChange={(e) => setVerificationOTP(e.target.value.replace(/\D/g, ''))}
                      required
                      disabled={verificationLoading}
                      autoComplete="off"
                      inputMode="numeric"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg font-semibold tracking-widest outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                    {verificationError && <p className="text-sm text-rose-600">{verificationError}</p>}
                    <button type="submit" disabled={verificationLoading} className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-70">{verificationLoading ? "Verifying…" : "Verify"}</button>
                  </form>
                  <div className="mt-4 text-center text-sm text-slate-600">
                    <button onClick={handleResendOTP} disabled={verificationLoading} className="font-medium text-indigo-600 hover:text-indigo-700">Resend OTP</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {showPolicy && <PrivacyPolicy isOpen={showPolicy} onClose={() => setShowPolicy(false)} type="user" />}
      <PrivacyPolicyFooter type="user" />
    </>
  );
};
