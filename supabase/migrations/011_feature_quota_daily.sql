-- Sistema de cota diária por feature pra controlar uso de APIs pagas (Gemini, etc).
-- Cada user tem N usos por dia de cada feature; limite depende do plano (Free/Pro/Pro Max).
-- Tabela é estreita: 1 linha por user+feature+dia. Reseta naturalmente quando vira o dia.

CREATE TABLE IF NOT EXISTS public.daily_usage (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  usage_date  date NOT NULL DEFAULT CURRENT_DATE,
  count       integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature_key, usage_date)
);

CREATE INDEX IF NOT EXISTS daily_usage_user_date_idx
  ON public.daily_usage (user_id, usage_date DESC);

ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

-- Usuário só lê o próprio uso. Escrita só via RPC SECURITY DEFINER.
CREATE POLICY daily_usage_select_own
  ON public.daily_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Retorna estado da cota do usuário pra uma feature.
-- Recebe o limite externamente pra calcular allowed/remaining no mesmo round-trip.
-- p_daily_limit = 0 significa ILIMITADO.
CREATE OR REPLACE FUNCTION public.check_feature_quota(
  p_feature_key text,
  p_daily_limit integer
)
RETURNS TABLE(allowed boolean, used integer, remaining integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_used integer;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 0, 0;
    RETURN;
  END IF;

  SELECT count INTO v_used
    FROM public.daily_usage
   WHERE user_id = v_uid
     AND feature_key = p_feature_key
     AND usage_date = CURRENT_DATE;

  v_used := COALESCE(v_used, 0);

  RETURN QUERY SELECT
    (p_daily_limit = 0 OR v_used < p_daily_limit) AS allowed,
    v_used AS used,
    CASE WHEN p_daily_limit = 0 THEN 999999
         ELSE GREATEST(p_daily_limit - v_used, 0)
    END AS remaining;
END $$;

-- Incrementa contagem. Retorna o NOVO total. Chamada apenas pelo backend
-- (edge function) com service_role; user nunca chama direto.
CREATE OR REPLACE FUNCTION public.consume_feature_quota(
  p_user_id uuid,
  p_feature_key text
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO public.daily_usage (user_id, feature_key, usage_date, count)
  VALUES (p_user_id, p_feature_key, CURRENT_DATE, 1)
  ON CONFLICT (user_id, feature_key, usage_date)
  DO UPDATE SET count = public.daily_usage.count + 1,
                updated_at = now()
  RETURNING count INTO v_count;
  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.check_feature_quota(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_feature_quota(text, integer) TO authenticated;

-- consume só pelo service_role (edge function); user comum não pode incrementar
REVOKE ALL ON FUNCTION public.consume_feature_quota(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_feature_quota(uuid, text) TO service_role;
