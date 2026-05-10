# 05 — Edge Functions (Supabase)

Funções serverless rodando em Deno + TypeScript no Supabase. Diretório: `supabase/functions/{nome}/index.ts`.

## Funções deployadas (snapshot 2026-05-10)

| Slug | Versão | verify_jwt | Propósito |
|---|---|---|---|
| `asaas-create-subscription` | v8 | ✅ | Cria customer + assinatura no Asaas, devolve `invoiceUrl` |
| `asaas-cancel-subscription` | v5 | ✅ | DELETE da assinatura no Asaas + atualiza DB |
| `asaas-payment-history` | v3 | ✅ | Lista pagamentos do customer (chama Asaas direto) |
| `asaas-webhook` | v10 | ❌ | Recebe eventos do Asaas, atualiza DB |
| `delete-account` | v3 | ✅ | Cancela sub + deleta auth.user (cascata) |
| `youtube-transcript` | v5 | ❌ | Transcrição de vídeo YouTube |

## Padrões comuns

### Imports
```ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
```

### Secrets (env vars)
Definidos no painel Supabase → Edge Functions → Secrets. Disponíveis via `Deno.env.get('NOME')`.

| Secret | Pra quê |
|---|---|
| `SUPABASE_URL` | URL do project (auto-set) |
| `SUPABASE_SERVICE_ROLE_KEY` | Key admin (bypass RLS) (auto-set) |
| `ASAAS_API_KEY` | API key do Asaas (sandbox ou prod) |
| `ASAAS_API_URL` | `https://sandbox.asaas.com/api/v3` ou `https://api.asaas.com/v3` |
| `ASAAS_WEBHOOK_TOKEN` | Token compartilhado pra autenticar webhook |

### CORS
Todas as funções respondem OPTIONS preflight com:
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
```

### Auth pattern
Pra functions com `verify_jwt: true`:
1. Pega `Authorization` header
2. `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: { Authorization } } })`
3. `await supabase.auth.getUser()` → user object
4. Cria 2º client com service-role pra mexer em DB sem restrição RLS

## `asaas-create-subscription`

POST `/functions/v1/asaas-create-subscription`
Body: `{ cpf: string, phone?: string }`

**Fluxo:**
1. Valida CPF (11 dígitos)
2. Lê profile do user
3. **Anti-duplicata:** se profile.asaas_subscription_id existe E status no Asaas é ACTIVE → devolve fatura pendente da existente, sem criar nova
4. Cria customer no Asaas (se não tem)
   - Se customer_id no banco for de outro ambiente (sandbox vs prod), cria novo
5. Cria subscription no Asaas (cycle MONTHLY, value 39.90)
6. Salva sub no DB (subscriptions table + profiles.asaas_subscription_id)
7. **Retry x4 com 500ms gap** pra buscar primeira fatura (Asaas leva ms pra gerar)
8. Devolve `{ ok, invoiceUrl, subscriptionId }`

## `asaas-cancel-subscription`

POST. Pega user via JWT, lê `asaas_subscription_id`, faz DELETE em `/subscriptions/{id}` no Asaas, marca status='canceled' na DB. **Não mexe em pro_until** (cliente fica Pro até fim do ciclo já pago).

## `asaas-payment-history`

POST. Devolve até 20 últimos pagamentos do customer do user logado. Lê direto da Asaas API.

## `asaas-webhook`

POST `/functions/v1/asaas-webhook`. **verify_jwt OFF** (Asaas não manda JWT, manda token customizado).

**Auth:** valida `asaas-access-token` header (ou alternativos: `Asaas-Access-Token`, `access_token`, `?token=`) contra `ASAAS_WEBHOOK_TOKEN`.

**Idempotência:** insere event em `payment_events` com `event_id` UNIQUE. Se duplicado, retorna 200 sem reprocessar.

**Eventos tratados:**

| Evento | Ação |
|---|---|
| `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` | profile.plan='pro', pro_until=NOW+33d, sub.status='active' |
| `PAYMENT_CREATED` | sub.next_due_date = payment.dueDate (atualiza ciclo) |
| `PAYMENT_OVERDUE` | sub.status='overdue' (mantém pro_until pra dar margem) |
| `SUBSCRIPTION_INACTIVATED` / `SUBSCRIPTION_DELETED` / `PAYMENT_REFUNDED` | profile.plan='free', pro_until=NULL, sub.status='canceled' |
| outros | só registrado em payment_events |

**Resposta:** sempre 200 mesmo se erro interno (evita Asaas ficar retry infinito). Erros logados via console.error.

## `delete-account`

POST. **Fluxo crítico — irreversível.**
1. Cancela assinatura no Asaas (se existe)
2. Chama `auth.admin.deleteUser(user.id)` — cascata via FK deletes profile, subscriptions, etc.
3. Posts e likes ficam (FK SET NULL → @conta-apagada)

## `youtube-transcript`

POST. Recebe URL do YouTube, devolve transcrição (texto). Usa scraping da página do YouTube.

## Como deployar uma function

### Via MCP (em desenvolvimento)
```
mcp__claude_ai_Supabase__deploy_edge_function({
  project_id: "htaihtmpnwzyxamkhnty",
  name: "minha-funcao",
  entrypoint_path: "index.ts",
  verify_jwt: true,
  files: [{ name: "index.ts", content: "..." }]
})
```

### Via CLI Supabase (manual)
```bash
supabase functions deploy minha-funcao --project-ref htaihtmpnwzyxamkhnty
```

## Logs

`mcp__claude_ai_Supabase__get_logs({ project_id, service: 'edge-function' })` ou painel web Supabase → Edge Functions → Logs.

Mostra request log (status code, time) mas NÃO mostra `console.log` output. Pra debug, persistir em DB (ex: `webhook_debug` table durante dev, dropar depois).
