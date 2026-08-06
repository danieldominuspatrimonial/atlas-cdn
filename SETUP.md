# Atlas Co. — Agente de Carrosséis · Guia de instalação

Tudo gratuito. Falta ~20 minutos de trabalho seu.

---

## Onde cada coisa roda (importante)

O ambiente onde o Claude executa código **não tem acesso de rede à Graph API da Meta** (testado: `graph.facebook.com`, `api.apify.com` e `api.pexels.com` estão bloqueados; só `api.github.com` passa). Por isso a publicação roda no **GitHub Actions**, que é gratuito, tem rede aberta e guarda segredos com segurança.

| Etapa | Onde roda |
|---|---|
| Escrever o carrossel | Claude, nesta conversa |
| Validar linguagem e renderizar o preview | Claude (Playwright é local, não precisa de rede) |
| Você aprovar | nesta conversa |
| Commit do JSON aprovado | Claude, via API do GitHub |
| Renderizar, hospedar e publicar | GitHub Actions |
| Renovar o token | GitHub Actions, toda segunda |
| Ler a performance | Claude, via Windsor.ai |

---

## Passo 1 — Token que nunca expira (Usuário do Sistema)

Caminho recomendado. Mais passos agora, zero manutenção depois.

**Pré-requisito:** o app precisa pertencer ao seu Portfólio Empresarial. Em [business.facebook.com/settings](https://business.facebook.com/settings) → **Contas → Aplicativos**, o app `1622496486176260` tem que aparecer na lista. Se não aparecer, clique em **Adicionar → Reivindicar um aplicativo** e informe o ID. Sem isso o token não enxerga o app, e é uma causa provável dos erros anteriores.

1. Em Configurações do Negócio, vá em **Usuários → Usuários do sistema** → **Adicionar**
2. Nome: `atlas-agente`. Função: **Administrador**. Criar
3. Com o usuário selecionado, clique em **Adicionar ativos**:
   - **Aplicativos** → selecione o app → ative **Gerenciar aplicativo (controle total)**
   - **Páginas** → selecione a Página vinculada ao @soudanielcarvalho → **Acesso total**
   - **Contas do Instagram** → selecione @soudanielcarvalho → **Acesso total**
4. Clique em **Gerar novo token**, escolha o app e marque as permissões:
   `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `business_management`
5. Gere e **copie na hora** — o token só aparece uma vez
6. Cole no segredo `IG_ACCESS_TOKEN` do repositório

Esse token não expira. Ele só é invalidado se você remover o usuário do sistema, tirar o app do portfólio ou revogar o acesso à Página. Com ele, o workflow `renovar-token.yml` fica desnecessário e pode ser desativado em Actions.

---

## Passo 1-B — Alternativa: token de 60 dias

Seu token atual é o de curta duração e expira em cerca de 1 hora. Abra este endereço no navegador (já preenchido com o ID e a chave do seu app):

```
https://graph.facebook.com/v26.0/oauth/access_token?grant_type=fb_exchange_token&client_id=1456440823172698&client_secret=SUA_CHAVE_SECRETA&fb_exchange_token=SEU_TOKEN_CURTO
```

A resposta vem assim:

```json
{"access_token":"EAAX...","token_type":"bearer","expires_in":5183944}
```

O valor de `access_token` é o token de 60 dias. `expires_in` de ~5.184.000 segundos confirma que deu certo.

> Se der erro de token expirado, gere um novo curto na [Graph API Explorer](https://developers.facebook.com/tools/explorer/) e repita.

---

## Passo 2 — Repositório (5 min)

1. Crie um repositório **público** chamado `atlas-cdn` (público é necessário: o jsDelivr só serve arquivos de repo público, e a Meta exige URL pública para cada imagem)
2. Suba o conteúdo deste projeto nele
3. Em **Settings → Actions → General → Workflow permissions**, marque **Read and write permissions**

---

## Passo 3 — Segredos (5 min)

Em **Settings → Secrets and variables → Actions → New repository secret**, crie:

| Nome | Valor |
|---|---|
| `IG_USER_ID` | `17841474007579365` |
| `IG_ACCESS_TOKEN` | o token de 60 dias do Passo 1 |
| `META_APP_ID` | `1456440823172698` |
| `META_APP_SECRET` | a chave secreta do app |
| `GH_PAT` | opcional, para renovar o token sozinho (ver abaixo) |

**Sobre o `GH_PAT`:** crie em [Fine-grained tokens](https://github.com/settings/personal-access-tokens/new), com acesso só a este repositório e permissão **Secrets: Read and write**. Sem ele, a renovação do token falha de propósito toda segunda para te avisar que precisa trocar à mão.

Segredo de repositório é criptografado e não aparece em log, nem em repo público. O único cuidado é não aceitar Pull Request de estranho com workflow alterado.

---

## Passo 4 — Chaves restantes (5 min)

| Serviço | Onde pegar | Para quê |
|---|---|---|
| **Pexels** | [pexels.com/api](https://www.pexels.com/api/) | textura e fundo abstrato. 200 req/h, 20k/mês |
| **Apify** | [console.apify.com](https://console.apify.com) → Settings → Integrations → API token | benchmark semanal (~US$5-15/mês) |

Salve os dois também como segredos do repositório (`PEXELS_API_KEY`, `APIFY_TOKEN`).

---

## Como o dia a dia funciona

1. O Claude escreve o carrossel e mostra o preview aqui
2. Você aprova ou pede ajuste
3. O Claude faz commit do JSON em `content/`
4. Às 19h30 o GitHub Actions pega o arquivo mais antigo da fila, valida, renderiza, hospeda e publica
5. O JSON publicado é movido para `publicados/` com a data e o link do post
6. Toda segunda o Claude lê a performance no Windsor e reescreve o placar no documento do Project

Para publicar fora de hora: aba **Actions → Publicar carrossel → Run workflow**. Marque `dry_run` para hospedar e validar sem publicar.

---

## Rodar localmente (opcional)

```bash
npm install
node render/render.js content/<arquivo>.json     # valida e gera os JPEGs 1440x1800
node publish/publish.js out/<slug> --dry-run     # exige rede liberada para a Meta
```

O `.env.example` mostra as variáveis. Nunca comite o `.env`.

---

## Estrutura do projeto

```
atlas-carrossel/
├── config.json                     ← volume/dia, formato, mix de temas, voz, benchmark
├── SETUP.md
├── content/<slug>.json             ← fila: carrosséis aprovados esperando publicação
├── publicados/                     ← histórico com data, media_id e permalink
├── render/
│   ├── lint.js                     ← as ~90 palavras proibidas, travessão, emoji, CTA
│   ├── template.js                 ← o design do print de tweet
│   ├── render.js                   ← valida e exporta JPEG 1080x1350
│   └── assets/avatar.jpg
├── publish/
│   └── publish.js                  ← hospeda no jsDelivr + publica via Graph API
└── .github/workflows/
    ├── publicar.yml                ← diário 19h30 + manual
    └── renovar-token.yml           ← segunda 6h
```

---

## Limites respeitados pelo sistema

| Limite | Valor | Origem |
|---|---|---|
| Itens por carrossel | 2 a 10 | Graph API |
| Formato | JPEG apenas | Graph API |
| Tamanho por imagem | ≤ 8 MB | Graph API |
| Aspect ratio | 4:5 (permitido: 4:5 a 1.91:1) | Graph API |
| Largura | 1440px, o máximo aceito | Graph API |
| Posts por 24h via API | 100 | Graph API, checado antes de publicar |
| App Review | não é necessário | publicação na própria conta usa Standard Access |
| Hashtags | 0 | decisão de performance |
| Palavras proibidas | ~90 | PROMPT Crença Escrita, aplicado por código |
