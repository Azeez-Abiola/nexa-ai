import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import {
  BiArrowBack,
  BiCheckCircle,
  BiErrorCircle,
  BiLinkExternal,
  BiLoaderAlt,
  BiPlug,
  BiShieldQuarter,
} from "react-icons/bi";
import styles from "./connectorSettings.module.css";

/**
 * Settings → Connectors.
 *
 * Lets a user connect their own Microsoft account so Nexa can reach their OneDrive and
 * SharePoint as them. Until this existed nothing called the consent endpoint, so the
 * whole delegated-identity path was unreachable from the product.
 */

type Connector = {
  connectorId: string;
  label: string;
  description: string;
  requiresIdentity: "microsoft" | null;
  dataLeavesNetwork: boolean;
  connected: boolean;
  account: { email?: string; name?: string } | null;
  needsReconnect: boolean;
  reconnectReason: string | null;
};

type ConnectorsPayload = {
  connectors: Connector[];
  microsoft: { available: boolean; configurationGap: string | null };
};

type Banner = { tone: "success" | "error" | "info"; message: string };

type ConnectorSettingsProps = {
  token: string | null;
  theme: string;
  isAdmin?: boolean;
  onBack: () => void;
};

/** Outcomes the OAuth callback can hand back, in words a user can act on. */
const CALLBACK_MESSAGES: Record<string, (account?: string | null) => Banner> = {
  connected: (account) => ({
    tone: "success",
    message: account ? `Microsoft 365 connected as ${account}.` : "Microsoft 365 connected.",
  }),
  declined: () => ({
    tone: "info",
    message: "You cancelled the Microsoft sign-in. Nothing was connected.",
  }),
  expired: () => ({
    tone: "error",
    message: "That sign-in link expired. Please try again.",
  }),
  invalid: () => ({
    tone: "error",
    message: "Something went wrong with the sign-in. Please try again.",
  }),
  failed: () => ({
    tone: "error",
    message:
      "Microsoft sign-in could not be completed. Please try again, or contact IT if it keeps happening.",
  }),
};

export default function ConnectorSettings({ token, theme, isAdmin, onBack }: ConnectorSettingsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<ConnectorsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner | null>(null);
  /** Which connector has a request in flight, so only its own button shows a spinner. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<Connector | null>(null);
  /** Kept until dismissed: it tells the user access still exists on Microsoft's side. */
  const [disconnectNote, setDisconnectNote] = useState<string | null>(null);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    try {
      const res = await axios.get<ConnectorsPayload>("/api/v1/connectors", { headers: authHeaders() });
      setData(res.data);
    } catch {
      setBanner({ tone: "error", message: "Couldn't load your connectors. Please refresh and try again." });
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  // The consent round trip returns here with its outcome on the query string. Read it
  // once, then strip it: left in place, a refresh would re-announce a stale result.
  useEffect(() => {
    if (searchParams.get("connector") !== "microsoft") return;
    const status = searchParams.get("status") || "failed";
    const build = CALLBACK_MESSAGES[status] || CALLBACK_MESSAGES.failed;
    setBanner(build(searchParams.get("account")));
    if (status === "connected") void load();
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, load]);

  const handleConnect = async (connector: Connector) => {
    setBusyId(connector.connectorId);
    setBanner(null);
    try {
      const { data: res } = await axios.get<{ url: string }>("/api/v1/connectors/microsoft/connect", {
        headers: authHeaders(),
      });
      // A full-page redirect rather than a popup: the consent screen uses
      // prompt=select_account, and popups get blocked or lose their opener on mobile.
      window.location.href = res.url;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const detail = axios.isAxiosError(err)
        ? (err.response?.data as { detail?: string } | undefined)?.detail
        : undefined;
      setBusyId(null);
      setBanner({
        tone: "error",
        message:
          status === 503
            ? // Server-side configuration, not anything the user did. `detail` only comes
              // back for admins, so it is shown only when actually present.
              `Microsoft sign-in isn't set up on this server yet.${detail ? ` ${detail}` : ""}`
            : "Couldn't start the Microsoft sign-in. Please try again.",
      });
    }
  };

  const handleDisconnect = async (connector: Connector) => {
    setBusyId(connector.connectorId);
    setConfirmDisconnect(null);
    try {
      const { data: res } = await axios.delete<{ note?: string }>("/api/v1/connectors/microsoft", {
        headers: authHeaders(),
      });
      setBanner({ tone: "success", message: `${connector.label} disconnected.` });
      // Verbatim, and kept on screen. Users assume Disconnect revoked everything; the
      // grant actually survives in their Microsoft account until they remove it there.
      if (res?.note) setDisconnectNote(res.note);
      await load();
    } catch {
      setBanner({ tone: "error", message: `Couldn't disconnect ${connector.label}. Please try again.` });
    } finally {
      setBusyId(null);
    }
  };

  const renderCard = (connector: Connector) => {
    const busy = busyId === connector.connectorId;
    // Nothing for the user to do: this one rides Nexa's own permissions.
    const selfServing = connector.requiresIdentity === null;

    let statusLine: React.ReactNode;
    let action: React.ReactNode = null;

    if (selfServing) {
      statusLine = (
        <span className={styles.statusOk}>
          <BiCheckCircle size={15} /> Active · Runs inside Nexa
        </span>
      );
    } else if (connector.connected && !connector.needsReconnect) {
      statusLine = (
        <span className={styles.statusOk}>
          <BiCheckCircle size={15} />
          Connected{connector.account?.email ? ` as ${connector.account.email}` : ""}
        </span>
      );
      action = (
        <button
          type="button"
          className={styles.secondaryBtn}
          disabled={busy}
          onClick={() => setConfirmDisconnect(connector)}
        >
          {busy ? <BiLoaderAlt className={styles.spin} size={16} /> : null}
          Disconnect
        </button>
      );
    } else if (connector.needsReconnect) {
      statusLine = (
        <span className={styles.statusWarn}>
          <BiErrorCircle size={15} />
          Reconnect needed{connector.reconnectReason ? ` — ${connector.reconnectReason}` : ""}
        </span>
      );
      action = (
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy}
          onClick={() => void handleConnect(connector)}
        >
          {busy ? <BiLoaderAlt className={styles.spin} size={16} /> : <BiPlug size={16} />}
          Reconnect
        </button>
      );
    } else {
      statusLine = <span className={styles.statusMuted}>Not connected</span>;
      action = (
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={busy}
          onClick={() => void handleConnect(connector)}
        >
          {busy ? <BiLoaderAlt className={styles.spin} size={16} /> : <BiPlug size={16} />}
          Connect
        </button>
      );
    }

    return (
      <div key={connector.connectorId} className={styles.card}>
        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>{connector.label}</h3>
          <p className={styles.cardDescription}>{connector.description}</p>
          <div className={styles.cardMeta}>
            {statusLine}
            {/* Stated on the card, never in a tooltip. Where a connector sends data is
                the residency answer the organisation has to be able to give. */}
            <span className={connector.dataLeavesNetwork ? styles.egressOut : styles.egressIn}>
              <BiShieldQuarter size={15} />
              {connector.dataLeavesNetwork ? "Sends file contents to Microsoft" : "Data stays inside Nexa"}
            </span>
          </div>
        </div>
        {action ? <div className={styles.cardAction}>{action}</div> : null}
      </div>
    );
  };

  return (
    <div className={`${styles.page} ${theme === "dark" ? styles.dark : ""}`} data-allow-scroll>
      <button type="button" className={styles.backBtn} onClick={onBack}>
        <BiArrowBack size={18} />
        Back to chat
      </button>

      <header className={styles.header}>
        <h1 className={styles.title}>Connectors</h1>
        <p className={styles.subtitle}>
          Connect your own accounts so Nexa can work with your files. Nexa acts as you, so it only
          ever sees what you already have access to.
        </p>
      </header>

      {banner ? (
        <div className={`${styles.banner} ${styles[banner.tone]}`} role="status">
          <span>{banner.message}</span>
          <button type="button" className={styles.bannerClose} onClick={() => setBanner(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      {disconnectNote ? (
        <div className={`${styles.banner} ${styles.info}`} role="status">
          <span>
            {disconnectNote}{" "}
            <a
              href="https://myaccount.microsoft.com"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.noteLink}
            >
              Open Microsoft account settings <BiLinkExternal size={13} />
            </a>
          </span>
          <button
            type="button"
            className={styles.bannerClose}
            onClick={() => setDisconnectNote(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className={styles.loading}>
          <BiLoaderAlt className={styles.spin} size={22} />
          Loading your connectors…
        </div>
      ) : (
        <div className={styles.list}>{(data?.connectors || []).map(renderCard)}</div>
      )}

      {/* Admins only, and only when something is actually missing. A server-side gap is
          not something an employee can act on, so telling them would be noise. */}
      {!loading && isAdmin && data?.microsoft.configurationGap ? (
        <p className={styles.adminNote}>
          Microsoft 365 is not configured on this server — {data.microsoft.configurationGap}
        </p>
      ) : null}

      {confirmDisconnect ? (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Disconnect {confirmDisconnect.label}?</h2>
            <p className={styles.modalBody}>
              Nexa will lose access to your OneDrive and SharePoint files. You'll need to sign in
              again to reconnect.
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryBtn} onClick={() => setConfirmDisconnect(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerBtn}
                onClick={() => void handleDisconnect(confirmDisconnect)}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
