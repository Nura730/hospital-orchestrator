// Checks src/ml/outlook.js against Python (tests/fixtures/outlook_parity.json, written by
// ml/scripts/export_js_models.py --outlook). Run from frontend/:  node tests/outlookParity.mjs
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const vite = await createServer({ root, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
try {
  const o = await vite.ssrLoadModule('/src/ml/outlook.js');
  await o.loadOutlookModels();
  const cases = JSON.parse(fs.readFileSync(new URL('./fixtures/outlook_parity.json', import.meta.url), 'utf8'));
  let max = 0;
  let n = 0;
  for (const c of cases) {
    const got = o.predictOutlook(c.departments, new Date(c.at));
    if (got.length !== c.departments.length) throw new Error(`Expected ${c.departments.length} departments, got ${got.length}`);
    for (const [key, model] of o.OUTLOOK_HORIZONS) {
      for (const g of got) {
        max = Math.max(max, Math.abs(g[key] - Math.max(0, c.expected[model][g.department])));
        n++;
      }
    }
  }
  const pass = max < 1e-9;
  console.log(`outlook parity: ${n} predictions, max abs diff ${max.toExponential(2)} ${pass ? 'PASS' : 'FAIL'}`);
  process.exitCode = pass ? 0 : 1;
} finally {
  await vite.close();
}
