# Texel and global search campaign (2026-11-14)

This follows on from `../2026-11-14-depth2/` and `../2026-11-14-depth4/`.

**Status:** paused before stage 5c (4-weight CMA-ES) and stage 6 (depth-4 SPRT). The endgame metrics are being added first.

**Best depth-2 weights found ("s030"):** material 100, vulnerability −3, mobility −1, strongPoints 12, lineExposure 9.
These score about 60–64% against Fortress, AllRounder and Lookahead over hundreds of games from paired random openings.

## Conditions
- **Rules:** chains are optional (a player can stop after any capture), and a game is drawn after 60 turns without a capture.
- **Paired openings:** every comparison is played from the same set of random 4-turn openings, once with each colour.
  Openings where one side is more than 2 pieces ahead are skipped. Configs use `"openings": { count, turns, seed }`.
- **Depth:** 2 for everything in this campaign.
- **Short names:** material is fixed at 100. v = vulnerability, m = mobility, s = strongPoints, l = lineExposure.

## Stage 1: the depth-2 finals rerun with paired openings (`s1-depth2-finals.json`)
**The earlier depth-2 tuning results were an artefact.** With 30 paired openings (60 games per pair), every bot
scored 43–54%, and Fortress came top at 54.3%. In the earlier campaign the tuned weights had beaten Fortress 80–99%.

**Diagnostic** (`s1b-standard-start.json`: the same bots, the standard starting position, the new rules): the tuned
weights crushed Fortress again (v6 s15 l31 went 37-3-0). So the cause was not the rule change. Every earlier game
started from the same position, and the tuned weights almost never tie, so a few lines were replayed over and over.
The earlier tuning had found a line from the standard start that beats Fortress's and AllRounder's fixed replies,
not better general weights.

**Lesson: always compare bots using varied, paired openings.**

## Stage 2: Texel tuning (`s2-depth2-positions.json`, `s2-*-fit*.json`)
- **Data:** 42,537 positions from 600 games, each from its own random opening, between randomly paired bots
  (Greedy, Guardian, Lookahead, Sentinel, Strangler, Positional, AllRounder, Fortress). The results were 181 white wins,
  166 black wins and 253 draws.
- **Fit on all positions:** material 100, strongPoints 65 (95% range 39 to 95), lineExposure 44 (22 to 68),
  vulnerability 37 (7 to 70), mobility 0.3 (−3.4 to 3.8). Material is by far the most predictive. The prediction loss
  (log-loss) went from 0.693 (a coin flip) to 0.665 with material only, and 0.658 with all five metrics.
- **Fit on quiet positions only** (no capture available): vulnerability 369 and mobility 21. This is unreliable because the
  material coefficient shrinks in that subset, which inflates every ratio.

## Stage 3: the Texel weights in real games (`s3-validate.json`, `s3b-attribution.json`)
The Texel weights played worse than the old tuned weights:

| Bot | Score |
|---|---|
| Texel fit (v37 s65 l44) | 46.2% |
| Texel quiet-only fit | 39.0% |
| Old tuned (v6 s15 l31) | 56.5% |

**Attribution** (mixing the two sets of weights): strongPoints 65 is what hurts (−9.5 points). Texel's
vulnerability of 37 is about neutral.

**Why:** Texel learns which features predict winning (correlation), not which ones cause it. Winning positions tend to
hold strong points, but chasing them gives up material. Other factors: positions weren't resolved before labelling
(there's no search that plays out forced captures first), weak bots shaped the data, and the signal was weak. Texel is
useful for showing which metrics matter, but its weights can't be used directly here.

## Stage 4: searching the whole space with successive halving (`s4-halving.json`, `s4-state.json`, `s4-round*.txt`)
- **Setup:** 128 settings spread evenly with a Latin hypercube (on a signed log scale) over these ranges, plus 6 known
  settings:

| Metric | Range |
|---|---|
| vulnerability | −30 to 250 |
| mobility | −10 to 10 |
| strongPoints | −20 to 120 |
| lineExposure | −20 to 120 |

- **Narrowing down:** each round, every candidate played Fortress, AllRounder and Lookahead on the same block of new
  openings; the best half was kept and the openings doubled (4, 8, 16, 32, 64). That came to 16,416 games in total.
- **Final round** (744 games per finalist, ±3.5%):

| Rank | Candidate | Weights | Score | W-D-L |
|---|---|---|---|---|
| 1 | **s030** | v−3 m−1 s12 l9 | **60.3%** | 236-425-83 |
| 2 | Fortress's weights | v30 m0 s5 l5 | 56.8% | |
| 3 | s053 | v2 m0 s3 l10 | 56.7% | |
| 4 | OldTuned | v6 m0 s15 l31 | 56.7% | |

  The remaining finalists scored 51–55%. s030 led in all five rounds.
- **Findings:**
  - Large weights (≥60 on any metric) are clearly bad.
  - Negative strongPoints and lineExposure are worse than positive.
  - No good region was found away from modest positive positional weights.
  - Two families of good settings survived for a while: low vulnerability with strongPoints and lineExposure
    (s030, OldTuned), and high vulnerability alone (Fortress-like, many draws). The first family won out.
  - AllRounder's weights and TexelS20 (v37 s20 l44) were eliminated.

## Stage 5: CMA-ES refinement (`s5-cmaes.json`, `s5-state.json`, `s5-batch1.txt`)
- **Batch 1** searched vulnerability, strongPoints and lineExposure with **mobility fixed at 0**: 4 generations,
  8 samples each, 16 openings per generation. **Nothing beat s030.** On the same openings, s030 averaged 61.6% and
  the CMA-ES mean point 58.5%. The generation-1 mean point was s030 with mobility 0, and it scored 56.8% against s030's 63.0%.
- **Mobility check** (`s5b-mobility.json`, 64 paired openings):

| s030 with mobility = | Score |
|---|---|
| −1 (as found) | **63.9%** (wins 33%, losses 5%; 59.8% against Fortress) |
| −2 | 60.9% |
| 0 | 56.0% |
| +1 | 49.5% |

  **The small negative mobility weight is worth about 8 points.** Hypothesis: at the end of a depth-2 search it's our
  turn again. Few moves for us often means a capture is forced (captures are compulsory), and many moves for the
  opponent means they have no capture. So a small negative weight acts as a cheap "we threaten, they don't" signal.
  This is why the earlier positive-only mobility sweeps and Texel (which averages over all positions) missed it.
  - **Cost:** computing mobility makes the bot 4–5 times slower (about 7 ms per turn against 1.5 ms at depth 2). It will
    be much slower at depth 4.
- **Batch 2 (`s5c-cmaes-4d.json`)** includes mobility as a 4th weight (on a 0.1 scale). It was **stopped before
  generation 1 finished**, so no state was saved, and it can be rerun as is.

## Tools added (in `src/`)
| File | What it does |
|---|---|
| `ai/tuning/Openings.ts` | Generates paired openings (balanced, distinct, seeded) |
| `ai/random.ts` | `seededRng` |
| `ai/tuning/Texel.ts` | Records and labels positions, logistic-regression fit, bootstrap ranges |
| `RunTexel.ts` | `npm run texel -- collect|fit` |
| `ai/tuning/Sampling.ts` | Latin hypercube sampling |
| `RunHalving.ts` | `npm run halving -- <config> <state>`, one round per run, resumable |
| `ai/tuning/Cmaes.ts` | CMA-ES |
| `RunCmaes.ts` | `npm run cmaes -- <config> <state>`, a few generations per run, resumable; supports `scales` |

All of these run from a campaign folder (e.g. `node ../../../dist/src/RunHalving.js s4-halving.json s4-state.json`)
after `npm run build:src`, and write results next to the configs.

## Update 2026-11-15: mobility removed
The `mobility` evaluator has been removed from the code, along with the Strangler and AllRounder presets. It was the
slowest metric (it made depth 4 about 3–4× slower) and added little, and the other metrics are expected to cover it.
Consequences for this campaign:
- configs here that use mobility (including `s5c-cmaes-4d.json`, and s030's mobility −1) no longer run as written;
- s030 without mobility is material 100, vulnerability −3, strongPoints 12, lineExposure 9. Step 2 below becomes a
  3-weight refinement (vulnerability, strongPoints, lineExposure), and step 3 tests that version;
- saved Texel position files are still readable: `fit` maps their features by name and drops mobility.

## Next steps (in order)
1. **Merge the endgame work** (being done separately):
   - two new metrics, edgeExposure and centrality, blended in as the board empties (none at ≥10 pieces, full strength at ≤6);
   - search depth 6 at ≤10 pieces;
   - the new presets FortressEndgame and DeepFortressEndgame.

   The endgame weights (edgeExposure 40, centrality 20) are guesses and need tuning, ideally from endgame starting
   positions (play random games down to 6–10 pieces with one side 1–2 pieces ahead; measure how often the side ahead
   converts and how often the side behind holds).
2. **Rerun the 4-weight CMA-ES** (`s5c-cmaes-4d.json`) to refine around s030 now that mobility is included.
3. **Stage 6: depth-4 SPRT.** Test s030 (and s030 with mobility 0, since mobility is expensive at depth 4) at depth 4
   against DeepFortress on paired openings, with a sequential test so it stops as soon as the result is clear.
   Measure the time per move.
4. **Then decide whether to update the presets.** For example, add a "Tuned" preset with s030's weights (no presets have
   been changed by this campaign).
5. **Known metric flaw:** strongPoints counts corners as strong points, but corners are among the worst squares in the endgame.
