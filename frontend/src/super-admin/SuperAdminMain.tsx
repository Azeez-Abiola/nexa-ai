import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import {
  Building2,
  Users,
  ShieldCheck,
  Globe,
  Inbox,
  Layers,
  LayoutDashboard,
  LogOut,
  UserCircle,
  ChevronRight,
  BookOpen,
  Network,
  BarChart3,
  HelpCircle,
  Shield,
  Settings,
  Moon,
  Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import AccessRequests from './pages/AccessRequests';
import Departments from './pages/Departments';
import DepartmentDetail from './pages/DepartmentDetail';
import ForceChangePasswordModal from './components/ForceChangePasswordModal';
import NotificationsBell from './components/NotificationsBell';
import EmailDomains from './pages/EmailDomains';
import AuditLogs from './pages/AuditLogs';
import HelpSupport from './pages/HelpSupport';
import UsersManagement from './pages/UsersManagement';
import BusinessProfile from './pages/BusinessProfile';
import AdminUserGroupsPage from './pages/AdminUserGroupsPage';
import Analytics from './pages/Analytics';
import { hexToHslSpace, DEFAULT_RING_HSL } from '@/lib/brandCss';
import { ChatGptStyleMenuIcon } from '@/components/ChatGptStyleMenuIcon';

interface SuperAdminMainProps {
  theme?: 'light' | 'dark';
  toggleTheme?: () => void;
}

const SuperAdminMain: React.FC<SuperAdminMainProps> = ({ theme, toggleTheme }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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
          const brandHex = userData.tenantColor || '#ed0000';
          document.documentElement.style.setProperty('--brand-color', brandHex);
          if (isSuper) {
            document.documentElement.style.setProperty('--ring', DEFAULT_RING_HSL);
            document.documentElement.style.setProperty('--sidebar-ring', DEFAULT_RING_HSL);
            document.documentElement.style.setProperty('--primary', DEFAULT_RING_HSL);
            document.documentElement.style.setProperty('--accent', '0 85% 38%');
            document.documentElement.style.setProperty('--accent-foreground', '0 0% 100%');
          } else {
            const ring = hexToHslSpace(brandHex);
            document.documentElement.style.setProperty('--ring', ring);
            document.documentElement.style.setProperty('--sidebar-ring', ring);
            document.documentElement.style.setProperty('--primary', ring);
            document.documentElement.style.setProperty('--accent', ring);
            document.documentElement.style.setProperty('--accent-foreground', '0 0% 100%');
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
    { name: 'Access requests', path: '/super-admin/access-requests', icon: Inbox },
    { name: 'Analytics', path: '/super-admin/analytics', icon: BarChart3 },
    { name: 'Administration', path: '/super-admin/management', icon: ShieldCheck },
    { name: 'Email domains', path: '/super-admin/domains', icon: Globe },
  ] : [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Knowledge Base', path: '/admin/knowledge', icon: BookOpen },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Departments', path: '/admin/departments', icon: Layers },
    { name: 'User groups', path: '/admin/user-groups', icon: Network },
    { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { name: 'Audit Logs', path: '/admin/audit', icon: Shield },
    { name: 'Help & Support', path: '/admin/help', icon: HelpCircle },
    { name: 'My Profile', path: '/admin/profile', icon: Settings },
  ];

  const currentPath = location.pathname;
  const pageTitle = menuItems.find(i => i.path === currentPath)?.name || (isSuperAdminContext ? 'Super Admin' : 'Dashboard');

  const goNav = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  return (
    <div className={cn(
      "flex h-[100dvh] min-h-0 w-full max-w-full overflow-x-hidden font-['Sen', 'Inter', system-ui, sans-serif] transition-colors duration-300",
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
              {menuItems.slice(0, isSuperAdminContext ? 3 : 5).map((item) => (
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
              {menuItems.slice(isSuperAdminContext ? 3 : 5).map((item) => (
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
          {toggleTheme ? (
            <button
              type="button"
              onClick={() => toggleTheme()}
              className={cn(
                "mb-2 w-full flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors",
                !isSidebarOpen && "justify-center px-2",
                theme === 'dark'
                  ? "text-gray-400 hover:bg-[#333] hover:text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              {theme === 'light' ? <Moon size={18} strokeWidth={2} /> : <Sun size={18} strokeWidth={2} />}
              {isSidebarOpen && <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl hover:text-[var(--brand-color)] transition-all duration-300 group",
              !isSidebarOpen && "justify-center px-2",
              theme === 'dark'
                ? "text-gray-400 hover:bg-[#333] hover:shadow-none"
                : "text-slate-500 hover:bg-white hover:shadow-sm"
            )}
          >
            <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
            {isSidebarOpen && <span className="font-bold text-sm">Sign out</span>}
          </button>
        </div>

      </aside>

      {/* Sheet controls mobile nav; SheetContent is a sibling of main so nested page Sheets do not break the tree */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header — mobile: compact title row + tappable menu; desktop: centered brand */}
        <header
          className={cn(
            "relative z-[70] isolate shrink-0 border-b backdrop-blur-md transition-colors duration-300",
            theme === 'dark' ? "border-[#333] bg-[#1a1a1a]/90" : "border-slate-200 bg-white/80"
          )}
        >
          {/* Mobile */}
          <div className="flex min-h-[3.25rem] items-center gap-2 px-2.5 py-2 md:hidden">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "relative z-[80] h-11 w-11 shrink-0 touch-manipulation rounded-xl",
                theme === 'dark' ? "text-gray-200 hover:bg-[#333]" : "text-slate-700 hover:bg-slate-100"
              )}
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <ChatGptStyleMenuIcon size={22} />
            </Button>
            <div className="min-w-0 flex-1 overflow-hidden pr-1">
              <p className={cn("truncate text-[10px] font-semibold uppercase tracking-wide", theme === 'dark' ? "text-gray-500" : "text-slate-400")}>
                Pages <span className="mx-1 opacity-50">·</span> {pageTitle}
              </p>
              <p className={cn("mt-0.5 truncate text-sm font-bold leading-tight", theme === 'dark' ? "text-gray-100" : "text-slate-900")}>
                {isSuperAdminContext ? "Nexa AI" : (user?.tenantLabel || user?.businessUnit || "Admin")}
              </p>
            </div>
            <NotificationsBell isDark={theme === 'dark'} />
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                theme === 'dark'
                  ? "border-[#3f3f3f] bg-[#333] text-gray-400"
                  : "border-slate-200 bg-slate-50 text-slate-400"
              )}
              aria-hidden
            >
              <UserCircle size={22} strokeWidth={1.5} />
            </div>
          </div>

          {/* Desktop */}
          <div className="relative hidden min-h-[5rem] items-center justify-between px-6 py-3 lg:px-10 md:flex">
            <div className="flex min-w-0 flex-1 items-center gap-6">
              <div className="flex min-w-0 items-center gap-3 text-xs font-semibold">
                <span className={theme === 'dark' ? "text-gray-500" : "text-slate-400"}>Pages</span>
                <ChevronRight size={12} className={cn("shrink-0", theme === 'dark' ? "text-gray-600" : "text-slate-300")} />
                <span className={cn("truncate font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>{pageTitle}</span>
              </div>
            </div>

            <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5">
              {isSuperAdminContext ? (
                <>
                  <img src="/1879-22.png" alt="" className="h-8 w-8 object-contain" width={32} height={32} />
                  <span className={cn("whitespace-nowrap font-['Sen'] text-xl font-black tracking-tight", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    Nexa.Ai
                  </span>
                </>
              ) : user?.tenantLogo ? (
                <img
                  src={user.tenantLogo.startsWith('http') ? user.tenantLogo : `${import.meta.env.VITE_API_URL || ''}/logos/${user.tenantLogo.replace(/^\/logos\//, '')}`}
                  alt={user?.tenantLabel || user?.businessUnit || ''}
                  className="h-10 w-10 object-contain"
                  width={40}
                  height={40}
                />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
              <div className="hidden text-right sm:block">
                {user?.tenantLabel && !isSuperAdminContext && (
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--brand-color)]">{user.tenantLabel}</p>
                )}
                <p className={cn("text-sm font-bold leading-none", theme === 'dark' ? "text-white" : "text-slate-900")}>{user?.fullName || user?.email}</p>
              </div>
              <NotificationsBell isDark={theme === 'dark'} />
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-colors",
                  theme === 'dark'
                    ? "border-[#3f3f3f] bg-[#333] text-gray-400"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                )}
                aria-hidden
              >
                <UserCircle size={26} strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </header>

        {/* Content: scrollable pages + fixed footer strip */}
        <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
          <div
            className={cn(
              "flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 md:p-10 transition-colors duration-300",
              theme === 'dark' ? "bg-[#242424]" : "bg-slate-50/50"
            )}
          >
            <Routes>
              {!isSuperAdminContext ? (
                <>
                  <Route path="/admin/dashboard" element={<Dashboard />} />
                  <Route path="/admin/access-requests" element={<Navigate to="/super-admin/access-requests" replace />} />
                  <Route path="/admin/analytics" element={<Analytics />} />
                  <Route path="/admin/knowledge" element={<KnowledgeBase />} />
                  <Route path="/admin/user-groups" element={<AdminUserGroupsPage />} />
                  <Route path="/admin/knowledge-groups" element={<Navigate to="/admin/user-groups" replace />} />
                  <Route path="/admin/users" element={<UsersManagement />} />
                  <Route path="/admin/departments" element={<Departments />} />
                  <Route path="/admin/departments/:id" element={<DepartmentDetail />} />
                  <Route path="/admin/audit" element={<AuditLogs />} />
                  <Route path="/admin/help" element={<HelpSupport />} />
                  <Route path="/admin/profile" element={<BusinessProfile />} />
                  <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                </>
              ) : (
                <>
                  <Route path="/super-admin/dashboard" element={<Dashboard />} />
                  <Route path="/super-admin/analytics" element={<Analytics />} />
                  <Route path="/super-admin/tenants" element={<Tenants />} />
                  <Route path="/super-admin/access-requests" element={<AccessRequests />} />
                  <Route path="/super-admin/knowledge" element={<Navigate to="/super-admin/dashboard" replace />} />
                  <Route path="/super-admin/user-groups" element={<Navigate to="/super-admin/tenants" replace />} />
                  <Route path="/super-admin/knowledge-groups" element={<Navigate to="/super-admin/tenants" replace />} />
                  <Route path="/super-admin/management" element={<Administration />} />
                  <Route path="/super-admin/domains" element={<EmailDomains />} />
                  <Route path="/super-admin/directory" element={<Navigate to="/super-admin/tenants?tab=registered" replace />} />
                  <Route path="*" element={<Navigate to="/super-admin/dashboard" replace />} />
                </>
              )}
            </Routes>
          </div>
          <div
            className={cn(
              "shrink-0 flex flex-wrap items-center justify-center gap-2 py-4 px-6 text-[11px] font-bold border-t",
              theme === 'dark' ? "border-[#333] bg-[#1a1a1a] text-gray-500" : "border-slate-200 bg-white text-slate-500"
            )}
          >
            <img src="/1879-22.png" alt="" className="w-5 h-5 object-contain opacity-90" width={20} height={20} />
            <span>Powered by 1879 Tech Hub</span>
          </div>
          <Toaster />
        </div>
      </main>

      <SheetContent
            side="left"
            className={cn(
              "flex h-full w-[min(100%,20rem)] max-w-full flex-col gap-0 border-r p-0 sm:max-w-sm",
              theme === 'dark' ? "border-[#333] bg-[#1a1a1a]" : "border-slate-200 bg-white"
            )}
          >
            <SheetHeader className={cn("border-b p-6 text-left", theme === 'dark' ? "border-[#333]" : "border-slate-100")}>
              <div className="flex items-center gap-3">
                <div className={cn("flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border p-2 shadow-sm", theme === 'dark' ? "border-[#3f3f3f] bg-[#2a2a2a]" : "border-slate-100 bg-white")}>
                  {user?.tenantLogo ? (
                    <img
                      src={user.tenantLogo.startsWith('http') ? user.tenantLogo : `${import.meta.env.VITE_API_URL || ''}/logos/${user.tenantLogo.replace(/^\/logos\//, '')}`}
                      alt=""
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/1879-22.png";
                      }}
                    />
                  ) : (
                    <img src="/1879-22.png" alt="" className="h-full w-full object-contain" />
                  )}
                </div>
                <div className="min-w-0">
                  <SheetTitle className={cn("text-left font-['Sen'] text-lg font-bold", theme === 'dark' ? "text-white" : "text-slate-900")}>
                    {isSuperAdminContext ? 'Nexa AI' : (user?.tenantLabel || user?.businessUnit || 'Admin')}
                  </SheetTitle>
                  <p className={cn("text-xs font-semibold", theme === 'dark' ? "text-gray-500" : "text-slate-400")}>
                    {isSuperAdminContext ? 'Super Admin' : 'Business admin'}
                  </p>
                </div>
              </div>
            </SheetHeader>
            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4">
              {menuItems.map((item) => {
                const active = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => goNav(item.path)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-colors",
                      active
                        ? "bg-[color-mix(in_srgb,var(--brand-color)_14%,transparent)] text-[var(--brand-color)]"
                        : theme === 'dark'
                          ? "text-gray-400 hover:bg-[#333] hover:text-white"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <item.icon size={20} className={cn("shrink-0", active ? "text-[var(--brand-color)]" : "")} />
                    {item.name}
                  </button>
                );
              })}
            </nav>
            <div className={cn("mt-auto border-t p-4", theme === 'dark' ? "border-[#333]" : "border-slate-100")}>
              {toggleTheme ? (
                <button
                  type="button"
                  onClick={() => toggleTheme()}
                  className={cn(
                    "mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition-colors",
                    theme === 'dark' ? "text-gray-400 hover:bg-[#333] hover:text-white" : "text-slate-600 hover:bg-slate-50"
                  )}
                  aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                >
                  {theme === 'light' ? <Moon size={20} strokeWidth={2} /> : <Sun size={20} strokeWidth={2} />}
                  {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setMobileNavOpen(false);
                  setShowLogoutConfirm(true);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-colors",
                  theme === 'dark' ? "text-gray-400 hover:bg-[#333] hover:text-white" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                <LogOut size={20} />
                Sign out
              </button>
            </div>
          </SheetContent>
      </Sheet>

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

      <ForceChangePasswordModal
        open={!!user && user.mustChangePassword === true}
        onSuccess={() => {
          setUser((prev: any) => (prev ? { ...prev, mustChangePassword: false } : prev));
        }}
      />
    </div>
  );
};

const SidebarItem = ({ item, currentPath, isSidebarOpen, user, isDark, onClick }: any) => {
  const isActive = currentPath === item.path;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors duration-200 group relative",
        "outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 ring-0 ring-offset-0",
        isActive
          ? "text-[var(--brand-color)] bg-[color-mix(in_srgb,var(--brand-color)_12%,transparent)] font-semibold"
          : isDark
            ? "text-gray-400 hover:bg-[#333] hover:text-white"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <item.icon
        size={20}
        className={cn(
          "transition-colors shrink-0",
          isActive
            ? "text-[var(--brand-color)]"
            : isDark
              ? "text-gray-500 group-hover:text-white"
              : "text-slate-400 group-hover:text-slate-900"
        )}
      />
      {isSidebarOpen && <span className="font-bold text-sm transition-colors">{item.name}</span>}
      {isActive && !isSidebarOpen && (
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full bg-[var(--brand-color)]"
        />
      )}
    </button>
  );
};

export default SuperAdminMain;
