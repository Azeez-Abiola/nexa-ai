import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { Network, Users } from "lucide-react";
import UserGroupsPanel from "../components/UserGroupsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { readSuperAdminDirectoryBu, writeSuperAdminDirectoryBu } from "../lib/superAdminDirectoryBu";

function readStoredAdminUser(): { businessUnit?: string; tenantName?: string } | null {
  for (const key of ["nexa-user", "cpanelUser"] as const) {
    const raw = localStorage.getItem(key);
    if (raw && raw !== "undefined") {
      try {
        return JSON.parse(raw) as { businessUnit?: string; tenantName?: string };
      } catch {
        /* continue */
      }
    }
  }
  return null;
}

const inputBu =
  "rounded-xl h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:border-[var(--brand-color)]/55 focus-visible:ring-offset-0";

const AdminUserGroupsPage: React.FC = () => {
  const location = useLocation();
  const isSuperPath = location.pathname.startsWith("/super-admin");
  const token = useMemo(
    () =>
      isSuperPath
        ? localStorage.getItem("cpanelToken") || localStorage.getItem("nexa-token")
        : localStorage.getItem("nexa-token"),
    [isSuperPath]
  );
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [isSuperAdminViewer, setIsSuperAdminViewer] = useState(false);
  const [tenantPickList, setTenantPickList] = useState<{ name: string; label: string }[]>([]);
  const [superDirectoryBu, setSuperDirectoryBu] = useState(() => readSuperAdminDirectoryBu());

  useEffect(() => {
    const stored = readStoredAdminUser();
    setIsSuperAdminViewer(stored?.businessUnit === "SUPERADMIN");
  }, []);

  useEffect(() => {
    if (!isSuperAdminViewer || !token) return;
    (async () => {
      try {
        const { data } = await axios.get("/api/v1/provisioning/tenants", { headers });
        const rows = (data.tenants || []).map((t: { name: string; label?: string }) => ({
          name: t.name,
          label: t.label || t.name
        }));
        setTenantPickList(rows);
        let pick = readSuperAdminDirectoryBu();
        if (!pick && rows.length === 1) {
          pick = rows[0].name;
          writeSuperAdminDirectoryBu(pick);
          setSuperDirectoryBu(pick);
        }
      } catch (e) {
        console.error("Failed to load tenants for user groups", e);
      }
    })();
  }, [isSuperAdminViewer, headers, token]);

  const businessUnitForPanel = useMemo(() => {
    const stored = readStoredAdminUser();
    if (stored?.businessUnit === "SUPERADMIN") {
      return superDirectoryBu || readSuperAdminDirectoryBu() || "";
    }
    return (stored?.tenantName || stored?.businessUnit || "").trim();
  }, [superDirectoryBu]);

  return (
    <div className="min-w-0 max-w-full space-y-8 pb-20 animate-in fade-in duration-700">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-4 min-w-0 flex-1">
          <div>
            <Link
              to="/admin/users"
              className="text-xs font-bold text-[var(--brand-color)] hover:underline mb-3 inline-block"
            >
              ← Back to users
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen'] flex items-center gap-3">
              <Network className="text-[var(--brand-color)]" size={32} />
              User groups
            </h1>
            <p className="text-slate-500 font-medium mt-1 max-w-2xl">
              Create groups and assign people from your directory. These groups control which policies each employee can
              retrieve in chat. Members can belong to several groups.
            </p>
          </div>
          {isSuperAdminViewer && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-lg">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider shrink-0">Tenant scope</span>
              <Select
                value={superDirectoryBu || undefined}
                onValueChange={(v) => {
                  setSuperDirectoryBu(v);
                  writeSuperAdminDirectoryBu(v);
                }}
              >
                <SelectTrigger className={`${inputBu} w-full sm:min-w-[280px]`}>
                  <SelectValue placeholder="Choose a tenant…" />
                </SelectTrigger>
                <SelectContent>
                  {tenantPickList.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 shrink-0"
        >
          <Users size={18} className="text-[var(--brand-color)]" />
          User directory
        </Link>
      </div>

      <div className="min-w-0 max-w-full overflow-x-hidden rounded-[2rem] border border-slate-100 bg-white p-4 shadow-sm sm:p-8 md:p-10">
        {businessUnitForPanel ? (
          <UserGroupsPanel businessUnit={businessUnitForPanel} headers={headers} embedded />
        ) : (
          <p className="text-sm text-slate-500 font-medium">
            {isSuperAdminViewer
              ? "Choose a tenant above (or pick one on User directory first) to load groups for that organization."
              : "Could not read your business unit from the session."}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminUserGroupsPage;
