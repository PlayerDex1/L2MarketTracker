export interface ServerConfig {
    id: string;
    name: string;
    colorTheme: string; // Ex: 'indigo' ou 'red'
    currency: string;
    defaultIcon?: string;
}

export const SERVERS: ServerConfig[] = [
    {
        id: 'zgaming',
        name: 'ZGaming',
        colorTheme: 'indigo',
        currency: 'zCoin',
    },
    {
        id: 'pride',
        name: 'Pride',
        colorTheme: 'red',
        currency: 'Pride Coin',
    }
];

export const getServerById = (id: string) => SERVERS.find(s => s.id === id) || SERVERS[0];
