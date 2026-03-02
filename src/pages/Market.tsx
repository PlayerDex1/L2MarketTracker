import { useState, useEffect, useCallback } from 'react';
import { Search, Clock, ArrowUpDown, Filter, Bell, BellOff, Plus, X, Zap, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MarketItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  timestamp: string;
  iconUrl: string;
}

interface MarketAlert {
  id: string;
  keyword: string;
  triggered: boolean;
  lastMatch: MarketItem | null;
  created_at: string;
}

const POLL_INTERVAL = 5000; // 5 seconds

export default function Market() {
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [botConnected, setBotConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  // Alert modal
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);

  // Fetch market items from Supabase
  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('market_items')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (!error && data) {
        setMarketItems(data.map((d: any) => ({
          id: d.id,
          name: d.name,
          price: d.price,
          currency: d.currency,
          timestamp: d.timestamp,
          iconUrl: d.icon_url || '',
        })));
        setBotConnected(true);
        setLastUpdate(new Date());
      }
    } catch {
      setBotConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Alerts stored in localStorage (no backend needed)
  const fetchAlerts = useCallback(async () => {
    try {
      const saved = localStorage.getItem('market_alerts');
      if (saved) setAlerts(JSON.parse(saved));
    } catch { }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchAlerts();
    const interval = setInterval(() => { fetchItems(); fetchAlerts(); }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchItems, fetchAlerts]);

  const saveAlerts = (updated: MarketAlert[]) => {
    setAlerts(updated);
    localStorage.setItem('market_alerts', JSON.stringify(updated));
  };

  const handleAddAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const alert: MarketAlert = {
      id: `alert_${Date.now()}`,
      keyword: newKeyword.trim(),
      triggered: false,
      lastMatch: null,
      created_at: new Date().toISOString(),
    };
    saveAlerts([...alerts, alert]);
    setNewKeyword('');
    setIsAlertModalOpen(false);
  };

  const handleDeleteAlert = (alertId: string) => {
    saveAlerts(alerts.filter(a => a.id !== alertId));
  };

  const handleDismissAlert = (alertId: string) => {
    saveAlerts(alerts.map(a => a.id === alertId ? { ...a, triggered: false, lastMatch: null } : a));
  };

  const handleSort = (key: string) => {
    setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'desc' ? 'asc' : 'desc' }));
  };

  const filteredItems = marketItems
    .filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCurrency = currencyFilter === 'all' || item.currency.toLowerCase() === currencyFilter;
      return matchesSearch && matchesCurrency;
    })
    .sort((a, b) => {
      const aVal = (a as any)[sortConfig.key];
      const bVal = (b as any)[sortConfig.key];
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Market Tracker</h1>
          <p className="text-zinc-400 mt-1">Live feed of items from the ZGaming market.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Connection status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${botConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}>
            <div className={`w-2 h-2 rounded-full ${botConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
            {botConnected ? 'Bot Connected' : 'Bot Offline'}
          </div>

          {/* Alerts button */}
          <button onClick={() => setAlertsModalOpen(true)}
            className="relative flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 rounded-lg text-sm font-medium text-zinc-300 transition-colors">
            <Bell className="w-4 h-4" />
            Alerts
            {triggeredAlerts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {triggeredAlerts.length}
              </span>
            )}
          </button>

          {/* Add alert */}
          <button onClick={() => setIsAlertModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> New Alert
          </button>
        </div>
      </div>

      {/* Triggered alerts banner */}
      {triggeredAlerts.length > 0 && (
        <div className="space-y-2">
          {triggeredAlerts.map(alert => (
            <div key={alert.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-300">Alert: "{alert.keyword}" matched!</p>
                  {alert.lastMatch && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      <span className="text-zinc-200 font-medium">{alert.lastMatch.name}</span> —{' '}
                      {alert.lastMatch.price} {alert.lastMatch.currency} at {formatTime(alert.lastMatch.timestamp)}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => handleDismissAlert(alert.id)} className="text-zinc-500 hover:text-zinc-300 shrink-0 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" placeholder="Search items (e.g. 'Talisman', '+6')..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-zinc-500 hidden sm:block" />
            <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)}
              className="flex-1 sm:w-40 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">All Currencies</option>
              <option value="zcoin">zCoin</option>
              <option value="adena">Adena</option>
            </select>
          </div>
          {lastUpdate && (
            <span className="text-xs text-zinc-500 whitespace-nowrap">
              Updated {formatTime(lastUpdate.toISOString())}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-950/50 text-zinc-400 uppercase tracking-wider text-xs font-medium">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">Item Name <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('price')}>
                  <div className="flex items-center gap-1">Price <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('timestamp')}>
                  <div className="flex items-center gap-1">Time Added <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 text-right">Alert</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500">Connecting to bot...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <p className="text-zinc-500">{botConnected ? 'No items found.' : 'Bot offline — no data yet.'}</p>
                    <p className="text-zinc-600 text-xs mt-1">
                      {botConnected ? 'Waiting for new items from ZGaming market...' : 'Start the server with npm run dev to activate the bot.'}
                    </p>
                  </td>
                </tr>
              ) : filteredItems.map(item => {
                const hasAlert = alerts.some(a => item.name.toLowerCase().includes(a.keyword.toLowerCase()));
                return (
                  <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                          <img src={item.iconUrl} alt={item.name} className="w-8 h-8 object-contain"
                            onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                        </div>
                        <span className={item.name.includes('+') ? 'text-amber-400' : 'text-zinc-200'}>{item.name}</span>
                        {hasAlert && <Bell className="w-3 h-3 text-indigo-400 shrink-0" />}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 font-bold text-amber-500">
                        <div className="w-4 h-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">z</div>
                        {item.price.toLocaleString()} {item.currency}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-zinc-500" />
                        {formatTime(item.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => { setNewKeyword(item.name.replace(/\+\d+\s*/, '')); setIsAlertModalOpen(true); }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${hasAlert ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                          }`}>
                        <Bell className="w-3 h-3" />
                        {hasAlert ? 'Watching' : 'Notify Me'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Alert Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-zinc-100">Create Alert</h2>
              </div>
              <button onClick={() => { setIsAlertModalOpen(false); setNewKeyword(''); }} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddAlert} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Keyword to watch</label>
                <input required type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                  placeholder="e.g. Talisman of Aden, Cloak, +8"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-xs text-zinc-500 mt-1">You'll be notified whenever an item containing this keyword appears in the market.</p>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => { setIsAlertModalOpen(false); setNewKeyword(''); }} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">Create Alert</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Alerts Modal */}
      {alertsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-zinc-100">My Alerts</h2>
              <button onClick={() => setAlertsModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <BellOff className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No alerts configured yet.</p>
                  <button onClick={() => { setAlertsModalOpen(false); setIsAlertModalOpen(true); }}
                    className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">+ Create your first alert</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border ${alert.triggered ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-950/50 border-zinc-800'
                      }`}>
                      <div className="flex items-center gap-2">
                        {alert.triggered ? <Zap className="w-4 h-4 text-amber-400 shrink-0" /> : <Bell className="w-4 h-4 text-zinc-500 shrink-0" />}
                        <div>
                          <p className="text-sm font-medium text-zinc-100">"{alert.keyword}"</p>
                          {alert.triggered && alert.lastMatch && (
                            <p className="text-xs text-amber-400">Match: {alert.lastMatch.name}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {alert.triggered && (
                          <button onClick={() => handleDismissAlert(alert.id)} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Dismiss</button>
                        )}
                        <button onClick={() => handleDeleteAlert(alert.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
