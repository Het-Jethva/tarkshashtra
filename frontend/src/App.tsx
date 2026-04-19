import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import { api } from './api';
import { getErrorMessage } from './lib/errors';
import type { CurrentUser, Permission } from './types';
import { hasPermission, roleInitials } from './rbac';
import { CustomerIntake } from './pages/CustomerIntake';
import { ExecutiveIntake } from './pages/ExecutiveIntake';
import { Dashboard } from './pages/Dashboard';
import { ComplaintQueue } from './pages/ComplaintQueue';
import { ComplaintDetails } from './pages/ComplaintDetails';
import { QaDashboard } from './pages/QaDashboard';
import { ReportsPage } from './pages/ReportsPage';
import { LandingPage } from './pages/LandingPage';
import { LayoutDashboard, Inbox, FilePlus2, Megaphone } from 'lucide-react';

function getDefaultAdminRoute(user: CurrentUser): string {
  if (user.role === 'quality_assurance' && hasPermission(user, 'dashboard:read')) {
    return '/admin/qa-trends';
  }

  if (user.role === 'operations_manager' && hasPermission(user, 'dashboard:read')) {
    return '/admin/dashboard';
  }

  if (hasPermission(user, 'dashboard:read')) {
    return '/admin/dashboard';
  }

  if (hasPermission(user, 'complaints:read')) {
    return '/admin/complaints';
  }

  if (hasPermission(user, 'complaints:create')) {
    return '/admin/complaints/new';
  }

  return '/';
}

function AccessDenied({ user, requiredPermission }: { user: CurrentUser; requiredPermission: Permission }) {
  const fallbackPath = getDefaultAdminRoute(user);

  return (
    <div className="max-w-xl mx-auto pt-20 px-6">
      <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-8 text-red-900 shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Access Restricted</h1>
        <p className="mt-2 text-sm text-red-700/80">
          Your current role (<span className="font-medium text-red-900">{user.roleLabel}</span>) does not have the required permissions
          <span className="font-mono bg-red-100/50 px-1.5 py-0.5 rounded ml-1 text-xs"> {requiredPermission}</span>.
        </p>
        <Link to={fallbackPath} className="mt-6 inline-block text-sm font-medium text-red-700 hover:text-red-900 hover:underline transition-colors">
          Return to allowed workspace &rarr;
        </Link>
      </div>
    </div>
  );
}

function RequirePermission({
  user,
  permission,
  children,
}: {
  user: CurrentUser;
  permission: Permission;
  children: ReactNode;
}) {
  if (!hasPermission(user, permission)) {
    return <AccessDenied user={user} requiredPermission={permission} />;
  }

  return <>{children}</>;
}

function canAccessAdminPath(user: CurrentUser, pathname: string): boolean {
  if (pathname === '/admin') {
    return true;
  }

  if (pathname.startsWith('/admin/dashboard')) {
    return user.role === 'operations_manager' && hasPermission(user, 'dashboard:read');
  }

  if (pathname.startsWith('/admin/qa-trends')) {
    return user.role === 'quality_assurance' && hasPermission(user, 'dashboard:read');
  }

  if (pathname.startsWith('/admin/reports')) {
    return hasPermission(user, 'reports:export');
  }

  if (pathname.startsWith('/admin/complaints/new')) {
    return hasPermission(user, 'complaints:create');
  }

  if (pathname.startsWith('/admin/complaints')) {
    return hasPermission(user, 'complaints:read');
  }

  return false;
}

function AdminLayout({
  user,
  onSwitchRole,
  onSwitchName,
  switchingRole,
}: {
  user: CurrentUser;
  onSwitchRole: (role: CurrentUser['role']) => Promise<void>;
  onSwitchName: (name: string) => Promise<void>;
  switchingRole: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const defaultAdminRoute = getDefaultAdminRoute(user);
  const [draftNameOverride, setDraftNameOverride] = useState<string | null>(null);

  const draftName = draftNameOverride ?? user.name;

  const normalizedDraftName = draftName.trim();
  const canSaveName =
    draftNameOverride !== null && normalizedDraftName.length > 0 && normalizedDraftName !== user.name && !switchingRole;

  const nav = useMemo(
    () =>
      [
        {
          name: 'Dashboard',
          href: '/admin/dashboard',
          icon: LayoutDashboard,
          permission: 'dashboard:read' as const,
          roles: ['operations_manager'] as CurrentUser['role'][],
        },
        {
          name: 'Trends Dashboard',
          href: '/admin/qa-trends',
          icon: LayoutDashboard,
          permission: 'dashboard:read' as const,
          roles: ['quality_assurance'] as CurrentUser['role'][],
        },
        {
          name: 'Reports',
          href: '/admin/reports',
          icon: LayoutDashboard,
          permission: 'reports:export' as const,
          roles: ['operations_manager'] as CurrentUser['role'][],
        },
        {
          name:
            user.role === 'support_executive'
              ? 'My Complaints'
              : user.role === 'quality_assurance'
                ? 'All Complaints'
                : 'All Complaints + SLA',
          href: '/admin/complaints',
          icon: Inbox,
          permission: 'complaints:read' as const,
          roles: ['support_executive', 'quality_assurance', 'operations_manager'] as CurrentUser['role'][],
        },
        {
          name: 'Submit + Result',
          href: '/admin/complaints/new',
          icon: FilePlus2,
          permission: 'complaints:create' as const,
          roles: ['support_executive'] as CurrentUser['role'][],
        },
      ].filter((item) => hasPermission(user, item.permission) && item.roles.includes(user.role)),
    [user],
  );

  useEffect(() => {
    if (!location.pathname.startsWith('/admin')) {
      return;
    }

    if (!canAccessAdminPath(user, location.pathname) && location.pathname !== defaultAdminRoute) {
      navigate(defaultAdminRoute, { replace: true });
    }
  }, [defaultAdminRoute, location.pathname, navigate, user]);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-zinc-900 focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="flex h-screen bg-[#fcfcfc] text-zinc-950 selection:bg-zinc-200">
        <div className="w-64 bg-white border-r border-zinc-200/60 flex flex-col hidden md:flex z-10 shadow-[2px_0_10px_rgba(0,0,0,0.01)]">
          <div className="h-16 flex items-center px-6 border-b border-zinc-200/60">
            <div className="bg-zinc-900 p-1.5 rounded-md mr-3 shadow-sm">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-zinc-900">Triage AI</span>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
            <div className="px-3 text-xs font-semibold text-zinc-400 mb-4 uppercase tracking-widest">Navigation</div>
            {nav.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "relative group flex items-center px-3 py-2.5 text-[14px] font-medium rounded-xl transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/50",
                    isActive && item.href !== '/admin' ? "text-zinc-900" : "text-zinc-600 hover:text-zinc-900"
                  )}
                >
                  {isActive && item.href !== '/admin' && (
                    <motion.div
                      layoutId="active-nav"
                      className="absolute inset-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] border border-zinc-200/50 rounded-xl -z-10"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 35, mass: 1 }}
                    />
                  )}
                  {!isActive && (
                    <div className="absolute inset-0 bg-zinc-100/0 rounded-xl -z-10 transition-colors duration-200 group-hover:bg-zinc-100/50" />
                  )}
                  <item.icon className={cn(
                    "mr-3 h-4 w-4 flex-shrink-0 transition-all duration-200", 
                    isActive && item.href !== '/admin' ? "text-zinc-900 scale-110" : "text-zinc-400 group-hover:text-zinc-600"
                  )} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-5 border-t border-zinc-200/60 bg-zinc-50/50">
            <div className="flex items-center justify-between mb-3">
              <label htmlFor="role-switcher" className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Current Role
              </label>
            </div>
            <select
              id="role-switcher"
              name="role"
              value={user.role}
              onChange={(event) => {
                setDraftNameOverride(null);
                void onSwitchRole(event.target.value as CurrentUser['role']);
              }}
              disabled={switchingRole}
              className="mb-4 w-full rounded-lg bg-white border border-zinc-200/80 pl-3 pr-10 py-2 text-[13px] text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 transition-[border-color,box-shadow] shadow-sm cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%20stroke%3D%22currentColor%22%20stroke-width%3D%221.5%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20d%3D%22M6%208l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.75rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat"
            >
              {user.availableRoles.map((option) => (
                <option key={option.role} value={option.role}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="mb-4 space-y-2">
              <label htmlFor="name-switcher" className="block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Agent Name
              </label>
              <input
                id="name-switcher"
                name="name"
                value={draftName}
                onChange={(event) => setDraftNameOverride(event.target.value)}
                disabled={switchingRole}
                className="w-full rounded-lg bg-white border border-zinc-200/80 px-3 py-2 text-[13px] text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 transition-[border-color,box-shadow] shadow-sm"
                placeholder="Enter your name"
              />
              <button
                type="button"
                onClick={() => {
                  setDraftNameOverride(normalizedDraftName);
                  void onSwitchName(normalizedDraftName);
                }}
                disabled={!canSaveName}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed hover:bg-zinc-100"
              >
                Save Name
              </button>
            </div>
            <div className="flex items-center">
              <div className="h-9 w-9 rounded-full bg-zinc-100 border border-zinc-200/80 flex items-center justify-center font-semibold text-xs text-zinc-700 shadow-sm">
                {roleInitials(user.role)}
              </div>
              <div className="ml-3 truncate">
                <p className="text-[14px] font-semibold text-zinc-900 truncate">{user.name}</p>
                <p className="text-xs font-medium text-zinc-500 truncate">{user.roleLabel}</p>
              </div>
            </div>
          </div>
        </div>
        <main id="main-content" className="flex-1 overflow-y-auto relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-50 via-[#fcfcfc] to-[#fcfcfc]">
          <div className="py-8 px-6 sm:px-8 lg:px-10 max-w-[1600px] mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12, scale: 0.99, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(8px)' }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </>
  );
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [switchingRole, setSwitchingRole] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      try {
        const currentUser = await api.getCurrentUser();
        if (cancelled) {
          return;
        }

        setUser(currentUser);
        setAuthError(null);
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }

        setAuthError(getErrorMessage(error, 'Unable to load current user'));
      } finally {
        if (!cancelled) {
          setLoadingUser(false);
        }
      }
    };

    void loadUser();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleRetryLoadUser = async () => {
    try {
      setLoadingUser(true);
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
      setAuthError(null);
    } catch (error: unknown) {
      setAuthError(getErrorMessage(error, 'Unable to load current user'));
    } finally {
      setLoadingUser(false);
    }
  };

  const handleSwitchRole = async (nextRole: CurrentUser['role']) => {
    if (!user) {
      return;
    }

    const previousRole = user.role;
    setSwitchingRole(true);
    api.setRole(nextRole);

    try {
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
      setAuthError(null);
    } catch (error: unknown) {
      api.setRole(previousRole);
      setAuthError(getErrorMessage(error, 'Unable to switch role'));
    } finally {
      setSwitchingRole(false);
    }
  };

  const handleSwitchName = async (nextName: string) => {
    if (!user) {
      return;
    }

    const normalizedName = nextName.trim();
    if (!normalizedName || normalizedName === user.name) {
      return;
    }

    const previousName = user.name;
    setSwitchingRole(true);
    api.setUserName(normalizedName);

    try {
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);
      setAuthError(null);
    } catch (error: unknown) {
      api.setUserName(previousName);
      setAuthError(getErrorMessage(error, 'Unable to switch user name'));
    } finally {
      setSwitchingRole(false);
    }
  };

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Subtle background glow for loading screen */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-zinc-200/50 rounded-full blur-[100px] pointer-events-none animate-pulse" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col items-center z-10"
        >
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-950 text-white mb-6 shadow-2xl shadow-zinc-900/20">
            {/* Spinning ring around the logo */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-1 rounded-3xl border border-transparent border-t-zinc-500/50 border-r-zinc-500/50 opacity-70"
            />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-check">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <p className="text-sm font-semibold tracking-wide text-zinc-600 uppercase">
            {authError ?? 'Initializing Workspace...'}
          </p>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-red-200/60 bg-white p-8 text-center shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Unable to Load Workspace</h1>
          <p className="mt-2 text-sm text-zinc-500">{authError ?? 'The current user could not be loaded.'}</p>
          <button
            type="button"
            onClick={() => void handleRetryLoadUser()}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-[background-color,box-shadow] hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const defaultAdminRoute = getDefaultAdminRoute(user);

  return (
    <BrowserRouter>
      <Toaster 
        position="top-right" 
        closeButton 
        theme="light" 
        toastOptions={{
          className: 'bg-white border border-zinc-200/60 shadow-lg text-zinc-900 rounded-xl',
          descriptionClassName: 'text-zinc-500',
        }}
      />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/submit" element={<CustomerIntake />} />
        
        <Route
          path="/admin"
          element={
            <AdminLayout
              user={user}
              onSwitchRole={handleSwitchRole}
              onSwitchName={handleSwitchName}
              switchingRole={switchingRole}
            />
          }
        >
          <Route index element={<Navigate to={defaultAdminRoute} replace />} />
          <Route
            path="dashboard"
            element={
              <RequirePermission user={user} permission="dashboard:read">
                {user.role === 'operations_manager' ? (
                  <Dashboard
                    canExport={hasPermission(user, 'reports:export')}
                    canStream={hasPermission(user, 'dashboard:stream')}
                    streamUrl={api.dashboardStreamUrl()}
                  />
                ) : (
                  <Navigate to={defaultAdminRoute} replace />
                )}
              </RequirePermission>
            }
          />
          <Route
            path="qa-trends"
            element={
              <RequirePermission user={user} permission="dashboard:read">
                {user.role === 'quality_assurance' ? <QaDashboard /> : <Navigate to={defaultAdminRoute} replace />}
              </RequirePermission>
            }
          />
          <Route
            path="reports"
            element={
              <RequirePermission user={user} permission="reports:export">
                <ReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="complaints"
            element={
              <RequirePermission user={user} permission="complaints:read">
                <ComplaintQueue
                  canCreateComplaint={hasPermission(user, 'complaints:create')}
                  viewerRole={user.role}
                />
              </RequirePermission>
            }
          />
          <Route
            path="complaints/new"
            element={
              <RequirePermission user={user} permission="complaints:create">
                <ExecutiveIntake />
              </RequirePermission>
            }
          />
          <Route
            path="complaints/:id"
            element={
              <RequirePermission user={user} permission="complaints:read">
                <ComplaintDetails
                  viewerRole={user.role}
                  canUpdateStatus={hasPermission(user, 'complaints:update_status')}
                  canRetryTriage={hasPermission(user, 'complaints:retry_triage')}
                />
              </RequirePermission>
            }
          />
          <Route path="*" element={<Navigate to={defaultAdminRoute} replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
