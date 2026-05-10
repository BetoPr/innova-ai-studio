# 06 — Integrações Externas

## Asaas (pagamento)

**Site:** https://www.asaas.com (prod) | https://sandbox.asaas.com (testes)

### Configuração
- API Key: gerada em Configurações → Integrações → API Asaas
- API URL prod: `https://api.asaas.com/v3`
- API URL sandbox: `https://sandbox.asaas.com/api/v3`

### Webhook
URL configurada no painel Asaas → Webhooks:
```
https://htaihtmpnwzyxamkhnty.supabase.co/functions/v1/asaas-webhook
```

**Eventos requeridos:**
- ☑ PAYMENT_CREATED
- ☑ PAYMENT_CONFIRMED  
- ☑ PAYMENT_RECEIVED
- ☑ PAYMENT_OVERDUE
- ☑ PAYMENT_REFUNDED
- ☑ SUBSCRIPTION_INACTIVATED
- ☑ SUBSCRIPTION_DELETED

**Token de autenticação:** valor compartilhado entre Asaas (campo "Token") e env var `ASAAS_WEBHOOK_TOKEN` no Supabase.

⚠️ **Lições aprendidas (em produção 2026-05-10):**
- Asaas envia token no header `asaas-access-token` (lowercase). Nosso webhook aceita variantes pra ser tolerante.
- Se o webhook falhar muitas vezes seguidas (401, 500), Asaas aplica **"Penalização"** e pausa entregas. Reativar em "Limpar fila"/"Reset" no painel.
- Sempre usar **trim()** no token recebido (espaços invisíveis quebram match).

### Recomendações de segurança
- Rotacionar `ASAAS_API_KEY` se exposta
- Rotacionar `ASAAS_WEBHOOK_TOKEN` periodicamente
- Nunca expor API key no frontend

## Supabase

**Project:** `htaihtmpnwzyxamkhnty`
**Region:** `sa-east-1` (São Paulo) — latência baixa pra Brasil

### Componentes usados
- **Postgres** (banco)
- **Auth** (signup/login email + senha)
- **Storage** (bucket `user-avatars`)
- **Edge Functions** (Deno serverless)

### Keys
| Key | Onde usa | Exposta no frontend? |
|---|---|---|
| `SUPABASE_ANON_KEY` (publishable) | Cliente browser | ✅ sim, segura por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge functions | ❌ NUNCA, bypass RLS |

Atualmente: `sb_publishable_cld9ukkeynLD15lgf47G7g_XT3uNnYS` (valor exposto em `supabase-client.js` — OK porque RLS protege).

## Lucide Icons

CDN: `https://unpkg.com/lucide@latest`
Uso: `<i data-lucide="camera"></i>` → `lucide.createIcons()` substitui por SVG.

Catálogo: https://lucide.dev/icons

## Google Fonts

CDN. Famílias usadas:
- **Inter** (300, 400, 500, 600, 700, 800) — UI
- **Sora** — não importada explicitamente em todas as páginas, mas usada em CSS via fallback

## DiceBear (avatares)

API pública pra avatars deterministic SVG:
```
https://api.dicebear.com/7.x/{style}/svg?seed=NOME&backgroundColor=COR
```

Estilos usados em `lib/avatars.js`:
- `avataaars` (humanos cartoon)
- `fun-emoji` (animais/emoji)

## @imgly/background-removal

Lib client-side pra remover fundo de imagens. Carregada via CDN em `remove-bg.html`. Roda 100% no navegador (sem upload).

## GitHub Pages

Hosting do frontend. Configurado em `Settings → Pages`:
- Source: branch `main`, root folder
- Custom domain: nenhum (usando subdomain `betopr.github.io`)
- HTTPS forçado

Deploy automático: cada `git push` na main → ~1-2 min até propagar.

## WhatsApp (uazapi)

Não usado no app diretamente, mas referenciado em integrações do squad/CRM do user.

## LLM Providers (BYOK — chaves do usuário)

Não armazenamos chaves nem cobramos LLM. Cliente cola SUA chave em `Configurações`, fica em `localStorage`:
- `chat-key-groq` → Groq
- `chat-key-openai` → OpenAI
- `chat-key-openrouter` → OpenRouter

Endpoints chamados direto do browser:
- Groq: `https://api.groq.com/openai/v1/chat/completions`
- OpenAI: `https://api.openai.com/v1/chat/completions`
- OpenRouter: `https://openrouter.ai/api/v1/chat/completions`

Todos seguem padrão OpenAI Chat Completions (mesma estrutura request/response).
