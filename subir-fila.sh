#!/bin/bash
# Atlas Co. — sincroniza a pasta local com o GitHub e sobe a fila.
#
# POR QUE ESTE SCRIPT EXISTE
#
# O robô commita sozinho no repositório: ele hospeda as imagens e move os JSONs
# publicados de content/ para publicados/. Então a cópia local fica atrás do
# GitHub o tempo todo. Quando alguém escreve carrosséis novos e roda
# `git pull --rebase`, o git tenta reaplicar por cima de remoções que o robô já
# fez, dá conflito, e o rebase fica travado pela metade. Enquanto ele está
# travado, nada sobe.
#
# Foi exatamente isso em 18/ago/2026: um rebase parou em conflito, ninguém
# percebeu, a fila no GitHub ficou vazia e o sistema passou 13 dias sem publicar,
# com 14 carrosséis prontos parados dentro do conflito.
#
# Este script nunca faz rebase e nunca faz merge. Ele guarda a fila local,
# alinha com o GitHub, devolve a fila e sobe. É idempotente: rodar duas vezes
# não faz mal. Rodar com a fila vazia não apaga nada do GitHub.
#
# Uso:  ./subir-fila.sh  ["mensagem do commit"]

set -euo pipefail
cd "$(dirname "$0")"

MSG="${1:-atualiza a fila}"
GUARDA="$(mktemp -d)"
trap 'rm -rf "$GUARDA"' EXIT

echo "==> 1. guardando a fila local"
mkdir -p content
n=0
for f in content/*.json; do
  [ -e "$f" ] || continue
  cp "$f" "$GUARDA/" && n=$((n+1))
done
echo "    $n carrosséis guardados"

echo "==> 2. desfazendo qualquer operação travada"
# Um comando de git interrompido deixa este arquivo para tras e trava
# todo git seguinte com "Unable to create index.lock: File exists".
rm -f .git/index.lock
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]; then
  echo "    havia um rebase pela metade. Desfazendo."
  git rebase --abort 2>/dev/null || rm -rf .git/rebase-merge .git/rebase-apply
fi
if [ -f .git/MERGE_HEAD ]; then
  echo "    havia um merge pela metade. Desfazendo."
  git merge --abort 2>/dev/null || rm -f .git/MERGE_HEAD
fi
git rm -q --cached -r . >/dev/null 2>&1 || true
git reset -q --hard 2>/dev/null || true

echo "==> 3. alinhando com o GitHub"
git config http.postBuffer 524288000
git fetch origin
git checkout -B main origin/main

echo "==> 4. devolvendo a fila, pulando o que já foi publicado"
mkdir -p content
voltaram=0; pulados=0
for f in "$GUARDA"/*.json; do
  [ -e "$f" ] || continue
  nome=$(basename "$f")
  slug=$(node -p "require('$f').slug || ''" 2>/dev/null || echo "")
  # já publicado? o marcador dentro do repositório é a prova
  if [ -n "$slug" ] && [ -f "carrosseis/$slug/published.json" ]; then
    pulados=$((pulados+1)); continue
  fi
  cp "$f" "content/$nome"; voltaram=$((voltaram+1))
done
echo "    $voltaram de volta na fila, $pulados pulados por já terem ido ao ar"

echo "==> 5. subindo"
git add -A
if git diff --cached --quiet; then
  echo "    nada mudou. Nada a enviar."
else
  git commit -m "$MSG"
  git push origin main
  echo "    enviado."
fi

echo
echo "fila agora: $(ls -1 content/*.json 2>/dev/null | wc -l | tr -d ' ') carrosséis"
