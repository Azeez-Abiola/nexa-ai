import React, { useState } from "react";
import axios from "axios";
import { Loader2, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ForceChangePasswordModalProps {
  open: boolean;
  /** Called after the password is updated; parent should refresh user state. */
  onSuccess: () => void;
}

const inputBu =
  "rounded-xl h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:border-[var(--brand-color)]/55 focus-visible:ring-offset-0";

const ForceChangePasswordModal: React.FC<ForceChangePasswordModalProps> = ({ open, onSuccess }) => {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("cpanelToken") || localStorage.getItem("nexa-token");
      await axios.post(
        "/api/v1/admin/auth/change-password-first-login",
        { newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Clear the flag locally so the modal doesn't reopen on refresh.
      const userKeys: ("nexa-user" | "cpanelUser")[] = ["nexa-user", "cpanelUser"];
      for (const key of userKeys) {
        const raw = localStorage.getItem(key);
        if (!raw || raw === "undefined") continue;
        try {
          const parsed = JSON.parse(raw);
          parsed.mustChangePassword = false;
          localStorage.setItem(key, JSON.stringify(parsed));
        } catch {
          /* ignore */
        }
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || "Could not update password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 sm:p-10">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 className="text-xl font-black font-['Sen'] text-slate-900 leading-tight">Set a new password</h2>
            <p className="text-sm font-medium text-slate-500 mt-1 leading-relaxed">
              Your account was provisioned with a temporary password. Choose your own before continuing.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700">New password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`${inputBu} pr-11`}
                minLength={8}
                placeholder="At least 8 characters"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700">Confirm new password</Label>
            <Input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputBu}
              required
            />
          </div>

          {error ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl font-bold text-white h-11"
            style={{ backgroundColor: "var(--brand-color)" }}
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : "Set password and continue"}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ForceChangePasswordModal;
