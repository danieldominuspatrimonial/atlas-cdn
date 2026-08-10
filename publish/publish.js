#!/usr/bin/env node
// LEIA CONTEXTO.md na raiz do repositorio antes de mexer neste arquivo.
/**
 * Atlas Co. — publicação de carrossel no Instagram via Meta Graph API.
 *
 *   node publish/publish.js out/<slug>            publica
 *   node publish/publish.js out/<slug> --dry-run  hospeda e valida, sem publicar
 *
 * Reescrito de Python para Node de propósito: o renderizador já é Node, então
 * o pipeline inteiro passa a ter um runtime só. Isso permite rodar dentro da
 * imagem oficial do Playwright, que já traz o Chromium pronto, e elimina as
 * etapas de instalação que vinham quebrando no GitHub Actions.
 *
 * Usa apenas o que vem no Node 18+ (fetch, Buffer). Nenhuma dependência.
 *
 * Variáveis de ambiente:
 *   IG_USER_ID        id da conta Instagram Business
 *   IG_ACCESS_TOKEN   token do Usuário do Sistema
 *   GH_TOKEN          token com escopo de escrita no repositório
 *   GH_REPO           ex.: danieldominuspatrimonial/atlas-cdn
 *   GH_BRANCH         ex.: main
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GRAPH = 'https://graph.facebook.com/v26.0';
const MAX_ITENS = 10;
const MAX_MB = 8;

function env(chave) {
  const v = process.env[chave];
  if (!v) morre(`variável de ambiente ${chave} não definida.`);
  return v;
}

function morre(msg) {
  // process.exit() nao espera o flush do stdout, e no Actions a saida e um pipe:
  // a propria mensagem de erro podia sumir do log da execucao que falhou.
  process.stderr.write(`\nERRO: ${msg}\n`);
  process.exitCode = 1;
  throw new SaidaControlada();
}
class SaidaControlada extends Error {
  constructor() { super('saida controlada'); this.name = 'SaidaControlada'; }
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// Nenhuma chamada pode ficar pendurada: o grupo de concorrencia e unico, entao
// um fetch travado bloqueia os horarios seguintes do dia inteiro.
const TIMEOUT = 30000;
const buscar = (url, opts = {}) => fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) });

// ------------------------------------------------------------- hospedagem
async function subirParaGitHub(arquivoLocal, caminhoRemoto) {
  const repo = env('GH_REPO');
  const branch = env('GH_BRANCH');
  const token = env('GH_TOKEN');
  const api = `https://api.github.com/repos/${repo}/contents/${caminhoRemoto}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'atlas-agente',
  };

  // Se o arquivo já existe, a API exige o sha da versão anterior.
  let sha = null;
  const atual = await buscar(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (atual.status === 200) sha = (await atual.json()).sha;

  const corpo = {
    message: `carrossel: ${caminhoRemoto}`,
    content: fs.readFileSync(arquivoLocal).toString('base64'),
    branch,
  };
  if (sha) corpo.sha = sha;

  const r = await buscar(api, { method: 'PUT', headers, body: JSON.stringify(corpo) });
  if (r.status !== 200 && r.status !== 201) {
    morre(`upload para o GitHub falhou (${r.status}): ${(await r.text()).slice(0, 400)}`);
  }

  // URL fixada no SHA do commit, servida pelo raw do proprio GitHub.
  //
  // O jsDelivr seria mais rapido, mas ele so busca o arquivo no GitHub na
  // primeira vez que alguem pede, e a Meta pede a imagem segundos depois do
  // commit. Nessa janela o CDN pode responder 404 e a publicacao inteira falha
  // por um motivo que nao tem nada a ver com o conteudo. O raw serve o arquivo
  // no instante em que o commit existe, com o content-type certo, e a Meta so
  // baixa cada imagem uma vez por dia.
  const commitSha = (await r.json()).commit?.sha || branch;
  return `https://raw.githubusercontent.com/${repo}/${commitSha}/${caminhoRemoto}`;
}

// -------------------------------------------------------------- graph api
async function graphPost(caminho, dados) {
  const r = await buscar(`${GRAPH}/${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(dados).toString(),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) morre(`Graph API em /${caminho}: ${JSON.stringify(json).slice(0, 600)}`);
  return json;
}

async function esperarPronto(containerId, token, limiteMs = 180000) {
  const inicio = Date.now();
  while (Date.now() - inicio < limiteMs) {
    const r = await buscar(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    const j = await r.json().catch(() => ({}));
    if (j.error) morre(`Graph API ao checar o container: ${JSON.stringify(j.error).slice(0, 300)}`);
    if (j.status_code === 'FINISHED') return;
    if (j.status_code === 'ERROR') morre(`container ${containerId} falhou: ${j.status}`);
    await espera(4000);
  }
  morre(`tempo esgotado aguardando o container ${containerId}`);
}

async function mostrarCota(igUser, token) {
  try {
    const r = await buscar(
      `${GRAPH}/${igUser}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(token)}`
    );
    const d = (await r.json()).data?.[0];
    if (d) console.log(`  cota de publicação: ${d.quota_usage}/${d.config?.quota_total ?? '?'} nas últimas 24h`);
  } catch {
    /* informativo, não bloqueia */
  }
}

// ------------------------------------------------------------------ guarda
/**
 * O agendamento do GitHub Actions nao e confiavel: a documentacao da propria
 * GitHub avisa que disparos agendados podem atrasar ou ser descartados em
 * periodos de carga, e o minuto :00 e o mais concorrido de todos.
 *
 * A solucao e agendar mais de uma tentativa por horario e tornar a publicacao
 * idempotente: antes de publicar, o agente pergunta a Meta quando foi o ultimo
 * carrossel da conta. Se ja saiu um dentro da janela, ele sai sem fazer nada.
 * Assim a segunda tentativa so age quando a primeira nao aconteceu.
 */
async function jaPublicouRecentemente(igUser, token, horas) {
  try {
    const r = await buscar(
      `${GRAPH}/${igUser}/media?fields=id,timestamp,media_type&limit=25&access_token=${encodeURIComponent(token)}`
    );
    const j = await r.json();
    // Antes isto nao existia: um 429 devolvia {error}, `.data` virava [], e a
    // guarda concluia "pode publicar" logo depois de um post ter saido.
    if (!r.ok || j.error) throw new Error(`HTTP ${r.status} ${JSON.stringify(j.error || {}).slice(0, 200)}`);
    const ultimo = (j.data || []).find((m) => m.media_type === 'CAROUSEL_ALBUM');
    if (!ultimo) return null;
    const horasAtras = (Date.now() - new Date(ultimo.timestamp).getTime()) / 3600000;
    return horasAtras < horas ? { horasAtras, quando: ultimo.timestamp } : null;
  } catch (e) {
    // Falha FECHADO. Numa execucao agendada existe outra tentativa logo depois
    // e mais um horario no mesmo dia; perder um slot custa menos que publicar
    // o mesmo carrossel duas vezes no perfil.
    return { indeterminado: true, motivo: e.message };
  }
}

/**
 * Marcador de publicacao, gravado no proprio repositorio.
 *
 * A guarda por tempo sozinha nao resolve o pior caso: se o post sai as 12h07 e
 * o arquivamento falha, o mesmo JSON continua sendo o primeiro da fila, e as
 * 21h07 a janela de 5h ja expirou. O carrossel iria ao ar de novo, todo dia,
 * ate alguem mexer a mao. O marcador amarra a checagem ao SLUG, nao ao relogio.
 */
async function jaFoiPublicado(slug) {
  const repo = env('GH_REPO');
  const token = env('GH_TOKEN');
  try {
    const r = await buscar(
      `https://api.github.com/repos/${repo}/contents/carrosseis/${slug}/published.json`,
      { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'atlas-agente' } }
    );
    return r.status === 200;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------- conferencia
const hash = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);

/**
 * Dupla validação antes de publicar. Nada sai daqui sem passar por tudo isto:
 *
 *   1. a pasta tem EXATAMENTE os arquivos que o render declarou, sem sobra
 *   2. a numeracao vai de 01 ate N sem buraco e sem repeticao
 *   3. cada imagem tem a mesma impressao digital de quando foi renderizada
 *   4. o arquivo de conteudo nao mudou depois do render
 *   5. a legenda no meta.json e a mesma do arquivo de conteudo
 *   6. a legenda cabe no limite da Meta e nao tem hashtag nem emoji
 *
 * Os itens 1 e 2 existem porque a falha mais provavel e silenciosa: uma imagem
 * de uma versao anterior sobrando na pasta e entrando no carrossel sem aviso.
 */
function conferir(pasta, meta, raiz) {
  const erros = [];
  const declarados = meta.files || [];

  if (!Array.isArray(declarados) || !declarados.length || typeof declarados[0] !== 'object') {
    morre('meta.json em formato antigo. Rode o render de novo antes de publicar.');
  }

  // 1. nada a mais, nada a menos
  const naPasta = fs.readdirSync(pasta).filter((f) => f.endsWith('.jpg')).sort();
  const esperados = declarados.map((d) => d.nome).sort();
  for (const f of naPasta) {
    if (!esperados.includes(f)) erros.push(`${f} está na pasta mas NÃO foi renderizado nesta versão (sobra de um render anterior)`);
  }
  for (const f of esperados) {
    if (!naPasta.includes(f)) erros.push(`${f} foi renderizado mas sumiu da pasta`);
  }

  // 2. sequencia sem buraco
  const ordens = declarados.map((d) => d.ordem).sort((x, y) => x - y);
  ordens.forEach((o, i) => {
    if (o !== i + 1) erros.push(`a numeração dos slides está furada: esperava ${i + 1}, achei ${o}`);
  });
  if (declarados.length !== meta.total_slides) {
    erros.push(`meta.json diz ${meta.total_slides} slides mas lista ${declarados.length} arquivos`);
  }
  if (declarados.length < 2 || declarados.length > MAX_ITENS) {
    erros.push(`o carrossel precisa de 2 a ${MAX_ITENS} imagens (tem ${declarados.length})`);
  }

  // 3. cada imagem e a que foi renderizada, e cabe no limite
  for (const d of declarados) {
    const caminho = path.join(pasta, d.nome);
    if (!fs.existsSync(caminho)) continue;
    const bytes = fs.readFileSync(caminho);
    if (hash(bytes) !== d.hash) erros.push(`${d.nome} foi alterado depois do render`);
    const mb = bytes.length / 1024 / 1024;
    if (mb > MAX_MB) erros.push(`${d.nome} tem ${mb.toFixed(1)} MB (limite da Meta: ${MAX_MB} MB)`);
  }

  // 4 e 5. o conteudo e a legenda nao mudaram depois do render
  if (meta.origem) {
    const origem = path.join(raiz, meta.origem);
    if (!fs.existsSync(origem)) {
      erros.push(`o arquivo de origem ${meta.origem} não existe mais`);
    } else {
      const bruto = fs.readFileSync(origem);
      if (hash(bruto) !== meta.origem_hash) {
        erros.push(`${meta.origem} foi editado DEPOIS do render. Renderize de novo antes de publicar.`);
      }
      const json = JSON.parse(bruto.toString('utf8'));
      if ((json.caption || '') !== (meta.caption || '')) {
        erros.push('a legenda do meta.json não bate com a do arquivo de conteúdo');
      }
      if (json.slides.length !== declarados.length) {
        erros.push(`o conteúdo tem ${json.slides.length} slides mas foram renderizadas ${declarados.length} imagens`);
      }
    }
  }

  // 6. legenda dentro das regras
  const cap = meta.caption || '';
  if (cap.length > 2200) erros.push(`a legenda tem ${cap.length} caracteres (limite da Meta: 2200)`);
  if (/(^|\s)#\w/.test(cap)) erros.push('a legenda tem hashtag (a configuração define zero)');
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(cap)) erros.push('a legenda tem emoji');

  // relatorio legivel: a ordem exata que vai ao ar
  console.log('\n  conferência da sequência:');
  for (const d of declarados.sort((x, y) => x.ordem - y.ordem)) {
    const foto = d.foto ? `  [foto: ${d.foto}]` : '';
    console.log(`    ${String(d.ordem).padStart(2, '0')}. ${d.nome}  "${d.previa}"${foto}`);
  }
  console.log(`\n  legenda (${cap.length} caracteres):`);
  console.log(cap.split('\n').map((l) => `    ${l}`).join('\n'));

  if (erros.length) {
    process.stderr.write(`\nREPROVADO na conferência (${erros.length}):\n`);
    erros.forEach((e) => process.stderr.write(`  ✗ ${e}\n`));
    process.stderr.write('\nNada foi publicado.\n');
    process.exitCode = 1;
    throw new SaidaControlada();
  }
  console.log('\n  conferência: aprovada');

  return declarados.sort((x, y) => x.ordem - y.ordem).map((d) => path.join(pasta, d.nome));
}

// ------------------------------------------------------------------ main
(async () => {
  const raiz = path.join(__dirname, '..');
  const alvo = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');
  if (!alvo) morre('uso: node publish/publish.js out/<slug> [--dry-run]');

  const pasta = path.isAbsolute(alvo) ? alvo : path.join(raiz, alvo);
  if (!fs.existsSync(path.join(pasta, 'meta.json'))) {
    const dirOut = path.join(raiz, 'out');
    const existentes = fs.existsSync(dirOut) ? fs.readdirSync(dirOut).join(', ') : '(out/ nao existe)';
    morre(
      `nao encontrei ${path.join(alvo, 'meta.json')}.\n` +
        `  Pastas que existem em out/: ${existentes}\n` +
        `  Lembrete: o render grava em out/<slug>, e o slug vem de dentro do JSON,\n` +
        `  nao do nome do arquivo (que tem o prefixo numerico da fila).`
    );
  }
  const meta = JSON.parse(fs.readFileSync(path.join(pasta, 'meta.json'), 'utf8'));
  const slug = meta.slug;
  const legenda = meta.caption || '';

  const imagens = conferir(pasta, meta, raiz);

  const igUser = env('IG_USER_ID');
  const token = env('IG_ACCESS_TOKEN');

  console.log(`\n${slug} — ${imagens.length} slides`);
  await mostrarCota(igUser, token);

  // Guarda contra publicacao dupla quando ha mais de uma tentativa agendada.
  const idx = process.argv.indexOf('--pular-se-publicou-em');
  if (idx !== -1 && !dryRun) {
    const janela = Number(process.argv[idx + 1]);
    if (!Number.isFinite(janela) || janela <= 0) {
      morre('--pular-se-publicou-em exige um número de horas, ex.: --pular-se-publicou-em 5');
    }

    // Guarda 1, por conteúdo: este slug já foi ao ar alguma vez?
    if (await jaFoiPublicado(slug)) {
      console.log(`\n  ${slug} já tem marcador de publicação no repositório.`);
      console.log('  Nada publicado. Mova o JSON de content/ para publicados/ para liberar a fila.');
      process.exitCode = 78;
      return;
    }

    // Guarda 2, por tempo: evita post duplo entre tentativa e repescagem.
    const recente = await jaPublicouRecentemente(igUser, token, janela);
    if (recente?.indeterminado) {
      console.log(`\n  não consegui confirmar o último carrossel (${recente.motivo}).`);
      console.log('  Por segurança não publico. A próxima tentativa cobre este horário.');
      process.exitCode = 78;
      return;
    }
    if (recente) {
      console.log(
        `\n  já saiu um carrossel há ${recente.horasAtras.toFixed(1)}h (${recente.quando}).` +
          `\n  Janela de ${janela}h ainda aberta, então esta execução não publica nada.`
      );
      process.exitCode = 78;
      return;
    }
    console.log(`  nenhum carrossel nas últimas ${janela}h, pode publicar`);
  }

  console.log('\n1) hospedando imagens');
  const urls = [];
  for (const img of imagens) {
    const url = await subirParaGitHub(img, `carrosseis/${slug}/${path.basename(img)}`);
    console.log(`   ${path.basename(img)} -> ${url}`);
    urls.push(url);
  }

  if (dryRun) {
    console.log('\n--dry-run: parei antes de publicar. As URLs acima já estão públicas.');
    return;
  }

  console.log('\n2) criando containers filhos');
  const filhos = [];
  for (const url of urls) {
    const res = await graphPost(`${igUser}/media`, {
      image_url: url,
      is_carousel_item: 'true',
      access_token: token,
    });
    filhos.push(res.id);
    console.log(`   container ${res.id}`);
  }

  console.log('\n3) criando o container do carrossel');
  const pai = (
    await graphPost(`${igUser}/media`, {
      media_type: 'CAROUSEL',
      children: filhos.join(','),
      caption: legenda,
      access_token: token,
    })
  ).id;

  console.log('4) aguardando processamento');
  await esperarPronto(pai, token);

  console.log('5) publicando');
  const publicado = await graphPost(`${igUser}/media_publish`, {
    creation_id: pai,
    access_token: token,
  });

  const mediaId = publicado.id;
  let permalink = '';
  try {
    const r = await buscar(`${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`);
    permalink = (await r.json()).permalink || '';
  } catch {
    /* o post já foi publicado; o link é só conveniência */
  }

  const registro = { media_id: mediaId, permalink, published_at: new Date().toISOString() };
  fs.writeFileSync(path.join(pasta, 'published.json'), JSON.stringify(registro, null, 2));

  // Marcador no repositorio. E o que impede a republicacao quando o
  // arquivamento falha depois do post ja ter ido ao ar.
  try {
    const arquivo = path.join(pasta, 'published.json');
    await subirParaGitHub(arquivo, `carrosseis/${slug}/published.json`);
    console.log('  marcador de publicação gravado no repositório');
  } catch (e) {
    console.error(`  AVISO: não consegui gravar o marcador (${e.message}).`);
    console.error('  Mova o JSON de content/ para publicados/ à mão, senão ele pode repetir.');
  }

  console.log(`\nPUBLICADO: ${permalink || mediaId}`);
})().catch((e) => {
  if (e instanceof SaidaControlada) return;      // morre() ja imprimiu e setou o codigo
  process.stderr.write(`\nERRO inesperado: ${e && e.stack ? e.stack : e}\n`);
  process.exitCode = 1;
});
