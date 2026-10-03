/**
 * @file lightgbm.js
 * Browser copy of the LightGBM tree evaluator (same rules as backend/src/ml/lightgbm.js, which is
 * parity-tested against Python). Runs models exported by ml/scripts/export_js_models.py.
 */

const MISSING_ZERO = 1;
const MISSING_NAN = 2;
const K_ZERO = 1e-35;

const isMissing = (v) => v === null || v === undefined || Number.isNaN(v);

function nextNode(node, x) {
  const [feature, threshold, kind, defaultLeft, missingType, left, right] = node;
  let v = x[feature];
  if (kind === 1) {
    if (isMissing(v)) return right;
    const code = Math.trunc(v);
    if (code < 0) return right;
    return threshold.includes(code) ? left : right;
  }
  if (isMissing(v) && missingType !== MISSING_NAN) v = 0;
  if ((missingType === MISSING_ZERO && Math.abs(v) <= K_ZERO) || (missingType === MISSING_NAN && Number.isNaN(v))) {
    return defaultLeft ? left : right;
  }
  return v <= threshold ? left : right;
}

export function rawScore(model, x) {
  let sum = 0;
  for (const tree of model.trees) {
    if (!tree.nodes.length) {
      sum += tree.leaves[0];
      continue;
    }
    let i = 0;
    while (i >= 0) i = nextNode(tree.nodes[i], x);
    sum += tree.leaves[~i];
  }
  return sum;
}

export function contributions(model, x) {
  const contrib = new Array(model.features.length).fill(0);
  let bias = 0;
  for (const tree of model.trees) {
    if (!tree.nodes.length) {
      bias += tree.leaves[0];
      continue;
    }
    let i = 0;
    bias += tree.nodes[0][7];
    while (i >= 0) {
      const node = tree.nodes[i];
      const next = nextNode(node, x);
      const value = next >= 0 ? tree.nodes[next][7] : tree.leaves[~next];
      contrib[node[0]] += value - node[7];
      i = next;
    }
  }
  return { bias, contrib };
}

export function transform(model, raw) {
  if (model.objective === 'binary') return 1 / (1 + Math.exp(-model.sigmoid * raw));
  return model.targetTransform === 'log1p' ? Math.expm1(raw) : raw;
}

export function categoryCode(model, feature, value) {
  const cats = model.categories[feature];
  const key = value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value)) ? 'nan' : String(value);
  const idx = cats.indexOf(key);
  return idx === -1 ? NaN : idx;
}
