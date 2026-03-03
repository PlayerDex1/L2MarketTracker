-- Adicionando a coluna server_id para comportar múltiplos servidores (ZGaming e Pride)
ALTER TABLE public.market_items 
ADD COLUMN IF NOT EXISTS server_id text DEFAULT 'zgaming' NOT NULL;

ALTER TABLE public.user_alerts 
ADD COLUMN IF NOT EXISTS server_id text DEFAULT 'zgaming' NOT NULL;

-- Atualizar itens existentes para garantir que o default foi aplicado
UPDATE public.market_items SET server_id = 'zgaming' WHERE server_id IS NULL;
UPDATE public.user_alerts SET server_id = 'zgaming' WHERE server_id IS NULL;
