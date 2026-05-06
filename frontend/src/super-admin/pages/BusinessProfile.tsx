import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Building,
  ShieldAlert,
  Palette,
  Image as ImageIcon,
  Loader2,
  Camera,
  Save,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from "@/lib/use-toast";
import { cn } from '@/lib/utils';
import { normalizeHexToRrggbb } from '@/lib/brandCss';

const BusinessProfile: React.FC = () => {
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('branding');

  const [profileData, setProfileData] = useState({
    label: '',
    colorCode: '',
    fullName: '',
    name: '',
    slug: ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialUser = () => {
      const isSuper = window.location.pathname.startsWith('/super-admin');
      const userStr = isSuper
        ? (localStorage.getItem('cpanelUser') || localStorage.getItem('nexa-user'))
        : localStorage.getItem('nexa-user');

      if (userStr && userStr !== "undefined") {
        const parsed = JSON.parse(userStr);
        setUser(parsed);
        setProfileData({
          label: parsed.tenantLabel || '',
          colorCode: normalizeHexToRrggbb(parsed.tenantColor || '#ed0000'),
          fullName: parsed.fullName || '',
          name: parsed.businessUnit || '',
          slug: parsed.tenantSlug || ''
        });
        setLogoPreview(parsed.tenantLogo);
        
        // Ensure color is applied on mount
        if (parsed.tenantColor) {
          document.documentElement.style.setProperty('--brand-color', normalizeHexToRrggbb(parsed.tenantColor));
        }
      }
    };
    loadInitialUser();
  }, []);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Logo too large",
        description: "Logos must be 10 MB or smaller. Please choose a smaller image.",
        variant: "destructive"
      });
      e.target.value = "";
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsUpdatingProfile(true);
      const isSuper = window.location.pathname.startsWith('/super-admin');
      const activeToken = isSuper 
        ? (localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token'))
        : localStorage.getItem('nexa-token');

      if (!activeToken || activeToken === "undefined" || activeToken === "null") {
        console.error("Administrative session fragment missing. Active token state:", { activeToken, isSuper });
        toast({
          title: "Session Expired",
          description: "Your administrative session has timed out. Please refresh or log in again to persist changes.",
          variant: "destructive",
        });
        setIsUpdatingProfile(false);
        return;
      }

      const formData = new FormData();
      formData.append('label', profileData.label);
      formData.append('colorCode', normalizeHexToRrggbb(profileData.colorCode));
      formData.append('fullName', profileData.fullName);
      formData.append('name', profileData.name);
      formData.append('slug', profileData.slug);
      if (logoFile) formData.append('logo', logoFile);

      // Do not set Content-Type manually — FormData needs the multipart boundary axios adds automatically.
      const { data } = await axios.put('/api/v1/admin/auth/profile', formData, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      const updatedUser = {
        ...user,
        fullName: data.admin?.fullName || profileData.fullName,
        businessUnit: data.businessUnit.name,
        tenantLabel: data.businessUnit.label,
        tenantColor: normalizeHexToRrggbb(data.businessUnit.colorCode),
        tenantSlug: data.businessUnit.slug,
        tenantLogo: data.businessUnit.logo
      };
      localStorage.setItem('nexa-user', JSON.stringify(updatedUser));
      // Also update cpanelUser if in super admin context to ensure header and sidebar update immediately
      if (localStorage.getItem('cpanelUser')) {
        localStorage.setItem('cpanelUser', JSON.stringify(updatedUser));
      }
      
      document.documentElement.style.setProperty(
        '--brand-color',
        normalizeHexToRrggbb(data.businessUnit.colorCode)
      );

      // Dispatch event to update SuperAdminMain.tsx header
      window.dispatchEvent(new CustomEvent('nexa-profile-update'));

      toast({
        title: "Configuration Saved",
        description: "Your administrative profile is now synchronized.",
      });

      setUser(updatedUser);
      setLogoPreview(data.businessUnit.logo);
    } catch (error: any) {
      console.error("Profile update failed:", {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.config?.headers
      });
      toast({
        title: "Communication Error",
        description: error.response?.data?.error || "Failed to persist branding changes to the infrastructure.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Your new passwords do not match the confirmation entry.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsChangingPassword(true);
      const isSuper = window.location.pathname.startsWith('/super-admin');
      const activeToken = isSuper 
        ? (localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token'))
        : localStorage.getItem('nexa-token');
      
      await axios.put('/api/v1/admin/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });

      toast({
        title: "Security Updated",
        description: "Your administrative password has been successfully rotated.",
      });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast({
        title: "Authentication Failed",
        description: error.response?.data?.error || "Failed to update security credentials on the infrastructure.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-14 w-48 rounded-2xl" />
          <Skeleton className="h-14 w-48 rounded-2xl" />
        </div>
        <Card className="p-10 rounded-[2rem] border-none shadow-xl">
          <div className="flex gap-12">
            <Skeleton className="w-40 h-40 rounded-[2.5rem]" />
            <div className="flex-1 space-y-8">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-40 rounded-2xl mt-auto self-end" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-8 pb-20 animate-in fade-in duration-700">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-['Sen']">Profile Settings</h1>
        <p className="text-slate-500 font-medium mt-1">Configure your environment branding and security parameters.</p>
      </div>

      <Tabs defaultValue="branding" className="space-y-8" onValueChange={setActiveTab}>
        <TabsList className="grid h-auto w-full min-w-0 max-w-full grid-cols-1 gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-2 sm:gap-2">
          <TabsTrigger
            value="branding"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm sm:h-12 sm:py-0"
          >
            <Palette size={18} className="shrink-0" />
            <span className="min-w-0 sm:hidden">Organization</span>
            <span className="hidden min-w-0 sm:inline">Organization identity</span>
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold data-[state=active]:bg-red-600 data-[state=active]:text-white data-[state=active]:shadow-sm sm:h-12 sm:py-0"
          >
            <Lock size={18} className="shrink-0" />
            <span className="min-w-0 sm:hidden">Security</span>
            <span className="hidden min-w-0 sm:inline">Security credentials</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="animate-in fade-in slide-in-from-top-2 duration-300 outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white overflow-hidden">
                <CardHeader className="p-10 border-b border-slate-50">
                  <CardTitle className="text-2xl font-black font-['Sen']">Theme & visuals</CardTitle>
                  <CardDescription className="text-slate-400 font-medium text-sm">Define how your platform appears to your business unit users.</CardDescription>
                </CardHeader>
                <CardContent className="p-10">
                  <form onSubmit={updateProfile} className="space-y-10">
                    <div className="flex flex-col md:flex-row gap-12 items-center md:items-start">
                      <div className="flex flex-col items-center gap-4">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Business logo</label>
                        <div className="relative group">
                          <div className="w-40 h-40 rounded-[2.5rem] bg-slate-50 border-4 border-white shadow-xl flex items-center justify-center overflow-hidden transition-all group-hover:scale-[1.02]">
                            {logoPreview ? (
                              <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-4" />
                            ) : (
                              <Building className="text-slate-200" size={60} />
                            )}
                          </div>
                          <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl cursor-pointer hover:bg-slate-800 active:scale-95 transition-all">
                            <Camera size={20} />
                            <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                          </label>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">Recommended: 512x512px</p>
                      </div>

                      <div className="flex-1 space-y-8 w-full mt-4">
                        <div className="space-y-3">
                          <label className="text-sm font-bold text-slate-700 ml-1">Admin identity name</label>
                          <Input
                            value={profileData.fullName}
                            onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                            className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-bold text-slate-900 focus:ring-[var(--brand-color)]/10 focus:border-[var(--brand-color)]"
                            placeholder="e.g. Abiola Azeez"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                          <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 ml-1">Business label</label>
                            <Input
                              value={profileData.label}
                              onChange={(e) => setProfileData({ ...profileData, label: e.target.value })}
                              className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-bold text-slate-900 focus:ring-[var(--brand-color)]/10 focus:border-[var(--brand-color)]"
                              placeholder="e.g. United Facilities Ltd"
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 ml-1">Business acronym</label>
                            <Input
                              value={profileData.name}
                              onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                              className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-bold text-slate-900 focus:ring-[var(--brand-color)]/10 focus:border-[var(--brand-color)]"
                              placeholder="e.g. UFL"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 ml-1">Subdomain slug</label>
                            <Input
                              value={profileData.slug}
                              onChange={(e) => setProfileData({ ...profileData, slug: e.target.value })}
                              className="h-14 rounded-2xl border-slate-100 bg-slate-50 font-bold text-slate-900 focus:ring-slate-900/10 focus:border-slate-900"
                              placeholder="e.g. ufl"
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 ml-1">Theme color hex</label>
                            <div className="flex gap-4">
                              <div className="relative flex-1">
                                <div
                                  className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl border border-black/5 shadow-sm transition-transform hover:scale-110 pointer-events-none"
                                  style={{ backgroundColor: normalizeHexToRrggbb(profileData.colorCode) }}
                                />
                                <Input
                                  value={profileData.colorCode}
                                  onChange={(e) => setProfileData({ ...profileData, colorCode: e.target.value })}
                                  onBlur={() =>
                                    setProfileData((p) => ({ ...p, colorCode: normalizeHexToRrggbb(p.colorCode) }))
                                  }
                                  className="h-14 w-full rounded-2xl border-slate-100 bg-slate-50 font-bold text-slate-900 pl-16 focus:ring-slate-900/10 focus:border-slate-900 text-lg"
                                  placeholder="#ED0000"
                                />
                              </div>
                              <div className="relative group">
                                <Input
                                  type="color"
                                  value={normalizeHexToRrggbb(profileData.colorCode)}
                                  onChange={(e) => setProfileData({ ...profileData, colorCode: e.target.value })}
                                  className="w-14 h-14 p-1 rounded-2xl border-slate-100 cursor-pointer overflow-hidden transition-all group-hover:shadow-md"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-8 border-t border-slate-50">
                      <Button
                        type="submit"
                        disabled={isUpdatingProfile}
                        className="h-14 px-10 rounded-2xl bg-slate-900 text-white font-bold gap-3 shadow-xl active:scale-95 transition-all hover:bg-slate-800"
                      >
                        {isUpdatingProfile ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        Update Organization Identity
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-4 h-full">
              <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-slate-900 text-white p-10 h-full flex flex-col relative overflow-hidden group">
                <div className="relative z-10 space-y-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold font-['Sen']">Standard branding</h3>
                    <p className="text-white/40 text-xs mt-3 leading-relaxed">Changes made here will be reflected across all user interfaces, document headers, and AI response motifs for your business unit.</p>
                  </div>
                </div>
                
                <div className="relative z-10 mt-auto pt-10">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Subdomain access</p>
                    <p className="text-lg font-black text-white tracking-tight">{user?.tenantSlug || 'standard'}.nexa.ai</p>
                  </div>
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[100px] -mr-32 -mt-32 group-hover:scale-110 transition-transform duration-700" />
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="animate-in fade-in slide-in-from-bottom-2 duration-300 outline-none">
          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white overflow-hidden max-w-3xl">
            <CardHeader className="p-10 border-b border-red-50 bg-red-50/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-red-200">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black font-['Sen'] text-slate-900Line">Security credentials</CardTitle>
                  <CardDescription className="text-red-600/70 font-bold text-xs uppercase tracking-widest mt-1">Administrative control zone</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              <form onSubmit={changePassword} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-sm font-bold text-slate-700 ml-1">Current access password</label>
                  <Input
                    type="password"
                    required
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="h-14 rounded-2xl border-red-100 bg-red-50/30 font-bold text-slate-900 focus:ring-red-200 focus:border-red-400"
                    placeholder="••••••••"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 ml-1">New pin code</label>
                    <Input
                      type="password"
                      required
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      className="h-14 rounded-2xl border-red-100 bg-red-50/30 font-bold text-slate-900 focus:ring-red-200 focus:border-red-400"
                      placeholder="Min. 6 chars"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-slate-700 ml-1">Confirm new pin</label>
                    <Input
                      type="password"
                      required
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      className="h-14 rounded-2xl border-red-100 bg-red-50/30 font-bold text-slate-900 focus:ring-red-200 focus:border-red-400"
                      placeholder="Repeat pin"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-red-50 mt-10">
                  <Button
                    type="submit"
                    disabled={isChangingPassword}
                    className="h-14 px-10 rounded-2xl bg-red-600 text-white font-bold gap-3 shadow-xl shadow-red-200 active:scale-95 transition-all hover:bg-red-700"
                  >
                    {isChangingPassword ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} />}
                    Update security credentials
                  </Button>
                  <p className="text-[10px] text-slate-400 mt-4 font-medium flex items-center gap-2">
                    <AlertCircle size={12} className="text-rose-500" />
                    Rotating your password frequently enhances your administrative infrastructure security.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessProfile;
