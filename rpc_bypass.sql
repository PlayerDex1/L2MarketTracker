-- SCRIPT DEFINITIVO DE BYPASS RLS PARA MARKET TRACKER
-- Estes scripts criam Funções RPC que operam com "SECURITY DEFINER", significando
-- que elas executam com privilégios de Admin em relação à tabela, bypassando
-- as restrições de sessão RLS JWT para que possamos inserir dados pela API sem bloqueios.

-- 1. Função Inserir Alerta
CREATE OR REPLACE FUNCTION public.insert_user_alert(
  p_user_id uuid,
  p_discord_id text,
  p_server_id text,
  p_keyword text,
  p_max_price numeric,
  p_min_enhancement integer
) RETURNS public.user_alerts AS $$
DECLARE
  v_alert public.user_alerts;
BEGIN
  INSERT INTO public.user_alerts (user_id, discord_id, server_id, keyword, max_price, min_enhancement)
  VALUES (p_user_id, p_discord_id, p_server_id, p_keyword, p_max_price, p_min_enhancement)
  RETURNING * INTO v_alert;
  RETURN v_alert;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Função Deletar Alerta
CREATE OR REPLACE FUNCTION public.delete_user_alert(p_id uuid) 
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_alerts WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
