import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { Plus, Trash2, Users, Loader2, Search, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter
} from "@/components/ui/sheet";
import { useToast } from "@/lib/use-toast";
import { cn } from "@/lib/utils";

const API = "/api/v1/admin/user-groups";

export type UserGroupRow = {
  _id: string;
  name: string;
  description?: string;
  memberUserIds?: string[];
};

type UserRow = { _id: string; email: string; fullName: string };

export type UserGroupsPanelProps = {
  businessUnit: string;
  headers: Record<string, string>;
  /** Super-admin: pass query/body `businessUnit` on each request */
  useScopedBuQuery?: boolean;
  /** Tighter layout when embedded in another surface (e.g. Users sheet) */
  embedded?: boolean;
};

/**
 * Create user groups, add/remove members, and delete groups. Same groups are used when assigning policies on upload.
 */
const UserGroupsPanel: React.FC<UserGroupsPanelProps> = ({
  businessUnit,
  headers,
  useScopedBuQuery = false,
  embedded = false
}) => {
  const [groups, setGroups] = useState<UserGroupRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  /** When set, the create/edit sheet is in edit mode — saving sends PATCH instead of POST. */
  const [editingGroup, setEditingGroup] = useState<UserGroupRow | null>(null);
  const [memberGroup, setMemberGroup] = useState<UserGroupRow | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const { toast } = useToast();

  const fetchGroups = useCallback(async () => {
    if (!businessUnit) {
      setGroups([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data } = await axios.get<{ groups: UserGroupRow[] }>(API, {
        headers,
        params: useScopedBuQuery ? { businessUnit } : {}
      });
      setGroups(data.groups || []);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load user groups." });
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, [headers, businessUnit, toast, useScopedBuQuery]);

  const fetchUsers = useCallback(async () => {
    if (!businessUnit) {
      setUsers([]);
      return;
    }
    try {
      const { data } = await axios.get<{ users: UserRow[] }>("/api/v1/admin/auth/users", {
        headers,
        params: { businessUnit }
      });
      setUsers(data.users || []);
    } catch {
      setUsers([]);
    }
  }, [headers, businessUnit]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !businessUnit) return;
    setIsSaving(true);
    try {
      if (editingGroup) {
        await axios.patch(
          `${API}/${editingGroup._id}`,
          {
            name: newName.trim(),
            description: newDesc.trim(),
            ...(useScopedBuQuery ? { businessUnit } : {})
          },
          { headers }
        );
        toast({ title: "Updated", description: "User group details saved." });
      } else {
        await axios.post(
          API,
          {
            name: newName.trim(),
            description: newDesc.trim(),
            ...(useScopedBuQuery ? { businessUnit } : {})
          },
          { headers }
        );
        toast({ title: "Created", description: "User group created." });
      }
      setNewName("");
      setNewDesc("");
      setEditingGroup(null);
      setSheetOpen(false);
      fetchGroups();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err.response?.data?.error || (editingGroup ? "Could not update user group." : "Could not create user group.")
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openCreateSheet = () => {
    setEditingGroup(null);
    setNewName("");
    setNewDesc("");
    setSheetOpen(true);
  };

  const openEditSheet = (group: UserGroupRow) => {
    setEditingGroup(group);
    setNewName(group.name);
    setNewDesc(group.description || "");
    setSheetOpen(true);
  };

  const toggleMember = async (groupId: string, userId: string, action: "add" | "remove") => {
    try {
      await axios.post(
        `${API}/${groupId}/members`,
        { userId, action, ...(useScopedBuQuery ? { businessUnit } : {}) },
        { headers }
      );
      fetchGroups();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: err.response?.data?.error || "Could not update members."
      });
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Delete this user group? Policies may still reference it — update document assignments first.")) return;
    try {
      await axios.delete(`${API}/${id}`, {
        headers,
        params: useScopedBuQuery ? { businessUnit } : {}
      });
      toast({ title: "Deleted" });
      fetchGroups();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.response?.data?.error || "Could not delete."
      });
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase())
  );

  const wrapClass = embedded ? "space-y-6" : "space-y-10";

  return (
    <div className={cn("min-w-0 max-w-full", wrapClass)}>
      <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", embedded && "pt-2")}>
        {!embedded && (
          <p className="text-slate-500 text-sm font-medium max-w-2xl">
            Users can belong to <span className="font-bold text-slate-700">multiple</span> groups. Assign groups on policy
            upload so only those members retrieve the document in chat.
          </p>
        )}
        <Button
          className="h-11 px-5 rounded-2xl text-white font-bold gap-2 shadow-md shrink-0"
          style={{ backgroundColor: "var(--brand-color)" }}
          disabled={!businessUnit}
          onClick={openCreateSheet}
        >
          <Plus size={18} />
          New user group
        </Button>
      </div>

      <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
        {isLoading ? (
          <div className="p-12 flex justify-center text-slate-400">
            <Loader2 className="animate-spin w-8 h-8" />
          </div>
        ) : !businessUnit ? (
          <div className="p-10 text-center text-slate-500 font-medium">Select a business unit to manage user groups.</div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="pl-6 font-bold text-slate-400 uppercase text-[10px] tracking-widest">Group name</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Members</TableHead>
                <TableHead className="w-[200px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g._id} className="border-slate-50">
                  <TableCell className="pl-6 py-4">
                    <p className="font-bold text-slate-900">{g.name}</p>
                    {g.description ? <p className="text-xs text-slate-500 mt-1">{g.description}</p> : null}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-semibold text-slate-600">{g.memberUserIds?.length ?? 0}</span>
                  </TableCell>
                  <TableCell className="text-right pr-6 space-x-2">
                    <Button variant="outline" size="sm" className="rounded-xl font-bold" onClick={() => setMemberGroup(g)}>
                      <Users size={16} className="mr-1" />
                      Members
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit name & description"
                      className="text-slate-400 hover:text-[var(--brand-color)]"
                      onClick={() => openEditSheet(g)}
                    >
                      <Pencil size={18} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete group"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => handleDeleteGroup(g._id)}
                    >
                      <Trash2 size={18} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setEditingGroup(null);
        }}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingGroup ? "Edit user group" : "New user group"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-8 px-1">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="rounded-xl" required />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="rounded-xl" />
            </div>
            <SheetFooter>
              <Button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-xl font-bold"
                style={{ backgroundColor: "var(--brand-color)" }}
              >
                {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : editingGroup ? "Save changes" : "Create"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={!!memberGroup} onOpenChange={(o) => !o && setMemberGroup(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Members — {memberGroup?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <Input
                placeholder="Search users…"
                className="pl-10 rounded-xl"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filteredUsers.map((u) => {
                const inGroup = memberGroup?.memberUserIds?.some((id) => String(id) === String(u._id));
                return (
                  <div
                    key={u._id}
                    className={cn(
                      "flex items-center justify-between rounded-xl border px-4 py-3",
                      inGroup ? "border-[var(--brand-color)]/40 bg-[var(--brand-color)]/[0.04]" : "border-slate-100"
                    )}
                  >
                    <div>
                      <p className="text-sm font-bold text-slate-900">{u.fullName}</p>
                      <p className="text-xs text-slate-500">{u.email}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={inGroup ? "outline" : "default"}
                      className="rounded-xl font-bold"
                      style={!inGroup ? { backgroundColor: "var(--brand-color)" } : undefined}
                      onClick={() =>
                        memberGroup && toggleMember(memberGroup._id, u._id, inGroup ? "remove" : "add")
                      }
                    >
                      {inGroup ? "Remove" : "Add"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default UserGroupsPanel;
