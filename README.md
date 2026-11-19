# Fine-map Quest

A pixel-art browser game for teaching statistical genetics: find the causal variants hiding in a GWAS signal,
using only the association plot and the LD matrix, and try to beat STEP-BOT (a stepwise conditional analysis).

Play it at https://chrisbcole.me/finemap-quest/

- **Each world** simulates a region: genotypes with LD that decays with distance and is patchy (overlapping
  haplotype segments plus a chain with recombination hotspots), a phenotype driven by a few causal variants,
  and GWAS summary statistics.
- **Difficulty** sets the sample size N. LD is estimated from the same samples, so a smaller N means weaker
  signals and noisier LD. After each world you can compare the estimate with the true LD.
- **Story mode:** six worlds shaped like real fine-mapping stories (TCF7L2, FTO, SORT1, APOE, BCL11A, and a
  boss fight at LCT), each followed by what fine-mapping and follow-up work actually found. The data are
  simulated to echo each locus; the LD and effect sizes aren't the real ones.
- **Hints:** toggle functional annotations (missense, promoter, enhancer). Causal variants are enriched for
  them, but most annotated variants are bystanders, and using them costs 20% of that world's coins.
- **Class mode:** settings and a game code are in the URL, so everyone with the link plays the same worlds.

Everything runs in the browser; there's no build step. `engine.js` holds the simulation and statistics,
`stories.js` the story worlds and annotations, `game.js` the game, `style.css` the look. To run it locally:

```bash
python3 -m http.server 8000
```
