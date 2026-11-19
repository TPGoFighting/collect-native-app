#!/usr/bin/env bash
# Extract Collect data files from the LIVE deployed site and deploy them to ATP.
#
#   bash scripts/deploy-data.sh
#
# Steps:
#   1. Download the live index.html from collect.tpgofighting.top
#      (NEVER extract from a local export — it may be stale).
#   2. Run scripts/extract-data.mjs -> /tmp data files + refresh the repo seed
#      (assets/seed-data) so the APK ships current content.
#   3. rsync to ATP /var/www/collect/data + assets/covers + assets/images.
#   4. chmod -R a+rX (read + directory traversal — plain a+r is NOT enough:
#      nginx runs as www-data and needs +x on the directories).
#   5. Verify the public endpoints return 200 with the right article count.
#
# Does NOT touch nginx. The /data/* no-cache rule still needs TP's approval.
set -euo pipefail
cd "$(dirname "$0")/.."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "== downloading live index.html =="
curl -fsSL -o "$TMP/collect.html" https://collect.tpgofighting.top/
SITE_COUNT="$(grep -o '[0-9]\+ 篇' "$TMP/collect.html" | head -1 || true)"
echo "site says: ${SITE_COUNT:-unknown}"

echo "== extracting =="
node scripts/extract-data.mjs --html "$TMP/collect.html" --out "$TMP/data" --seed assets/seed-data
COUNT="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP/data/articles.json','utf8')).count)")"
echo "extracted articles: $COUNT"

echo "== rsync to ATP =="
ssh -F /home/hatch/.ssh/config atp-ts 'mkdir -p /var/www/collect/data/articles /var/www/collect/assets/covers /var/www/collect/assets/images'
rsync -az -e "ssh -F /home/hatch/.ssh/config" "$TMP/data/articles.json" "$TMP/data/articles/" atp-ts:/var/www/collect/data/
rsync -az -e "ssh -F /home/hatch/.ssh/config" "$TMP/data/assets/covers/" atp-ts:/var/www/collect/assets/covers/
rsync -az -e "ssh -F /home/hatch/.ssh/config" "$TMP/data/assets/images/" atp-ts:/var/www/collect/assets/images/
ssh -F /home/hatch/.ssh/config atp-ts 'chmod -R a+rX /var/www/collect/data /var/www/collect/assets/covers /var/www/collect/assets/images'

echo "== verifying public endpoints =="
V="$(date +%Y%m%d%H)"
PUBLIC_COUNT="$(curl -fsSL "https://collect.tpgofighting.top/data/articles.json?v=$V" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).count))")"
echo "public articles.json count: $PUBLIC_COUNT"
if [ "$PUBLIC_COUNT" != "$COUNT" ]; then
  echo "ERROR: public count ($PUBLIC_COUNT) != extracted count ($COUNT)" >&2
  exit 1
fi
FIRST_ID="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TMP/data/articles.json','utf8')).articles[0].id)")"
curl -fsSL -o /dev/null "https://collect.tpgofighting.top/data/articles/$FIRST_ID.json"
curl -fsSL -o /dev/null "https://collect.tpgofighting.top/assets/covers/$FIRST_ID.webp"
echo "OK: data live, $COUNT articles"
echo "NOTE: assets/seed-data changed — commit it before the next APK build."
