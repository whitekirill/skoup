#!/usr/bin/env bash
# Lighthouse mobile и desktop для главной, статьи и брифа по собранному dist/.
# Запуск: npm run build && bash tests/lighthouse.sh [outDir]
set -u
OUT=${1:-tests/.lighthouse}
mkdir -p "$OUT"; OUT=$(cd "$OUT" && pwd)
CHROME=${CHROME_PATH:-/opt/pw-browsers/chromium-1194/chrome-linux/chrome}
npx -y serve@14 dist -l 4321 >/dev/null 2>&1 &
SERVER=$!
sleep 4
for page in "home|/" "article|/blog/marketplaces-installments/" "brief|/#brief"; do
  name=${page%%|*}; url=${page#*|}
  for preset in mobile desktop; do
    extra=""; [ "$preset" = desktop ] && extra="--preset=desktop"
    CHROME_PATH=$CHROME timeout 240 npx -y lighthouse@12.8.2 "http://localhost:4321$url" $extra --quiet \
      --chrome-flags="--headless --no-sandbox" --output=json --output-path="$OUT/$name-$preset.json" >/dev/null 2>&1
    node -e "
      const d = require('$OUT/$name-$preset.json'); const c = d.categories, a = d.audits;
      const s = (k) => Math.round(c[k].score * 100);
      console.log('$name $preset'.padEnd(18), 'perf', s('performance'), 'a11y', s('accessibility'), 'bp', s('best-practices'), 'seo', s('seo'),
        'LCP', (a['largest-contentful-paint'].numericValue / 1000).toFixed(2) + 's', 'CLS', a['cumulative-layout-shift'].numericValue.toFixed(3), 'TBT', Math.round(a['total-blocking-time'].numericValue) + 'ms');
    "
  done
done
kill $SERVER
