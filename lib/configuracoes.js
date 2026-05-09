// Configuracoes — gestao de chaves de API (localStorage).
// Compartilha as chaves com o Chat IA via mesma key prefix `chat-key-{provider}`.

const $ = (sel) => document.querySelector(sel);

const PROVIDERS = {
  groq: {
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    testModel: 'llama-3.1-8b-instant',
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    testModel: 'gpt-4o-mini',
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    testModel: 'meta-llama/llama-3.2-3b-instruct:free',
  },
};

function showToast(msg, isError) {
  const host = document.getElementById('toastHost');
  const t = document.createElement('div');
  t.className = 'gal-toast' + (isError ? ' error' : '');
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
}

function getKey(provider) {
  return localStorage.getItem(`chat-key-${provider}`) || '';
}
function setKey(provider, value) {
  if (value) localStorage.setItem(`chat-key-${provider}`, value);
  else localStorage.removeItem(`chat-key-${provider}`);
}

function setStatus(provider, kind, msg) {
  const el = document.querySelector(`[data-status="${provider}"]`);
  if (!el) return;
  el.className = 'cfg-status ' + (kind || '');
  el.textContent = msg || '';
}

function loadKeys() {
  Object.keys(PROVIDERS).forEach(p => {
    const input = document.querySelector(`[data-key="${p}"]`);
    if (!input) return;
    const v = getKey(p);
    input.value = v;
    if (v) setStatus(p, 'ok', 'Configurada');
  });
}

function setupEyeToggles() {
  document.querySelectorAll('[data-eye]').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.eye;
      const input = document.querySelector(`[data-key="${provider}"]`);
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = `<i data-lucide="${showing ? 'eye' : 'eye-off'}"></i>`;
      if (window.lucide) lucide.createIcons();
    });
  });
}

function setupSaveButtons() {
  document.querySelectorAll('[data-save]').forEach(btn => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.save;
      const input = document.querySelector(`[data-key="${provider}"]`);
      const v = input.value.trim();
      setKey(provider, v);
      if (v) {
        showToast(`Chave ${provider} salva ✓`);
        setStatus(provider, 'ok', 'Salva');
      } else {
        showToast(`Chave ${provider} removida`);
        setStatus(provider, '', '');
      }
    });
  });
}

async function testKey(provider) {
  const key = document.querySelector(`[data-key="${provider}"]`).value.trim();
  if (!key) { showToast('Cole uma chave primeiro', true); return; }
  setStatus(provider, 'testing', 'Testando…');

  try {
    const cfg = PROVIDERS[provider];
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` };
    if (provider === 'openrouter') headers['HTTP-Referer'] = location.origin;

    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.testModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      let msg = `HTTP ${res.status}`;
      try { const j = JSON.parse(txt); msg = j.error?.message || j.error || msg; } catch {}
      setStatus(provider, 'error', msg.slice(0, 80));
      showToast(`Teste falhou: ${msg.slice(0, 80)}`, true);
      return;
    }
    setStatus(provider, 'ok', 'Conexão OK');
    showToast(`${provider} conectado ✓`);
    // Auto-save se passou no teste
    setKey(provider, key);
  } catch (err) {
    setStatus(provider, 'error', String(err.message || err).slice(0, 80));
    showToast('Erro: ' + (err.message || err), true);
  }
}

function setupTestButtons() {
  document.querySelectorAll('[data-test]').forEach(btn => {
    btn.addEventListener('click', () => testKey(btn.dataset.test));
  });
}

function setupClearAll() {
  document.getElementById('clearAll').addEventListener('click', () => {
    if (!confirm('Remover TODAS as chaves de API deste navegador?')) return;
    Object.keys(PROVIDERS).forEach(p => {
      setKey(p, '');
      const input = document.querySelector(`[data-key="${p}"]`);
      if (input) input.value = '';
      setStatus(p, '', '');
    });
    showToast('Chaves removidas');
  });
}

loadKeys();
setupEyeToggles();
setupSaveButtons();
setupTestButtons();
setupClearAll();
