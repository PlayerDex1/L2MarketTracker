import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

export const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});

let isReady = false;

if (DISCORD_BOT_TOKEN) {
    discordClient.once('ready', () => {
        console.log(`🤖 Discord Notifier Bot conectado como ${discordClient.user?.tag}`);
        isReady = true;
    });

    discordClient.login(DISCORD_BOT_TOKEN).catch(err => {
        console.error('❌ Erro ao conectar o Discord Bot:', err);
    });
} else {
    console.warn('⚠️ DISCORD_BOT_TOKEN não está definido. Notificações do Discord desativadas.');
}

/**
 * Envia uma Mensagem Direta (DM) para o Discord ID especificado
 */
export async function sendDiscordDM(discordId: string, message: string) {
    if (!isReady || !DISCORD_BOT_TOKEN) {
        console.warn(`[Discord Notifier] Bot offline. Ignorando DM para ${discordId}`);
        return;
    }

    try {
        const user = await discordClient.users.fetch(discordId);
        if (user) {
            await user.send(message);
            console.log(`✅ DM enviada para o discord_id ${discordId}`);
        }
    } catch (e) {
        console.error(`❌ Erro ao enviar DM para o discord_id ${discordId}:`, e);
    }
}
