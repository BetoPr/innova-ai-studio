// asaas-webhook
// Recebe POST do Asaas a cada evento de pagamento.
// Atualiza profiles.plan e subscriptions.status.
// Idempotente via payment_events.event_id unique.
//
// Deve ser cadastrado no painel Asaas:
// https://htaihtmpnwzyxamkhnty.supabase.co/functions/v1/asaas-webhook

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ASAAS_WEBHOOK_TOKEN = Deno.env.get('ASAAS_WEBHOOK_TOKEN')!;

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Valida token (Asaas pode enviar em headers diferentes ou query string)
  const headerToken = (
    req.headers.get('asaas-access-token') ||
    req.headers.get('Asaas-Access-Token') ||
    req.headers.get('access_token') ||
    req.headers.get('x-asaas-token') ||
    new URL(req.url).searchParams.get('token') ||
    ''
  ).trim();
  const expected = (ASAAS_WEBHOOK_TOKEN || '').trim();
  if (!headerToken || headerToken !== expected) {
    console.warn('[webhook] 401 token mismatch');
    return new Response('Unauthorized', { status: 401 });
  }

  let payload;
  try { payload = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const event = payload?.event;
  const eventId = payload?.id || `${event}-${payload?.payment?.id || payload?.subscription?.id || Date.now()}`;
  if (!event) return new Response('No event', { status: 400 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Idempotencia
  const { error: upsertErr } = await admin
    .from('payment_events')
    .insert({ event_id: eventId, event_type: event, payload });
  if (upsertErr && !String(upsertErr.message || '').includes('duplicate')) {
    console.error('payment_events insert error', upsertErr);
  }
  if (upsertErr && String(upsertErr.message || '').includes('duplicate')) {
    return new Response('Already processed', { status: 200 });
  }

  try {
    const payment = payload.payment;
    const subscription = payload.subscription;
    const subId = payment?.subscription || subscription?.id;

    // Encontra user pelo asaas_subscription_id
    let userId = null;
    if (subId) {
      const { data: prof } = await admin
        .from('profiles')
        .select('id')
        .eq('asaas_subscription_id', subId)
        .maybeSingle();
      userId = prof?.id;
    }

    switch (event) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED': {
        if (!userId || !subId) break;
        // Pro vale ate 33 dias depois do pagamento (30 dias do ciclo + 3 de
        // graca). Asaas vai criar a proxima fatura e disparar PAYMENT_CREATED
        // que atualiza next_due_date com o valor exato.
        const proUntil = new Date(Date.now() + 33 * 24 * 3600 * 1000).toISOString();
        await admin.from('profiles').update({ plan: 'pro', pro_until: proUntil }).eq('id', userId);
        await admin.from('subscriptions').update({ status: 'active' })
          .eq('asaas_subscription_id', subId);
        break;
      }
      case 'PAYMENT_CREATED': {
        // Asaas criou nova cobranca (geralmente a do proximo ciclo, logo apos
        // PAYMENT_RECEIVED). Atualiza next_due_date com a data correta.
        if (subId && payment?.dueDate) {
          await admin.from('subscriptions').update({
            next_due_date: payment.dueDate,
          }).eq('asaas_subscription_id', subId);
        }
        break;
      }
      case 'PAYMENT_OVERDUE': {
        if (subId) {
          await admin.from('subscriptions').update({ status: 'overdue' }).eq('asaas_subscription_id', subId);
        }
        // Mantem pro_until — cliente tem margem
        break;
      }
      case 'SUBSCRIPTION_INACTIVATED':
      case 'SUBSCRIPTION_DELETED':
      case 'PAYMENT_REFUNDED': {
        if (userId) {
          await admin.from('profiles').update({ plan: 'free', pro_until: null }).eq('id', userId);
        }
        if (subId) {
          await admin.from('subscriptions').update({ status: 'canceled' }).eq('asaas_subscription_id', subId);
        }
        break;
      }
      default:
        // log no payment_events ja foi feito acima
        break;
    }
  } catch (err) {
    console.error('webhook handler error', err);
    // ainda assim retornamos 200 pra Asaas nao ficar retry infinito
  }

  return new Response('ok', { status: 200 });
});
