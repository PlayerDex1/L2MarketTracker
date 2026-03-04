import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    signInWithDiscord: () => Promise<void>;
    signOut: () => Promise<void>;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    signInWithDiscord: async () => { },
    signOut: async () => { },
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkAndSaveUser = async (currentSession: Session | null) => {
            if (currentSession?.user) {
                const discordId = currentSession.user.user_metadata?.provider_id || currentSession.user.user_metadata?.sub;
                const username = currentSession.user.user_metadata?.custom_claims?.global_name || currentSession.user.user_metadata?.full_name || 'Usuário Discord';

                if (discordId) {
                    // Try to upsert the user info directly from the frontend
                    await supabase.from('discord_users').upsert({
                        id: currentSession.user.id,
                        discord_id: discordId,
                        username: username
                    }, { onConflict: 'id' }).select().single();
                }
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            if (session) checkAndSaveUser(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            if (session) checkAndSaveUser(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const signInWithDiscord = async () => {
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const redirectUrl = isLocalhost
            ? window.location.origin
            : 'https://gerencimanento-de-clan.vercel.app'; // Força para a URL principal em produção

        await supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: {
                redirectTo: redirectUrl,
            },
        });
    };

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, signInWithDiscord, signOut, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
