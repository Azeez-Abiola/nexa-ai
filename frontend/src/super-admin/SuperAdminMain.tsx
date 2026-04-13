import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import {
  Building2,
  Users,
  ShieldCheck,
  Globe,
  LayoutDashboard,
  LogOut,
  UserCircle,
  FolderOpen,
  Menu,
  ChevronRight,
  AlertCircle,
  Loader2,
  X,
  Mail,
  Building,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Toaster } from "@/components/ui/toaster";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import KnowledgeBase from './pages/KnowledgeBase';
import Administration from './pages/Administration';
import EmailDomains from './pages/EmailDomains';
import Directory from './pages/Directory';
import AuditLogs from './pages/AuditLogs';
import HelpSupport from './pages/HelpSupport';
import UsersManagement from './pages/UsersManagement';
import BusinessProfile from './pages/BusinessProfile';
import { HelpCircle, Shield, Sun, Moon, Settings } from 'lucide-react';

interface SuperAdminMainProps {
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

const SuperAdminMain: React.FC<SuperAdminMainProps> = ({ theme, toggleTheme }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const isSuper = location.pathname.startsWith('/super-admin');

    const loadUserData = () => {
      const token = isSuper
        ? (localStorage.getItem('cpanelToken') || localStorage.getItem('nexa-token'))
        : localStorage.getItem('nexa-token');
      const userStr = isSuper
        ? (localStorage.getItem('cpanelUser') || localStorage.getItem('nexa-user'))
        : localStorage.getItem('nexa-user');

      if (token && userStr && userStr !== "undefined") {
        try {
          const userData = JSON.parse(userStr);
          setUser(userData);
          // Set dynamic brand color from tenant data
          if (userData.tenantColor) {
            document.documentElement.style.setProperty('--brand-color', userData.tenantColor);
          } else {
            document.documentElement.style.setProperty('--brand-color', '#ed0000');
          }
        } catch (err) {
          console.error("Invalid session data:", err);
          handleLogout();
        }
      } else {
        handleLogout();
      }
    };

    loadUserData();

    // Refresh user data when profile is updated in BusinessProfile.tsx
    window.addEventListener('nexa-profile-update', loadUserData);
    return () => window.removeEventListener('nexa-profile-update', loadUserData);
  }, [location.pathname]);

  const handleLogout = () => {
    if (location.pathname.startsWith('/super-admin')) {
      localStorage.removeItem('cpanelToken');
      localStorage.removeItem('cpanelUser');
      window.location.href = '/super-admin/login';
    } else {
      localStorage.removeItem('nexa-token');
      localStorage.removeItem('nexa-user');
      window.location.href = '/login';
    }
  };

  const isSuperAdmin = user?.businessUnit === 'SUPERADMIN';
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isSuperAdminContext = location.pathname.startsWith('/super-admin');
  const pathPrefix = isSuperAdminContext ? '/super-admin' : '/admin';

  const menuItems = isSuperAdminContext ? [
    { name: 'Dashboard', path: '/super-admin/dashboard', icon: LayoutDashboard },
    { name: 'Tenants', path: '/super-admin/tenants', icon: Building2 },
    { name: 'Administration', path: '/super-admin/management', icon: ShieldCheck },
    { name: 'Email domains', path: '/super-admin/domains', icon: Globe },
    { name: 'Registered BU', path: '/super-admin/directory', icon: FolderOpen },
  ] : [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Knowledge Base', path: '/admin/knowledge', icon: BookOpen },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Audit Logs', path: '/admin/audit', icon: Shield },
    { name: 'Help & Support', path: '/admin/help', icon: HelpCircle },
    { name: 'My Profile', path: '/admin/profile', icon: Settings },
  ];

  const currentPath = location.pathname;

  return (
    <div className={cn(
      "flex h-screen font-['Inter', 'Sen', sans-serif] transition-colors duration-300",
      theme === 'dark' ? 'admin-dark' : 'bg-white'
    )}>
      {/* Sidebar - Desktop */}
      <aside className={cn(
        "hidden md:flex flex-col transition-all duration-300",
        isSidebarOpen ? "w-64" : "w-24",
        theme === 'dark'
          ? "bg-[#1a1a1a] border-r border-[#333]"
          : "bg-white border-r border-slate-200"
      )}>
        <div className="p-8 flex items-center gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center p-2 shadow-sm overflow-hidden border",
            theme === 'dark' ? "bg-[#2a2a2a] border-[#3f3f3f]" : "bg-white border-slate-100"
          )}>
            {user?.tenantLogo ? (
              <img
                src={user.tenantLogo.startsWith('http') ? user.tenantLogo : `${import.meta.env.VITE_API_URL || ''}/logos/${user.tenantLogo.replace(/^\/logos\//, '')}`}
                alt="Tenant Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/1879-22.png";
                }}
              />
            ) : (
              <img src="/1879-22.png" alt="1879 Logo" className="w-full h-full object-contain" />
            )}
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col">
              <span className={cn("font-bold text-base leading-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
                {isSuperAdminContext
                  ? 'Nexa AI'
                  : (user?.tenantLabel || user?.businessUnit || 'Admin Portal')}
              </span>
              <span className={cn("text-[10px] font-bold tracking-normal mt-0.5", theme === 'dark' ? "text-gray-600" : "text-slate-400")}>
                {isSuperAdminContext ? 'Super Admin' : 'Business admin'}
              </span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-8 mt-4">
          <div>
            {isSidebarOpen && <p className={cn("px-4 text-[10px] tracking-[0.05em] font-bold mb-4", theme === 'dark' ? "text-gray-600" : "text-slate-400")}>Core management</p>}
            <div className="space-y-1.5">
              {menuItems.slice(0, isSuperAdminContext ? 3 : 2).map((item) => (
                <SidebarItem
                  key={item.name}
                  item={item}
                  currentPath={currentPath}
                  isSidebarOpen={isSidebarOpen}
                  user={user}
                  isDark={theme === 'dark'}
                  onClick={() => navigate(item.path)}
                />
              ))}
            </div>
          </div>

          <div>
            {isSidebarOpen && <p className={cn("px-4 text-[10px] tracking-[0.05em] font-bold mb-4", theme === 'dark' ? "text-gray-600" : "text-slate-400")}>System settings</p>}
            <div className="space-y-1.5">
              {menuItems.slice(isSuperAdminContext ? 3 : 2).map((item) => (
                <SidebarItem
                  key={item.name}
                  item={item}
                  currentPath={currentPath}
                  isSidebarOpen={isSidebarOpen}
                  user={user}
                  isDark={theme === 'dark'}
                  onClick={() => navigate(item.path)}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className={cn(
          "p-6 border-t",
          theme === 'dark' ? "border-[#333] bg-[#1a1a1a]" : "border-slate-100 bg-slate-50/50"
        )}>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:text-[var(--brand-color)] transition-all duration-300 group",
              theme === 'dark'
                ? "text-gray-400 hover:bg-[#333] hover:shadow-none"
                : "text-slate-500 hover:bg-white hover:shadow-sm"
            )}
          >
            <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
            {isSidebarOpen && <span className="font-bold text-sm">Sign out</span>}
          </button>
        </div>

        <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
          <AlertDialogContent className={cn(
            "rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden sm:max-w-md",
            theme === 'dark' ? "bg-[#2a2a2a]" : "bg-white"
          )}>
            <div className="p-10 pb-2">
              <AlertDialogHeader>
                <AlertDialogTitle className={cn("text-2xl font-black font-['Sen']", theme === 'dark' ? "text-white" : "text-slate-900")}>End your session?</AlertDialogTitle>
                <AlertDialogDescription className={cn("font-medium leading-relaxed", theme === 'dark' ? "text-gray-400" : "text-slate-500")}>
                  Are you sure you want to sign out of your administrative account?
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
            <AlertDialogFooter className={cn("p-8 pb-10 gap-3 flex-col sm:flex-row", theme === 'dark' ? "bg-[#2a2a2a]" : "bg-white")}>
              <AlertDialogCancel className={cn(
                "rounded-xl h-12 font-bold border-none transition-all flex-1",
                theme === 'dark' ? "text-gray-400 bg-[#333] hover:bg-[#3f3f3f] hover:text-white" : "text-slate-500 bg-slate-50 hover:bg-slate-100 hover:text-slate-900"
              )}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleLogout}
                className={cn(
                  "rounded-xl h-12 text-white font-bold px-8 active:scale-95 transition-all flex-1",
                  theme === 'dark' ? "bg-white/10 hover:bg-white/20 shadow-none" : "bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200"
                )}
              >
                Sign out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className={cn(
          "h-20 backdrop-blur-md flex items-center justify-between px-10 z-20 transition-colors duration-300",
          theme === 'dark'
            ? "bg-[#1a1a1a]/90 border-b border-[#333]"
            : "bg-white/80 border-b border-slate-200"
        )}>
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu size={20} />
            </Button>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className={theme === 'dark' ? "text-gray-500" : "text-slate-400"}>Pages</span>
              <ChevronRight size={12} className={theme === 'dark' ? "text-gray-600" : "text-slate-300"} />
              <span className={cn("font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{menuItems.find(i => i.path === currentPath)?.name || (isSuperAdminContext ? 'Super Admin' : 'Dashboard')}</span>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2.5">
            <img src="/1879-22.png" alt="1879" className="w-8 h-8 object-contain" />
            <span className={cn(
              "text-xl font-black font-['Sen'] tracking-tight",
              theme === 'dark' ? "text-white" : "text-slate-900"
            )}>Nexa.Ai</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => toggleTheme?.()}
                className={cn(
                  "w-10 h-10 rounded-xl",
                  theme === 'dark' ? "hover:bg-[#333] text-gray-400" : "hover:bg-slate-100 text-slate-500"
                )}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </Button>
            </div>

            <div className="text-right hidden sm:block">
              {user?.tenantLabel && !isSuperAdminContext && (
                <p className="text-[10px] font-black text-[var(--brand-color)] uppercase tracking-widest mb-1.5">{user.tenantLabel}</p>
              )}
              <p className={cn("text-sm font-bold leading-none", theme === 'dark' ? "text-white" : "text-slate-900")}>{user?.fullName || user?.email}</p>
            </div>
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center hover:text-[var(--brand-color)] hover:border-[var(--brand-color)]/20 transition-all cursor-pointer",
              theme === 'dark'
                ? "bg-[#333] border border-[#3f3f3f] text-gray-400"
                : "bg-slate-50 border border-slate-200 text-slate-400"
            )}>
              <UserCircle size={26} strokeWidth={1.5} />
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={cn(
          "flex-1 overflow-y-auto p-10 transition-colors duration-300",
          theme === 'dark' ? "bg-[#242424]" : "bg-slate-50/50"
        )}>
          <Routes>
            {/* Business Admin Routes - Only accessible if NOT super admin */}
            {!isSuperAdminContext ? (
              <>
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin/knowledge" element={<KnowledgeBase />} />
                <Route path="/admin/users" element={<UsersManagement />} />
                <Route path="/admin/audit" element={<AuditLogs />} />
                <Route path="/admin/help" element={<HelpSupport />} />
                <Route path="/admin/profile" element={<BusinessProfile />} />
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </>
            ) : (
              <>
                {/* Super Admin Routes */}
                <Route path="/super-admin/dashboard" element={<Dashboard />} />
                <Route path="/super-admin/tenants" element={<Tenants />} />
                <Route path="/super-admin/management" element={<Administration />} />
                <Route path="/super-admin/domains" element={<EmailDomains />} />
                <Route path="/super-admin/directory" element={<Directory />} />
                <Route path="*" element={<Navigate to="/super-admin/dashboard" replace />} />
              </>
            )}
          </Routes>
          <Toaster />
        </div>
      </main>
    </div>
  );
};

const SidebarItem = ({ item, currentPath, isSidebarOpen, user, isDark, onClick }: any) => {
  const isActive = currentPath === item.path;
  const brandColor = getComputedStyle(document.documentElement).getPropertyValue('--brand-color').trim() || '#ed0000';
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group relative",
        isActive
          ? "bg-opacity-10 shadow-sm ring-1"
          : isDark
            ? "text-gray-400 hover:bg-[#333] hover:text-white"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
        isActive && (isDark ? "ring-[#3f3f3f]" : "ring-slate-100")
      )}
      style={isActive ? { 
        backgroundColor: `${brandColor}15`,
        color: brandColor,
      } : {}}
    >
      <item.icon 
        size={20} 
        className={cn("transition-colors", isActive ? "text-current" : isDark ? "text-gray-500 group-hover:text-white" : "text-slate-400 group-hover:text-slate-900")}
        style={isActive ? { color: brandColor } : {}}
      />
      {isSidebarOpen && <span className="font-bold text-sm transition-colors">{item.name}</span>}
      {isActive && !isSidebarOpen && (
        <div 
          className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full"
          style={{ backgroundColor: brandColor }}
        />
      )}
    </button>
  );
};

const Loader2 = ({ className, size }: { className?: string, size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size || 24}
    height={size || 24}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("animate-spin", className)}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default SuperAdminMain;
