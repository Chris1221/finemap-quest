"use strict";
const $ = (s) => document.querySelector(s);

const LEVELS = [
  { name: "EASY", n: 10000, stars: 1 },
  { name: "MEDIUM", n: 1000, stars: 2 },
  { name: "HARD", n: 400, stars: 3 },
  { name: "BRUTAL", n: 150, stars: 4 },
];

// ── Sprites ──────────────────────────────────────────────────────────────────
const SNIP_BASE = [
  "..a..........a..",
  "..k..........k..",
  "...k........k...",
  "....kkkkkkkk....",
  "..kkggggggggkk..",
  ".kglggggggggggk.",
  ".kgwwpggggwwpgk.",
  "kggwwpggggwwpggk",
  "kggggggggggggggk",
  null, // mouth rows
  null,
  ".kggggggggggggk.",
  "..kkggggggggkk..",
  "....kkkkkkkk....",
];
const MOUTHS = {
  normal: ["kggggggmmggggggk", "kggggggggggggggk"],
  happy: ["kggggmggggmggggk", "kgggggmmmmgggggk"],
  sad: ["kgggggmmmmgggggk", "kggggmggggmggggk"],
  wow: ["kgggggmmmmgggggk", "kgggggmmmmgggggk"],
};
const SNIP_COLORS = { k: "#1d1a2f", g: "#36c9a6", l: "#a8f5e0", w: "#ffffff", p: "#1d1a2f", m: "#1d1a2f", a: "#ffc83d" };
const BOT = [
  "....kkkk....",
  "....kaak....",
  ".....kk.....",
  ".kkkkkkkkkk.",
  ".kssssssssk.",
  ".ksrsssrssk.",
  ".kssssssssk.",
  ".ksmmmmmmsk.",
  ".kssssssssk.",
  ".kkkkkkkkkk.",
  "..kk....kk..",
  "..kk....kk..",
];
const BOT_COLORS = { k: "#1d1a2f", a: "#ff4f6d", s: "#a68cff", r: "#ff4f6d", m: "#e6e3ff" };
const COIN = ["..kkkk..", ".kyyyyk.", "kyywyyyk", "kywyyyyk", "kyyyyyok", "kyyyyyok", ".kyoook.", "..kkkk.."];
const COIN_COLORS = { k: "#1d1a2f", y: "#ffc83d", w: "#fff6c8", o: "#c98a00" };

function paint(canvas, rows, colors) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) { ctx.fillStyle = colors[ch]; ctx.fillRect(x, y, 1, 1); }
  }));
}
function snip(canvas, mood = "normal") {
  const rows = SNIP_BASE.slice();
  rows[9] = MOUTHS[mood][0]; rows[10] = MOUTHS[mood][1];
  paint(canvas, rows, SNIP_COLORS);
}
document.querySelectorAll("canvas.coin").forEach((c) => paint(c, COIN, COIN_COLORS));
snip($("#hero-snip"), "happy");
paint($("#res-bot"), BOT, BOT_COLORS);

// ── Sound: short square-wave blips, made on the fly ──────────────────────────
let audio = null;
let muted = false;
try { muted = localStorage.getItem("fmq-muted") === "1"; } catch {}
function tone(freq, start, dur, type = "square", vol = 0.06) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime + start, o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
const sfx = {
  pick: () => { tone(660, 0, 0.07); tone(990, 0.05, 0.08); },
  unpick: () => { tone(520, 0, 0.07); tone(330, 0.05, 0.08); },
  lock: () => { tone(392, 0, 0.08); tone(523, 0.08, 0.08); tone(659, 0.16, 0.12); },
  coin: (i) => tone(1046 + 60 * (i % 6), 0, 0.06, "square", 0.04),
  great: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.12)),
  meh: () => [440, 392, 440].forEach((f, i) => tone(f, i * 0.12, 0.12)),
  bad: () => { tone(196, 0, 0.18, "sawtooth", 0.05); tone(147, 0.18, 0.3, "sawtooth", 0.05); },
  start: () => [392, 523, 659, 784, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.09)),
  end: () => [523, 523, 659, 784, 0, 659, 784, 1046].forEach((f, i) => f && tone(f, i * 0.12, 0.16)),
};
function setMuted(v) {
  muted = v;
  try { localStorage.setItem("fmq-muted", v ? "1" : "0"); } catch {}
  $("#mute").textContent = v ? "SOUND OFF" : "SOUND ON";
  $("#mute").setAttribute("aria-pressed", v ? "true" : "false");
}
setMuted(muted);

// ── Options and URL ──────────────────────────────────────────────────────────
const inputs = { variants: $("#s-variants"), kmin: $("#s-kmin"), kmax: $("#s-kmax"), ld: $("#s-ld"), rounds: $("#s-rounds") };
let level = 1;
function buildLevels() {
  $("#levels").innerHTML = LEVELS.map((l, i) =>
    `<button type="button" class="btn level" role="radio" aria-checked="${i === level}" data-i="${i}">` +
    `<span class="stars">${"★".repeat(l.stars)}</span><br>${l.name}<small>N = ${l.n.toLocaleString()}</small></button>`).join("");
  $("#levels").querySelectorAll(".level").forEach((b) => b.addEventListener("click", () => { level = +b.dataset.i; buildLevels(); sfx.pick(); showHigh(); }));
}
function readSettings() {
  return {
    variants: +inputs.variants.value, kmin: +inputs.kmin.value, kmax: +inputs.kmax.value, ld: +inputs.ld.value,
    samples: LEVELS[level].n, level: LEVELS[level].name, rounds: +inputs.rounds.value,
  };
}
function showSettings() {
  $("#o-variants").textContent = inputs.variants.value;
  $("#o-kmin").textContent = inputs.kmin.value;
  $("#o-kmax").textContent = inputs.kmax.value;
  $("#o-ld").textContent = (+inputs.ld.value).toFixed(2);
  $("#o-rounds").textContent = inputs.rounds.value;
}
inputs.kmin.addEventListener("input", () => { if (+inputs.kmin.value > +inputs.kmax.value) inputs.kmax.value = inputs.kmin.value; });
inputs.kmax.addEventListener("input", () => { if (+inputs.kmax.value < +inputs.kmin.value) inputs.kmin.value = inputs.kmax.value; });
Object.values(inputs).forEach((el) => el.addEventListener("input", showSettings));

const params = new URLSearchParams(location.search);
const fromUrl = { variants: "v", kmin: "kmin", kmax: "kmax", ld: "ld", rounds: "rounds" };
for (const [key, p] of Object.entries(fromUrl)) if (params.has(p)) inputs[key].value = params.get(p);
if (params.has("n")) { const i = LEVELS.findIndex((l) => l.n === +params.get("n")); if (i >= 0) level = i; }
let seed = params.has("seed") ? parseInt(params.get("seed"), 10) >>> 0 : null;
if (seed !== null) $("#seed-note").textContent = `Game code ${seed}: everyone with this link plays the same worlds.`;
buildLevels(); showSettings();

function gameUrl(cfg, s) {
  const q = new URLSearchParams({ v: cfg.variants, kmin: cfg.kmin, kmax: cfg.kmax, ld: cfg.ld, n: cfg.samples, rounds: cfg.rounds, seed: s });
  return `${location.origin}${location.pathname}?${q}`;
}

// High scores, per difficulty, in this browser only
function highKey(name) { return `fmq-high-${name}`; }
function getHigh(name) { try { return +(localStorage.getItem(highKey(name)) || 0); } catch { return 0; } }
function setHigh(name, v) { try { localStorage.setItem(highKey(name), String(v)); } catch {} }
function showHigh() {
  const h = getHigh(LEVELS[level].name);
  $("#hi-score").textContent = h ? `HI-SCORE ${String(h).padStart(4, "0")}` : "";
}
showHigh();

// ── Game state ───────────────────────────────────────────────────────────────
const game = { cfg: null, seed: 0, rand: null, index: 0, history: [], cur: null, picks: new Set(), revealed: false, hover: null, heatHover: null };
const pad = (v) => String(v).padStart(4, "0");
const names = (ids) => ids.map((j) => `v${j + 1}`).join(", ");
const total = (key) => game.history.reduce((a, r) => a + r[key], 0);

function show(id) { ["#title", "#game", "#results"].forEach((s) => $(s).classList.toggle("hidden", s !== id)); scrollTo(0, 0); }

function startGame() {
  game.cfg = readSettings();
  game.seed = seed ?? Math.floor(Math.random() * 1e9);
  seed = null; // "Play again" makes a new game unless a link fixed the code
  game.rand = mulberry32(game.seed);
  game.index = 0; game.history = [];
  history.replaceState(null, "", gameUrl(game.cfg, game.seed));
  sfx.start();
  show("#game");
  newRound();
}

function newRound() {
  game.cur = simulate(game.cfg, game.rand);
  game.picks = new Set(); game.revealed = false; game.hover = null; game.heatHover = null;
  $("#reveal").classList.add("hidden");
  $("#actions").classList.remove("hidden");
  $("#true-ld").checked = false; $("#true-ld-wrap").classList.add("hidden");
  $("#hud-world").textContent = `1-${game.index + 1}`;
  $("#hud-coins").textContent = pad(total("score"));
  $("#hud-bot").textContent = pad(total("stepScore"));
  $("#hud-level").textContent = game.cfg.level;
  snip($("#game-snip"), "normal");
  const k = game.cfg.kmin === game.cfg.kmax ? `${game.cfg.kmin}` : `${game.cfg.kmin} to ${game.cfg.kmax}`;
  say(`World 1-${game.index + 1}! There ${k === "1" ? "is 1 causal variant" : `are ${k} causal variants`} hiding here. Plant a flag on each one: click a peak, or a block below. Hover to see LD.`);
  buildBlocks();
  render();
}

function say(text) { $("#say").textContent = text; }

function togglePick(j) {
  if (game.revealed) return;
  if (game.picks.has(j)) { game.picks.delete(j); sfx.unpick(); } else { game.picks.add(j); sfx.pick(); }
  render();
}

function submit() {
  const picks = [...game.picks].sort((a, b) => a - b), cur = game.cur;
  const score = f1(picks, cur.causal), stepScore = f1(cur.stepwise, cur.causal);
  game.history.push({ causal: cur.causal, picks, score, stepwise: cur.stepwise, stepScore });
  game.revealed = true;
  sfx.lock();

  const found = picks.filter((p) => cur.causal.includes(p)).length, wrong = picks.length - found;
  const banner = score === 100 ? "PERFECT!" : score >= 67 ? "GREAT!" : score >= 40 ? "NOT BAD!" : score > 0 ? "SO CLOSE..." : "OOF!";
  $("#banner").textContent = banner;
  $("#banner").classList.remove("pop"); void $("#banner").offsetWidth; $("#banner").classList.add("pop");
  snip($("#res-snip"), score >= 67 ? "happy" : score >= 40 ? "normal" : "sad");
  snip($("#game-snip"), score >= 67 ? "happy" : score >= 40 ? "wow" : "sad");
  $("#vs-bot").textContent = stepScore;
  countUp($("#vs-you"), score, () => {
    if (score >= 67) sfx.great(); else if (score >= 40) sfx.meh(); else sfx.bad();
  });
  $("#reveal-truth").textContent =
    `${cur.causal.length === 1 ? "The causal variant was" : `The ${cur.causal.length} causal variants were`} ${names(cur.causal)}. ` +
    `You found ${found} of ${cur.causal.length}` + (wrong ? `, and ${wrong} of your flags ${wrong === 1 ? "was on a bystander" : "were on bystanders"}.` : ".");
  $("#reveal-step").textContent = cur.stepwise.length
    ? `STEP-BOT picked ${names(cur.stepwise)} for ${stepScore} coins.`
    : `STEP-BOT found nothing significant: 0 coins.`;
  say(score > stepScore ? "You beat STEP-BOT this world!" : score === stepScore ? "A tie with STEP-BOT!" : "STEP-BOT wins this one. Conditioning helps!");
  $("#next").textContent = game.index + 1 < game.cfg.rounds ? "NEXT WORLD ▶" : "FINISH ▶";
  $("#reveal").classList.remove("hidden");
  $("#actions").classList.add("hidden");
  $("#true-ld-wrap").classList.remove("hidden");
  $("#hud-coins").textContent = pad(total("score"));
  $("#hud-bot").textContent = pad(total("stepScore"));
  render();
  $("#reveal").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function countUp(el, to, done) {
  let v = 0, i = 0;
  const step = Math.max(1, Math.round(to / 12));
  if (to === 0) { el.textContent = "0"; done(); return; }
  const timer = setInterval(() => {
    v = Math.min(to, v + step); el.textContent = v; sfx.coin(i++);
    if (v >= to) { clearInterval(timer); done(); }
  }, 45);
}

function next() {
  game.index++;
  if (game.index < game.cfg.rounds) { newRound(); scrollTo({ top: 0, behavior: "smooth" }); } else showResults();
}

function showResults() {
  show("#results");
  const you = total("score"), bot = total("stepScore"), max = game.history.length * 100, frac = you / max;
  $("#end-head").textContent = you >= bot ? "COURSE CLEAR!" : "GAME OVER?";
  $("#final-score").textContent = `${pad(you)} / ${max}`;
  $("#final-title").textContent = frac >= 0.9 ? "RANK: HUMAN SuSiE" : frac >= 0.7 ? "RANK: CERTIFIED FINE-MAPPER"
    : frac >= 0.5 ? "RANK: LEAD-SNP ENTHUSIAST" : frac >= 0.3 ? "RANK: PEAK PICKER" : "RANK: LD'S LATEST VICTIM";
  $("#final-compare").textContent = you > bot ? `You beat STEP-BOT by ${you - bot} coins!`
    : you === bot ? `A dead heat with STEP-BOT at ${bot} coins.` : `STEP-BOT collected ${bot} coins, ${bot - you} more than you.`;
  const prev = getHigh(game.cfg.level);
  if (you > prev) { setHigh(game.cfg.level, you); $("#final-hi").textContent = `NEW HI-SCORE ON ${game.cfg.level}!`; }
  else $("#final-hi").textContent = `HI-SCORE ON ${game.cfg.level}: ${pad(prev)}`;
  snip($("#end-snip"), you >= bot ? "happy" : "sad");
  $("#results-body").innerHTML = game.history.map((r, i) =>
    `<tr><td>1-${i + 1}</td><td>${names(r.causal)}</td><td>${names(r.picks) || "none"}</td><td class="num">${r.score}</td>` +
    `<td>${names(r.stepwise) || "none"}</td><td class="num">${r.stepScore}</td></tr>`).join("");
  $("#tot-you").textContent = you; $("#tot-step").textContent = bot;
  sfx.end();
}

// ── Drawing ──────────────────────────────────────────────────────────────────
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const SVG = "http://www.w3.org/2000/svg";
const W = 640, H = 380, M = { l: 52, r: 16, t: 34, b: 50 };

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVG, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function niceStep(max, target) {
  const raw = max / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
const ldBin = (r2) => (r2 >= 0.8 ? 4 : r2 >= 0.6 ? 3 : r2 >= 0.4 ? 2 : r2 >= 0.2 ? 1 : 0);
// Draw a pixel pattern centred on (cx, cy)
function pixels(g, rows, colors, cx, cy, px) {
  const w = rows[0].length * px, h = rows.length * px;
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (colors[ch]) el("rect", { x: cx - w / 2 + x * px, y: cy - h / 2 + y * px, width: px, height: px, fill: colors[ch] }, g);
  }));
}
const STAR = ["...y...", "..yyy..", "yyyyyyy", ".yyyyy.", "..yyy..", ".yy.yy.", "yy...yy"];
const HOLLOW_STAR = ["...y...", "..y.y..", "yy...yy", ".y...y.", "..y.y..", ".y.y.y.", "yy...yy"];
const CROSS = ["x...x", ".x.x.", "..x..", ".x.x.", "x...x"];
const FLAG = ["pff...", "pffff.", "pfffff", "pffff.", "pff...", "p.....", "p.....", "p.....", "p....."];
const BOTFACE = ["sssss", "srsrs", "sssss", "smmms"];

function shownLD() { return game.revealed && $("#true-ld").checked ? game.cur.trueR : game.cur.R; }
function updateLdNote() {
  const n = game.cur.n;
  $("#ld-note").textContent = game.revealed && $("#true-ld").checked
    ? "The true LD: what the estimate converges to with unlimited samples."
    : `Estimated from the same ${n.toLocaleString()} samples, so each r is off by up to about 1/√N = ${(1 / Math.sqrt(n)).toFixed(2)}.`;
}

function render() {
  updateLdNote(); drawScatter(); drawHeat(); updateBlocks(); updateLegend();
  $("#submit").textContent = `LOCK IN! (${game.picks.size} ${game.picks.size === 1 ? "FLAG" : "FLAGS"})`;
}

function drawScatter() {
  const svg = $("#scatter"), cur = game.cur, m = cur.m, LD = shownLD();
  svg.replaceChildren();
  const ymaxRaw = Math.max(6, ...cur.nlp) * 1.12;
  const ystep = niceStep(ymaxRaw, 5), ymax = Math.ceil(ymaxRaw / ystep) * ystep;
  const x = (j) => M.l + ((j + 0.5) / m) * (W - M.l - M.r);
  const y = (v) => H - M.b - (v / ymax) * (H - M.t - M.b);

  for (let v = 0; v <= ymax + 1e-9; v += ystep) {
    if (v > 0) el("line", { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), stroke: css("--screen-grid"), "stroke-width": 2, "stroke-dasharray": "4 6" }, svg);
    el("text", { x: M.l - 8, y: y(v) + 5, "text-anchor": "end" }, svg).textContent = +v.toFixed(2);
  }
  el("rect", { x: M.l, y: H - M.b, width: W - M.l - M.r, height: 4, fill: css("--screen-ink-2") }, svg);
  const xstep = Math.max(1, niceStep(m, 10));
  for (let j = 0; j < m; j++) if ((j + 1) % xstep === 0 || j === 0)
    el("text", { x: x(j), y: H - M.b + 22, "text-anchor": "middle" }, svg).textContent = j + 1;
  el("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle", class: "axis-title" }, svg).textContent = "variant (position in the region)";
  el("text", { x: 16, y: (M.t + H - M.b) / 2, "text-anchor": "middle", class: "axis-title", transform: `rotate(-90 16 ${(M.t + H - M.b) / 2})` }, svg).textContent = "−log₁₀ p";

  const lead = game.hover ?? game.heatHover;
  const bins = ["--ld0", "--ld1", "--ld2", "--ld3", "--ld4"].map(css);
  const hitR = Math.max(8, Math.min(16, (W - M.l - M.r) / m / 2));
  const order = Array.from({ length: m }, (_, j) => j);
  if (lead !== null) order.sort((a, b) => LD[lead * m + a] ** 2 - LD[lead * m + b] ** 2);

  for (const j of order) {
    const cx = x(j), cy = y(cur.nlp[j]);
    const g = el("g", {}, svg);
    if (lead === j) {
      el("rect", { x: cx - 7, y: cy - 7, width: 14, height: 14, fill: css("--star"), stroke: css("--screen"), "stroke-width": 2 }, g);
    } else {
      const fill = lead === null ? css("--point") : bins[ldBin(LD[lead * m + j] ** 2)];
      el("rect", { x: cx - 5, y: cy - 5, width: 10, height: 10, fill, stroke: css("--screen"), "stroke-width": 2 }, g);
    }
    markPoint(g, j, cx, cy);
    const hit = el("circle", { cx, cy, r: hitR, fill: "transparent", style: game.revealed ? "" : "cursor:pointer" }, g);
    hit.addEventListener("mouseenter", (e) => { game.hover = j; drawScatter(); drawHeat(); updateLegend(); tipFor(j, e); });
    hit.addEventListener("mousemove", (e) => tipFor(j, e));
    hit.addEventListener("mouseleave", () => { game.hover = null; hideTip(); drawScatter(); drawHeat(); updateLegend(); });
    hit.addEventListener("click", () => togglePick(j));
  }
}

function markPoint(g, j, cx, cy) {
  const cur = game.cur, picked = game.picks.has(j), causal = cur.causal.includes(j);
  if (picked && !game.revealed) { pixels(g, FLAG, { p: css("--screen-ink"), f: css("--flag") }, cx + 6, cy - 22, 3); return; }
  if (!game.revealed) return;
  let label = null;
  if (causal && picked) { pixels(g, STAR, { y: css("--star") }, cx, cy - 22, 3); label = "YES"; }
  else if (causal) { pixels(g, HOLLOW_STAR, { y: css("--star") }, cx, cy - 22, 3); label = "MISSED"; }
  else if (picked) { pixels(g, CROSS, { x: css("--bad") }, cx, cy - 20, 3); label = "NOPE"; }
  if (label) el("text", { x: cx, y: cy - 38, "text-anchor": "middle", class: "mark-label" }, g).textContent = label;
  if (cur.stepwise.includes(j)) pixels(g, BOTFACE, { s: css("--bot"), r: css("--flag"), m: css("--screen") }, cx, cy + 18, 3);
}

function tipFor(j, e) {
  const cur = game.cur;
  let html = `<b>v${j + 1}</b> · −log₁₀ p ${cur.nlp[j].toFixed(1)}`;
  if (game.revealed && cur.causal.includes(j)) html += "<br>★ causal";
  showTip(html, e);
}
function showTip(html, e) {
  const tip = $("#tip"); tip.innerHTML = html; tip.classList.remove("hidden");
  const off = 16, w = tip.offsetWidth, h = tip.offsetHeight;
  let left = e.clientX + off, top = e.clientY + off;
  if (left + w > innerWidth - 8) left = e.clientX - w - off;
  if (top + h > innerHeight - 8) top = e.clientY - h - off;
  tip.style.left = left + "px"; tip.style.top = top + "px";
}
function hideTip() { $("#tip").classList.add("hidden"); }

function updateLegend() {
  const leg = $("#scatter-legend"), lead = game.hover ?? game.heatHover, parts = [];
  if (lead !== null) {
    parts.push(`<span>r² with v${lead + 1}:</span>`);
    ["< 0.2", "0.2–0.4", "0.4–0.6", "0.6–0.8", "≥ 0.8"].forEach((t, i) =>
      parts.push(`<span><span class="sw" style="background:var(--ld${i})"></span>${t}</span>`));
  } else if (game.revealed) {
    parts.push(`<span><span class="sw" style="background:var(--star)"></span>★ causal (YES = you flagged it)</span>`,
      `<span><span class="sw" style="background:var(--bad)"></span>NOPE: a bystander you flagged</span>`,
      `<span><span class="sw" style="background:var(--bot)"></span>STEP-BOT's picks</span>`);
  } else {
    parts.push(`<span><span class="sw" style="background:var(--flag)"></span>your flags</span>`, `<span>Hover over a variant to light up its LD.</span>`);
  }
  leg.innerHTML = parts.join("");
}

// LD heatmap: each cell is a big pixel
function ramp() {
  return ["#15132e", "#1e2a6e", "#2b55c9", "#3c8cff", "#85ceff", "#e0f7ff"].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
}
function rampAt(stops, t) {
  const x = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1), i = Math.floor(x), f = x - i;
  const a = stops[i], b = stops[i + 1];
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}
$("#colorbar").style.background = `linear-gradient(to right, ${Array.from({ length: 11 }, (_, i) => rampAt(ramp(), i / 10)).join(",")})`;

const heat = $("#heat");
const HM = { l: 30, t: 16, b: 24 };
function heatGeom() {
  const size = heat.clientWidth, m = game.cur.m;
  return { size, m, cell: (size - HM.l - 6) / m, ox: HM.l, oy: HM.t };
}
function drawHeat() {
  if (!game.cur || heat.clientWidth === 0) return;
  const dpr = devicePixelRatio || 1, { size, m, cell, ox, oy } = heatGeom();
  heat.width = Math.round(size * dpr); heat.height = Math.round(size * dpr);
  const ctx = heat.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size); ctx.imageSmoothingEnabled = false;
  const stops = ramp(), R = shownLD();
  for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) {
    ctx.fillStyle = rampAt(stops, R[a * m + b] ** 2);
    ctx.fillRect(Math.floor(ox + b * cell), Math.floor(oy + a * cell), Math.ceil(cell), Math.ceil(cell));
  }
  const lead = game.hover ?? game.heatHover;
  if (lead !== null) {
    ctx.lineWidth = 2; ctx.strokeStyle = css("--star");
    ctx.strokeRect(ox, oy + lead * cell, m * cell, cell);
    ctx.strokeRect(ox + lead * cell, oy, cell, m * cell);
  }
  ctx.fillStyle = css("--screen-ink-2"); ctx.font = "18px VT323, monospace";
  const step = Math.max(1, niceStep(m, 6));
  for (let j = 0; j < m; j++) if ((j + 1) % step === 0 || j === 0) {
    ctx.textAlign = "center"; ctx.fillText(j + 1, ox + (j + 0.5) * cell, oy + m * cell + 18);
    ctx.textAlign = "right"; ctx.fillText(j + 1, ox - 5, oy + (j + 0.5) * cell + 5);
  }
  // Flags (and, after the reveal, stars) along the top edge
  const mark = (j, color, hollow) => {
    const cx = Math.round(ox + (j + 0.5) * cell);
    ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 2;
    if (hollow) ctx.strokeRect(cx - 4, oy - 13, 8, 8); else ctx.fillRect(cx - 4, oy - 13, 8, 8);
  };
  for (const j of game.picks) mark(j, game.revealed ? (game.cur.causal.includes(j) ? css("--star") : css("--bad")) : css("--flag"), false);
  if (game.revealed) for (const j of game.cur.causal) if (!game.picks.has(j)) mark(j, css("--star"), true);
}
heat.addEventListener("mousemove", (e) => {
  if (!game.cur) return;
  const { m, cell, ox, oy } = heatGeom(), rect = heat.getBoundingClientRect();
  const b = Math.floor((e.clientX - rect.left - ox) / cell), a = Math.floor((e.clientY - rect.top - oy) / cell);
  if (a < 0 || b < 0 || a >= m || b >= m) { heatLeave(); return; }
  if (game.heatHover !== a) { game.heatHover = a; drawScatter(); drawHeat(); updateLegend(); }
  const r = shownLD()[a * m + b];
  showTip(`v${a + 1} × v${b + 1}<br>r² ${(r * r).toFixed(2)} · r ${r.toFixed(2)}`, e);
});
function heatLeave() { if (game.heatHover !== null) { game.heatHover = null; drawScatter(); drawHeat(); updateLegend(); } hideTip(); }
heat.addEventListener("mouseleave", heatLeave);
heat.addEventListener("click", () => { if (game.heatHover !== null) togglePick(game.heatHover); });

// Variant blocks: a keyboard- and touch-friendly way to plant flags
function buildBlocks() {
  const box = $("#chips"); box.replaceChildren();
  for (let j = 0; j < game.cur.m; j++) {
    const b = document.createElement("button");
    b.className = "block"; b.textContent = `${j + 1}`; b.setAttribute("aria-label", `Variant ${j + 1}`);
    b.addEventListener("click", () => togglePick(j));
    b.addEventListener("mouseenter", () => { game.hover = j; drawScatter(); drawHeat(); updateLegend(); });
    b.addEventListener("mouseleave", () => { game.hover = null; drawScatter(); drawHeat(); updateLegend(); });
    box.appendChild(b);
  }
}
function updateBlocks() {
  const cur = game.cur;
  [...$("#chips").children].forEach((b, j) => {
    const picked = game.picks.has(j), causal = cur.causal.includes(j);
    b.setAttribute("aria-pressed", picked ? "true" : "false");
    b.classList.toggle("correct", game.revealed && picked && causal);
    b.classList.toggle("wrong", game.revealed && picked && !causal);
    b.classList.toggle("missed", game.revealed && !picked && causal);
    b.disabled = game.revealed;
  });
}

// ── Wiring ───────────────────────────────────────────────────────────────────
$("#start").addEventListener("click", startGame);
$("#submit").addEventListener("click", submit);
$("#clear").addEventListener("click", () => { game.picks.clear(); sfx.unpick(); render(); });
$("#next").addEventListener("click", next);
$("#again").addEventListener("click", startGame);
$("#change").addEventListener("click", () => { show("#title"); $("#seed-note").textContent = ""; showHigh(); });
$("#true-ld").addEventListener("change", render);
$("#mute").addEventListener("click", () => setMuted(!muted));
$("#share").addEventListener("click", async () => {
  const url = gameUrl(game.cfg, game.seed);
  try { await navigator.clipboard.writeText(url); $("#share").textContent = "COPIED!"; }
  catch { prompt("Copy this link:", url); }
  setTimeout(() => ($("#share").textContent = "COPY LINK"), 2000);
});
addEventListener("resize", () => { if (game.cur && !$("#game").classList.contains("hidden")) drawHeat(); });
document.fonts?.ready.then(() => { if (game.cur) render(); });
