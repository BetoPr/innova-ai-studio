# 04 — Banco de dados

PostgreSQL 17 gerenciado pela Supabase. Project ID: `htaihtmpnwzyxamkhnty`. Region: `sa-east-1`.

## Tabelas (snapshot 2026-05-10)

| Tabela | Linhas | Propósito |
|---|---|---|
| `profiles` | per user | Perfil estendido (auth.users tem só email/senha; aqui fica plan, display_name, avatar, asaas_ids) |
| `subscriptions` | histórico | Cada assinatura criada no Asaas (ativa, cancelada, etc.) |
| `payment_events` | log | Webhook events do Asaas armazenados crus pra debug + idempotência |
| `prompts` | rascunhos | Prompts em draft (não publicados) |
| `prompt_posts` | publicados | Prompts visíveis na galeria pública |
| `prompt_posts_public` | view | Versão sanitizada de prompt_posts (esconde texto Pro pra Free) |
| `prompt_images` | imagens | Imagens de exemplo de cada prompt postado |
| `prompt_likes` | curtidas | (post_id, user_id, id uuid) — ver migração 008/009 sobre PK |
| `prompt_favorites` | favoritos | (post_id, user_id) — privado |
| `prompt_copies` | copies log | Quando alguém copia um prompt |
| `prompt_validations` | mod | Validações manuais por admin |
| `chat_sessions` | chat | Histórico de Chat IA por user (sessions + msgs em JSONB) |
| `notifications` | broadcast | Mensagens admin pra todos os users |
| `notification_reads` | leitura | Quem leu o quê |
| `studio_waitlist` | waitlist | Emails na lista do plano Studio |

## Esquema das principais

### `profiles`
```sql
id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
email text                                  -- copia de auth.users.email
display_name text                            -- "Apelido" do user
username text UNIQUE                         -- @handle (só letras minúsculas, números, _-)
avatar_url text
plan text DEFAULT 'free'                     -- 'free' | 'pro' | 'studio'
pro_until timestamptz                        -- data até quando Pro vale
asaas_customer_id text                       -- ID do cliente no Asaas
asaas_subscription_id text                   -- ID da assinatura ativa
role text DEFAULT 'user'                     -- 'user' | 'admin'
created_at timestamptz DEFAULT now()
updated_at timestamptz
language text                                -- 'pt' | 'en' | 'es'
```

**Trigger:** `handle_new_user()` cria profile automaticamente quando user signa em `auth.users`.

**Constraint:** `profiles_username_format CHECK (username ~ '^[a-z0-9_-]{3,20}$')` — formato fixo.
**Index:** `profiles_username_unique UNIQUE INDEX (username) WHERE username IS NOT NULL` — único quando preenchido.

### `subscriptions`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
asaas_subscription_id text UNIQUE
plan text                                   -- 'pro' | 'studio'
status text                                 -- 'pending' | 'active' | 'overdue' | 'canceled' | 'expired'
cycle text                                  -- 'MONTHLY' | 'YEARLY'
value numeric
next_due_date date                          -- data da próxima cobrança
created_at timestamptz DEFAULT now()
canceled_at timestamptz
```

### `payment_events`
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
event_id text UNIQUE                        -- IDempotência: evt_xxx do Asaas
event_type text                             -- 'PAYMENT_RECEIVED', 'PAYMENT_CREATED', etc.
payload jsonb                               -- evento completo do Asaas (debug)
processed_at timestamptz DEFAULT now()
```

### `prompt_posts`
```sql
id uuid PRIMARY KEY
author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL  -- @conta-apagada se autor sumiu
title text
description text
content text                                -- O prompt em si
content_pro_only boolean                    -- Se true, só Pro veem o content
category text
tags text[]
likes_count int DEFAULT 0                   -- Cached, atualizado por trigger
copies_count int DEFAULT 0
created_at timestamptz
... (21 colunas total)
```

### `prompt_likes`
PK refatorada na migration `orphan_posts_likes_on_user_delete`:
```sql
id uuid PRIMARY KEY DEFAULT gen_random_uuid()
post_id uuid NOT NULL
user_id uuid                                -- nullable (SET NULL ao deletar user)
created_at timestamptz DEFAULT now()
-- UNIQUE INDEX (post_id, user_id) WHERE user_id IS NOT NULL  -- partial unique
```

**Trigger:** `prompt_likes_count()` mantém `prompt_posts.likes_count` em sync. Só roda em INSERT/DELETE (não UPDATE), então SET NULL no user_id NÃO decrementa o counter — preserva métrica.

## RLS (Row Level Security)

**Todas as tabelas têm RLS habilitado.** Policies (resumo):

- `profiles`: SELECT público (todos veem perfis), UPDATE só o dono
- `prompt_posts`: SELECT público; INSERT/UPDATE/DELETE só dono
- `prompt_likes`: SELECT público; INSERT/DELETE só user logado
- `prompt_favorites`: SELECT/INSERT/DELETE só o dono
- `subscriptions`: SELECT só dono
- `payment_events`: nenhuma policy (só edge functions com service-role acessam)
- `notifications`: SELECT público
- `notification_reads`: SELECT/INSERT só dono

## Triggers

### `handle_new_user()`
Roda em `AFTER INSERT ON auth.users`. Cria profile com defaults + copia metadata (`display_name`, `username`).

### `prompt_likes_count()`
Mantém contador em `prompt_posts.likes_count`. Roda em `AFTER INSERT OR DELETE ON prompt_likes`.

### `prompt_posts_search`
Atualiza coluna `tsvector` pra busca full-text quando título/desc mudam.

## RPCs (functions chamadas via Supabase)

| RPC | Uso |
|---|---|
| `is_email_available(p_email text)` | Cadastro: checa se email já tem conta antes de chamar `signUp` (evita conta órfã) |
| `is_username_available(p_username text)` | Cadastro: checa username único antes do signUp |
| `get_my_stats()` | Página meus prompts: contagens agregadas |

Todas SECURITY DEFINER com `SET search_path = public, auth`.

## Migrations

Arquivos em `supabase/migrations/*.sql`. Numeradas (004, 005, etc.).
Algumas são aplicadas via MCP (`apply_migration`) e ficam em `supabase/migrations` no Supabase mas não no repo local — sempre criar arquivo correspondente após apply.

## Backups
Supabase faz daily backup automático no plano free (7 dias). Pra prod, considerar backup manual semanal pra outro local.
