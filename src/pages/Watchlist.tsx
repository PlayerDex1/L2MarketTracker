import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Trash2, Clock, Plus, Zap, History, Send, CheckCircle, Disc } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useServer } from '../lib/ServerContext';

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
    server_id: string;
    max_price?: number;
    min_enhancement?: number;
    created_at: string;
}

export default function Watchlist() {
    const { user, signInWithDiscord } = useAuth();
    const { activeServer } = useServer();
    const [alerts, setAlerts] = useState<MarketAlert[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAlerts = useCallback(async () => {
        if (!user) {
            setAlerts([]);
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(`/api/user_alerts?user_id=${user.id}&server_id=${activeServer}`);
            if (res.ok) {
                const data = await res.json();
                if (data) setAlerts(data);
            }
        } catch (e) {
            console.error('Error loading alerts:', e);
        }
        setLoading(false);
    }, [user, activeServer]);

    useEffect(() => {
        loadAlerts();
    }, [loadAlerts]);

    const handleDelete = async (id: string) => {
        const prev = [...alerts];
        setAlerts(prev.filter(a => a.id !== id));
        try {
            const res = await fetch(`/api/user_alerts/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Delete failed');
        } catch (error) {
            console.error(error);
            setAlerts(prev); // rollback
        }
    };

    const formatTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });

    if (!user) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 max-w-md text-center space-y-4 shadow-xl">
                    <Disc className="w-12 h-12 text-[#5865F2] mx-auto opacity-80" />
                    <div>
                        <h2 className="text-xl font-bold text-zinc-100">Watchlist Privada</h2>
                        <p className="text-sm text-zinc-500 mt-2">Faça o login com o Discord para visualizar, gerenciar e receber notificações dos seus alertas ativamente.</p>
                    </div>
                    <button onClick={signInWithDiscord} className="mt-4 px-6 py-2.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-sm font-semibold transition-colors shadow-lg shadow-indigo-500/20">
                        Login com Discord
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Watchlist</h1>
                    <p className="text-zinc-500 text-sm mt-0.5">Seus alertas e histórico de matches.</p>
                </div>
                <div className="flex items-center gap-2">
                    <a href="/"
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                        <Plus className="w-4 h-4" /> Novo Alerta
                    </a>
                </div>
            </div>

            {/* Alerts list */}
            {loading ? (
                <div className="py-12 text-center text-sm text-zinc-500">Carregando seus alertas...</div>
            ) : alerts.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl py-16 text-center">
                    <BellOff className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <h3 className="text-zinc-400 font-medium">Nenhum alerta configurado</h3>
                    <p className="text-zinc-600 text-sm mt-1">Vá ao Market Tracker e clique em "Criar Alerta" num item.</p>
                    <a href="/" className="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                        Ir ao Market Tracker
                    </a>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map(alert => (
                        <div key={alert.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden transition-all">
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-zinc-800">
                                        <Bell className="w-4 h-4 text-zinc-500" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${alert.server_id === 'pride' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'}`}>
                                                {alert.server_id}
                                            </span>
                                            <p className="text-base font-semibold text-zinc-100">"{alert.keyword}"</p>
                                            {alert.max_price && (
                                                <span className="text-xs px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-300">
                                                    ≤ {alert.max_price} zCoin
                                                </span>
                                            )}
                                            {alert.min_enhancement && (
                                                <span className="text-xs px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400">
                                                    +{alert.min_enhancement}+
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            Criado em {formatTime(alert.created_at)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button onClick={() => handleDelete(alert.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1.5" title="Apagar Alerta">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Discord connection info */}
            <div className={`border rounded-xl p-5 bg-[#5865F2]/10 border-[#5865F2]/20`}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#5865F2]/20">
                        <Disc className="w-4 h-4 text-[#5865F2]" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-100 text-sm">Notificações no Discord</h3>
                        <p className="text-xs text-zinc-400">Logado como <strong className="text-zinc-200">{user.user_metadata?.custom_claims?.global_name || user.email?.split('@')[0]}</strong> ({user.user_metadata?.provider_id})</p>
                    </div>
                    <CheckCircle className="w-4 h-4 text-[#5865F2] ml-auto" />
                </div>
                <div className="text-xs text-zinc-400 bg-zinc-950/50 border border-zinc-800 rounded-lg p-3 mt-4">
                    <p>O bot do ZGaming Market enviará uma <strong>Mensagem Direta (DM)</strong> para você assim que um item da sua Watchlist acima for listado no jogo!</p>
                    <p className="mt-1">Nenhuma configuração adicional é necessária.</p>
                </div>
            </div>
        </div>
    );
}
