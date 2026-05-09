// /upgrade — escolha de plano + waitlist Studio + checkout via Asaas.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-client.js';

const $ = (id) => document.getElementById(id);

function showToast(msg, isError) {
  const host = $('toastHost');
  const t = document.createElement('div');
  t.className = 'gal-toast' + (isError ? ' error' : '');
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
}

// ===== Pro CTA =====
$('goPro').addEventListener('click', async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showToast('Faça login pra continuar');
    setTimeout(() => location.href = `login.html?return=${encodeURIComponent(location.pathname)}`, 800);
    return;
  }
  $('checkoutModal').hidden = false;
  $('cpfInput').focus();
});

$('checkoutClose').addEventListener('click', () => $('checkoutModal').hidden = true);
$('checkoutModal').addEventListener('click', e => {
  if (e.target.id === 'checkoutModal') $('checkoutModal').hidden = true;
});

// ===== CPF/Phone masks =====
function maskCPF(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9) return v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
  if (v.length > 6) return v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
  if (v.length > 3) return v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
  return v;
}
function maskPhone(v) {
  v = v.replace(/\D/g, '').slice(0, 11);
  if (v.length > 10) return v.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (v.length > 6)  return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  if (v.length > 2)  return v.replace(/(\d{2})(\d{0,5})/, '($1) $2');
  return v;
}
$('cpfInput').addEventListener('input', e => e.target.value = maskCPF(e.target.value));
$('phoneInput').addEventListener('input', e => e.target.value = maskPhone(e.target.value));

// ===== Submit checkout =====
$('checkoutForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const cpf = $('cpfInput').value.replace(/\D/g, '');
  const phone = $('phoneInput').value.replace(/\D/g, '');
  if (cpf.length !== 11) {
    $('checkoutStatus').textContent = 'CPF inválido (precisa de 11 dígitos)';
    $('checkoutStatus').className = 'up-checkout-status error';
    return;
  }

  // Abre a aba já (síncrono) pra escapar do bloqueador de popup; preenchemos
  // a URL ou mensagem de erro depois que a edge function responder.
  const checkoutTab = window.open('about:blank', '_blank');
  if (checkoutTab) {
    checkoutTab.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Gerando cobrança…</title>
      <style>
        body{margin:0;background:#0f1115;color:#e9ecf2;font-family:system-ui,sans-serif;
             display:flex;flex-direction:column;align-items:center;justify-content:center;
             height:100vh;text-align:center;padding:24px;}
        .sp{width:42px;height:42px;border:3px solid rgba(167,139,250,0.2);
            border-top-color:#a78bfa;border-radius:50%;animation:s 1s linear infinite;margin-bottom:18px;}
        @keyframes s{to{transform:rotate(360deg)}}
        h1{font-size:18px;margin:0 0 6px;font-weight:600;}
        p{color:#8b8fa3;font-size:13px;margin:0;}
      </style></head><body>
      <div class="sp"></div>
      <h1>Gerando cobrança no Asaas…</h1>
      <p>Pode levar alguns segundos. Não feche esta aba.</p>
      </body></html>
    `);
    checkoutTab.document.close();
  }

  const btn = $('checkoutSubmit');
  btn.disabled = true;
  btn.innerHTML = '<span class="gal-spinner"></span> Gerando cobrança…';
  $('checkoutStatus').textContent = '';

  function showErrorInTab(msg) {
    if (!checkoutTab || checkoutTab.closed) return;
    try {
      checkoutTab.document.open();
      checkoutTab.document.write(`
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8">
        <title>Erro</title>
        <style>
          body{margin:0;background:#0f1115;color:#e9ecf2;font-family:system-ui,sans-serif;
               display:flex;flex-direction:column;align-items:center;justify-content:center;
               height:100vh;text-align:center;padding:24px;}
          .ic{width:56px;height:56px;border-radius:50%;background:rgba(255,93,108,0.15);
              color:#ff5d6c;display:flex;align-items:center;justify-content:center;
              font-size:32px;margin-bottom:18px;}
          h1{font-size:20px;margin:0 0 10px;color:#ff5d6c;}
          p{color:#c2c5d2;font-size:14px;line-height:1.5;max-width:420px;margin:0;}
        </style></head><body>
        <div class="ic">!</div>
        <h1>Não foi possível gerar a cobrança</h1>
        <p>${String(msg).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]))}</p>
        </body></html>
      `);
      checkoutTab.document.close();
    } catch (e) { console.warn('falha ao escrever na aba', e); }
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Sessão expirada — faça login novamente');

    const res = await fetch(`${SUPABASE_URL}/functions/v1/asaas-create-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ cpf, phone }),
    });
    const json = await res.json();
    if (!res.ok || !json.invoiceUrl) {
      const msg = json?.error || `Erro ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 200));
    }
    if (checkoutTab && !checkoutTab.closed) {
      checkoutTab.location.href = json.invoiceUrl;
    } else {
      // Popup bloqueado: abre na mesma aba como fallback
      window.open(json.invoiceUrl, '_blank') || (location.href = json.invoiceUrl);
    }
    showToast('Cobrança gerada! Pagamento aberto em nova aba.');
    $('checkoutModal').hidden = true;
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="credit-card"></i> Continuar pro pagamento';
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error('[checkout] falhou:', err);
    showErrorInTab(err.message || err);
    $('checkoutStatus').textContent = 'Erro: ' + (err.message || err);
    $('checkoutStatus').className = 'up-checkout-status error';
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="credit-card"></i> Continuar pro pagamento';
    if (window.lucide) lucide.createIcons();
  }
});

// ===== Studio waitlist =====
$('waitlistForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('waitlistEmail').value.trim().toLowerCase();
  if (!email) return;
  const msg = $('waitlistMsg');
  msg.textContent = 'Enviando…';
  msg.className = 'up-card-foot';

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('studio_waitlist')
    .insert({ email, user_id: user?.id || null });

  if (error) {
    if (String(error.message || '').includes('duplicate')) {
      msg.textContent = '✓ Você já está na lista!';
      msg.className = 'up-card-foot ok';
    } else {
      msg.textContent = 'Erro: ' + error.message;
      msg.className = 'up-card-foot error';
    }
    return;
  }
  msg.textContent = '✓ Adicionado à lista. Te avisamos no lançamento.';
  msg.className = 'up-card-foot ok';
  $('waitlistEmail').value = '';
});

// ===== Render plano atual (se logado) =====
async function showCurrentPlan() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: prof } = await supabase
    .from('profiles')
    .select('plan, pro_until')
    .eq('id', user.id)
    .maybeSingle();
  const isPro = (prof?.plan === 'pro' || prof?.plan === 'studio')
    && prof?.pro_until && new Date(prof.pro_until) > new Date();
  if (isPro) {
    document.querySelector('.up-pro').classList.add('current');
    $('goPro').innerHTML = '<i data-lucide="check"></i> Plano atual';
    $('goPro').disabled = true;
    if (window.lucide) lucide.createIcons();
  }
}
showCurrentPlan();
