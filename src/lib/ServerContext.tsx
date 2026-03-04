import React, { createContext, useContext, useState } from 'react';
import { SERVERS, ServerConfig, getServerById } from '../config/servers';

interface ServerContextProps {
    activeServer: string; // ID do servidor
    serverMeta: ServerConfig; // Dados ricos do servidor
    setActiveServer: (server: string) => void;
    availableServers: ServerConfig[];
}

const ServerContext = createContext<ServerContextProps>({
    activeServer: SERVERS[0].id,
    serverMeta: SERVERS[0],
    setActiveServer: () => { },
    availableServers: SERVERS,
});

export function ServerProvider({ children }: { children: React.ReactNode }) {
    const tenant = import.meta.env.VITE_TENANT as string | undefined;
    const isTenantLocked = !!(tenant && SERVERS.some(s => s.id === tenant));

    // Se VITE_TENANT estiver definido, o servidor é SEMPRE travado naquele tenant.
    // O localStorage só é consultado no modo multi-servidor.
    const [activeServer, setActiveServerState] = useState<string>(() => {
        if (isTenantLocked) return tenant!;
        const saved = localStorage.getItem('@l2market:server');
        return SERVERS.some(s => s.id === saved) ? saved! : SERVERS[0].id;
    });

    const activeAvailableServers = isTenantLocked ? SERVERS.filter(s => s.id === tenant) : SERVERS;

    const setActiveServer = (serverId: string) => {
        if (isTenantLocked) return; // impede troca quando tenant está fixado
        setActiveServerState(serverId);
        localStorage.setItem('@l2market:server', serverId);
    };

    const serverMeta = getServerById(activeServer);

    return (
        <ServerContext.Provider value={{ activeServer, serverMeta, setActiveServer, availableServers: activeAvailableServers }}>
            {children}
        </ServerContext.Provider>
    );
}

export const useServer = () => useContext(ServerContext);
