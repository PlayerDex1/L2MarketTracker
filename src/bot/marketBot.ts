import { Client, GatewayIntentBits, Message } from 'discord.js';
import 'dotenv/config';

const CHANNEL_ID = process.env.ZGAMING_CHANNEL_ID || '';
const API_URL = 'http://localhost:3000/api/market/items';

// Map to resolve item icons from l2db.info
function guessIconUrl(itemName: string): string {
    const name = itemName.toLowerCase();
    if (name.includes('talisman of aden')) {
        const match = name.match(/\+(\d+)/);
        const level = match ? parseInt(match[1]) : 0;
        return `https://l2db.info/icon/etc_talisman_of_aden_i0${Math.max(0, Math.min(5, level))}.png`;
    }
    if (name.includes('cloak')) return 'https://l2db.info/icon/cloak_of_protection_i00.png';
    if (name.includes('talisman of authority')) return 'https://l2db.info/icon/etc_talisman_of_authority_i00.png';
    if (name.includes('dye booster')) return 'https://l2db.info/icon/etc_dye_booster_i00.png';
    return 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png';
}

// Parses a ZGaming market message (embed or plain text)
function parseMarketMessage(message: Message): { name: string; price: number; currency: string } | null {
    // Try embed first
    const embed = message.embeds[0];
    if (embed) {
        const title = embed.title || embed.description || '';
        const priceField = embed.fields?.find(f =>
            f.name.toLowerCase().includes('price') ||
            f.name.toLowerCase().includes('valor') ||
            f.value.toLowerCase().includes('zcoin') ||
            f.value.toLowerCase().includes('adena')
        );

        if (title) {
            const priceMatch = priceField?.value.match(/(\d[\d,.]*)/) ||
                title.match(/(\d[\d,.]*)\s*(zcoin|adena)/i);
            const currency = (priceField?.value || title).toLowerCase().includes('adena') ? 'Adena' : 'zCoin';
            const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;
            const name = embed.title || title.replace(/[\d,.]+ ?(zcoin|adena)/gi, '').trim();

            if (name && price > 0) return { name: name.trim(), price, currency };
        }
    }

    // Try plain text
    const text = message.content;
    if (text) {
        // Pattern: "Item Name - 100 zCoin" or "Item Name: 100 Adena"
        const match = text.match(/^(.+?)\s*[-:]\s*(\d[\d,.]*)\s*(zcoin|adena)/i);
        if (match) {
            return {
                name: match[1].trim(),
                price: parseFloat(match[2].replace(/,/g, '')),
                currency: match[3].toLowerCase() === 'adena' ? 'Adena' : 'zCoin',
            };
        }

        // Pattern: just look for price anywhere
        const priceMatch = text.match(/(\d[\d,.]*)\s*(zcoin|adena)/i);
        if (priceMatch) {
            const name = text.split(priceMatch[0])[0].trim().replace(/[-:,]$/, '').trim();
            if (name) {
                return {
                    name,
                    price: parseFloat(priceMatch[1].replace(/,/g, '')),
                    currency: priceMatch[2].toLowerCase() === 'adena' ? 'Adena' : 'zCoin',
                };
            }
        }
    }

    return null;
}

export function startMarketBot() {
    if (!process.env.DISCORD_BOT_TOKEN) {
        console.warn('⚠️  DISCORD_BOT_TOKEN not set — Market Bot disabled.');
        return;
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
        ],
    });

    client.once('ready', () => {
        console.log(`✅ Market Bot connected as ${client.user?.tag}`);
        console.log(`👀 Monitoring channel: ${CHANNEL_ID}`);
    });

    client.on('messageCreate', async (message) => {
        // Only process messages from the target channel
        if (message.channelId !== CHANNEL_ID) return;
        // Ignore messages from regular users (only process bot messages)
        if (!message.author.bot) return;

        const parsed = parseMarketMessage(message);
        if (!parsed) return;

        const item = {
            name: parsed.name,
            price: parsed.price,
            currency: parsed.currency,
            timestamp: message.createdAt.toISOString(),
            iconUrl: guessIconUrl(parsed.name),
            messageId: message.id,
        };

        try {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });
            if (res.ok) {
                console.log(`📦 Market item captured: ${parsed.name} — ${parsed.price} ${parsed.currency}`);
            }
        } catch (err) {
            console.error('Failed to forward market item to API:', err);
        }
    });

    client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
        console.error('❌ Discord bot login failed:', err.message);
    });
}
