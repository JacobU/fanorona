# Depth-2 weight tuning campaign (2026-11-14)

The first stage of a tuning campaign: find good evaluator weights at depth 2 (our turn plus the opponent's reply),
before testing the best candidates at depth 4.

## Rules caveats: rerun after fixing
These results were produced under two problems found afterwards:
1. **Capture chains are always forced to continue.** In Fanorona only the first capture is compulsory; a player
   may stop a chain after any capture. The code (Board, move tree, bots, UI) never lets anyone stop early.
2. **Games are often deterministic.** Bots only choose randomly between moves with exactly equal scores. With the tuned
   weights ties are rare, so a pair of bots replays the same game. In the finals, most pairs of tuned bots went
   exactly 20-0-20: each won every game as one colour and lost every game as the other. The ± margins between
   tuned variants are therefore much smaller than their real uncertainty. Fix: randomise the opening turns of each game.

The tuned bots beat Fortress and AllRounder with both colours, so that gap is probably real. The fine ordering among
the tuned variants is not reliable.

## Setup
- Material fixed at 100. Every variant played a gauntlet of Lookahead, Fortress and AllRounder, 20 games per pair.
- `NO_CAPTURE_DRAW_TURNS` = 60.
- Short names: v = vulnerability, m = mobility, s = strongPoints, l = lineExposure. For example, `v0 m0 s20 l40` means
  material 100, strongPoints 20, lineExposure 40.

| Round | Config | What | Games |
|---|---|---|---|
| A1 | `a1-sweep.json` | Material plus one metric at a range of values | 1140 |
| A2 | `a2-pairs.json` | 3×3 grids for every pair of metrics | 2880 |
| A3 | `a3-random.json` | Random tweaks (σ 0.5) of the top 3, plus 8 fully random settings | 1620 |
| A4 | `a4-random.json` | Smaller tweaks (σ 0.3) of the top 4 | 1020 |
| A5 | `a5-finals.json` | Round robin of the top 5 plus Fortress and AllRounder, 40 games per pair | 840 |

## Findings
**Single metrics** (material alone scored 37.5%):

| Metric | Results |
|---|---|
| lineExposure | 40 → ~70% (confirmed over 120 games). 5–10 → 48%, 20 → 35%, 60+ → worse. |
| vulnerability | 120–200 → 66%. 30–60 → 51%. |
| strongPoints | 46–49% across 5–40. A small help. |
| mobility | Mostly turns games into draws; 1–2 is worse than material alone. |

**Interactions:**
- strongPoints 20 with lineExposure 40 was the best pair (82.5%).
- High vulnerability works with low lineExposure (v200 l10: 74%) but clashes with high lineExposure (v200 l40: 57.5%).
- Adding mobility converts wins into draws.

**Best region:** lineExposure 29–40, strongPoints 0–20, vulnerability 0–6, mobility 0–2.

**Finals (A5):**

| Bot | Score | vs AllRounder | vs Fortress |
|---|---|---|---|
| v0 m0 s20 l40 | 67.3% | 82.5% | 80.0% |
| v6 m0 s15 l31 | 62.7% | 85.0% | 98.8% |
| v5 m0 s19 l34 | 57.7% | 82.5% | 75.0% |
| v0 m2 s17 l37 | 57.5% | 77.5% | 81.3% |
| v4 m0 s0 l29 | 57.1% | 76.3% | 75.0% |
| AllRounder | 24.4% | – | 50.0% |
| Fortress | 23.3% | 50.0% | – |

**Concern about lineExposure 40.** Capturing a piece also removes that piece's connected pairs, so at weight 40 a
capture of a piece with 3 or more same-colour neighbours can score as a net loss (+100 material, −120 or more lineExposure).
Part of its strength may be this distortion rather than good positional play. A version that counts pairs per remaining
piece would remove the side effect.

## Candidates for depth 4
`v0 m0 s20 l40` (the finals winner), `v6 m0 s15 l31`, and `v4 m0 s0 l29` (the variant with no strongPoints).

## Rerunning or extending
Run from this folder, so results go to `./tuning/results/`. Build the repo first with `npm run build:src`.

```
node summarize.mjs [--from a3-random] [--top N]          # combined ranking across saved results
node gen.mjs random next.json --top 3 --perturb 12 --sigma 0.3 --depth 4 --opponents DeepFortress,DeepPositional --games 12
node ../../../dist/src/RunTuning.js next.json
```
