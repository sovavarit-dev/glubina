#!/bin/bash
# Выкладка приложения «Карта Глубины» в оба бакета. Запускать в Yandex Cloud Shell: bash deploy.sh
# Секретов здесь нет: авторские тексты лежат в закрытом бакете, их этот скрипт не трогает.
set -e
B1=karta-glubiny-app; B2=kartaglubiny.ru
cd /tmp && rm -rf glubina && git clone -q --depth 1 https://github.com/sovavarit-dev/glubina && cd glubina/karta
ct() { case "$1" in *.html) echo "text/html; charset=utf-8";; *.css) echo "text/css; charset=utf-8";; *.js) echo "application/javascript; charset=utf-8";;
  *.webmanifest) echo "application/manifest+json";; *.json) echo "application/json";; *.jpg|*.jpeg) echo image/jpeg;; *.png) echo image/png;;
  *.webp) echo image/webp;; *.svg) echo "image/svg+xml";; *.mp3) echo audio/mpeg;; *.mp4) echo video/mp4;; *.woff2) echo font/woff2;; *) echo application/octet-stream;; esac; }
# index.html, config, loader, manifest — всегда свежие; остальное подключается с ?v= и кэшируется
cc() { case "$1" in index.html|*.webmanifest|config.js|loader.js) echo "no-cache";; *.js|*.css) echo "public, max-age=604800";; *) echo "public, max-age=2592000";; esac; }
export -f ct cc
up() { f="$1"; for b in $B1 $B2; do yc storage s3 cp "$f" "s3://$b/$f" --content-type "$(ct "$f")" --cache-control "$(cc "$f")" >/dev/null || echo "FAIL $b/$f"; done; }
export -f up; export B1 B2
git ls-files | grep -v -E '\.(md|sh)$' | grep -v '^index.html$' | xargs -P 8 -I{} bash -c 'up "$@"' _ {}
up index.html
echo "APP_OK $(git log -1 --format=%h)"
