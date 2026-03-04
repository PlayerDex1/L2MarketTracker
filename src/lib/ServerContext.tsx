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

    // Inicializamos pegando do localStorage para lembrar a escolha do usuário, ou cravado no TENANT
    const [activeServer, setActiveServerState] = useState<string>(() => {
        if (tenant && SERVERS.some(s => s.id === tenant)) return tenant;
        const saved = localStorage.getItem('@l2market:server');
        return SERVERS.some(s => s.id === saved) ? saved! : SERVERS[0].id;
    });

    const activeAvailableServers = tenant ? SERVERS.filter(s => s.id === tenant) : SERVERS;

    const setActiveServer = (serverId: string) => {
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
