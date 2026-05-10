# 📚 Documentação — Innova AI Studio

Bem-vindo à documentação completa do projeto. Para a IA consultar, aponte o arquivo específico abaixo.

## 🗂️ Como usar esta documentação

Cada arquivo é independente. Você pode pedir pra IA: **"Consulta o arquivo `docs/03-paginas.md` e me ajude a..."**

| Arquivo | Use quando | Tamanho aprox. |
|---|---|---|
| [01-overview.md](01-overview.md) | Entender o que é o projeto, público, modelo de negócio | curto |
| [02-stack.md](02-stack.md) | Saber as tecnologias usadas, dependências, padrões | médio |
| [03-paginas.md](03-paginas.md) | Mapear cada página HTML e o que ela faz | longo |
| [04-banco-dados.md](04-banco-dados.md) | Entender schema, tabelas, RLS, triggers | médio |
| [05-edge-functions.md](05-edge-functions.md) | Funções serverless (Asaas, delete-account, etc.) | médio |
| [06-integracoes.md](06-integracoes.md) | Asaas, Supabase, Lucide, fontes externas | curto |
| [07-deploy-ops.md](07-deploy-ops.md) | Como fazer deploy, configurar secrets, ops | curto |
| [08-replicar-projeto.md](08-replicar-projeto.md) | **Replicar isto pra outro nicho** (passo a passo) | médio |

## 🎯 Casos de uso comuns

### "Quero criar uma plataforma parecida pra outro nicho"
→ [08-replicar-projeto.md](08-replicar-projeto.md) é seu ponto de partida.

### "Quero adicionar uma feature nova"
→ [03-paginas.md](03-paginas.md) (entender padrões) + [02-stack.md](02-stack.md) (libs disponíveis).

### "Quero entender por que X funciona desse jeito"
→ [01-overview.md](01-overview.md) (decisões de produto) + arquivo da camada técnica.

### "Tem bug no pagamento / assinatura"
→ [05-edge-functions.md](05-edge-functions.md) (Asaas) + [06-integracoes.md](06-integracoes.md).

### "Quero entender o banco"
→ [04-banco-dados.md](04-banco-dados.md).

## ⚠️ Quando atualizar esta documentação

Atualize os arquivos correspondentes quando:
- Adicionar nova página → atualize `03-paginas.md`
- Mudar schema do banco (migrations) → atualize `04-banco-dados.md`
- Criar/modificar edge function → atualize `05-edge-functions.md`
- Trocar de provedor de pagamento → atualize `06-integracoes.md`
- Mudar processo de deploy → atualize `07-deploy-ops.md`

## 📎 Arquivos principais do projeto (referência rápida)

```
watermark-app/
├── *.html              # Páginas (uma por feature)
├── shared.css          # Estilos compartilhados (TODAS as páginas usam)
├── sidebar.js          # Sidebar global montada em todas as páginas
├── supabase-client.js  # Cliente Supabase exportado
├── lib/                # JS específico de cada página
├── supabase/
│   ├── functions/      # Edge functions (Deno)
│   └── migrations/     # SQL versionado
└── docs/               # Esta documentação
```
