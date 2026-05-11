# 02 — Tech Stack

## Frontend

| Camada | Tecnologia | Onde usa |
|---|---|---|
| Markup | HTML5 estático | Cada feature = 1 arquivo `.html` na raiz |
| Estilos | CSS vanilla com custom properties (variables) | `shared.css` (~3700 linhas, único arquivo) |
| JS | ES Modules + scripts clássicos | `lib/*.js` (um por página) + `sidebar.js` global |
| Tipografia | Google Fonts: **Inter** (UI), **Sora** (títulos) | `<link>` em cada página |
| Ícones | [Lucide](https://lucide.dev/) via CDN unpkg | `<i data-lucide="X">` → JS substitui por SVG |
| Auth (cliente) | Supabase JS SDK v2.45.4 via esm.sh | `supabase-client.js` exporta cliente único |
| i18n | JSON em `lib/i18n.js` + atributos `data-i18n` | PT, EN, ES |

**Sem build step, sem bundler, sem npm install.** Tudo importa via CDN ou caminho relativo.

## Backend

| Camada | Tecnologia | Notas |
|---|---|---|
| Banco | PostgreSQL 17 (Supabase managed) | RLS habilitado em todas as tabelas |
| Auth | Supabase Auth (email + senha) | Confirmation email habilitada |
| Storage | Supabase Storage (bucket `user-avatars`) | Avatars de perfil públicos |
| Serverless | Supabase Edge Functions (Deno + TypeScript) | 6 funções em produção |
| Pagamento | Asaas API v3 (sandbox + produção) | PIX, boleto, cartão |

## Hospedagem

| Camada | Onde | URL |
|---|---|---|
| Frontend | GitHub Pages (repo `BetoPr/innova-ai-studio`) | https://betopr.github.io/innova-ai-studio/ |
| Backend | Supabase (sa-east-1) | `htaihtmpnwzyxamkhnty.supabase.co` |
| Webhooks | Edge function `asaas-webhook` | Configurado no painel Asaas |

## Dependências externas (CDN)

```html
<!-- Em todas as páginas -->
<link rel="stylesheet" href="shared.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>

<!-- Como módulo (Supabase) -->
<script type="module" src="supabase-client.js"></script>

<!-- Asaas SDK NÃO é usado no frontend — só backend -->
```

## Padrões de código

### Naming
- HTML pages: kebab-case sem capitalização (`marca-dagua.html`)
- JS files: kebab-case (`prompt-detail.js`)
- CSS classes: kebab-case com prefix por feature (`gal-card`, `tut-card`, `sub-card`)
- DB tables: snake_case (`prompt_posts`, `payment_events`)

### Estrutura padrão de cada página HTML
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{Título da feature} — Innova & AI Studio</title>
  <link rel="icon" type="image/png" href="logo.png">
  <link rel="stylesheet" href="shared.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter..." rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <aside class="sidebar"></aside>  <!-- montado por sidebar.js -->
  <main class="main">
    <header class="topbar">...</header>
    <!-- conteúdo da feature -->
  </main>
  <div id="toastHost"></div>

  <script src="favicon.js"></script>
  <script type="module" src="supabase-client.js"></script>
  <script src="sidebar.js"></script>
  <script src="lib/{feature}.js"></script>
  <script>if (window.lucide) lucide.createIcons();</script>
</body>
</html>
```

### Ordem de scripts (importante)
1. `favicon.js` — logo no favicon dinâmico
2. `supabase-client.js` (module, deferred) — cliente Supabase global
3. `sidebar.js` (sync) — monta sidebar imediatamente
4. `lib/{feature}.js` (module, deferred) — lógica da página

⚠️ Como `supabase-client.js` é module, ele carrega DEPOIS de `sidebar.js`. Por isso scripts que precisam do cliente usam `window.whenSupabaseReady(cb)` ou aguardam o evento `supabase-ready`.

### Estilos
- Tudo em `shared.css` (sem CSS-in-JS, sem CSS modules)
- Variáveis CSS pra dark/light mode em `:root` e `body.light-mode`
- Media queries no final de cada bloco de feature, ou bloco mobile consolidado no fim

### Auth
- `window.supabase` exposto globalmente
- Helpers: `window.innovaAuth.{getUser, getSession, signOut, onChange}`
- Páginas que requerem auth: `lib/require-auth.js`

### Toasts (notificações temporárias)
- Cada página tem `<div id="toastHost"></div>`
- Função local `showToast(msg, isError)` em cada lib

### Modais
- Padrão `.gal-modal-overlay` + `.gal-modal` ou `.delete-modal` + `.delete-modal-content`

## Versões fixadas

```js
// supabase-client.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// edge functions (Deno)
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
```
