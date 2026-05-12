-- Galeria Oficial: prompts curados pela plataforma (publicados pelo admin).
-- Diferente da Galeria Pública (qualquer user pode publicar).
-- O flag is_official é setado pelo admin no momento da publicação.
-- A coluna existente is_pro continua independente (controla quem vê o texto completo).

ALTER TABLE public.prompt_posts
  ADD COLUMN IF NOT EXISTS is_official boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS prompt_posts_is_official_idx
  ON public.prompt_posts (is_official) WHERE is_official = true;

-- Trigger: bloqueia non-admin de marcar is_official = true.
CREATE OR REPLACE FUNCTION public.guard_is_official()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_official = true THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Apenas administradores podem publicar templates oficiais.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_is_official_trigger ON public.prompt_posts;
CREATE TRIGGER guard_is_official_trigger
  BEFORE INSERT OR UPDATE OF is_official ON public.prompt_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_is_official();

-- DROP + CREATE: PostgreSQL não permite mudar ordem de colunas de view
DROP VIEW IF EXISTS public.prompt_posts_public CASCADE;

CREATE VIEW public.prompt_posts_public AS
SELECT pp.id,
       pp.title,
       pp.slug,
       CASE
         WHEN (pp.is_pro AND (NOT is_pro_user(auth.uid())))
           THEN (SUBSTRING(pp.prompt_text FROM 1 FOR 80) || '…'::text)
         ELSE pp.prompt_text
       END AS prompt_text,
       pp.cover_image_url,
       pp.model_used,
       pp.aspect_ratio,
       pp.language,
       pp.category,
       pp.tone,
       pp.extras,
       pp.tags,
       pp.author_id,
       pp.is_pro,
       pp.is_official,
       pp.is_validated,
       pp.is_published,
       pp.likes_count,
       pp.copies_count,
       pp.views_count,
       pp.created_at,
       pp.updated_at,
       p.display_name AS author_display_name,
       p.username AS author_username,
       p.avatar_url AS author_avatar_url
FROM   public.prompt_posts pp
LEFT JOIN public.profiles p ON p.id = pp.author_id
WHERE  pp.is_published = true
       OR pp.author_id = auth.uid()
       OR is_admin(auth.uid());

GRANT SELECT ON public.prompt_posts_public TO anon, authenticated;
