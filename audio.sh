#!/bin/bash
# Раскладывает аудио из папки tmp/ (загружены вручную) по местам и копирует все аудио в бакет домена.
# Файлы узнаются по размеру. Запуск в Yandex Cloud Shell: bash audio.sh
B1=karta-glubiny-app; B2=kartaglubiny.ru
declare -A MAP=( [7431782]=audio/dive/open-2.mp3 [6157842]=audio/dive/tochka.mp3 [19868157]=audio/pod/anima.mp3
  [19285104]=audio/pod/mana.mp3 [16997614]=audio/pod/self.mp3 [16202655]=audio/pod/zapros-2.mp3
  [19764921]=audio/pod/soprotivlenie.mp3 [17263854]=audio/pod/net-ego.mp3 )
mkdir -p /tmp/au && cd /tmp/au
put() { for b in $B1 $B2; do yc storage s3 cp "$1" "s3://$b/$2" --content-type audio/mpeg --cache-control "public, max-age=2592000" >/dev/null || echo "FAIL $b/$2"; done; }
yc storage s3api list-objects --bucket $B1 --prefix tmp/ --format json | python3 -c 'import json,sys; [print(o["size"], o["key"]) for o in json.load(sys.stdin).get("contents",[])]' > new.txt
n=0; while read -r size key; do t=${MAP[$size]}; [ -z "$t" ] && continue
  yc storage s3 cp "s3://$B1/$key" f.mp3 >/dev/null && put f.mp3 "$t" && echo "OK $t" && n=$((n+1)); done < new.txt
echo "NEW_DONE $n/8"
# остальное аудио — в бакет домена
yc storage s3api list-objects --bucket $B1 --prefix audio/ --format json | python3 -c 'import json,sys; [print(o["key"]) for o in json.load(sys.stdin).get("contents",[])]' > all.txt
while read -r key; do yc storage s3api head-object --bucket $B2 --key "$key" >/dev/null 2>&1 && continue
  yc storage s3 cp "s3://$B1/$key" g.mp3 >/dev/null && yc storage s3 cp g.mp3 "s3://$B2/$key" --content-type audio/mpeg --cache-control "public, max-age=2592000" >/dev/null && echo "COPY $key"; done < all.txt
echo AUDIO_OK
