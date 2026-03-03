-- 1. Tabela para salvar o ID do Discord do usuário quando ele logar
CREATE TABLE IF NOT EXISTS public.discord_users (
    id uuid references auth.users not null primary key,
    discord_id text not null unique,
    username text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabela de Alertas Pessoais (Watchlist) vinculada ao usuário logado
CREATE TABLE IF NOT EXISTS public.user_alerts (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid references auth.users not null,
    discord_id text not null,
    keyword text not null,
    max_price numeric,
    min_enhancement integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Habilitar RLS (Row Level Security) em todas as tabelas!
ALTER TABLE public.market_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_users ENABLE ROW LEVEL SECURITY;

-- ======== POLÍTICAS (POLICIES) ======== --

-- MARKET ITEMS: Qualquer pessoa (anônima ou logada) pode LER a tabela
CREATE POLICY "Market items are viewable by everyone" ON public.market_items
    FOR SELECT USING (true);

-- MARKET ITEMS: Apenas a ROLE SERVICE (Backend/Bot) pode inserir, alterar ou deletar itens
-- (Se estivéssemos usando RLS completo com anon_key, o insert falharia.
-- O Service Role Key bypassa RLS, então não precisamos de uma Policy explícita de Insert para ele.)


-- USER ALERTS: Um usuário só pode inserir alertas com o próprio user_id
CREATE POLICY "Users can insert their own alerts" ON public.user_alerts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- USER ALERTS: Um usuário só pode ver seus próprios alertas
CREATE POLICY "Users can view their own alerts" ON public.user_alerts
    FOR SELECT USING (auth.uid() = user_id);

-- USER ALERTS: Um usuário só pode deletar seus próprios alertas
CREATE POLICY "Users can delete their own alerts" ON public.user_alerts
    FOR DELETE USING (auth.uid() = user_id);


-- DISCORD USERS: Um usuário só insere/vê/altera os seus próprios dados de Discord
CREATE POLICY "Users can select their own discord info" ON public.discord_users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own discord info" ON public.discord_users
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own discord info" ON public.discord_users
    FOR UPDATE USING (auth.uid() = id);

-- ======== TRIGGER PARA SINCRONIZAR USUÁRIOS ======== --
-- Como queremos pegar o ID numérico nativo do Discord (ex: 1234471823) para mandar as mensagens de DM:
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.discord_users (id, discord_id, username)
  VALUES (
    new.id, 
    -- O token de provedor no Identity geralmente contém o ID do Discord real no full_name ou sub
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'custom_claims'->>'global_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dispara o trigger toda vez que alguém logar pela primeira vez com Discord (SignUp)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
