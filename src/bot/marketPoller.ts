import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sendDiscordDM } from './discordNotifier';
import { SERVERS } from '../config/servers';

const USER_TOKEN = process.env.DISCORD_USER_TOKEN || '';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mgylypvmgjebvpxhlmly.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RG-4on-iquEBjcvHD-ZAMw_SqZTkHTS';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const POLL_INTERVAL_MS = 5000; // 5 seconds

// Armazena o state do ultimo ID lido por servidor { 'zgaming': '123..', 'pride': '456..' }
let lastMessageIds: Record<string, string | null> = {};

function guessIconUrl(itemName: string): string {
  const name = itemName.toLowerCase();
  if (name.includes('talisman of aden')) {
    const match = name.match(/\+(\d+)/);
    const level = match ? Math.min(5, parseInt(match[1])) : 0;
    return `https://l2db.info/icon/etc_talisman_of_aden_i0${level}.png`;
  }
  if (name.includes('cloak')) return 'https://l2db.info/icon/cloak_of_protection_i00.png';
  if (name.includes('talisman of authority')) return 'https://l2db.info/icon/etc_talisman_of_authority_i00.png';
  if (name.includes('dye booster')) return 'https://l2db.info/icon/etc_dye_booster_i00.png';
  return 'https://l2db.info/icon/weapon_the_sword_of_hero_i00.png';
}

// Remove Discord custom emojis like <:zcoin:1234> or <zcoin1234>
function cleanEmojis(text: string): string {
  return text
    .replace(/<:[^:]+:\d+>/g, '')
    .replace(/<\w+\d+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse price and name from Discord message (embed or plain text)
function parseMessage(msg: any): { name: string; price: number; currency: string; iconUrl?: string } | null {
  if (msg.embeds && msg.embeds.length > 0) {
    const embed = msg.embeds[0];

    // Log embed structure
    console.log('[ZGaming Embed]', JSON.stringify({
      author: embed.author,
      title: embed.title,
      description: embed.description?.slice(0, 150),
      thumbnail: embed.thumbnail,
      image: embed.image,
      fields: embed.fields,
    }, null, 2));

    // 1. Item name: author.name > title > field > description
    let itemName = '';
    if (embed.author?.name) {
      // Remove common ZGaming suffix
      itemName = cleanEmojis(embed.author.name)
        .replace(/\s*was added on the market\.?\s*/gi, '')
        .trim();
    } else if (embed.title && !/^\s*price\s*$/i.test(embed.title)) {
      itemName = cleanEmojis(embed.title);
    }

    // 2. Item name from specific field
    if (!itemName && embed.fields) {
      const itemField = embed.fields.find((f: any) =>
        /^(item|name|nome|produto|listing)$/i.test(f.name.trim())
      );
      if (itemField) itemName = cleanEmojis(itemField.value);
    }

    // 3. Item name from first line of description
    if (!itemName && embed.description) {
      itemName = cleanEmojis(embed.description.split('\n')[0]);
    }

    // 4. Price from "Price" field
    let price = 0;
    let currency = 'zCoin';
    if (embed.fields) {
      const priceField = embed.fields.find((f: any) =>
        /price|preco|valor|cost|amount/i.test(f.name)
      );
      if (priceField) {
        const cleanVal = cleanEmojis(priceField.value);
        const pm = cleanVal.match(/(\d+(?:[,.]\d+)*)/);
        if (pm) {
          price = parseFloat(pm[1].replace(/,/g, ''));
          currency = priceField.value.toLowerCase().includes('adena') ? 'Adena' : 'zCoin';
        }
      }
    }

    // 5. Price from full text fallback
    if (!price) {
      const fullText = cleanEmojis([
        embed.title || '',
        embed.description || '',
        ...(embed.fields || []).map((f: any) => `${f.name} ${f.value}`)
      ].join(' '));
      const pm = fullText.match(/(\d+(?:[,.]\d+)*)/g);
      if (pm) price = parseFloat(pm[pm.length - 1].replace(/,/g, ''));
    }

    if (itemName && price > 0) {
      // Extract real icon from embed thumbnail or image
      const iconUrl = embed.thumbnail?.url || embed.thumbnail?.proxy_url
        || embed.image?.url || embed.author?.icon_url || undefined;
      return { name: itemName, price, currency, iconUrl };
    }
  }

  // Plain text fallback
  const text = msg.content || '';
  if (text) {
    const match = text.match(/^(.+?)\s*[-:–]\s*(\d[\d,.]*)\s*(zcoin|adena|zc)/i);
    if (match) {
      return {
        name: match[1].trim(),
        price: parseFloat(match[2].replace(/,/g, '')),
        currency: match[3].toLowerCase() === 'adena' ? 'Adena' : 'zCoin',
      };
    }
    const pm = text.match(/(\d+(?:[,.]\d+)*)\s*(zcoin|adena)/i);
    if (pm) {
      const namePart = cleanEmojis(text.split(pm[0])[0]).replace(/[-:,]$/, '').trim();
      if (namePart) {
        return {
          name: namePart,
          price: parseFloat(pm[1].replace(/,/g, '')),
          currency: pm[2].toLowerCase() === 'adena' ? 'Adena' : 'zCoin',
        };
      }
    }
  }

  return null;
}

export async function sendDiscordNotification(serverId: string, name: string, price: number, currency: string, timestamp: string, iconUrl?: string) {
  try {
    const { data: alerts } = await supabase.from('user_alerts').select('*').eq('server_id', serverId);
    if (!alerts || alerts.length === 0) return;

    for (const alert of alerts) {
      let matched = false;

      if (name.toLowerCase().includes(alert.keyword.toLowerCase())) {
        const maxPrice = alert.max_price;
        const minEnhancement = alert.min_enhancement;
        let priceOk = true;
        let enhanceOk = true;

        if (maxPrice && price > maxPrice) priceOk = false;
        if (minEnhancement) {
          const m = name.match(/\+(\d+)/);
          if ((m ? parseInt(m[1]) : 0) < minEnhancement) enhanceOk = false;
        }

        matched = priceOk && enhanceOk;
      }

      if (matched && alert.discord_id) {
        const serverTag = serverId.toUpperCase();
        const urlName = encodeURIComponent(name);
        const message = `🔔 **L2 MARKET MATCH [${serverTag}]**\n\n` +
          `📦 **${name}**\n` +
          `💰 **${price.toLocaleString()} ${currency}**\n\n` +
          `🔎 Motivo: Match no alerta "${alert.keyword}"\n` +
          `Ver: https://zgaming-market-tracker.vercel.app/item/${urlName}`;

        await sendDiscordDM(alert.discord_id, message);
      }
    }
  } catch (e) {
    console.error('Erro ao processar notificações do Discord:', e);
  }
}

async function pollMessagesForServer(server: { id: string, channelId: string, name: string }) {
  if (!USER_TOKEN) return;

  const lastId = lastMessageIds[server.id];
  const url = `https://discord.com/api/v10/channels/${server.channelId}/messages?limit=20${lastId ? `&after=${lastId}` : ''}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: USER_TOKEN, // user token (no "Bot " prefix)
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.error('❌ L2 Poller: Invalid user token (401). Check DISCORD_USER_TOKEN in .env');
      } else if (res.status === 403) {
        console.error(`❌ L2 Poller: No access to channel (403). Cannot access ${server.name} channel.`);
      } else {
        console.error(`❌ L2 Poller: Discord API error ${res.status} on ${server.name}`);
      }
      return;
    }

    const messages: any[] = await res.json();

    if (!Array.isArray(messages) || messages.length === 0) return;

    // Discord returns newest first — reverse to process oldest first
    const sorted = [...messages].reverse();

    // Update lastMessageId to the newest message
    lastMessageIds[server.id] = messages[0].id;

    let newCount = 0;
    for (const msg of sorted) {
      // Only process bot messages (ZGaming bot)
      if (!msg.author?.bot) continue;

      const parsed = parseMessage(msg);
      if (!parsed) continue;

      const item = {
        name: parsed.name,
        price: parsed.price,
        currency: parsed.currency,
        timestamp: msg.timestamp,
        iconUrl: guessIconUrl(parsed.name),
        messageId: msg.id,
        server_id: server.id
      };

      try {
        const { error } = await supabase.from('market_items').upsert({
          id: msg.id,
          name: parsed.name,
          price: parsed.price,
          currency: parsed.currency,
          timestamp: msg.timestamp,
          icon_url: parsed.iconUrl || guessIconUrl(parsed.name),
          server_id: server.id
        }, { onConflict: 'id' });

        if (!error) {
          console.log(`📦 Market item [${server.name}]: ${parsed.name} — ${parsed.price} ${parsed.currency}`);
          newCount++;
          // Discord notification
          await sendDiscordNotification(server.id, parsed.name, parsed.price, parsed.currency, msg.timestamp, parsed.iconUrl);
        } else if (error.code !== '23505') { // ignore duplicate key
          console.error('Supabase error:', error.message);
        }
      } catch { }
    }

    if (newCount > 0) {
      console.log(`✅ L2 Poller: ${newCount} new item(s) captured from ${server.name}`);
    }

  } catch (err: any) {
    console.error(`❌ L2 Poller fetch error on ${server.name}:`, err.message);
  }
}

async function pollAll() {
  const activeBots = SERVERS.filter(s => {
    if (s.id === 'zgaming') return !!process.env.ZGAMING_MARKET_CHANNEL_ID;
    if (s.id === 'pride') return !!process.env.PRIDE_MARKET_CHANNEL_ID;
    return false;
  });

  for (const bot of activeBots) {
    const channelId = bot.id === 'zgaming' ? process.env.ZGAMING_MARKET_CHANNEL_ID : process.env.PRIDE_MARKET_CHANNEL_ID;
    await pollMessagesForServer({ ...bot, channelId: channelId as string });
  }
}

export function startMarketPoller() {
  if (!USER_TOKEN) {
    console.warn('⚠️  DISCORD_USER_TOKEN não definido. L2 Market Poller desativado.');
    return;
  }

  const activeBots = SERVERS.filter(s => {
    if (s.id === 'zgaming') return !!process.env.ZGAMING_MARKET_CHANNEL_ID;
    if (s.id === 'pride') return !!process.env.PRIDE_MARKET_CHANNEL_ID;
    return false;
  });

  if (activeBots.length === 0) {
    console.warn('⚠️  Nenhum Canal de Servidor configurado (ZGAMING_MARKET_CHANNEL_ID, etc). Poller desativado.');
    return;
  }

  const names = activeBots.map(s => s.name).join(' & ');
  console.log(`🔄 L2 Market Poller ativo (a cada ${POLL_INTERVAL_MS / 1000}s) — Ouvindo: ${names}`);

  // First poll immediately, then every 5s
  pollAll();
  setInterval(pollAll, POLL_INTERVAL_MS);
}

// Auto-start when run directly (Railway/standalone)
startMarketPoller();
