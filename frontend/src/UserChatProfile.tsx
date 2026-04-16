import React, { useState, useEffect } from "react";
import axios from "axios";
import { BiArrowBack, BiInfoCircle, BiLock, BiUser } from "react-icons/bi";

const AVATARS = ["/avatar-1.png", "/avatar-2.png"] as const;

export interface ChatUserShape {
  id: string;
  email: string;
  fullName: string;
  businessUnit: string;
  grade?: string;
  tenantLabel?: string;
  tenantContactEmail?: string;
  tenantId?: string;
  tenantSlug?: string;
  tenantLogo?: string;
  tenantColor?: string;
  emailVerified?: boolean;
  isAdmin?: boolean;
}

type Props = {
  user: ChatUserShape;
  theme: "light" | "dark";
  selectedAvatar: string;
  onAvatarChange: (path: string) => void;
  onUserUpdated: (next: ChatUserShape) => void;
  onBack: () => void;
};

export const UserChatProfile: React.FC<Props> = ({
  user,
  theme,
  selectedAvatar,
  onAvatarChange,
  onUserUpdated,
  onBack,
}) => {
  const [fullName, setFullName] = useState(user.fullName || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isDark = theme === "dark";
  /** Match `App.tsx` `.dark-theme` chat shell (sidebar / layout / cards). */
  const d = {
    page: "bg-[#1a1a1a]",
    card: "border border-[#3f3f3f] bg-[#2a2a2a] shadow-none",
    cardInnerHover: "hover:border-[#525252]",
    heading: "text-[#f9fafb]",
    body: "text-[#9ca3af]",
    label: "text-[#9ca3af]",
    input:
      "border-[#444] bg-[#333] text-[#f9fafb] placeholder:text-[#6b7280] focus:border-[var(--brand-color)] focus:ring-2 focus:ring-[var(--brand-color)]/25",
    backBtn: "text-[#9ca3af] hover:bg-[#333] hover:text-[#f9fafb]",
    btnSecondary: "border border-[#444] bg-[#333] text-[#f9fafb] hover:bg-[#404040]",
    success: "text-emerald-400",
    error: "text-red-400",
    strong: "text-[#e5e7eb]",
  };

  useEffect(() => {
    setFullName(user.fullName || "");
  }, [user.fullName, user.id]);

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameMsg(null);
    const trimmed = fullName.trim();
    if (!trimmed) {
      setNameMsg("Please enter your name.");
      return;
    }
    setSavingName(true);
    try {
      const { data } = await axios.patch<{ user: ChatUserShape }>("/api/v1/auth/me", { fullName: trimmed });
      const next = { ...user, ...data.user };
      onUserUpdated(next);
      setNameMsg("Saved.");
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setNameMsg(typeof msg === "string" ? msg : "Could not save name.");
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 6) {
      setPwMsg({ type: "err", text: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "err", text: "New password and confirmation do not match." });
      return;
    }
    setSavingPw(true);
    try {
      await axios.put("/api/v1/auth/me/password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg({ type: "ok", text: "Password updated." });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setPwMsg({ type: "err", text: typeof msg === "string" ? msg : "Could not update password." });
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div
      className={`user-chat-profile-page flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6 sm:py-8 ${
        isDark ? d.page : "bg-[#f9fafb]"
      }`}
    >
      <div className="mx-auto w-full max-w-lg space-y-6">
        <button
          type="button"
          onClick={onBack}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
            isDark ? d.backBtn : "text-slate-600 hover:bg-white"
          }`}
        >
          <BiArrowBack size={18} />
          Back to chat
        </button>

        <div>
          <h1 className={`text-2xl font-bold tracking-tight sm:text-3xl ${isDark ? d.heading : "text-slate-900"}`}>
            Your profile
          </h1>
          <p className={`mt-1 text-sm ${isDark ? d.body : "text-slate-500"}`}>
            Update how you appear in Nexa, your assistant avatar, and your sign-in password.
          </p>
        </div>

        <section
          className={`rounded-2xl p-5 sm:p-6 ${
            isDark ? `${d.card} ${d.cardInnerHover}` : "border border-slate-200 bg-white shadow-sm"
          }`}
        >
          <div className="mb-4 flex items-center gap-2">
            <BiUser className={isDark ? d.body : "text-slate-500"} size={20} />
            <h2 className={`text-lg font-bold ${isDark ? d.heading : "text-slate-900"}`}>Display name</h2>
          </div>
          <form onSubmit={saveName} className="space-y-3">
            <label className={`block text-xs font-semibold uppercase tracking-wide ${isDark ? d.label : "text-slate-400"}`}>
              Full name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`h-12 w-full rounded-xl border px-4 text-sm font-medium outline-none ring-offset-0 focus:ring-2 ${
                isDark
                  ? `${d.input}`
                  : "border-slate-200 bg-slate-50 text-slate-900 focus:border-[var(--brand-color)] focus:ring-2 focus:ring-[var(--brand-color)]/20"
              }`}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={savingName}
                className="h-11 rounded-xl bg-[var(--brand-color,#ed0000)] px-5 text-sm font-bold text-white shadow-md transition-opacity disabled:opacity-50"
              >
                {savingName ? "Saving…" : "Save name"}
              </button>
              {nameMsg ? (
                <span
                  className={`text-sm ${
                    nameMsg === "Saved." ? (isDark ? d.success : "text-emerald-600") : isDark ? d.error : "text-red-600"
                  }`}
                >
                  {nameMsg}
                </span>
              ) : null}
            </div>
          </form>
          <p className={`mt-4 text-xs ${isDark ? d.label : "text-slate-400"}`}>
            Email: <span className="font-semibold text-[var(--brand-color,#ed0000)]">{user.email}</span> (managed by your administrator)
          </p>
        </section>

        <section
          className={`rounded-2xl p-5 sm:p-6 ${
            isDark ? `${d.card} ${d.cardInnerHover}` : "border border-slate-200 bg-white shadow-sm"
          }`}
        >
          <h2 className={`mb-1 text-lg font-bold ${isDark ? d.heading : "text-slate-900"}`}>AI assistant avatar</h2>
          <p className={`mb-4 text-sm ${isDark ? d.body : "text-slate-500"}`}>
            This avatar appears next to Nexa’s messages in your chats.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {AVATARS.map((src) => {
              const active = (selectedAvatar || "/avatar-1.png") === src;
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => onAvatarChange(src)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 transition-all ${
                    active
                      ? isDark
                        ? "border-[var(--brand-color,#ed0000)] bg-[color-mix(in_srgb,var(--brand-color)_18%,#2a2a2a)]"
                        : "border-[var(--brand-color,#ed0000)] bg-[color-mix(in_srgb,var(--brand-color)_12%,transparent)]"
                      : isDark
                        ? "border-2 border-[#444] bg-[#333] hover:border-[#525252]"
                        : "border-slate-100 bg-slate-50 hover:border-slate-200"
                  }`}
                >
                  <img src={src} alt="" className="h-20 w-20 object-contain sm:h-24 sm:w-24" />
                  <span
                    className={`text-xs font-bold ${
                      active ? "text-[var(--brand-color,#ed0000)]" : isDark ? d.body : "text-slate-500"
                    }`}
                  >
                    {src === "/avatar-1.png" ? "Nexa" : "Nex"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className={`rounded-2xl p-5 sm:p-6 ${
            isDark ? `${d.card} ${d.cardInnerHover}` : "border border-slate-200 bg-white shadow-sm"
          }`}
        >
          <div className="mb-4 flex items-center gap-2">
            <BiLock className={isDark ? d.body : "text-slate-500"} size={20} />
            <h2 className={`text-lg font-bold ${isDark ? d.heading : "text-slate-900"}`}>Password</h2>
          </div>
          <form onSubmit={savePassword} className="space-y-4">
            <div>
              <label className={`mb-1 block text-xs font-semibold ${isDark ? d.label : "text-slate-400"}`}>Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`h-12 w-full rounded-xl border px-4 text-sm outline-none focus:ring-2 ${
                  isDark ? d.input : "border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[var(--brand-color)]/20"
                }`}
              />
            </div>
            <div>
              <label className={`mb-1 block text-xs font-semibold ${isDark ? d.label : "text-slate-400"}`}>New password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`h-12 w-full rounded-xl border px-4 text-sm outline-none focus:ring-2 ${
                  isDark ? d.input : "border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[var(--brand-color)]/20"
                }`}
              />
            </div>
            <div>
              <label className={`mb-1 block text-xs font-semibold ${isDark ? d.label : "text-slate-400"}`}>Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`h-12 w-full rounded-xl border px-4 text-sm outline-none focus:ring-2 ${
                  isDark ? d.input : "border-slate-200 bg-slate-50 text-slate-900 focus:ring-2 focus:ring-[var(--brand-color)]/20"
                }`}
              />
            </div>
            {pwMsg ? (
              <p className={`text-sm font-medium ${pwMsg.type === "ok" ? (isDark ? d.success : "text-emerald-600") : isDark ? d.error : "text-red-600"}`}>
                {pwMsg.text}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={savingPw}
              className={`h-11 w-full rounded-xl text-sm font-bold shadow-md transition-opacity disabled:opacity-50 sm:w-auto sm:px-8 ${
                isDark ? `${d.btnSecondary}` : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {savingPw ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>

        <p className={`flex items-start gap-2 pb-8 text-xs ${isDark ? d.label : "text-slate-400"}`}>
          <BiInfoCircle className={`mt-0.5 shrink-0 ${isDark ? d.body : ""}`} size={16} aria-hidden />
          <span>
            Forgot your password? Use <strong className={isDark ? d.strong : "text-slate-600"}>Forgot password</strong> on the sign-in page
            to receive a reset link.
          </span>
        </p>
      </div>
    </div>
  );
};
