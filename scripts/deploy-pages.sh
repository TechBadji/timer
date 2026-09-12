#!/bin/sh
# Construit l'application et publie le résultat sur la branche gh-pages,
# servie par GitHub Pages à l'adresse https://techbadji.github.io/timer/.
#
# Ne consomme aucune minute GitHub Actions : tout est construit en local.
# Usage : npm run deploy
set -e

RACINE=$(cd "$(dirname "$0")/.." && pwd)
cd "$RACINE"

DEPOT=$(git remote get-url origin)
REVISION=$(git rev-parse --short HEAD)

echo "→ Construction…"
npm run build

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp -R dist/. "$TMP/"
touch "$TMP/.nojekyll" # GitHub ne doit pas faire passer le site par Jekyll

cd "$TMP"
git init -q -b gh-pages
git add -A
git commit -q -m "build: publication du site Timer (source $REVISION)"
git remote add origin "$DEPOT"

echo "→ Publication sur gh-pages…"
git push -f -q origin gh-pages

echo "✓ En ligne : https://techbadji.github.io/timer/ (propagation : ~1 min)"
