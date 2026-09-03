import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { BiCheckCircle, BiErrorCircle, BiLockAlt, BiShieldQuarter } from "react-icons/bi";
import styles from "../adminConnectors.module.css";

/**
 * Admin → Connectors.
 *
 * The other half of the settings page an employee sees: that page lets a person
 * connect *their own* account, this one decides whether the connector may be used
 * *at all* for the business unit, and whether it may write. Until this existed there
 * was no way to approve Microsoft 365 for a business unit short of a direct database
 * write — the Connect button on the employee side would 403 for everyone.
 *
 * `approved` is the gate that matters. It is seeded false for any connector that
 * sends data outside the deployment, on purpose: going from "the code shipped" to
 * "employees can point this at Microsoft" is exactly the judgement call an admin,
 * not a deploy, should make. `writeEnabled` can only be turned on once `approved` is
 * true — the API enforces this and returns 400 otherwise, so the control here is
 * disabled rather than left to fail visibly.
 */

type ConnectorTool = { name: string; description: string; access: "read" | "write" };

type ConnectorSettings = {
  enabled: boolean;
  writeEnabled: boolean;
  approved: boolean;
  allowedDepartments: string[];
  adminOnly: boolean;
};

type AdminConnector = {
  connectorId: string;
  label: string;
  description: string;
  kind: "first_party" | "remote";
  transport: string;
  dataLeavesNetwork: boolean;
  requiresIdentity: "microsoft" | null;
  globallyEnabled: boolean;
  settings: ConnectorSettings | null;
  tools: ConnectorTool[];
  reachable: boolean;
};

type ListResponse = { businessUnit: string; connectors: AdminConnector[] };

/** Fallback used only for a business unit with no enablement row yet — mirrors the API's own default. */
const CLOSED_DEFAULT: ConnectorSettings = {
  enabled: false,
  writeEnabled: false,
  approved: false,
  allowedDepartments: [],
  adminOnly: false,
};

interface AdminConnectorsProps {
  adminToken: string;
  theme: "dark" | "light";
}

const AdminConnectors: React.FC<AdminConnectorsProps> = ({ adminToken, theme }) => {
  const [businessUnit, setBusinessUnit] = useState<string>("");
  const [connectors, setConnectors] = useState<AdminConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const isDark = theme === "dark";

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data } = await axios.get<ListResponse>("/api/v1/admin/connectors", {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      setBusinessUnit(data.businessUnit);
      setConnectors(data.connectors);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not load connectors.");
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (connectorId: string, body: Partial<ConnectorSettings>) => {
      setSavingId(connectorId);
      setError(null);
      // Optimistic — an admin toggling several connectors in a row should not wait
      // on a round trip per click to see the switch move.
      setConnectors((prev) =>
        prev.map((c) =>
          c.connectorId === connectorId
            ? { ...c, settings: { ...(c.settings ?? CLOSED_DEFAULT), ...body } }
            : c
        )
      );
      try {
        const { data } = await axios.patch(
          `/api/v1/admin/connectors/${connectorId}`,
          body,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        setConnectors((prev) =>
          prev.map((c) => (c.connectorId === connectorId ? { ...c, settings: data.settings } : c))
        );
      } catch (err: any) {
        // Roll back to the server's actual state rather than leaving the optimistic
        // guess on screen — most likely cause is the writeEnabled-before-approved 400.
        setError(err?.response?.data?.error || "Could not update connector.");
        await load();
      } finally {
        setSavingId(null);
      }
    },
    [adminToken, load]
  );

  if (loading) {
    return <div className={`${styles.wrap} ${isDark ? styles.dark : ""}`}>Loading connectors…</div>;
  }

  return (
    <div className={`${styles.wrap} ${isDark ? styles.dark : ""}`}>
      <div className={styles.header}>
        <h1 className={styles.title}>Connectors</h1>
        <p className={styles.subtitle}>
          What Nexa may reach beyond your knowledge base, for <strong>{businessUnit}</strong>. Approving a
          connector lets employees turn it on for themselves in their own settings — it does not grant
          anyone access on its own.
        </p>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <BiErrorCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.list}>
        {connectors.map((connector) => {
          const settings = connector.settings ?? CLOSED_DEFAULT;
          const saving = savingId === connector.connectorId;
          const expanded = expandedId === connector.connectorId;

          return (
            <div key={connector.connectorId} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIdentity}>
                  <div className={styles.cardLabelRow}>
                    <span className={styles.cardLabel}>{connector.label}</span>
                    {!connector.globallyEnabled && (
                      <span className={styles.badgeMuted}>Disabled server-wide</span>
                    )}
                    {!connector.reachable && (
                      <span className={styles.badgeWarn}>
                        <BiErrorCircle size={13} /> Unreachable
                      </span>
                    )}
                  </div>
                  <p className={styles.cardDescription}>{connector.description}</p>
                  <div className={styles.metaRow}>
                    <span className={connector.dataLeavesNetwork ? styles.metaWarn : styles.metaOk}>
                      {connector.dataLeavesNetwork ? (
                        <>
                          <BiShieldQuarter size={13} /> Data leaves the network
                        </>
                      ) : (
                        <>
                          <BiCheckCircle size={13} /> Runs entirely inside Nexa
                        </>
                      )}
                    </span>
                    {connector.requiresIdentity && (
                      <span className={styles.metaNeutral}>
                        <BiLockAlt size={13} /> Each employee connects their own {connector.requiresIdentity === "microsoft" ? "Microsoft" : connector.requiresIdentity} account
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.controls}>
                <label className={styles.toggleRow}>
                  <span>
                    <strong>Approved</strong>
                    <span className={styles.toggleHint}>
                      Required before any employee can connect or use this. This is the decision that
                      actually matters — everything below is refinement of it.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.approved}
                    disabled={saving}
                    onChange={(e) => {
                      const approved = e.target.checked;
                      // Revoking approval must also drop write access — leaving
                      // writeEnabled true on an unapproved connector is a state the
                      // API itself refuses to create, so the UI should not display it.
                      patch(connector.connectorId, approved ? { approved } : { approved, writeEnabled: false });
                    }}
                  />
                </label>

                <label className={styles.toggleRow}>
                  <span>
                    <strong>Enabled</strong>
                    <span className={styles.toggleHint}>Live right now for this business unit.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    disabled={saving}
                    onChange={(e) => patch(connector.connectorId, { enabled: e.target.checked })}
                  />
                </label>

                <label
                  className={`${styles.toggleRow} ${!settings.approved ? styles.toggleRowDisabled : ""}`}
                  title={!settings.approved ? "Approve the connector first — writes cannot be enabled before that." : undefined}
                >
                  <span>
                    <strong>Allow write actions</strong>
                    <span className={styles.toggleHint}>
                      Lets the model change things in the source system, not just read from it. Off means
                      every tool this connector offers is read-only regardless of what it supports.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.writeEnabled}
                    disabled={saving || !settings.approved}
                    onChange={(e) => patch(connector.connectorId, { writeEnabled: e.target.checked })}
                  />
                </label>

                <label className={styles.toggleRow}>
                  <span>
                    <strong>Admin-only</strong>
                    <span className={styles.toggleHint}>Restrict this connector to business-unit admins.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.adminOnly}
                    disabled={saving}
                    onChange={(e) => patch(connector.connectorId, { adminOnly: e.target.checked })}
                  />
                </label>
              </div>

              {connector.tools.length > 0 && (
                <button
                  type="button"
                  className={styles.toolsToggle}
                  onClick={() => setExpandedId(expanded ? null : connector.connectorId)}
                >
                  {expanded ? "Hide" : "Show"} {connector.tools.length} tool{connector.tools.length === 1 ? "" : "s"}
                </button>
              )}

              {expanded && (
                <ul className={styles.toolsList}>
                  {connector.tools.map((tool) => (
                    <li key={tool.name} className={styles.toolItem}>
                      <span className={tool.access === "write" ? styles.accessWrite : styles.accessRead}>
                        {tool.access}
                      </span>
                      <span className={styles.toolName}>{tool.name}</span>
                      <span className={styles.toolDescription}>{tool.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminConnectors;
