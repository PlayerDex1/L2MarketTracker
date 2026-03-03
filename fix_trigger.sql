-- ======== CORREÇÃO DO TRIGGER PARA SINCRONIZAR USUÁRIOS ======== --
-- Como queremos pegar o ID numérico nativo do Discord:
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  extracted_discord_id text;
  extracted_username text;
BEGIN
  -- Tenta pegar do sub ou do provider_id
  extracted_discord_id := COALESCE(
    new.raw_user_meta_data->>'provider_id',
    new.raw_user_meta_data->>'sub',
    new.id::text -- Fallback pro UUID caso algo falhe, pra não quebrar o login
  );
  
  -- Tenta pegar o nome
  extracted_username := COALESCE(
    new.raw_user_meta_data->>'custom_claims'->>'global_name',
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    'Usuário Discord'
  );

  INSERT INTO public.discord_users (id, discord_id, username)
  VALUES (
    new.id, 
    extracted_discord_id,
    extracted_username
  )
  ON CONFLICT (id) DO UPDATE SET 
    discord_id = EXCLUDED.discord_id, 
    username = EXCLUDED.username;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
