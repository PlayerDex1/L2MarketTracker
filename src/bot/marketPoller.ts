import 'dotenv/config';

const USER_TOKEN = process.env.DISCORD_USER_TOKEN || '';
const CHANNEL_ID = process.env.ZGAMING_MARKET_CHANNEL_ID || '';
const API_URL = 'http://localhost:3000/api/market/items';
const POLL_INTERVAL_MS = 15000; // 15 seconds

let lastMessageId: string | null = null;

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
function parseMessage(msg: any): { name: string; price: number; currency: string } | null {
  if (msg.embeds && msg.embeds.length > 0) {
    const embed = msg.embeds[0];

    // Log embed structure to understand ZGaming format
    console.log('[ZGaming Embed]', JSON.stringify({
      title: embed.title,
      description: embed.description?.slice(0, 150),
      fields: embed.fields,
    }, null, 2));

    // 1. Item name from title (if not "Price")
    let itemName = '';
    if (embed.title && !/^\s*price\s*$/i.test(embed.title)) {
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
        const pm = cleanVal.match(/(\d[\d,.]*)/);
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
      const pm = fullText.match(/(\d[\d,.]+)/g);
      if (pm) price = parseFloat(pm[pm.length - 1].replace(/,/g, ''));
    }

    if (itemName && price > 0) return { name: itemName, price, currency };
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
    const pm = text.match(/(\d[\d,.]*)\s*(zcoin|adena)/i);
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

async function pollMessages() {
  if (!USER_TOKEN || !CHANNEL_ID) return;

  const url = `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages?limit=20${lastMessageId ? `&after=${lastMessageId}` : ''}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: USER_TOKEN, // user token (no "Bot " prefix)
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        console.error('❌ ZGaming Poller: Invalid user token (401). Check DISCORD_USER_TOKEN in .env');
      } else if (res.status === 403) {
        console.error('❌ ZGaming Poller: No access to channel (403). Make sure you are a member of the ZGaming server.');
      } else {
        console.error(`❌ ZGaming Poller: Discord API error ${res.status}`);
      }
      return;
    }

    const messages: any[] = await res.json();

    if (!Array.isArray(messages) || messages.length === 0) return;

    // Discord returns newest first — reverse to process oldest first
    const sorted = [...messages].reverse();

    // Update lastMessageId to the newest message
    lastMessageId = messages[0].id;

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
      };

      try {
        const postRes = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        if (postRes.ok) {
          const body = await postRes.json();
          if (!body.duplicate) {
            console.log(`📦 Market item: ${parsed.name} — ${parsed.price} ${parsed.currency}`);
            newCount++;
          }
        }
      } catch { }
    }

    if (newCount > 0) {
      console.log(`✅ ZGaming Poller: ${newCount} new item(s) captured`);
    }

  } catch (err: any) {
    console.error('❌ ZGaming Poller fetch error:', err.message);
  }
}

export function startMarketPoller() {
  if (!USER_TOKEN) {
    console.warn('⚠️  DISCORD_USER_TOKEN not set — ZGaming Market Poller disabled.');
    return;
  }
  if (!CHANNEL_ID) {
    console.warn('⚠️  ZGAMING_MARKET_CHANNEL_ID not set — ZGaming Market Poller disabled.');
    return;
  }

  console.log(`🔄 ZGaming Market Poller started (every ${POLL_INTERVAL_MS / 1000}s) — Channel: ${CHANNEL_ID}`);

  // First poll immediately, then every 15s
  pollMessages();
  setInterval(pollMessages, POLL_INTERVAL_MS);
}
