#!/usr/bin/env python3
"""
Renova o token de longa duração do Instagram (válido por 60 dias) e reescreve o .env.
Rode isso semanalmente — o token precisa ter no mínimo 24h de vida e não pode estar expirado.

    python3 publish/refresh_token.py
"""
import os
import pathlib
import re
import sys

import requests

root = pathlib.Path(__file__).resolve().parents[1]
env_path = root / ".env"

if not env_path.exists():
    sys.exit("ERRO: .env não encontrado.")

text = env_path.read_text(encoding="utf-8")
m = re.search(r"^IG_ACCESS_TOKEN\s*=\s*(.+)$", text, re.M)
if not m:
    sys.exit("ERRO: IG_ACCESS_TOKEN não encontrado no .env")

current = m.group(1).strip().strip('"').strip("'")

r = requests.get(
    "https://graph.facebook.com/v26.0/oauth/access_token",
    params={
        "grant_type": "fb_exchange_token",
        "client_id": os.environ.get("META_APP_ID", ""),
        "client_secret": os.environ.get("META_APP_SECRET", ""),
        "fb_exchange_token": current,
    },
    timeout=30,
).json()

new = r.get("access_token")
if not new:
    sys.exit(f"ERRO ao renovar: {r}")

env_path.write_text(re.sub(r"^IG_ACCESS_TOKEN\s*=.*$", f"IG_ACCESS_TOKEN={new}", text, flags=re.M), encoding="utf-8")
print(f"Token renovado. Expira em {r.get('expires_in', '?')} segundos.")
