import React, { useState, useEffect } from "react";
import axios from "axios";
import { FiEye, FiEyeOff, FiCheckCircle, FiAlertCircle, FiLoader } from "react-icons/fi";

interface InviteInfo {
  email: string;
  fullName: string;
  businessUnit: string;
}

export const AcceptInvite: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [verifyState, setVerifyState] = useState<"loading" | "valid" | "invalid">("loading");
  const [verifyError, setVerifyError] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitState, setSubmitState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);

    if (!t) {
      setVerifyState("invalid");
      setVerifyError("No invite token found in the URL.");
      return;
    }

    axios
      .get(`/api/v1/provisioning/invite/verify?token=${encodeURIComponent(t)}`)
      .then((res) => {
        setInviteInfo(res.data);
        setVerifyState("valid");
      })
      .catch((err) => {
        setVerifyState("invalid");
        setVerifyError(
          err.response?.data?.error || "This invite link is invalid or has expired."
        );
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (password.length < 6) {
      setSubmitError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }

    setSubmitState("loading");

    try {
      await axios.post("/api/v1/provisioning/invite/accept", { token, password });
      setSubmitState("success");
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || "Failed to create account. Please try again.");
      setSubmitState("error");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src="/logo.png" alt="Nexa AI" style={styles.logo} />
          <h1 style={styles.title}>Nexa AI Admin Setup</h1>
        </div>

        {verifyState === "loading" && (
          <div style={styles.centerBlock}>
            <FiLoader size={32} style={{ animation: "spin 1s linear infinite", color: "#ed0000" }} />
            <p style={styles.hint}>Verifying your invite link…</p>
          </div>
        )}

        {verifyState === "invalid" && (
          <div style={styles.centerBlock}>
            <FiAlertCircle size={40} color="#ed0000" />
            <h2 style={styles.stateTitle}>Link Invalid or Expired</h2>
            <p style={styles.hint}>{verifyError}</p>
            <p style={styles.hint}>
              Please contact your administrator to send a new invite.
            </p>
          </div>
        )}

        {verifyState === "valid" && submitState === "success" && (
          <div style={styles.centerBlock}>
            <FiCheckCircle size={48} color="#22c55e" />
            <h2 style={styles.stateTitle}>Account Created!</h2>
            <p style={styles.hint}>
              Your admin account for <strong>{inviteInfo?.businessUnit}</strong> is ready.
            </p>
            <p style={styles.hint}>
              You can now log in at{" "}
              <strong>
                {window.location.hostname.replace(/^www\./, "")}
              </strong>
              /admin using your email and password.
            </p>
            <a href="/admin" style={styles.loginBtn}>
              Go to Admin Login
            </a>
          </div>
        )}

        {verifyState === "valid" && submitState !== "success" && inviteInfo && (
          <>
            <div style={styles.infoBox}>
              <p style={styles.infoRow}>
                <span style={styles.infoLabel}>Name</span>
                <span style={styles.infoValue}>{inviteInfo.fullName}</span>
              </p>
              <p style={styles.infoRow}>
                <span style={styles.infoLabel}>Email</span>
                <span style={styles.infoValue}>{inviteInfo.email}</span>
              </p>
              <p style={styles.infoRow}>
                <span style={styles.infoLabel}>Business Unit</span>
                <span style={styles.infoValue}>{inviteInfo.businessUnit}</span>
              </p>
            </div>

            <p style={styles.subtitle}>Set a password to activate your admin account.</p>

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Password</label>
                <div style={styles.passwordRow}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={styles.input}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeBtn}
                    tabIndex={-1}
                  >
                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Confirm Password</label>
                <div style={styles.passwordRow}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    style={styles.input}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeBtn}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                  </button>
                </div>
              </div>

              {(submitState === "error" || submitError) && (
                <div style={styles.errorBox}>{submitError}</div>
              )}

              <button
                type="submit"
                disabled={submitState === "loading"}
                style={{
                  ...styles.submitBtn,
                  opacity: submitState === "loading" ? 0.7 : 1,
                }}
              >
                {submitState === "loading" ? "Creating Account…" : "Activate Account"}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    padding: "24px 16px",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    background: "#ffffff",
    borderRadius: "16px",
    padding: "40px 36px",
    maxWidth: "480px",
    width: "100%",
    boxShadow: "0 25px 50px rgba(0,0,0,0.4)",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginBottom: "28px",
    gap: "12px",
  },
  logo: {
    height: "48px",
    objectFit: "contain",
  },
  title: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 700,
    color: "#1a1a2e",
    textAlign: "center",
  },
  subtitle: {
    margin: "0 0 20px",
    fontSize: "14px",
    color: "#666",
    textAlign: "center",
  },
  infoBox: {
    background: "#f9f9f9",
    border: "1px solid #e8e8e8",
    borderRadius: "8px",
    padding: "16px 20px",
    marginBottom: "20px",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    margin: "4px 0",
    fontSize: "14px",
  },
  infoLabel: {
    color: "#888",
    fontWeight: 500,
  },
  infoValue: {
    color: "#1a1a2e",
    fontWeight: 600,
    textAlign: "right",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#444",
  },
  passwordRow: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  input: {
    width: "100%",
    padding: "10px 40px 10px 12px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s",
  },
  eyeBtn: {
    position: "absolute",
    right: "10px",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "#888",
    display: "flex",
    alignItems: "center",
    padding: 0,
  },
  errorBox: {
    background: "#fff0f0",
    border: "1px solid #ffcdd2",
    borderRadius: "8px",
    padding: "10px 14px",
    color: "#c62828",
    fontSize: "13px",
  },
  submitBtn: {
    background: "#ed0000",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "13px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity 0.2s",
    marginTop: "4px",
  },
  centerBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    padding: "20px 0",
    textAlign: "center",
  },
  stateTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: 700,
    color: "#1a1a2e",
  },
  hint: {
    margin: 0,
    fontSize: "14px",
    color: "#666",
    lineHeight: 1.6,
  },
  loginBtn: {
    marginTop: "8px",
    display: "inline-block",
    background: "#ed0000",
    color: "#fff",
    padding: "12px 28px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: "15px",
  },
};
