import { Link, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { TrendingUp, Bell, BarChart2, Zap, Search, LineChart, LogOut, LogIn } from 'lucide-react';
import CommandPalette from './CommandPalette';
import { useAuth } from '../lib/AuthContext';
import { useServer } from '../lib/ServerContext';

const NAV = [
  { name: 'Live Market', href: '/', icon: TrendingUp },
  { name: 'Analytics', href: '/analytics', icon: LineChart },
  { name: 'Watchlist', href: '/watchlist', icon: Bell },
];

export default function Layout() {
  const { pathname } = useLocation();
  const [cmdOpen, setCmdOpen] = useState(false);
  const { user, signInWithDiscord, signOut, loading } = useAuth();
  const { activeServer, setActiveServer, availableServers } = useServer();

  useEffect(() => {
    const serverName = availableServers.find(s => s.id === activeServer)?.name || 'L2';
    document.title = `${serverName} Market Tracker`;
  }, [activeServer, availableServers]);

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
              <span className="text-white">L2</span>
              <span className="text-indigo-400"> Market</span>
            </span>
          </Link>

          {/* Seletor de Servidor Múltiplo */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            {availableServers.map(server => {
              const isActive = activeServer === server.id;
              // Ajusta a cor dinamicamente baseada no theme do config
              const activeColorClass = server.colorTheme === 'indigo'
                ? 'bg-indigo-600 text-white shadow-sm'
                : server.colorTheme === 'red'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-zinc-700 text-white shadow-sm';

              return (
                <button
                  key={server.id}
                  onClick={() => setActiveServer(server.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${isActive ? activeColorClass : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                >
                  {server.name}
                </button>
              );
            })}
          </div>

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

          {/* User / Login */}
          <div className="flex items-center ml-2 border-l border-zinc-800/60 pl-4 shrink-0">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse"></div>
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <img src={user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${user.email}`} alt="Avatar" className="w-8 h-8 rounded-full border border-zinc-700" />
                  <span className="text-sm font-medium hidden md:inline">{user.user_metadata.custom_claims?.global_name || user.email?.split('@')[0]}</span>
                </div>
                <button onClick={signOut} title="Sair" className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button onClick={signInWithDiscord} className="flex items-center gap-2 px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-sm font-semibold transition-colors">
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Login Discord</span>
              </button>
            )}
          </div>
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
