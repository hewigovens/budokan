#!/bin/sh
# Deploy Budokan Today under workerd. Usage: host/workerd/deploy.sh <ssh-host> (or set BUDOKAN_HOST)
# Installs into ~/budokan for the SSH user and runs it as systemd services.
set -eu
HOST=${1:-${BUDOKAN_HOST:?usage: deploy.sh <ssh-host>}}
cd "$(dirname "$0")/../.."
# Pin workerd to the version wrangler already uses locally, so dev and production run the same runtime.
VERSION=$(sed -n 's/.*"version": "\(.*\)".*/\1/p' node_modules/workerd/package.json)
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT
bun build host/workerd/worker.ts --target=browser --format=esm --outfile "$OUT/worker.js" >/dev/null
cp host/workerd/workerd.capnp host/workerd/budokan.service host/workerd/budokan-refresh.service host/workerd/budokan-refresh.timer "$OUT/"
cp -R public "$OUT/public"
ssh "$HOST" 'rm -rf ~/budokan/next; mkdir -p ~/budokan/data ~/budokan/next'
scp -rq "$OUT"/* "$HOST:budokan/next/"
ssh "$HOST" "bash -s" <<REMOTE
set -euo pipefail
cd ~/budokan
DIR=\$PWD
ARCH=\$(uname -m | sed 's/aarch64/arm64/; s/x86_64/64/')
if [ "\$(cat workerd.version 2>/dev/null)" != "$VERSION" ]; then
  curl -fsSL "https://registry.npmjs.org/@cloudflare/workerd-linux-\$ARCH/-/workerd-linux-\$ARCH-$VERSION.tgz" | tar xz -C next package/bin/workerd
  mv next/package/bin/workerd workerd.new && chmod 755 workerd.new && mv workerd.new workerd && echo "$VERSION" > workerd.version
fi
rm -rf public && mv next/public public
mv next/worker.js next/workerd.capnp .
for u in budokan.service budokan-refresh.service budokan-refresh.timer; do
  sed "s#@DIR@#\$DIR#g; s#@USER@#\$(id -un)#g" next/\$u | sudo tee /etc/systemd/system/\$u >/dev/null
done
sudo systemctl daemon-reload
sudo systemctl enable --now budokan-refresh.timer >/dev/null
sudo systemctl enable budokan.service >/dev/null
sudo systemctl restart budokan.service
sleep 1
curl -fsS -o /dev/null -H "Host: budokan.hewig.dev" http://127.0.0.1:8790/health || curl -sS -H "Host: budokan.hewig.dev" http://127.0.0.1:8790/health
echo "deployed (workerd $VERSION)"
REMOTE
