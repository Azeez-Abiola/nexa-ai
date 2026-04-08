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
      <div className="login-container">
        {success ? (
          <div className="success-card">
            <div className="success-icon">
              <FiCheckCircle size={48} />
            </div>
            <h2 className="success-title">Account Created Successfully!</h2>
            <p className="success-message">
              Your account has been created. Redirecting to login page in 3 seconds...
            </p>
          </div>
        ) : (
          <>
            {isAdminView && (
              <div className="logo-section">
                <img src="/logo.png" alt="Nexa AI Logo" className="brand-logo-above" />
              </div>
            )}
            <div className="login-wrapper">
              {!isAdminView && (
                <div className="avatar-image-section">
                  <video
                    src="/UAC AI AVATAR.mp4"
                    className="avatar-large-image"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                </div>
              )}
              <div className={`login-card ${isLogin && !isAdminView ? 'login-card-with-avatar' : ''} ${!isLogin && !isAdminView ? 'login-card-with-avatar' : ''}`}>
                {isLogin && (
                  <div className="login-logo-wrapper">
                    <img src="/logo.png" alt="Nexa AI Logo" className="login-logo-top" />
                  </div>
                )}
                <div className="login-card-header">
                  <h2>{isAdminView ? (isLogin ? "Admin Sign In" : "Create Admin Account") : (isLogin ? "Welcome Back" : "Create Account")}</h2>
                  <p className="login-subtitle">{isLogin ? "Sign in to your account" : "Create a new Nexa AI account"}</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                  {!isLogin && (
                    <>
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required={!isLogin}
                      />
                      <select
                        value={businessUnit || ""}
                        onChange={(e) => setBusinessUnit(e.target.value as BusinessUnit)}
                        required={!isLogin}
                      >
                        <option value="">Select a Business Unit</option>
                        {businessUnits.map((bu) => (
                          <option key={bu.value} value={bu.value}>
                            {bu.label}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />

                  <div className="password-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                    </button>
                  </div>

                  {isLogin && (
                    <button
                      type="button"
                      className="forgot-password-link"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Forgot Password?
                    </button>
                  )}

                  {error && <div className="login-error">{error}</div>}

                  <button type="submit" disabled={loading} className="login-btn">
                    {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
                  </button>
                </form>

                <div className="login-toggle">
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setError("");
                    }}
                    className="toggle-link"
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </div>

                <div className="privacy-policy-link-container">
                  <button
                    type="button"
                    onClick={() => setShowPolicy(true)}
                    className="privacy-policy-login-link"
                  >
                    Privacy Policy
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {showForgotPassword && (
          <div className="forgot-password-modal-overlay" onClick={() => !forgotSuccess && setShowForgotPassword(false)}>
            <div className="forgot-password-modal" onClick={(e) => e.stopPropagation()}>
              {forgotSuccess ? (
                <div className="forgot-password-success">
                  <div className="success-icon">
                    <FiCheckCircle size={48} />
                  </div>
                  <h2 className="success-title">Check Your Email</h2>
                  <p className="success-message">
                    We've sent a password reset link to <strong>{forgotEmail}</strong>.
                    The link will expire in 1 hour.
                  </p>
                  <button
                    className="forgot-password-close-btn"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotSuccess(false);
                    }}
                  >
                    Got it
                  </button>
                </div>
              ) : (
                <>
                  <button
                    className="forgot-password-close"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    <FiX size={24} />
                  </button>
                  <h2>Reset Your Password</h2>
                  <p className="forgot-subtitle">Enter the email address associated with your account</p>

                  <form onSubmit={handleForgotPassword} className="forgot-form">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      disabled={forgotLoading}
                    />
                    {forgotError && <div className="forgot-error">{forgotError}</div>}
                    <button type="submit" disabled={forgotLoading} className="forgot-btn">
                      {forgotLoading ? "Sending..." : "Send Reset Link"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {showConfirmation && (
          <div className="confirmation-modal-overlay" onClick={() => !confirmationLoading && setShowConfirmation(false)}>
            <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Confirm Your Information</h2>
              <p className="confirmation-subtitle">Please verify that your information is correct before proceeding</p>

              <div className="confirmation-details">
                <div className="confirmation-field">
                  <label>Full Name</label>
                  <p>{fullName}</p>
                </div>
                <div className="confirmation-field">
                  <label>Business Unit</label>
                  <p>{businessUnits.find(bu => bu.value === businessUnit)?.label || businessUnit}</p>
                </div>
                <div className="confirmation-field">
                  <label>Email</label>
                  <p>{email}</p>
                </div>
              </div>

              {error && <div className="confirmation-error">{error}</div>}

              <div className="confirmation-actions">
                <button
                  type="button"
                  className="confirmation-edit-btn"
                  onClick={handleEditSignUp}
                  disabled={confirmationLoading}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="confirmation-proceed-btn"
                  onClick={handleConfirmSignUp}
                  disabled={confirmationLoading}
                >
                  {confirmationLoading ? "Processing..." : "Proceed"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showVerification && (
          <div className="verification-modal-overlay" onClick={() => !verificationLoading && setShowVerification(false)}>
            <div className="verification-modal" onClick={(e) => e.stopPropagation()}>
              {verificationSuccess ? (
                <div className="verification-success">
                  <div className="success-icon">
                    <FiCheckCircle size={48} />
                  </div>
                  <h2 className="success-title">Email Verified!</h2>
                  <p className="success-message">
                    Your email has been verified successfully. Redirecting to login...
                  </p>
                </div>
              ) : (
                <>
                  <button
                    className="verification-close"
                    onClick={() => setShowVerification(false)}
                    disabled={verificationLoading}
                  >
                    <FiX size={24} />
                  </button>
                  <h2>Verify Your Email</h2>
                  <p className="verification-subtitle">Enter the 6-digit verification code sent to <strong>{verificationEmail}</strong></p>

                  <form onSubmit={handleVerifyEmail} className="verification-form">
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
                      style={{ textAlign: "center", fontSize: "24px", letterSpacing: "8px", fontWeight: "bold" }}
                    />
                    {verificationError && <div className="verification-error">{verificationError}</div>}
                    <button type="submit" disabled={verificationLoading} className="verification-btn">
                      {verificationLoading ? "Verifying..." : "Verify"}
                    </button>
                  </form>

                  <div className="verification-footer">
                    <p className="resend-text">Didn't receive a code?</p>
                    <button
                      type="button"
                      className="resend-btn"
                      onClick={handleResendOTP}
                      disabled={verificationLoading}
                    >
                      Resend OTP
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {showPolicy && (
          <PrivacyPolicy isOpen={showPolicy} onClose={() => setShowPolicy(false)} type="user" />
        )}

        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap');

        .avatar-glow-wrapper {
          position: absolute;
          top: -70px;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 140px;
          z-index: 15;
          animation: avatarEnter 0.8s ease-out;
        }

        @keyframes avatarEnter {
          from {
            opacity: 0;
            top: -120px;
            transform: translateX(-50%) scale(0.8);
          }
          to {
            opacity: 1;
            top: -70px;
            transform: translateX(-50%) scale(1);
          }
        }

        .avatar-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(237, 0, 0, 0.8) 0%, rgba(196, 30, 58, 0.4) 40%, transparent 70%);
          filter: blur(20px);
          animation: pulse 3s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 40px rgba(237, 0, 0, 0.6), 0 0 80px rgba(237, 0, 0, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 60px rgba(237, 0, 0, 0.8), 0 0 100px rgba(237, 0, 0, 0.4);
            transform: scale(1.05);
          }
        }

        .user-avatar {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3),
                      0 0 0 1px rgba(255, 255, 255, 0.2);
          z-index: 10;
        }

        .login-card-with-avatar {
          padding-top: 3rem;
        }

        .login-container {
          width: 100%;
          height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #ffffff 100%);
          font-family: Georgia, serif;
          padding: 1.5rem;
          position: relative;
          overflow: visible;
        }

        @media (max-width: 640px) {
          .login-container {
            padding: 1rem;
          }
        }

        @media (max-width: 480px) {
          .login-container {
            padding: 0.75rem;
          }
        }

        .login-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 50%, rgba(237, 0, 0, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 80%, rgba(196, 30, 58, 0.08) 0%, transparent 50%);
          pointer-events: none;
        }

        .logo-section {
          text-align: center;
          margin-bottom: 2rem;
          position: relative;
          z-index: 1;
          animation: slideDown 0.6s ease-out;
        }

        .brand-logo-above {
          width: 100px;
          height: 100px;
          object-fit: contain;
          object-position: center;
          filter: drop-shadow(0 4px 15px rgba(237, 0, 0, 0.2));
        }

        .brand-logo-above-signup {
          width: 90px;
          height: 90px;
          object-fit: contain;
          object-position: center;
          filter: drop-shadow(0 4px 15px rgba(237, 0, 0, 0.2));
          margin-bottom: 0.5rem;
        }

        @keyframes logoFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .login-wrapper {
          display: flex;
          align-items: center;
          gap: 2rem;
          max-width: 1200px;
          width: 100%;
        }

        @media (max-width: 1024px) {
          .login-wrapper {
            gap: 1.5rem;
          }
        }

        @media (max-width: 768px) {
          .login-wrapper {
            flex-direction: column;
            gap: 1rem;
          }
        }

        .avatar-image-section {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 640px) {
          .avatar-image-section {
            display: none;
          }
        }

        .avatar-large-image {
          width: 500px;
          height: 600px;
          object-fit: cover;
          object-position: top;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        @media (max-width: 1024px) {
          .avatar-large-image {
            width: 380px;
            height: 450px;
          }
        }

        @media (max-width: 768px) {
          .avatar-large-image {
            width: 300px;
            height: 380px;
          }
        }

        .login-logo-on-card {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .card-logo {
          width: 70px;
          height: auto;
          object-fit: contain;
        }

        .login-logo-wrapper {
          position: absolute;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          display: flex;
          justify-content: center;
          align-items: center;
          animation: loginLogoFadeIn 0.8s ease-out;
        }

        .login-logo-top {
          width: 90px;
          height: 90px;
          object-fit: contain;
          display: block;
        }

        @keyframes loginLogoFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .login-card {
          background: rgba(30, 40, 60, 0.85);
          border-radius: 20px;
          padding: 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4),
                      0 0 1px rgba(237, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 2;
          animation: fadeInUp 0.8s ease-out 0.2s both;
          transition: all 0.3s ease;
          overflow: visible;
          margin-top: 3rem;
        }

        @media (max-width: 640px) {
          .login-card {
            padding: 2rem;
            max-width: 100%;
            border-radius: 16px;
            margin-top: 2.5rem;
          }
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 1.5rem;
            margin-top: 2rem;
            border-radius: 12px;
          }
        }

        .login-card-with-avatar {
          background: rgba(25, 35, 55, 0.9);
          max-width: 480px;
          padding-top: 3rem;
        }

        @media (max-width: 768px) {
          .login-card-with-avatar {
            max-width: 100%;
            padding-top: 3rem;
            padding-bottom: 10rem;
          }
        }

        @media (max-width: 640px) {
          .login-card-with-avatar {
            padding: 2rem;
            padding-top: 3rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-with-avatar {
            padding: 1.5rem;
            padding-top: 3rem;
          }
        }

        .login-card-signup {
          background: rgba(25, 35, 55, 0.92);
          max-width: 500px;
        }

        @media (max-width: 768px) {
          .login-card-signup {
            max-width: 100%;
            padding-bottom: 10rem;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-card-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-card-header h2 {
          color: #ffffff;
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        @media (max-width: 768px) {
          .login-card-header h2 {
            font-size: 1.5rem;
          }
        }

        @media (max-width: 640px) {
          .login-card-header h2 {
            font-size: 1.375rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-header h2 {
            font-size: 1.25rem;
          }
        }

        .login-card-with-avatar .login-card-header h2 {
          font-size: 2.2rem;
          margin-bottom: 0.75rem;
        }

        @media (max-width: 768px) {
          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.75rem;
          }
        }

        @media (max-width: 640px) {
          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.5rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.375rem;
          }
        }

        .login-card-signup .login-card-header h2 {
          font-size: 1.9rem;
          margin-bottom: 0.5rem;
        }

        @media (max-width: 768px) {
          .login-card-signup .login-card-header h2 {
            font-size: 1.6rem;
          }
        }

        @media (max-width: 640px) {
          .login-card-signup .login-card-header h2 {
            font-size: 1.4rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-signup .login-card-header h2 {
            font-size: 1.25rem;
          }
        }

        .login-subtitle {
          color: #b0b8c8;
          font-size: 1rem;
          margin: 0;
          font-weight: 400;
        }

        @media (max-width: 640px) {
          .login-subtitle {
            font-size: 0.9rem;
          }
        }

        @media (max-width: 480px) {
          .login-subtitle {
            font-size: 0.85rem;
          }
        }

        .login-card-with-avatar .login-subtitle {
          color: #a8b0c0;
          font-size: 1.05rem;
        }

        @media (max-width: 640px) {
          .login-card-with-avatar .login-subtitle {
            font-size: 0.95rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-with-avatar .login-subtitle {
            font-size: 0.85rem;
          }
        }

        .login-card-signup .login-subtitle {
          color: #a8b0c0;
          font-size: 0.95rem;
        }

        @media (max-width: 480px) {
          .login-card-signup .login-subtitle {
            font-size: 0.8rem;
          }
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          position: relative;
          z-index: 1;
        }

        @media (max-width: 640px) {
          .login-form {
            overflow: visible;
          }
        }

        .login-form input {
          padding: 0.875rem 1.2rem;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          font-size: 1rem;
          font-family: Georgia, inherit;
          color: #333333;
          background: rgba(255, 255, 255, 0.95);
          transition: all 0.3s ease;
        }

        @media (max-width: 640px) {
          .login-form input {
            padding: 0.875rem;
            font-size: 1rem;
            border-radius: 8px;
            min-height: 48px;
          }
        }

        @media (max-width: 480px) {
          .login-form input {
            padding: 0.875rem;
            font-size: 1rem;
            border-radius: 8px;
            min-height: 44px;
          }
        }

        .login-card-with-avatar .login-form input {
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92);
        }

        .login-form input:focus {
          outline: none;
          border-color: #ed0000;
          background: rgba(255, 255, 255, 1);
          box-shadow: 0 0 0 3px rgba(237, 0, 0, 0.15);
          transform: translateY(-2px);
        }

        @media (max-width: 480px) {
          .login-form input:focus {
            transform: translateY(0);
          }
        }

        .login-form input::placeholder {
          color: #aaa;
        }

        .login-form select {
          padding: 0.875rem 1.2rem;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          font-size: 1rem;
          font-family: Georgia, inherit;
          color: #333333;
          background: rgba(255, 255, 255, 0.95);
          transition: all 0.3s ease;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          background-size: 20px;
          padding-right: 2.5rem;
          cursor: pointer;
          position: relative;
          z-index: 10;
        }

        @media (max-width: 640px) {
          .login-form select {
            padding: 0.875rem;
            padding-right: 2.5rem;
            font-size: 1rem;
            border-radius: 8px;
            min-height: 48px;
            /* Ensure dropdown appears within viewport on mobile */
            max-height: 200px;
          }
        }

        @media (max-width: 480px) {
          .login-form select {
            min-height: 44px;
            font-size: 0.95rem;
            max-height: 180px;
          }
        }

        .login-card-signup .login-form select {
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92);
        }

        .login-form select:focus {
          outline: none;
          border-color: #ed0000;
          background-color: rgba(255, 255, 255, 1);
          box-shadow: 0 0 0 3px rgba(237, 0, 0, 0.15);
          transform: translateY(-2px);
        }

        @media (max-width: 480px) {
          .login-form select:focus {
            transform: translateY(0);
          }
        }

        .login-form select:hover {
          border-color: #d0d0d0;
          background-color: rgba(255, 255, 255, 0.98);
        }

        .login-form select option {
          color: #333333;
          background: rgba(255, 255, 255, 1);
          padding: 0.5rem 1rem;
        }

        .login-form select option:checked {
          background: linear-gradient(#ed0000, #ed0000);
          background-color: #ed0000;
          color: white;
        }

        .password-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-wrapper input {
          width: 100%;
          padding-right: 2.75rem;
        }

        .password-toggle {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
          color: #666;
        }

        .password-toggle:active {
          opacity: 0.6;
        }

        .login-btn {
          padding: 0.875rem;
          background: linear-gradient(135deg, #ef5350 0%, #d32f2f 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
          font-family: Georgia, inherit;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
          margin-top: 0.75rem;
          letter-spacing: 0.3px;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .login-btn {
            min-height: 48px;
            font-size: 1rem;
          }
        }

        @media (max-width: 480px) {
          .login-btn {
            min-height: 44px;
          }
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        @media (max-width: 480px) {
          .login-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-error {
          background: rgba(255, 71, 87, 0.15);
          color: #ff6b7a;
          padding: 0.875rem;
          border-radius: 8px;
          font-size: 0.95rem;
          text-align: center;
          font-family: Georgia, inherit;
          border-left: 3px solid #ff6b7a;
          animation: shake 0.3s ease-in-out;
        }

        .login-toggle {
          text-align: center;
          margin-top: 1.75rem;
          font-size: 0.95rem;
          color: #a8b0c0;
          font-family: Georgia, inherit;
        }

        .toggle-link {
          background: none;
          border: none;
          color: #ff6b7a;
          cursor: pointer;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          padding: 0;
          font-size: 0.95rem;
        }

        .toggle-link:hover {
          color: #ff8a96;
          text-decoration: underline;
        }

        .login-card-with-avatar .login-toggle {
          color: #a8b0c0;
        }

        .login-card-with-avatar .toggle-link {
          color: #ff7a88;
        }

        .login-card-with-avatar .toggle-link:hover {
          color: #ff9aa5;
        }

        .toggle-separator {
          color: #cccccc;
          margin: 0 0.5rem;
          font-size: 0.9rem;
        }

        .forgot-password-link {
          align-self: flex-end;
          background: none;
          border: none;
          color: #ff7a88;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          padding: 0;
          text-decoration: none;
          transition: all 0.2s;
          margin-top: -0.25rem;
          margin-bottom: 0.5rem;
          font-family: Georgia, inherit;
        }

        .forgot-password-link:hover {
          color: #ff9aa5;
          text-decoration: underline;
        }

        .login-card-with-avatar .forgot-password-link {
          color: #ff8a96;
        }

        .login-card-with-avatar .forgot-password-link:hover {
          color: #ffaab9;
        }

        /* Forgot Password Modal */
        .forgot-password-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease-out;
        }

        .forgot-password-modal {
          background: rgba(30, 40, 60, 0.85);
          border-radius: 20px;
          padding: 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4),
                      0 0 1px rgba(237, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          width: 100%;
          max-width: 400px;
          position: relative;
          animation: slideUp 0.4s ease-out;
          backdrop-filter: blur(10px);
        }

        @media (max-width: 640px) {
          .forgot-password-modal {
            padding: 2rem;
            border-radius: 16px;
            max-width: 100%;
            margin: 0 1rem;
          }
        }

        @media (max-width: 480px) {
          .forgot-password-modal {
            padding: 1.5rem;
            border-radius: 12px;
            margin: 0 1rem;
          }
        }

        .forgot-password-modal h2 {
          color: #ffffff;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        @media (max-width: 640px) {
          .forgot-password-modal h2 {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .forgot-password-modal h2 {
            font-size: 1.1rem;
          }
        }

        .forgot-subtitle {
          color: #b0b8c8;
          font-size: 1rem;
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .forgot-subtitle {
            font-size: 0.9rem;
          }
        }

        @media (max-width: 480px) {
          .forgot-subtitle {
            font-size: 0.85rem;
            margin: 0 0 1rem 0;
          }
        }

        .forgot-form input {
          padding: 0.875rem 1.2rem;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          font-size: 1rem;
          font-family: Georgia, inherit;
          color: #333333;
          background: rgba(255, 255, 255, 0.95);
          transition: all 0.3s ease;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .forgot-form input {
            font-size: 1rem;
            padding: 0.875rem;
            border-radius: 8px;
            min-height: 48px;
          }
        }

        @media (max-width: 480px) {
          .forgot-form input {
            min-height: 44px;
          }
        }

        .forgot-btn {
          padding: 0.875rem;
          background: linear-gradient(135deg, #ef5350 0%, #d32f2f 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
          font-family: Georgia, inherit;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
          letter-spacing: 0.3px;
          margin-top: 0.75rem;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .forgot-btn {
            font-size: 0.95rem;
            min-height: 48px;
          }
        }

        @media (max-width: 480px) {
          .forgot-btn {
            min-height: 44px;
          }
        }

        .forgot-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        @media (max-width: 480px) {
          .forgot-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .forgot-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .forgot-password-success {
          text-align: center;
          padding: 1rem 0;
        }

        .forgot-password-close-btn {
          margin-top: 1.5rem;
          padding: 0.75rem 2rem;
          background: linear-gradient(135deg, #ed0000 0%, #c41e3a 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Noto Sans JP', inherit;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
        }

        .forgot-password-close-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        .success-card {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 3rem 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.3);
          text-align: center;
          width: 100%;
          max-width: 400px;
          animation: slideIn 0.3s ease-out;
          position: relative;
          z-index: 2;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .success-icon {
          font-size: 3rem;
          color: #22c55e;
          margin-bottom: 1rem;
          font-weight: bold;
          animation: scaleIn 0.4s ease-out;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .success-title {
          font-size: 1.5rem;
          color: #1a1a1a;
          font-family: 'Noto Sans JP', inherit;
          margin: 0 0 0.75rem 0;
          font-weight: 700;
        }

        .success-message {
          font-size: 0.95rem;
          color: #666666;
          font-family: 'Noto Sans JP', inherit;
          margin: 0;
          line-height: 1.6;
        }

        /* Mobile Responsive Styling */
        @media (max-width: 768px) {
          .login-container {
            padding: 1rem;
          }

          .login-wrapper {
            flex-direction: column;
            gap: 1.5rem;
          }

          .avatar-large-image {
            width: 300px;
            height: 380px;
          }

          .avatar-glow-wrapper {
            width: 120px;
            height: 120px;
            top: -60px;
          }

          .brand-logo-above {
            width: 80px;
            height: 80px;
          }

          .brand-logo-above-signup {
            width: 75px;
            height: 75px;
          }

          .logo-section {
            margin-bottom: 1.5rem;
          }

          .login-card {
            padding: 2rem 1.5rem;
            max-width: 100%;
            border-radius: 12px;
            margin-top: 2.5rem;
          }

          .login-card-with-avatar {
            max-width: 100%;
            padding-top: 3.5rem;
          }

          .login-card-signup {
            max-width: 100%;
          }

          .login-card-header h2 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
          }

          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.75rem;
          }

          .login-card-signup .login-card-header h2 {
            font-size: 1.6rem;
          }

          .login-subtitle {
            font-size: 0.9rem;
          }

          .login-form {
            gap: 0.875rem;
          }

          .login-form input {
            padding: 0.75rem;
            font-size: 1rem;
            border-radius: 6px;
          }

          .login-form select {
            padding: 0.75rem 1rem;
            font-size: 0.95rem;
            border-radius: 6px;
          }

          .password-wrapper input {
            padding-right: 2.25rem;
          }

          .success-card {
            padding: 2rem 1.5rem;
            max-width: 100%;
          }

          .success-icon {
            font-size: 2.5rem;
            margin-bottom: 0.75rem;
          }

          .success-title {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .login-wrapper {
            flex-direction: column;
            gap: 1rem;
          }

          .avatar-large-image {
            width: 250px;
            height: 320px;
            border-radius: 15px;
          }

          .avatar-glow-wrapper {
            width: 100px;
            height: 100px;
            top: -50px;
          }

          .brand-logo-above {
            width: 70px;
            height: 70px;
          }

          .brand-logo-above-signup {
            width: 65px;
            height: 65px;
          }

          .login-card {
            padding: 1.5rem;
            margin-top: 2rem;
          }

          .login-card-with-avatar {
            padding-top: 3rem;
          }

          .login-card-signup {
            padding: 1.75rem 1.5rem;
          }

          .login-card-header h2 {
            font-size: 1.25rem;
          }

          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.5rem;
          }

          .login-card-signup .login-card-header h2 {
            font-size: 1.35rem;
          }

          .login-form input {
            padding: 0.75rem;
            font-size: 1rem;
          }

          .login-form select {
            padding: 0.75rem;
            font-size: 0.95rem;
          }

          .forgot-password-modal {
            margin: 0 1rem;
            padding: 2rem 1.5rem;
          }

          .forgot-password-modal h2 {
            font-size: 1.25rem;
          }

          .forgot-subtitle {
            font-size: 0.85rem;
          }

          .forgot-form input {
            font-size: 1rem;
            padding: 0.75rem;
          }

          .forgot-btn {
            font-size: 0.95rem;
          }
        }

        /* Confirmation Modal Styles */
        .confirmation-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.3s ease-out;
        }

        .confirmation-modal {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          padding: 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.3);
          width: 90%;
          max-width: 450px;
          position: relative;
          animation: slideUp 0.4s ease-out;
        }

        @media (max-width: 640px) {
          .confirmation-modal {
            padding: 2rem;
            border-radius: 12px;
            max-width: 100%;
            width: 95%;
          }
        }

        @media (max-width: 480px) {
          .confirmation-modal {
            padding: 1.5rem;
            border-radius: 12px;
            width: 95%;
          }
        }

        .confirmation-modal h2 {
          color: #1a1a1a;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
        }

        @media (max-width: 640px) {
          .confirmation-modal h2 {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .confirmation-modal h2 {
            font-size: 1.1rem;
          }
        }

        .confirmation-subtitle {
          color: #666;
          font-size: 0.9rem;
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
          text-align: center;
        }

        @media (max-width: 640px) {
          .confirmation-subtitle {
            font-size: 0.85rem;
            margin: 0 0 1rem 0;
          }
        }

        @media (max-width: 480px) {
          .confirmation-subtitle {
            font-size: 0.8rem;
          }
        }

        .confirmation-details {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          margin: 2rem 0;
          padding: 1.5rem;
          background: rgba(237, 0, 0, 0.05);
          border-radius: 10px;
          border-left: 4px solid #ed0000;
        }

        @media (max-width: 640px) {
          .confirmation-details {
            padding: 1rem;
            margin: 1.5rem 0;
            gap: 1rem;
          }
        }

        @media (max-width: 480px) {
          .confirmation-details {
            padding: 1rem;
            gap: 0.75rem;
          }
        }

        .confirmation-field label {
          color: #666;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @media (max-width: 640px) {
          .confirmation-field label {
            font-size: 0.75rem;
          }
        }

        .confirmation-field p {
          color: #1a1a1a;
          font-size: 1rem;
          margin: 0;
          font-weight: 500;
          word-break: break-all;
        }

        @media (max-width: 640px) {
          .confirmation-field p {
            font-size: 0.9rem;
          }
        }

        .confirmation-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        @media (max-width: 640px) {
          .confirmation-actions {
            gap: 0.75rem;
            margin-top: 1rem;
          }
        }

        .confirmation-edit-btn, .confirmation-proceed-btn {
          flex: 1;
          padding: 0.6rem 0.75rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          font-family: Georgia, inherit;
          transition: all 0.3s ease;
          letter-spacing: 0.3px;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .confirmation-edit-btn, .confirmation-proceed-btn {
            padding: 0.75rem;
            font-size: 0.85rem;
            min-height: 44px;
          }
        }

        @media (max-width: 480px) {
          .confirmation-edit-btn, .confirmation-proceed-btn {
            font-size: 0.8rem;
            min-height: 44px;
          }
        }

        .confirmation-edit-btn {
          background: rgba(237, 0, 0, 0.1);
          color: #ed0000;
          border: 2px solid #ed0000;
        }

        .confirmation-edit-btn:hover:not(:disabled) {
          background: rgba(237, 0, 0, 0.2);
          transform: translateY(-2px);
        }

        @media (max-width: 480px) {
          .confirmation-edit-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .confirmation-proceed-btn {
          background: linear-gradient(135deg, #ed0000 0%, #c41e3a 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
        }

        .confirmation-proceed-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        @media (max-width: 480px) {
          .confirmation-proceed-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .confirmation-edit-btn:disabled,
        .confirmation-proceed-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verification-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .verification-modal {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          padding: 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.3);
          width: 90%;
          max-width: 450px;
          position: relative;
          animation: slideIn 0.3s ease-out;
        }

        @media (max-width: 640px) {
          .verification-modal {
            padding: 2rem;
            border-radius: 12px;
            max-width: 100%;
            width: 95%;
          }
        }

        @media (max-width: 480px) {
          .verification-modal {
            padding: 1.5rem;
            border-radius: 12px;
            width: 95%;
          }
        }

        .verification-modal h2 {
          color: #1a1a1a;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        @media (max-width: 640px) {
          .verification-modal h2 {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .verification-modal h2 {
            font-size: 1.1rem;
          }
        }

        .verification-subtitle {
          color: #666;
          font-size: 0.9rem;
          margin: 0.5rem 0 1.5rem 0;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .verification-subtitle {
            font-size: 0.85rem;
            margin: 0.5rem 0 1rem 0;
          }
        }

        @media (max-width: 480px) {
          .verification-subtitle {
            font-size: 0.8rem;
          }
        }

        .verification-form input {
          padding: 1rem;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1.5rem;
          font-family: 'Courier New', monospace;
          color: #333;
          background: rgba(255, 255, 255, 0.8);
          transition: all 0.3s ease;
          text-align: center;
          letter-spacing: 8px;
          font-weight: bold;
          min-height: 48px;
        }

        @media (max-width: 640px) {
          .verification-form input {
            font-size: 1.25rem;
            padding: 0.875rem;
            border-radius: 6px;
          }
        }

        @media (max-width: 480px) {
          .verification-form input {
            font-size: 1.1rem;
            min-height: 44px;
          }
        }

        .verification-form input:focus {
          outline: none;
          border-color: #ed0000;
          background: rgba(255, 255, 255, 1);
          box-shadow: 0 0 0 3px rgba(237, 0, 0, 0.1);
        }

        .verification-form input::placeholder {
          color: #bbb;
          letter-spacing: normal;
        }

        .verification-btn {
          padding: 0.875rem 1.5rem;
          background: linear-gradient(135deg, #ed0000 0%, #c41e3a 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Noto Sans JP', inherit;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .verification-btn {
            font-size: 0.9rem;
            min-height: 48px;
          }
        }

        @media (max-width: 480px) {
          .verification-btn {
            min-height: 44px;
          }
        }

        .verification-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        @media (max-width: 480px) {
          .verification-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .verification-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verification-footer {
          margin-top: 1.5rem;
          text-align: center;
          border-top: 1px solid #f0f0f0;
          padding-top: 1.5rem;
        }

        @media (max-width: 640px) {
          .verification-footer {
            margin-top: 1rem;
            padding-top: 1rem;
          }
        }

        .resend-text {
          color: #999;
          font-size: 0.85rem;
          margin: 0 0 0.5rem 0;
        }

        @media (max-width: 640px) {
          .resend-text {
            font-size: 0.8rem;
          }
        }

        .resend-btn {
          background: none;
          border: none;
          color: #ed0000;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 0.5rem 1rem;
          text-decoration: underline;
          font-family: 'Noto Sans JP', inherit;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .resend-btn {
            font-size: 0.85rem;
            padding: 0.5rem;
          }
        }

        .resend-btn:hover:not(:disabled) {
          color: #c41e3a;
          text-decoration: none;
        }

        @media (max-width: 480px) {
          .resend-btn:hover:not(:disabled) {
            color: #ed0000;
          }
        }

        .resend-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verification-success {
          text-align: center;
          padding: 1rem 0;
        }

        /* Privacy Policy Link in Login Card */
        .privacy-policy-link-container {
          text-align: center;
          margin-top: 1rem;
        }

        .privacy-policy-login-link {
          background: none;
          border: none;
          color: #ff7a88;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          text-decoration: underline;
          transition: all 0.2s;
          padding: 0;
          font-family: Georgia, inherit;
        }

        .privacy-policy-login-link:hover {
          color: #ff9aa5;
        }

        @media (max-width: 640px) {
          .privacy-policy-login-link {
            font-size: 0.8rem;
          }
        }

        @media (max-width: 480px) {
          .privacy-policy-link-container {
            margin-top: 0.75rem;
          }

          .privacy-policy-login-link {
            font-size: 0.75rem;
          }
        }
      `}</style>
      </div>

      {/* Privacy Policy Footer */}
      <PrivacyPolicyFooter type="user" />
    </>
  );
};
