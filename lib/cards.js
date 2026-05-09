// Card de prompt reutilizavel — galeria, favoritos, meus prompts.
// Estilo "Banana": imagem 1:1 + tag de titulo no topo + preview no body
// + footer com Copiar/Editar + autor + ❤ likes_count.

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtNumber = (n) => n == null ? '0' : (n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,'') + 'k' : String(n));

/**
 * Renderiza um card de prompt.
 * @param {object} p - row de prompt_posts_public
 * @param {object} opts
 *   - mode: 'public' | 'own' | 'fav' | 'tested'  (default 'public')
 *   - currentUserId: uuid do user logado (pra detectar owner)
 *   - isAdmin: boolean — admin pode editar/excluir qualquer post
 * @returns {HTMLElement}
 */
export function renderPromptCard(p, opts = {}) {
  const mode = opts.mode || 'public';
  const currentUserId = opts.currentUserId || null;
  const isAdmin = !!opts.isAdmin;
  const isOwnerOrAdmin = isAdmin || (currentUserId && p.author_id === currentUserId);

  const cover = p.cover_image_url || `https://picsum.photos/seed/${encodeURIComponent(p.slug)}/800/800`;
  const author = p.author_id
    ? (p.author_username || p.author_display_name || 'anônimo')
    : 'conta-apagada';
  const previewLen = 220;
  const preview = (p.prompt_text || '').slice(0, previewLen).trim()
    + ((p.prompt_text || '').length > previewLen ? '…' : '');

  const card = document.createElement('article');
  card.className = 'gal-card';
  card.dataset.id = p.id;
  card.dataset.slug = p.slug;
  card.dataset.pro = p.is_pro ? '1' : '0';

  // Topo da imagem: tag-title (esq)
  const topTag = `<span class="gal-card-tag" title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</span>`;

  // Badges adicionais (PRO, RASCUNHO, TESTADO, FAV)
  let extraBadges = '';
  if (p.is_pro) extraBadges += '<span class="gal-pro-badge"><i data-lucide="lock"></i> PRO</span>';
  if (mode === 'own' && !p.is_published) extraBadges += '<span class="my-draft-badge"><i data-lucide="file-edit"></i> RASCUNHO</span>';
  if (mode === 'tested') extraBadges += '<span class="my-tested-badge"><i data-lucide="badge-check"></i> Testado</span>';
  if (mode === 'fav') extraBadges += '<span class="my-fav-badge"><i data-lucide="bookmark"></i></span>';

  // Footer
  let footerHtml = '';

  // Owner ou Admin: substitui Copiar por Editar/Excluir
  const isPrivateMode = mode === 'own' || mode === 'fav';
  const showOwnerActions = isOwnerOrAdmin && !isPrivateMode;

  // Em modo 'own' (meus-prompts), mantém comportamento existente com data + Editar/Excluir
  if (mode === 'own') {
    const dateStr = new Date(p.created_at).toLocaleDateString('pt-BR');
    footerHtml = `
      <div class="gal-card-footer my-own-footer">
        <span class="gal-card-stats">
          <span><i data-lucide="eye"></i> ${fmtNumber(p.views_count)}</span>
          <span><i data-lucide="copy"></i> ${fmtNumber(p.copies_count)}</span>
          <span><i data-lucide="clock"></i> ${dateStr}</span>
        </span>
        <span class="my-own-buttons">
          <button class="my-act-edit" type="button" title="Editar">
            <i data-lucide="pencil"></i>
          </button>
          <button class="my-act-delete" type="button" title="Excluir">
            <i data-lucide="trash-2"></i>
          </button>
        </span>
      </div>`;
  } else if (mode === 'fav') {
    footerHtml = `
      <div class="gal-card-footer">
        <button class="gal-card-copy" type="button">
          <i data-lucide="copy"></i> Copiar
        </button>
        <span class="gal-card-author-min">@${escapeHtml(author)}</span>
        <button class="my-unfav-btn" type="button" title="Remover dos favoritos">
          <i data-lucide="bookmark-minus"></i>
        </button>
      </div>`;
  } else if (showOwnerActions) {
    // Galeria/landing/tested mas eu sou owner ou admin → editar/excluir + autor
    footerHtml = `
      <div class="gal-card-footer">
        <button class="my-act-edit" type="button" title="Editar">
          <i data-lucide="pencil"></i>
        </button>
        <button class="my-act-delete" type="button" title="Excluir">
          <i data-lucide="trash-2"></i>
        </button>
        <span class="gal-card-author">por @${escapeHtml(author)}</span>
      </div>`;
  } else {
    // Card publico padrao (modo public ou tested sem ownership)
    footerHtml = `
      <div class="gal-card-footer">
        <button class="gal-card-copy" type="button">
          <i data-lucide="copy"></i> Copiar
        </button>
        <span class="gal-card-author">por @${escapeHtml(author)}</span>
      </div>`;
  }

  card.innerHTML = `
    <a href="prompt.html?slug=${encodeURIComponent(p.slug)}" class="gal-card-img" aria-label="Ver detalhes do prompt ${escapeHtml(p.title)}">
      <img src="${cover}" alt="" loading="lazy">
      ${topTag}
      ${extraBadges ? `<div class="gal-card-extras">${extraBadges}</div>` : ''}
    </a>
    <div class="gal-card-body">
      <p class="gal-card-preview">${escapeHtml(preview)}</p>
    </div>
    ${footerHtml}
  `;
  return card;
}
