import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, X, BarChart2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Result {
    name: string;
    price: number;
    currency: string;
    timestamp: string;
    normalized: string;
}

interface CommandPaletteProps {
    open: boolean;
    onClose: () => void;
}

function normalizeItemName(name: string) {
    return name.replace(/^\+\d+\s*/, '').trim();
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Result[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setQuery('');
            setResults([]);
            setSelected(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    useEffect(() => {
        if (!query.trim()) { setResults([]); return; }
        const timeout = setTimeout(async () => {
            setLoading(true);
            const { data } = await supabase
                .from('market_items')
                .select('name, price, currency, timestamp')
                .ilike('name', `%${query}%`)
                .order('timestamp', { ascending: false })
                .limit(8);
            if (data) {
                // Deduplicate by normalized name, keep most recent
                const seen = new Set<string>();
                const deduped = data.reduce<Result[]>((acc, d) => {
                    const key = normalizeItemName(d.name);
                    if (!seen.has(key)) { seen.add(key); acc.push({ name: d.name, price: d.price, currency: d.currency, timestamp: d.timestamp, normalized: key }); }
                    return acc;
                }, []);
                setResults(deduped);
                setSelected(0);
            }
            setLoading(false);
        }, 200);
        return () => clearTimeout(timeout);
    }, [query]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!open) return;
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
            if (e.key === 'Enter' && results[selected]) {
                navigate(`/item/${encodeURIComponent(results[selected].normalized)}`);
                onClose();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, results, selected, navigate, onClose]);

    if (!open) return null;

    const go = (name: string) => { navigate(`/item/${encodeURIComponent(name)}`); onClose(); };
    const fmt = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-zinc-800">
                    <Search className="w-5 h-5 text-zinc-400 shrink-0" />
                    <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar item no mercado..."
                        className="flex-1 bg-transparent text-zinc-100 placeholder:text-zinc-500 outline-none text-base" />
                    {query && <button onClick={() => setQuery('')} className="text-zinc-600 hover:text-zinc-300"><X className="w-4 h-4" /></button>}
                    <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-500">ESC</kbd>
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto">
                    {loading && (
                        <div className="px-4 py-6 text-center text-zinc-500 text-sm">Buscando...</div>
                    )}
                    {!loading && query && results.length === 0 && (
                        <div className="px-4 py-6 text-center text-zinc-600 text-sm">Nenhum item encontrado para "{query}"</div>
                    )}
                    {!loading && !query && (
                        <div className="px-4 py-4 text-center text-zinc-600 text-sm">Digite para buscar itens...</div>
                    )}
                    {results.map((r, i) => (
                        <button key={r.normalized} onClick={() => go(r.normalized)}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${i === selected ? 'bg-indigo-500/10' : 'hover:bg-zinc-800/50'}`}>
                            <BarChart2 className={`w-4 h-4 shrink-0 ${i === selected ? 'text-indigo-400' : 'text-zinc-600'}`} />
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${r.name.includes('+') ? 'text-amber-400' : 'text-zinc-200'}`}>{r.name}</p>
                                <p className="text-xs text-zinc-500">{r.price} {r.currency}</p>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-zinc-600 shrink-0">
                                <Clock className="w-3 h-3" />{fmt(r.timestamp)}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-zinc-800 flex items-center gap-4 text-[11px] text-zinc-600">
                    <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1">↑↓</kbd> navegar</span>
                    <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1">↵</kbd> abrir</span>
                    <span><kbd className="bg-zinc-800 border border-zinc-700 rounded px-1">ESC</kbd> fechar</span>
                </div>
            </div>
        </div>
    );
}
