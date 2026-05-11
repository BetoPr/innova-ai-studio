// Publicar / editar prompt na galeria.
// Stepper de 4 passos com upload de capa, polish via Groq do user e RPC.

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../supabase-client.js';
import { CATEGORIES, MODELS, TONES, LANGS, ASPECTS, EXTRAS, FREE_PUBLISH_LIMIT } from './options.js';
import { consumeStagedCover } from './staging-cover.js';

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const params = new URLSearchParams(location.search);
const editSlug = params.get('edit');
const seedText = params.get('seed');

const state = {
  user: null,
  profile: null,
  step: 1,
  total: 4,
  data: {
    title: '',
    promptText: '',
    model: '',
    aspect: '',
    language: 'pt',
    category: '',
    tone: '',
    tags: [],
    extras: [],
    coverFile: null,
    coverUrl: null,        // url existente (modo edit) ou nova apos upload
    publish: true,
    isPro: false,           // só admin pode marcar
  },
  editingId: null,
  origSlug: null,
  isPro: false,
  isAdmin: false,
  publishedCount: 0,
};

// ===== Toast =====
function showToast(msg, isError) {
  const host = $('toastHost');
  const t = document.createElement('div');
  t.className = 'gal-toast' + (isError ? ' error' : '');
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2400);
}

// ===== Slugify =====
function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

// ===== Detect language (grosseiro) =====
function detectLang(text) {
  if (!text || text.length < 30) return 'pt';
  const ptHits = (text.match(/\b(o|a|de|que|para|com|por|um|uma|e|do|da|na|no|os|as)\b/gi) || []).length;
  const enHits = (text.match(/\b(the|of|and|to|in|with|for|a|an|is|on|by|this|that)\b/gi) || []).length;
  return enHits > ptHits ? 'en' : 'pt';
}

// ===== Build chip grids =====
function buildChipGrid(containerId, options, stateKey, mode = 'multi') {
  const c = $(containerId);
  c.innerHTML = options.map(([v, label]) => {
    const active = mode === 'single'
      ? state.data[stateKey] === v
      : (state.data[stateKey] || []).includes(v);
    return `<button type="button" class="gal-fchip${active ? ' active' : ''}" data-value="${v}">${label}</button>`;
  }).join('');
  c.addEventListener('click', e => {
    const btn = e.target.closest('.gal-fchip');
    if (!btn) return;
    const v = btn.dataset.value;
    if (mode === 'single') {
      // Toggle single
      state.data[stateKey] = state.data[stateKey] === v ? '' : v;
      [...c.children].forEach(b => b.classList.toggle('active', b.dataset.value === state.data[stateKey]));
    } else {
      const arr = state.data[stateKey];
      const idx = arr.indexOf(v);
      if (idx === -1) arr.push(v); else arr.splice(idx, 1);
      btn.classList.toggle('active');
    }
  });
}

// ===== Tags input =====
function setupTagsInput() {
  const input = $('tagsInput');
  const list = $('tagsList');

  function renderTags() {
    list.innerHTML = state.data.tags.map((t, i) =>
      `<span class="share-tag-pill">${escapeHtml(t)} <button type="button" data-i="${i}">×</button></span>`
    ).join('');
  }

  function addTag(raw) {
    const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9à-ÿ-\s]/g, '').replace(/\s+/g, '-');
    if (!cleaned) return;
    if (state.data.tags.length >= 8) {
      showToast('Máximo 8 tags', true);
      return;
    }
    if (state.data.tags.includes(cleaned)) return;
    state.data.tags.push(cleaned);
    renderTags();
  }

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input.value);
      input.value = '';
    } else if (e.key === 'Backspace' && !input.value && state.data.tags.length) {
      state.data.tags.pop();
      renderTags();
    }
  });
  input.addEventListener('blur', () => { if (input.value.trim()) { addTag(input.value); input.value = ''; } });
  list.addEventListener('click', e => {
    const btn = e.target.closest('button[data-i]');
    if (!btn) return;
    state.data.tags.splice(+btn.dataset.i, 1);
    renderTags();
  });

  renderTags();
}

// ===== Setup selects =====
function setupSelects() {
  $('modelSel').innerHTML = '<option value="">— escolha o modelo —</option>' + MODELS.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
  $('aspectSel').innerHTML = '<option value="">— escolha a proporção —</option>' + ASPECTS.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
  $('langSel').innerHTML = LANGS.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
  $('toneSel').innerHTML += TONES.map(([v,l]) => `<option value="${v}">${l}</option>`).join('');

  $('modelSel').addEventListener('change', e => state.data.model = e.target.value);
  $('aspectSel').addEventListener('change', e => state.data.aspect = e.target.value);
  $('langSel').addEventListener('change', e => state.data.language = e.target.value);
  $('toneSel').addEventListener('change', e => state.data.tone = e.target.value);
}

// ===== Scroll pra section (layout página única) =====
// Antes o site usava stepper (1-2-3-4) e essa função navegava entre eles.
// No layout single-page, agora ela só scrolla pra section quando uma
// validação falha — pra trazer o campo problemático pro foco do user.
function goStep(n) {
  state.step = Math.max(1, Math.min(state.total, n));
  const section = document.querySelector(`.share-step[data-step="${state.step}"]`);
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function validateStep(step) {
  if (step === 1) {
    const t = state.data.promptText.trim();
    if (t.length < 20) { showToast('Prompt muito curto (min 20 chars)', true); return false; }
    return true;
  }
  if (step === 2) {
    if (!state.data.title.trim()) { showToast('Adicione um título', true); return false; }
    if (state.data.title.trim().length < 4) { showToast('Título muito curto', true); return false; }
    if (!state.data.category) { showToast('Escolha um estilo (categoria)', true); return false; }
    return true;
  }
  if (step === 3) {
    // Capa e opcional
    return true;
  }
  return true;
}

// No layout single-page o card de "Resumo" foi removido (info redundante,
// tudo está visível na mesma página). Mantemos só a checagem de limite Free
// pra desabilitar o botão Publicar e mostrar o card de upgrade.
function refreshLimitGate() {
  const overLimit = !state.isPro && !state.editingId && state.publishedCount >= FREE_PUBLISH_LIMIT;
  $('limitCard').hidden = !overLimit;
  $('publishBtn').disabled = overLimit;
}

// ===== Cover upload (preview, sem upload imediato) =====
function setupCoverUpload() {
  const input = $('coverInput');
  const drop = $('coverDrop');
  const preview = $('coverPreview');
  const empty = $('dropEmpty');
  const previewWrap = $('dropPreview');
  const removeBtn = $('coverRemove');

  // Comprime na importação, não no upload. Por quê: File handles do browser
  // são invalidados após algum tempo (especialmente em arquivos grandes), o
  // que fazia o upload travar quando o user demorava preenchendo o resto.
  // Comprimindo aqui o resultado é um File novo, fresco, criado pelo Canvas
  // — persiste indefinidamente sem o browser desalocar.
  async function setFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Imagem maior que 10MB', true);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showToast('Use JPG, PNG ou WebP', true);
      return;
    }
    empty.hidden = true;
    previewWrap.hidden = false;
    const statusEl = $('coverStatus');

    let processedFile = file;
    if (file.size > 1 * 1024 * 1024) {
      if (statusEl) statusEl.textContent = 'Otimizando imagem…';
      try {
        const before = file.size;
        processedFile = await compressImage(file);
        console.log(`[setFile] comprimido: ${(before / 1024).toFixed(0)}KB → ${(processedFile.size / 1024).toFixed(0)}KB`);
        if (statusEl) statusEl.textContent = `✓ Pronta (${(processedFile.size / 1024).toFixed(0)} KB)`;
      } catch (e) {
        console.warn('[setFile] compressão falhou, usando original:', e);
        if (statusEl) statusEl.textContent = '';
      }
    } else {
      if (statusEl) statusEl.textContent = '';
    }

    state.data.coverFile = processedFile;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      preview.src = dataUrl;
      state.data.coverPreviewDataUrl = dataUrl;
    };
    reader.readAsDataURL(processedFile);
  }

  input.addEventListener('change', (e) => { setFile(e.target.files[0]); });
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) setFile(file);
  });
  removeBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    state.data.coverFile = null;
    state.data.coverUrl = null;
    state.data.coverPreviewDataUrl = null;
    input.value = '';
    preview.src = '';
    empty.hidden = false;
    previewWrap.hidden = true;
  });
}

/**
 * Carrega cover do staging IndexedDB (vindo via "Postar" do histórico do Chat IA).
 * Funciona pra Free (Blob local) e Pro (baixado via SDK no chat-ia.html).
 */
async function loadStagedCover(stagingId) {
  const preview = $('coverPreview');
  const empty = $('dropEmpty');
  const previewWrap = $('dropPreview');
  const status = $('coverStatus');
  if (status) status.textContent = 'Carregando capa…';
  try {
    const blob = await consumeStagedCover(stagingId);
    if (!blob) {
      if (status) status.textContent = '';
      console.warn('Staging vazio — id já consumido ou expirado:', stagingId);
      return;
    }
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    let file = new File([blob], `seed-cover.${ext}`, { type: blob.type || 'image/jpeg' });

    // Comprime na importação (mesma razão do setFile): evita que o File
    // handle expire enquanto o user preenche os campos.
    if (file.size > 1 * 1024 * 1024) {
      if (status) status.textContent = 'Otimizando imagem…';
      try {
        const before = file.size;
        file = await compressImage(file);
        console.log(`[loadStagedCover] comprimido: ${(before / 1024).toFixed(0)}KB → ${(file.size / 1024).toFixed(0)}KB`);
      } catch (e) {
        console.warn('[loadStagedCover] compressão falhou, usando original:', e);
      }
    }

    state.data.coverFile = file;
    state.data.coverUrl = null;

    const reader = new FileReader();
    reader.onload = () => {
      state.data.coverPreviewDataUrl = reader.result;
      preview.src = reader.result;
      empty.hidden = true;
      previewWrap.hidden = false;
      if (status) status.textContent = '✓ Capa carregada do Chat IA';
    };
    reader.readAsDataURL(file);
  } catch (err) {
    console.error('Falha ao consumir staging:', err);
    if (status) status.textContent = '⚠ Não foi possível carregar a capa — suba manualmente';
  }
}

// Race uma Promise contra um timeout. Se a Promise não resolver em ms,
// rejeita com erro de timeout — evita "Enviando capa…" eterno quando o
// upload chegou no servidor mas a resposta nunca volta (rede instável).
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} demorou mais de ${ms / 1000}s`)), ms);
    promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

// Comprime imagem pra max 1600px no maior lado, JPEG 85%. Resultado:
// imagens de IA de 4-9MB viram ~300-700KB sem perda visual. Resolve o
// problema crônico de upload travando em conexões mais lentas.
async function compressImage(file, { maxDim = 1600, quality = 0.85 } = {}) {
  if (!/^image\//.test(file.type)) return file;
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Falha ao carregar imagem pra compressão'));
    i.src = URL.createObjectURL(file);
  });
  try {
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob) throw new Error('toBlob retornou null');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

async function uploadCover() {
  if (!state.data.coverFile) return state.data.coverUrl || null;
  let origFile = state.data.coverFile;

  // Pre-checks: tamanho, tipo, conexão. Falhas aqui são determinísticas
  // (não adianta retry) — melhor mostrar mensagem específica.
  console.log('[uploadCover] iniciando:', {
    name: origFile.name,
    type: origFile.type,
    sizeMB: (origFile.size / 1024 / 1024).toFixed(2),
  });
  if (!navigator.onLine) {
    throw new Error('Sem conexão com a internet. Conecte e tente de novo.');
  }
  if (origFile.size > 10 * 1024 * 1024) {
    throw new Error(`Imagem tem ${(origFile.size / 1024 / 1024).toFixed(1)}MB — limite é 10MB.`);
  }
  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(origFile.type)) {
    throw new Error(`Tipo de imagem não suportado: ${origFile.type || 'desconhecido'}. Use JPG, PNG ou WebP.`);
  }

  // Compressão acontece no momento do import (setFile / loadStagedCover),
  // não aqui. Por quê: File handles podem expirar se o user demora pra
  // publicar; comprimir na importação garante um File "fresco" e pequeno
  // que persiste indefinidamente.

  // Pega session pra autenticar o XHR direto (sem o SDK).
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sessão expirou. Saia e entre de novo.');
  }

  const ext = (origFile.name.split('.').pop() || 'jpg').toLowerCase();

  // Estratégia: XMLHttpRequest direto pra REST API do Storage.
  // Por que XHR e não fetch: XHR expõe eventos de progresso (upload.onprogress)
  // que confirmam SE o navegador está realmente enviando bytes ou se trava
  // antes. Isso é o que faltava pra diagnosticar.
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const path = `${state.user.id}/${Date.now()}-${randomSuffix()}.${ext}`;
    const url = `${SUPABASE_URL}/storage/v1/object/prompt-covers/${path}`;
    const t0 = performance.now();
    console.log(`[uploadCover] tentativa ${attempt} → POST ${url}`);
    try {
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('cache-control', '3600');
        xhr.setRequestHeader('Content-Type', origFile.type);
        xhr.timeout = 30000;

        xhr.upload.onloadstart = () => console.log(`[xhr] upload.loadstart`);
        let lastLogPct = -1;
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          if (pct !== lastLogPct && pct % 10 === 0) {
            console.log(`[xhr] upload progress: ${pct}% (${e.loaded}/${e.total} bytes)`);
            lastLogPct = pct;
          }
        };
        xhr.upload.onload = () => console.log(`[xhr] upload.load (bytes enviados)`);
        xhr.upload.onerror = (e) => console.warn(`[xhr] upload.error`, e);
        xhr.upload.onabort = () => console.warn(`[xhr] upload.abort`);
        xhr.upload.ontimeout = () => console.warn(`[xhr] upload.timeout`);

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            console.log(`[xhr] readyState=4, status=${xhr.status}`);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ status: xhr.status, body: xhr.responseText });
          } else {
            reject(new Error(`HTTP ${xhr.status}: ${(xhr.responseText || '').slice(0, 200)}`));
          }
        };
        xhr.onerror = () => reject(new Error('Erro de rede (XHR onerror) — request bloqueado antes de sair do navegador'));
        xhr.ontimeout = () => reject(new Error('Timeout 30s (XHR ontimeout)'));
        xhr.onabort = () => reject(new Error('Upload abortado'));

        xhr.send(origFile);
      });
      const dt = ((performance.now() - t0) / 1000).toFixed(1);
      console.log(`[uploadCover] ✓ sucesso em ${dt}s — path: ${path}`);
      return `${SUPABASE_URL}/storage/v1/object/public/prompt-covers/${path}`;
    } catch (err) {
      const dt = ((performance.now() - t0) / 1000).toFixed(1);
      lastErr = err;
      console.warn(`[uploadCover] tentativa ${attempt} falhou em ${dt}s:`, err.message, err);
      if (attempt < 2) {
        $('globalStatus').textContent = 'Tentando enviar capa de novo…';
      }
    }
  }
  throw new Error('Não consegui enviar a capa após 2 tentativas. ' + (lastErr?.message || ''));
}

// ===== Polir com IA (Groq do user) =====
async function polishWithAI() {
  const text = state.data.promptText.trim();
  if (text.length < 10) { showToast('Escreva um prompt antes de polir', true); return; }

  const groqKey = localStorage.getItem('chat-key-groq');
  if (!groqKey) {
    showToast('Configure sua chave Groq na aba Chat IA primeiro');
    setTimeout(() => location.href = 'chat-ia.html', 900);
    return;
  }

  const btn = $('polishBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="gal-spinner"></span> Polindo…';

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are an elite AI image-prompt engineer. Refine the user's prompt into a powerful, structured English prompt with: subject, action/pose, environment, camera/lens, lighting, style, aspect ratio. Be concise and vivid. NO commentary, output ONLY the refined prompt.`
          },
          { role: 'user', content: text },
        ],
        temperature: 0.6,
        max_tokens: 700,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Groq ${res.status}: ${txt.slice(0, 120)}`);
    }
    const json = await res.json();
    const polished = json?.choices?.[0]?.message?.content?.trim() || '';
    if (!polished) throw new Error('resposta vazia');

    $('polishResult').hidden = false;
    $('polishResult').innerHTML = `
      <strong>Versão polida</strong>
      <pre>${escapeHtml(polished)}</pre>
      <div class="share-polish-actions">
        <button type="button" class="gal-btn-primary" id="usePolished">Usar essa versão</button>
        <button type="button" class="gal-btn-ghost" id="discardPolished">Descartar</button>
      </div>`;
    $('usePolished').addEventListener('click', () => {
      $('promptText').value = polished;
      state.data.promptText = polished;
      $('charCount').textContent = polished.length;
      $('polishResult').hidden = true;
      showToast('Prompt atualizado ✓');
    });
    $('discardPolished').addEventListener('click', () => $('polishResult').hidden = true);
  } catch (err) {
    showToast('Erro ao polir: ' + (err.message || err), true);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="wand-2"></i> Polir prompt';
    if (window.lucide) lucide.createIcons();
  }
}

// ===== Publish =====
async function publish() {
  // Valida tudo
  for (let i = 1; i <= 3; i++) {
    if (!validateStep(i)) { goStep(i); return; }
  }

  const overLimit = !state.isPro && !state.editingId && state.publishedCount >= FREE_PUBLISH_LIMIT;
  if (overLimit) { showToast('Limite Free atingido', true); return; }

  const btn = $('publishBtn');
  btn.disabled = true;
  $('globalStatus').textContent = 'Publicando…';

  try {
    // 1) Upload cover (se mudou)
    let coverUrl = state.data.coverUrl;
    if (state.data.coverFile) {
      $('globalStatus').textContent = 'Enviando capa…';
      coverUrl = await uploadCover();
    }

    // 2) Slug
    let slug;
    if (state.editingId) {
      slug = state.origSlug;
    } else {
      const base = slugify(state.data.title);
      slug = (base || 'prompt') + '-' + randomSuffix();
    }

    // 3) Auto-detect language se nao foi escolhido
    const language = state.data.language || detectLang(state.data.promptText);

    // 4) Payload
    const payload = {
      title: state.data.title.trim(),
      slug,
      prompt_text: state.data.promptText.trim(),
      cover_image_url: coverUrl || null,
      model_used: state.data.model || null,
      aspect_ratio: state.data.aspect || null,
      language,
      category: state.data.category || null,
      tone: state.data.tone || null,
      extras: state.data.extras,
      tags: state.data.tags,
      is_published: state.data.publish,
    };
    // Só admin pode marcar como Pro
    if (state.isAdmin) payload.is_pro = !!state.data.isPro;

    let savedSlug;
    if (state.editingId) {
      const { error } = await supabase
        .from('prompt_posts')
        .update(payload)
        .eq('id', state.editingId);
      if (error) throw error;
      savedSlug = slug;
    } else {
      payload.author_id = state.user.id;
      const { data, error } = await supabase
        .from('prompt_posts')
        .insert(payload)
        .select('slug')
        .single();
      if (error) {
        // Slug colision? tenta de novo com sufixo novo
        if (String(error.message || '').includes('duplicate')) {
          payload.slug = (slugify(state.data.title) || 'prompt') + '-' + randomSuffix();
          const retry = await supabase.from('prompt_posts').insert(payload).select('slug').single();
          if (retry.error) throw retry.error;
          savedSlug = retry.data.slug;
        } else throw error;
      } else {
        savedSlug = data.slug;
      }
    }

    showToast(state.editingId ? 'Atualizado ✓' : (state.data.publish ? 'Publicado ✓' : 'Salvo como rascunho ✓'));
    // Reabilita o botão antes de redirecionar pra que, se o usuário voltar via
    // BFCache (botão "voltar" do navegador), não encontre o botão travado.
    btn.disabled = false;
    $('globalStatus').textContent = '';
    setTimeout(() => {
      if (state.data.publish) location.href = `prompt.html?slug=${encodeURIComponent(savedSlug)}`;
      else location.href = 'galeria.html';
    }, 700);
  } catch (err) {
    console.error(err);
    showToast('Erro: ' + (err.message || err), true);
    btn.disabled = false;
    $('globalStatus').textContent = '';
  }
}

// Reset defensivo quando a página é restaurada do BFCache (botão "voltar").
// Sem isso, o botão de publicar pode aparecer travado em estado antigo.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  const btn = document.getElementById('publishBtn');
  if (btn) btn.disabled = false;
  const status = document.getElementById('globalStatus');
  if (status) status.textContent = '';
});

// ===== Edit mode: load existing prompt =====
async function loadEditTarget() {
  if (!editSlug) return;
  const { data, error } = await supabase
    .from('prompt_posts')
    .select('*')
    .eq('slug', editSlug)
    .maybeSingle();
  if (error || !data) {
    showToast('Prompt não encontrado', true);
    setTimeout(() => location.href = 'galeria.html', 1200);
    return;
  }
  if (data.author_id !== state.user.id) {
    showToast('Você não pode editar este prompt', true);
    setTimeout(() => location.href = `prompt.html?slug=${encodeURIComponent(editSlug)}`, 1200);
    return;
  }
  state.editingId = data.id;
  state.origSlug = data.slug;
  state.data = {
    title: data.title,
    promptText: data.prompt_text,
    model: data.model_used || '',
    aspect: data.aspect_ratio || '',
    language: data.language || 'pt',
    category: data.category || '',
    tone: data.tone || '',
    tags: data.tags || [],
    extras: data.extras || [],
    coverFile: null,
    coverUrl: data.cover_image_url || null,
    publish: data.is_published,
    isPro: !!data.is_pro,
  };

  $('modeBadge').textContent = 'Editar prompt';
  $('modeTitle').textContent = 'Editar seu prompt';
  $('modeSubtitle').textContent = 'Ajuste o conteúdo, metadados ou capa.';
  $('publishLbl').textContent = 'Salvar alterações';

  // Aplica nos campos
  $('promptText').value = state.data.promptText;
  $('charCount').textContent = state.data.promptText.length;
  $('title').value = state.data.title;
  $('titleCount').textContent = state.data.title.length;
  $('modelSel').value = state.data.model;
  $('aspectSel').value = state.data.aspect;
  $('langSel').value = state.data.language;
  $('toneSel').value = state.data.tone;
  $('publishToggle').checked = state.data.publish;

  // Capa existente
  if (state.data.coverUrl) {
    $('coverPreview').src = state.data.coverUrl;
    $('dropEmpty').hidden = true;
    $('dropPreview').hidden = false;
  }
}

// ===== Publishing limit =====
async function checkLimit() {
  // Plano Pro?
  state.isPro = (state.profile?.plan === 'pro' || state.profile?.plan === 'studio')
    && state.profile?.pro_until
    && new Date(state.profile.pro_until) > new Date();

  // Conta publicados
  const { count } = await supabase
    .from('prompt_posts')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', state.user.id)
    .eq('is_published', true);
  state.publishedCount = count || 0;
}

// ===== Init =====
async function init() {
  // Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    $('authGate').hidden = false;
    $('goLogin').href = `login.html?return=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }
  state.user = user;

  // Profile
  const { data: prof } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  state.profile = prof;
  state.isAdmin = !!prof?.is_admin;

  $('shareApp').hidden = false;
  if (state.isAdmin) $('proToggleCard').hidden = false;

  setupSelects();
  buildChipGrid('categoryChips', CATEGORIES, 'category', 'single');
  buildChipGrid('extrasChips', EXTRAS, 'extras', 'multi');
  setupTagsInput();
  setupCoverUpload();

  // Seed: ?seed=<prompt-text> pre-preenche o textarea (vindo do construtor ou histórico)
  const seedText = params.get('seed');
  if (seedText) {
    state.data.promptText = seedText;
    setTimeout(() => {
      $('promptText').value = seedText;
      $('charCount').textContent = String(seedText.length);
    }, 0);
  }

  // Cover: ?staging=<uuid> — Blob salvo no IndexedDB pelo chat-ia.html (botão Postar).
  // Resolve blob: URLs morrendo na navegação e CORS de signed URLs do bucket privado.
  const stagingId = params.get('staging');
  if (stagingId) {
    setTimeout(() => loadStagedCover(stagingId), 0);
  }

  // Listeners gerais
  $('promptText').addEventListener('input', e => {
    const v = e.target.value;
    state.data.promptText = v;
    $('charCount').textContent = v.length;
    if (v.length > 4000) e.target.value = v.slice(0, 4000);
  });
  $('title').addEventListener('input', e => {
    state.data.title = e.target.value;
    $('titleCount').textContent = e.target.value.length;
  });
  $('publishToggle').addEventListener('change', e => state.data.publish = e.target.checked);
  $('proToggle')?.addEventListener('change', e => state.data.isPro = e.target.checked);

  // Layout single-page: sem prev/next, só botão Publicar.
  $('publishBtn').addEventListener('click', publish);
  $('polishBtn').addEventListener('click', polishWithAI);
  $('limitUpgrade')?.addEventListener('click', () => location.href = 'upgrade.html');

  await checkLimit();
  refreshLimitGate();
  if (editSlug) await loadEditTarget();
  else if (seedText) {
    state.data.promptText = seedText;
    $('promptText').value = seedText;
    $('charCount').textContent = seedText.length;
    showToast('Prompt importado do Chat IA — preencha os detalhes');
  }
}

init();
