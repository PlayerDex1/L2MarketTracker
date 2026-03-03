import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, TrendingDown, TrendingUp, BarChart2, Bell } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

interface HistoryItem {
    id: string;
    name: string;
    price: number;
    currency: string;
    timestamp: string;
    iconUrl: string;
}

function extractQuantity(name: string) {
    const match = name.match(/\[\s*(\d+)\s*pcs\.?\]/i) || name.match(/\bx\s*(\d+)\b/i) || name.match(/\b(\d+)\s*x\b/i);
    return match ? parseInt(match[1], 10) : 1;
}

export default function ItemDetail() {
    const { name } = useParams<{ name: string }>();
    const navigate = useNavigate();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchHistory = useCallback(async () => {
        if (!name) return;
        const { data } = await supabase
            .from('market_items')
            .select('*')
            .ilike('name', `%${name}%`)
            .order('timestamp', { ascending: true })
            .limit(100);
        if (data) {
            setHistory(data.map((d: any) => ({
                id: d.id, name: d.name, price: d.price, currency: d.currency,
                timestamp: d.timestamp, iconUrl: d.icon_url || '',
            })));
        }
        setLoading(false);
    }, [name]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const formatTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const formatTimeShort = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const prices = history.map(h => h.price);
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;
    const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

    const chartData = history.map(h => ({ time: formatTimeShort(h.timestamp), price: h.price, name: h.name }));
    const firstIcon = history.find(h => h.iconUrl)?.iconUrl || '';
    const currency = history[0]?.currency || 'zCoin';

    return (
        <div className="space-y-5">
            {/* Back + header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors text-sm">
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
            </div>

            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                    {firstIcon ? (
                        <img src={firstIcon} alt={name} className="w-12 h-12 object-contain"
                            onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                    ) : <BarChart2 className="w-6 h-6 text-zinc-600" />}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100 capitalize">{name}</h1>
                    <p className="text-sm text-zinc-500">{history.length} listagem(ns) encontrada(s)</p>
                </div>
                <div className="ml-auto">
                    <button onClick={() => navigate(`/?alert=${encodeURIComponent(name || '')}`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors">
                        <Bell className="w-3.5 h-3.5" /> Criar Alerta
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'Preço mínimo', value: `${minPrice.toLocaleString()} ${currency}`, icon: TrendingDown, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    { label: 'Preço máximo', value: `${maxPrice.toLocaleString()} ${currency}`, icon: TrendingUp, color: 'text-red-400', bg: 'bg-red-500/10' },
                    { label: 'Preço médio', value: `${avgPrice.toLocaleString()} ${currency}`, icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                    { label: 'Total listado', value: `${history.length}x`, icon: Clock, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                ].map(s => (
                    <div key={s.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                        <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                            <s.icon className={`w-4 h-4 ${s.color}`} />
                        </div>
                        <p className="text-xs text-zinc-500">{s.label}</p>
                        <p className="text-base font-bold text-zinc-100 mt-0.5">{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Price chart */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-indigo-400" /> Histórico de Preços
                </h2>
                {loading ? (
                    <div className="h-52 flex items-center justify-center text-zinc-600 text-sm">Carregando...</div>
                ) : chartData.length < 2 ? (
                    <div className="h-52 flex items-center justify-center text-zinc-600 text-sm">Dados insuficientes para o gráfico.</div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1f1f2e" />
                            <XAxis dataKey="time" tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} />
                            <YAxis tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ background: '#111116', border: '1px solid #27272a', borderRadius: '8px' }}
                                labelStyle={{ color: '#a1a1aa', fontSize: '11px' }}
                                itemStyle={{ color: '#f59e0b', fontSize: '13px', fontWeight: 'bold' }}
                                formatter={(v: any) => [`${v} ${currency}`, 'Preço']}
                            />
                            <Line type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={2}
                                dot={{ fill: '#6366f1', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#818cf8', strokeWidth: 0 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* History table */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800">
                    <h2 className="text-sm font-semibold text-zinc-300">Histórico de Listagens</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-950/50 text-zinc-500 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-2.5 text-left">Item</th>
                                <th className="px-4 py-2.5 text-left">Preço</th>
                                <th className="px-4 py-2.5 text-left">Data/Hora</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {[...history].reverse().map(item => (
                                <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                                <img src={item.iconUrl} alt={item.name} className="w-5 h-5 object-contain"
                                                    onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                                            </div>
                                            <span className={`font-medium ${item.name.includes('+') ? 'text-amber-400' : 'text-zinc-200'}`}>{item.name}</span>
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
                                    <td className="px-4 py-2.5 text-zinc-500 text-xs">{formatTime(item.timestamp)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
