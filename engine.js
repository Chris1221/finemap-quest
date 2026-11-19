"use strict";
// Simulation and statistics: genotypes with LD, a phenotype, GWAS summary statistics, conditional analysis
const LN10 = Math.log(10);

// ── Random numbers (seeded, so a game can be shared) ─────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNormal(rand) {
  let spare = null;
  return function () {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0; while (u === 0) u = rand();
    const v = rand(), r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

// −log10 of a two-sided normal p-value, accurate far into the tail (log-space erfc)
function nlogp(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * x);
  const logErfc = Math.log(t) - x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))));
  return Math.max(0, -logErfc / LN10);
}

// ── Simulation ───────────────────────────────────────────────────────────────
function simulate(cfg, rand) {
  const normal = makeNormal(rand);
  const m = cfg.variants, n = cfg.samples, s = cfg.ld;

  // LD comes from overlapping haplotype segments (latent factors whose loadings peak at a random position
  // and fade over a random width), plus a chain along the region whose step-to-step correlation varies and
  // sometimes drops at a recombination hotspot. Every variant's loadings are jittered, so the matrix is
  // patchy and decays with distance rather than forming neat blocks.
  // Story worlds can add segments of their own (cfg.extra), e.g. a long haplotype swept up by selection
  const extra = cfg.extra || [];
  const base = Math.max(2, Math.round(m / 5)), F = base + extra.length;
  const Lf = Array.from({ length: m }, () => new Float64Array(F));
  for (let f = 0; f < F; f++) {
    const x = extra[f - base];
    const centre = x ? x.centre : -3 + rand() * (m + 6), width = x ? x.width : 2.5 + rand() * 7, amp = x ? x.amp : 0.4 + 0.6 * rand();
    for (let j = 0; j < m; j++) Lf[j][f] = amp * Math.exp(-0.5 * ((j - centre) / width) ** 2) * (0.75 + 0.25 * rand());
  }
  const rho = new Float64Array(m);
  for (let j = 1; j < m; j++) rho[j] = rand() < 0.1 ? 0.3 * rand() : 0.8 + 0.19 * rand();
  const K = new Float64Array(m), E = new Float64Array(m), sign = new Float64Array(m);
  for (let j = 0; j < m; j++) {
    const shared = Math.min(0.98, s ** 0.4 * (0.8 + 0.2 * rand())); // share of the variant's variance that is LD
    const c = 0.6 + 0.6 * rand();
    let v = c * c;
    for (let f = 0; f < F; f++) v += Lf[j][f] ** 2;
    const scale = Math.sqrt(shared / v);
    for (let f = 0; f < F; f++) Lf[j][f] *= scale;
    K[j] = c * scale; E[j] = Math.sqrt(1 - shared);
    sign[j] = rand() < 0.5 ? -1 : 1; // allele coding, so r can be negative
  }
  const trueR = new Float64Array(m * m);
  for (let j = 0; j < m; j++) {
    trueR[j * m + j] = 1;
    let chain = 1;
    for (let l = j + 1; l < m; l++) {
      chain *= rho[l];
      let c = K[j] * K[l] * chain;
      for (let f = 0; f < F; f++) c += Lf[j][f] * Lf[l][f];
      trueR[j * m + l] = trueR[l * m + j] = sign[j] * sign[l] * c;
    }
  }

  const Z = new Float64Array(m * n); // column-major: Z[j * n + i]
  const fv = new Float64Array(F);
  for (let i = 0; i < n; i++) {
    for (let f = 0; f < F; f++) fv[f] = normal();
    let C = normal();
    for (let j = 0; j < m; j++) {
      if (j > 0) C = rho[j] * C + Math.sqrt(1 - rho[j] * rho[j]) * normal();
      let x = K[j] * C + E[j] * normal();
      const lj = Lf[j];
      for (let f = 0; f < F; f++) x += lj[f] * fv[f];
      Z[j * n + i] = sign[j] * x;
    }
  }

  // Causal variants and phenotype
  // Story worlds fix the causal variants and their effects (signed variance explained)
  let causal, beta;
  if (cfg.causal) {
    causal = cfg.causal.slice();
    beta = cfg.effects.map((e) => Math.sign(e) * Math.sqrt(Math.abs(e)));
  } else {
    const k = cfg.kmin + Math.floor(rand() * (cfg.kmax - cfg.kmin + 1));
    const order = Array.from({ length: m }, (_, j) => j);
    for (let j = m - 1; j > 0; j--) { const r = Math.floor(rand() * (j + 1)); [order[j], order[r]] = [order[r], order[j]]; }
    causal = order.slice(0, k).sort((a, b) => a - b);
    // Each causal variant explains 1–4% of phenotypic variance, so sample size sets how strong signals look
    beta = causal.map(() => Math.sqrt(0.01 + 0.03 * rand()) * (rand() < 0.5 ? -1 : 1));
  }
  const k = causal.length;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let v = normal();
    for (let c = 0; c < k; c++) v += beta[c] * Z[causal[c] * n + i];
    y[i] = v;
  }

  // Summary statistics from the GWAS samples: marginal r with y, and LD estimated from the same samples
  standardise(y, 0, n);
  for (let j = 0; j < m; j++) standardise(Z, j * n, n);
  const ry = new Float64Array(m);
  for (let j = 0; j < m; j++) { let d = 0; for (let i = 0; i < n; i++) d += Z[j * n + i] * y[i]; ry[j] = d / n; }
  const R = new Float64Array(m * m);
  for (let j = 0; j < m; j++) {
    R[j * m + j] = 1;
    for (let l = j + 1; l < m; l++) {
      let d = 0; const oj = j * n, ol = l * n;
      for (let i = 0; i < n; i++) d += Z[oj + i] * Z[ol + i];
      R[j * m + l] = R[l * m + j] = d / n;
    }
  }
  const nlp = Array.from(ry, (r) => nlogp(r * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r))));
  const stepwise = conditional(R, ry, n, m, 0.05 / m);
  return { m, n, causal, beta, nlp, R, trueR, stepwise };
}

function standardise(a, off, n) {
  let mean = 0; for (let i = 0; i < n; i++) mean += a[off + i]; mean /= n;
  let ss = 0; for (let i = 0; i < n; i++) { a[off + i] -= mean; ss += a[off + i] * a[off + i]; }
  const sd = Math.sqrt(ss / n) || 1;
  for (let i = 0; i < n; i++) a[off + i] /= sd;
}

// Stepwise conditional analysis from summary statistics (standardised genotypes and phenotype)
function conditional(R, ry, n, m, alpha) {
  const threshold = -Math.log10(alpha), selected = [];
  while (selected.length < 10) {
    let best = -1, bestNlp = -Infinity;
    for (let j = 0; j < m; j++) {
      if (selected.includes(j)) continue;
      const S = [...selected, j], k = S.length;
      const inv = invert(S.map((a) => S.map((b) => R[a * m + b])));
      if (!inv || inv[k - 1][k - 1] > 20) continue; // too collinear with what's already in
      const v = S.map((a) => ry[a]);
      const b = inv.map((row) => row.reduce((acc, x, i) => acc + x * v[i], 0));
      const sigma2 = Math.max(1e-6, 1 - b.reduce((acc, x, i) => acc + x * v[i], 0));
      const t = b[k - 1] / Math.sqrt(sigma2 * inv[k - 1][k - 1] / (n - k - 1));
      const p = nlogp(t);
      if (p > bestNlp) { bestNlp = p; best = j; }
    }
    if (best < 0 || bestNlp < threshold) break;
    selected.push(best);
  }
  return selected.sort((a, b) => a - b);
}

function invert(M) {
  const k = M.length, A = M.map((row, i) => [...row, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    if (Math.abs(A[p][c]) < 1e-10) return null;
    [A[c], A[p]] = [A[p], A[c]];
    const piv = A[c][c];
    for (let j = 0; j < 2 * k; j++) A[c][j] /= piv;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f) for (let j = 0; j < 2 * k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row) => row.slice(k));
}

function f1(picks, truth) {
  if (!picks.length && !truth.length) return 100;
  const tp = picks.filter((p) => truth.includes(p)).length;
  return Math.round((200 * tp) / (picks.length + truth.length));
}
