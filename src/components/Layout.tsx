import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { TrendingUp, Bell, BarChart2, Zap, Search, LineChart } from 'lucide-react';
import CommandPalette from './CommandPalette';

const NAV = [
  { name: 'Live Market', href: '/', icon: TrendingUp },
  { name: 'Analytics', href: '/analytics', icon: LineChart },
  { name: 'Watchlist', href: '/watchlist', icon: Bell },
];

export default function Layout() {
  const { pathname } = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-50 flex flex-col">
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      <header className="sticky top-0 z-40 border-b border-zinc-800/60 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight hidden sm:block">
              <span className="text-white">ZGaming</span>
              <span className="text-indigo-400"> Market</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[10px] font-bold text-emerald-400">
              <Zap className="w-2.5 h-2.5" /> LIVE
            </span>
          </Link>

          {/* CMD+K search bar */}
          <button onClick={() => setCmdOpen(true)}
            className="flex-1 max-w-xs flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-lg text-sm text-zinc-500 transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buscar item...</span>
            <div className="hidden sm:flex items-center gap-0.5 ml-auto">
              <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px]">⌘</kbd>
              <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[10px]">K</kbd>
            </div>
          </button>

          {/* Nav */}
          <nav className="flex items-center gap-1 shrink-0">
            {NAV.map(item => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link key={item.name} to={item.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                    }`}>
                  <item.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-zinc-800/40 py-4 text-center text-xs text-zinc-600">
        ZGaming Market — Lineage 2 Real-time Market Tracker
      </footer>
    </div>
  );
}
