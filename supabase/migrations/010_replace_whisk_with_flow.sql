-- Substitui 'whisk' por 'flow' no constraint de model_used.
-- Whisk foi descontinuado pelo Google, virou Flow.
-- Verificado em 2026-05-11: zero posts existentes com 'whisk', então não precisa migrar dados.

ALTER TABLE prompt_posts DROP CONSTRAINT IF EXISTS prompt_posts_model_used_check;

ALTER TABLE prompt_posts ADD CONSTRAINT prompt_posts_model_used_check
  CHECK (model_used IS NULL OR model_used IN
    ('gemini','midjourney','flow','dalle','stable-diffusion','flux','outro'));
