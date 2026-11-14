# Depth-4 weight tuning campaign (2026-11-14)

This follows on from `../2026-11-14-depth2/`. The best depth-2 weights were tested at depth 4 against the existing
deep presets.

## Conditions
- **Rules:** chains are optional (a player can stop after any capture), and a game is drawn after 60 turns without a capture.
- **Candidates:** they were found by depth-2 tuning under the **old** forced-chain rules.
- **Randomness:** there are no randomised openings yet. The new early-stop options create more ties, so games varied
  more than in the depth-2 finals.
- **Short names:** material is 100 throughout. v = vulnerability, m = mobility, s = strongPoints, l = lineExposure.

| Round | Config | What | Games | Time |
|---|---|---|---|---|
| B1 | `b1-candidates.json` | Top 3 depth-2 settings plus 2 random tweaks, against DeepFortress and DeepPositional, 12 games per pair | 120 | 7.5 min |
| B2 | `b2-refine.json` | The B1 leader, Base (s20 l40), and 2 random tweaks of the leader, against DeepFortress, 16 games per pair | 64 | 3 min |
| B3 | `b3-roundrobin.json` | Round robin: the leader plus DeepFortress, DeepSentinel and DeepPositional, 12 games per pair | 72 | 3 min |

`*-output.txt` holds each round's printed output, and `tuning/results/` holds the full JSON.

## Results
**B1**

| Bot | Score | vs DeepFortress | vs DeepPositional |
|---|---|---|---|
| v6 m0 s15 l31 | 62.5% | 4-2-6 | 8-4-0 |
| v4 m0 s0 l29 | 47.9% | 1-8-3 | 1-11-0 |
| v0 m0 s20 l40 (depth-2 champion) | 45.8% | 3-6-3 | 0-10-2 |
| v0 m2 s12 l17 | 45.8% | 0-9-3 | 1-11-0 |
| v0 m0 s12 l33 | 37.5% | 0-6-6 | 0-12-0 |

The mobility variant took about 300 ms per turn; the others took 40–115 ms.

**B2** (all against DeepFortress)

| Bot | Score | Record |
|---|---|---|
| v6 m0 s15 l31 | 56.3% | 7-4-5 |
| v0 m0 s20 l40 | 46.9% | 5-5-6 |
| v4 m0 s31 l23 | 25.0% | 0-8-8 |
| v5 m0 s5 l12 | 21.9% | 0-7-9 |

**B3** (round robin; scores are ±16%)

| Bot | Score |
|---|---|
| DeepFortress | 52.8% |
| v6 m0 s15 l31 | 50.0% |
| DeepSentinel | 50.0% |
| DeepPositional | 47.2% |

The B3 results were not consistent with each other. For example, v6 s15 l31 lost to DeepPositional 1-7-4 here,
after beating it 8-4-0 in B1.

## Conclusions
- **The leader:** v6 m0 s15 l31 went 16-9-15 against DeepFortress across all rounds (51% over 40 games) and 9-11-4
  against DeepPositional (60% over 24). Statistically it is level with the existing deep bots.
- **Weights matter much less at depth 4 than at depth 2.** The large depth-2 advantage (~80% against Fortress and
  AllRounder) disappears. The deeper search seems to cover what the extra metrics were approximating.
- **The leader seems to sit near a local peak.** Random tweaks moving away from it lost clearly (21–37%).
- **Recommendation:** keep DeepFortress as the depth-4 preset. Recheck the depth-2 tuned weights under the new rules
  before adopting them for the depth-2 presets.
- **Next steps for sharper results:**
  1. Add randomised openings.
  2. Rerun the depth-2 finals under the new rules.
  3. Play hundreds of games per pair at depth 4 (roughly an hour of compute).
