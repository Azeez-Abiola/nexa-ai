import React, { useState, useMemo } from "react";
import axios from "axios";
import { FiLock, FiMail, FiEye, FiEyeOff, FiCheckCircle, FiAlertTriangle, FiArrowRight } from "react-icons/fi";

const BRAND = "#ed0000";

// Password policy (frontend UX check; the backend remains authoritative and also rejects
// common/breached passwords). Mirrors the backend rule: 10+ chars and at least 3 of the 4
// character classes (lowercase, uppercase, number, symbol).
const MIN_LEN = 10;
function passwordIssues(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < MIN_LEN) issues.push(`At least ${MIN_LEN} characters`);
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) issues.push("Mix of at least 3 of: lowercase, uppercase, number, symbol");
  return issues;
}

const ResetPassword: React.FC = () => {
  const token = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search).get("token") || "";
    } catch {
      return "";
    }
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const issues = passwordIssues(password);
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = !!token && !!email.trim() && issues.length === 0 && passwordsMatch && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("This reset link is missing its token. Please use the link from your email, or request a new one.");
      return;
    }
    if (issues.length > 0) {
      setError("Please choose a stronger password.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await axios.post("/api/v1/auth/reset-password", {
        token,
        email: email.trim().toLowerCase(),
        newPassword: password,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not reset your password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  const goToLogin = () => {
    window.history.pushState(null, "", "/login");
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f7f7f8",
        padding: 20,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
          padding: "36px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <span style={{ fontWeight: 800, fontSize: 22, color: BRAND, letterSpacing: "-0.02em" }}>Nexa</span>
          <span style={{ fontSize: 13, color: "#71717a" }}>· Reset password</span>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "12px 0" }}>
            <FiCheckCircle size={48} color={BRAND} style={{ marginBottom: 16 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#18181b", margin: "0 0 8px" }}>Password reset</h1>
            <p style={{ fontSize: 14, color: "#52525b", margin: "0 0 24px", lineHeight: 1.5 }}>
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button
              onClick={goToLogin}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: BRAND,
                color: "#fff",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              Go to sign in <FiArrowRight />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#18181b", margin: "0 0 6px" }}>Choose a new password</h1>
            <p style={{ fontSize: 14, color: "#71717a", margin: "0 0 22px", lineHeight: 1.5 }}>
              Confirm your email and set a new password for your Nexa account.
            </p>

            {!token && (
              <div style={infoBox("#fef2f2", "#fecaca", "#991b1b")}>
                <FiAlertTriangle style={{ flexShrink: 0, marginTop: 2 }} />
                <span>This link is missing its reset token. Please open the link directly from your reset email.</span>
              </div>
            )}

            <label style={labelStyle}>Email</label>
            <div style={inputWrap}>
              <FiMail color="#a1a1aa" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
                style={inputStyle}
              />
            </div>

            <label style={labelStyle}>New password</label>
            <div style={inputWrap}>
              <FiLock color="#a1a1aa" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a new password"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#a1a1aa", padding: 0, display: "flex" }}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>

            {password.length > 0 && issues.length > 0 && (
              <ul style={{ margin: "0 0 14px", padding: "0 0 0 2px", listStyle: "none" }}>
                {issues.map((req) => (
                  <li key={req} style={{ fontSize: 12, color: "#a1a1aa", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#d4d4d8", display: "inline-block" }} />
                    {req}
                  </li>
                ))}
              </ul>
            )}

            <label style={labelStyle}>Confirm new password</label>
            <div style={{ ...inputWrap, marginBottom: confirm.length > 0 && !passwordsMatch ? 6 : 18 }}>
              <FiLock color="#a1a1aa" />
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter the new password"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </div>
            {confirm.length > 0 && !passwordsMatch && (
              <p style={{ fontSize: 12, color: "#dc2626", margin: "0 0 16px" }}>Passwords do not match.</p>
            )}

            {error && (
              <div style={infoBox("#fef2f2", "#fecaca", "#991b1b")}>
                <FiAlertTriangle style={{ flexShrink: 0, marginTop: 2 }} />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                border: "none",
                background: canSubmit ? BRAND : "#e4e4e7",
                color: canSubmit ? "#fff" : "#a1a1aa",
                fontWeight: 700,
                fontSize: 15,
                cursor: canSubmit ? "pointer" : "not-allowed",
                transition: "background 0.15s",
              }}
            >
              {loading ? "Resetting…" : "Reset password"}
            </button>

            <button
              type="button"
              onClick={goToLogin}
              style={{ width: "100%", marginTop: 14, background: "none", border: "none", color: "#71717a", fontSize: 13, cursor: "pointer" }}
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#3f3f46",
  margin: "0 0 6px",
};

const inputWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid #e4e4e7",
  borderRadius: 10,
  padding: "11px 13px",
  marginBottom: 18,
  background: "#fafafa",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: "none",
  outline: "none",
  background: "transparent",
  fontSize: 15,
  color: "#18181b",
};

function infoBox(bg: string, border: string, color: string): React.CSSProperties {
  return {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    background: bg,
    border: `1px solid ${border}`,
    color,
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 13,
    lineHeight: 1.45,
    margin: "0 0 16px",
  };
}

export default ResetPassword;
