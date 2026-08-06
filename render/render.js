#!/usr/bin/env node
// Uso: node render/render.js content/<arquivo>.json
// Saída: out/<slug>/01.jpg ... NN.jpg  (1440x1800, JPEG 4:4:4 — formato exigido pela Graph API)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const sharp = require('sharp');
const { buildHTML } = require('./template');
const { lint } = require('./lint');
const crypto = require('crypto');

// Instagram aceita até 1440px de largura. Renderizamos o dobro disso e reduzimos
// com Lanczos: o texto fica com bordas muito mais limpas do que renderizando
// direto no tamanho final. JPEG 4:4:4 (sem subamostragem de cor) preserva a
// nitidez das letras, que é onde a compressão costuma estragar o resultado.
const W_CSS = 1080;          // o design é desenhado em 1080
const ESCALA = 2;            // renderiza em 2160 de largura
const W_FINAL = 1440;        // maior largura que o Instagram aceita
const QUALIDADE = 95;

(async () => {
  const input = process.argv[2];
  if (!input) {
    console.error('Uso: node render/render.js content/<arquivo>.json');
    process.exit(1);
  }

  const carousel = JSON.parse(fs.readFileSync(input, 'utf8'));
  const slug = carousel.slug || path.basename(input, '.json');

  // Slug entra num rmSync recursivo mais abaixo. Sem esta trava, um slug de "."
  // apagaria a pasta out/ inteira, e "../content" apagaria a fila.
  if (!/^[a-z0-9-]+$/.test(slug)) {
    console.error(`\nERRO: slug inválido ("${slug}"). Só letras minúsculas, números e hífen.`);
    process.exitCode = 1;
    return;
  }
  const outDir = path.join(__dirname, '..', 'out', slug);

  const problems = lint(carousel);
  if (problems.length) {
    console.error(`\nREPROVADO no validador (${problems.length}):`);
    problems.forEach((p) => console.error(`  ✗ ${p}`));
    if (!process.argv.includes('--force')) {
      console.error('\nCorrija o conteúdo. Use --force apenas para inspecionar visualmente.');
      process.exit(1);
    }
    console.error('\n--force: renderizando mesmo assim.\n');
  } else {
    console.log('  validador: aprovado');
  }

  // A pasta so e esvaziada agora, depois do validador. Se o lint reprovasse
  // antes, apagar aqui destruiria o render anterior, que estava bom, e voce
  // ficaria sem nada para inspecionar. Sem a limpeza, um carrossel que tinha 8
  // slides e passou a ter 6 deixaria 07.jpg e 08.jpg para tras e o publish
  // mandaria duas imagens da versao antiga junto com as novas.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const H_CSS = carousel.aspect === '4:5' ? 1350 : 1080;
  const H_FINAL = Math.round((W_FINAL / W_CSS) * H_CSS);

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
  });
  const ctx = await browser.newContext({
    viewport: { width: W_CSS, height: H_CSS },
    deviceScaleFactor: ESCALA,
  });
  const page = await ctx.newPage();

  const files = [];
  for (let i = 0; i < carousel.slides.length; i++) {
    const html = buildHTML(carousel, carousel.slides[i], i);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // Sem redução automática: a tipografia é a mesma em todo slide.
    // Se estourar, o render falha e diz quanto precisa ser cortado.
    // Mede a caixa de conteudo (.main) e a entrelinha real. Medir o body dava
    // folga indevida: o texto so acusava estouro depois de invadir os 108px de
    // margem inferior, que e justamente o respiro que a gente quer preservar.
    const { excesso, entrelinha } = await page.evaluate(() => {
      const main = document.querySelector('.main');
      const txt = document.querySelector('.txt') || main;
      const lh = parseFloat(getComputedStyle(txt).lineHeight) || 58;
      return { excesso: Math.max(0, main.scrollHeight - main.clientHeight), entrelinha: lh };
    });
    if (excesso > 1) {
      const linhas = Math.ceil(excesso / entrelinha);
      console.error(
        `\nESTOUROU no slide ${i + 1}: ${excesso}px além da área segura (~${linhas} linha(s)).` +
          `\nCorte cerca de ${linhas * 36} caracteres. A tipografia não é reduzida de propósito,` +
          `\npara que todos os slides tenham exatamente o mesmo tamanho de letra.`
      );
      await browser.close();
      process.exitCode = 1;
      return;
    }
    const file = path.join(outDir, String(i + 1).padStart(2, '0') + '.jpg');
    const png = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: W_CSS, height: H_CSS },
    });
    await sharp(png)
      .resize(W_FINAL, H_FINAL, { kernel: 'lanczos3', fit: 'fill' })
      .jpeg({ quality: QUALIDADE, chromaSubsampling: '4:4:4', mozjpeg: true })
      .toFile(file);
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    console.log(`  ✓ ${path.basename(file)}  ${kb} KB`);
    files.push(file);
  }

  await browser.close();

  // O meta.json e o contrato entre render e publish. Ele guarda a impressao
  // digital do arquivo de origem e de cada imagem, para o publish conseguir
  // provar que esta publicando exatamente o que foi renderizado, na ordem certa.
  const hash = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 16);
  fs.writeFileSync(
    path.join(outDir, 'meta.json'),
    JSON.stringify(
      {
        slug,
        caption: carousel.caption || '',
        origem: path.relative(path.join(__dirname, '..'), path.resolve(input)),
        origem_hash: hash(fs.readFileSync(input)),
        total_slides: carousel.slides.length,
        files: files.map((f, i) => ({
          nome: path.basename(f),
          ordem: i + 1,
          hash: hash(fs.readFileSync(f)),
          // primeira linha do slide, para conferencia humana no log
          previa: (carousel.slides[i].text || carousel.slides[i].value || carousel.slides[i].label || '')
            .split('\n')[0]
            .slice(0, 60),
          // So registra a foto se ela existe mesmo. Antes, um arquivo renomeado
          // sumia do slide em silencio e o meta.json continuava afirmando que
          // a foto estava la, fazendo o log de conferencia mentir.
          foto: carousel.slides[i].image && fs.existsSync(path.join(__dirname, '..', carousel.slides[i].image))
            ? path.basename(carousel.slides[i].image)
            : null,
        })),
        generated_at: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`\n${files.length} slides em out/${slug}/`);
})();
