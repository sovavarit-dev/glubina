set -e
cd /tmp/glubina/tmpv
openssl enc -d -aes-256-cbc -pbkdf2 -in v.enc -pass pass:$1 | tar xf -
put() { for b in karta-glubiny-app kartaglubiny.ru; do yc storage s3 cp "$1" "s3://$b/$2" --content-type audio/mpeg --cache-control "public, max-age=2592000" >/dev/null; done; echo "OK $2"; }
put 55a94c04-___________________.MP3 audio/voice/relax-2.mp3
put f78f9380-____________________.MP3 audio/voice/mysli.mp3
put b4d11763-______.MP3 audio/voice/son.mp3
rm -f *.MP3
yc storage s3 cp s3://karta-glubiny-content/content.json /tmp/c.json >/dev/null
yc storage s3 cp /tmp/c.json s3://karta-glubiny-content/backup/content-2026-11-26.json >/dev/null
python3 - <<'PY'
import json
c=json.load(open('/tmp/c.json'))
S={'relax':('audio/voice/relax-2.mp3',357),'mysli':('audio/voice/mysli.mp3',742),'son':('audio/voice/son.mp3',775)}
for v in c['voices']:
    if v['id'] in S: v['src'],v['dur']=S[v['id']]; v.pop('soon',None)
json.dump(c,open('/tmp/c2.json','w'),ensure_ascii=False)
print('VOICES',[(v['id'],v.get('src'),v.get('dur'),v.get('soon')) for v in c['voices']])
PY
yc storage s3 cp /tmp/c2.json s3://karta-glubiny-content/content.json --content-type "application/json; charset=utf-8" >/dev/null
rm -f /tmp/c.json /tmp/c2.json
echo VOICE_OK
