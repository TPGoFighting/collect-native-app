#!/usr/bin/env bash
# Generate server/assetlinks.json from the RELEASE APK's actual signing certificate.
#
#   ANDROID_HOME=/path/to/sdk bash scripts/make-assetlinks.sh path/to/app-release.apk
#
# The generated file goes to https://collect.tpgofighting.top/.well-known/assetlinks.json
# (Content-Type: application/json). Nothing is uploaded by this script.
set -euo pipefail
cd "$(dirname "$0")/.."
APK="${1:?usage: make-assetlinks.sh <release-apk>}"
command -v apksigner >/dev/null 2>&1 || {
  APKSIGNER="$(find "${ANDROID_HOME:-}" "$HOME/Library/Android/sdk" -name apksigner -type f 2>/dev/null | sort -V | tail -1 || true)"
  [ -n "$APKSIGNER" ] && chmod +x "$APKSIGNER" 2>/dev/null || true
} || APKSIGNER=""
if [ -z "${APKSIGNER:-}" ]; then
  echo "apksigner not found; set ANDROID_HOME and install Android build-tools" >&2
  exit 1
fi
FP="$("$APKSIGNER" verify --print-certs "$APK" | grep 'Signer #1 certificate SHA-256 digest' | awk '{print $NF}')"
[ -n "$FP" ] || { echo "could not read SHA-256 fingerprint" >&2; exit 1; }
node - "$FP" <<'NODE'
const fs = require('fs');
const fp = process.argv[2];
const data = [{
  relation: ['delegate_permission/common.handle_all_urls'],
  target: {
    namespace: 'android_app',
    package_name: 'top.tpgofighting.collect',
    sha256_cert_fingerprints: [fp],
  },
}];
fs.writeFileSync('server/assetlinks.json', JSON.stringify(data, null, 2) + '\n');
console.log('wrote server/assetlinks.json with fingerprint', fp);
NODE
