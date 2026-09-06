import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Pill,
  Layers,
  ScanBarcode,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Undo2,
  Wallet,
  FileBarChart,
  History,
  UserCog,
  Menu,
  X,
  LogOut,
  Search,
  Bell,
} from 'lucide-react';
import { BUSINESS } from '../config/business';
import { useCurrentUser, useLogout, usePermissions } from '../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/medicines', label: 'Medicines', icon: Pill },
  { to: '/batches', label: 'Batches & Expiry', icon: Layers },
  { to: '/pos', label: 'Billing / POS', icon: ScanBarcode },
  { to: '/sales', label: 'Invoices', icon: Receipt },
  { to: '/purchases', label: 'Purchases', icon: ShoppingCart },
  { to: '/suppliers', label: 'Suppliers', icon: Truck },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/returns', label: 'Returns', icon: Undo2 },
  { to: '/payments', label: 'Payments', icon: Wallet },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/audit-logs', label: 'Audit Logs', icon: History, adminOnly: true },
  { to: '/users', label: 'Users', icon: UserCog, adminOnly: true },
];

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useCurrentUser();
  const { isAdmin } = usePermissions();
  const logout = useLogout();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await apiClient.get('/notifications')).data.data as { id: string; title: string; message: string; type: string }[],
    refetchInterval: 60_000,
  });

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 transform bg-brand-900 text-white transition-transform duration-200 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-brand-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-brand-800 font-extrabold">AR</div>
          <div className="leading-tight">
            <p className="font-bold text-white">{BUSINESS.name}</p>
            <p className="text-[11px] text-brand-200">{BUSINESS.address}</p>
          </div>
          <button className="ml-auto lg:hidden text-brand-200" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" style={{ height: 'calc(100vh - 4rem)' }}>
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-white text-brand-800' : 'text-brand-100 hover:bg-brand-800'
                )
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <button className="text-slate-500 lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>

          <form onSubmit={handleSearchSubmit} className="hidden flex-1 max-w-md sm:block">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search medicines, invoices, customers..."
                className="input pl-9"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <div className="relative group">
              <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100">
                <Bell className="h-5 w-5" />
                {notifications && notifications.length > 0 && (
                  <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>
              <div className="invisible absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
                  Alerts
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!notifications || notifications.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">No alerts right now</p>
                  ) : (
                    notifications.slice(0, 8).map((n) => (
                      <div key={n.id} className="border-b border-slate-50 px-4 py-2.5 last:border-0">
                        <p className="text-sm font-medium text-slate-800">{n.title}</p>
                        <p className="text-xs text-slate-500">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <button
              onClick={() => logout.mutate()}
              className="btn-secondary !px-2.5 !py-2"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>

        <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
          <p className="font-medium text-slate-700">{BUSINESS.name}</p>
          <p>{BUSINESS.address}</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} {BUSINESS.name}. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
