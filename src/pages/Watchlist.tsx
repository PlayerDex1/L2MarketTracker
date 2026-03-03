import { useState, useEffect } from 'react';
import { Bell, BellOff, Trash2, Clock, Plus, X, Zap, History, Send, CheckCircle } from 'lucide-react';

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

export default function Watchlist() {
    const [alerts, setAlerts] = useState<MarketAlert[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [telegramId, setTelegramId] = useState('');
    const [telegramConnected, setTelegramConnected] = useState(false);
    const [telegramInput, setTelegramInput] = useState('');

    useEffect(() => {
        try {
            const saved = localStorage.getItem('market_alerts');
            if (saved) setAlerts(JSON.parse(saved));
            const tgId = localStorage.getItem('telegram_chat_id');
            if (tgId) { setTelegramId(tgId); setTelegramConnected(true); setTelegramInput(tgId); }
        } catch { }
        const interval = setInterval(() => {
            try {
                const saved = localStorage.getItem('market_alerts');
                if (saved) setAlerts(JSON.parse(saved));
            } catch { }
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const connectTelegram = () => {
        const id = telegramInput.trim();
        if (!id) return;
        localStorage.setItem('telegram_chat_id', id);
        setTelegramId(id); setTelegramConnected(true);
    };

    const disconnectTelegram = () => {
        localStorage.removeItem('telegram_chat_id');
        setTelegramId(''); setTelegramConnected(false); setTelegramInput('');
    };

    const saveAlerts = (updated: MarketAlert[]) => {
        setAlerts(updated);
        localStorage.setItem('market_alerts', JSON.stringify(updated));
    };

    const handleDelete = (id: string) => saveAlerts(alerts.filter(a => a.id !== id));
    const handleDismiss = (id: string) => saveAlerts(alerts.map(a => a.id === id ? { ...a, triggered: false, lastMatch: null } : a));

    const formatTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });

    const triggeredCount = alerts.filter(a => a.triggered).length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-100">Watchlist</h1>
                    <p className="text-zinc-500 text-sm mt-0.5">Seus alertas e histórico de matches.</p>
                </div>
                <div className="flex items-center gap-2">
                    {triggeredCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm font-medium text-amber-400">
                            <Zap className="w-4 h-4" />
                            {triggeredCount} alerta(s) ativo(s)
                        </div>
                    )}
                    <a href="/"
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                        <Plus className="w-4 h-4" /> Novo Alerta
                    </a>
                </div>
            </div>

            {/* Alerts list */}
            {alerts.length === 0 ? (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl py-16 text-center">
                    <BellOff className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                    <h3 className="text-zinc-400 font-medium">Nenhum alerta configurado</h3>
                    <p className="text-zinc-600 text-sm mt-1">Vá ao Market Tracker e clique em "Notify Me" para criar alertas.</p>
                    <a href="/market" className="inline-block mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
                        Ir ao Market Tracker
                    </a>
                </div>
            ) : (
                <div className="space-y-3">
                    {alerts.map(alert => (
                        <div key={alert.id} className={`bg-zinc-900/50 border rounded-xl overflow-hidden transition-all ${alert.triggered ? 'border-amber-500/40' : 'border-zinc-800'
                            }`}>
                            {/* Alert header */}
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${alert.triggered ? 'bg-amber-500/10' : 'bg-zinc-800'
                                        }`}>
                                        {alert.triggered ? <Zap className="w-4 h-4 text-amber-400" /> : <Bell className="w-4 h-4 text-zinc-500" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-base font-semibold text-zinc-100">"{alert.keyword}"</p>
                                            {alert.maxPrice && (
                                                <span className="text-xs px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-300">
                                                    ≤ {alert.maxPrice} zCoin
                                                </span>
                                            )}
                                            {alert.minEnhancement && (
                                                <span className="text-xs px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400">
                                                    +{alert.minEnhancement}+
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-0.5">
                                            Criado em {formatTime(alert.created_at)} •{' '}
                                            {alert.history?.length || 0} match(es) no histórico
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    {alert.history && alert.history.length > 0 && (
                                        <button onClick={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                                            <History className="w-3.5 h-3.5" />
                                            Histórico
                                        </button>
                                    )}
                                    {alert.triggered && (
                                        <button onClick={() => handleDismiss(alert.id)}
                                            className="px-2.5 py-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 rounded-lg transition-colors">
                                            Dispensar
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(alert.id)} className="text-zinc-600 hover:text-red-400 transition-colors p-1.5">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Last match */}
                            {alert.triggered && alert.lastMatch && (
                                <div className="mx-4 mb-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                                        <div>
                                            <p className="text-sm font-medium text-amber-300">{alert.lastMatch.name}</p>
                                            <p className="text-xs text-zinc-400">{alert.lastMatch.price} {alert.lastMatch.currency} • {formatTime(alert.lastMatch.timestamp)}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDismiss(alert.id)} className="text-zinc-500 hover:text-zinc-300">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* History expanded */}
                            {expandedId === alert.id && alert.history && alert.history.length > 0 && (
                                <div className="border-t border-zinc-800 bg-zinc-950/30">
                                    <div className="px-4 py-2 flex items-center gap-2">
                                        <History className="w-3.5 h-3.5 text-zinc-500" />
                                        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Histórico de matches</span>
                                    </div>
                                    <div className="divide-y divide-zinc-800/50">
                                        {alert.history.map((item, i) => (
                                            <div key={i} className="px-4 py-2.5 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                                        <img src={item.iconUrl} alt={item.name} className="w-6 h-6 object-contain"
                                                            onError={e => { (e.target as HTMLImageElement).src = 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png'; }} />
                                                    </div>
                                                    <span className={`text-sm font-medium ${item.name.includes('+') ? 'text-amber-400' : 'text-zinc-200'}`}>
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-right">
                                                    <span className="text-sm font-bold text-amber-500">{item.price} {item.currency}</span>
                                                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                                                        <Clock className="w-3 h-3" />
                                                        {formatTime(item.timestamp)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Telegram connection */}
            <div className={`border rounded-xl p-5 ${telegramConnected ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900/50 border-zinc-800'}`}>
                <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${telegramConnected ? 'bg-emerald-500/10' : 'bg-zinc-800'}`}>
                        <Send className={`w-4 h-4 ${telegramConnected ? 'text-emerald-400' : 'text-zinc-400'}`} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-100 text-sm">Notificações no Telegram</h3>
                        <p className="text-xs text-zinc-500">{telegramConnected ? `Conectado · ID ${telegramId}` : 'Receba alertas direto no celular'}</p>
                    </div>
                    {telegramConnected && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />}
                </div>

                {!telegramConnected ? (
                    <div className="space-y-3">
                        <div className="text-xs text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-1">
                            <p>1. Abra o Telegram e inicie uma conversa com <span className="text-indigo-400 font-mono">@ZGamingMarketBot</span></p>
                            <p>2. Envie o comando <span className="font-mono text-zinc-300">/start</span></p>
                            <p>3. O bot vai te enviar seu <strong className="text-zinc-200">Chat ID</strong> — cole abaixo</p>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={telegramInput} onChange={e => setTelegramInput(e.target.value)}
                                placeholder="Cole seu Chat ID aqui..."
                                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50" />
                            <button onClick={connectTelegram} disabled={!telegramInput.trim()}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-sm font-semibold transition-colors">
                                Conectar
                            </button>
                        </div>
                    </div>
                ) : (
                    <button onClick={disconnectTelegram} className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
                        Desconectar Telegram
                    </button>
                )}
            </div>
        </div>
    );
}
