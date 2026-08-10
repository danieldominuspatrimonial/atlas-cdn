// Atlas Co. — template de slide "print de tweet"
// LEIA CONTEXTO.md na raiz do repositorio antes de mexer neste arquivo.
// Geometria extraída pixel a pixel do Modelo_Carrossel.png enviado pelo Daniel:
//   canvas 1080, margem 108 (10%), avatar 108px, corpo iniciando 129px abaixo do avatar,
//   entrelinha 51px, bloco de imagem com 122px de respiro e cantos arredondados.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const NUNITO = path.join(ROOT, 'node_modules', '@fontsource', 'nunito', 'files');

function face(weight, style = 'normal') {
  const file = path.join(NUNITO, `nunito-latin-${weight}-${style}.woff2`);
  if (!fs.existsSync(file)) return '';
  const b64 = fs.readFileSync(file).toString('base64');
  return `@font-face{font-family:'Nunito';font-style:${style};font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}

const FONTS = [
  face(400), face(500), face(600), face(700), face(800),
  face(400, 'italic'), face(600, 'italic'),
].join('\n');

// Se o pacote da fonte mudar de estrutura, `face()` devolve vazio para todos os
// pesos e o carrossel iria ao ar em system-ui, sem erro nenhum. Melhor quebrar.
if (!FONTS.includes('@font-face')) {
  throw new Error('nenhuma fonte Nunito encontrada em node_modules/@fontsource/nunito/files');
}

const C = {
  bg: '#FFFFFF',
  text: '#0F1419',
  name: '#000000',
  muted: '#536471',
  badge: '#3897F0',
  hairline: 'rgba(15,20,25,.10)',
};

const BADGE = `<svg class="badge" viewBox="0 0 24 24"><path fill="${C.badge}" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"/><path fill="#fff" d="M10.54 16.2 6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36z"/></svg>`;

const ICONS = {
  reply: 'M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.01z',
  repost: 'M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2h6v2h-6c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H10.5V4h6c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z',
  like: 'M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91z',
  save: 'M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z',
  share: 'M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.3 3.3-1.41-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z',
};

function esc(s = '') {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// **negrito** e __negrito__ ; quebras de linha simples viram <br> (uma ideia por linha)
function rich(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<b>$1</b>')
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function dataURL(p, obrigatorio = false) {
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
  if (!fs.existsSync(abs)) {
    // Uma foto declarada que nao existe precisa QUEBRAR. Antes ela sumia do
    // slide sem aviso: o carrossel ia ao ar com um vazio enorme, porque o lint
    // tinha aplicado o limite apertado de caracteres de slide com foto.
    if (obrigatorio) throw new Error(`imagem declarada nao existe: ${p}`);
    return null;
  }
  const ext = (path.extname(abs).slice(1) || 'jpeg').toLowerCase().replace('jpg', 'jpeg');
  return `data:image/${ext};base64,${fs.readFileSync(abs).toString('base64')}`;
}

function avatarEl(author) {
  const src = author.avatar ? dataURL(author.avatar) : null;
  if (src) return `<div class="avatar" style="background-image:url(${src})"></div>`;
  const ini = (author.name || 'D').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return `<div class="avatar avatar--ini">${ini}</div>`;
}

function engagementBar(slide) {
  if (!slide.engagement) return '';
  const n = slide.engagement === true ? {} : slide.engagement;
  const item = (k, v) =>
    `<div class="eng__i"><svg viewBox="0 0 24 24"><path d="${ICONS[k]}"/></svg>${v ? `<span>${esc(v)}</span>` : ''}</div>`;
  return `<div class="eng">
    ${item('reply', n.reply)}${item('repost', n.repost)}${item('like', n.like)}${item('save', n.save)}${item('share', n.share)}
  </div>`;
}

function body(slide) {
  switch (slide.type) {
    case 'stat':
      return `<div class="stat"><div class="stat__v">${esc(slide.value)}</div><div class="stat__l">${rich(slide.label || '')}</div></div>`;
    case 'list':
      return `<div class="txt">${slide.text ? rich(slide.text) : ''}</div>
        <ul class="list">${(slide.items || []).map((i) => `<li>${rich(i)}</li>`).join('')}</ul>`;
    default:
      return `<div class="txt">${rich(slide.text || '')}</div>`;
  }
}

function buildHTML(carousel, slide, index) {
  const a = carousel.author || {};
  const H = carousel.aspect === '4:5' ? 1350 : 1080;
  const img = slide.image ? dataURL(slide.image, true) : null;
  const isLast = index === carousel.slides.length - 1;
  const swipe = !isLast && slide.swipe !== false && carousel.swipe !== false;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:${H}px}
body{background:${C.bg};font-family:'Nunito',system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  padding:108px;display:flex;flex-direction:column}
.head{display:flex;align-items:center;gap:22px;flex:0 0 auto}
.avatar{width:108px;height:108px;border-radius:50%;background-size:cover;background-position:center;
  box-shadow:0 0 0 2px rgba(15,20,25,.08);flex:0 0 auto}
.avatar--ini{background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:42px}
.who{display:flex;flex-direction:column;gap:2px;min-width:0}
.name{display:flex;align-items:center;gap:10px;color:${C.name};font-weight:800;font-size:40px;letter-spacing:-.4px;line-height:1.15}
.badge{width:34px;height:34px;flex:0 0 auto}
.handle{color:${C.muted};font-size:33px;font-style:italic;font-weight:400;line-height:1.2}
.main{flex:1 1 auto;display:flex;flex-direction:column;justify-content:flex-start;padding-top:129px}
/* No 4:5 todo o bloco fica opticamente centrado, com ou sem foto, para que a
   posicao do texto nao mude de um slide para o outro. */
/* RESPIRO MINIMO entre o cabecalho (nome e @) e o texto: 100px, sempre.
   Como o bloco e centralizado dentro do que sobra depois desse padding, a
   distancia nunca fica menor que isso, tenha foto ou nao. */
.main--center{justify-content:center;padding-top:100px;padding-bottom:4%}
.txt{color:${C.text};font-weight:400;letter-spacing:-.2px}
.txt p+p{margin-top:.85em}
.txt b{font-weight:800}
/* Tamanho ÚNICO em todos os slides. Não existe variação por slide, nem redução
   automática: se o texto não couber, o render falha e o texto é encurtado. */
.txt{font-size:${H > 1080 ? 48 : 44}px;line-height:1.22}
.list{list-style:none;margin-top:.85em;display:flex;flex-direction:column;gap:.5em;
  color:${C.text};font-size:${H > 1080 ? 48 : 44}px;line-height:1.22;font-weight:400}
.list li{padding-left:0}
.stat__v{font-size:150px;font-weight:800;color:${C.text};letter-spacing:-6px;line-height:.95}
.stat__l{margin-top:24px;font-size:${H > 1080 ? 48 : 44}px;line-height:1.22;color:${C.text}}
.shot{margin-top:92px;width:100%;border-radius:26px;overflow:hidden;background:#eee;flex:0 0 auto}
/* A foto e a primeira a ceder espaco: altura limitada para que o respiro do
   cabecalho e a margem inferior nunca sejam comprimidos. */
.shot img{width:100%;display:block;object-fit:cover;max-height:${H === 1350 ? 470 : 360}px}
.eng{margin-top:64px;display:flex;justify-content:space-between;align-items:center;
  padding-top:34px;border-top:2px solid ${C.hairline};flex:0 0 auto}
.eng__i{display:flex;align-items:center;gap:12px;color:${C.muted};font-size:28px}
.eng__i svg{width:38px;height:38px;fill:${C.muted}}
.foot{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;
  color:${C.muted};font-size:28px;font-weight:600;flex:0 0 auto;padding-top:40px}
.pips{display:flex;gap:9px;align-items:center}
.pip{width:11px;height:11px;border-radius:50%;background:${C.muted};opacity:.28}
.pip.on{opacity:1;width:30px;border-radius:6px}
</style></head><body>
  <div class="head">
    ${avatarEl(a)}
    <div class="who">
      <div class="name">${esc(a.name || 'Daniel Carvalho')}${a.verified === false ? '' : BADGE}</div>
      <div class="handle">@${esc(a.handle || 'soudanielcarvalho')}</div>
    </div>
  </div>
  <div class="main${H > 1080 ? ' main--center' : ''}">
    ${body(slide)}
    ${img ? `<div class="shot"><img src="${img}"></div>` : ''}
    ${engagementBar(slide)}
  </div>
  ${
    carousel.pips === false && !swipe
      ? ''
      : `<div class="foot">
          ${carousel.pips === false ? '<span></span>' : `<div class="pips">${carousel.slides.map((_, i) => `<span class="pip${i === index ? ' on' : ''}"></span>`).join('')}</div>`}
          <div>${swipe ? '&rsaquo;&rsaquo;' : esc(carousel.footer || '')}</div>
        </div>`
  }
</body></html>`;
}

module.exports = { buildHTML, C };
