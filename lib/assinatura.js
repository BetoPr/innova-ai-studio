// /assinatura — gestão da assinatura do user.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-client.js';

const $ = (id) => document.getElementById(id);

function showToast(msg, isError) {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const t = document.createElement('div');
  t.className = 'gal-toast' + (isError ? ' error' : '');
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtMoney(v) {
  if (v == null) return '—';
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

const STATUS_LABEL = {
  PENDING: 'Pendente', CONFIRMED: 'Confirmado', RECEIVED: 'Pago',
  OVERDUE: 'Em atraso', REFUNDED: 'Reembolsado', RECEIVED_IN_CASH: 'Pago',
  REFUND_REQUESTED: 'Reembolso solicitado', CHARGEBACK_REQUESTED: 'Chargeback',
  CHARGEBACK_DISPUTE: 'Chargeback em disputa', AWAITING_CHARGEBACK_REVERSAL: 'Aguardando reversão',
  DUNNING_REQUESTED: 'Cobrança extrajudicial', DUNNING_RECEIVED: 'Cobrado',
  AWAITING_RISK_ANALYSIS: 'Análise de risco',
};

const BILLING_LABEL = {
  CREDIT_CARD: 'Cartão de crédito', BOLETO: 'Boleto', PIX: 'PIX',
  UNDEFINED: 'A definir', TRANSFER: 'Transferência', DEPOSIT: 'Depósito',
};

async function fetchPaymentHistory() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-payment-history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });
    const json = await res.json();
    if (!res.ok) {
      console.warn('payment history error', json);
      return [];
    }
    return json.payments || [];
  } catch (err) {
    console.warn('payment history fetch failed', err);
    return [];
  }
}

function renderPendingInvoice(payments, isPro) {
  // Encontra fatura PENDING ou OVERDUE mais recente (com invoiceUrl)
  const pending = payments.find(p =>
    (p.status === 'PENDING' || p.status === 'OVERDUE') && p.invoiceUrl
  );
  const wrap = $('pendingInvoiceCard');
  if (!pending) { wrap.hidden = true; return; }

  const isOverdue = pending.status === 'OVERDUE';

  if (isOverdue && !isPro) {
    // User foi rebaixado pra Free por falta de pagamento
    $('pendingTitle').textContent = 'Sua assinatura voltou para Free';
    $('pendingDesc').textContent = 'Um pagamento não foi feito. Pague pra restaurar automaticamente seu Pro.';
  } else if (isOverdue) {
    $('pendingTitle').textContent = 'Você tem uma fatura em atraso';
    $('pendingDesc').textContent = 'Pague pra continuar com seu Pro ativo. Caso contrário sua assinatura pode ser cancelada.';
  } else {
    $('pendingTitle').textContent = 'Você tem uma fatura pendente';
    $('pendingDesc').textContent = 'Pague antes do vencimento pra manter seu Pro ativo.';
  }

  $('pendingDue').textContent = fmtDate(pending.dueDate);
  $('pendingValue').textContent = fmtMoney(pending.value);
  $('pendingMethod').textContent = BILLING_LABEL[pending.billingType] || pending.billingType || '—';
  $('payNowBtn').href = pending.invoiceUrl;
  wrap.classList.toggle('overdue', isOverdue);
  wrap.hidden = false;
}

function renderHistory(payments) {
  const card = $('historyCard');
  const list = $('paymentHistory');
  if (!payments.length) { card.hidden = true; return; }
  list.innerHTML = payments.map(p => {
    const status = STATUS_LABEL[p.status] || p.status;
    const billing = BILLING_LABEL[p.billingType] || p.billingType || '—';
    const isPaid = p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH';
    const dateLabel = isPaid && p.paymentDate
      ? `Pago em ${fmtDate(p.paymentDate)}`
      : `Vence em ${fmtDate(p.dueDate)}`;
    const link = p.invoiceUrl
      ? `<a href="${p.invoiceUrl}" target="_blank" rel="noopener" class="pay-history-link" title="Ver fatura"><i data-lucide="external-link"></i></a>`
      : '';
    return `
      <div class="pay-history-row pay-${p.status.toLowerCase()}">
        <div class="pay-history-main">
          <strong>${fmtMoney(p.value)}</strong>
          <span class="pay-history-meta">${billing} · ${dateLabel}</span>
        </div>
        <div class="pay-history-side">
          <span class="pay-history-status pay-status-${p.status.toLowerCase()}">${status}</span>
          ${link}
        </div>
      </div>
    `;
  }).join('');
  card.hidden = false;
  if (window.lucide) lucide.createIcons();
}

function showCancelConfirmModal() {
  return new Promise((resolve) => {
    const existing = document.getElementById('cancelSubModal');
    if (existing) existing.remove();
    const m = document.createElement('div');
    m.id = 'cancelSubModal';
    m.className = 'delete-modal';
    m.innerHTML = `
      <div class="delete-modal-content">
        <h2><i data-lucide="alert-triangle"></i> Cancelar assinatura?</h2>
        <p>Você continuará com <strong>Pro</strong> até o fim do ciclo já pago. Depois disso, sua conta volta automaticamente para o plano Free.</p>
        <p class="delete-keep-info">Os prompts que você publicou continuam visíveis na galeria. Você pode reassinar quando quiser.</p>
        <div class="delete-modal-actions">
          <button type="button" class="gal-btn-ghost" id="cancelSubAbort">Manter Pro</button>
          <button type="button" class="gal-btn-primary delete-confirm-btn" id="cancelSubConfirm">
            <i data-lucide="x-circle"></i> Cancelar assinatura
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(m);
    if (window.lucide) lucide.createIcons();

    const close = (ok) => { m.remove(); resolve(ok); };
    document.getElementById('cancelSubAbort').onclick = () => close(false);
    document.getElementById('cancelSubConfirm').onclick = () => close(true);
    m.onclick = (e) => { if (e.target === m) close(false); };
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', esc); }
    });
  });
}

async function cancelSubscription() {
  const ok = await showCancelConfirmModal();
  if (!ok) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { showToast('Sessão expirada', true); return; }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-cancel-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || `Erro ${res.status}`);
    showToast('Assinatura cancelada ✓');
    setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showToast('Erro: ' + (err.message || err), true);
  }
}

async function init() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    $('authGate').hidden = false;
    $('goLogin').href = `login.html?return=${encodeURIComponent(location.pathname)}`;
    return;
  }
  $('subApp').hidden = false;

  const { data: prof } = await supabase
    .from('profiles')
    .select('plan, pro_until, asaas_subscription_id, asaas_customer_id')
    .eq('id', user.id)
    .maybeSingle();

  const isPro = (prof?.plan === 'pro' || prof?.plan === 'studio')
    && prof?.pro_until && new Date(prof.pro_until) > new Date();

  if (isPro) {
    $('planName').textContent = prof.plan === 'studio' ? 'Studio' : 'Pro';
    $('planDesc').textContent = 'Você tem acesso a todos os prompts curados, construtor completo e benefícios Pro.';
    $('upgradeBtn').textContent = 'Gerenciar plano';
    $('proDetails').hidden = false;

    // Lê subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sub) {
      $('nextDue').textContent = fmtDate(sub.next_due_date);
      $('planValue').textContent = `R$ ${Number(sub.value).toFixed(2).replace('.', ',')}`;
      const statusLabel = {
        pending: 'Pendente', active: 'Ativa', overdue: 'Em atraso',
        canceled: 'Cancelada', expired: 'Expirada',
      }[sub.status] || sub.status;
      $('planStatus').textContent = statusLabel;
      $('planCycle').textContent = sub.cycle === 'YEARLY' ? 'Anual' : 'Mensal';
    }

    $('cancelSub').addEventListener('click', cancelSubscription);
  } else {
    // Lazy check: se profile diz Pro mas pro_until passou, rebaixa
    if (prof?.plan && prof.plan !== 'free' && prof?.pro_until && new Date(prof.pro_until) <= new Date()) {
      await supabase.from('profiles').update({ plan: 'free', pro_until: null }).eq('id', user.id);
    }
  }

  // Histórico + fatura pendente sempre carregam (user pode ter sido Pro antes,
  // ou ter fatura pendente esperando pagamento).
  if (prof?.asaas_customer_id) {
    const payments = await fetchPaymentHistory();
    renderPendingInvoice(payments, isPro);
    renderHistory(payments);
  }
}

init();
