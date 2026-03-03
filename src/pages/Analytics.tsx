import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Clock, Activity, Package, DollarSign, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { supabase } from '../lib/supabase';
import { useServer } from '../lib/ServerContext';

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
    const { activeServer, serverMeta } = useServer();
    const [items, setItems] = useState<MarketItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const { data } = await supabase
            .from('market_items')
            .select('id, name, price, currency, timestamp')
            .eq('server_id', activeServer)
            .order('timestamp', { ascending: false })
            .limit(1000); // Maior amostra
        if (data) setItems(data);
        setLoading(false);
    }, [activeServer]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // === Processamento de Dados (Memoizado para performance) ===
    const stats = useMemo(() => {
        if (!items.length) return null;

        const now = new Date();
        const todayItems = items.filter(i => new Date(i.timestamp).toDateString() === now.toDateString());

        // Frequência de itens
        const freq: Record<string, { count: number; prices: number[] }> = {};
        let totalVolume = 0;

        items.forEach(i => {
            const k = normalizeItemName(i.name);
            if (!freq[k]) freq[k] = { count: 0, prices: [] };
            freq[k].count++;
            freq[k].prices.push(i.price);
            totalVolume += i.price;
        });

        const topItems = Object.entries(freq)
            .map(([name, v]) => ({
                name,
                count: v.count,
                avg: Math.round(v.prices.reduce((a, b) => a + b, 0) / v.prices.length)
            }))
            .sort((a, b) => b.count - a.count).slice(0, 10);

        // Atividade por Hora (últimas 24h)
        const byHour: Record<number, number> = {};
        for (let h = 0; h < 24; h++) byHour[h] = 0;

        items.forEach(i => {
            const itemDate = new Date(i.timestamp);
            // Só conta se for das últimas 24h
            if (now.getTime() - itemDate.getTime() <= 24 * 60 * 60 * 1000) {
                byHour[itemDate.getHours()]++;
            }
        });

        // Formata para o gráfico começar na hora atual - 24h e ir preenchendo até agora
        const currentHour = now.getHours();
        const hourData = Array.from({ length: 24 }, (_, i) => {
            const h = (currentHour - 23 + i + 24) % 24;
            return { hour: `${h}h`, count: byHour[h] };
        });

        // Top Valores (Mais Caros e Mais Baratos)
        const mostExpensive = [...items].sort((a, b) => b.price - a.price).slice(0, 8);
        const cheapest = [...items].sort((a, b) => a.price - b.price).slice(0, 8);

        return {
            totalItems: items.length,
            todayCount: todayItems.length,
            uniqueCount: Object.keys(freq).length,
            avgPrice: Math.round(totalVolume / items.length),
            totalVolume,
            topItems,
            hourData,
            mostExpensive,
            cheapest
        };
    }, [items]);

    const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3">
                <Activity className="w-8 h-8 animate-pulse text-indigo-500" />
                <p>Analisando dados do {serverMeta.name}...</p>
            </div>
        );
    }

    if (!stats) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
                <Package className="w-12 h-12 mb-3 opacity-20" />
                <p>Nenhum dado suficiente para o {serverMeta.name} ainda.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
                        <BarChart2 className={`w-6 h-6 text-${serverMeta.colorTheme}-400`} />
                        Analytics do Mercado
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">Visão detalhada e métricas do servidor <strong className="text-zinc-300">{serverMeta.name}</strong> (Múltiplas leituras)</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs text-zinc-400">
                    Amostra: <span className="text-zinc-200 font-semibold">{stats.totalItems}</span> últimas listagens
                </div>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-indigo-500/50 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Activity className="w-4 h-4" /></div>
                        <h3 className="text-xs font-medium text-zinc-400">Volume Hoje (24h)</h3>
                    </div>
                    <p className="text-2xl font-bold text-zinc-100">{stats.todayCount}</p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-emerald-500/50 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Layers className="w-4 h-4" /></div>
                        <h3 className="text-xs font-medium text-zinc-400">Itens Únicos</h3>
                    </div>
                    <p className="text-2xl font-bold text-zinc-100">{stats.uniqueCount}</p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-amber-500/50 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400"><TrendingUp className="w-4 h-4" /></div>
                        <h3 className="text-xs font-medium text-zinc-400">Preço Médio (Geral)</h3>
                    </div>
                    <p className="text-2xl font-bold text-zinc-100">{stats.avgPrice.toLocaleString()} <span className="text-sm font-normal text-zinc-500">{serverMeta.currency}</span></p>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 hover:border-purple-500/50 transition-colors">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><DollarSign className="w-4 h-4" /></div>
                        <h3 className="text-xs font-medium text-zinc-400">Riqueza Movimentada</h3>
                    </div>
                    <p className="text-2xl font-bold text-zinc-100" title={stats.totalVolume.toLocaleString() + ' ' + serverMeta.currency}>
                        {stats.totalVolume > 1000000 ? (stats.totalVolume / 1000000).toFixed(1) + 'M' : stats.totalVolume.toLocaleString()}
                        <span className="text-sm font-normal text-zinc-500 ml-1">{serverMeta.currency}</span>
                    </p>
                </div>
            </div>

            {/* Gráficos Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Atividade do Mercado (Área) */}
                <div className="bg-[#13131a] border border-zinc-800/80 rounded-2xl p-5 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-base font-semibold text-zinc-200">Atividade do Mercado (Últimas 24h)</h2>
                        <p className="text-xs text-zinc-500">Volume de anúncios postados por hora no servidor.</p>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.hourData} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={serverMeta.colorTheme === 'red' ? '#ef4444' : '#6366f1'} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={serverMeta.colorTheme === 'red' ? '#ef4444' : '#6366f1'} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" vertical={false} />
                                <XAxis dataKey="hour" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} interval={2} />
                                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <RechartsTooltip
                                    contentStyle={{ background: '#181824', border: '1px solid #27272a', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                    itemStyle={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}
                                    labelStyle={{ color: '#a1a1aa', fontSize: '12px', marginBottom: '4px' }}
                                    formatter={(v: any) => [v, 'Anúncios']}
                                    labelFormatter={(label) => `Horário: ${label}`}
                                />
                                <Area type="monotone" dataKey="count" stroke={serverMeta.colorTheme === 'red' ? '#ef4444' : '#6366f1'} strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Itens mais Listados (Barra Horizontal) */}
                <div className="bg-[#13131a] border border-zinc-800/80 rounded-2xl p-5 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-base font-semibold text-zinc-200">Itens com Maior Liquidez</h2>
                        <p className="text-xs text-zinc-500">Top 10 itens que mais aparecem à venda no {serverMeta.name}.</p>
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.topItems} layout="vertical" margin={{ left: 0, right: 10, top: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" horizontal={false} />
                                <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <YAxis type="category" dataKey="name" width={130} tick={{ fill: '#a1a1aa', fontSize: 11, fontWeight: 500 }} tickLine={false} axisLine={false}
                                    tickFormatter={v => v.length > 18 ? v.slice(0, 18) + '…' : v} />
                                <RechartsTooltip
                                    cursor={{ fill: '#27272a', opacity: 0.4 }}
                                    contentStyle={{ background: '#181824', border: '1px solid #27272a', borderRadius: '12px' }}
                                    itemStyle={{ color: '#e4e4e7', fontSize: '12px' }}
                                    formatter={(v: any, name: string) => name === 'count' ? [v, 'Listagens'] : [`${v} ${serverMeta.currency}`, 'Preço Médio']}
                                />
                                <Bar dataKey="count" fill={serverMeta.colorTheme === 'red' ? '#f87171' : '#818cf8'} radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Listas de Destaques: Caros vs Baratos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* High Ticket Items */}
                <div className="bg-[#13131a] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/30">
                        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            Itens High-Ticket (Maior Preço)
                        </h2>
                    </div>
                    <div className="divide-y divide-zinc-800/40 p-2 flex-1">
                        {stats.mostExpensive.map((item, i) => (
                            <div key={item.id + i} className="flex items-center justify-between px-3 py-3 hover:bg-zinc-800/20 rounded-lg transition-colors group">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-500 w-4">{i + 1}.</span>
                                        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-indigo-400 transition-colors">{item.name}</p>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 mt-0.5 ml-6 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {fmt(item.timestamp)}
                                    </p>
                                </div>
                                <div className="text-right ml-4">
                                    <span className="font-bold text-sm text-emerald-400 block">{item.price.toLocaleString()}</span>
                                    <span className="text-[10px] text-zinc-500 font-medium uppercase">{serverMeta.currency}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Low Ticket / Bargains */}
                <div className="bg-[#13131a] border border-zinc-800/80 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                    <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/30">
                        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-400" />
                            Oportunidades ou Low-Ticket
                        </h2>
                    </div>
                    <div className="divide-y divide-zinc-800/40 p-2 flex-1">
                        {stats.cheapest.map((item, i) => (
                            <div key={item.id + i} className="flex items-center justify-between px-3 py-3 hover:bg-zinc-800/20 rounded-lg transition-colors group">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-zinc-500 w-4">{i + 1}.</span>
                                        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-red-400 transition-colors">{item.name}</p>
                                    </div>
                                    <p className="text-[11px] text-zinc-500 mt-0.5 ml-6 flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {fmt(item.timestamp)}
                                    </p>
                                </div>
                                <div className="text-right ml-4">
                                    <span className="font-bold text-sm text-red-400 block">{item.price.toLocaleString()}</span>
                                    <span className="text-[10px] text-zinc-500 font-medium uppercase">{serverMeta.currency}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
