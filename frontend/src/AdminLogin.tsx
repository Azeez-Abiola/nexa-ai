import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiEye, FiEyeOff, FiCheckCircle } from "react-icons/fi";
import styles from "./styles/admin-login.module.css";
import LoginLoadingScreen from "./components/LoginLoadingScreen";
import { PrivacyPolicyFooter } from "./components/PrivacyPolicy";

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

type BusinessUnit = "GCL" | "LSF" | "CAP" | "UFL" | "CHI" | "UAC-Restaurants" | "UPDC" | "UACN";

interface AuthForm {
  email: string;
  password: string;
  fullName?: string;
  businessUnit?: BusinessUnit;
}

const emptyAuthForm: AuthForm = {
  email: "",
  password: "",
  fullName: "",
  businessUnit: undefined
};

const DEFAULT_BUSINESS_UNITS: { label: string; value: BusinessUnit }[] = [
  { label: "Grand Cereals Limited (GCL)", value: "GCL" },
  { label: "Livestocks Feeds PLC (LSF)", value: "LSF" },
  { label: "Chemical and Allied Products PLC (CAP)", value: "CAP" },
  { label: "UAC Foods Limited (UFL)", value: "UFL" },
  { label: "Chivita|Hollandia Limited (CHI)", value: "CHI" },
  { label: "UAC Restaurants", value: "UAC-Restaurants" },
  { label: "UPDC", value: "UPDC" },
  { label: "UACN Group (UACN)", value: "UACN" }
];

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [authForm, setAuthForm] = useState<AuthForm>(emptyAuthForm);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [businessUnits, setBusinessUnits] = useState<{ label: string; value: BusinessUnit }[]>(DEFAULT_BUSINESS_UNITS);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationOTP, setVerificationOTP] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationLoading, setConfirmationLoading] = useState(false);

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

  const handleAuthChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAuthForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // If registering, show confirmation screen instead of submitting
    if (isRegistering) {
      setShowConfirmation(true);
      return;
    }

    setLoading(true);
    localStorage.setItem("authInProgress", "true");

    try {
      const endpoint = "/api/v1/admin/auth/login";
      const payload = { email: authForm.email, password: authForm.password };

      const { data } = await axios.post(endpoint, payload);

      localStorage.removeItem("authInProgress");
      onLoginSuccess(data.token, data.admin);
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Authentication failed. Please try again."
      );
      localStorage.removeItem("authInProgress");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSignUp = async () => {
    setConfirmationLoading(true);
    setError(null);
    localStorage.setItem("authInProgress", "true");

    try {
      const endpoint = "/api/v1/admin/auth/register";
      const payload = authForm;

      await axios.post(endpoint, payload);

      // Show OTP verification modal
      setShowConfirmation(false);
      setVerificationEmail(authForm.email || "");
      setShowVerification(true);
      setAuthForm(emptyAuthForm);
    } catch (err: any) {
      setError(err.response?.data?.error || "Registration failed. Please try again.");
      localStorage.removeItem("authInProgress");
    } finally {
      setConfirmationLoading(false);
    }
  };

  const handleEditSignUp = () => {
    setShowConfirmation(false);
    setError(null);
  };

  const toggleMode = () => {
    setIsRegistering(!isRegistering);
    setIsForgotPassword(false);
    setAuthForm(emptyAuthForm);
    setForgotPasswordEmail("");
    setError(null);
    setSuccessMessage(null);
  };

  const handleForgotPasswordClick = () => {
    setIsForgotPassword(true);
    setIsRegistering(false);
    setAuthForm(emptyAuthForm);
    setError(null);
    setSuccessMessage(null);
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setForgotPasswordEmail("");
    setError(null);
    setSuccessMessage(null);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await axios.post("/api/v1/admin/auth/forgot-password", {
        email: forgotPasswordEmail
      });

      setSuccessMessage(response.data.message || "If an account exists with this email, a reset link will be sent shortly");
      setForgotPasswordEmail("");
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Failed to process forgot password request. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError("");
    setVerificationLoading(true);

    try {
      await axios.post("/api/v1/admin/auth/verify-email", {
        email: verificationEmail,
        otp: verificationOTP
      });
      setVerificationSuccess(true);
      setVerificationOTP("");

      setTimeout(() => {
        setShowVerification(false);
        setVerificationSuccess(false);
        setIsRegistering(false);
        setAuthForm(emptyAuthForm);
        setError(null);
        setSuccessMessage(null);
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
      await axios.post("/api/v1/admin/auth/resend-verification", {
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
    <>
      {loading && <LoginLoadingScreen userType="admin" />}
      <div className={styles.loginContainer}>
        <div className={styles.mainWrapper}>
          <div className={styles.avatarSection}>
            <video
              src="/UAC AI AVATAR.mp4"
              className={styles.avatarLargeImage}
              autoPlay
              loop
              muted
              playsInline
            />
          </div>
          <div className={styles.formWrapper}>
            {!isRegistering && (
              <div className={styles.logoWrapper}>
                <img src="/logo.png" alt="Nexa AI Logo" className={styles.logoTop} />
              </div>
            )}
            <div className={styles.card}>
              <p className={styles.subheading}>
                {isForgotPassword
                  ? "Enter your email address and we'll send you a link to reset your password"
                  : isRegistering
                    ? ""
                    : "Sign in to manage Nexa AI documents and knowledge base"}
              </p>

              <form
                onSubmit={isForgotPassword ? handleForgotPasswordSubmit : handleAuthSubmit}
                className={styles.form}
              >
                {error && <div className={styles.errorMessage}>{error}</div>}
                {successMessage && (
                  <div className={styles.successMessage}>{successMessage}</div>
                )}

                {isForgotPassword ? (
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Email Address</label>
                    <input
                      type="email"
                      className={styles.input}
                      placeholder="admin@uacn.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <>
                    {isRegistering && (
                      <>
                        <div className={styles.inputGroup}>
                          <label className={styles.label}>Full Name</label>
                          <input
                            type="text"
                            name="fullName"
                            className={styles.input}
                            placeholder="John Doe"
                            value={authForm.fullName || ""}
                            onChange={handleAuthChange}
                            required={isRegistering}
                          />
                        </div>

                        <div className={styles.inputGroup}>
                          <label className={styles.label}>Business Unit</label>
                          <select
                            name="businessUnit"
                            className={styles.input}
                            value={authForm.businessUnit || ""}
                            onChange={handleAuthChange}
                            required={isRegistering}
                          >
                            <option value="">Select a Business Unit</option>
                            {businessUnits.map((bu) => (
                              <option key={bu.value} value={bu.value}>
                                {bu.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Email Address</label>
                      <input
                        type="email"
                        name="email"
                        className={styles.input}
                        placeholder="admin@uacn.com"
                        value={authForm.email}
                        onChange={handleAuthChange}
                        autoComplete="email"
                        required
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Password</label>
                      <div className={styles.passwordWrapper}>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          className={styles.input}
                          placeholder="••••••••"
                          value={authForm.password}
                          onChange={handleAuthChange}
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          className={styles.togglePasswordBtn}
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  className={styles.button}
                  disabled={loading}
                >
                  {loading
                    ? isForgotPassword
                      ? "Sending..."
                      : isRegistering
                        ? "Creating Account..."
                        : "Signing In..."
                    : isForgotPassword
                      ? "Send Reset Link"
                      : isRegistering
                        ? "Create Admin Account"
                        : "Sign In"}
                </button>
              </form>

              <div className={styles.toggleWrapper}>
                {isForgotPassword ? (
                  <span className={styles.toggleText}>
                    Remember your password?
                    <button
                      type="button"
                      className={styles.toggleButton}
                      onClick={handleBackToLogin}
                    >
                      Back to Sign In
                    </button>
                  </span>
                ) : (
                  <>
                    <span className={styles.toggleText}>
                      {isRegistering
                        ? "Already have an account?"
                        : "Don't have an account?"}
                      <button
                        type="button"
                        className={styles.toggleButton}
                        onClick={toggleMode}
                      >
                        {isRegistering ? "Sign In" : "Register"}
                      </button>
                    </span>

                    {!isRegistering && (
                      <button
                        type="button"
                        className={styles.forgotPasswordLink}
                        onClick={handleForgotPasswordClick}
                      >
                        Forgot Password?
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {showConfirmation && (
          <div className={styles.confirmationModalOverlay} onClick={() => !confirmationLoading && setShowConfirmation(false)}>
            <div className={styles.confirmationModal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.confirmationTitle}>Confirm Your Information</h2>
              <p className={styles.confirmationSubtitle}>Please verify that your information is correct before proceeding</p>

              <div className={styles.confirmationDetails}>
                <div className={styles.confirmationField}>
                  <label className={styles.confirmationLabel}>Full Name</label>
                  <p className={styles.confirmationValue}>{authForm.fullName}</p>
                </div>
                <div className={styles.confirmationField}>
                  <label className={styles.confirmationLabel}>Business Unit</label>
                  <p className={styles.confirmationValue}>
                    {businessUnits.find(bu => bu.value === authForm.businessUnit)?.label || authForm.businessUnit}
                  </p>
                </div>
                <div className={styles.confirmationField}>
                  <label className={styles.confirmationLabel}>Email</label>
                  <p className={styles.confirmationValue}>{authForm.email}</p>
                </div>
              </div>

              {error && <div className={styles.confirmationError}>{error}</div>}

              <div className={styles.confirmationActions}>
                <button
                  type="button"
                  className={styles.confirmationEditBtn}
                  onClick={handleEditSignUp}
                  disabled={confirmationLoading}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={styles.confirmationProceedBtn}
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
          <div className={styles.verificationModalOverlay} onClick={() => !verificationLoading && setShowVerification(false)}>
            <div className={styles.verificationModal} onClick={(e) => e.stopPropagation()}>
              {verificationSuccess ? (
                <div className={styles.verificationSuccess}>
                  <div className={styles.successIcon}>
                    <FiCheckCircle size={48} />
                  </div>
                  <h2 className={styles.successTitle}>Email Verified!</h2>
                  <p className={styles.successMessage}>
                    Your email has been verified successfully. Redirecting...
                  </p>
                </div>
              ) : (
                <>
                  <button
                    className={styles.verificationClose}
                    onClick={() => setShowVerification(false)}
                    disabled={verificationLoading}
                  >
                    ✕
                  </button>
                  <h2 className={styles.verificationTitle}>Verify Your Email</h2>
                  <p className={styles.verificationSubtitle}>
                    Enter the 6-digit verification code sent to <strong>{verificationEmail}</strong>
                  </p>

                  <form onSubmit={handleVerifyEmail} className={styles.verificationForm}>
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
                      className={styles.otpInput}
                    />
                    {verificationError && <div className={styles.verificationErrorMsg}>{verificationError}</div>}
                    <button type="submit" disabled={verificationLoading} className={styles.verificationBtn}>
                      {verificationLoading ? "Verifying..." : "Verify"}
                    </button>
                  </form>

                  <div className={styles.verificationFooter}>
                    <p className={styles.resendText}>Didn't receive a code?</p>
                    <button
                      type="button"
                      className={styles.resendBtn}
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
      </div>
      <PrivacyPolicyFooter type="admin" />
    </>
  );
};
