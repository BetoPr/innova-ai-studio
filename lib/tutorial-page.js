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
  // Foca o card pra acessibilidade (Esc fecha)
  $('tutModalClose').focus();
}

function closeTopic() {
  $('tutModal').hidden = true;
  document.body.style.overflow = '';
}

document.querySelectorAll('.tut-card').forEach(card => {
  card.addEventListener('click', () => openTopic(card.dataset.topic));
});

$('tutModalClose').addEventListener('click', closeTopic);
$('tutModal').addEventListener('click', (e) => {
  if (e.target === $('tutModal')) closeTopic();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('tutModal').hidden) closeTopic();
});
