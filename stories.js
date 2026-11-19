"use strict";
// Story mode: worlds shaped like real fine-mapping stories. The data are simulated (the LD, sample sizes and
// effects are not the real locus's), but each world is set up to reproduce what made that locus instructive,
// and the reveal tells what fine-mapping and follow-up work actually found.

const topHit = (c) => c.nlp.indexOf(Math.max(...c.nlp));
const r2 = (c, a, b) => c.R[a * c.m + b] ** 2;
const tagCount = (c, j, min) => c.nlp.reduce((n, _, l) => n + (l !== j && r2(c, j, l) >= min ? 1 : 0), 0);

const STORIES = [
  {
    gene: "TCF7L2", trait: "Type 2 diabetes",
    cfg: { variants: 25, ld: 0.6, samples: 3000, causal: [12], effects: [0.025] },
    rsids: { 12: "rs7903146" },
    annot: { 12: ["E", "enhancer (open chromatin in pancreatic islets)"] },
    check: (c) => topHit(c) === 12,
    intro: "TCF7L2 carries the strongest common genetic signal for type 2 diabetes. A gentle start: one causal variant.",
    story: "The causal variant is thought to be rs7903146. It sits in chromatin that's open in pancreatic islets " +
      "(Gaulton et al., 2010), and fine-mapping in several ancestries keeps pointing to it. Sometimes the top hit really is the answer.",
  },
  {
    gene: "FTO", trait: "Obesity",
    cfg: { variants: 30, ld: 0.9, samples: 2000, causal: [13], effects: [0.02], extra: [{ centre: 15, width: 6, amp: 2.5 }] },
    rsids: { 13: "rs1421085" },
    annot: { 13: ["E", "enhancer (fat cell precursors)"] },
    check: (c) => topHit(c) !== 13 && r2(c, topHit(c), 13) > 0.6,
    intro: "FTO was the first common obesity locus found by GWAS, in 2007. Its signal spans dozens of tightly linked variants.",
    story: "The causal variant, rs1421085, wasn't the lead SNP most studies reported. It breaks a binding site for the " +
      "repressor ARID5B, switching on IRX3 and IRX5 in fat cell precursors (Claussnitzer et al., 2016). The genes it acts on aren't even FTO.",
  },
  {
    gene: "SORT1", trait: "LDL cholesterol",
    cfg: { variants: 30, ld: 0.85, samples: 2000, causal: [17], effects: [0.03], extra: [{ centre: 17, width: 4, amp: 2 }] },
    rsids: { 17: "rs12740374" },
    annot: { 17: ["E", "enhancer (liver)"] },
    check: (c) => tagCount(c, 17, 0.7) >= 3 && c.nlp[17] > 8,
    intro: "Chromosome 1p13 holds one of the strongest LDL cholesterol signals. Several variants here travel together.",
    story: "rs12740374 creates a binding site for the C/EBP transcription factor in a liver enhancer, raising SORT1 " +
      "expression and lowering LDL (Musunuru et al., 2010). Its neighbours carried the same statistical signal; lab work picked it out.",
  },
  {
    gene: "APOE", trait: "LDL cholesterol",
    cfg: { variants: 24, ld: 0.5, samples: 3000, causal: [9, 14], effects: [0.03, -0.02] },
    rsids: { 9: "rs429358", 14: "rs7412" },
    annot: { 9: ["M", "missense (Cys130Arg: the ε4 allele)"], 14: ["M", "missense (Arg176Cys: the ε2 allele)"] },
    check: (c) => c.nlp[9] > 6 && c.nlp[14] > 6,
    intro: "APOE is famous for Alzheimer's disease, but it's also a major LDL cholesterol locus. This time there's more than one causal variant.",
    story: "Two missense variants define APOE's ε2, ε3 and ε4 alleles. rs429358 (ε4) raises LDL and rs7412 (ε2) lowers it: " +
      "two causal variants in one region, pulling in opposite directions.",
  },
  {
    gene: "BCL11A", trait: "Fetal haemoglobin",
    cfg: { variants: 28, ld: 0.8, samples: 1500, causal: [11], effects: [0.03], extra: [{ centre: 12, width: 4, amp: 2.5 }] },
    rsids: { 11: "rs1427407" },
    annot: { 11: ["E", "enhancer (red blood cell precursors)"] },
    check: (c) => c.nlp[11] > 6 && topHit(c) !== 11,
    intro: "BCL11A keeps fetal haemoglobin switched off in adults. Variants that leave more of it on make sickle cell disease milder.",
    story: "rs1427407 sits in an enhancer that drives BCL11A only in red blood cell precursors (Bauer et al., 2013). " +
      "Editing that enhancer is how Casgevy, approved in 2023, treats sickle cell disease and β-thalassaemia.",
  },
  {
    gene: "LCT", trait: "Lactase persistence", boss: true,
    cfg: { variants: 30, ld: 1, samples: 1500, causal: [15], effects: [0.03], extra: [{ centre: 15, width: 15, amp: 6 }] },
    rsids: { 15: "rs4988235" },
    annot: { 15: ["E", "enhancer of LCT (inside an MCM6 intron)"] },
    check: (c) => tagCount(c, 15, 0.8) >= 4 && topHit(c) !== 15,
    intro: "BOSS WORLD! Being able to digest milk as an adult was strongly selected for in Europe, and selection drags a long haplotype along with it.",
    story: "In Europeans the causal variant, rs4988235, sits on a long haplotype where dozens of variants share its signal. " +
      "Pinning it down took lab work on the enhancer and populations with different LD, including East African pastoralists " +
      "whose lactase persistence comes from other variants nearby (Tishkoff et al., 2007).",
  },
];

// Functional annotations: causal variants are enriched for them, as in real data, but most annotated variants are bystanders
const ANNOT = {
  M: { name: "missense", color: "#ff8c42" },
  P: { name: "promoter", color: "#4dd4ac" },
  E: { name: "enhancer", color: "#f2a7d8" },
};
function annotate(cur, rand, forced = {}) {
  cur.annot = cur.nlp.map((_, j) => {
    if (forced[j]) return { type: forced[j][0], label: forced[j][1] };
    const causal = cur.causal.includes(j), u = rand();
    const [m, p, e] = causal ? [0.15, 0.35, 0.65] : [0.02, 0.08, 0.25]; // cumulative probabilities
    const type = u < m ? "M" : u < p ? "P" : u < e ? "E" : null;
    return type ? { type, label: ANNOT[type].name } : null;
  });
}

function storyWorld(spec, rand) {
  let cur;
  for (let tries = 0; tries < 300; tries++) {
    cur = simulate(spec.cfg, rand);
    if (spec.check(cur)) break;
  }
  annotate(cur, rand, spec.annot);
  cur.rsids = spec.rsids;
  return cur;
}
