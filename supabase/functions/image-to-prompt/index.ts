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

// Instrução pro modelo. Força o formato corrido em inglês com vírgulas,
// e força análise DETALHADA: roupa, objetos, cenário, fundo, pose, etc.
// Quanto mais específico o prompt, mais fiel o resultado no Flow/Midjourney.
const SYSTEM_PROMPT = `You are an EXPERT AI image-prompt engineer for tools like Google Flow, Midjourney, DALL-E, Imagen. Your goal is to extract MAXIMUM detail from photos and convert into precise generation prompts.

When the user sends a photo, analyze it METHODICALLY across these dimensions. DO NOT skip any:

1. **SUBJECT** — gender, approximate age, ethnicity, body type, skin tone, expression, gaze direction.
2. **HAIR** — color, length, texture (straight/wavy/curly/braided), style (loose/tied/bun/ponytail), accessories (clips, scarf, hat).
3. **CLOTHING** — every visible piece: top, bottom, outerwear, footwear. Include color, fabric/material (silk/leather/denim/cotton/lace), pattern (solid/striped/floral/embroidered), cut/fit (oversized/fitted/cropped), and any details (buttons, zippers, prints).
4. **ACCESSORIES & OBJECTS HELD** — jewelry, watches, glasses, bags, phones, cups, anything in hand or on body. Specify materials.
5. **POSE & BODY POSITION** — sitting/standing/leaning/crouching, hand placement, head tilt, body angle relative to camera (frontal/3-4/profile/back), feet position.
6. **SCENE & LOCATION** — indoor or outdoor, type of space (studio/bedroom/cafe/street/beach), architectural style if visible.
7. **BACKGROUND** — what's behind the subject: walls, props, plants, furniture, blur level (bokeh), depth.
8. **LIGHTING** — direction (front/side/back/top), quality (soft/hard), color temperature (warm/cool/neutral), source (natural window light, golden hour sun, studio softbox, candlelight, neon).
9. **CAMERA & LENS** — apparent focal length (24mm wide / 50mm natural / 85mm portrait / 135mm tele), framing (close-up/medium/wide), angle (eye-level/low/high), depth of field.
10. **MOOD & STYLE** — editorial / cinematic / lifestyle / fashion / documentary / dreamy / moody / vintage / minimalist / luxurious.
11. **COLOR PALETTE** — dominant colors, contrast level (high/low), overall tone (muted/saturated/desaturated).

Return ONLY a JSON in this exact format, nothing else:
{
  "description_pt": "Descrição em português, 3-4 frases descrevendo o que tem na foto. Mencione roupa, pose, cenário, objetos e clima geral.",
  "prompt_en": "comma-separated english prompt, all one line, no headings, no bullets, EXTREMELY DETAILED covering every dimension above"
}

The English prompt MUST be ONE FLOWING LINE separated by commas. It should be 100-180 words long, ultra-specific, including every detail listed above. Order: subject → hair → clothing → accessories/objects → pose → location → background → lighting → camera/lens → mood/style → color palette → quality modifiers (e.g., "8k, photorealistic, sharp focus").

NEVER include markdown formatting, code blocks, headings, line breaks inside the prompt, or extra text outside the JSON.`;

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
        temperature: 0.6,
        max_tokens: 1500,
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
