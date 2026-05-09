// asaas-create-subscription
// Cria customer + subscription no Asaas pro user logado, retorna invoiceUrl.
//
// POST /functions/v1/asaas-create-subscription
// Body: { cpf: string, phone?: string }
// Headers: Authorization: Bearer <user-jwt>

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!;
const ASAAS_API_URL = Deno.env.get('ASAAS_API_URL') || 'https://sandbox.asaas.com/api/v3';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PRO_VALUE = 39.90;
const PRO_DESCRIPTION = 'Innova AI Studio — Assinatura Pro Mensal';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    // Auth: usa o JWT do user pra ler quem é
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonRes({ error: 'no auth' }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return jsonRes({ error: 'invalid user' }, 401);

    const body = await req.json().catch(() => ({}));
    const cpf = String(body.cpf || '').replace(/\D/g, '');
    if (cpf.length !== 11) return jsonRes({ error: 'CPF inválido' }, 400);
    const phone = String(body.phone || '').replace(/\D/g, '');

    // Service-role client pra DB
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pega profile
    const { data: profile } = await admin
      .from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (!profile) return jsonRes({ error: 'profile não encontrado' }, 404);

    // 1) Cria/recupera customer no Asaas
    let asaasCustomerId = profile.asaas_customer_id;
    if (!asaasCustomerId) {
      const customerRes = await fetch(`${ASAAS_API_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
        body: JSON.stringify({
          name: profile.display_name || user.email,
          email: user.email,
          cpfCnpj: cpf,
          mobilePhone: phone || undefined,
          externalReference: user.id,
        }),
      });
      const customer = await customerRes.json();
      if (!customerRes.ok) return jsonRes({ error: 'asaas customer error', details: customer }, 502);
      asaasCustomerId = customer.id;

      await admin.from('profiles').update({ asaas_customer_id: asaasCustomerId }).eq('id', user.id);
    }

    // 2) Cria subscription no Asaas
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const subRes = await fetch(`${ASAAS_API_URL}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY },
      body: JSON.stringify({
        customer: asaasCustomerId,
        billingType: 'UNDEFINED', // ou CREDIT_CARD pra recurring zero-touch
        value: PRO_VALUE,
        nextDueDate: tomorrow,
        cycle: 'MONTHLY',
        description: PRO_DESCRIPTION,
        externalReference: user.id,
      }),
    });
    const sub = await subRes.json();
    if (!subRes.ok) return jsonRes({ error: 'asaas subscription error', details: sub }, 502);

    // 3) Salva no banco
    await admin.from('profiles').update({ asaas_subscription_id: sub.id }).eq('id', user.id);
    await admin.from('subscriptions').insert({
      user_id: user.id,
      asaas_subscription_id: sub.id,
      plan: 'pro',
      status: 'pending',
      cycle: 'MONTHLY',
      value: PRO_VALUE,
      next_due_date: tomorrow,
    });

    // 4) Pega primeira cobrança pra retornar invoiceUrl. Asaas leva uns ms
    // pra gerar o pagamento, então tentamos até 4x com 500ms de gap.
    let invoiceUrl: string | null = null;
    let lastPays: any = null;
    for (let i = 0; i < 4; i++) {
      const paysRes = await fetch(`${ASAAS_API_URL}/subscriptions/${sub.id}/payments`, {
        headers: { 'access_token': ASAAS_API_KEY },
      });
      lastPays = await paysRes.json();
      invoiceUrl = lastPays?.data?.[0]?.invoiceUrl || null;
      if (invoiceUrl) break;
      if (i < 3) await new Promise((r) => setTimeout(r, 500));
    }

    if (!invoiceUrl) {
      console.error('invoiceUrl não veio em 4 tentativas', JSON.stringify(lastPays));
      return jsonRes({
        error: 'Cobrança gerada mas o link ainda não está disponível. Recarregue a página em alguns segundos e veja em "Minha assinatura".',
        subscriptionId: sub.id,
      }, 502);
    }

    return jsonRes({ ok: true, invoiceUrl, subscriptionId: sub.id });
  } catch (err) {
    console.error(err);
    return jsonRes({ error: String(err.message || err) }, 500);
  }
});

function jsonRes(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
