// image-to-prompt
// Recebe imagem em base64, chama Groq Vision (Llama 3.2), retorna descrição PT + prompt EN.
// Aplica cota diária por plano: Free 5/dia, Pro 30/dia, Pro Max ilimitado.
//
// POST /functions/v1/image-to-prompt
// Body: { image_base64: string, mime_type?: string }
// Headers: Authorization: Bearer <user-jwt>

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FEATURE_KEY = 'photo_to_prompt';
// 0 = ilimitado. Pro Max ainda não existe oficialmente; quando criar, vai cair aqui.
const LIMITS: Record<string, number> = {
  free: 5,
  pro: 30,
  pro_max: 0,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Instrução pro modelo. Força o formato que o user pediu:
// prompt corrido em inglês com vírgulas (não bullets, não headings).
const SYSTEM_PROMPT = `You are an expert AI image-prompt engineer for tools like Google Flow, Midjourney, DALL-E, Imagen.

The user will send a photo. Your job is to:
1. Analyze the image carefully (subject, scene, lighting, composition, style, mood, camera angle)
2. Generate a prompt in ENGLISH that recreates similar images
3. Format the prompt as ONE FLOWING LINE separated by commas (NO bullet points, NO headings, NO line breaks inside the prompt)
4. Provide a short Portuguese description for the human user

Return ONLY a JSON in this exact format, nothing else:
{
  "description_pt": "Descrição em português, 2-3 frases curtas.",
  "prompt_en": "comma-separated english prompt, all one line, no headings, no bullets, vivid and specific"
}

The English prompt MUST include: subject (gender/age/pose), clothing details, scene/location, lighting type, camera/lens style, mood, composition. Be specific and vivid but concise (60-120 words max).

NEVER include markdown formatting, code blocks, or extra text outside the JSON.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonRes({ error: 'method not allowed' }, 405);

  try {
    // 1) Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonRes({ error: 'precisa estar logado' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return jsonRes({ error: 'sessão inválida' }, 401);

    // 2) Plano do user
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await admin
      .from('profiles')
      .select('plan, pro_until')
      .eq('id', user.id)
      .maybeSingle();

    const planActive = profile?.pro_until && new Date(profile.pro_until) > new Date();
    const planKey = planActive ? (profile!.plan as string) : 'free';
    const dailyLimit = LIMITS[planKey] ?? LIMITS.free;

    // 3) Verifica cota (usa JWT do user pra check_feature_quota ler com auth.uid())
    const { data: quotaRows, error: quotaErr } = await supabase.rpc('check_feature_quota', {
      p_feature_key: FEATURE_KEY,
      p_daily_limit: dailyLimit,
    });
    if (quotaErr) {
      console.error('quota check error:', quotaErr);
      return jsonRes({ error: 'erro ao verificar cota' }, 500);
    }
    const quota = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows;
    if (!quota?.allowed) {
      return jsonRes({
        error: 'limit_reached',
        message: `Você atingiu o limite de ${dailyLimit} análises de hoje no plano ${planKey}. Volta amanhã ou faça upgrade.`,
        quota: { used: quota?.used ?? 0, limit: dailyLimit, remaining: 0 },
      }, 429);
    }

    // 4) Body
    const body = await req.json().catch(() => ({}));
    const imageBase64 = String(body.image_base64 || '').trim();
    const mimeType = String(body.mime_type || 'image/jpeg');
    if (!imageBase64) return jsonRes({ error: 'image_base64 obrigatório' }, 400);
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mimeType)) {
      return jsonRes({ error: 'mime_type não suportado (use jpeg, png ou webp)' }, 400);
    }

    // 5) Chama Groq Vision com a imagem (formato OpenAI-compatible)
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error('Groq API error:', groqRes.status, errText.slice(0, 500));
      return jsonRes({
        error: 'falha ao analisar imagem',
        details: errText.slice(0, 200),
      }, 502);
    }

    const groqData = await groqRes.json();
    const text = groqData?.choices?.[0]?.message?.content || '';
    let parsed: { description_pt?: string; prompt_en?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('Groq retornou JSON inválido:', text.slice(0, 300));
      return jsonRes({ error: 'IA retornou formato inesperado, tenta de novo' }, 502);
    }

    if (!parsed.prompt_en || !parsed.description_pt) {
      return jsonRes({ error: 'IA retornou resposta incompleta' }, 502);
    }

    // 6) Consome cota (incrementa contagem)
    const { data: newCount, error: consumeErr } = await admin.rpc('consume_feature_quota', {
      p_user_id: user.id,
      p_feature_key: FEATURE_KEY,
    });
    if (consumeErr) {
      console.error('consume quota error:', consumeErr);
      // Não bloqueia o user — o request já foi processado e ele já recebe o resultado
    }

    return jsonRes({
      description_pt: parsed.description_pt.trim(),
      prompt_en: parsed.prompt_en.trim(),
      quota: {
        used: newCount ?? (quota.used + 1),
        limit: dailyLimit,
        remaining: dailyLimit === 0 ? -1 : Math.max(dailyLimit - (newCount ?? quota.used + 1), 0),
        plan: planKey,
      },
    });
  } catch (e) {
    console.error('image-to-prompt error:', e);
    return jsonRes({ error: (e as Error).message || 'erro interno' }, 500);
  }
});

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
