// Detalhe de um prompt (/prompt.html?slug=xxx).
// Le `prompt_posts_public`, faz toggle de like/favorite, mostra validacoes e
// prompts relacionados, gateia conteudo Pro via RPC, registra view server-side.

import { supabase } from '../supabase-client.js';

const slug = new URLSearchParams(location.search).get('slug');

const state = {
  post: null,
  user: null,
  liked: false,
  favorited: false,
  unlockedText: null, // texto liberado quando user e Pro
  validations: [],
  related: [],
};

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtNumber = (n) => n == null ? '0' : (n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,'') + 'k' : String(n));

const MODEL_LABEL = {
  gemini: 'Gemini', midjourney: 'Midjourney', flow: 'Flow', dalle: 'DALL·E',
  'stable-diffusion': 'Stable Diffusion', flux: 'Flux', outro: 'Outro',
};
const TONE_LABEL = {
  vibrante: 'Vibrante', 'escuro-atmosferico': 'Escuro/Atmosférico', elegante: 'Elegante',
};

// ===== Toast =====
function showToast(msg, isError) {
  const host = $('toastHost');
  if (!host) return;
  const t = document.createElement('div');
  t.className = 'gal-toast' + (isError ? ' error' : '');
  t.textContent = msg;
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

// ===== Render not found / error =====
function renderError(msg) {
  $('pdRoot').innerHTML = `
    <div class="pd-empty">
      <i data-lucide="search-x"></i>
      <h2>${escapeHtml(msg)}</h2>
      <a href="galeria.html" class="gal-btn-primary">Voltar para a galeria</a>
    </div>`;
  if (window.lucide) lucide.createIcons();
}

// ===== Track view (debounce por sessao) =====
function trackView() {
  const key = 'viewed-' + slug;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {}
  supabase.rpc('track_view', { p_slug: slug }).then(() => {});
}

// ===== Fetchers =====
async function fetchPost() {
  const { data, error } = await supabase
    .from('prompt_posts_public')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}

async function fetchUserState(postId, uid) {
  const [{ data: like }, { data: fav }] = await Promise.all([
    supabase.from('prompt_likes').select('user_id').eq('prompt_id', postId).eq('user_id', uid).maybeSingle(),
    supabase.from('prompt_favorites').select('user_id').eq('prompt_id', postId).eq('user_id', uid).maybeSingle(),
  ]);
  state.liked = !!like;
  state.favorited = !!fav;
}

async function fetchValidations(postId) {
  const { data: vals } = await supabase
    .from('prompt_validations')
    .select('*')
    .eq('prompt_id', postId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (!vals || vals.length === 0) return [];
  const userIds = [...new Set(vals.map(v => v.user_id))];
  const { data: profs } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url')
    .in('id', userIds);
  const map = Object.fromEntries((profs || []).map(p => [p.id, p]));
  return vals.map(v => ({ ...v, profile: map[v.user_id] }));
}

async function fetchRelated(post) {
  // Prompts da mesma categoria OU mesmo modelo, exclui o atual
  const filters = [];
  if (post.category) filters.push(`category.eq.${post.category}`);
  if (post.model_used) filters.push(`model_used.eq.${post.model_used}`);
  if (filters.length === 0) return [];
  const { data } = await supabase
    .from('prompt_posts_public')
    .select('*')
    .or(filters.join(','))
    .neq('id', post.id)
    .order('likes_count', { ascending: false })
    .limit(3);
  return data || [];
}

// ===== Tenta desbloquear o texto pra Pro logged =====
async function tryUnlockText() {
  const { data } = await supabase.rpc('get_prompt_text', { p_slug: slug });
  state.unlockedText = data || null;
}

// ===== Render =====
function render() {
  const p = state.post;
  const cover = p.cover_image_url || `https://picsum.photos/seed/${encodeURIComponent(p.slug)}/1000/1250`;
  const author = p.author_id
    ? (p.author_username || p.author_display_name || 'anônimo')
    : 'conta-apagada';
  const createdAt = new Date(p.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const isOwner = state.user?.id === p.author_id;
  const isLocked = p.is_pro && !state.unlockedText;
  const visibleText = isLocked ? p.prompt_text.slice(0, 140) + '…' : (state.unlockedText || p.prompt_text);

  // Tags
  const tagsHtml = (p.tags || []).map(t => `<span class="pd-tag">#${escapeHtml(t)}</span>`).join('');
  const extrasHtml = (p.extras || []).map(t => `<span class="pd-tag">${escapeHtml(t)}</span>`).join('');

  // Validations
  let valHtml = '';
  if (state.validations.length) {
    valHtml = `
      <section class="pd-card">
        <h3 class="pd-card-title"><i data-lucide="badge-check"></i> Testado por ${state.validations.length} ${state.validations.length === 1 ? 'pessoa' : 'pessoas'}</h3>
        <div class="pd-validations">
          ${state.validations.slice(0, 6).map(v => {
            const initial = ((v.profile?.display_name || v.profile?.username || '?')[0] || '?').toUpperCase();
            const name = v.profile?.username || v.profile?.display_name || 'anônimo';
            const ok = v.worked_well;
            return `
              <div class="pd-val-item">
                <div class="pd-val-avatar">${escapeHtml(initial)}</div>
                <div class="pd-val-body">
                  <div class="pd-val-head">
                    <strong>@${escapeHtml(name)}</strong>
                    <span class="pd-val-status ${ok ? 'ok' : 'bad'}">
                      <i data-lucide="${ok ? 'check' : 'x'}"></i> ${ok ? 'funcionou bem' : 'não funcionou'}
                    </span>
                  </div>
                  ${v.comment ? `<p>${escapeHtml(v.comment)}</p>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
      </section>`;
  }

  // Related
  let relHtml = '';
  if (state.related.length) {
    relHtml = `
      <section class="pd-related">
        <h3>Prompts relacionados</h3>
        <div class="pd-related-grid">
          ${state.related.map(r => {
            const c = r.cover_image_url || `https://picsum.photos/seed/${encodeURIComponent(r.slug)}/600/750`;
            return `
              <a class="pd-related-card" href="prompt.html?slug=${encodeURIComponent(r.slug)}">
                <div class="pd-related-img"><img src="${c}" alt="" loading="lazy">${r.is_pro ? '<span class="gal-pro-badge"><i data-lucide=\"lock\"></i> PRO</span>' : ''}</div>
                <div class="pd-related-body">
                  <strong>${escapeHtml(r.title)}</strong>
                  <span><i data-lucide="heart"></i> ${fmtNumber(r.likes_count)}</span>
                </div>
              </a>`;
          }).join('')}
        </div>
      </section>`;
  }

  $('pdRoot').innerHTML = `
    <div class="pd-grid">
      <!-- Esquerda: media -->
      <div class="pd-media">
        <div class="pd-cover-wrap">
          <img class="pd-cover" src="${cover}" alt="${escapeHtml(p.title)}">
          <span class="pd-watermark">Innova & AI</span>
          ${p.is_pro ? '<span class="gal-pro-badge pd-pro-badge"><i data-lucide="lock"></i> PRO</span>' : ''}
          ${p.is_validated ? '<span class="gal-validated-badge pd-validated-badge" title="Curadoria Innova"><i data-lucide="badge-check"></i></span>' : ''}
        </div>
        ${state.validations.filter(v => v.result_image_url).length ? `
          <div class="pd-variations">
            <h4>Variações da comunidade</h4>
            <div class="pd-variations-grid">
              ${state.validations.filter(v => v.result_image_url).slice(0, 4).map(v => `<img src="${escapeHtml(v.result_image_url)}" alt="">`).join('')}
            </div>
          </div>` : ''}
      </div>

      <!-- Direita: info -->
      <div class="pd-info">
        <span class="hero-badge">Detalhes do prompt</span>
        <h1 class="pd-title">${escapeHtml(p.title)}</h1>
        <div class="pd-meta">
          <span><i data-lucide="user"></i> @${escapeHtml(author)}</span>
          <span class="pd-dot">·</span>
          <span>${createdAt}</span>
          <span class="pd-dot">·</span>
          <span><i data-lucide="eye"></i> ${fmtNumber(p.views_count)}</span>
        </div>

        <!-- Card prompt -->
        <section class="pd-card pd-prompt-card ${isLocked ? 'locked' : ''}">
          <div class="pd-card-head">
            <h3 class="pd-card-title">PROMPT</h3>
            ${isLocked ? '<span class="pd-lock-pill"><i data-lucide="lock"></i> Conteúdo Pro</span>' : ''}
          </div>
          <pre class="pd-prompt-text" id="promptText">${escapeHtml(visibleText)}</pre>
          ${isLocked ? `
            <div class="pd-lock-overlay">
              <i data-lucide="lock"></i>
              <p>Este prompt é exclusivo para assinantes <strong>Pro</strong>.</p>
              <button class="gal-btn-primary" id="goUpgrade">Desbloquear com Pro</button>
            </div>
          ` : `
            <div class="pd-actions">
              <button class="gal-btn-primary" id="copyBtn">
                <i data-lucide="copy"></i> Copiar prompt
              </button>
              <a class="gal-btn-ghost" href="chat-ia.html?prompt=${encodeURIComponent(visibleText)}" id="tryBtn">
                <i data-lucide="message-circle"></i> Chat IA
              </a>
              <div class="pd-open-wrap">
                <button class="gal-btn-ghost" id="openInBtn" type="button">
                  <i data-lucide="external-link"></i> Abrir em…
                  <i data-lucide="chevron-down" class="pd-chev"></i>
                </button>
                <div class="pd-open-menu" id="openInMenu" hidden>
                  <button data-target="flow"><strong>Flow</strong> <span>labs.google/fx/flow</span></button>
                  <button data-target="chatgpt"><strong>ChatGPT</strong> <span>chatgpt.com</span></button>
                </div>
              </div>
              ${isOwner ? `
                <button class="gal-btn-ghost" id="editBtn" title="Editar este prompt">
                  <i data-lucide="pencil"></i> Editar
                </button>` : ''}
            </div>
          `}
        </section>

        <!-- Engajamento -->
        <section class="pd-card pd-engage">
          <button class="pd-engage-btn ${state.liked ? 'on' : ''}" id="likeBtn">
            <i data-lucide="heart"></i>
            <span><strong>${fmtNumber(p.likes_count)}</strong> curtidas</span>
          </button>
          <button class="pd-engage-btn ${state.favorited ? 'on' : ''}" id="favBtn">
            <i data-lucide="bookmark"></i>
            <span>${state.favorited ? 'Salvo' : 'Salvar'}</span>
          </button>
          <button class="pd-engage-btn" id="shareBtn">
            <i data-lucide="share-2"></i>
            <span>Compartilhar</span>
          </button>
        </section>

        <!-- Modelo + Aspect -->
        <section class="pd-card">
          <h3 class="pd-card-title">DETALHES</h3>
          <div class="pd-detail-grid">
            ${p.model_used ? `<div><label>Modelo</label><span class="pd-pill">${escapeHtml(MODEL_LABEL[p.model_used] || p.model_used)}</span></div>` : ''}
            ${p.aspect_ratio ? `<div><label>Proporção</label><span class="pd-pill">${escapeHtml(p.aspect_ratio)}</span></div>` : ''}
            ${p.category ? `<div><label>Estilo</label><span class="pd-pill">${escapeHtml(p.category)}</span></div>` : ''}
            ${p.tone ? `<div><label>Tom</label><span class="pd-pill">${escapeHtml(TONE_LABEL[p.tone] || p.tone)}</span></div>` : ''}
            ${p.language ? `<div><label>Idioma</label><span class="pd-pill">${escapeHtml(p.language.toUpperCase())}</span></div>` : ''}
            <div><label>Cópias</label><span class="pd-pill">${fmtNumber(p.copies_count)}</span></div>
          </div>
        </section>

        <!-- Tags -->
        ${tagsHtml || extrasHtml ? `
          <section class="pd-card">
            <h3 class="pd-card-title">TAGS</h3>
            <div class="pd-tags">${tagsHtml}${extrasHtml}</div>
          </section>` : ''}

        ${valHtml}
      </div>
    </div>

    ${relHtml}
  `;

  if (window.lucide) lucide.createIcons();
  attachHandlers();
}

// ===== Handlers =====
function attachHandlers() {
  // Like
  $('likeBtn')?.addEventListener('click', toggleLike);
  $('favBtn')?.addEventListener('click', toggleFavorite);
  $('copyBtn')?.addEventListener('click', handleCopy);
  $('shareBtn')?.addEventListener('click', handleShare);
  $('editBtn')?.addEventListener('click', () => {
    location.href = `compartilhar.html?edit=${encodeURIComponent(slug)}`;
  });

  // Dropdown "Abrir em..." — copia prompt + abre nova aba
  const openBtn = $('openInBtn');
  const openMenu = $('openInMenu');
  if (openBtn && openMenu) {
    openBtn.addEventListener('click', e => {
      e.stopPropagation();
      openMenu.hidden = !openMenu.hidden;
    });
    document.addEventListener('click', e => {
      if (!openBtn.contains(e.target) && !openMenu.contains(e.target)) openMenu.hidden = true;
    });
    openMenu.querySelectorAll('button[data-target]').forEach(btn => {
      btn.addEventListener('click', async () => {
        openMenu.hidden = true;
        await openInExternal(btn.dataset.target);
      });
    });
  }
  $('goUpgrade')?.addEventListener('click', openProModal);
}

async function toggleLike() {
  if (!state.user) {
    showToast('Faça login pra curtir');
    setTimeout(() => location.href = `login.html?return=${encodeURIComponent(location.pathname + location.search)}`, 800);
    return;
  }
  const postId = state.post.id;
  const wasLiked = state.liked;
  state.liked = !wasLiked;
  state.post.likes_count += wasLiked ? -1 : 1;

  // Otimista
  const btn = $('likeBtn');
  btn.classList.toggle('on', state.liked);
  btn.querySelector('strong').textContent = fmtNumber(state.post.likes_count);

  if (wasLiked) {
    await supabase.from('prompt_likes').delete()
      .eq('prompt_id', postId).eq('user_id', state.user.id);
  } else {
    const { error } = await supabase.from('prompt_likes').insert({
      prompt_id: postId, user_id: state.user.id,
    });
    if (error && !String(error.message || '').includes('duplicate')) {
      // rollback
      state.liked = wasLiked;
      state.post.likes_count += wasLiked ? 1 : -1;
      btn.classList.toggle('on', state.liked);
      btn.querySelector('strong').textContent = fmtNumber(state.post.likes_count);
      showToast('Erro ao curtir', true);
    }
  }
}

async function toggleFavorite() {
  if (!state.user) {
    showToast('Faça login pra salvar');
    setTimeout(() => location.href = `login.html?return=${encodeURIComponent(location.pathname + location.search)}`, 800);
    return;
  }
  const postId = state.post.id;
  const wasFav = state.favorited;
  state.favorited = !wasFav;
  const btn = $('favBtn');
  btn.classList.toggle('on', state.favorited);
  btn.querySelector('span').textContent = state.favorited ? 'Salvo' : 'Salvar';

  if (wasFav) {
    await supabase.from('prompt_favorites').delete()
      .eq('prompt_id', postId).eq('user_id', state.user.id);
  } else {
    const { error } = await supabase.from('prompt_favorites').insert({
      prompt_id: postId, user_id: state.user.id,
    });
    if (error && !String(error.message || '').includes('duplicate')) {
      state.favorited = wasFav;
      btn.classList.toggle('on', state.favorited);
      btn.querySelector('span').textContent = state.favorited ? 'Salvo' : 'Salvar';
      showToast('Erro ao salvar', true);
    }
  }
}

async function handleCopy() {
  // Pra Pro gateado, modal
  const { data: text } = await supabase.rpc('get_prompt_text', { p_slug: slug });
  if (!text) {
    if (state.post.is_pro) openProModal();
    else showToast('Prompt indisponível', true);
    return;
  }
  try { await navigator.clipboard.writeText(text); }
  catch { showToast('Falha ao copiar', true); return; }

  await supabase.from('prompt_copies').insert({
    prompt_id: state.post.id,
    user_id: state.user?.id || null,
  });

  const btn = $('copyBtn');
  btn.classList.add('copied');
  btn.innerHTML = '<i data-lucide="check"></i> Copiado!';
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = '<i data-lucide="copy"></i> Copiar prompt';
    if (window.lucide) lucide.createIcons();
  }, 1800);
  showToast('Prompt copiado ✓');
}

// Mapeamento de destinos -> URL
const EXTERNAL_TARGETS = {
  flow: { url: 'https://labs.google/fx/pt/tools/flow', name: 'Flow' },
  chatgpt: { url: 'https://chatgpt.com/', name: 'ChatGPT' },
};

async function openInExternal(targetKey) {
  const target = EXTERNAL_TARGETS[targetKey];
  if (!target) return;
  // Pega o texto liberado (free) ou via RPC pra Pro
  let text = state.unlockedText;
  if (!text) {
    const { data } = await supabase.rpc('get_prompt_text', { p_slug: slug });
    text = data;
  }
  if (!text) {
    if (state.post.is_pro) openProModal();
    else showToast('Prompt indisponível', true);
    return;
  }
  try { await navigator.clipboard.writeText(text); }
  catch { showToast('Falha ao copiar', true); return; }
  // Telemetria de cópia
  await supabase.from('prompt_copies').insert({
    prompt_id: state.post.id,
    user_id: state.user?.id || null,
  });
  // Abre nova aba
  window.open(target.url, '_blank', 'noopener');
  showToast(`Prompt copiado! Cole no ${target.name} (Ctrl+V) e envie ✓`);
}

async function handleShare() {
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: state.post.title, url }); return; } catch {}
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link copiado ✓');
  } catch {
    showToast('Falha ao compartilhar', true);
  }
}

// ===== Pro modal =====
function openProModal() { $('proModal').hidden = false; }
function closeProModal() { $('proModal').hidden = true; }

// ===== SEO =====
function applySEO() {
  const p = state.post;
  document.title = `${p.title} — Innova & AI Studio`;
  const setMeta = (sel, val) => {
    const m = document.querySelector(sel);
    if (m) m.setAttribute('content', val);
  };
  const desc = (p.prompt_text || '').slice(0, 160);
  setMeta('meta[name="description"]', desc);
  setMeta('meta[property="og:title"]', p.title);
  setMeta('meta[property="og:description"]', desc);
  if (p.cover_image_url) {
    let og = document.querySelector('meta[property="og:image"]');
    if (!og) { og = document.createElement('meta'); og.setAttribute('property', 'og:image'); document.head.appendChild(og); }
    og.setAttribute('content', p.cover_image_url);
  }
  // JSON-LD CreativeWork
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: p.title,
    description: desc,
    inLanguage: p.language || 'pt',
    image: p.cover_image_url || undefined,
    author: { '@type': 'Person', name: p.author_id ? (p.author_display_name || p.author_username || 'Innova') : 'Conta apagada' },
    dateCreated: p.created_at,
    keywords: (p.tags || []).join(', '),
  });
  document.head.appendChild(ld);
}

// ===== Voltar preserva filtros =====
function setupBackLink() {
  try {
    const last = sessionStorage.getItem('gal-last-url');
    if (last && last.startsWith('/') === false && last.includes('galeria')) {
      $('backLink').href = last;
    } else if (last && last.includes('galeria')) {
      $('backLink').href = last;
    }
  } catch {}
}

// ===== Init =====
async function init() {
  if (!slug) { renderError('Prompt não encontrado'); return; }

  setupBackLink();

  // Auth
  try {
    const { data: { user } } = await supabase.auth.getUser();
    state.user = user;
  } catch {}

  // Fetch post
  const post = await fetchPost();
  if (!post) { renderError('Prompt não encontrado'); return; }
  state.post = post;

  // Track view
  trackView();

  // Em paralelo: validations, related, user state, unlock text (se logged)
  const tasks = [
    fetchValidations(post.id).then(v => state.validations = v),
    fetchRelated(post).then(r => state.related = r),
  ];
  if (state.user) tasks.push(fetchUserState(post.id, state.user.id));
  if (post.is_pro && state.user) tasks.push(tryUnlockText());
  if (!post.is_pro) tasks.push(tryUnlockText()); // pra free, get_prompt_text retorna texto

  await Promise.all(tasks);

  applySEO();
  render();

  // Modal listeners (montados sempre)
  $('proClose').addEventListener('click', closeProModal);
  $('proCancel').addEventListener('click', closeProModal);
  $('proGoUpgrade').addEventListener('click', () => {
    location.href = 'upgrade.html';
  });
  $('proModal').addEventListener('click', e => {
    if (e.target.id === 'proModal') closeProModal();
  });
}

init();
