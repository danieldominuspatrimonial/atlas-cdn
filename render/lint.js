// Atlas Co. — validador de conteúdo.
// Aplica ao pé da letra as regras do PROMPT "Crença Escrita" (Daniel, ago/2026).
// Decisão do Daniel em 05/ago/2026: PDF integral, sem exceção. Vale inclusive para os
// conceitos-âncora antigos da marca (prisão de ouro, renda escrava) — banidos no conteúdo público.

// Expressões completas proibidas (checadas literalmente, sem acento/caixa)
const FRASES = [
  'correr sem sair do lugar', 'entender o jogo', 'funcionario de luxo',
  'ansiedade em dolar', 'vence no bolso e perde na alma', 'cansaco disfarcado',
  'sobrevivencia planejada', 'custo emocional', 'modo automatico', 'piloto automatico',
  'apagando incendio', 'solta o controle', 'evita o espelho', 'evitar espelho',
  'no fundo', 'mentira mais cara', 'entrega cega',
];

// Radicais proibidos (pegam plural, flexão verbal e derivados, como o PDF exige)
const RADICAIS = [
  'prisa', 'prisoes', 'disfarc', 'incendi', 'jog', 'crach', 'suicid', 'ilus',
  'digital', 'escal', 'recalq', 'apost', 'escrav', 'luxo', 'operacional',
  'sangr', 'peso', 'pesos', 'pesad', 'apag', 'glamour', 'jur', 'elegan',
  'escasse', 'compr', 'frustra', 'fug', 'castig', 'culp', 'travest',
  'estagna', 'migalh', 'cadeia', 'malandr', 'colhe', 'networking', 'brilh',
  'grit', 'anul', 'adia', 'coleir', 'exaust', 'fogo', 'clarez', 'refem',
  'armadilh', 'implod', 'ladr', 'impostor', 'explod', 'contracheque',
  'moeda', 'expertise', 'inacao', 'paralis', 'medo', 'invisibilid',
  'scroll', 'confraria', 'screenshot', 'proof', 'sabotag', 'dren',
  'abdica', 'enterr', 'autorizad', 'doomscroll', 'muleta', 'planejament', 'genuin',
];

// Radicais que geram falso positivo e precisam de exceção explícita
const EXCECOES = ['jogador de', 'compromisso', 'compreend', 'compromet', 'medoc'];

const CTA = ['comenta ai', 'comenta aqui', 'me segue', 'segue ai', 'salva esse', 'salva ai',
  'deixa o like', 'curte ai', 'link na bio', 'chama no direct', 'manda um direct'];

const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function checkText(raw, where, opts = {}) {
  const problems = [];
  const t = norm(raw);

  if (raw.includes('—') || raw.includes('–')) {
    problems.push(`${where}: travessão encontrado (proibido em qualquer hipótese)`);
  }
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(raw)) {
    problems.push(`${where}: emoji encontrado (proibido)`);
  }
  if (/(^|\s)#\w/.test(raw)) {
    problems.push(`${where}: hashtag encontrada (config define 0 hashtags)`);
  }

  for (const f of FRASES) {
    if (t.includes(f)) problems.push(`${where}: expressão proibida "${f}"`);
  }

  for (const r of RADICAIS) {
    const re = new RegExp(`(^|[^a-z0-9])${r}[a-z]*`, 'g');
    let m;
    while ((m = re.exec(t))) {
      const hit = m[0].trim();
      const ctx = t.slice(Math.max(0, m.index - 12), m.index + hit.length + 12);
      if (EXCECOES.some((e) => ctx.includes(e))) continue;
      problems.push(`${where}: palavra proibida "${hit}" (radical "${r}")`);
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

  carousel.slides.forEach((s, i) => {
    const where = `slide ${i + 1}`;
    const campos = [s.text, s.label, s.value, ...(s.items || []),
      s.left?.title, s.right?.title, ...(s.left?.items || []), ...(s.right?.items || [])];
    for (const c of campos) {
      if (c) problems.push(...checkText(String(c), where, { noCta: true }));
    }
  });

  if (carousel.caption) {
    // Decisão do Daniel: slides sem CTA, legenda pode fechar com pergunta.
    problems.push(...checkText(carousel.caption, 'legenda', { noCta: false }));
    const palavras = carousel.caption.trim().split(/\s+/).length;
    if (palavras > 45) {
      problems.push(`legenda: ${palavras} palavras (alvo ~30; legenda curta tem maior engajamento)`);
    }
    if (!carousel.caption.includes('?')) {
      problems.push('legenda: sem pergunta de fechamento (pergunta rende +37% em comentários)');
    }
  }

  const n = carousel.slides.length;
  if (n < 2 || n > 10) problems.push(`carrossel com ${n} slides (a Graph API aceita de 2 a 10)`);

  return problems;
}

module.exports = { lint, checkText };
