#!/usr/bin/env node
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

const GRAPH = 'https://graph.facebook.com/v26.0';
const MAX_ITENS = 10;
const MAX_MB = 8;

function env(chave) {
  const v = process.env[chave];
  if (!v) {
    console.error(`ERRO: variável de ambiente ${chave} não definida.`);
    process.exit(1);
  }
  return v;
}

function morre(msg) {
  console.error(`\nERRO: ${msg}`);
  process.exit(1);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const atual = await fetch(`${api}?ref=${encodeURIComponent(branch)}`, { headers });
  if (atual.status === 200) sha = (await atual.json()).sha;

  const corpo = {
    message: `carrossel: ${caminhoRemoto}`,
    content: fs.readFileSync(arquivoLocal).toString('base64'),
    branch,
  };
  if (sha) corpo.sha = sha;

  const r = await fetch(api, { method: 'PUT', headers, body: JSON.stringify(corpo) });
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
  const r = await fetch(`${GRAPH}/${caminho}`, {
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
    const r = await fetch(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`
    );
    const j = await r.json().catch(() => ({}));
    if (j.status_code === 'FINISHED') return;
    if (j.status_code === 'ERROR') morre(`container ${containerId} falhou: ${j.status}`);
    await espera(4000);
  }
  morre(`tempo esgotado aguardando o container ${containerId}`);
}

async function mostrarCota(igUser, token) {
  try {
    const r = await fetch(
      `${GRAPH}/${igUser}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(token)}`
    );
    const d = (await r.json()).data?.[0];
    if (d) console.log(`  cota de publicação: ${d.quota_usage}/${d.config?.quota_total ?? '?'} nas últimas 24h`);
  } catch {
    /* informativo, não bloqueia */
  }
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

  const imagens = fs
    .readdirSync(pasta)
    .filter((f) => f.endsWith('.jpg'))
    .sort()
    .map((f) => path.join(pasta, f));

  if (imagens.length < 2 || imagens.length > MAX_ITENS) {
    morre(`o carrossel precisa de 2 a ${MAX_ITENS} imagens (encontrei ${imagens.length}).`);
  }
  for (const img of imagens) {
    const mb = fs.statSync(img).size / 1024 / 1024;
    if (mb > MAX_MB) morre(`${path.basename(img)} tem ${mb.toFixed(1)} MB (limite da Meta: ${MAX_MB} MB).`);
  }

  const igUser = env('IG_USER_ID');
  const token = env('IG_ACCESS_TOKEN');

  console.log(`\n${slug} — ${imagens.length} slides`);
  await mostrarCota(igUser, token);

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
    const r = await fetch(`${GRAPH}/${mediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`);
    permalink = (await r.json()).permalink || '';
  } catch {
    /* o post já foi publicado; o link é só conveniência */
  }

  fs.writeFileSync(
    path.join(pasta, 'published.json'),
    JSON.stringify({ media_id: mediaId, permalink, published_at: new Date().toISOString() }, null, 2)
  );
  console.log(`\nPUBLICADO: ${permalink || mediaId}`);
})();
