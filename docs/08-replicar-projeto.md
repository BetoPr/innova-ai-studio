# 08 — Replicar este projeto pra outro nicho

Este guia é pra **clonar a arquitetura** do Innova AI Studio e adaptar pra outro nicho/produto SaaS. Exemplo: "Quero criar um SaaS pra ____ (advogados, contadores, dentistas, fotógrafos, etc.)".

## ✅ Por que essa stack é fácil de replicar

- **Sem build step:** abre HTML no navegador e funciona
- **Custo R$ 0** pra começar (GitHub Pages + Supabase free)
- **Auth + DB + serverless** prontos com Supabase
- **Pagamento** via Asaas (Brasil) — mesma integração serve qualquer SaaS
- **Sem framework lock-in** — JS vanilla, fácil entender

## 🎯 Plano em 8 passos

### Passo 1: Defina o produto (1-2 dias)

Antes de codar, responda:
1. **Qual problema resolve?** Ex: "Advogados perdem tempo redigindo petições padrão"
2. **Quem é o cliente?** Profissão, idade, ticket médio que pagaria
3. **Qual o feature principal?** O que vai gerar valor real (não só "tem login")
4. **Modelo de cobrança?** Free + Pro (recomendado pra SaaS B2B/PJ)
5. **Quais features do Innova reaproveitar?** Galeria, ferramentas, chat IA, construtor — quais fazem sentido?

### Passo 2: Setup repositório novo

```bash
# Forka este projeto:
git clone https://github.com/BetoPr/marca-dagua.git meu-novo-saas
cd meu-novo-saas
rm -rf .git
git init
git remote add origin https://github.com/SEU_USER/meu-novo-saas.git
```

Limpa o que não usar: páginas que não fazem sentido pro novo nicho (ex: `marca-dagua.html` se vai ser SaaS pra advogados).

### Passo 3: Cria projeto novo no Supabase

1. supabase.com → New Project
2. Region: `sa-east-1` (Brasil)
3. Anota:
   - Project ref (`xxxxxxxxxx`)
   - URL (`https://xxxxxxxxxx.supabase.co`)
   - `anon` (publishable) key
   - `service_role` key

### Passo 4: Atualiza `supabase-client.js`

```js
// Trocar pelos valores do SEU projeto
export const SUPABASE_URL = 'https://xxxxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_xxxxx';
```

### Passo 5: Aplica migrations base

Cria as tabelas mínimas:
```sql
-- 001_init.sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  username text UNIQUE,
  plan text DEFAULT 'free',
  pro_until timestamptz,
  asaas_customer_id text,
  asaas_subscription_id text,
  role text DEFAULT 'user',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select all" ON profiles FOR SELECT USING (true);
CREATE POLICY "update own" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  asaas_subscription_id text UNIQUE,
  plan text,
  status text,
  cycle text,
  value numeric,
  next_due_date date,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE,
  event_type text,
  payload jsonb,
  processed_at timestamptz DEFAULT now()
);

-- Trigger pra criar profile auto após signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, username)
  VALUES (NEW.id, NEW.email,
          NEW.raw_user_meta_data->>'display_name',
          NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RPCs pra cadastro
CREATE FUNCTION is_email_available(p_email text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT NOT EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = LOWER(p_email));
$$;

CREATE FUNCTION is_username_available(p_username text) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (SELECT 1 FROM profiles WHERE username = LOWER(p_username));
$$;
```

### Passo 6: Adapta páginas

**Renomear / reescrever:**
- `index.html` → landing nova com proposta de valor do seu nicho
- `tutorial.html` → topics adaptados
- Tabela `prompt_posts` → renomear pra entidade do seu nicho (ex: `templates`, `peticoes`, `receitas`)

**Manter quase igual:**
- `cadastro.html` / `login.html` (mesmo fluxo Supabase Auth)
- `assinatura.html` / `upgrade.html` (mesmo Asaas, só mudar PRO_VALUE/descrição)
- `configuracoes.html` (se usar BYOK pra LLM)
- `sidebar.js` (só mudar items do menu)
- `shared.css` (mantém todo, só ajusta cores no `:root`)

### Passo 7: Adapta edge functions Asaas

Em `supabase/functions/asaas-create-subscription/index.ts`:
```ts
const PRO_VALUE = 49.90; // seu preço
const PRO_DESCRIPTION = 'SeuSaaS — Plano Pro Mensal';
```

Resto fica igual (anti-duplicata, retry, etc.).

Deploy:
```bash
npx supabase functions deploy asaas-create-subscription --project-ref SEU_REF
npx supabase functions deploy asaas-cancel-subscription --project-ref SEU_REF
npx supabase functions deploy asaas-payment-history --project-ref SEU_REF
npx supabase functions deploy asaas-webhook --project-ref SEU_REF
npx supabase functions deploy delete-account --project-ref SEU_REF
```

### Passo 8: Configura Asaas + GitHub Pages

**Asaas:**
1. Conta sandbox: testar
2. Conta prod: ao validar
3. Webhook em ambos: `https://SEU_REF.supabase.co/functions/v1/asaas-webhook`
4. Token: gerar e setar em ambos (Asaas + Supabase secret `ASAAS_WEBHOOK_TOKEN`)

**GitHub Pages:**
1. Push o repo
2. Settings → Pages → Source: branch main
3. Aguardar 1-2 min

## 🎨 Customização visual

`shared.css` tem variáveis no topo. Trocar essas cores muda toda a identidade:

```css
:root {
  --bg: #0d0e12;        /* fundo */
  --panel: #1a1d24;     /* cards */
  --panel-2: #242833;
  --text: #e9ecf2;      /* texto */
  --muted: #8b8fa3;     /* texto secundário */
  --accent: #36c98a;    /* cor primária (CTAs) */
  --accent-2: #a78bfa;  /* cor secundária (links, destaques) */
  --border: rgba(255,255,255,0.08);
  --ok: #36c98a;
  --danger: #ff5d6c;
}
```

Light mode em `body.light-mode { ... }`. Mantenha o dark/light toggle (já está no sidebar footer).

## 🚫 O que NÃO replicar

- **Tutoriais específicos do Innova** (`lib/tutorial-page.js`) — escreva os seus do zero
- **Galeria de prompts** se seu nicho não envolve prompts/IA
- **Chat IA com BYOK** se seu nicho não usa LLMs
- **i18n EN/ES** se vai começar só PT-BR

## 🧠 Decisões importantes pra adaptar

1. **Quanto cobrar?** Pesquisa concorrentes do seu nicho. Pro entre R$ 29-99/mês cobre maioria de SaaS B2C; B2B aceita R$ 99-499/mês.
2. **Free generoso ou restrito?** Free generoso atrai usuários (good pro buzz inicial); restrito acelera conversão. Innova fez free generoso por estratégia de comunidade.
3. **BYOK ou hosted?** BYOK barateia muito mas exige que cliente configure (atrito). Hosted custa caro pra você (LLM bills). Innova escolheu BYOK.
4. **Multi-tenant ou single?** Innova é multi-tenant (cada user vê só seu). Pra B2B, considere times/orgs (não tem aqui).
5. **Onboarding?** Adicione tour guiado nas primeiras visitas (`lib/tutorial.js` é bom ponto de partida).

## 📝 Checklist pré-lançamento

- [ ] Landing page com proposta clara de valor
- [ ] Cadastro/Login funcionando
- [ ] Pelo menos 1 feature core funcionando
- [ ] Plano Free utilizável sem cartão
- [ ] Plano Pro com checkout Asaas testado em sandbox
- [ ] Switch pra produção Asaas
- [ ] Termos de uso + Política de privacidade (LGPD!)
- [ ] Email de suporte ativo
- [ ] Backup do banco configurado
- [ ] Monitoramento de erros (Sentry/LogRocket opcional)
- [ ] Smoke test end-to-end (signup → assinatura → cancelamento)

## 💡 Ideias de nichos pra adaptar

- **Advogados:** Templates de petições, IA jurídica via BYOK, prazos
- **Contadores:** Modelos de planilha, calculadoras fiscais, lembretes
- **Fotógrafos:** Marca d'água + galeria + presets Lightroom
- **Designers:** Galeria de inspirações + ferramentas de imagem (já existe!)
- **Coaches:** Templates de questionários, sessões agendadas
- **E-commerce:** Gerador de descrições de produto via IA (BYOK)
- **Imobiliárias:** Geração de descritivos via IA + galeria de imóveis

A base (auth, planos, pagamento, ferramentas básicas) é a mesma. O que muda é **o conteúdo central** que entrega valor.
