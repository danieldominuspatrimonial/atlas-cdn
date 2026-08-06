// Atlas Co. — validador de conteúdo.
// Aplica as regras do PROMPT "Crença Escrita" (Daniel, ago/2026).
// Decisão do Daniel em 05/ago/2026: PDF integral, sem exceção.
//
// A checagem é por PALAVRA INTEIRA contra uma lista de formas explícitas, não
// por prefixo. A versão anterior usava radicais ("compr", "jur", "adia") e
// reprovava vocabulário legítimo do nicho: compreensão, juros compostos,
// adiantamento, escala, apostila. Vocabulário barrado sem motivo empurra o
// operador a usar --force, que desliga o validador inteiro.

const FRASES = [
  'correr sem sair do lugar', 'entender o jogo', 'funcionario de luxo',
  'ansiedade em dolar', 'vence no bolso e perde na alma', 'cansaco disfarcado',
  'sobrevivencia planejada', 'custo emocional', 'modo automatico', 'piloto automatico',
  'apagando incendio', 'solta o controle', 'evita o espelho', 'evitar espelho',
  'mentira mais cara', 'entrega cega',
];

// Formas exatas, já sem acento e em minúscula. Inclui plural e as conjugações
// que aparecem na prática. Acrescentar aqui é seguro; radical não é.
const PALAVRAS = [
  'prisao', 'prisoes', 'prisional',
  'disfarce', 'disfarces', 'disfarcar', 'disfarcado', 'disfarcada', 'disfarcados', 'disfarcadas',
  'incendio', 'incendios',
  'jogo', 'jogos', 'jogar', 'joga', 'jogada',
  'cracha', 'crachas',
  'suicidio', 'suicidios', 'suicida',
  'ilusao', 'ilusoes', 'ilusorio', 'ilusoria',
  'digital', 'digitais', 'digitalmente',
  'escalar', 'escala', 'escalada', 'escalavel',
  'recalque', 'recalcado', 'recalcada',
  'aposta', 'apostas', 'apostar', 'apostou', 'apostando',
  'escravo', 'escrava', 'escravos', 'escravas', 'escravidao',
  'luxo', 'luxos', 'luxuoso', 'luxuosa',
  'operacional', 'operacionais',
  'sangrar', 'sangra', 'sangrando', 'sangue',
  'peso', 'pesos', 'pesado', 'pesada', 'pesados', 'pesadas',
  'apagar', 'apaga', 'apagando', 'apagado', 'apagada',
  'glamour', 'glamouroso', 'glamourosa',
  'juro', 'juros',
  'elegante', 'elegantes', 'elegancia',
  'escassez', 'escasso', 'escassa',
  'compra', 'compras', 'comprar', 'comprou', 'comprando', 'comprado', 'comprada',
  'frustracao', 'frustrado', 'frustrada', 'frustrar', 'frustra',
  'fuga', 'fugas', 'fugir', 'foge', 'fugindo',
  'castigo', 'castigos', 'castigar',
  'culpa', 'culpas', 'culpar', 'culpado', 'culpada', 'culpando',
  'travestido', 'travestida', 'travestir',
  'estagnacao', 'estagnado', 'estagnada', 'estagnar',
  'migalha', 'migalhas',
  'cadeia', 'cadeias',
  'malandro', 'malandra', 'malandragem',
  'colher', 'colhe', 'colheita', 'colhendo',
  'networking',
  'brilhar', 'brilha', 'brilho', 'brilhando',
  'gritar', 'grita', 'gritando', 'grito', 'gritos',
  'anular', 'anula', 'anulado', 'anulada',
  'adiar', 'adia', 'adiando', 'adiado', 'adiada',
  'coleira', 'coleiras',
  'exaustao', 'exausto', 'exausta',
  'fogo', 'fogos',
  'clareza',
  'refem', 'refens',
  'armadilha', 'armadilhas',
  'implodir', 'implode', 'implodindo',
  'ladrao', 'ladroes', 'ladra',
  'impostor', 'impostora', 'impostores',
  'explodir', 'explode', 'explodindo', 'explosao',
  'contracheque', 'contracheques',
  'moeda', 'moedas',
  'expertise',
  'inacao',
  'paralisia', 'paralisar', 'paralisa', 'paralisado', 'paralisada',
  'medo', 'medos',
  'invisibilidade', 'invisivel',
  'scroll', 'scrollar', 'scrolleia', 'doomscroll',
  'confraria',
  'screenshot', 'screenshots',
  'proof',
  'sabotar', 'sabotagem', 'sabota', 'sabotando',
  'drenar', 'drena', 'drenado', 'drenada',
  'abdicacao', 'abdicar', 'abdica',
  'enterrar', 'enterrado', 'enterrada',
  'autorizado', 'autorizada',
  'muleta', 'muletas',
  'planejamento', 'planejar', 'planeja', 'planejado', 'planejada',
  'genuino', 'genuina', 'genuinamente',
];
const BANIDAS = new Set(PALAVRAS);

const CTA = ['comenta ai', 'comenta aqui', 'me segue', 'segue ai', 'salva esse', 'salva ai',
  'deixa o like', 'curte ai', 'link na bio', 'chama no direct', 'manda um direct'];

// Cobre pictogramas, bandeiras regionais, seletor de variação e teclas.
// A faixa fixa anterior deixava passar bandeira, estrela, relógio e setas.
const EMOJI = /\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|️|⃣/u;

// Hashtag de verdade começa por letra. `#1` e `sala #5` não são hashtag.
const HASHTAG = /(?:^|[\s(\[])#[a-zA-ZÀ-ÿ]/;

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function checkText(raw, where, opts = {}) {
  const problems = [];
  const t = norm(raw);

  if (raw.includes('—') || raw.includes('–')) {
    problems.push(`${where}: travessão encontrado (proibido em qualquer hipótese)`);
  }
  if (EMOJI.test(raw)) problems.push(`${where}: emoji encontrado (proibido)`);
  if (HASHTAG.test(raw)) problems.push(`${where}: hashtag encontrada (a configuração define zero)`);

  for (const f of FRASES) {
    if (t.includes(f)) problems.push(`${where}: expressão proibida "${f}"`);
  }

  // palavra inteira, sem prefixo: evita barrar compreensão, aposentadoria, pesquisa
  const vistas = new Set();
  for (const p of t.split(/[^a-z0-9]+/)) {
    if (p && BANIDAS.has(p) && !vistas.has(p)) {
      vistas.add(p);
      problems.push(`${where}: palavra proibida "${p}"`);
    }
  }

  if (opts.noCta) {
    for (const c of CTA) {
      if (t.includes(c)) problems.push(`${where}: CTA proibido nos slides ("${c}")`);
    }
  }

  return problems;
}

function lint(carousel) {
  const problems = [];

  // Orçamento de caracteres. A tipografia é fixa: texto longo não é encolhido,
  // ele simplesmente não cabe. Conta TODOS os campos textuais do slide, não só
  // o `text` — antes, um `list` com itens gigantes passava e só estourava no
  // Chromium meio minuto depois.
  const LIMITE = carousel.aspect === '4:5' ? 430 : 330;
  const LIMITE_COM_FOTO = Math.round(LIMITE * 0.42);

  const slugOk = typeof carousel.slug === 'string' && /^[a-z0-9-]+$/.test(carousel.slug);
  if (!slugOk) {
    problems.push(`slug inválido ("${carousel.slug}"). Use apenas letras minúsculas, números e hífen.`);
  }

  carousel.slides.forEach((s, i) => {
    const where = `slide ${i + 1}`;
    const campos = [s.text, s.label, s.value, ...(s.items || []),
      ...Object.values(s.engagement && typeof s.engagement === 'object' ? s.engagement : {})];

    const custo = campos.filter(Boolean).join('\n').length;
    const max = s.image ? LIMITE_COM_FOTO : LIMITE;
    if (custo > max) {
      problems.push(`${where}: ${custo} caracteres (máximo ${max}${s.image ? ' porque tem foto' : ''}). Corte ${custo - max}.`);
    }

    for (const c of campos) {
      if (c) problems.push(...checkText(String(c), where, { noCta: true }));
    }
  });

  // Campos fora dos slides que também vão para a tela
  for (const [campo, valor] of [
    ['rodapé', carousel.footer],
    ['nome do autor', carousel.author?.name],
    ['@ do autor', carousel.author?.handle],
  ]) {
    if (valor) problems.push(...checkText(String(valor), campo, { noCta: false }));
  }

  if (!carousel.caption || !carousel.caption.trim()) {
    problems.push('legenda: ausente. Todo carrossel precisa de legenda.');
  } else {
    // Decisão do Daniel: slides sem CTA, legenda pode fechar com pergunta.
    problems.push(...checkText(carousel.caption, 'legenda', { noCta: false }));
    const palavras = carousel.caption.trim().split(/\s+/).length;
    if (palavras > 45) {
      problems.push(`legenda: ${palavras} palavras (alvo ~30; legenda curta tem maior engajamento)`);
    }
    if (carousel.caption.length > 2200) {
      problems.push(`legenda: ${carousel.caption.length} caracteres (limite da Meta: 2200)`);
    }
    if (!carousel.caption.includes('?')) {
      problems.push('legenda: sem pergunta de fechamento (pergunta rende +37% em comentários)');
    }
  }

  const n = carousel.slides.length;
  if (n < 2 || n > 10) problems.push(`carrossel com ${n} slides (a Graph API aceita de 2 a 10)`);

  return problems;
}

module.exports = { lint, checkText, BANIDAS };
