# Atlas Co. — Agente de Carrosséis · Documento de Contexto

**Leia este arquivo inteiro antes de tocar em qualquer coisa.** Ele existe para você não precisar reconstruir o sistema lendo código. Última revisão: 06/ago/2026.

---

## 1. O QUE ESTE SISTEMA É

Um agente que escreve, diagrama, publica e aprende com carrosséis no Instagram de **Daniel Carvalho (@soudanielcarvalho)**, gestor de patrimônio, fundador da Atlas Co. / Dominus Patrimonial.

O formato visual imita um post do Twitter/X. O texto é sempre autoral do Daniel, nunca reproduzido de terceiros.

**Publicação:** 2 por dia, 12h e 21h de Brasília, automática.
**Criação e aprendizado:** semanal, toda segunda-feira, por você.

### O que o Daniel faz e o que você faz

| | Quem |
|---|---|
| Escrever os carrosséis | você |
| Ler a performance e tirar conclusões | você |
| Renderizar e validar | você (ou o GitHub Actions) |
| Publicar no horário | GitHub Actions, sozinho |
| Dar `git push` da fila nova | **Daniel**, uma vez por semana |

Você **não consegue** dar push. O ambiente onde você roda bloqueia envio autenticado ao GitHub. Você grava os arquivos na pasta do Mac dele e ele executa um comando. Isso não tem contorno; não perca tempo tentando.

---

## 2. ARQUITETURA — onde cada coisa roda

| Etapa | Onde | Por quê |
|---|---|---|
| Escrever o conteúdo | você, na sessão | precisa de julgamento |
| Validar linguagem | `render/lint.js` | regra mecânica, não opinião |
| Renderizar os slides | `render/render.js` + Playwright | local, sem rede |
| Hospedar as imagens | o próprio repositório GitHub | a Meta exige URL pública |
| Publicar | `publish/publish.js` + Meta Graph API | roda no GitHub Actions |
| Ler performance | Windsor.ai (MCP) | métricas por post |
| Benchmark de concorrentes | Apify (MCP) | Windsor só lê a conta do Daniel |

**Repositório:** `https://github.com/danieldominuspatrimonial/atlas-cdn`
**Cópia local do Daniel:** `/Users/danielcarvalho/Downloads/atlas-cdn`
**O repositório precisa ser PÚBLICO.** As imagens são servidas por `raw.githubusercontent.com`; se ficar privado, a Meta não consegue baixá-las e toda publicação falha.

---

## 3. MAPA DOS ARQUIVOS

```
atlas-cdn/
├── CONTEXTO.md              ← este arquivo
├── SETUP.md                 ← como o ambiente foi montado (histórico)
├── config.json              ← RETRATO das decisões. Nenhum código lê. Documentação.
├── content/NNN-slug.json    ← A FILA. Um arquivo = um carrossel a publicar.
├── publicados/              ← histórico do que já foi ao ar
├── carrosseis/<slug>/       ← imagens hospedadas + published.json (marcador)
├── docs/privacidade.html    ← política de privacidade do app Meta (GitHub Pages)
├── render/
│   ├── lint.js              ← validador de linguagem. O guardião.
│   ├── template.js          ← o design do card. Toda a estética mora aqui.
│   ├── render.js            ← JSON → JPEG 1440x1800
│   └── assets/              ← fotos do Daniel, já recortadas
│       ├── indice.json      ← o que cada foto serve
│       └── originais/       ← fotos brutas, IGNORADAS pelo git (545 MB)
├── publish/publish.js       ← hospeda + publica + confere
└── .github/workflows/
    ├── publicar.yml         ← 4 disparos por dia
    └── renovar-token.yml    ← DESATIVADO (o token não expira)
```

**`config.json` é documentação, não configuração.** Nenhum script o lê. Quem manda é o workflow, o `lint.js` e o `render.js`. Se mudar um, mude o outro.

---

## 4. A VOZ — "Crença Escrita"

Esta é a parte mais importante do documento. O formato vem de um prompt escrito pelo próprio Daniel e a decisão dele foi aplicá-lo **integralmente, sem exceção**.

### 4.1. O que o formato faz

Não fala sobre nicho. Fala sobre **dor**. A função é expor uma crença que a maioria aceita sem questionar, atacar um inimigo em comum — o sistema, o Estado, a mentalidade coletiva, a hipocrisia social — e terminar com um corte seco.

### 4.2. Estrutura de cada slide

1. **Abertura factual ou numérica** — dado, comparação ou cena concreta
2. **Contraste ou virada** — o "enquanto isso", o "mesmo assim"
3. **Consequência ou generalização** — a frase que transforma o fato em verdade maior
4. **Fecho de impacto** — pergunta retórica, frase seca, constatação sem margem

Variações aceitas: lista curta, fecho em pergunta, aforismo de duas ou três linhas quando a ideia se sustenta sozinha.

### 4.3. Regras mecânicas, checadas por código

- Ideias separadas por **quebra de linha**, não por pontuação
- **Travessão proibido** em qualquer hipótese
- **Metáfora proibida** — linguagem literal e cotidiana sempre
- Nunca genérico: cada frase carrega um fato, uma dor específica ou uma constatação concreta
- Sem emoji, sem hashtag, **sem CTA nos slides**
- Todo número precisa ser verificado antes de entrar. Sem verificação, sem número.

### 4.4. Palavras proibidas

A lista completa está em `render/lint.js`, na constante `PALAVRAS`. São ~200 formas explícitas. O render **falha** se alguma passar.

Amostra do que barra: prisão, escravo, jogo, peso, planejamento, juros, moeda, operacional, clareza, escassez, medo, culpa, ilusão, digital, aposta, luxo, armadilha, refém, migalha, networking, expertise, contracheque, genuína, escalar, compra, fogo, gritar, brilhar, adiar.

**Isso vale inclusive para os conceitos-âncora antigos da marca.** "Prisão de ouro" e "renda escrava" estão banidos do conteúdo público. Eles seguem válidos em palestra, conversa de venda e material de cliente — só não vão para o feed.

O validador casa **palavra inteira**, não prefixo. Então `compreensão`, `aposentadoria`, `adiantamento`, `comprovante` e `pesquisa` passam limpos. Se precisar acrescentar uma proibição, adicione a forma exata na lista, nunca um radical.

### 4.5. Vocabulário que funciona

**Usar** (o ICP reconhece como par): holding patrimonial, integralização de bens, ITCMD, ITBI, lucro presumido, pró-labore, distribuição de lucros, sucessão, governança, acordo de sócios, geração de caixa, múltiplo de saída, alocação de capital, family office.

**Evitar** (soa varejo e queima autoridade): "ficar rico", "dica de ouro", "método infalível", "você sabia que", "liberdade financeira" solto sem número, tom de descoberta ingênua sobre assunto básico.

---

## 5. O ICP — para quem você escreve

Empresário brasileiro que fatura acima de R$ 100 mil por mês. Construiu a empresa com esforço próprio. Tem faturamento alto e patrimônio desorganizado. Trabalha demais, não consegue se afastar do negócio, e desconfia que está fazendo algo errado com o dinheiro sem saber o quê.

Ele não quer aula. Ele quer ser reconhecido. O carrossel funciona quando ele lê e pensa "isso é sobre mim" antes de qualquer argumento aparecer.

**Teste do envio:** ele mandaria isso para o sócio ou para o contador? Se não, não gera *send*, e *send* é a métrica que importa.

---

## 6. MIX DE TEMAS — 85% dor ampla, 15% estrutura

Decisão do Daniel em 05/ago/2026, alinhada aos perfis de referência.

**Dor ampla (85%)** — puxa alcance:
carga tributária e o que o Estado devolve, quem produz sustenta quem não produz, esforço não reconhecido, valores invertidos, aparência versus patrimônio real, provedor e família, Brasil versus outros países, mentalidade do brasileiro diante de dinheiro e risco.

**Estrutura patrimonial (15%)** — qualifica e converte:
tributo sobre aluguel PF versus estrutura societária, pró-labore versus distribuição, sucessão e inventário, fluxo PJ-PF, empresa como ativo único.

**Risco a vigiar toda semana:** dor ampla atrai gente fora do ICP. O sinal de alerta é seguidores crescendo enquanto `media_profile_visits` cai. Se aparecer, aumente a fatia de estrutura patrimonial e registre a decisão.

---

## 7. COMPLIANCE CVM — inegociável

Daniel é gestor de patrimônio. Isso **aumenta** a exposição regulatória do conteúdo público, não reduz.

A Resolução CVM 20/2021 avalia habitualidade, remuneração e linguagem de profissional. A própria CVM já declarou que disclaimer de "isto não é recomendação" **não protege** — ela avalia a conduta real. O Art. 27-E da Lei 6.385/76 tipifica atuação sem registro como crime, com reclusão de 6 meses a 2 anos, ainda que a título gratuito.

**Território seguro:** tributo, estrutura societária, sucessão, fluxo PJ-PF, governança, crítica ao sistema tributário, dados macro públicos descrevendo o fenômeno.

**Território proibido:**
- Nomear ativo com juízo de compra ou venda. A filosofia pessoal do Daniel (VOO, QQQ, NVDA, META, AMZN, mínimo 10% em BTC e ouro) é para dentro da Implementação, **nunca para o feed**
- Criptoativo por nome com recomendação
- Promessa ou projeção de rentabilidade
- Recomendação personalizada em canal público

**Regra prática:** falar de estrutura e mecanismo, nunca de ticker e alocação. Se um slide puder ser lido como "compre isso", reescreva.

---

## 8. A ESTÉTICA

Toda a estética vive em `render/template.js`. A geometria foi extraída pixel a pixel do modelo que o Daniel aprovou.

### 8.1. Especificação visual

| Elemento | Valor |
|---|---|
| Canvas | 1440×1800 (4:5) — renderiza em 2160 e reduz com Lanczos |
| Fundo | branco puro `#FFFFFF` |
| Margem | 108px de cada lado (10% do design de 1080) |
| Avatar | 108px, circular, foto real em preto e branco |
| Nome | Nunito 800, preto, 40px |
| Selo | azul `#3897F0` (o azul do Instagram, não o do Twitter) |
| @handle | Nunito 400 **itálico**, `#536471`, 33px |
| Corpo | Nunito 400, **48px, entrelinha 1,22**, `#0F1419` |
| Foto opcional | largura total, cantos 26px, altura máxima 470px |
| Arquivo | JPEG qualidade 95, **sem subamostragem de cor (4:4:4)** |

### 8.2. Regras estéticas que não se negociam

**Tamanho de letra único em todos os slides.** Não existe campo para variar por slide, e não existe redução automática. Se o texto não couber, o render **falha** e diz quantos caracteres cortar. O texto é reescrito, nunca espremido. O Daniel pediu isso explicitamente.

**Respiro mínimo de 100px** entre o cabeçalho e a primeira linha de texto, sempre, com foto ou sem. Quem cede espaço é a foto, nunca o respiro.

**Bloco opticamente centrado** na vertical. A posição do texto não muda de um slide para outro.

**No máximo uma foto por carrossel**, sempre num slide de frase curta (máximo 180 caracteres), e alguns carrosséis não levam foto nenhuma. Slide denso de números não leva foto: a imagem rouba o espaço de que o texto precisa.

**4:4:4 na compressão.** Em foto ninguém nota; em texto preto sobre branco, é exatamente onde mora a definição da borda da letra.

### 8.3. Banco de fotos

Em `render/assets/`, já recortadas em 2400×1600. O `indice.json` descreve cada uma.

| Registro | Arquivos |
|---|---|
| Autoridade sóbria | `terno-bw`, `corredor-bw`, `terno-azul` |
| Mentoria e reunião | `banco-tijolo`, `mesa-serio`, `mesa-perfil`, `escuta`, `explicando` |
| Palco | `palco-proposito`, `palco-bw`, `plateia` |
| Retrato próximo | `retrato-sorriso`, `oculos-firme`, `detalhe-oculos` |
| Família | `casal-campo` |

**Uma foto declarada que não existe faz o render falhar.** Isso é intencional: antes ela sumia do slide em silêncio e o carrossel ia ao ar com um vazio enorme.

As originais estão em `render/assets/originais/`, ignoradas pelo git. Há 35 arquivos `.HEIC` que não abrem no ambiente e ficaram de fora.

---

## 9. ANATOMIA DE UM CARROSSEL

```jsonc
{
  "slug": "sem-prefixo-numerico",     // só [a-z0-9-]. Vira o nome da pasta de saída.
  "aspect": "4:5",
  "pips": false,
  "swipe": false,
  "author": {
    "name": "Daniel Carvalho",
    "handle": "soudanielcarvalho",
    "avatar": "render/assets/avatar.jpg",
    "verified": true
  },
  "_registro": "anotação livre: registro do tema, números a conferir",
  "slides": [
    { "type": "tweet", "text": "Uma ideia por linha\n\nParágrafo novo com linha dupla" },
    { "type": "tweet", "text": "Frase curta", "image": "render/assets/terno-bw.jpg" },
    { "type": "tweet", "text": "Fecho", "engagement": {"reply":"","repost":"","like":"","save":"","share":""} }
  ],
  "caption": "~30 palavras. Sem hashtag. Fecha com pergunta real."
}
```

**Armadilha do nome do arquivo:** o arquivo se chama `007-o-preco-de-tudo-subiu.json`, mas o `slug` dentro dele é `o-preco-de-tudo-subiu`, **sem o prefixo**. O prefixo controla a ordem da fila; o slug define a pasta de saída. Confundir os dois já quebrou a publicação uma vez.

**Tipos de slide:** `tweet` (padrão), `list` (com `items[]`), `stat` (com `value` e `label`).
**Sintaxe:** `**texto**` e `__texto__` viram negrito.
**Orçamento:** 430 caracteres por slide, ou 180 se o slide tiver foto.
**Barra de engajamento:** só no último slide, com valores vazios.

---

## 10. A LEGENDA

- Alvo de **~30 palavras**
- Primeira linha repete a tese, não introduz
- Fecha com **pergunta real**. Nada de "comenta aí", "salva esse", "segue"
- **Zero hashtag**
- Nunca pedir curtida, nunca escassez, nunca promessa de retorno

O validador reprova legenda ausente, acima de 45 palavras, acima de 2200 caracteres, ou sem ponto de interrogação.

---

## 11. O QUE OS DADOS JÁ DIZEM

Medido, não opinado. Fontes ao final.

- **Métrica norte: sends per reach.** Mosseri declarou publicamente que é o indicador que ele olharia.
- **Carrossel ganha segunda chance no slide 2.** Se o usuário não arrasta, o Instagram frequentemente reexibe começando pela segunda mídia. **O slide 2 precisa funcionar sozinho como capa.**
- **Conteúdo não-original é penalizado** em fotos e carrosséis desde 30/abr/2026. Crédito ao autor não conta como edição substantiva. Por isso o texto é sempre autoral.
- **Hashtag virou passivo.** Limite caiu para 5 e posts com ao menos uma tiveram 31,7% menos views.
- **CTA medido:** pedir comentário +203%, pedir save +92%, pergunta na legenda +37%, pedir curtida **−4,9%**.
- **Legenda curta ganha.** Abaixo de 30 palavras tem a maior taxa de engajamento.
- **Janela de 3 dias.** 76% das views acontecem nos 3 primeiros dias. Leitura de performance só a partir do D+3.

### Linha de base da conta (05/ago/2026)

| Indicador | Valor |
|---|---|
| Seguidores | 2.431 |
| Alcance mediano por post | ~200 (8,2% da base) |
| Saves medianos | 0 |
| Shares medianos | 0 |
| Sends per reach | ~0,3% |

Antes deste agente, a conta publicava ~2 Reels por dia e **zero carrosséis**.

---

## 12. O CICLO SEMANAL — o que você faz toda segunda

1. Ler este documento e `claude/Atlas_Co_Agente_Carrossel_Cerebro.md` no Project
2. Puxar a performance no Windsor (conector `instagram`, `media_type = CAROUSEL_ALBUM`)
3. Calcular `sends_per_reach` e `saves_per_reach` de cada carrossel
4. Rodar o benchmark no Apify sobre `@umantoniodasilva`, `@bruno_perini`, `@thiago.nigro` — extrair gramática de hook dos posts acima da mediana de cada perfil. **Nunca copiar texto.**
5. Reescrever o registro de aprendizado no Project, no formato "hipótese testada → dado → decisão"
6. Escrever **14 carrosséis novos** (uma semana a 2 por dia)
7. Rodar `node render/render.js content/<arquivo>.json` em cada um e corrigir o que o validador reprovar
8. Gravar na pasta do Mac e entregar ao Daniel o resumo + a linha de push

---

## 13. ARMADILHAS APRENDIDAS NA MARRA

Cada item aqui custou tempo real. Não repita.

**A pasta montada do Mac não permite apagar arquivos.** `rm` falha com "Operation not permitted". Para sobrescrever, use `cat conteudo > arquivo`. Para "apagar", mova para uma pasta ignorada.

**Nunca rode comandos `git` na pasta do Mac pela ponte.** O git cria um `.git/index.lock` que o ambiente não consegue remover, e o Daniel fica travado até apagar à mão. Leitura de arquivo é segura; git não é.

**A ordem do git é: `add`, `commit`, `pull --rebase`, `push`.** O pull recusa rodar com arquivo modificado pendente. Essa inversão travou o Daniel quatro vezes.

**O próprio agente commita no repositório.** As imagens são hospedadas via commit. Então o Daniel quase sempre precisa de `git pull --rebase` antes de qualquer push.

**Não use `container:` no workflow.** Foi testado: das execuções 9 a 11, nenhuma recebeu máquina, ficaram presas em "queued" para sempre. As 8 anteriores, sem container, todas iniciaram.

**O agendamento do GitHub não é confiável.** Disparos podem atrasar ou ser descartados, e o minuto `:00` é o mais concorrido. Por isso são 4 disparos por dia, nenhum no minuto zero, com guarda anti-duplicação.

**Publicar é irreversível; arquivar pode falhar.** Por isso existe o marcador `carrosseis/<slug>/published.json`. Ele prova que o slug já foi ao ar e impede republicação mesmo se o arquivamento falhar. A guarda por tempo sozinha não cobre as 9h entre os dois horários.

**O ambiente do Claude não alcança a Meta, o Apify nem o Pexels.** Só `api.github.com` passa, e sem autenticação. Por isso a publicação roda no GitHub Actions.

**Números precisam ser verificados.** O slide 1 do primeiro carrossel dizia "até o fim de maio" por aproximação; o dado real do IBPT é 150 dias, até 30 de maio. Verifique antes, sempre.

---

## 14. CREDENCIAIS E IDENTIFICADORES

| Item | Valor |
|---|---|
| Instagram | @soudanielcarvalho |
| IG User ID | `17841474007579365` |
| Meta App ID | `1622496486176260` |
| Token | Usuário do Sistema, **não expira** |
| Segredos no GitHub | `IG_USER_ID`, `IG_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET` |
| Drive (banco de imagens) | pasta `Conteúdos Instagram / Banco de imagens` |

O workflow `renovar-token.yml` está **desativado** e deve continuar assim: o token do Usuário do Sistema não tem prazo.

---

## 15. LIMITES TÉCNICOS DA META

| Limite | Valor |
|---|---|
| Itens por carrossel | 2 a 10 |
| Formato | JPEG apenas |
| Tamanho por imagem | ≤ 8 MB |
| Aspect ratio | 4:5 a 1.91:1 |
| Largura máxima | 1440px |
| Legenda | 2200 caracteres |
| Posts por 24h via API | 100 |
| App Review | **não é necessário** para publicar na própria conta |

---

## 16. AS SEIS CONFERÊNCIAS ANTES DE PUBLICAR

O `publish.js` roda tudo isto e aborta se qualquer uma falhar:

1. A pasta tem **exatamente** os arquivos declarados pelo render, sem sobra
2. A numeração vai de 01 até N, sem buraco e sem repetição
3. Cada imagem tem a mesma impressão digital de quando foi renderizada
4. O arquivo de conteúdo não foi editado depois do render
5. A legenda do `meta.json` é idêntica à do arquivo de conteúdo
6. A legenda cabe no limite e não tem hashtag nem emoji

Antes de subir qualquer imagem, ele imprime no log a sequência exata que vai ao ar, com a primeira linha de cada slide e a legenda inteira. É a conferência visual humana.

---

## FONTES

- Mosseri sobre sends per reach — [davidzucker.substack.com](https://davidzucker.substack.com/p/the-most-important-metric-on-instagram)
- Mosseri sobre o re-serve do carrossel — [tech.yahoo.com](https://tech.yahoo.com/social-media/articles/why-instagram-carousels-sometimes-start-200811893.html)
- Penalização de conteúdo não-original (30/abr/2026) — [engadget.com](https://www.engadget.com/2160560/instagrams-recommendation-algorithm-will-penalize-unoriginal-photo-and-carousel-posts/)
- Metricool, 24,3M posts — [metricool.com](https://metricool.com/instagram-trends/)
- Buffer, 2,1M posts — [buffer.com](https://buffer.com/resources/how-often-to-post-on-instagram/)
- Graph API, publicação de carrossel — [developers.facebook.com](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- Resolução CVM 20/2021 — [conteudo.cvm.gov.br](https://conteudo.cvm.gov.br/legislacao/resolucoes/resol020.html)
- CVM sobre influenciadores — [gov.br/cvm](https://www.gov.br/cvm/pt-br/assuntos/noticias/2020/area-tecnica-da-cvm-esclarece-duvidas-sobre-atuacao-de-influenciadores-que-recomendam-investimentos-dddc1973876d4cc78c734b8ceeaaa740)
- IBPT, 150 dias de tributo em 2026 — [contabeis.com.br](https://www.contabeis.com.br/noticias/77195/brasileiro-trabalhou-150-dias-para-pagar-impostos-em-2026/)
