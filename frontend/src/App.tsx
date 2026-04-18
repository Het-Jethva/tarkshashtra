import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { cn } from './lib/utils';

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
  switchingRole,
}: {
  user: CurrentUser;
  onSwitchRole: (role: CurrentUser['role']) => Promise<void>;
  switchingRole: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const defaultAdminRoute = getDefaultAdminRoute(user);

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
            <div className="px-3 text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Navigation</div>
            {nav.map((item) => {
              const isActive = location.pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "group flex items-center px-3 py-2.5 text-[14px] font-medium rounded-lg transition-[background-color,color,box-shadow]",
                    isActive && item.href !== '/admin' ? "bg-zinc-100 text-zinc-900 shadow-sm" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  )}
                >
                  <item.icon className={cn("mr-3 h-4 w-4 flex-shrink-0 transition-colors", isActive && item.href !== '/admin' ? "text-zinc-900" : "text-zinc-400 group-hover:text-zinc-600")} />
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
              onChange={(event) => void onSwitchRole(event.target.value as CurrentUser['role'])}
              disabled={switchingRole}
              className="mb-4 w-full rounded-lg bg-white border border-zinc-200/80 px-3 py-2 text-[13px] text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/10 focus-visible:border-zinc-900 transition-[border-color,box-shadow] shadow-sm cursor-pointer"
            >
              {user.availableRoles.map((option) => (
                <option key={option.role} value={option.role}>
                  {option.label}
                </option>
              ))}
            </select>
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
        <main id="main-content" className="flex-1 overflow-y-auto relative">
          <div className="py-8 px-6 sm:px-8 lg:px-10 max-w-[1600px] mx-auto">
            <Outlet />
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

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex flex-col items-center justify-center p-6">
        <div className="h-8 w-8 mb-4">
          <svg className="animate-spin text-zinc-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p className="text-sm font-medium text-zinc-500">
          {authError ?? 'Loading workspace…'}
        </p>
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
        <Route path="/" element={<CustomerIntake />} />
        
        <Route
          path="/admin"
          element={<AdminLayout user={user} onSwitchRole={handleSwitchRole} switchingRole={switchingRole} />}
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
