import React, { useState } from "react";
import axios from "axios";
import { FiEye, FiEyeOff } from "react-icons/fi";
import styles from "./styles/admin-login.module.css";
import LoginLoadingScreen from "./components/LoginLoadingScreen";
import { PrivacyPolicyFooter } from "./components/PrivacyPolicy";

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    localStorage.setItem("authInProgress", "true");

    try {
      const { data } = await axios.post("/api/v1/admin/auth/login", { email, password });
      localStorage.removeItem("authInProgress");
      onLoginSuccess(data.token, data.admin);
    } catch (err: any) {
      setError(err.response?.data?.error || "Authentication failed. Please try again.");
      localStorage.removeItem("authInProgress");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const response = await axios.post("/api/v1/admin/auth/forgot-password", {
        email: forgotPasswordEmail
      });
      setSuccessMessage(
        response.data.message ||
          "If an account exists with this email, a reset link will be sent shortly"
      );
      setForgotPasswordEmail("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to process forgot password request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordClick = () => {
    setIsForgotPassword(true);
    setError(null);
    setSuccessMessage(null);
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setForgotPasswordEmail("");
    setError(null);
    setSuccessMessage(null);
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
            <div className={styles.logoWrapper}>
              <img src="/1879-22.png" alt="1879 Tech Hub" className={styles.logoTop} />
            </div>
            <div className={styles.card}>
              <p className={styles.subheading}>
                {isForgotPassword
                  ? "Enter your email address and we'll send you a link to reset your password"
                  : "Sign in to manage Nexa AI documents and knowledge base"}
              </p>

              <form
                onSubmit={isForgotPassword ? handleForgotPasswordSubmit : handleLoginSubmit}
                className={styles.form}
              >
                {error && <div className={styles.errorMessage}>{error}</div>}
                {successMessage && <div className={styles.successMessage}>{successMessage}</div>}

                {isForgotPassword ? (
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Email Address</label>
                    <input
                      type="email"
                      className={styles.input}
                      placeholder="admin@company.com"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Email Address</label>
                      <input
                        type="email"
                        className={styles.input}
                        placeholder="admin@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Password</label>
                      <div className={styles.passwordWrapper}>
                        <input
                          type={showPassword ? "text" : "password"}
                          className={styles.input}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
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

                <button type="submit" className={styles.button} disabled={loading}>
                  {loading
                    ? isForgotPassword
                      ? "Sending..."
                      : "Signing In..."
                    : isForgotPassword
                      ? "Send Reset Link"
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
                  <button
                    type="button"
                    className={styles.forgotPasswordLink}
                    onClick={handleForgotPasswordClick}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
            </div>
            <PrivacyPolicyFooter type="admin" />
          </div>
        </div>
      </div>
    </>
  );
};
