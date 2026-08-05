#!/usr/bin/env node
// Uso: node render/render.js content/<arquivo>.json
// Saída: out/<slug>/01.jpg ... NN.jpg  (1080x1350, JPEG — formato exigido pela Graph API)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { buildHTML } = require('./template');
const { lint } = require('./lint');

const W = 1080;

(async () => {
  const input = process.argv[2];
  if (!input) {
    console.error('Uso: node render/render.js content/<arquivo>.json');
    process.exit(1);
  }

  const carousel = JSON.parse(fs.readFileSync(input, 'utf8'));
  const slug = carousel.slug || path.basename(input, '.json');
  const outDir = path.join(__dirname, '..', 'out', slug);
  fs.mkdirSync(outDir, { recursive: true });

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

  const H = carousel.aspect === '4:5' ? 1350 : 1080;

  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
    args: ['--font-render-hinting=none', '--disable-lcd-text'],
  });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();

  const files = [];
  for (let i = 0; i < carousel.slides.length; i++) {
    const html = buildHTML(carousel, carousel.slides[i], i);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    // Ajuste automático: reduz a tipografia até o conteúdo caber na área segura.
    await page.evaluate(() => {
      const main = document.querySelector('.main');
      const txt = main.querySelector('.txt');
      if (!txt) return;
      const fits = () => document.body.scrollHeight <= document.body.clientHeight + 1;
      let size = parseFloat(getComputedStyle(txt).fontSize);
      let guard = 0;
      while (!fits() && size > 26 && guard++ < 40) {
        size -= 2;
        txt.style.fontSize = size + 'px';
        const list = main.querySelector('.list');
        if (list) list.style.fontSize = size + 'px';
      }
    });
    const file = path.join(outDir, String(i + 1).padStart(2, '0') + '.jpg');
    await page.screenshot({
      path: file,
      type: 'jpeg',
      quality: 92,
      clip: { x: 0, y: 0, width: W, height: H },
    });
    const kb = (fs.statSync(file).size / 1024).toFixed(0);
    console.log(`  ✓ ${path.basename(file)}  ${kb} KB`);
    files.push(file);
  }

  await browser.close();

  fs.writeFileSync(
    path.join(outDir, 'meta.json'),
    JSON.stringify(
      { slug, caption: carousel.caption || '', files: files.map((f) => path.basename(f)), generated_at: new Date().toISOString() },
      null,
      2
    )
  );
  console.log(`\n${files.length} slides em out/${slug}/`);
})();
