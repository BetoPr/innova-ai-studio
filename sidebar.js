(function buildSidebar() {
  const sections = [
    {
      label: 'Principal', i18n: 'sidebar.section.main',
      icon: 'layout-grid',
      color: 'green',
      items: [
        { href: 'index.html', icon: 'home', label: 'Início', i18n: 'sidebar.home' },
      ],
    },
    {
      label: 'Ferramentas', i18n: 'sidebar.section.tools',
      icon: 'wrench',
      color: 'blue',
      items: [
        { href: 'marca-dagua.html', icon: 'droplet', label: "Marca d'água", i18n: 'sidebar.watermark' },
        { href: 'remove-bg.html', icon: 'scissors', label: 'Remover fundo', i18n: 'sidebar.removeBg' },
        { href: 'comprimir.html', icon: 'package', label: 'Comprimir', i18n: 'sidebar.compress' },
        { href: 'converter.html', icon: 'repeat', label: 'Converter formato', i18n: 'sidebar.convert' },
        { href: 'redimensionar.html', icon: 'maximize-2', label: 'Redimensionar', i18n: 'sidebar.resize' },
      ],
    },
    {
      label: 'IA', i18n: 'sidebar.section.ia',
      icon: 'sparkles',
      color: 'purple',
      items: [
        { href: 'chat-ia.html', icon: 'message-circle', label: 'Chat IA', i18n: 'sidebar.chatIa' },
        { href: 'construtor.html', icon: 'blocks', label: 'Construtor', i18n: 'sidebar.builder' },
        { href: 'gerar-imagens.html', icon: 'sparkles', label: 'Geração de imagens', soon: true, i18n: 'sidebar.imageGen' },
        { href: 'transcrever.html', icon: 'mic', label: 'Transcrever', i18n: 'sidebar.transcribe' },
      ],
    },
    {
      label: 'Comunidade', i18n: 'sidebar.section.community',
      icon: 'users',
      color: 'pink',
      items: [
        { href: 'galeria.html', icon: 'layout-grid', label: 'Galeria', i18n: 'sidebar.gallery' },
        { href: 'compartilhar.html', icon: 'plus-circle', label: 'Compartilhar', i18n: 'sidebar.share' },
        { href: 'meus-prompts.html', icon: 'file-text', label: 'Meus prompts', i18n: 'sidebar.myPrompts' },
        { href: 'favoritos.html', icon: 'bookmark', label: 'Favoritos', i18n: 'sidebar.favorites' },
      ],
    },
    {
      label: 'Sistema', i18n: 'sidebar.section.system',
      icon: 'settings',
      color: 'gray',
      items: [
        { href: 'upgrade.html', icon: 'rocket', label: 'Plano Pro', i18n: 'sidebar.proPlan' },
        { href: 'assinatura.html', icon: 'credit-card', label: 'Minha assinatura', i18n: 'sidebar.subscription' },
        { href: 'configuracoes.html', icon: 'key-round', label: 'Chaves de API', i18n: 'sidebar.apiKeys' },
      ],
    },
  ];

  const aside = document.querySelector('aside.sidebar');
  if (!aside) return;

  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const collapsed = localStorage.getItem('sidebar-collapsed') === '1';
  if (collapsed) document.body.classList.add('sidebar-collapsed');

  const savedTheme = localStorage.getItem('innova-theme') || 'dark';
  if (savedTheme === 'light') document.body.classList.add('light-mode');

  // ===== Detecção anon-first (antes de construir sidebar, evita flash) =====
  // index.html tem sua própria lógica anon view, então não interfere lá
  const isIndex = path === 'index.html' || path === '';
  let cachedAuth = null;
  try {
    const raw = localStorage.getItem('innova-auth');
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedAuth = parsed?.access_token ? parsed : null;
    }
  } catch {}

  // Se cache vazio (= anon) e NÃO é index, vira modo público: sem sidebar + topbar custom
  if (!cachedAuth && !isIndex) {
    document.body.classList.add('no-sidebar');
    customizeTopbarForAnon();
    // Confirma async caso cache esteja desatualizado (login em outra aba etc)
    document.addEventListener('supabase-ready', async () => {
      try {
        const { data: { user } } = await window.supabase.auth.getUser();
        if (user) {
          document.body.classList.remove('no-sidebar');
          location.reload(); // reconstruir UI logada
        }
      } catch {}
    }, { once: true });
    return; // não constrói sidebar
  }

  function customizeTopbarForAnon() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    topbar.classList.add('topbar-public');

    // Esconde sininho e avatar
    topbar.querySelectorAll('.topbar-btn[title="Notificações"], .topbar-avatar')
      .forEach(el => el.style.display = 'none');

    // Logo à esquerda
    if (!topbar.querySelector('.topbar-brand')) {
      const brand = document.createElement('a');
      brand.href = 'index.html';
      brand.className = 'topbar-brand';
      brand.innerHTML = `<img src="logo.png" class="topbar-logo" alt="Innova"><span class="topbar-brandtext">INNOVA <span class="amp">&amp;</span> AI</span>`;
      topbar.insertBefore(brand, topbar.firstChild);
    }

    // Theme toggle + Entrar + Criar conta
    const actions = topbar.querySelector('.topbar-actions');
    if (actions && !actions.querySelector('.topbar-login')) {
      const themeIcon = document.body.classList.contains('light-mode') ? 'sun' : 'moon';
      actions.insertAdjacentHTML('beforeend', `
        <button class="topbar-btn" id="themeToggleAnon" title="Alternar tema"><i data-lucide="${themeIcon}"></i></button>
        <a href="login.html" class="topbar-login">Entrar</a>
        <a href="cadastro.html" class="topbar-signup">Criar conta</a>
      `);
      actions.querySelector('#themeToggleAnon')?.addEventListener('click', () => {
        const light = !document.body.classList.contains('light-mode');
        document.body.classList.toggle('light-mode', light);
        localStorage.setItem('innova-theme', light ? 'light' : 'dark');
        const btn = actions.querySelector('#themeToggleAnon');
        btn.innerHTML = `<i data-lucide="${light ? 'sun' : 'moon'}"></i>`;
        if (window.lucide) lucide.createIcons();
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  let html = `
    <div class="sidebar-header">
      <div class="brand-text">
        <span class="b1">INNOVA</span>
        <span class="b-amp">&amp;</span>
        <span class="b2">AI</span>
      </div>
      <button class="toggle-btn" id="sidebarToggle" aria-label="Recolher menu">
        <i data-lucide="${collapsed ? 'panel-left-open' : 'panel-left-close'}"></i>
      </button>
    </div>
    <nav>
  `;

  sections.forEach((sec, sIdx) => {
    const sectionHasActive = sec.items.some(it => it.href.toLowerCase() === path);
    const collapsedKey = `sidebar-section-${sIdx}-collapsed`;
    const sectionCollapsed = !sectionHasActive && localStorage.getItem(collapsedKey) === '1';
    html += `
      <button class="nav-section" data-section="${sIdx}" aria-expanded="${!sectionCollapsed}">
        <span class="icon-circle ${sec.color}"><i data-lucide="${sec.icon}"></i></span>
        <span class="label" data-i18n="${sec.i18n}">${sec.label}</span>
        <span class="chevron"><i data-lucide="chevron-right"></i></span>
      </button>
      <div class="nav-items ${sectionCollapsed ? 'collapsed' : ''}" data-items="${sIdx}">
    `;
    sec.items.forEach(it => {
      const isActive = it.href.toLowerCase() === path;
      const cls = [isActive ? 'active' : '', it.disabled ? 'disabled' : ''].filter(Boolean).join(' ');
      html += `<a href="${it.href}" class="${cls}">
        <span class="icon"><i data-lucide="${it.icon}"></i></span>
        <span data-i18n="${it.i18n}">${it.label}</span>
        ${it.disabled ? '<span class="badge" data-i18n="sidebar.soonBadge">Em breve</span>' : it.soon ? '<span class="badge badge-soon" data-i18n="sidebar.soonBadge">Em breve</span>' : ''}
      </a>`;
    });
    html += `</div>`;
  });

  const isLight = document.body.classList.contains('light-mode');
  html += `</nav>
    <div class="sidebar-footer">
      <button class="footer-item" id="themeToggle">
        <span class="icon-circle"><i data-lucide="${isLight ? 'sun' : 'moon'}"></i></span>
        <span class="info">
          <div class="title" id="themeTitle">${isLight ? 'Modo Claro' : 'Modo Escuro'}</div>
          <div class="sub">Clique pra alternar</div>
        </span>
      </button>
    </div>
  `;

  aside.innerHTML = html;
  setupAuthFooter();

  // Carrega o handler do sininho de notificacoes (so se a pagina tem topbar)
  if (document.querySelector('.topbar-btn[title="Notificações"]')) {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'lib/notifications.js';
    document.body.appendChild(s);
  }

  // Carrega o seletor de idioma se houver topbar
  if (document.querySelector('.topbar-actions') && !document.querySelector('.lang-toggle')) {
    const s = document.createElement('script');
    s.type = 'module';
    s.src = 'lib/lang-toggle.js';
    document.body.appendChild(s);
  }

  // Carrega tooltips de tutorial (primeiro uso) só nas páginas-chave
  const p = location.pathname.toLowerCase();
  if (p.endsWith('galeria.html') || p.endsWith('construtor.html') || p.endsWith('chat-ia.html')) {
    const s = document.createElement('script');
    s.src = 'lib/tutorial.js';
    document.body.appendChild(s);
  }

  // Render icons
  if (window.lucide) lucide.createIcons();

  function setToggleIcon(isCollapsed) {
    const t = aside.querySelector('#sidebarToggle');
    const i = t?.querySelector('[data-lucide], svg');
    if (i) {
      i.outerHTML = `<i data-lucide="${isCollapsed ? 'panel-left-open' : 'panel-left-close'}"></i>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  function expandSidebar() {
    document.body.classList.remove('sidebar-collapsed');
    localStorage.setItem('sidebar-collapsed', '0');
    setToggleIcon(false);
  }

  // Section accordion toggle (com lógica especial pra sidebar colapsada)
  aside.querySelectorAll('.nav-section').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.section;
      const items = aside.querySelector(`.nav-items[data-items="${idx}"]`);
      const sidebarCollapsed = document.body.classList.contains('sidebar-collapsed');

      if (sidebarCollapsed) {
        // Sidebar colapsada: clicar no ícone abre a sidebar E expande essa seção
        expandSidebar();
        items.classList.remove('collapsed');
        btn.setAttribute('aria-expanded', 'true');
        localStorage.setItem(`sidebar-section-${idx}-collapsed`, '0');
      } else {
        // Sidebar expandida: comportamento normal de accordion
        const isCollapsed = items.classList.toggle('collapsed');
        btn.setAttribute('aria-expanded', !isCollapsed);
        localStorage.setItem(`sidebar-section-${idx}-collapsed`, isCollapsed ? '1' : '0');
      }
    });
  });

  // Sidebar collapse/expand pelo botão do topo
  const toggle = aside.querySelector('#sidebarToggle');
  toggle?.addEventListener('click', () => {
    const isCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar-collapsed', isCollapsed ? '1' : '0');
    setToggleIcon(isCollapsed);
  });

  // Theme toggle (dark/light)
  const themeBtn = aside.querySelector('#themeToggle');
  themeBtn?.addEventListener('click', () => {
    const isLightNow = document.body.classList.toggle('light-mode');
    localStorage.setItem('innova-theme', isLightNow ? 'light' : 'dark');
    const icon = themeBtn.querySelector('.icon-circle');
    const title = themeBtn.querySelector('#themeTitle');
    if (icon) icon.innerHTML = `<i data-lucide="${isLightNow ? 'sun' : 'moon'}"></i>`;
    if (title) title.textContent = isLightNow ? 'Modo Claro' : 'Modo Escuro';
    if (window.lucide) lucide.createIcons();
  });

  // Estado de login no rodapé (só roda se o botão existir — ele é escondido na homepage)
  function setupAuthFooter() {
    let currentUser = null;
    const sidebarBtn = document.getElementById('accountBtn');
    const topbarAvatar = document.querySelector('.topbar-avatar');

    const apply = async (user) => {
      currentUser = user;
      const avatar = document.getElementById('accountAvatar');
      const title = document.getElementById('accountTitle');
      const sub = document.getElementById('accountSub');
      const photoUrl = user ? await loadAvatarUrl(user) : null;
      const initial = user ? ((user.user_metadata?.display_name || user.email || '?')[0] || '?').toUpperCase() : '?';
      const name = user ? (user.user_metadata?.display_name || (user.email || '?').split('@')[0]) : '';

      // Sidebar bottom (only on tool pages)
      if (sidebarBtn) {
        if (user) {
          if (photoUrl) avatar.innerHTML = `<img src="${photoUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
          else avatar.textContent = initial;
          title.textContent = name;
          sub.textContent = 'Conectado ao sistema';
        } else {
          avatar.textContent = '?';
          title.textContent = 'Entrar';
          sub.textContent = 'Sincronizar histórico';
        }
      }

      // Topbar avatar (right top)
      if (topbarAvatar) {
        if (user) {
          if (photoUrl) topbarAvatar.innerHTML = `<img src="${photoUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
          else topbarAvatar.textContent = initial;
          topbarAvatar.title = name + ' — clique pra abrir perfil';
        } else {
          topbarAvatar.textContent = '?';
          topbarAvatar.title = 'Entrar';
        }
      }
    };

    const handleClick = async (e) => {
      e.preventDefault();
      // Pega o user do supabase agora, não confia em closure que pode estar stale
      let user = currentUser;
      if (!user && window.supabase) {
        try {
          const { data } = await window.supabase.auth.getUser();
          user = data?.user || null;
          currentUser = user;
        } catch {}
      }
      if (user) openProfileModal(user);
      else location.href = 'login.html';
    };
    sidebarBtn?.addEventListener('click', handleClick);
    topbarAvatar?.addEventListener('click', handleClick);

    const initAuth = async () => {
      if (!window.supabase) return;
      const { data: { user } } = await window.supabase.auth.getUser();
      apply(user);
      window.supabase.auth.onAuthStateChange((_event, session) => apply(session?.user || null));
      // Lazy check: rebaixa Pro expirado caso webhook tenha falhado
      if (user) {
        lazyCheckProExpired(user.id);
        revealAdminLink(user.id);
      }
    };

    async function revealAdminLink(userId) {
      try {
        const { data } = await window.supabase
          .from('profiles').select('is_admin').eq('id', userId).maybeSingle();
        if (data?.is_admin) {
          // Adiciona item Admin na secao Sistema (uma vez)
          if (document.querySelector('a[href="admin.html"]')) return;
          const sysItems = document.querySelector('.nav-items[data-items="' + (sections.length - 2) + '"]');
          if (!sysItems) return;
          const a = document.createElement('a');
          a.href = 'admin.html';
          a.innerHTML = '<span class="icon"><i data-lucide="shield"></i></span><span>Admin</span><span class="badge" style="background:rgba(255,93,108,0.16); color:var(--danger); border-color:rgba(255,93,108,0.3);">Admin</span>';
          if ((location.pathname.split('/').pop() || '').toLowerCase() === 'admin.html') a.classList.add('active');
          sysItems.appendChild(a);
          if (window.lucide) lucide.createIcons();
        }
      } catch {}
    }
    if (window.supabase) initAuth();
    else document.addEventListener('supabase-ready', initAuth, { once: true });
  }

  // Roda 1x por sessao (debounce em sessionStorage) — barata
  async function lazyCheckProExpired(userId) {
    try {
      if (sessionStorage.getItem('lazy-pro-checked')) return;
      sessionStorage.setItem('lazy-pro-checked', '1');
      const { data: prof } = await window.supabase
        .from('profiles').select('plan, pro_until').eq('id', userId).maybeSingle();
      if (!prof) return;
      if (prof.plan && prof.plan !== 'free' && prof.pro_until && new Date(prof.pro_until) <= new Date()) {
        await window.supabase.from('profiles').update({ plan: 'free', pro_until: null }).eq('id', userId);
      }
    } catch {}
  }

  async function loadAvatarUrl(user) {
    if (!window.supabase) return null;
    // 1) URL publica salva em profiles.avatar_url tem prioridade (bucket user-avatars)
    try {
      const { data: prof } = await window.supabase
        .from('profiles').select('avatar_url').eq('id', user.id).maybeSingle();
      if (prof?.avatar_url) return prof.avatar_url;
    } catch {}
    // 2) Legacy: signed URL do bucket privado avatars (pra contas antigas)
    const path = user.user_metadata?.avatar_path;
    if (!path) return null;
    try {
      const { data, error } = await window.supabase.storage.from('avatars').createSignedUrl(path, 3600);
      if (error) return null;
      return data.signedUrl;
    } catch { return null; }
  }

  function openProfileModal(user) {
    let modal = document.getElementById('profileModal');
    if (modal) { modal.remove(); }
    const name = user.user_metadata?.display_name || (user.email || '?').split('@')[0];
    modal = document.createElement('div');
    modal.id = 'profileModal';
    modal.className = 'profile-modal-overlay';
    modal.innerHTML = `
      <div class="profile-modal">
        <div class="profile-modal-header">
          <h3>Configurações de perfil</h3>
          <button class="profile-modal-close" id="profileClose"><i data-lucide="x"></i></button>
        </div>
        <div class="profile-modal-body">
          <div class="profile-avatar-wrap">
            <div class="profile-avatar-big" id="profileAvatarBig">${(name[0]||'?').toUpperCase()}</div>
          </div>

          <div class="profile-tabs">
            <button class="profile-tab active" data-tab="avatar">
              <i data-lucide="user-circle-2"></i> Escolher avatar
            </button>
            <button class="profile-tab" data-tab="upload">
              <i data-lucide="upload"></i> Subir foto
            </button>
          </div>

          <div class="profile-tab-pane active" data-pane="avatar">
            <div class="profile-help">Escolha um avatar pré-feito. Aparece nos seus prompts publicados.</div>
            <div class="profile-avatar-grid" id="avatarGrid"></div>
          </div>

          <div class="profile-tab-pane" data-pane="upload">
            <div class="profile-help">JPG, PNG ou WebP. Até 2MB.</div>
            <label for="profilePhotoInput" class="profile-upload-btn">
              <i data-lucide="upload"></i> Escolher arquivo
              <input type="file" id="profilePhotoInput" accept="image/*" style="display:none;">
            </label>
          </div>

          <div class="profile-field">
            <label>Nome</label>
            <input type="text" id="profileName" value="${name.replace(/"/g,'&quot;')}" maxlength="60">
          </div>
          <div class="profile-field">
            <label>E-mail</label>
            <input type="email" value="${user.email || ''}" disabled>
          </div>
          <div class="profile-actions">
            <button class="profile-btn-save" id="profileSave">Salvar nome</button>
            <button class="profile-btn-logout" id="profileLogout">Sair da conta</button>
          </div>
          <div class="profile-status" id="profileStatus"></div>

          <div class="profile-danger-zone">
            <div class="profile-danger-warn">
              <i data-lucide="alert-triangle"></i>
              <div>
                <strong>Apagar minha conta</strong>
                <p>Remove permanentemente seus dados pessoais, favoritos e assinatura. Prompts publicados na galeria continuam visíveis.</p>
              </div>
            </div>
            <button class="profile-btn-delete" id="profileDeleteAccount" type="button">
              <i data-lucide="trash-2"></i> Apagar minha conta
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    if (window.lucide) lucide.createIcons();

    let currentAvatar = null;
    loadAvatarUrl(user).then(url => {
      currentAvatar = url;
      if (url) {
        const big = document.getElementById('profileAvatarBig');
        if (big) big.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
      }
      // Carrega grid de avatares (lazy import)
      import('./lib/avatars.js').then(({ renderAvatarGrid }) => {
        const grid = document.getElementById('avatarGrid');
        if (!grid) return;
        renderAvatarGrid(grid, currentAvatar, async (avatarUrl) => {
          setStatus('Salvando avatar…');
          try {
            await window.supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
            currentAvatar = avatarUrl;
            // Atualiza UIs
            const big = document.getElementById('profileAvatarBig');
            if (big) big.innerHTML = `<img src="${avatarUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            const sidebarAvatar = document.getElementById('accountAvatar');
            if (sidebarAvatar) sidebarAvatar.innerHTML = `<img src="${avatarUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            const topbarAvatar = document.querySelector('.topbar-avatar');
            if (topbarAvatar) topbarAvatar.innerHTML = `<img src="${avatarUrl}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
            setStatus('✓ Avatar atualizado');
          } catch (err) { setStatus('Erro: ' + (err.message || err), true); }
        });
      });
    });

    // Tabs
    modal.querySelectorAll('.profile-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        modal.querySelectorAll('.profile-tab').forEach(b => b.classList.toggle('active', b === btn));
        modal.querySelectorAll('.profile-tab-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === tab));
      });
    });

    const close = () => modal.remove();
    document.getElementById('profileClose').onclick = close;
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    const status = document.getElementById('profileStatus');
    const setStatus = (msg, isError) => {
      status.textContent = msg;
      status.className = 'profile-status ' + (isError ? 'error' : 'ok');
    };

    document.getElementById('profilePhotoInput').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file || !window.supabase) return;
      if (file.size > 2 * 1024 * 1024) { setStatus('Foto maior que 2MB', true); return; }
      setStatus('Enviando foto…');
      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user.id}/avatar-${Date.now()}.${ext}`;
        // Sobe pro bucket publico user-avatars (pra galeria/detalhe verem)
        const { error: upErr } = await window.supabase.storage.from('user-avatars')
          .upload(path, file, { upsert: true, contentType: file.type });
        if (upErr) throw upErr;
        const { data: pub } = window.supabase.storage.from('user-avatars').getPublicUrl(path);
        const url = pub.publicUrl;
        // Salva em profiles.avatar_url (publico)
        await window.supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);

        const big = document.getElementById('profileAvatarBig');
        if (big) big.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        const sidebarAvatar = document.getElementById('accountAvatar');
        if (sidebarAvatar) sidebarAvatar.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        const topbarAvatar = document.querySelector('.topbar-avatar');
        if (topbarAvatar) topbarAvatar.innerHTML = `<img src="${url}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
        setStatus('✓ Foto atualizada');
      } catch (err) {
        setStatus('Erro: ' + (err.message || err), true);
      }
    };

    document.getElementById('profileSave').onclick = async () => {
      const newName = document.getElementById('profileName').value.trim();
      if (!newName || !window.supabase) return;
      setStatus('Salvando…');
      try {
        const { error } = await window.supabase.auth.updateUser({ data: { display_name: newName } });
        if (error) throw error;
        const t = document.getElementById('accountTitle');
        if (t) t.textContent = newName;
        setStatus('✓ Salvo');
      } catch (err) {
        setStatus('Erro: ' + (err.message || err), true);
      }
    };

    document.getElementById('profileLogout').onclick = async () => {
      await window.innovaAuth?.signOut();
    };

    // === Apagar conta ===
    document.getElementById('profileDeleteAccount').onclick = () => {
      modal.style.display = 'none';
      showDeleteAccountModal(user, () => { modal.style.display = ''; });
    };
  }

  function showDeleteAccountModal(user, onCancel) {
    let dm = document.getElementById('profileDeleteModal');
    if (dm) dm.remove();
    dm = document.createElement('div');
    dm.id = 'profileDeleteModal';
    dm.className = 'delete-modal';
    dm.innerHTML = `
      <div class="delete-modal-content">
        <h2><i data-lucide="alert-triangle"></i> Apagar minha conta</h2>
        <p>Esta ação é <strong>irrevogável</strong>. Vai apagar:</p>
        <ul class="delete-list">
          <li>Sua conta, perfil e dados pessoais</li>
          <li>Favoritos e configurações</li>
          <li>Sua assinatura Pro (sem reembolso do ciclo atual)</li>
        </ul>
        <p class="delete-keep-info">Os prompts que você publicou continuam visíveis na galeria como <strong>@conta-apagada</strong>.</p>
        <label class="delete-confirm-label">
          Pra confirmar, digite <strong>${user.email}</strong>:
        </label>
        <input type="email" id="profileDeleteInput" placeholder="seu@email.com" autocomplete="off">
        <div class="delete-modal-actions">
          <button type="button" class="gal-btn-ghost" id="profileDeleteAbort">Cancelar</button>
          <button type="button" class="gal-btn-primary delete-confirm-btn" id="profileDeleteConfirm" disabled>
            <i data-lucide="trash-2"></i> Apagar permanentemente
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(dm);
    if (window.lucide) lucide.createIcons();

    const input = document.getElementById('profileDeleteInput');
    const confirmBtn = document.getElementById('profileDeleteConfirm');
    const abortBtn = document.getElementById('profileDeleteAbort');

    setTimeout(() => input.focus(), 50);

    input.addEventListener('input', () => {
      confirmBtn.disabled = input.value.trim().toLowerCase() !== user.email.toLowerCase();
    });

    function close() {
      dm.remove();
      onCancel?.();
    }

    abortBtn.onclick = close;
    dm.onclick = (e) => { if (e.target === dm) close(); };

    confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Apagando…';
      try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) throw new Error('Sessão expirada');
        const res = await fetch(`${window.SUPABASE_URL}/functions/v1/delete-account`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': window.SUPABASE_ANON_KEY,
          },
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
        await window.supabase.auth.signOut();
        location.href = 'index.html';
      } catch (err) {
        alert('Erro: ' + (err.message || err));
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i data-lucide="trash-2"></i> Apagar permanentemente';
        if (window.lucide) lucide.createIcons();
      }
    };
  }
})();
