import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mgylypvmgjebvpxhlmly.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RG-4on-iquEBjcvHD-ZAMw_SqZTkHTS';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

let offset = 0;

async function sendMessage(chatId: number, text: string, parseMode = 'Markdown') {
    await fetch(`${API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode, disable_web_page_preview: true }),
    });
}

async function handleUpdate(update: any) {
    const msg = update.message;
    if (!msg || !msg.text) return;

    const chatId: number = msg.chat.id;
    const username: string = msg.from?.username || msg.from?.first_name || 'unknown';
    const text: string = msg.text.trim();
    const parts = text.split(' ');
    const command = parts[0].toLowerCase();

    if (command === '/start') {
        await supabase.from('telegram_subscriptions').upsert({ chat_id: chatId, username }, { onConflict: 'chat_id' });
        await sendMessage(chatId,
            `🎮 *Bem-vindo ao ZGaming Market Bot!*\n\n` +
            `📋 *Seu Chat ID:* \`${chatId}\`\n` +
            `_Copie este ID e cole na Watchlist do site para conectar notificações._\n\n` +
            `Use os comandos abaixo:\n\n` +
            `📌 */watch <item>* — Monitorar item\n` +
            `📌 */watch <item> max:<preço>* — Com preço máximo\n` +
            `📌 */watch <item> max:<preço> min:<+level>* — Com enhancement\n\n` +
            `📋 */list* — Ver seus alertas\n` +
            `❌ */unwatch <id>* — Remover alerta\n` +
            `🔕 */stop* — Remover todos alertas\n\n` +
            `Exemplo:\n` +
            `\`/watch Talisman of Aden max:50 min:5\``
        );
        return;
    }

    // Auto-register if not registered yet
    await supabase.from('telegram_subscriptions').upsert({ chat_id: chatId, username }, { onConflict: 'chat_id' });

    if (command === '/watch') {
        const rest = parts.slice(1).join(' ');
        if (!rest) {
            await sendMessage(chatId, '❌ Use: `/watch <nome do item> [max:<preço>] [min:<enhancement>]`');
            return;
        }

        // Parse max: and min: params
        const maxMatch = rest.match(/max:(\d+(?:\.\d+)?)/i);
        const minMatch = rest.match(/min:(\d+)/i);
        const keyword = rest
            .replace(/max:\d+(?:\.\d+)?/gi, '')
            .replace(/min:\d+/gi, '')
            .trim();

        if (!keyword) {
            await sendMessage(chatId, '❌ Informe o nome do item. Ex: `/watch Talisman of Aden max:50`');
            return;
        }

        const maxPrice = maxMatch ? parseFloat(maxMatch[1]) : null;
        const minEnhancement = minMatch ? parseInt(minMatch[1]) : null;

        const { data, error } = await supabase.from('telegram_alerts').insert({
            chat_id: chatId,
            keyword,
            max_price: maxPrice,
            min_enhancement: minEnhancement,
        }).select().single();

        if (error) {
            await sendMessage(chatId, '❌ Erro ao salvar alerta. Tente novamente.');
            return;
        }

        let confirmation = `✅ *Alerta criado!*\n\n📦 Item: \`${keyword}\``;
        if (maxPrice) confirmation += `\n💰 Preço máximo: ${maxPrice} zCoin`;
        if (minEnhancement) confirmation += `\n⚔️ Enhancement mínimo: +${minEnhancement}`;
        confirmation += `\n\nID: \`${data.id}\` (use /unwatch ${data.id} para remover)`;

        await sendMessage(chatId, confirmation);
        return;
    }

    if (command === '/list') {
        const { data } = await supabase
            .from('telegram_alerts')
            .select('*')
            .eq('chat_id', chatId);

        if (!data || data.length === 0) {
            await sendMessage(chatId, '📋 Você não tem alertas configurados.\n\nUse `/watch <item>` para criar um.');
            return;
        }

        let list = `📋 *Seus alertas (${data.length}):*\n\n`;
        data.forEach((a: any) => {
            list += `*#${a.id}* — \`${a.keyword}\``;
            if (a.max_price) list += ` ≤ ${a.max_price} zCoin`;
            if (a.min_enhancement) list += ` +${a.min_enhancement}+`;
            list += '\n';
        });
        await sendMessage(chatId, list);
        return;
    }

    if (command === '/unwatch') {
        const id = parseInt(parts[1]);
        if (!id) {
            await sendMessage(chatId, '❌ Use: `/unwatch <id>` (veja os IDs com /list)');
            return;
        }
        const { error } = await supabase.from('telegram_alerts').delete()
            .eq('id', id).eq('chat_id', chatId);
        if (error) {
            await sendMessage(chatId, '❌ Alerta não encontrado ou não pertence a você.');
        } else {
            await sendMessage(chatId, `✅ Alerta #${id} removido!`);
        }
        return;
    }

    if (command === '/stop') {
        await supabase.from('telegram_alerts').delete().eq('chat_id', chatId);
        await supabase.from('telegram_subscriptions').delete().eq('chat_id', chatId);
        await sendMessage(chatId, '🔕 Todos seus alertas foram removidos. Use /start para recomeçar.');
        return;
    }

    await sendMessage(chatId,
        `❓ Comando não reconhecido.\n\nUse /start para ver os comandos disponíveis.`
    );
}

async function pollTelegram() {
    try {
        const res = await fetch(`${API}/getUpdates?offset=${offset}&timeout=30`);
        const json: any = await res.json();
        if (!json.ok || !json.result?.length) return;

        for (const update of json.result) {
            offset = update.update_id + 1;
            await handleUpdate(update);
        }
    } catch (err) {
        console.error('[Telegram] Poll error:', err);
    }
}

export async function startTelegramBot() {
    if (!BOT_TOKEN) {
        console.warn('⚠️  TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.');
        return;
    }
    console.log('🤖 Telegram bot started — polling for messages...');
    // Poll every 2 seconds for new messages
    setInterval(pollTelegram, 2000);
    pollTelegram();
}

// Send a notification to matching telegram subscribers
export async function sendTelegramNotification(itemName: string, price: number, currency: string, timestamp: string) {
    if (!BOT_TOKEN) return;

    try {
        const { data: alerts } = await supabase
            .from('telegram_alerts')
            .select('*');

        if (!alerts || alerts.length === 0) return;

        const now = new Date(timestamp);
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        // Group by chat_id to avoid spamming
        const notified = new Set<number>();

        for (const alert of alerts) {
            if (notified.has(alert.chat_id)) continue;

            const nameMatch = itemName.toLowerCase().includes(alert.keyword.toLowerCase());
            if (!nameMatch) continue;

            if (alert.max_price !== null && price > alert.max_price) continue;

            if (alert.min_enhancement !== null) {
                const match = itemName.match(/\+(\d+)/);
                const enhancement = match ? parseInt(match[1]) : 0;
                if (enhancement < alert.min_enhancement) continue;
            }

            const msg =
                `🔔 *Alerta Ativado!*\n\n` +
                `📦 *${itemName}*\n` +
                `💰 ${price.toLocaleString()} ${currency}\n` +
                `🕐 ${timeStr}\n\n` +
                `🎯 Alerta: \`${alert.keyword}\`` +
                (alert.max_price ? ` ≤ ${alert.max_price} zCoin` : '') +
                (alert.min_enhancement ? ` +${alert.min_enhancement}+` : '') +
                `\n\n👉 [Ver no Market](https://gerencimanento-de-clan.vercel.app/)`;

            await fetch(`${API}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: alert.chat_id,
                    text: msg,
                    parse_mode: 'Markdown',
                    disable_web_page_preview: false,
                }),
            });

            notified.add(alert.chat_id);
        }
    } catch (err) {
        console.error('[Telegram] Notification error:', err);
    }
}
