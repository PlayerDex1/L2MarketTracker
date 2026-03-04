-- RE-ORGANIZAÇÃO TOTAL DO BANCO DE DADOS (ZGAMING + PRIDE)

-- 1. Garante que as tabelas existem com todas as colunas necessárias
CREATE TABLE IF NOT EXISTS public.discord_users (
    id uuid references auth.users not null primary key,
    discord_id text not null,
    username text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

CREATE TABLE IF NOT EXISTS public.user_alerts (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    discord_id text not null,
    keyword text not null,
    server_id text default 'zgaming' not null,
    max_price numeric,
    min_enhancement integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Limpa políticas antigas que podem estar causando conflito e bloqueio invisível
DROP POLICY IF EXISTS "Market items are viewable by everyone" ON public.market_items;
DROP POLICY IF EXISTS "Users can insert their own alerts" ON public.user_alerts;
DROP POLICY IF EXISTS "Users can view their own alerts" ON public.user_alerts;
DROP POLICY IF EXISTS "Users can delete their own alerts" ON public.user_alerts;
DROP POLICY IF EXISTS "Users can select their own discord info" ON public.discord_users;
DROP POLICY IF EXISTS "Users can insert their own discord info" ON public.discord_users;
DROP POLICY IF EXISTS "Users can update their own discord info" ON public.discord_users;
DROP POLICY IF EXISTS "Enable ALL for users based on user_id" ON public.user_alerts;
DROP POLICY IF EXISTS "Enable ALL for users based on id" ON public.discord_users;

-- 3. Habilita RLS de base
ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_users ENABLE ROW LEVEL SECURITY;

-- 4. Cria Políticas Simples e Diretas (À Prova de Falhas)

-- MARKET_ITEMS: Leitura Pública
CREATE POLICY "Market items are viewable by everyone" ON public.market_items 
    FOR SELECT USING (true);

-- USER_ALERTS: Permissão TOTAL (Insert/Update/Delete/Select) apenas para o dono (user_id)
CREATE POLICY "Enable ALL for users based on user_id" ON public.user_alerts 
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- DISCORD_USERS: Permissão TOTAL (Insert/Update/Delete/Select) apenas para o dono (id)
CREATE POLICY "Enable ALL for users based on id" ON public.discord_users 
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 5. Garante que o trigger problemático antigo está morto e enterrado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
