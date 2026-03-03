import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Clock, ArrowUpDown, Filter, Bell, Plus, X, Zap, Trash2, DollarSign, TrendingUp, ChevronRight, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

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
    max_price?: number;
    min_enhancement?: number;
    triggered?: boolean;
    lastMatch?: MarketItem | null;
    history?: MarketItem[];
    created_at: string;
}

const POLL_INTERVAL = 5000;

async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    return (await Notification.requestPermission()) === 'granted';
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
    if (!item.name.toLowerCase().includes(alert.keyword.toLowerCase())) return false;
    const maxP = alert.maxPrice ?? alert.max_price;
    const minE = alert.minEnhancement ?? alert.min_enhancement;
    if (maxP !== undefined && maxP !== null && item.price > maxP) return false;
    if (minE !== undefined && minE !== null) {
        const m = item.name.match(/\+(\d+)/);
        if ((m ? parseInt(m[1]) : 0) < minE) return false;
    }
    return true;
}

function normalizeItemName(name: string) {
    return name.replace(/^\+\d+\s*/, '').trim();
}

function extractQuantity(name: string) {
    const match = name.match(/\[\s*(\d+)\s*pcs\.?\]/i) || name.match(/\bx\s*(\d+)\b/i) || name.match(/\b(\d+)\s*x\b/i);
    return match ? parseInt(match[1], 10) : 1;
}

function isNew(ts: string) {
    return Date.now() - new Date(ts).getTime() < 60000;
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function MarketHome() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, signInWithDiscord } = useAuth();
    const [items, setItems] = useState<MarketItem[]>([]);
    const [alerts, setAlerts] = useState<MarketAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [live, setLive] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
    const [search, setSearch] = useState('');
    const [currencyFilter, setCurrencyFilter] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
    const [alertModal, setAlertModal] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');
    const [newMaxPrice, setNewMaxPrice] = useState('');
    const [newMinEnhancement, setNewMinEnhancement] = useState('');
    const iconCache = useRef<Record<string, string>>({});

    const fetchItems = useCallback(async () => {
        const { data, error } = await supabase
            .from('market_items').select('*').order('timestamp', { ascending: false }).limit(100);
        if (!error && data) {
            setItems(data.map((d: any) => ({ id: d.id, name: d.name, price: d.price, currency: d.currency, timestamp: d.timestamp, iconUrl: d.icon_url || '' })));
            setLive(true); setLastUpdate(new Date());
        }
        setLoading(false);
    }, []);

    const loadAlerts = useCallback(async () => {
        if (!user) {
            setAlerts([]);
            return;
        }
        const { data } = await supabase.from('user_alerts').select('*').order('created_at', { ascending: false });
        if (data) {
            setAlerts(data.map((a: any) => ({ ...a, triggered: false, lastMatch: null, history: [] })));
        }
    }, [user]);

    useEffect(() => {
        const queryAlert = searchParams.get('alert');
        if (queryAlert && user) {
            setNewKeyword(queryAlert);
            setAlertModal(true);
        }
    }, [searchParams, user]);

    // Local updates for UI
    const updateAlertState = (updated: MarketAlert[]) => {
        setAlerts(updated);
    };

    useEffect(() => {
        fetchItems(); loadAlerts();
        const interval = setInterval(fetchItems, POLL_INTERVAL);
        const channel = supabase.channel('market_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'market_items' }, (payload) => {
                const d = payload.new as any;
                const newItem: MarketItem = { id: d.id, name: d.name, price: d.price, currency: d.currency, timestamp: d.timestamp, iconUrl: d.icon_url || '' };
                setItems(prev => prev.some(i => i.id === newItem.id) ? prev : [newItem, ...prev].slice(0, 100));
                setLive(true); setLastUpdate(new Date());
                setAlerts(cur => {
                    const updated = cur.map(a => itemMatchesAlert(newItem, a)
                        ? (fireNotification(newItem, a), { ...a, triggered: true, lastMatch: newItem, history: [newItem, ...(a.history || [])].slice(0, 20) })
                        : a);
                    return updated;
                });
            }).subscribe();
        return () => { clearInterval(interval); supabase.removeChannel(channel); };
    }, [fetchItems, loadAlerts]);

    const handleAddAlert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            signInWithDiscord();
            return;
        }
        if (!newKeyword.trim()) return;
        requestNotificationPermission(); // dont await, just request

        const discord_id = user.user_metadata?.provider_id || user.user_metadata?.sub || '';

        const { data, error } = await supabase.from('user_alerts').insert({
            user_id: user.id,
            discord_id,
            keyword: newKeyword.trim(),
            max_price: newMaxPrice ? parseFloat(newMaxPrice) : null,
            min_enhancement: newMinEnhancement ? parseInt(newMinEnhancement) : null,
        }).select().single();

        if (data) {
            updateAlertState([{ ...data, triggered: false, lastMatch: null, history: [] }, ...alerts]);
        }
        setNewKeyword(''); setNewMaxPrice(''); setNewMinEnhancement(''); setAlertModal(false);
    };

    const ranking = useMemo(() => {
        const counts: Record<string, { count: number; prices: number[] }> = {};
        items.forEach(item => {
            const key = normalizeItemName(item.name);
            if (!iconCache.current[key] && item.iconUrl) iconCache.current[key] = item.iconUrl;
            if (!counts[key]) counts[key] = { count: 0, prices: [] };
            counts[key].count++;
            counts[key].prices.push(item.price);
        });
        return Object.entries(counts).map(([name, v]) => ({
            name, count: v.count,
            minPrice: Math.min(...v.prices),
            avgPrice: Math.round(v.prices.reduce((a, b) => a + b, 0) / v.prices.length),
            icon: iconCache.current[name] || '',
        })).sort((a, b) => b.count - a.count).slice(0, 8);
    }, [items]);

    // Stats
    const todayItems = items.filter(i => new Date(i.timestamp).toDateString() === new Date().toDateString());
    const avgPrice = todayItems.length ? Math.round(todayItems.reduce((a, b) => a + b.price, 0) / todayItems.length) : 0;

    const sorted = [...items]
        .filter(i => i.name.toLowerCase().includes(search.toLowerCase()) && (currencyFilter === 'all' || i.currency.toLowerCase() === currencyFilter))
        .sort((a, b) => {
            const av = (a as any)[sortConfig.key], bv = (b as any)[sortConfig.key];
            return sortConfig.direction === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
        });

    const handleSort = (key: string) => setSortConfig(c => ({ key, direction: c.key === key && c.direction === 'desc' ? 'asc' : 'desc' }));
    const triggeredAlerts = alerts.filter(a => a.triggered);

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Live Market</h1>
                    <p className="text-sm text-zinc-500 mt-0.5">ZGaming — Lineage 2 market feed em tempo real</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${live ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`}>
                        <Activity className={`w-3 h-3 ${live ? 'animate-pulse' : ''}`} />
                        {live ? 'LIVE' : 'Offline'}
                        {lastUpdate && <span className="text-zinc-500 font-normal hidden sm:inline">· {formatTime(lastUpdate.toISOString())}</span>}
                    </div>
                    <button onClick={() => user ? setAlertModal(true) : signInWithDiscord()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors">
                        <Bell className="w-3.5 h-3.5" /> Novo Alerta
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Itens hoje', value: todayItems.length.toString(), icon: TrendingUp, color: 'text-indigo-400' },
                    { label: 'Preço médio', value: `${avgPrice} zCoin`, icon: DollarSign, color: 'text-amber-400' },
                    { label: 'Alertas ativos', value: alerts.length.toString(), icon: Bell, color: 'text-emerald-400' },
                ].map(s => (
                    <div key={s.label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                            <s.icon className={`w-4 h-4 ${s.color}`} />
                        </div>
                        <div>
                            <p className="text-xs text-zinc-500">{s.label}</p>
                            <p className="text-sm font-bold text-zinc-100">{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Triggered alerts */}
            {triggeredAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-center gap-3">
                        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-amber-300">
                                "{alert.keyword}" {(alert.maxPrice || alert.max_price) && `≤ ${alert.maxPrice || alert.max_price} zCoin`} {(alert.minEnhancement || alert.min_enhancement) && `+${alert.minEnhancement || alert.min_enhancement}+`}
                            </p>
                            {alert.lastMatch && <p className="text-xs text-zinc-400">{alert.lastMatch.name} — {alert.lastMatch.price} {alert.lastMatch.currency}</p>}
                        </div>
                    </div>
                    <button onClick={() => updateAlertState(alerts.map(a => a.id === alert.id ? { ...a, triggered: false, lastMatch: null } : a))} className="text-zinc-500 hover:text-zinc-300">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                {/* Market table */}
                <div className="lg:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                    <div className="p-3 border-b border-zinc-800 flex gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <input type="text" placeholder="Buscar item..." value={search} onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                        </div>
                        <select value={currencyFilter} onChange={e => setCurrencyFilter(e.target.value)}
                            className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                            <option value="all">Todas</option>
                            <option value="zcoin">zCoin</option>
                            <option value="adena">Adena</option>
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-950/60 text-zinc-500 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2.5 text-left cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">Item <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-4 py-2.5 text-left cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('price')}>
                                        <div className="flex items-center gap-1">Preço <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-4 py-2.5 text-left cursor-pointer hover:text-zinc-300 transition-colors" onClick={() => handleSort('timestamp')}>
                                        <div className="flex items-center gap-1">Hora <ArrowUpDown className="w-3 h-3" /></div>
                                    </th>
                                    <th className="px-4 py-2.5 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {loading ? (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-600 text-sm">Conectando ao mercado...</td></tr>
                                ) : sorted.length === 0 ? (
                                    <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-600 text-sm">
                                        {live ? 'Nenhum item encontrado.' : 'Aguardando dados do mercado...'}
                                    </td></tr>
                                ) : sorted.map(item => {
                                    const matched = alerts.find(a => itemMatchesAlert(item, a));
                                    return (
                                        <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors group cursor-pointer" onClick={() => navigate(`/item/${encodeURIComponent(normalizeItemName(item.name))}`)}>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-9 h-9 rounded-lg bg-zinc-950 border border-zinc-800/60 flex items-center justify-center overflow-hidden shrink-0">
                                                        <img src={item.iconUrl} alt={item.name} className="w-7 h-7 object-contain"
                                                            onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className={`font-medium ${item.name.includes('+') ? 'text-amber-400' : 'text-zinc-200'}`}>{item.name}</span>
                                                        {isNew(item.timestamp) && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-full">NEW</span>}
                                                        {matched && <Bell className="w-3 h-3 text-indigo-400" />}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-amber-500">{item.price.toLocaleString()} {item.currency}</span>
                                                    {extractQuantity(item.name) > 1 && (
                                                        <span className="text-[10px] text-zinc-500">
                                                            {extractQuantity(item.name)}x • {(item.price / extractQuantity(item.name)).toLocaleString(undefined, { maximumFractionDigits: 1 })} {item.currency}/un
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-zinc-500 text-xs">
                                                <div className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(item.timestamp)}</div>
                                            </td>
                                            <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => { if (!user) { signInWithDiscord(); return; } setNewKeyword(normalizeItemName(item.name)); setAlertModal(true); }}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${matched ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}>
                                                    <Bell className="w-3 h-3" />{matched ? 'Watching' : 'Alert'}
                                                </button>
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
                    <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-400" />
                        <span className="text-sm font-semibold text-zinc-100">Top Listados</span>
                    </div>
                    <div className="p-2 space-y-0.5">
                        {ranking.length === 0 ? (
                            <p className="text-zinc-600 text-xs text-center py-6">Aguardando dados...</p>
                        ) : ranking.map((item, i) => (
                            <button key={item.name} onClick={() => navigate(`/item/${encodeURIComponent(item.name)}`)}
                                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors text-left group">
                                <span className={`text-xs font-bold w-4 text-center shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-zinc-300' : i === 2 ? 'text-orange-600' : 'text-zinc-600'}`}>{i + 1}</span>
                                <div className="w-7 h-7 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                    <img src={item.icon} alt={item.name} className="w-5 h-5 object-contain"
                                        onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-zinc-200 truncate">{item.name}</p>
                                    <p className="text-[10px] text-zinc-500">{item.count}x · min {item.minPrice} zCoin</p>
                                </div>
                                <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 shrink-0 transition-colors" />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Alert modal */}
            {alertModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                            <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-indigo-400" /><h2 className="font-bold text-zinc-100">Criar Alerta</h2></div>
                            <button onClick={() => { setAlertModal(false); setNewKeyword(''); setNewMaxPrice(''); setNewMinEnhancement(''); }} className="text-zinc-500 hover:text-zinc-300"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAddAlert} className="p-4 space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-zinc-400 mb-1">Item *</label>
                                <input required type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                                    placeholder="ex: Talisman of Aden"
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Preço máximo (zCoin)</label>
                                    <input type="number" min="1" value={newMaxPrice} onChange={e => setNewMaxPrice(e.target.value)} placeholder="ex: 50"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">Enhancement mín.</label>
                                    <input type="number" min="1" max="15" value={newMinEnhancement} onChange={e => setNewMinEnhancement(e.target.value)} placeholder="ex: 5"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setAlertModal(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold">Criar Alerta</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
