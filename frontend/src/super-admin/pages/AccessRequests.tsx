import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { format } from "date-fns";
import { Building2, CheckCircle2, Inbox, Loader2, Mail, Phone, Users, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/lib/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

type RequestStatus = "pending" | "provisioned" | "rejected";

interface AccessRequest {
  _id: string;
  companyName: string;
  workEmail: string;
  phone: string;
  employeeCount: number;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionNote?: string;
  createdAt: string;
}

const TAB_COPY: Record<RequestStatus, { title: string; empty: string }> = {
  pending: { title: "Pending", empty: "No pending access requests right now." },
  provisioned: { title: "Provisioned", empty: "No tenants have been provisioned from a request yet." },
  rejected: { title: "Rejected", empty: "No requests have been rejected." }
};

const inputBu =
  "rounded-xl h-11 border-slate-200 focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:border-[var(--brand-color)]/55 focus-visible:ring-offset-0";

const AccessRequests: React.FC = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<RequestStatus>("pending");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [provisionTarget, setProvisionTarget] = useState<AccessRequest | null>(null);
  const [provisionLabel, setProvisionLabel] = useState("");
  const [provisionColor, setProvisionColor] = useState("#ed0000");
  const [provisionLogo, setProvisionLogo] = useState<File | null>(null);
  const [provisionSubmitting, setProvisionSubmitting] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<AccessRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const token = useMemo(
    () => localStorage.getItem("cpanelToken") || localStorage.getItem("nexa-token"),
    []
  );
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/v1/provisioning/access-requests?status=${tab}`, { headers });
      setRequests(data.requests || []);
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not load access requests",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setLoading(false);
    }
  }, [tab, headers, token, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openProvision = (req: AccessRequest) => {
    setProvisionTarget(req);
    setProvisionLabel(req.companyName);
    setProvisionColor("#ed0000");
    setProvisionLogo(null);
  };

  const handleProvision = async () => {
    if (!provisionTarget) return;
    try {
      setProvisionSubmitting(true);
      const formData = new FormData();
      if (provisionLabel.trim()) formData.append("label", provisionLabel.trim());
      if (provisionColor.trim()) formData.append("colorCode", provisionColor.trim());
      if (provisionLogo) formData.append("logo", provisionLogo);

      const { data, status } = await axios.post(
        `/api/v1/provisioning/access-requests/${provisionTarget._id}/provision`,
        formData,
        { headers }
      );

      if (status === 207 && data?.warning) {
        toast({
          title: "Tenant provisioned, but credentials email failed",
          description: data.warning,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Tenant provisioned",
          description: `${provisionTarget.companyName} is live. Admin credentials were emailed to ${provisionTarget.workEmail}.`
        });
      }
      setProvisionTarget(null);
      fetchRequests();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not provision tenant",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setProvisionSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      setRejectSubmitting(true);
      await axios.patch(
        `/api/v1/provisioning/access-requests/${rejectTarget._id}/reject`,
        rejectNote.trim() ? { note: rejectNote.trim() } : {},
        { headers }
      );
      toast({
        title: "Request rejected",
        description: `${rejectTarget.companyName} has been notified by email.`
      });
      setRejectTarget(null);
      setRejectNote("");
      fetchRequests();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not reject request",
        description: err.response?.data?.error || "Please try again."
      });
    } finally {
      setRejectSubmitting(false);
    }
  };

  return (
    <div className="px-6 lg:px-12 py-10 space-y-10">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-color)]/10 flex items-center justify-center text-[var(--brand-color)]">
            <Inbox size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black font-['Sen'] text-slate-900">Access Requests</h1>
            <p className="text-sm font-medium text-slate-500">
              New businesses asking to onboard onto Nexa AI. Review, provision, or reject.
            </p>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as RequestStatus)} className="w-full">
        <TabsList className="h-12 rounded-2xl bg-slate-100/80 p-1 w-full max-w-md">
          {(Object.keys(TAB_COPY) as RequestStatus[]).map((key) => (
            <TabsTrigger key={key} value={key} className="rounded-xl font-bold flex-1 data-[state=active]:shadow-md">
              {TAB_COPY[key].title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white p-6">
              <Skeleton className="h-5 w-3/4 rounded mb-4" />
              <Skeleton className="h-4 w-2/3 rounded mb-2" />
              <Skeleton className="h-4 w-1/2 rounded mb-6" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </Card>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-6 text-slate-400">
            <Inbox size={28} />
          </div>
          <p className="font-bold text-slate-700 mb-1">{TAB_COPY[tab].title} requests</p>
          <p className="text-sm font-medium text-slate-500">{TAB_COPY[tab].empty}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {requests.map((req) => (
            <Card
              key={req._id}
              className="border-none shadow-xl shadow-slate-200/50 rounded-2xl bg-white"
            >
              <CardContent className="p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-black font-['Sen'] text-slate-900 truncate" title={req.companyName}>
                      {req.companyName}
                    </h3>
                    <p className="text-xs font-medium text-slate-400">
                      Submitted {format(new Date(req.createdAt), "MMM d, yyyy 'at' p")}
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[var(--brand-color)]/10 flex items-center justify-center text-[var(--brand-color)] shrink-0">
                    <Building2 size={18} />
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail size={14} className="shrink-0 text-slate-400" />
                    <span className="font-bold truncate" title={req.workEmail}>{req.workEmail}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone size={14} className="shrink-0 text-slate-400" />
                    <span className="font-bold">{req.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Users size={14} className="shrink-0 text-slate-400" />
                    <span className="font-bold">{req.employeeCount.toLocaleString()} employees</span>
                  </div>
                </div>

                {req.status === "pending" ? (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => openProvision(req)}
                      className="flex-1 rounded-xl font-bold text-white h-10"
                      style={{ backgroundColor: "var(--brand-color)" }}
                    >
                      <CheckCircle2 size={16} className="mr-2" />
                      Provision
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setRejectTarget(req);
                        setRejectNote("");
                      }}
                      className="flex-1 rounded-xl font-bold h-10 border-slate-200 text-slate-700 hover:text-red-600 hover:border-red-200"
                    >
                      <XCircle size={16} className="mr-2" />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="pt-2 space-y-1 border-t border-slate-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mt-3">
                      {req.status === "provisioned" ? "Provisioned" : "Rejected"}
                    </p>
                    {req.reviewedAt ? (
                      <p className="text-xs text-slate-500 font-medium">
                        {format(new Date(req.reviewedAt), "MMM d, yyyy")}{req.reviewedBy ? ` by ${req.reviewedBy}` : ""}
                      </p>
                    ) : null}
                    {req.status === "rejected" && req.rejectionNote ? (
                      <p className="text-xs text-slate-500 font-medium italic mt-1">"{req.rejectionNote}"</p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Provision sheet */}
      <Sheet open={!!provisionTarget} onOpenChange={(open) => !open && !provisionSubmitting && setProvisionTarget(null)}>
        <SheetContent side="right" className="sm:max-w-md flex flex-col">
          <SheetHeader className="text-left space-y-2">
            <SheetTitle className="text-2xl font-black font-['Sen']">Provision tenant</SheetTitle>
            <SheetDescription className="text-slate-500 font-medium text-sm leading-relaxed">
              This creates the tenant, generates an admin account, and emails login credentials to{" "}
              <span className="font-bold text-slate-800">{provisionTarget?.workEmail}</span>.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 flex flex-col gap-5 flex-1">
            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Tenant label</Label>
              <Input
                value={provisionLabel}
                onChange={(e) => setProvisionLabel(e.target.value)}
                className={inputBu}
                placeholder={provisionTarget?.companyName}
              />
              <p className="text-xs text-slate-400 font-medium">
                What employees see across the product. Defaults to the company name on the request.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Brand colour</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={provisionColor}
                  onChange={(e) => setProvisionColor(e.target.value)}
                  className="h-11 w-16 rounded-xl border-slate-200 p-1 cursor-pointer"
                />
                <Input
                  value={provisionColor}
                  onChange={(e) => setProvisionColor(e.target.value)}
                  className={inputBu}
                  placeholder="#ed0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-bold text-slate-700">Logo <span className="font-normal text-slate-400">(optional)</span></Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  if (file && file.size > 10 * 1024 * 1024) {
                    toast({
                      title: "Logo too large",
                      description: "Logos must be 10 MB or smaller.",
                      variant: "destructive"
                    });
                    e.target.value = "";
                    setProvisionLogo(null);
                    return;
                  }
                  setProvisionLogo(file);
                }}
                className={inputBu}
              />
              {provisionLogo ? (
                <p className="text-xs text-slate-500 font-medium">{provisionLogo.name}</p>
              ) : null}
            </div>

            <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500 leading-relaxed">
              <p className="font-bold text-slate-700 mb-1">What happens next</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Tenant <span className="font-bold">{provisionTarget?.companyName}</span> is created and activated.</li>
                <li>An admin account is auto-generated for <span className="font-bold">{provisionTarget?.workEmail}</span>.</li>
                <li>A password and sign-in instructions are emailed to that address.</li>
              </ul>
            </div>
          </div>

          <SheetFooter className="mt-auto px-0 flex-row gap-3 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              className="flex-1 rounded-xl font-bold"
              onClick={() => setProvisionTarget(null)}
              disabled={provisionSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProvision}
              disabled={provisionSubmitting}
              className="flex-[2] rounded-xl font-bold text-white h-11"
              style={{ backgroundColor: "var(--brand-color)" }}
            >
              {provisionSubmitting ? <Loader2 className="animate-spin" size={18} /> : "Provision tenant"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reject confirmation */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && !rejectSubmitting && setRejectTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black font-['Sen']">
              Reject {rejectTarget?.companyName}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 font-medium leading-relaxed">
              An email will be sent to {rejectTarget?.workEmail} letting them know their request was declined.
              You can include an optional note that will be shown in the email.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2">
            <Label className="text-sm font-bold text-slate-700">Note <span className="font-normal text-slate-400">(optional)</span></Label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-color)] focus-visible:border-[var(--brand-color)]/55"
              placeholder="e.g. We're not currently onboarding businesses below 50 employees."
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-xl font-bold"
              disabled={rejectSubmitting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={rejectSubmitting}
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700"
            >
              {rejectSubmitting ? <Loader2 className="animate-spin" size={16} /> : "Reject and notify"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AccessRequests;
