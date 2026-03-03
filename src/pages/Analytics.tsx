import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, Activity, Package } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

interface MarketItem {
    id: string;
    name: string;
    price: number;
    currency: string;
    timestamp: string;
}

function normalizeItemName(name: string) {
    return name.replace(/^\+\d+\s*/, '').trim();
}

export default function Analytics() {
    const [items, setItems] = useState<MarketItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        const { data } = await supabase
            .from('market_items')
            .select('id, name, price, currency, timestamp')
            .order('timestamp', { ascending: false })
            .limit(500);
        if (data) setItems(data);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    if (loading) return <div className="flex items-center justify-center h-64 text-zinc-500">Carregando analytics...</div>;

    // === Computations ===
    const today = items.filter(i => new Date(i.timestamp).toDateString() === new Date().toDateString());

    // Top items by frequency
    const freq: Record<string, { count: number; prices: number[] }> = {};
    items.forEach(i => {
        const k = normalizeItemName(i.name);
        if (!freq[k]) freq[k] = { count: 0, prices: [] };
        freq[k].count++;
        freq[k].prices.push(i.price);
    });
    const topItems = Object.entries(freq)
        .map(([name, v]) => ({ name, count: v.count, avg: Math.round(v.prices.reduce((a, b) => a + b, 0) / v.prices.length), min: Math.min(...v.prices) }))
        .sort((a, b) => b.count - a.count).slice(0, 8);

    // Volume by hour
    const byHour: Record<number, number> = {};
    for (let h = 0; h < 24; h++) byHour[h] = 0;
    items.forEach(i => { byHour[new Date(i.timestamp).getHours()]++; });
    const hourData = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}h`, count: byHour[h] }));

    // Most expensive
    const mostExpensive = [...items].sort((a, b) => b.price - a.price).slice(0, 5);
    const cheapest = [...items].sort((a, b) => a.price - b.price).slice(0, 5);

    // Price trend (last 20 items, by insertion order)
    const trendData = [...items].reverse().slice(-30).map(i => ({
        time: new Date(i.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        price: i.price,
    }));

    const avgAll = items.length ? Math.round(items.reduce((a, b) => a + b.price, 0) / items.length) : 0;
    const fmt = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-zinc-100">Analytics</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Análise do mercado ZGaming — últimas {items.length} listagens</p>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Total listagens', value: items.length.toString(), icon: Package, color: 'text-indigo-400' },
                    { label: 'Hoje', value: today.length.toString(), icon: Activity, color: 'text-emerald-400' },
                    { label: 'Preço médio geral', value: `${avgAll} zCoin`, icon: BarChart2, color: 'text-amber-400' },
                    { label: 'Itens únicos', value: Object.keys(freq).length.toString(), icon: TrendingUp, color: 'text-purple-400' },
                ].map(s => (
                    <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                        <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
                        <p className="text-xs text-zinc-500">{s.label}</p>
                        <p className="text-lg font-bold text-zinc-100">{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Top items bar chart */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-zinc-300 mb-4">🏆 Mais Listados</h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={topItems} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" horizontal={false} />
                            <XAxis type="number" tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} />
                            <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#a1a1aa', fontSize: 11 }} tickLine={false}
                                tickFormatter={v => v.length > 14 ? v.slice(0, 14) + '…' : v} />
                            <Tooltip
                                contentStyle={{ background: '#111116', border: '1px solid #27272a', borderRadius: '8px' }}
                                labelStyle={{ color: '#a1a1aa', fontSize: '11px' }}
                                formatter={(v: any) => [v, 'listagens']}
                            />
                            <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Volume by hour */}
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <h2 className="text-sm font-semibold text-zinc-300 mb-4">🕐 Listagens por Hora</h2>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={hourData} margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                            <XAxis dataKey="hour" tick={{ fill: '#52525b', fontSize: 10 }} tickLine={false}
                                interval={3} />
                            <YAxis tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ background: '#111116', border: '1px solid #27272a', borderRadius: '8px' }}
                                labelStyle={{ color: '#a1a1aa', fontSize: '11px' }}
                                formatter={(v: any) => [v, 'listagens']}
                            />
                            <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Price trend */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-zinc-300 mb-4">📈 Tendência de Preços (últimas 30 listagens)</h2>
                <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trendData} margin={{ left: 0, right: 10, top: 5, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                        <XAxis dataKey="time" tick={{ fill: '#52525b', fontSize: 10 }} tickLine={false} interval={4} />
                        <YAxis tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip
                            contentStyle={{ background: '#111116', border: '1px solid #27272a', borderRadius: '8px' }}
                            formatter={(v: any) => [`${v} zCoin`, 'Preço']}
                        />
                        <Line type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2}
                            dot={false} activeDot={{ r: 4, fill: '#f59e0b', strokeWidth: 0 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 2-column: most expensive + cheapest */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {[
                    { title: '🔴 Mais Caros', items: mostExpensive, icon: TrendingUp, color: 'text-red-400' },
                    { title: '🟢 Mais Baratos', items: cheapest, icon: TrendingDown, color: 'text-emerald-400' },
                ].map(section => (
                    <div key={section.title} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-zinc-800">
                            <h2 className="text-sm font-semibold text-zinc-300">{section.title}</h2>
                        </div>
                        <div className="divide-y divide-zinc-800/50">
                            {section.items.map(item => (
                                <div key={item.id} className="flex items-center justify-between px-4 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-medium truncate ${item.name.includes('+') ? 'text-amber-400' : 'text-zinc-200'}`}>{item.name}</p>
                                        <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                                            <Clock className="w-3 h-3" />{fmt(item.timestamp)}
                                        </div>
                                    </div>
                                    <span className={`font-bold text-sm shrink-0 ml-3 ${section.color}`}>{item.price} {item.currency}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
