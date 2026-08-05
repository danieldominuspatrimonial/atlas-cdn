#!/usr/bin/env python3
"""
Atlas Co. — publicação de carrossel no Instagram via Meta Graph API.

Uso:
    python3 publish/publish.py out/<slug>            # publica agora
    python3 publish/publish.py out/<slug> --dry-run  # só hospeda e valida, não publica

Fluxo:
    1. sobe cada JPEG num repo GitHub (host gratuito) e gera URL pública via jsDelivr
    2. cria um container filho por imagem (is_carousel_item=true)
    3. cria o container CAROUSEL com children
    4. aguarda status FINISHED
    5. publica com media_publish

Variáveis de ambiente necessárias (arquivo .env na raiz do projeto):
    IG_USER_ID          id da conta Instagram Business  (já sabemos: 17841474007579365)
    IG_ACCESS_TOKEN     token de longa duração
    GH_TOKEN            personal access token do GitHub com escopo `repo`
    GH_REPO             ex.: soudanielcarvalho/atlas-cdn
    GH_BRANCH           ex.: main
"""

import base64
import json
import os
import pathlib
import sys
import time

import requests

GRAPH = "https://graph.facebook.com/v26.0"
MAX_ITEMS = 10  # limite duro da Graph API para carrossel


def env(key, required=True):
    v = os.environ.get(key)
    if required and not v:
        sys.exit(f"ERRO: variável de ambiente {key} não definida (ver .env)")
    return v


def load_dotenv(path):
    if not os.path.exists(path):
        return
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


# ---------------------------------------------------------------- hospedagem
def upload_to_github(local_path, remote_path):
    """Sobe o arquivo no repo e devolve a URL pública servida pelo jsDelivr."""
    repo, branch, token = env("GH_REPO"), env("GH_BRANCH"), env("GH_TOKEN")
    api = f"https://api.github.com/repos/{repo}/contents/{remote_path}"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}

    sha = None
    head = requests.get(api, headers=headers, params={"ref": branch}, timeout=30)
    if head.status_code == 200:
        sha = head.json().get("sha")

    payload = {
        "message": f"carrossel: {remote_path}",
        "content": base64.b64encode(pathlib.Path(local_path).read_bytes()).decode(),
        "branch": branch,
    }
    if sha:
        payload["sha"] = sha

    r = requests.put(api, headers=headers, json=payload, timeout=60)
    if r.status_code not in (200, 201):
        sys.exit(f"ERRO no upload GitHub ({r.status_code}): {r.text[:400]}")

    # A URL e fixada no SHA do commit, nao no nome do branch.
    # URL por branch (@main) passa pelo cache do jsDelivr e pode devolver o arquivo
    # antigo, ou um 404 cacheado, no momento em que a Meta vai buscar a imagem.
    # URL por SHA e imutavel: sempre resolve para este arquivo exato.
    sha = (r.json().get("commit") or {}).get("sha") or branch
    return f"https://cdn.jsdelivr.net/gh/{repo}@{sha}/{remote_path}"


# ---------------------------------------------------------------- graph api
def graph_post(path, data):
    r = requests.post(f"{GRAPH}/{path}", data=data, timeout=90)
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if r.status_code >= 400:
        sys.exit(f"ERRO Graph API em /{path}: {json.dumps(body, ensure_ascii=False)[:600]}")
    return body


def wait_finished(container_id, token, timeout=180):
    started = time.time()
    while time.time() - started < timeout:
        r = requests.get(
            f"{GRAPH}/{container_id}",
            params={"fields": "status_code,status", "access_token": token},
            timeout=30,
        ).json()
        status = r.get("status_code")
        if status == "FINISHED":
            return True
        if status == "ERROR":
            sys.exit(f"ERRO: container {container_id} falhou -> {r.get('status')}")
        time.sleep(4)
    sys.exit(f"ERRO: timeout aguardando o container {container_id}")


def check_quota(ig_user, token):
    r = requests.get(
        f"{GRAPH}/{ig_user}/content_publishing_limit",
        params={"fields": "quota_usage,config", "access_token": token},
        timeout=30,
    ).json()
    try:
        d = r["data"][0]
        print(f"  cota de publicação: {d.get('quota_usage')}/{d.get('config', {}).get('quota_total', '?')} nas últimas 24h")
    except Exception:
        pass


# ---------------------------------------------------------------- principal
def main():
    root = pathlib.Path(__file__).resolve().parents[1]
    load_dotenv(root / ".env")

    if len(sys.argv) < 2:
        sys.exit("Uso: python3 publish/publish.py out/<slug> [--dry-run]")

    dry = "--dry-run" in sys.argv
    folder = pathlib.Path(sys.argv[1])
    if not folder.is_absolute():
        folder = root / folder

    meta = json.loads((folder / "meta.json").read_text(encoding="utf-8"))
    slug, caption = meta["slug"], meta.get("caption", "")
    images = sorted(folder.glob("*.jpg"))

    if not 2 <= len(images) <= MAX_ITEMS:
        sys.exit(f"ERRO: carrossel precisa de 2 a {MAX_ITEMS} imagens (encontrei {len(images)}).")
    for img in images:
        mb = img.stat().st_size / 1024 / 1024
        if mb > 8:
            sys.exit(f"ERRO: {img.name} tem {mb:.1f} MB (limite da Meta: 8 MB).")

    ig_user = env("IG_USER_ID")
    token = env("IG_ACCESS_TOKEN")

    print(f"\n{slug} — {len(images)} slides")
    check_quota(ig_user, token)

    print("\n1) hospedando imagens")
    urls = []
    for img in images:
        url = upload_to_github(img, f"carrosseis/{slug}/{img.name}")
        print(f"   {img.name} -> {url}")
        urls.append(url)

    if dry:
        print("\n--dry-run: parei antes de publicar. URLs acima já estão públicas.")
        return

    print("\n2) criando containers filhos")
    children = []
    for url in urls:
        res = graph_post(f"{ig_user}/media", {
            "image_url": url,
            "is_carousel_item": "true",
            "access_token": token,
        })
        children.append(res["id"])
        print(f"   container {res['id']}")

    print("\n3) criando container do carrossel")
    parent = graph_post(f"{ig_user}/media", {
        "media_type": "CAROUSEL",
        "children": ",".join(children),
        "caption": caption,
        "access_token": token,
    })["id"]

    print("4) aguardando processamento")
    wait_finished(parent, token)

    print("5) publicando")
    published = graph_post(f"{ig_user}/media_publish", {
        "creation_id": parent,
        "access_token": token,
    })

    media_id = published.get("id")
    permalink = requests.get(
        f"{GRAPH}/{media_id}", params={"fields": "permalink", "access_token": token}, timeout=30
    ).json().get("permalink", "")

    (folder / "published.json").write_text(
        json.dumps({"media_id": media_id, "permalink": permalink, "published_at": time.strftime("%Y-%m-%dT%H:%M:%S%z")}, indent=2),
        encoding="utf-8",
    )
    print(f"\nPUBLICADO: {permalink or media_id}")


if __name__ == "__main__":
    main()
