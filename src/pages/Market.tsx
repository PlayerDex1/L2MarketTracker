import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Clock, ArrowUpDown, Filter, Bell, BellOff, Plus, X, Zap, Trash2, DollarSign, TrendingUp, BarChart2, ChevronRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

// Normalize item name (remove enchant prefix) for grouping
function normalizeItemName(name: string): string {
  return name.replace(/^\+\d+\s*/, '').trim();
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

  // Price chart modal
  const [chartItem, setChartItem] = useState<string | null>(null);
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([]);
  const [chartLoading, setChartLoading] = useState(false);

  // Ranking: top N items by listing count
  const ranking = useMemo(() => {
    const counts: Record<string, { count: number; avgPrice: number; icon: string; prices: number[] }> = {};
    marketItems.forEach(item => {
      const key = normalizeItemName(item.name);
      if (!counts[key]) counts[key] = { count: 0, avgPrice: 0, icon: item.iconUrl, prices: [] };
      counts[key].count++;
      counts[key].prices.push(item.price);
      // icon is set only once on first occurrence — prevents flicker on re-render
    });
    return Object.entries(counts)
      .map(([name, v]) => ({
        name,
        count: v.count,
        avgPrice: Math.round(v.prices.reduce((a, b) => a + b, 0) / v.prices.length),
        minPrice: Math.min(...v.prices),
        icon: v.icon,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [marketItems]);

  // Open price chart for an item
  const openChart = useCallback(async (itemName: string) => {
    const normalized = normalizeItemName(itemName);
    setChartItem(normalized);
    setChartLoading(true);
    setChartData([]);
    try {
      const { data } = await supabase
        .from('market_items')
        .select('name, price, timestamp')
        .ilike('name', `%${normalized}%`)
        .order('timestamp', { ascending: true })
        .limit(50);
      if (data) {
        setChartData(data.map((d: any) => ({
          time: new Date(d.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          price: d.price,
          name: d.name,
        })));
      }
    } catch { }
    setChartLoading(false);
  }, []);

  const fetchItems = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('market_items')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      if (!error && data) {
        setMarketItems(data.map((d: any) => ({
          id: d.id, name: d.name, price: d.price, currency: d.currency,
          timestamp: d.timestamp, iconUrl: d.icon_url || '',
        })));
        setBotConnected(true);
        setLastUpdate(new Date());
      }
    } catch { setBotConnected(false); }
    finally { setLoading(false); }
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
    const channel = supabase
      .channel('market_items_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_items' }, (payload) => {
        const d = payload.new as any;
        const newItem: MarketItem = {
          id: d.id, name: d.name, price: d.price, currency: d.currency,
          timestamp: d.timestamp, iconUrl: d.icon_url || '',
        };
        setMarketItems(prev => prev.some(i => i.id === newItem.id) ? prev : [newItem, ...prev].slice(0, 100));
        setBotConnected(true);
        setLastUpdate(new Date());
        setAlerts(currentAlerts => {
          const updated = currentAlerts.map(alert => {
            if (itemMatchesAlert(newItem, alert)) {
              fireNotification(newItem, alert);
              return { ...alert, triggered: true, lastMatch: newItem, history: [newItem, ...(alert.history || [])].slice(0, 20) };
            }
            return alert;
          });
          localStorage.setItem('market_alerts', JSON.stringify(updated));
          return updated;
        });
      })
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [fetchItems, loadAlerts]);

  const handleAddAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
    const alert: MarketAlert = {
      id: `alert_${Date.now()}`, keyword: newKeyword.trim(),
      maxPrice: newMaxPrice ? parseFloat(newMaxPrice) : undefined,
      minEnhancement: newMinEnhancement ? parseInt(newMinEnhancement) : undefined,
      triggered: false, lastMatch: null, history: [], created_at: new Date().toISOString(),
    };
    saveAlerts([...alerts, alert]);
    setNewKeyword(''); setNewMaxPrice(''); setNewMinEnhancement('');
    setIsAlertModalOpen(false);
  };

  const handleDeleteAlert = (id: string) => saveAlerts(alerts.filter(a => a.id !== id));
  const handleDismissAlert = (id: string) => saveAlerts(alerts.map(a => a.id === id ? { ...a, triggered: false, lastMatch: null } : a));
  const handleSort = (key: string) => setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'desc' ? 'asc' : 'desc' }));

  const filteredItems = marketItems
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()) &&
      (currencyFilter === 'all' || item.currency.toLowerCase() === currencyFilter))
    .sort((a, b) => {
      const av = (a as any)[sortConfig.key], bv = (b as any)[sortConfig.key];
      return sortConfig.direction === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
    });

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const triggeredAlerts = alerts.filter(a => a.triggered);
  const isNew = (ts: string) => Date.now() - new Date(ts).getTime() < 60000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Market Tracker</h1>
          <p className="text-zinc-400 mt-1">Live feed do mercado ZGaming com histórico e ranking.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${botConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
            <div className={`w-2 h-2 rounded-full ${botConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
            {botConnected ? '🟢 Live' : '⚠️ Aguardando'}
          </div>
          <button onClick={() => setAlertsModalOpen(true)}
            className="relative flex items-center gap-2 px-3 py-1.5 bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 rounded-lg text-sm font-medium text-zinc-300 transition-colors">
            <Bell className="w-4 h-4" />Alertas ({alerts.length})
            {triggeredAlerts.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">{triggeredAlerts.length}</span>
            )}
          </button>
          <button onClick={() => setIsAlertModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Novo Alerta
          </button>
        </div>
      </div>

      {/* Triggered alerts */}
      {triggeredAlerts.map(alert => (
        <div key={alert.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-300">
                "{alert.keyword}" {alert.maxPrice && `≤ ${alert.maxPrice} zCoin`} {alert.minEnhancement && `+${alert.minEnhancement}+`}
              </p>
              {alert.lastMatch && <p className="text-xs text-zinc-400">{alert.lastMatch.name} — {alert.lastMatch.price} {alert.lastMatch.currency} às {formatTime(alert.lastMatch.timestamp)}</p>}
            </div>
          </div>
          <button onClick={() => handleDismissAlert(alert.id)} className="text-zinc-500 hover:text-zinc-300"><X className="w-4 h-4" /></button>
        </div>
      ))}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main market table */}
        <div className="lg:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input type="text" placeholder="Buscar item..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)}
              className="w-full sm:w-36 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="all">Todas moedas</option>
              <option value="zcoin">zCoin</option>
              <option value="adena">Adena</option>
            </select>
            {lastUpdate && <span className="text-xs text-zinc-500 whitespace-nowrap">{formatTime(lastUpdate.toISOString())}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-zinc-950/50 text-zinc-400 uppercase tracking-wider text-xs font-medium">
                <tr>
                  <th className="px-6 py-3 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('name')}><div className="flex items-center gap-1">Item <ArrowUpDown className="w-3 h-3" /></div></th>
                  <th className="px-6 py-3 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('price')}><div className="flex items-center gap-1">Preço <ArrowUpDown className="w-3 h-3" /></div></th>
                  <th className="px-6 py-3 cursor-pointer hover:text-zinc-200" onClick={() => handleSort('timestamp')}><div className="flex items-center gap-1">Hora <ArrowUpDown className="w-3 h-3" /></div></th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {loading ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500">Conectando...</td></tr>
                ) : filteredItems.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                    {botConnected ? 'Nenhum item encontrado.' : '⚠️ Aguardando dados...'}
                  </td></tr>
                ) : filteredItems.map(item => {
                  const matchedAlert = alerts.find(a => itemMatchesAlert(item, a));
                  const itemIsNew = isNew(item.timestamp);
                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors group">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                            <img src={item.iconUrl} alt={item.name} className="w-8 h-8 object-contain"
                              onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={item.name.includes('+') ? 'font-medium text-amber-400' : 'font-medium text-zinc-200'}>{item.name}</span>
                            {itemIsNew && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full animate-pulse">NEW</span>}
                            {matchedAlert && <Bell className="w-3 h-3 text-indigo-400 shrink-0" />}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className="font-bold text-amber-500">{item.price.toLocaleString()} {item.currency}</span>
                      </td>
                      <td className="px-6 py-3 text-zinc-400">
                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-zinc-500" />{formatTime(item.timestamp)}</div>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openChart(item.name)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs">
                            <BarChart2 className="w-3 h-3" /> Gráfico
                          </button>
                          <button onClick={() => { setNewKeyword(normalizeItemName(item.name)); setIsAlertModalOpen(true); }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${matchedAlert ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}>
                            <Bell className="w-3 h-3" />{matchedAlert ? 'Watching' : 'Notify Me'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ranking sidebar */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden h-fit">
          <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h2 className="font-semibold text-zinc-100 text-sm">Mais Listados</h2>
          </div>
          <div className="p-3 space-y-1">
            {ranking.length === 0 ? (
              <p className="text-zinc-500 text-xs text-center py-4">Aguardando dados...</p>
            ) : ranking.map((item, i) => (
              <button key={item.name} onClick={() => openChart(item.name)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-left group">
                <span className={`text-xs font-bold w-5 text-center shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-amber-600' : 'text-zinc-500'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                  <img src={item.icon} alt={item.name} className="w-6 h-6 object-contain"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-200 truncate">{item.name}</p>
                  <p className="text-[11px] text-zinc-500">{item.count}x • min {item.minPrice} zCoin</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Price Chart Modal */}
      {chartItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-zinc-100">Histórico de Preço</h2>
                <span className="text-sm text-zinc-400">— {chartItem}</span>
              </div>
              <button onClick={() => setChartItem(null)} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              {chartLoading ? (
                <div className="h-64 flex items-center justify-center text-zinc-500">Carregando dados...</div>
              ) : chartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-zinc-500">Nenhum dado histórico encontrado.</div>
              ) : (
                <>
                  <div className="flex gap-4 mb-4 text-sm">
                    <div className="px-3 py-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="text-zinc-500">Mín </span>
                      <span className="text-emerald-400 font-bold">{Math.min(...chartData.map(d => d.price))} zCoin</span>
                    </div>
                    <div className="px-3 py-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="text-zinc-500">Máx </span>
                      <span className="text-red-400 font-bold">{Math.max(...chartData.map(d => d.price))} zCoin</span>
                    </div>
                    <div className="px-3 py-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="text-zinc-500">Média </span>
                      <span className="text-amber-400 font-bold">{Math.round(chartData.reduce((a, b) => a + b.price, 0) / chartData.length)} zCoin</span>
                    </div>
                    <div className="px-3 py-1.5 bg-zinc-950 rounded-lg border border-zinc-800">
                      <span className="text-zinc-500">Listagens </span>
                      <span className="text-zinc-200 font-bold">{chartData.length}</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis dataKey="time" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} />
                      <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false}
                        tickFormatter={v => `${v}`} />
                      <Tooltip
                        contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px' }}
                        labelStyle={{ color: '#a1a1aa', fontSize: '12px' }}
                        itemStyle={{ color: '#f59e0b', fontSize: '13px', fontWeight: 'bold' }}
                        formatter={(v: any) => [`${v} zCoin`, 'Preço']}
                      />
                      <Line type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={2}
                        dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5, fill: '#818cf8' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Alert Modal */}
      {isAlertModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <div className="flex items-center gap-2"><Bell className="w-5 h-5 text-indigo-400" /><h2 className="text-lg font-bold text-zinc-100">Criar Alerta</h2></div>
              <button onClick={() => setIsAlertModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAddAlert} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Palavra-chave *</label>
                <input required type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                  placeholder="ex: Talisman of Aden, Cloak"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1"><DollarSign className="w-3 h-3 inline mr-1" />Preço máximo</label>
                  <input type="number" min="1" value={newMaxPrice} onChange={e => setNewMaxPrice(e.target.value)} placeholder="ex: 50"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-1">Enhancement mín.</label>
                  <input type="number" min="1" max="15" value={newMinEnhancement} onChange={e => setNewMinEnhancement(e.target.value)} placeholder="ex: 5"
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIsAlertModalOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-zinc-200">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">Criar Alerta</button>
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
              <button onClick={() => setAlertsModalOpen(false)} className="text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <BellOff className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">Nenhum alerta configurado.</p>
                </div>
              ) : alerts.map(alert => (
                <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border mb-2 ${alert.triggered ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-950/50 border-zinc-800'}`}>
                  <div className="flex items-center gap-2">
                    {alert.triggered ? <Zap className="w-4 h-4 text-amber-400 shrink-0" /> : <Bell className="w-4 h-4 text-zinc-500 shrink-0" />}
                    <div>
                      <p className="text-sm font-medium text-zinc-100">"{alert.keyword}"</p>
                      <div className="flex gap-2 flex-wrap">
                        {alert.maxPrice && <span className="text-xs text-zinc-400">≤ {alert.maxPrice} zCoin</span>}
                        {alert.minEnhancement && <span className="text-xs text-zinc-400">+{alert.minEnhancement}+</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.triggered && <button onClick={() => handleDismissAlert(alert.id)} className="text-xs text-zinc-400 hover:text-zinc-200">Dispensar</button>}
                    <button onClick={() => handleDeleteAlert(alert.id)} className="text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
