/**
 * @file lightgbm.js
 * Minimal LightGBM tree-ensemble evaluator for models exported by ml/scripts/export_js_models.py.
 * Follows LightGBM's own decision rules (NumericalDecision / CategoricalDecision) so results match
 * Python to floating-point precision (see tests/ml.icuNeed.test.js).
 *
 * Node layout: [feature, threshold|categoryCodes, kind(0 num,1 cat), defaultLeft, missingType, left, right, internalValue]
 * missingType: 0 None, 1 Zero, 2 NaN. Child < 0 is a leaf: index ~child.
 */

const MISSING_ZERO = 1;
const MISSING_NAN = 2;
const K_ZERO = 1e-35;

function nextNode(node, x) {
  const [feature, threshold, kind, defaultLeft, missingType, left, right] = node;
  let v = x[feature];
  if (kind === 1) {
    // Categorical: NaN or negative code goes right; otherwise left if the code is in the split set
    if (v === null || v === undefined || Number.isNaN(v)) return right;
    const code = Math.trunc(v);
    if (code < 0) return right;
    return threshold.includes(code) ? left : right;
  }
  if ((v === null || v === undefined || Number.isNaN(v)) && missingType !== MISSING_NAN) v = 0;
  if ((missingType === MISSING_ZERO && Math.abs(v) <= K_ZERO) || (missingType === MISSING_NAN && Number.isNaN(v))) {
    return defaultLeft ? left : right;
  }
  return v <= threshold ? left : right;
}

/** Raw score (sum of leaf values) for one encoded feature vector. */
function rawScore(model, x) {
  let sum = 0;
  for (const tree of model.trees) {
    let i = 0;
    if (!tree.nodes.length) {
      sum += tree.leaves[0];
      continue;
    }
    while (i >= 0) i = nextNode(tree.nodes[i], x);
    sum += tree.leaves[~i];
  }
  return sum;
}

/**
 * Per-feature contributions to the raw score (Saabas path attribution): for each split on the path,
 * the change in node value is credited to the split feature. bias + sum(contrib) === rawScore.
 */
function contributions(model, x) {
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

function transform(model, raw) {
  if (model.objective === 'binary') return 1 / (1 + Math.exp(-model.sigmoid * raw));
  return model.targetTransform === 'log1p' ? Math.expm1(raw) : raw;
}

/** Encode a categorical value the way pandas does: String(value), unknown -> NaN. */
function categoryCode(model, feature, value) {
  const cats = model.categories[feature];
  const key = value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value)) ? 'nan' : String(value);
  const idx = cats.indexOf(key);
  return idx === -1 ? NaN : idx;
}

module.exports = { rawScore, contributions, transform, categoryCode };
