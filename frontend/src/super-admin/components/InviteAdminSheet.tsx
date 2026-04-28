import React, { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface BusinessUnitOption {
  name: string;
  label: string;
}

interface InviteAdminSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Pre-fill the BU dropdown when launching from a tenant-row context. */
  defaultBusinessUnit?: string;
}

const InviteAdminSheet: React.FC<InviteAdminSheetProps> = ({
  isOpen,
  onClose,
  onSuccess,
  defaultBusinessUnit
}) => {
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    businessUnit: defaultBusinessUnit ?? ""
  });
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setFormData((prev) => ({
      fullName: "",
      email: "",
      businessUnit: defaultBusinessUnit ?? prev.businessUnit
    }));
  }, [isOpen, defaultBusinessUnit]);

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem("cpanelToken");
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get("/api/v1/analytics/business-units-list", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!cancelled) {
          setBusinessUnits(
            (data.businessUnits || []).map((bu: any) => ({
              name: bu.name,
              label: bu.label || bu.name
            }))
          );
        }
      } catch {
        if (!cancelled) setBusinessUnits([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim() || !formData.businessUnit) {
      setError("Please fill out every field.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const token = localStorage.getItem("cpanelToken");
      await axios.post("/api/v1/provisioning/invite", formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      onSuccess();
      onClose();
      setFormData({ fullName: "", email: "", businessUnit: defaultBusinessUnit ?? "" });
    } catch (err: any) {
      setError(err.response?.data?.error || "Invitation failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="sm:max-w-md bg-white p-0 flex flex-col border-none shadow-2xl animate-in slide-in-from-right duration-500"
      >
        <SheetHeader className="p-10 pb-0">
          <SheetTitle className="text-3xl font-black font-['Sen']">Invite administrator</SheetTitle>
          <SheetDescription className="text-slate-400 text-sm font-medium mt-2 leading-relaxed">
            The administrator will receive their login credentials via a secure email dispatch. No manual password
            creation is required.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-10 py-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium text-sm ml-1">Full name</Label>
            <Input
              placeholder="e.g. John Doe"
              className="h-11 rounded-xl focus-visible:ring-[#ed0000] font-medium"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium text-sm ml-1">Work email</Label>
            <Input
              type="email"
              placeholder="admin@company.com"
              className="h-11 rounded-xl focus-visible:ring-[#ed0000] font-medium"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-slate-700 font-medium text-sm ml-1">Assign business unit</Label>
            <Select
              value={formData.businessUnit}
              onValueChange={(val) => setFormData({ ...formData, businessUnit: val })}
              disabled={!!defaultBusinessUnit}
            >
              <SelectTrigger className="h-11 rounded-xl focus:ring-[#ed0000] border-slate-200 font-medium">
                <SelectValue placeholder="Select target business unit" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-slate-100">
                {businessUnits.map((bu) => (
                  <SelectItem key={bu.name} value={bu.name} className="py-3 font-medium text-slate-600">
                    {bu.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {defaultBusinessUnit ? (
              <p className="text-xs text-slate-400 font-medium">Pre-filled from the tenant you opened the sheet from.</p>
            ) : null}
          </div>

          <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex gap-3 mt-4">
            <div className="p-2 rounded-full bg-white text-emerald-500 shadow-sm h-fit">
              <Send size={14} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-emerald-700 leading-tight">Direct provisioning active</p>
              <p className="text-[10px] text-emerald-600 mt-1 opacity-80 leading-relaxed">
                Nexa AI will auto-generate a secure password and send it to the administrator immediately.
              </p>
            </div>
          </div>
        </form>

        <SheetFooter className="p-10 pt-6 bg-slate-50/50 space-x-4 border-t border-slate-100">
          <Button variant="ghost" className="rounded-xl font-bold flex-1 h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-[#ed0000] hover:bg-[#c40000] text-white rounded-xl font-bold flex-[2] h-11 shadow-lg shadow-red-900/10 disabled:opacity-60"
            disabled={isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
            {isSubmitting ? "Sending..." : "Send invite"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default InviteAdminSheet;
