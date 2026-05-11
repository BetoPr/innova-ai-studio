# 01 — Overview do Projeto

## O que é

**Innova AI Studio** é uma plataforma SaaS web pra **criadores de conteúdo que usam IA pra gerar imagens** (Midjourney, Flux, Imagen, etc.). Centraliza:

- 📚 **Galeria curada** de prompts (próprios + comunidade)
- 🛠️ **Ferramentas de imagem** (marca d'água, remover fundo, comprimir, converter, redimensionar)
- 💬 **Chat IA** (BYOK — Bring Your Own Key, usuário paga API direto pro provedor)
- 🧱 **Construtor visual de prompts** (blocos drag-and-drop)
- 👥 **Comunidade** (publicar, curtir, favoritar prompts)

## Modelo de negócio

| Plano | Preço | Inclui |
|---|---|---|
| **Free** | R$ 0 | Galeria pública, 5 prompts publicados, ferramentas com marca d'água, Chat IA com chave própria, construtor básico (5 blocos) |
| **Pro** | R$ 39,90/mês ou R$ 419/ano (R$ 34,90/mês) | Tudo do Free + Prompts ilimitados, construtor completo (11 blocos), 50+ modelos no Chat IA, sem marca d'água, prompts Pro curados, selo Pro |
| **Studio** (em breve) | R$ 89,90/mês | Tudo do Pro + 150 imagens geradas/mês incluídas (Flow, Flux, Imagen 4) |

**Por que mais barato que concorrentes (Banana Prompts ~US$ 9,99/mês):** BYOK no Chat IA significa que não pagamos nem fazemos markup nas mensagens IA. O cliente paga direto pra Groq/OpenAI/OpenRouter na conta dele (Groq tem free tier generoso). A gente cobra só pelo curadoria + ferramentas + comunidade.

## Público-alvo

- Designers e gestores de redes sociais
- Profissionais de marketing/comunicação
- Empreendedores que fazem o próprio marketing
- Idade ~25-45, intermediários em IA, querem **eficiência** (não filosofia sobre IA)

## Decisões de produto importantes

### Frontend estático (sem framework)
HTML + CSS + JS vanilla. Sem React/Vue/Svelte. **Por quê:**
- Carrega rápido em conexões ruins (Brasil)
- Hospedagem grátis (GitHub Pages)
- Manutenção simples (qualquer dev mexe)
- Sem build step, deploy = git push

### Supabase como backend
Postgres + Auth + Edge Functions + Storage tudo gerenciado. **Por quê:**
- Free tier generoso pra começar
- RLS (Row Level Security) substitui muita API custom
- Typescript-friendly nas edge functions

### Asaas como gateway de pagamento (Brasil)
PIX, boleto e cartão. **Por quê:**
- Brasileiro, fácil de homologar (CPF/CNPJ)
- Webhook simples
- Recurring (assinatura mensal) nativo
- Taxas competitivas (~2.99% PIX/cartão)

### BYOK (Bring Your Own Key) no Chat IA
Usuário cola sua chave de API direto no navegador (localStorage). **Por quê:**
- Sem custos LLM no backend
- Privacy (mensagens nunca passam pelo nosso servidor)
- Dá pra cobrar mais barato que concorrentes
- Trade-off: usuário precisa configurar antes

### GitHub Pages como host
Site servido em https://betopr.github.io/innova-ai-studio/. **Por quê:**
- Grátis ilimitado
- HTTPS automático
- Deploy via `git push` (sem CI/CD complexo)
- Trade-off: SPA não funciona bem (sem rewrite rules), então cada feature é uma página HTML separada

### i18n via JSON (PT/EN/ES)
Traduções em `lib/i18n.js`. PT é principal, EN/ES suportados. **Por quê:**
- Mercado primário Brasil; inglês/espanhol prepara expansão LATAM

## Estado atual (2026-05-10)

✅ Em produção, recebendo pagamentos reais via Asaas.
✅ ~5 features principais funcionais.
🚧 Studio (geração de imagens) em desenvolvimento (lista de espera).
🚧 Recrutamento de testers Pro pra validar fluxo de cobrança real.

## Limitações conhecidas

- **Sem app mobile nativo** — apenas site responsivo
- **Sem geração de imagens própria ainda** — só ferramentas de pós-processamento
- **Mensagens de Chat IA não persistem cross-device** sem login
- **Sem suporte 24/7** — Plano Pro tem "suporte prioritário" via WhatsApp
