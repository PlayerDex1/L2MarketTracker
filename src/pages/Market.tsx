import { useState, useEffect, useCallback } from 'react';
import { Search, Clock, ArrowUpDown, Filter, Bell, BellOff, Plus, X, Zap, Trash2, DollarSign } from 'lucide-react';
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
  maxPrice?: number;
  minEnhancement?: number;
  triggered: boolean;
  lastMatch: MarketItem | null;
  history: MarketItem[];
  created_at: string;
}

const POLL_INTERVAL = 5000;

// Push notification helper
async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function fireNotification(item: MarketItem, alert: MarketAlert) {
  if (Notification.permission !== 'granted') return;
  new Notification(`🔔 ${alert.keyword} encontrado!`, {
    body: `${item.name} — ${item.price} ${item.currency}`,
    icon: item.iconUrl || '/favicon.ico',
    tag: alert.id,
  });
}

// Check if item matches alert conditions
function itemMatchesAlert(item: MarketItem, alert: MarketAlert): boolean {
  const nameMatch = item.name.toLowerCase().includes(alert.keyword.toLowerCase());
  if (!nameMatch) return false;
  if (alert.maxPrice !== undefined && item.price > alert.maxPrice) return false;
  if (alert.minEnhancement !== undefined) {
    const match = item.name.match(/\+(\d+)/);
    const enhancement = match ? parseInt(match[1]) : 0;
    if (enhancement < alert.minEnhancement) return false;
  }
  return true;
}

export default function Market() {
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);
  const [alerts, setAlerts] = useState<MarketAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [botConnected, setBotConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [search, setSearch] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newMaxPrice, setNewMaxPrice] = useState('');
  const [newMinEnhancement, setNewMinEnhancement] = useState('');
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

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

  const loadAlerts = useCallback(() => {
    try {
      const saved = localStorage.getItem('market_alerts');
      if (saved) setAlerts(JSON.parse(saved));
    } catch { }
  }, []);

  const saveAlerts = (updated: MarketAlert[]) => {
    setAlerts(updated);
    localStorage.setItem('market_alerts', JSON.stringify(updated));
  };

  useEffect(() => {
    fetchItems();
    loadAlerts();
    const interval = setInterval(fetchItems, POLL_INTERVAL);

    // Supabase Realtime — instant update
    const channel = supabase
      .channel('market_items_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'market_items',
      }, (payload) => {
        const d = payload.new as any;
        const newItem: MarketItem = {
          id: d.id,
          name: d.name,
          price: d.price,
          currency: d.currency,
          timestamp: d.timestamp,
          iconUrl: d.icon_url || '',
        };

        setMarketItems(prev => {
          if (prev.some(i => i.id === newItem.id)) return prev;
          return [newItem, ...prev].slice(0, 100);
        });
        setBotConnected(true);
        setLastUpdate(new Date());

        // Check alerts
        setAlerts(currentAlerts => {
          const updated = currentAlerts.map(alert => {
            if (itemMatchesAlert(newItem, alert)) {
              fireNotification(newItem, alert);
              return {
                ...alert,
                triggered: true,
                lastMatch: newItem,
                history: [newItem, ...(alert.history || [])].slice(0, 20),
              };
            }
            return alert;
          });
          localStorage.setItem('market_alerts', JSON.stringify(updated));
          return updated;
        });
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchItems, loadAlerts]);

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    // Request notification permission on first alert
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');

    const alert: MarketAlert = {
      id: `alert_${Date.now()}`,
      keyword: newKeyword.trim(),
      maxPrice: newMaxPrice ? parseFloat(newMaxPrice) : undefined,
      minEnhancement: newMinEnhancement ? parseInt(newMinEnhancement) : undefined,
      triggered: false,
      lastMatch: null,
      history: [],
      created_at: new Date().toISOString(),
    };
    saveAlerts([...alerts, alert]);
    setNewKeyword('');
    setNewMaxPrice('');
    setNewMinEnhancement('');
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
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${botConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}>
            <div className={`w-2 h-2 rounded-full ${botConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
            {botConnected ? '🟢 Live Data' : '⚠️ Aguardando dados'}
          </div>

          {notifPermission === 'denied' && (
            <div className="text-xs text-red-400 px-2">🔕 Notificações bloqueadas</div>
          )}

          <button onClick={() => setAlertsModalOpen(true)}
            className="relative flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 rounded-lg text-sm font-medium text-zinc-300 transition-colors">
            <Bell className="w-4 h-4" />
            Alertas ({alerts.length})
            {triggeredAlerts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {triggeredAlerts.length}
              </span>
            )}
          </button>

          <button onClick={() => setIsAlertModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Novo Alerta
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
                  <p className="text-sm font-bold text-amber-300">
                    Alerta: "{alert.keyword}"
                    {alert.maxPrice && <span className="text-amber-400/70"> ≤ {alert.maxPrice} zCoin</span>}
                    {alert.minEnhancement && <span className="text-amber-400/70"> +{alert.minEnhancement}+</span>}
                  </p>
                  {alert.lastMatch && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      <span className="text-zinc-200 font-medium">{alert.lastMatch.name}</span> — {alert.lastMatch.price} {alert.lastMatch.currency} às {formatTime(alert.lastMatch.timestamp)}
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

      {/* Filters */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" placeholder="Buscar item..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-zinc-500 hidden sm:block" />
            <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)}
              className="flex-1 sm:w-40 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">Todas moedas</option>
              <option value="zcoin">zCoin</option>
              <option value="adena">Adena</option>
            </select>
          </div>
          {lastUpdate && (
            <span className="text-xs text-zinc-500 whitespace-nowrap">Atualizado {formatTime(lastUpdate.toISOString())}</span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-950/50 text-zinc-400 uppercase tracking-wider text-xs font-medium">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">Item <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('price')}>
                  <div className="flex items-center gap-1">Preço <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('timestamp')}>
                  <div className="flex items-center gap-1">Hora <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 text-right">Alerta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500">Conectando...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <p className="text-zinc-500">{botConnected ? 'Nenhum item encontrado.' : '⚠️ Aguardando dados...'}</p>
                    <p className="text-zinc-600 text-xs mt-1">{botConnected ? 'Aguardando novos itens do mercado ZGaming...' : 'Inicie o servidor com npm run dev para ativar o bot.'}</p>
                  </td>
                </tr>
              ) : filteredItems.map(item => {
                const matchedAlert = alerts.find(a => itemMatchesAlert(item, a));
                return (
                  <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 font-medium text-zinc-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                          <img src={item.iconUrl} alt={item.name} className="w-8 h-8 object-contain"
                            onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                        </div>
                        <span className={item.name.includes('+') ? 'text-amber-400' : 'text-zinc-200'}>{item.name}</span>
                        {matchedAlert && <Bell className="w-3 h-3 text-indigo-400 shrink-0" />}
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
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${matchedAlert ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                          }`}>
                        <Bell className="w-3 h-3" />
                        {matchedAlert ? 'Watching' : 'Notify Me'}
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
                <h2 className="text-lg font-bold text-zinc-100">Criar Alerta</h2>
              </div>
              <button onClick={() => { setIsAlertModalOpen(false); setNewKeyword(''); setNewMaxPrice(''); setNewMinEnhancement(''); }}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddAlert} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Palavra-chave do item *</label>
                <input required type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                  placeholder="ex: Talisman of Aden, Cloak, +8"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">
                    <DollarSign className="w-3 h-3 inline mr-1" />Preço máximo (zCoin)
                  </label>
                  <input type="number" min="1" value={newMaxPrice} onChange={e => setNewMaxPrice(e.target.value)}
                    placeholder="ex: 50"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Enhancement mínimo</label>
                  <input type="number" min="1" max="15" value={newMinEnhancement} onChange={e => setNewMinEnhancement(e.target.value)}
                    placeholder="ex: 5 (para +5)"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <p className="text-xs text-zinc-500">
                Ex: keyword="Talisman of Aden", preço≤50, enhancement≥+5 → dispara apenas para <span className="text-zinc-300">+5 Talisman of Aden — 8 zCoin</span>
              </p>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsAlertModalOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors">Criar Alerta</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Alerts Modal */}
      {alertsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 shrink-0">
              <h2 className="text-lg font-bold text-zinc-100">Meus Alertas</h2>
              <button onClick={() => setAlertsModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <BellOff className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">Nenhum alerta configurado.</p>
                  <button onClick={() => { setAlertsModalOpen(false); setIsAlertModalOpen(true); }}
                    className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm transition-colors">+ Criar primeiro alerta</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map(alert => (
                    <div key={alert.id} className={`p-3 rounded-lg border ${alert.triggered ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-950/50 border-zinc-800'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {alert.triggered ? <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" /> : <Bell className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />}
                          <div>
                            <p className="text-sm font-medium text-zinc-100">"{alert.keyword}"</p>
                            <div className="flex gap-2 mt-0.5 flex-wrap">
                              {alert.maxPrice && <span className="text-xs text-zinc-400">≤ {alert.maxPrice} zCoin</span>}
                              {alert.minEnhancement && <span className="text-xs text-zinc-400">+{alert.minEnhancement}+</span>}
                            </div>
                            {alert.triggered && alert.lastMatch && (
                              <p className="text-xs text-amber-400 mt-1">Match: {alert.lastMatch.name} — {alert.lastMatch.price} zCoin</p>
                            )}
                            {alert.history && alert.history.length > 0 && (
                              <p className="text-xs text-zinc-500 mt-1">{alert.history.length} match(es) no histórico</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {alert.triggered && (
                            <button onClick={() => handleDismissAlert(alert.id)} className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">Dispensar</button>
                          )}
                          <button onClick={() => handleDeleteAlert(alert.id)} className="text-zinc-500 hover:text-red-400 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
