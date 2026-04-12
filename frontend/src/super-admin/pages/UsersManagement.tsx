import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users as UsersIcon,
  UserPlus,
  Trash2,
  Mail,
  Shield,
  Search,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/lib/use-toast";

const UsersManagement: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const [newUser, setNewUser] = useState({
    fullName: '',
    email: '',
    password: ''
  });

  const token = localStorage.getItem('nexa-token');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const { data } = await axios.get('/api/v1/admin/auth/users', { headers });
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users', error);
      toast({
        title: "Error",
        description: "Failed to load users for your business unit.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/v1/admin/auth/users', newUser, { headers });
      toast({
        title: "Success",
        description: `${newUser.fullName} has been added to your business unit.`,
      });
      setIsAddModalOpen(false);
      setNewUser({ fullName: '', email: '', password: '' });
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Failed to create user.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setIsDeleting(userId);
      await axios.delete(`/api/v1/admin/auth/users/${userId}`, { headers });
      toast({
        title: "User Deleted",
        description: "The user has been removed from your unit.",
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen'] flex items-center gap-3">
            <UsersIcon className="text-[var(--brand-color)]" size={32} />
            User directory
          </h1>
          <p className="text-slate-500 font-medium">Automatic tracking of infrastructure access for your local team.</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold font-['Sen']">Registered users</h2>
            <Badge className="bg-[var(--brand-color)]/10 text-[var(--brand-color)] border-none font-bold text-[10px] tracking-widest uppercase py-1">
              {filteredUsers.length} total
            </Badge>
          </div>
          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[var(--brand-color)] transition-colors" size={18} />
            <Input
              placeholder="Search user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-11 rounded-xl border-slate-100 bg-white focus:ring-[var(--brand-color)]/10"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4 p-8">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-6">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <Skeleton className="h-6 flex-1" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-10">
            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-6">
              <UsersIcon size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-['Sen']">No user records found</h3>
            <p className="text-slate-500 max-w-[320px] mt-2 font-medium">Add your first user to grant them access to the Nexa AI chat interface for this unit.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow className="border-slate-50">
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest pl-8">Identity & Full name</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Email address</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest">Status</TableHead>
                <TableHead className="font-bold text-slate-400 uppercase text-[10px] tracking-widest text-right pr-8">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user._id} className="group border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="pl-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--brand-color)]/10 text-[var(--brand-color)] flex items-center justify-center font-bold">
                        {user.fullName.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{user.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500 font-medium">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-lg bg-emerald-50 text-emerald-600 border-none font-bold text-[10px] px-3">
                      ACTIVE
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-8">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteUser(user._id)}
                      disabled={isDeleting === user._id}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      {isDeleting === user._id ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

    </div>
  );
};

export default UsersManagement;
