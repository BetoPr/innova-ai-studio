// tutorial-page.js — abre modal com conteúdo de cada tópico do guia.

const TOPICS = {
  fotos: {
    icon: 'camera',
    title: 'Boas fotos com IA',
    intro: 'A diferença entre uma foto que parece IA genérica e uma que parece profissional está no PROMPT. Aqui vai o que faz diferença de verdade:',
    sections: [
      {
        h: '1. Seja específico (não genérico)',
        body: '❌ "Uma mulher elegante"<br>✅ "Mulher 30 anos, blazer cinza Armani, cabelo castanho preso, sentada em escritório minimalista, luz natural lateral, fotografia editorial, lente 85mm, fundo desfocado bokeh"'
      },
      {
        h: '2. Cite estilo fotográfico',
        body: 'Adicione palavras-chave: <strong>fotografia editorial, fotojornalismo, retrato corporativo, fashion editorial, lifestyle</strong>. Define o "olhar" da imagem.'
      },
      {
        h: '3. Defina a iluminação',
        body: '<strong>Luz natural lateral</strong> (suave, profissional)<br><strong>Golden hour</strong> (dourado, romântico)<br><strong>Studio lighting</strong> (controlado, comercial)<br><strong>Rembrandt lighting</strong> (dramático, retratos)'
      },
      {
        h: '4. Especifique a câmera/lente',
        body: 'Lentes mudam a "sensação" da imagem:<br><strong>50mm</strong> = natural, retrato clássico<br><strong>85mm</strong> = retrato premium, bokeh suave<br><strong>35mm</strong> = ambiente, lifestyle<br><strong>24mm</strong> = grande angular, paisagem'
      },
      {
        h: '5. Use referências de marca/era',
        body: 'IAs entendem referências culturais: "fotografia estilo Wes Anderson", "campanha Apple 2024", "editorial Vogue anos 90", "Pixar 3D render", "estilo Studio Ghibli".'
      },
      {
        h: '6. Negative prompts (o que NÃO quer)',
        body: 'Algumas IAs aceitam prompt negativo. Use pra eliminar problemas comuns:<br>"sem texto, sem logo, sem deformações nas mãos, sem watermark"'
      },
    ],
    cta: { label: 'Ir pra Construtor de prompts', href: 'construtor.html' },
  },

  ferramentas: {
    icon: 'wrench',
    title: 'Ferramentas do Studio',
    intro: 'Cinco ferramentas pra preparar suas imagens depois de gerar/baixar:',
    sections: [
      {
        h: '💧 Marca d\'água',
        body: 'Adiciona seu logo (ou texto) sobre a imagem. <strong>Pro:</strong> sem marca "Innova" embaixo, controle total de opacidade, posição, tamanho. Suporta lote: aplica em várias fotos de uma vez.'
      },
      {
        h: '✂️ Remover fundo',
        body: 'Remove o fundo automaticamente (deixa transparente em PNG). Útil pra produto, retrato, mockup. Roda no seu navegador (não envia pra servidor — privado e rápido).'
      },
      {
        h: '📦 Comprimir',
        body: 'Reduz tamanho do arquivo mantendo qualidade visual. Importante pra Instagram/site (carregamento rápido). Aceita JPG/PNG/WebP, mostra o "antes/depois" do tamanho.'
      },
      {
        h: '🔄 Converter formato',
        body: 'Troca entre JPG, PNG, WebP, AVIF. Útil quando o cliente pede um formato específico ou pra economizar espaço (WebP é 30% menor que JPG com mesma qualidade).'
      },
      {
        h: '📐 Redimensionar',
        body: 'Muda dimensões da imagem. Presets prontos: Instagram quadrado (1080x1080), Stories (1080x1920), LinkedIn (1200x627), Twitter, etc. Mantém proporção automaticamente.'
      },
    ],
    cta: { label: 'Abrir Marca d\'água', href: 'marca-dagua.html' },
  },

  apis: {
    icon: 'key-round',
    title: 'Configurando APIs (BYOK)',
    intro: 'BYOK = "Bring Your Own Key". Você usa SUA chave de API. As mensagens vão direto da sua conta pro provedor (Groq/OpenAI). Você paga só o que usar.',
    sections: [
      {
        h: '⚡ Groq (recomendado pra começar)',
        body: '<strong>GRÁTIS</strong> com limite generoso (~14k tokens/min). Modelos: Llama 3.3 70B, Mixtral, Gemma.<br><br><strong>Como pegar:</strong><br>1. Vai em <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a><br>2. Cria conta (Google ou GitHub)<br>3. "Create API Key"<br>4. Copia a chave (começa com <code>gsk_</code>)<br>5. Cola em Configurações → Groq'
      },
      {
        h: '🧠 OpenAI (qualidade premium)',
        body: '<strong>Pago</strong>: ~$0,15-$5 por 1M tokens. Modelos: GPT-4o, GPT-4 Turbo, o1-mini.<br><br><strong>Como pegar:</strong><br>1. <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a><br>2. Adiciona crédito ($5 já dura bastante)<br>3. "Create new secret key"<br>4. Copia (começa com <code>sk-</code>)<br>5. Cola em Configurações → OpenAI'
      },
      {
        h: '🌐 OpenRouter (vários modelos)',
        body: 'Acesso a vários modelos (Gemini, Llama, Mistral, Claude) com uma chave só. Modelos com <code>:free</code> no nome são grátis.<br><br><strong>Como pegar:</strong><br>1. <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai/keys</a><br>2. Cria conta<br>3. "Create Key"<br>4. Cola em Configurações → OpenRouter'
      },
      {
        h: '🔒 Suas chaves ficam seguras?',
        body: 'Sim. As chaves ficam apenas no <strong>seu navegador</strong> (localStorage). Nunca passam pelos nossos servidores. Você pode apagar a qualquer momento em Configurações → "Limpar tudo".'
      },
    ],
    cta: { label: 'Configurar agora', href: 'configuracoes.html' },
  },

  construtor: {
    icon: 'blocks',
    title: 'Construtor de prompts',
    intro: 'Em vez de escrever um prompt do zero, monta com blocos visuais. Cada bloco controla um aspecto da imagem (sujeito, estilo, luz, etc.) — e você combina como quiser.',
    sections: [
      {
        h: 'Como funciona',
        body: 'Você arrasta blocos pro lado direito → cada bloco vira parte do prompt → no final, copia o texto pronto e usa onde quiser (Midjourney, Flux, Imagen, etc.).'
      },
      {
        h: 'Blocos disponíveis (Free)',
        body: '5 blocos básicos: Sujeito, Cenário, Estilo, Iluminação, Câmera.'
      },
      {
        h: 'Blocos Pro (11 no total)',
        body: '+6 blocos avançados: Composição, Cor, Mood, Detalhes técnicos, Referências, Negative prompt. Permite prompts profissionais de campanha.'
      },
      {
        h: 'Salvar prompt',
        body: 'Tudo que você cria fica em "Meus prompts" (pode editar/duplicar). Free: até 5 publicados. Pro: ilimitado.'
      },
    ],
    cta: { label: 'Abrir Construtor', href: 'construtor.html' },
  },

  chat: {
    icon: 'message-circle',
    title: 'Chat IA',
    intro: 'Converse com IAs pra refinar prompts, fazer brainstorm, ou tirar dúvidas. Usa SUA chave de API (configurada em Configurações).',
    sections: [
      {
        h: 'Pra quê serve',
        body: '<strong>Refinar prompts:</strong> "Melhora esse prompt de Midjourney pra ficar mais profissional"<br><strong>Brainstorm:</strong> "Me dê 10 ideias de campanha pra escritório de advocacia"<br><strong>Tradução:</strong> Cola um prompt em português, pede em inglês otimizado pra IA'
      },
      {
        h: 'Modelos disponíveis',
        body: 'Free: Llama 3.3 70B (Groq), GPT-4o-mini.<br>Pro: 50+ modelos prontos pra usar (Llama 3.1 405B, GPT-4 Turbo, Claude via OpenRouter, Gemini, Mistral, etc.).'
      },
      {
        h: 'Histórico salvo',
        body: 'Suas conversas ficam salvas (sincroniza entre dispositivos se logado). Pode renomear, duplicar, deletar conversa.'
      },
      {
        h: 'Dica de poder',
        body: 'Cole uma imagem (drag & drop) — modelos com visão (GPT-4o) descrevem ela e podem gerar variações de prompt baseadas nela.'
      },
    ],
    cta: { label: 'Abrir Chat IA', href: 'chat-ia.html' },
  },

  galeria: {
    icon: 'layout-grid',
    title: 'Galeria & Compartilhar',
    intro: 'Comunidade do Innova. Compartilhe seus melhores prompts, descubra criadores, copie prompts inspiradores.',
    sections: [
      {
        h: 'Como publicar',
        body: '1. Cria seu prompt no Construtor<br>2. Vai em "Compartilhar"<br>3. Adiciona título, descrição, exemplos de imagem<br>4. Marca como Free (qualquer um copia) ou Pro (só assinantes copiam)'
      },
      {
        h: 'Limite Free',
        body: '5 prompts publicados. Pro: ilimitado.'
      },
      {
        h: 'Como funciona o "Pro" no prompt',
        body: 'Você marca seu prompt como Pro = só usuários assinantes podem ver/copiar. É o que justifica eles pagarem a assinatura. Você ganha visibilidade na comunidade Pro.'
      },
      {
        h: 'Favoritar e curtir',
        body: 'Use o ❤️ pra curtir (público) e o 🔖 pra favoritar (privado, só você vê). Favoritos ficam em "Favoritos" no menu.'
      },
    ],
    cta: { label: 'Ver Galeria', href: 'galeria.html' },
  },

  conta: {
    icon: 'crown',
    title: 'Conta & Plano Pro',
    intro: 'Como funciona a assinatura, formas de pagamento, e gestão da conta.',
    sections: [
      {
        h: 'Plano Free',
        body: 'Pra sempre grátis. Acesso à galeria pública, copiar prompts, Chat IA com chave própria, 5 prompts publicados, construtor básico (5 blocos), todas as ferramentas.'
      },
      {
        h: 'Plano Pro — R$ 39,90/mês',
        body: 'Tudo do Free +<br>• Acesso a TODOS os prompts curados Pro<br>• Prompts publicados ILIMITADOS<br>• Construtor visual completo (11 blocos)<br>• Chat IA com 50+ modelos prontos<br>• Sem marca d\'água nas ferramentas<br>• Selo Pro no perfil<br>• Suporte prioritário'
      },
      {
        h: 'Formas de pagamento',
        body: 'PIX, boleto bancário, cartão de crédito (via Asaas). Você escolhe na hora do checkout. <strong>Recomendo PIX</strong> — confirma em segundos.'
      },
      {
        h: 'Cancelar quando quiser',
        body: 'Sem fidelidade. Você cancela em "Minha assinatura" → "Cancelar assinatura". <strong>Continua com Pro até o fim do ciclo já pago</strong> e depois vira Free automaticamente.'
      },
      {
        h: 'Apagar conta',
        body: 'Se quiser sair de vez: Configurações de perfil → "Apagar minha conta". Remove dados pessoais e cancela assinatura. Prompts publicados continuam visíveis como @conta-apagada (não deleta o conteúdo da galeria pra não quebrar histórico de outros usuários).'
      },
    ],
    cta: { label: 'Ver minha assinatura', href: 'assinatura.html' },
  },

  flow: {
    icon: 'sparkles',
    title: 'Flow — gerar imagens grátis',
    intro: 'O <strong>Flow</strong> (do Google Labs) é a ferramenta principal e gratuita que usamos pra gerar ensaios e fotos com IA. Verificado em <strong>11/05/2026</strong>: geração de imagens é <strong>gratuita e sem limite diário</strong>. Aqui o passo a passo completo:',
    sections: [
      {
        h: '1. Crie sua conta (login com Google)',
        body: `Entra em <a href="https://labs.google/flow" target="_blank" rel="noopener">labs.google/flow</a> e clica em <strong>"Sign in with Google"</strong> no canto superior direito. Usa qualquer conta Google sua — pessoal ou de trabalho.<br><img src="tutorial-img/flow-1-signin.png" alt="Botão Sign in with Google no canto superior direito do Flow" class="tut-img" loading="lazy" onerror="this.style.display='none'">`
      },
      {
        h: '2. Clique em "+ Novo projeto"',
        body: `Após logar, vai aparecer a tela inicial. Clica no card <strong>"+ Novo projeto"</strong> pra começar.<br><img src="tutorial-img/flow-2-novo-projeto.jpg" alt="Card + Novo projeto no Flow" class="tut-img" loading="lazy" onerror="this.style.display='none'">`
      },
      {
        h: '3. Escolha o modelo: Nano Banana Pro',
        body: `Dentro do chat, no painel de configuração, escolhe o modelo <strong>"🍌 Nano Banana Pro"</strong> (é o melhor pra retratos e ensaios). Outras opções: Nano Banana 2 e Imagen 4 — mas o Pro entrega mais qualidade.<br><img src="tutorial-img/flow-3-modelo.png" alt="Seletor de modelo com Nano Banana Pro selecionado" class="tut-img" loading="lazy" onerror="this.style.display='none'">`
      },
      {
        h: '4. Configure x4 (gerar 4 fotos por prompt)',
        body: `Logo abaixo da proporção, escolhe a quantidade: <strong>x1, x2, x3 ou x4</strong>. Recomendado: <strong>x4</strong>. Com um prompt só você recebe 4 variações da imagem e escolhe a melhor.<br><img src="tutorial-img/flow-4-x4.jpg" alt="Opção x4 selecionada pra gerar 4 imagens por prompt" class="tut-img" loading="lazy" onerror="this.style.display='none'">`
      },
      {
        h: '5. Escolha a proporção certa',
        body: `<strong>Padrão recomendado: 3:4</strong> (foto de perfil clássica). Mas escolhe conforme a finalidade:<br><br>📱 <strong>9:16</strong> — selfies, Stories, Reels<br>👤 <strong>3:4</strong> — fotos de perfil, retratos<br>🖼️ <strong>16:9</strong> — capas, banners, LinkedIn<br>⬛ <strong>1:1</strong> — feed quadrado do Instagram<br>📺 <strong>4:3</strong> — clássico<br><img src="tutorial-img/flow-5-proporcao.png" alt="Opções de proporção: 16:9, 4:3, 1:1, 3:4, 9:16" class="tut-img" loading="lazy" onerror="this.style.display='none'">`
      },
      {
        h: '6. Cole o prompt e gere',
        body: `Lá embaixo tem o campo <strong>"O que você quer criar?"</strong>. Cola seu prompt (em inglês de preferência) e clica na seta pra gerar. As 4 imagens aparecem em segundos. Se quiser dar mais contexto (uma foto de referência do cliente, por exemplo), clica no <strong>"+"</strong> ao lado do campo e adiciona o arquivo.<br><img src="tutorial-img/flow-6-prompt.png" alt="Campo de prompt do Flow com botão + e seta de envio" class="tut-img" loading="lazy" onerror="this.style.display='none'">`
      },
      {
        h: '💡 Status atual — 11/05/2026',
        body: `<strong>Verificado nesta data:</strong> a geração de imagens no Flow é <strong>gratuita e ilimitada</strong>. Sem cobrança por geração, sem limite diário visível.<br><br>Se o Google mudar isso no futuro, vou atualizar essa seção. Se você notar limite começando a aparecer, me avisa.`
      },
    ],
    cta: { label: 'Abrir Flow', href: 'https://labs.google/flow' },
  },

  clientes: {
    icon: 'user-round-check',
    title: 'Workflow com fotos de cliente',
    intro: 'Bons ensaios começam ANTES do prompt — começam na qualidade da foto que o cliente te manda. Aqui o fluxo que funciona:',
    sections: [
      {
        h: '1. Eduque o cliente no briefing',
        body: `Sempre peça <strong>4 fotos</strong> antes de começar:<br><br>📸 <strong>3 fotos do rosto, de frente</strong> — com boa luz, expressões diferentes (séria, sorrindo, neutra). A IA precisa enxergar os detalhes do rosto (traços, marcas, formato) pra preservar identidade.<br><br>📸 <strong>1 foto de corpo inteiro</strong> — pra IA captar proporções e altura.<br><br>Quanto mais detalhe a IA vê, mais fiel fica o resultado.`
      },
      {
        h: '2. Foto veio ruim? Melhora antes de usar',
        body: `Se o cliente mandou uma foto borrada, pequena ou de baixa qualidade, <strong>NÃO use direto</strong>. Foto ruim de entrada = ensaio ruim de saída. Sempre passa primeiro pela <strong>Gemini</strong> (Nano Banana) ou pelo <strong>Flow</strong> pra aumentar a qualidade preservando o rosto.`
      },
      {
        h: '3. Prompt que aumenta a qualidade preservando identidade',
        body: `Cola esse prompt no Gemini ou Flow <strong>junto com a foto do cliente</strong>. O que faz ele especial: <strong>preserva 100% da identidade</strong> — não muda rosto, roupa, cena, expressão. Só recupera nitidez e detalhes.<br><br><div class="tut-copyblock"><button type="button" class="tut-copy-btn" data-copy-target="enhancePrompt"><i data-lucide="copy"></i> Copiar prompt</button><pre id="enhancePrompt" class="tut-pre">Ultra-premium professional image enhancement.
Transform the uploaded low-quality, blurry image into extreme high-detail cinematic quality.
Preserve 100% original identity, face structure, expression, pose, clothing, accessories, background, framing, and composition.
Do NOT alter, redesign, replace, or add anything.

Recover micro-details:
- sharp facial features
- natural skin texture
- visible pores
- realistic hair strands
- crisp eyes
- clean refined edges

High-contrast clarity, deep depth, and balanced cinematic lighting.
Poster-grade realism with dramatic but accurate detail.
Output in 8K resolution, ProRes quality, studio-level sharpness.
Photorealistic textures only. True-to-source enhancement only.
Keep everything exactly the same — only enhance quality.</pre></div>`
      },
      {
        h: '4. Agora sim, faça o ensaio',
        body: `Com a foto do cliente em alta qualidade (saída do passo 3), entra no <strong>Flow</strong> e faz os ensaios combinados — fundo de estúdio, cenário externo, look fashion, retrato corporativo, etc. A fidelidade vai ser muito maior do que se você tivesse usado a foto original baixa.`
      },
    ],
    cta: { label: 'Ver Galeria de prompts', href: 'galeria.html' },
  },
};

const $ = (id) => document.getElementById(id);

function openTopic(key) {
  const topic = TOPICS[key];
  if (!topic) return;

  const html = `
    <div class="tut-modal-head">
      <div class="tut-modal-icon"><i data-lucide="${topic.icon}"></i></div>
      <h2>${topic.title}</h2>
    </div>
    <p class="tut-modal-intro">${topic.intro}</p>
    <div class="tut-modal-sections">
      ${topic.sections.map(s => `
        <div class="tut-section">
          <h3>${s.h}</h3>
          <div class="tut-section-body">${s.body}</div>
        </div>
      `).join('')}
    </div>
    ${topic.cta ? `<a class="tut-modal-cta" href="${topic.cta.href}">
      <i data-lucide="arrow-right"></i> ${topic.cta.label}
    </a>` : ''}
  `;

  $('tutModalBody').innerHTML = html;
  $('tutModal').hidden = false;
  document.body.style.overflow = 'hidden';
  if (window.lucide) lucide.createIcons();
  bindCopyButtons();
  // Foca o card pra acessibilidade (Esc fecha)
  $('tutModalClose').focus();
}

// Liga botões "Copiar" que aparecem em blocos de prompt dentro do modal.
function bindCopyButtons() {
  document.querySelectorAll('#tutModalBody .tut-copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const targetId = btn.dataset.copyTarget;
      const target = document.getElementById(targetId);
      if (!target) return;
      const text = target.innerText;
      try {
        await navigator.clipboard.writeText(text);
        const orig = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check"></i> Copiado!';
        btn.classList.add('copied');
        if (window.lucide) lucide.createIcons();
        setTimeout(() => {
          btn.innerHTML = orig;
          btn.classList.remove('copied');
          if (window.lucide) lucide.createIcons();
        }, 1800);
      } catch {
        // Fallback se clipboard API falhar (HTTP, browser antigo)
        const range = document.createRange();
        range.selectNodeContents(target);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  });
}

function closeTopic() {
  $('tutModal').hidden = true;
  document.body.style.overflow = '';
}

// === GATE de login: cards visíveis pra todos, conteúdo só pra logados ===
async function isLoggedIn() {
  try {
    if (window.innovaAuth?.getUser) {
      const u = await window.innovaAuth.getUser();
      return !!u;
    }
    // Fallback: supabase-client.js ainda não carregou
    if (window.supabase) {
      const { data: { user } } = await window.supabase.auth.getUser();
      return !!user;
    }
  } catch (e) { /* ignora */ }
  return false;
}

function openLoginGate(topicTitle) {
  const ret = encodeURIComponent('tutorial.html');
  const html = `
    <div class="tut-modal-head">
      <div class="tut-modal-icon"><i data-lucide="lock"></i></div>
      <h2>Crie sua conta pra acessar</h2>
    </div>
    <p class="tut-modal-intro">
      O conteúdo de <strong>${topicTitle}</strong> e dos outros tutoriais é exclusivo pra membros.
      Criar conta é <strong>grátis</strong> e dá acesso a todos os guias, ferramentas e galeria.
    </p>
    <div class="tut-gate-actions">
      <a href="cadastro.html?return=${ret}" class="tut-modal-cta">
        <i data-lucide="rocket"></i> Criar conta grátis
      </a>
      <a href="login.html?return=${ret}" class="tut-gate-secondary">
        Já tenho conta · <strong>Entrar</strong>
      </a>
    </div>
    <p class="tut-gate-note">
      <i data-lucide="shield-check"></i>
      Sem cartão. Cadastro em 30s.
    </p>
  `;
  $('tutModalBody').innerHTML = html;
  $('tutModal').hidden = false;
  document.body.style.overflow = 'hidden';
  if (window.lucide) lucide.createIcons();
  $('tutModalClose').focus();
}

async function handleCardClick(card) {
  const topicKey = card.dataset.topic;
  const topic = TOPICS[topicKey];
  const logged = await isLoggedIn();
  if (logged) {
    openTopic(topicKey);
  } else {
    openLoginGate(topic?.title || 'este guia');
  }
}

document.querySelectorAll('.tut-card').forEach(card => {
  card.addEventListener('click', () => handleCardClick(card));
});

$('tutModalClose').addEventListener('click', closeTopic);
$('tutModal').addEventListener('click', (e) => {
  if (e.target === $('tutModal')) closeTopic();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('tutModal').hidden) closeTopic();
});
