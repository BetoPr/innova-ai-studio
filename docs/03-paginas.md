# 03 — Páginas

Cada feature é uma `*.html` na raiz. JS específico em `lib/{nome}.js`. CSS em `shared.css`.

## Páginas públicas (sem login)

### `index.html` — Landing
Hero + tools grid + galeria preview + planos. **Usa:** sidebar global, lang-toggle, theme-toggle.
**Variantes:** `body.is-anonymous` (visitante) vs autenticado.

### `login.html` — Login
Email + senha. Suporta `?return=URL` pra redirect pós-login.
**Aceita:** Google OAuth (configurado no Supabase).

### `cadastro.html` — Signup
Apelido, Usuário (validação `^[a-z0-9_-]{3,20}$`), email, senha (min 6).
**Anti-duplicate:** chama RPCs `is_email_available` e `is_username_available` em paralelo antes de `signUp`.

### `prompt.html` — Detalhe de prompt público
Página individual de cada prompt da galeria. SEO-friendly (JSON-LD).
**Carrega via:** `?id={uuid}` na query string.

### `faq.html`, `termos.html`, `privacidade.html` — Páginas legais

### `guia.html` — Guia antigo (em desuso, será reescrito como `tutorial.html`)

### `tutorial.html` — **Guia & Tutoriais** (NOVA, 2026-05-10)
7 cards de tópicos (boas fotos, ferramentas, APIs, construtor, chat, galeria, conta). Cada card abre modal com conteúdo educacional.
**Lib:** `lib/tutorial-page.js` (objeto `TOPICS` com seções).
**Sidebar:** entrada acima do toggle de tema (`#tutorialFooterBtn`).

## Páginas autenticadas (gateadas por `lib/require-auth.js`)

### `assinatura.html` — Minha assinatura
Plano atual, próxima cobrança, histórico de pagamentos. Botão de cancelar com modal customizado.
**Fonte da verdade:** `subscriptions` table + `asaas-payment-history` edge function.

### `upgrade.html` — Planos & checkout
Cards Free/Pro/Studio. Modal "Quase lá" coleta CPF + telefone, chama `asaas-create-subscription`, abre fatura em nova aba.

### `configuracoes.html` — Chaves de API
Inputs pra Groq, OpenAI, OpenRouter. Salva em `localStorage` (`chat-key-{provider}`). **Nunca** envia chave pro servidor.
Botão "Limpar tudo" remove todas.

### `meus-prompts.html` — Meus prompts publicados
Lista do usuário. Pode editar/excluir/desfavoritar.

### `favoritos.html` — Favoritos do usuário
Prompts marcados com 🔖.

### `compartilhar.html` — Publicar novo prompt
Editor com título, descrição, blocos de prompt, imagens de referência, marcar como Free/Pro.

## Ferramentas (algumas requerem auth)

### `marca-dagua.html` — Marca d'água
Upload imagem(ns) + logo, controla posição/opacidade/tamanho. Free: marca "Innova" embaixo. Pro: limpo.
**Gating:** IIFE espera `supabase-ready`, lê `profiles.plan`, esconde controles avançados se Free.

### `remove-bg.html` — Remove fundo
Roda `@imgly/background-removal` no cliente (privacy). Sem upload pra servidor.

### `comprimir.html` — Comprimir
Reduz tamanho de JPG/PNG/WebP via canvas.

### `converter.html` — Converter formato
JPG ↔ PNG ↔ WebP ↔ AVIF.

### `redimensionar.html` — Redimensionar
Presets pra Instagram, LinkedIn, Twitter, etc.

### `transcrever.html` — Transcrever áudio (YouTube)
Cola URL do YouTube, chama edge function `youtube-transcript`. Devolve texto.

### `chat-ia.html` — Chat IA
Conversa com modelos LLM. Usa chave do usuário (configuracoes). Histórico em IndexedDB local.
**Gating Pro:** lista de modelos exclusivos verifica `plan` antes de permitir.

### `construtor.html` — Construtor de prompts visual
Drag-and-drop de blocos (Sujeito, Cenário, Estilo, Iluminação, Câmera + Pro: 6 mais). Gera string final do prompt pra copiar.

### `gerar-imagens.html` — Geração de imagens (em breve)
Lista de espera (Studio plan). Coleta email em `studio_waitlist`.

### `galeria.html` — Galeria pública
Grid responsivo de prompts. Filtros: período (24h/7d/30d/90d), categoria, tags. Paginação infinita scroll.
**Lib:** `lib/galeria.js` + `lib/cards.js` (renderização).

## Páginas admin

### `admin.html` — Painel administrativo
Acessível só pra `profiles.role = 'admin'`. Permite criar notificações globais, ver stats.
**Lib:** `lib/admin.js`.

## Componentes globais

### `sidebar.js`
Monta `.sidebar` em todas as páginas. Sections: Principal, Ferramentas, IA, Comunidade, Sistema. Footer: Tutorial + Theme toggle. Profile modal embutido.

### `lib/i18n.js` + `lib/lang-toggle.js`
Switcher de idioma na topbar. Usa `data-i18n="key"` em elementos. Recarrega traduções no auth state change.

### `lib/notifications.js`
Sininho na topbar mostra notificações da `notifications` table não lidas.

### `lib/tutorial.js`
Tooltips de primeiro uso (não confundir com `tutorial-page.js`). Aparece apenas em galeria/construtor/chat-ia no primeiro acesso.

## Páginas removidas/descontinuadas

- `guia.html` — substituído por `tutorial.html`
- (não há outras descontinuadas no momento)
