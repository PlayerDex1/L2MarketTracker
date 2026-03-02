import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { Shield, Users, Calendar, LogOut, Menu, Swords, UserPlus, Settings as SettingsIcon, ShoppingCart, Bell } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';

export default function Layout() {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, clan, loading, signOut } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Loading...</div>;
  }

  // Bypassing login checks for now
  // if (!user) {
  //   return <Navigate to="/login" state={{ from: location }} replace />;
  // }

  // if (!clan) {
  //   return <Navigate to="/create-clan" replace />;
  // }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Shield },
    { name: 'Members', href: '/members', icon: Users },
    { name: 'CP Management', href: '/cps', icon: Swords },
    { name: 'Recruitment', href: '/applications', icon: UserPlus },
    { name: 'Market Tracker', href: '/market', icon: ShoppingCart },
    { name: 'Watchlist', href: '/watchlist', icon: Bell },
    { name: 'Settings', href: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-zinc-800 bg-zinc-900/50">
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
          <Shield className="w-8 h-8 text-indigo-500" />
          <span className="font-bold text-xl tracking-tight truncate">{clan.name}</span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 px-3 mt-2">
            Clan Management
          </div>
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-500" />
            <span className="font-bold text-lg truncate">{clan.name}</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="w-6 h-6 text-zinc-400" />
          </button>
        </header>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-b border-zinc-800 bg-zinc-900/50 px-4 py-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 text-zinc-400 hover:text-zinc-100"
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
