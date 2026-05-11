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

// ===== Step navigation =====
function goStep(n) {
  state.step = Math.max(1, Math.min(state.total, n));
  document.querySelectorAll('.share-step').forEach(s => s.classList.toggle('active', +s.dataset.step === state.step));
  document.querySelectorAll('.share-step-pill').forEach(p => {
    const sp = +p.dataset.step;
    p.classList.toggle('active', sp === state.step);
    p.classList.toggle('done', sp < state.step);
  });
  $('stepCur').textContent = state.step;
  $('prevBtn').hidden = state.step === 1;
  const last = state.step === state.total;
  $('nextBtn').hidden = last;
  $('publishBtn').hidden = !last;
  if (last) renderSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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

function renderSummary() {
  const d = state.data;
  // Resolve src do preview seguindo prioridade:
  // 1) URL vinda de ?cover= ou modo edit
  // 2) data URL ja gerada no step 3 (coverPreviewDataUrl)
  // 3) fallback: object URL no momento
  let coverSrc = d.coverUrl || d.coverPreviewDataUrl;
  if (!coverSrc && d.coverFile) {
    try { coverSrc = URL.createObjectURL(d.coverFile); } catch {}
  }
  // Se ainda assim falhou mas o <img> do step 3 tem src valida, usa direto
  if (!coverSrc) {
    const previewImg = document.getElementById('coverPreview');
    const ps = previewImg?.getAttribute('src');
    if (ps && ps !== '' && ps !== '#') coverSrc = ps;
  }
  const cover = coverSrc ? `<img src="${coverSrc}" alt="" onerror="this.parentElement.innerHTML='<div class=\\'share-summary-noimg\\'>Erro ao carregar</div>'">` : `<div class="share-summary-noimg"><i data-lucide="image-off"></i> Sem capa</div>`;
  const tagsHtml = d.tags.length ? d.tags.map(t => `<span class="pd-tag">#${escapeHtml(t)}</span>`).join('') : '<em class="muted">nenhuma</em>';
  $('summary').innerHTML = `
    <div class="share-summary-cover">${cover}</div>
    <div class="share-summary-info">
      <h4>${escapeHtml(d.title || '(sem título)')}</h4>
      <div class="share-sum-row"><label>Estilo</label><span>${escapeHtml(d.category || '—')}</span></div>
      <div class="share-sum-row"><label>Modelo</label><span>${escapeHtml(d.model || '—')}</span></div>
      <div class="share-sum-row"><label>Proporção</label><span>${escapeHtml(d.aspect || '—')}</span></div>
      <div class="share-sum-row"><label>Idioma</label><span>${escapeHtml((d.language || '').toUpperCase())}</span></div>
      <div class="share-sum-row"><label>Tom</label><span>${escapeHtml(d.tone || '—')}</span></div>
      <div class="share-sum-row"><label>Tags</label><span>${tagsHtml}</span></div>
      <div class="share-sum-row"><label>Complementos</label><span>${d.extras.length ? d.extras.map(e => `<span class="pd-tag">${escapeHtml(e)}</span>`).join('') : '<em class="muted">nenhum</em>'}</span></div>
    </div>`;

  // Limite Free
  const overLimit = !state.isPro && !state.editingId && state.publishedCount >= FREE_PUBLISH_LIMIT;
  $('limitCard').hidden = !overLimit;
  $('publishBtn').disabled = overLimit;
  if (window.lucide) lucide.createIcons();
}

// ===== Cover upload (preview, sem upload imediato) =====
function setupCoverUpload() {
  const input = $('coverInput');
  const drop = $('coverDrop');
  const preview = $('coverPreview');
  const empty = $('dropEmpty');
  const previewWrap = $('dropPreview');
  const removeBtn = $('coverRemove');

  function setFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Imagem maior que 10MB', true);
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      showToast('Use JPG, PNG ou WebP', true);
      return;
    }
    state.data.coverFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      preview.src = dataUrl;
      state.data.coverPreviewDataUrl = dataUrl; // cache pra renderSummary
      empty.hidden = true;
      previewWrap.hidden = false;
    };
    reader.readAsDataURL(file);
  }

  input.addEventListener('change', e => setFile(e.target.files[0]));
  ['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => {
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
    const file = new File([blob], `seed-cover.${ext}`, { type: blob.type || 'image/jpeg' });
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
    reader.readAsDataURL(blob);
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

async function uploadCover() {
  if (!state.data.coverFile) return state.data.coverUrl || null;
  const origFile = state.data.coverFile;

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

  // Pega session pra autenticar o fetch direto (sem o SDK).
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sessão expirou. Saia e entre de novo.');
  }

  const ext = (origFile.name.split('.').pop() || 'jpg').toLowerCase();

  // Estratégia: fetch direto pra REST API do Storage. O SDK do Supabase
  // estava travando sem responder em alguns ambientes (logs do servidor
  // confirmaram que requests do SDK nem chegavam). AbortController nos dá
  // controle real do timeout (interrompe o request, não só a Promise).
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const path = `${state.user.id}/${Date.now()}-${randomSuffix()}.${ext}`;
    const url = `${SUPABASE_URL}/storage/v1/object/prompt-covers/${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    const t0 = performance.now();
    console.log(`[uploadCover] tentativa ${attempt} → POST ${url}`);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
          'x-upsert': 'false',
          'cache-control': '3600',
          'Content-Type': origFile.type,
        },
        body: origFile,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const dt = ((performance.now() - t0) / 1000).toFixed(1);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error(`[uploadCover] tentativa ${attempt} HTTP ${res.status} (${dt}s):`, txt);
        throw new Error(`Servidor retornou ${res.status}: ${txt.slice(0, 200)}`);
      }
      console.log(`[uploadCover] ✓ sucesso em ${dt}s — path: ${path}`);
      return `${SUPABASE_URL}/storage/v1/object/public/prompt-covers/${path}`;
    } catch (err) {
      clearTimeout(timer);
      const dt = ((performance.now() - t0) / 1000).toFixed(1);
      lastErr = err;
      // AbortError = timeout; outros = rede ou servidor.
      const motivo = err.name === 'AbortError' ? 'timeout (30s)' : err.message;
      console.warn(`[uploadCover] tentativa ${attempt} falhou em ${dt}s:`, motivo, err);
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

  $('prevBtn').addEventListener('click', () => goStep(state.step - 1));
  $('nextBtn').addEventListener('click', () => {
    if (validateStep(state.step)) goStep(state.step + 1);
  });
  $('publishBtn').addEventListener('click', publish);
  $('polishBtn').addEventListener('click', polishWithAI);
  $('limitUpgrade')?.addEventListener('click', () => location.href = 'upgrade.html');

  await checkLimit();
  if (editSlug) await loadEditTarget();
  else if (seedText) {
    state.data.promptText = seedText;
    $('promptText').value = seedText;
    $('charCount').textContent = seedText.length;
    showToast('Prompt importado do Chat IA — preencha os detalhes');
  }
}

init();
