# 07 — Deploy & Ops

## Frontend — GitHub Pages

### Deploy
```bash
git add .
git commit -m "..."
git push
# 1-2 min → ao vivo em https://betopr.github.io/innova-ai-studio/
```

Sem build, sem CI. O HTML/CSS/JS são servidos diretamente do branch `main`.

### Verificar deploy
- https://betopr.github.io/innova-ai-studio/ deve carregar
- Hard refresh: `Ctrl+Shift+R` no Chrome
- Cache do GitHub Pages às vezes demora; se preocupado, abrir aba anônima

### Custom domain (opcional)
Se quiser `innovaaistudio.com.br`:
1. Compra domínio (Registro.br ou Cloudflare)
2. DNS: CNAME `betopr.github.io`
3. GitHub repo → Settings → Pages → Custom domain

## Backend — Supabase

### Deploy de Edge Function
**Via Supabase CLI:**
```bash
npx supabase login
npx supabase functions deploy nome-da-funcao --project-ref htaihtmpnwzyxamkhnty
```

**Via MCP (no Claude):** `mcp__claude_ai_Supabase__deploy_edge_function` com `files: [{ name, content }]`.

### Aplicar migration
```bash
npx supabase db push --project-ref htaihtmpnwzyxamkhnty
```

Ou via MCP: `mcp__claude_ai_Supabase__apply_migration({ project_id, name, query })`.

⚠️ Migrations aplicadas via MCP **não criam arquivo no repo automaticamente**. Sempre criar arquivo `supabase/migrations/NNN_nome.sql` manualmente e commitar.

### Configurar secrets
Supabase Dashboard → Edge Functions → Secrets → Add secret.

Lista atual de secrets (ver `06-integracoes.md`):
- `ASAAS_API_KEY`
- `ASAAS_API_URL`
- `ASAAS_WEBHOOK_TOKEN`
- (auto-set) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Switch Sandbox → Produção (Asaas)

Ver checklist completo no histórico do projeto. Resumo:

1. Criar conta Asaas produção (asaas.com)
2. Gerar API key prod (Configurações → Integrações)
3. Atualizar Supabase:
   - `ASAAS_API_KEY` → key de prod (`$aact_prod_...`)
   - `ASAAS_API_URL` → `https://api.asaas.com/v3`
4. No painel Asaas prod, criar webhook:
   - URL: `https://htaihtmpnwzyxamkhnty.supabase.co/functions/v1/asaas-webhook`
   - Token: igual ao `ASAAS_WEBHOOK_TOKEN` no Supabase
   - Eventos: ver `06-integracoes.md`
   - Ativado + Sincronização ativa
5. Limpar IDs sandbox do banco:
   ```sql
   UPDATE profiles SET asaas_customer_id=NULL, asaas_subscription_id=NULL,
                       plan='free', pro_until=NULL
   WHERE asaas_customer_id IS NOT NULL OR asaas_subscription_id IS NOT NULL;
   UPDATE subscriptions SET status='canceled' WHERE status IN ('active','pending');
   ```
6. Smoke test: criar cobrança avulsa de R$ 1, marcar "Receber em dinheiro", confirmar webhook chega como 200.

## Monitoramento

### Logs de Edge Functions
- Painel Supabase → Edge Functions → Logs
- Mostra status code, duração, mas NÃO console output
- Pra debug profundo, persistir info em tabela temporária

### Health check rápido
```sql
-- Últimos eventos do webhook
SELECT event_type, processed_at FROM payment_events
ORDER BY processed_at DESC LIMIT 5;

-- Assinaturas ativas
SELECT status, COUNT(*) FROM subscriptions GROUP BY status;

-- Users Pro
SELECT plan, COUNT(*) FROM profiles GROUP BY plan;
```

## Troubleshooting comum

### "Webhook 401 Unauthorized"
→ Token Asaas != Token Supabase. Conferir match em ambos os lados (sem espaços/quebras).

### "Customer não encontrado" em create-subscription
→ ID de outro ambiente (sandbox vs prod). Function v6+ trata isso automático criando novo.

### "Site mostra cache antigo"
→ `Ctrl+Shift+R`. Se persistir, verificar se commit foi pra branch `main`.

### "Pro ativou mas não persiste após reload"
→ Webhook não está chegando. Verificar Asaas → Logs de Webhooks.

### "Inputs zoomam no iPhone"
→ Garantir `font-size: 16px` nos inputs (iOS bloqueia zoom auto se >= 16px). Já está no shared.css mobile block.

## Backup

- Supabase Free: backup diário automático, retenção 7 dias
- Recomendação prod: snapshot semanal manual via `pg_dump` pra storage externo

## Custos atuais (estimativa)

| Item | Custo |
|---|---|
| GitHub Pages | R$ 0 (público) |
| Supabase Free Tier | R$ 0 (até 500MB DB, 1GB storage, 500K edge function invocations) |
| Asaas (PIX/cartão) | ~2.99% por transação |
| Domínio (opcional) | ~R$ 40/ano |
| **Total fixo** | **R$ 0/mês** (até bater limites do free tier) |

Quando crescer:
- Supabase Pro: $25/mês (8GB DB, 100GB storage)
- GitHub Pages → ainda free a menos que precise de SSR
