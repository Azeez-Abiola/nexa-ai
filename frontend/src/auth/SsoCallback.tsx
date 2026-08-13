import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

/**
 * Landing point for the Microsoft SSO round-trip.
 *
 * The backend finishes the OAuth exchange server-side and redirects here with the app's
 * own JWT on the query string. All this screen does is turn that token into the
 * (token, user) pair the rest of the app already expects from a password login, so SSO
 * and password sessions are indistinguishable from here on.
 */

type SsoCallbackProps = {
  /** "employee" and "admin" resolve the account differently; the backend picks which URL to send. */
  role: "employee" | "admin";
  onLoginSuccess: (token: string, user: any) => void;
};

/** Human wording for the reasons the backend can redirect with. */
const ERROR_MESSAGES: Record<string, string> = {
  no_account:
    "That Microsoft account isn't registered with Nexa. Ask your administrator for access, then try again.",
  account_inactive: "This account has been deactivated. Please contact your administrator.",
  invalid_state: "Sign-in couldn't be completed. Please try again.",
};

/**
 * Read the claims out of our own JWT.
 *
 * Safe to do in the browser: nothing here is trusted for access control. The token is
 * still verified server-side on every request, and this only avoids a round-trip to
 * learn who the token belongs to.
 */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

export default function SsoCallback({ role, onLoginSuccess }: SsoCallbackProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // React 18 mounts effects twice in development; without this the token is consumed twice.
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = new URLSearchParams(location.search);
    const token = params.get("accessToken");

    if (!token) {
      setError(ERROR_MESSAGES.invalid_state);
      return;
    }

    // Strip the token from the address bar immediately. Query strings end up in browser
    // history, and this one is a live 7-day session.
    window.history.replaceState(null, "", window.location.pathname);

    const finish = async () => {
      try {
        if (role === "admin") {
          // /auth/me refuses admin tokens by design, so the claims are the only source here.
          const claims = decodeJwtPayload(token);
          if (!claims) throw new Error("bad_token");
          onLoginSuccess(token, {
            id: claims.adminId,
            email: claims.email,
            fullName: claims.fullName,
            businessUnit: claims.businessUnit,
            tenantId: claims.tenantId,
            tenantSlug: claims.tenantSlug,
            tenantName: claims.tenantName,
            isAdmin: true,
          });
          return;
        }

        // Employees get the full profile, so the avatar, department and tenant branding
        // are present on first paint rather than filling in later.
        const { data } = await axios.get<{ user: any }>("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        onLoginSuccess(token, data.user);
      } catch {
        setError("Signed in with Microsoft, but your Nexa profile couldn't be loaded. Please try again.");
      }
    };

    void finish();
  }, [location.search, onLoginSuccess, role]);

  return (
    <div style={wrapStyle}>
      {error ? (
        <>
          <p style={errorStyle}>{error}</p>
          <button type="button" style={buttonStyle} onClick={() => navigate(role === "admin" ? "/admin/login" : "/login")}>
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <div style={spinnerStyle} />
          <p style={textStyle}>Signing you in…</p>
        </>
      )}
      <style>{`@keyframes ssoSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * The error destination the backend redirects to when it never gets far enough to issue
 * a token, so there is no session to land in.
 */
export function SsoError() {
  const navigate = useNavigate();
  const reason = new URLSearchParams(useLocation().search).get("reason") || "invalid_state";

  return (
    <div style={wrapStyle}>
      <p style={errorStyle}>{ERROR_MESSAGES[reason] || ERROR_MESSAGES.invalid_state}</p>
      <button type="button" style={buttonStyle} onClick={() => navigate("/login")}>
        Back to sign in
      </button>
    </div>
  );
}

const wrapStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1rem",
  padding: "1.5rem",
  textAlign: "center",
  fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  background: "#ffffff",
};

const spinnerStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "3px solid rgba(237, 0, 0, 0.18)",
  borderTopColor: "#ed0000",
  animation: "ssoSpin 0.8s linear infinite",
};

const textStyle: React.CSSProperties = { color: "#6b7280", fontSize: "0.95rem", margin: 0 };

const errorStyle: React.CSSProperties = {
  color: "#b91c1c",
  fontSize: "0.98rem",
  margin: 0,
  maxWidth: "34rem",
  lineHeight: 1.6,
};

const buttonStyle: React.CSSProperties = {
  padding: "0.7rem 1.4rem",
  borderRadius: 10,
  border: "none",
  background: "#ed0000",
  color: "#fff",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
};
