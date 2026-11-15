# Endgame evaluators at depth 6 (2026-11-15)

This follows `docs/endgame-tuning-handoff.md`. The plan is in `~/.claude/plans/read-through-the-docs-endgame-tuning-han-ticklish-teapot.md`.

**Status:** stages 0–1 and stage 3 rounds 1–2 (the depth-4 screen) are done. Stage 4 (the depth-6 round robin) chunks 1–2
and the depth-6-against-weak-bots run are done. Waiting for the user to choose the next check. Round 3 (the depth-4 refinement) is on hold. **No presets have been changed.**

## Picking this up again
1. **The code changes from stage 1 are uncommitted** (on `main`, on top of `4185a5b`).
   - Files: `src/ai/tuning/{Openings,Tuner,TuningConfig,BotSpec}.ts`, `src/ai/{endgame,presets}.ts`, `src/RunTuning.ts`,
     `tests/{tuning,endgame}.test.ts` and `tuning/README.md`.
   - This campaign folder and `docs/endgame-tuning-handoff.md` are untracked.
   - Don't discard or commit them without asking the user.
2. **Check the starting point:** `npm test` should show 246 passing.
3. **Build** with `npm run build:src`, and **run from this folder:**
   `node ../../../dist/src/RunTuning.js <config>.json --workers 3 > <name>-output.txt` (with Bash `run_in_background`).
   Results JSON is written to `./tuning/results/`.
4. **Configs are made by `gen.mjs`:**
   - `node gen.mjs lhs <out> --samples N --seed S --starts C --startSeed T`: Base, the 7 anchors and N Latin-hypercube
     settings.
   - `node gen.mjs top <out> --top K --starts C --startSeed T <results.json>...`: the K best (pooled over those results
     files) plus the anchors and Base, on new starts.
   - Both take `--endgameDepth D` (default 4). Use it to make depth-6 versions.
   - Grids are written by hand as `variants`, because the config `grid` can't reach `endgameWeights`.
5. **Seeds used so far:**
   - 1501: stage 0 openings;
   - 3101: Latin hypercube;
   - 3102: round 1 starts;
   - 3202: round 2 starts.
   - Use new seeds (e.g. 33xx) for the next round.
6. **The proposed next steps,** waiting for the user's go-ahead (see the end of this file):
   - round 3, a depth-4 refinement grid around "centrality is the main term";
   - then depth-6 confirmation of the best 2 against Current and Base.
   - Ask the user for the time budget first. They set **≤30 min per run**, and want a report after every run.
7. **Timings (3 workers):**
   - endgame starts at depth 4: about 0.35 s per game (about 160 games per minute);
   - whole games with one depth-6 bot: about 15.6 s per game;
   - endgame starts at depth 6 (both sides): expect about 100 games per 30 minutes (estimated, not yet measured).

**The goal:** find which evaluators (and how much of each) help the endgame bots, which search 6 turns ahead at 10 or
fewer pieces. Then check the endgame thresholds, and confirm the result in whole games.

## Conditions
- **Base weights:** Fortress (material 100, vulnerability 30, strongPoints 5, lineExposure 5).
- **Current endgame weights:** edgeExposure 40 and centrality 20. They are blended in from 10 pieces down to 6, and the
  bots search at depth 6 at 10 or fewer pieces.
- **Budget:** each run is limited to 30 minutes, with 3 workers on a 4-CPU machine.
- **Rules:** chains are optional, there's a 60-turn no-capture draw, and a player who can't move loses.

## Stage 0: baseline and timing (`e0-baseline.json`, `e0-output.txt`)
DeepFortressEndgame's settings (as "Base") played DeepFortress from 10 paired 4-turn openings (seed 1501): 20 games on
3 workers. Tests were green beforehand (231 quick, 232 full).

**Result:**

| Bot | Score | ± | W-D-L | ms/turn |
|---|---|---|---|---|
| DeepFortressEndgame settings | 55.0% | 21.8% | 6-10-4 | **646** |
| DeepFortress | 45.0% | | 4-10-6 | 16 |

**Timing:**
- The 20 games took 313 s in total, which is about **15.6 s per game** with 3 workers running at once (about 47 s per
  game on each worker).
- That's about **115 whole games per 30 minutes**.
- Almost all of the time is the endgame bot's depth-6 moves: 646 ms per turn on average, against 16 ms at depth 4.
- No game hit the turn limit.

**What it means:**
- The score is noise at 20 games, as expected; this run was for timing only.
- From endgame starts, *both* sides search at depth 6 on every move. So endgame-start games will cost at least as much
  per game, probably about 100 games per 30 minutes.
- About 100 games is about ±10% for one bot, or about ±20% each if 4 variants share the run. A single 30-minute run per
  stage can only show very large differences.

**Decision (user):** screen quickly at endgame **depth 4**, with a broad spread of variants so the search doesn't get
stuck at a local maximum. Then confirm only the best few at depth 6.

## Stage 1: code (tests first)
The new tests were written first and failed (the API didn't exist). Afterwards, 246 tests pass, including the golden and
board-unchanged tests, and `npm run build` works.

**What was added:**
- **`generateEndgameStarts(count, { minPieces, maxPieces, minImbalance, maxImbalance }, seed)`** in
  `src/ai/tuning/Openings.ts`.
  - It plays 4 random turns, then Fortress (depth 2, random tie-breaks) plays both sides until 9 or fewer pieces are left.
  - It keeps distinct, unfinished starts with 6–9 pieces where one side is 1–2 ahead.
  - The starts don't need an even number of turns, because both bots play every start from both sides.
  - Speed: 200 starts in 7 s. Of those, 84% have an imbalance of 1 and 16% an imbalance of 2.
- **`startLead(opening)`:** how many pieces white is ahead by after a start.
- **The `endgameStarts` config option** (an alternative to `openings`).
  - The results are split by whether the bot started ahead or behind.
  - The runner prints **Converts** (games won when ahead) and **Holds** (games not lost when behind), and saves `ahead`
    and `behind` in the results JSON.
- **Per-bot thresholds** `endgameStart` / `endgameFull` in presets, `BotSpec` and configs (base and variants). The
  defaults (10 and 6) are unchanged, and full ≥ start is rejected.
- **Timing at endgame depth 4:** about 12 ms per turn, so endgame-start games take about 0.2 s each with 3 workers.

## Stage 3, round 1: broad screen at endgame depth 4 (`e3a-screen-d4.json`, `e3a-output.txt`; made by `gen.mjs lhs`)
- **The bots:** every bot has Fortress weights, depth 4 and endgame depth 4, with different endgame weights on top.
  - **Base** has no endgame weights, so it plays exactly like the opponent: a control that should score about 50%.
  - **7 anchors:**
    - Current (e40 c20);
    - E40 and C20 on their own;
    - Current with strongPoints −5 (strongPoints switched off), vulnerability −30 (off), vulnerability +30 (doubled),
      and lineExposure −5 (off).
  - **56 Latin-hypercube settings** (seed 3101, signed log scale) over these ranges:

| Endgame weight | Range |
|---|---|
| edgeExposure | −20 to 100 |
| centrality | −20 to 100 |
| strongPoints | −20 to 30 |
| vulnerability | −30 to 90 |
| lineExposure | −20 to 30 |

- **The opponent:** DeepFortress (depth 4, no endgame weights).
- **The games:** 24 endgame starts (seed 3102) × 2 colours = 48 games per bot, 3072 games in total. At this size each
  bot's ± is about 14%, so round 1 only weeds out clearly bad settings.
- **The plan after this round:** carry the top quarter forward (with the anchors) onto new starts, then pool the results
  (`gen.mjs top`).

### Round 1 results (3072 games in 15.9 min; ± about 14% per bot)

**Top of the table and the anchors:**

| Bot | Endgame weights (e c s v l) | Score | W-D-L % | Converts | Holds |
|---|---|---|---|---|---|
| r43 | e7 c21 s15 v−1 l2 | 61.5% | 33-56-10 | 46% | 83% |
| r20 | e2 c1 s4 l21 | 60.4% | 33-54-13 | 54% | 79% |
| C20 | c20 | 59.4% | 33-52-15 | 50% | 75% |
| r01 | e2 c1 s−2 v5 l17 | 59.4% | 29-60-10 | 38% | 83% |
| E40 | e40 | 58.3% | 35-46-19 | 50% | 67% |
| r02 | e8 c37 s1 v−24 | 58.3% | | | |
| r11 | e−3 c47 v−20 l−1 | 58.3% | | | |
| r46 | e23 c50 s−1 v2 l6 | 58.3% | | | |
| Current l−5 | e40 c20 l−5 | 56.3% | | | |
| Current v+30 | e40 c20 v30 | 55.2% | | | |
| Current s−5 | e40 c20 s−5 | 54.2% | | | |
| Current v−30 | e40 c20 v−30 | 54.2% | | | |
| **Current** | e40 c20 | 51.0% | 27-48-25 | 38% | 58% |
| **Base (control)** | none | 47.9% | 17-63-21 | 29% | 67% |

**Bottom of the table:**

| Bot | Endgame weights | Score |
|---|---|---|
| r16 | e79 c26 | 21.9% |
| r50 | e87 c−5 | 25.0% |
| r10 | e−18 c−15 l−14 | 32.3% |
| r14 | e72 c6 | 33.3% |
| r28 | e−15 c−5 s−7 | 34.4% |
| r31 | e52 c86 | 37.5% |
| r40 | e49 c24 v83 | 37.5% |

**Score by each weight** (pooled over every variant whose weight falls in the band; the bands overlap with the other
weights, so this shows trends only):

| Weight | Bands → score |
|---|---|
| edgeExposure | <0: 46% · 0: 53% · 1–10: 52% · 11–30: 53% · 31–45: 53% · **>45: 33%** |
| centrality | **<0: 45%** · 0: 48% · 1–10: 51% · 11–30: 51% · **31–60: 57%** · >60: 47% |
| strongPoints | **≤−6: 44%** · −5 to −1: 47% · 0: 51% · 1–10: 51% · >10: 52% |
| vulnerability | ≤−15: 56% · −14 to −1: 48% · 0: 51% · 1–20: 46% · >20: 49% (no clear trend) |
| lineExposure | ≤−6: 49% · −5 to −1: 47% · 0: 49% · 1–10: 51% · >10: 47% (no clear trend) |

**Findings so far** (provisional: only 48 games per bot):
1. **The control works.** Base (identical to the opponent) scored 47.9%, within noise of 50%.
2. **Nothing clearly beats the rest yet.** The top 30 or so scored 51–62%, all within about one ± of each other. The
   current e40 c20 (51.0%) is not clearly better than no endgame weights (47.9%).
3. **Large edgeExposure is clearly bad.** Every setting with edgeExposure 49–87 scored 22–45%. So 40 is close to the
   limit, and the safe band is 0–45.
4. **Negative edgeExposure or centrality is bad** (pulling your own pieces to the edge). Moderate centrality (about 20–50)
   looks best.
5. **Switching strongPoints off in the endgame doesn't help, and negative values hurt.** This goes against the "corner
   flaw" idea, at least at depth 4. Keeping strongPoints at +5 or more looks fine.
6. **Vulnerability and lineExposure offsets show no clear effect** in this range.
7. **Endgames are mostly drawn.** Across all variants the side ahead by 1–2 pieces won only 33% of the time, and the side
   behind avoided losing 65% of the time. Converts is where the bots differ most: the top bots convert 40–54%, Base 29%.

### Round 2 (`e3b-round2-d4.json`, `e3b-output.txt`)
- **The bots:** the top 16 from round 1, plus Current, Current s−5, Current v−30, Current v+30 and Base: 21 bots.
- **The games:** 64 new endgame starts (seed 3202) × 2 colours = 128 games per bot, 2688 games in total.

### Round 2 results (2688 games in 16.9 min), pooled with round 1 (176 games per bot, ± about 7%)

| Bot | Endgame weights (e c s v l) | Round 2 | **Pooled** | W-D-L | Converts | Holds |
|---|---|---|---|---|---|---|
| r43 | e7 c21 s15 v−1 l2 | 60.9% | **61.1%** | 52-111-13 | 47% | **88%** |
| r02 | e8 c37 s1 v−24 | 60.9% | **60.2%** | 55-102-19 | 51% | 80% |
| r17 | c73 s3 l−12 | 61.3% | **59.9%** | 57-97-22 | 49% | 77% |
| r09 | e12 c15 s−4 v16 l1 | 60.5% | **59.4%** | 55-99-22 | 53% | 78% |
| r11 | e−3 c47 v−20 l−1 | 59.0% | 58.8% | 52-103-21 | 47% | 77% |
| r05 | e16 c7 s13 v26 l8 | 59.0% | 58.2% | 48-109-19 | 47% | 81% |
| E40 | e40 | 57.8% | 58.0% | 54-96-26 | 48% | 74% |
| C20 | c20 | 57.4% | 58.0% | 50-104-22 | 48% | 77% |
| r20 | e2 c1 s4 l21 | 57.0% | 58.0% | 44-116-16 | 42% | 83% |
| r01 | e2 c1 s−2 v5 l17 | 57.0% | 57.7% | 45-113-18 | 40% | 82% |
| r54 | c10 s4 v−16 l−5 | 56.6% | 56.8% | 44-112-20 | 42% | 81% |
| r23 | c4 s−1 v−3 l3 | 55.9% | 56.3% | 44-110-22 | 39% | 80% |
| r46 | e23 c50 s−1 v2 l6 | 55.1% | 56.0% | 47-103-26 | 45% | 77% |
| r55 | e−3 c17 s9 v1 l−6 | 55.1% | 55.7% | 39-118-19 | 41% | 81% |
| Current v+30 | e40 c20 v30 | 54.7% | 54.8% | 49-95-32 | 44% | 68% |
| Current l−5 | e40 c20 l−5 | 53.5% | 54.3% | 52-87-37 | 50% | 63% |
| **Current** | e40 c20 | 55.1% | **54.0%** | 55-80-41 | 50% | **58%** |
| Current v−30 | e40 c20 v−30 | 53.9% | 54.0% | 55-80-41 | 52% | 61% |
| r30 | e1 c−2 s7 v56 l1 | 53.1% | 54.0% | 32-126-18 | 31% | 83% |
| Current s−5 | e40 c20 s−5 | 52.0% | 52.6% | 51-83-42 | 52% | 57% |
| **Base (control)** | none | 50.8% | **50.0%** | 26-124-26 | 26% | 75% |

**Findings after round 2:**
1. **Endgame weights do help.**
   - Every bot with positive endgame weights scored above Base (50.0%).
   - The leaders are about 10 points above it, which is more than the ±.
   - Most of the gain is in Converts: the leaders win about 50% of the games they start ahead, against Base's 26%.
2. **The current e40 c20 converts well but defends badly.**
   - Every "Current" variant holds only 57–68% of the games it starts behind. Most other bots hold 74–88%, and even Base
     holds 75%.
   - So the current bots lose about twice as often (41 losses against 13–22 for the leaders).
   - Likely cause: a large edgeExposure makes the side behind chase edge positions instead of staying safe.
   - Changing vulnerability, lineExposure or strongPoints on top of e40 c20 doesn't fix this.
3. **The leaders share a pattern:**
   - centrality is the main term (15–73);
   - edgeExposure is small (0–16);
   - strongPoints is kept or raised;
   - vulnerability and lineExposure offsets are around zero (their signs vary between the leaders, so they don't seem to
     matter).
   - The two single-term anchors (C20 and E40) both score 58%, but C20 holds better (77% against 74%).
4. **The top four (r43, r02, r17, r09) are within noise of each other.** They are about 6–7 points above Current, at the
   edge of the ±.
5. **Caveats:**
   - The leaders were partly chosen for scoring well in round 1, so their pooled scores are slightly inflated. The
     round-2-only column, on new starts, is the fairer comparison, and it gives the same picture.
   - All of this is at depth 4. Depth 6 has to be checked.

**Proposed next steps** (waiting for the user's go-ahead; not started):
- **Round 3, a refinement grid at depth 4:** e ∈ {0, 10} × c ∈ {20, 40, 70} × s ∈ {0, +10} (12 bots), plus r43, r02, r17,
  r09, Current and Base, on 64 new starts. About 2300 games, about 15 minutes.
- **Then depth-6 confirmation:** the best 2 against Current and Base, in 30-minute chunks.

## Stage 4: depth-6 confirmation, a round robin from endgame starts (`e4a-d6-roundrobin.json`, `e4a-output.txt`)
**Decision (user):** the candidates must also play each other, not only DeepFortressEndgame, so the results show general
strength rather than skill at beating one opponent. Round 3 (the depth-4 refinement) was skipped for now.

- **The bots,** all with Fortress weights, depth 4 and endgame depth 6:
  - **r43** (e7 c21 s15 v−1 l2): this is "Base" in the output, because a config with no grid always plays its base;
  - **r02** (e8 c37 s1 v−24 l0): l0 is set explicitly, because variant endgame weights are merged onto the base's;
  - **DeepFortressEndgame** (the current preset, e40 c20).
- **Chunk 1:** 12 endgame starts (seed 3401) × 2 colours × 3 pairings = 72 games. It also measures the real depth-6 speed.
  Later chunks will be sized to fit 30 minutes, use new seeds, and be pooled.

### Chunk 1 results (72 games in 14.1 min, so about 11.7 s per game and about 150 games per 30 min; ± about 14%)

| Bot | Score | W-D-L % | vs r43 | vs r02 | vs DFE | Converts | Holds | ms/turn |
|---|---|---|---|---|---|---|---|---|
| r43 ("Base") | 53.1% | 29-48-23 | – | 50.0% (5-14-5) | 56.3% (9-9-6) | 54% | 54% | 680 |
| r02 | 52.1% | 29-46-25 | 50.0% | – | 54.2% (9-8-7) | 54% | 50% | 585 |
| DeepFortressEndgame | 44.8% | 27-35-38 | 43.8% | 45.8% | – | 54% | **33%** | 451 |

**First look** (too few games to be sure):
- **The depth-4 finding repeats at depth 6:** the current preset defends badly from behind.
  - DFE holds 33% of the games it starts behind (0 wins, 8 draws, 16 losses).
  - r43 holds 54% and r02 holds 50%.
  - All three convert equally well (54%).
- **r43 and r02 are level head to head** (5-14-5).
- **Depth 6 converts more than depth 4** (54% against about 47–50%). That's expected, since a deeper search finds more
  winning lines.
- **Chunk 2** (`e4b-d6-roundrobin.json`): 22 new starts (seed 3402), 132 games, about 26 min. It will be pooled with
  chunk 1.

### Chunk 2 (`e4b-d6-roundrobin.json`: 22 new starts, seed 3402, 132 games in 22.8 min) and the pooled results

| Bot | Chunk 2 | **Pooled (136 games each, ± 8.4%)** | W-D-L | vs r43 | vs r02 | vs DFE | Converts | Holds |
|---|---|---|---|---|---|---|---|---|
| r02 | 53.4% | **52.9%** | 36-72-28 | 55.1% (17-41-10) | – | 50.7% (19-31-18) | 51% | 60% |
| r43 ("Base") | 46.0% | **48.5%** | 28-76-32 | – | 44.9% (10-41-17) | 52.2% (18-35-15) | 40% | 53% |
| DeepFortressEndgame | 50.6% | **48.5%** | 33-66-37 | 47.8% (15-35-18) | 49.3% (18-31-19) | – | 47% | 49% |

**Chunk 2 didn't repeat chunk 1.**
- The current preset scored 50.6%, and its Holds rose from 33% to 57%.
- r43 dropped to 46%.
- Pooled, **all three bots are within noise of each other at depth 6** (48.5–52.9%, ± 8.4%). So the clear depth-4 picture
  doesn't show up here, at least not at this game count.

**Possible causes:**
1. **Noise.**
   - The depth-4 gap between the leaders and Current was about 6–7 points, which is smaller than the ± here.
   - Chunk 1's large hold gap came from only 24 games per bot.
2. **Deeper search makes the evaluation matter less.** The 2026-11-14 campaigns saw the same thing: weights mattered much
   less at depth 4 than at depth 2. At depth 6 the search finds the tactics itself, so the positional endgame terms have
   less to add.
3. **A different yardstick.**
   - At depth 4, every bot played DeepFortress (no endgame weights). Current scored 54% there and the leaders about 60%.
   - That *indirect* gap of about 6 points was never measured head to head. Here r43 against Current is 52.2%
     head to head.

**How to check** (the user decides):
- **A cheap depth-4 head-to-head** (r43, r02 and Current in a round robin at endgame depth 4, about 2000 games in a few
  minutes). If the gap is also small at depth 4 head to head, cause 3 is the main one. If it's clear at depth 4 but not
  at depth 6, cause 2 is.
- **Or more depth-6 chunks:** 2 more chunks (about 50 min) would bring the ± to about 6%.

### Depth-6 bots against weak bots (`e4c-d6-vs-weak.json`, `e4c-output.txt`)
- **Requested by the user,** to see how the depth-6 bots do against bad players.
- **The match-up:** r43 ("Base"), r02 and Current (= DeepFortressEndgame) against Greedy (depth 1, material only),
  Lookahead (depth 2, material only) and Fortress (depth 2).
- **The games:** a gauntlet, so the weak bots don't play each other. 14 new starts (seed 3403) × 2 colours × 9 pairings =
  252 games.

**Results** (252 games in 8.0 min; each depth-6 bot played 84 games):

| Depth-6 bot | Score | W-D-L | vs Greedy | vs Lookahead | vs Fortress | Converts | Holds | Wins from behind |
|---|---|---|---|---|---|---|---|---|
| r43 ("Base") | 95.2% | 78-4-2 | 100% (28-0-0) | 93% (26-0-2) | 93% (24-4-0) | 98% | 95% | 37 of 42 |
| r02 | 95.2% | 77-6-1 | 100% (28-0-0) | 93% (25-2-1) | 93% (24-4-0) | 95% | 98% | 37 of 42 |
| Current | 95.2% | 78-4-2 | 100% (28-0-0) | 96% (27-0-1) | 89% (23-4-1) | 98% | 95% | 37 of 42 |

**The weak bots' side:**

| Weak bot | When ahead (W-D-L) | When behind (W-D-L) |
|---|---|---|
| Fortress | 1-8-33 | 0-4-38 |
| Lookahead | 4-2-36 | 0-0-42 |
| Greedy | 0-0-42 | 0-0-42 |

**Findings:**
- **Depth 6 crushes the weak bots from any start.** The depth-6 bots win about 88% of the games they *start 1–2 pieces
  behind*.
- **The weak bots throw away almost every lead.** Fortress won only 1 of 42 games it started ahead.
- **The endgame weights make no difference here.** All three depth-6 bots scored exactly 95.2%, so against weak players
  the depth does all the work.
- The 1–2 piece lead in the starts is small compared with the gap between depth 6 and depth 1–2.
- **For the user (the browser game plays Fortress):** in the endgame, depth matters far more than any of the endgame
  weights tested.

### Search time by depth (the 28 benchmark endgame positions, `tests/golden/benchmark-positions.json`; DeepFortressEndgame's evaluator; one thread)

| Depth | Total | Mean | Median | 90th percentile | Worst | Growth on the previous depth |
|---|---|---|---|---|---|---|
| 4 | 0.2 s | 8 ms | 4 ms | 22 ms | 43 ms | |
| 5 | 1.1 s | 38 ms | 17 ms | 137 ms | 202 ms | ×5 |
| 6 | 5.1 s | 184 ms | 74 ms | 738 ms | 1.0 s | ×4.6 |
| 7 | 31.7 s | 1.1 s | 354 ms | 3.7 s | 8.9 s | ×6.2 |
| **8** | **146.7 s** | **5.2 s** | **1.2 s** | **23.7 s** | **38.0 s** | ×4.6 (×29 over depth 6) |

**What this means for real games:**
- In real games, depth-6 moves took about 400–680 ms on average (stage 0 and stage 4), against 184 ms for the benchmark
  mean. Game positions with 9–10 pieces are harder than the average benchmark position.
- So **depth 8 in games is likely to be about 10–20 s per move on average, with some moves taking a minute or more.**
- A depth-8 tuning game (about 100 depth-8 moves) would take about 15–30 min per worker. That's only about 5–10 games per
  30-minute run, which is too few to test.
- The measuring script is a scratchpad copy of `RunBenchmark.ts`'s timing loop, with the depth as a parameter. It isn't
  saved in the repo.

## Current pick: r02 (2026-11-15, provisional, not yet tested in whole games)

**Why r02:** it's the only candidate at or above 50% in every comparison so far.

| Test | r02 | r43 | Current (e40 c20) | No endgame weights |
|---|---|---|---|---|
| Depth 4, against DeepFortress (176 games each) | 60.2% | 61.1% | 54.0% | 50.0% |
| Depth 6, round robin (136 games each, ± 8.4%) | **52.9%** | 48.5% | 48.5% | – |
| Depth 6, head to head | beats r43 55.1%; level with Current 50.7% | | | |
| Depth 6, Holds (not lost from behind) in the round robin | **60%** | 53% | 49% | – |
| Depth 6 against Greedy / Lookahead / Fortress | 95.2% | 95.2% | 95.2% | – |

**Honest caveats:**
- At depth 6, r02's lead over Current is inside the noise.
- Its main advantage is losing less often from behind.
- It hasn't been tested in whole games from the start (stage 5).

**How r02 plays through a game:**
- Its endgame weights (e8 c37 s1 v−24 l0) are *added* to Fortress's weights.
- They fade in as the board empties, using the default thresholds (10 and 6).

| Pieces on the board (both colours) | Search depth | Blend | material | vulnerability | strongPoints | lineExposure | edgeExposure | centrality |
|---|---|---|---|---|---|---|---|---|
| 11 or more (opening and middlegame) | 4 | 0 | 100 | 30 | 5 | 5 | 0 | 0 |
| 10 | **6** | 0 | 100 | 30 | 5 | 5 | 0 | 0 |
| 9 | 6 | 0.25 | 100 | 24 | 5.25 | 5 | 2 | 9.25 |
| 8 | 6 | 0.5 | 100 | 18 | 5.5 | 5 | 4 | 18.5 |
| 7 | 6 | 0.75 | 100 | 12 | 5.75 | 5 | 6 | 27.75 |
| 6 or fewer | 6 | 1 | 100 | 6 | 6 | 5 | 8 | 37 |

**What changes in the endgame:**
- **Centrality becomes the main positional term.** Each step a piece sits further from the edge is worth 0.37 of a piece.
- **Vulnerability falls from 30 to 6.** At depth 6 the search sees most captures itself, so the static "could be captured
  next turn" count matters less.
- **edgeExposure stays small** (8, against Current's 40). Weighting it heavily seems to make the side behind take risks to
  push enemy pieces to the edge, which is why Current loses more often from behind.
- **strongPoints and lineExposure stay as they are.**

**Checked in a real game** (scratchpad script, not saved in the repo):
- One whole game, r02 against DeepFortressEndgame from a random opening, logging every turn.
- Depth 4 was used down to 11 pieces, and depth 6 from 10 pieces (turn 81) onwards.
- The blend went 0 → 0.25 → 0.5 → 0.75 → 1 at 9, 8, 7 and 6 pieces.
- r02's evaluator matched the hand-computed blended weights on all 276 turns.
- This is also covered by `tests/endgame.test.ts`.

**Note on "depth 6 for all moves":**
- By design, the bots search depth 6 only from 10 pieces down. Before that they use depth 4.
- 10 pieces arrives early in most games (turn 9–17), so most moves of a typical game are at depth 6 anyway. In the traced
  game it was turns 81–276, about 70% of them.
- Depth 6 in the opening and middlegame hasn't been timed. Opening positions have far more moves, so it would be much
  slower than depth 6 in the endgame.

## Depth 6 on every move (r02's weights), timed (single thread; scratchpad scripts, not in the repo)
**From the starting position and after openings:**
- The standard start: 0.30 s at depth 6 (0.03 s at depth 4). There are only a few legal first moves.
- The 20 benchmark positions after 4-turn openings: mean 0.40 s, median 0.31 s, worst 1.21 s (depth 4: mean 0.03 s).

**Three whole games, depth 6 on both sides throughout:**

| Pieces left | Moves | Mean | Median | 90th percentile | Worst |
|---|---|---|---|---|---|
| 31–44 | 9 | 0.56 s | 0.51 s | 0.94 s | 0.94 s |
| 21–30 | 7 | 0.09 s | 0.06 s | 0.15 s | 0.15 s |
| 11–20 | 11 | 0.03 s | 0.02 s | 0.08 s | 0.15 s |
| ≤10 | 209 | 0.82 s | 0.51 s | 1.96 s | 5.91 s |
| **All** | 236 | **0.75 s** | | 1.83 s | **5.91 s** (99th percentile 3.92 s) |

**Findings:**
- **Depth 6 for the whole game is feasible.**
- The opening and middlegame are fast: captures are compulsory, so there are few choices, and the board thins out
  quickly.
- Nearly all the time goes on the endgame, where the bots already search at depth 6.

## Difficulty levels (added 2026-11-15 at the user's request; tests first in `tests/difficulties.test.ts`)
`src/ai/difficulties.ts` exports `DIFFICULTIES` and `DIFFICULTY_NAMES`.
- **Each difficulty has:** a `name`, a `description`, its `preset` (`null` for random), and
  `create(pieceType, board)`.
- `create` returns a `BotPlayer` with the same `makeMove()` that `src/index.ts` uses. The browser still plays Fortress;
  the UI for choosing a difficulty is for later.

| Level | Bot | Search |
|---|---|---|
| Easy | Random (`BotRandomPlayer`) | none |
| Medium | Fortress | depth 2 |
| Hard | DeepFortress | depth 4 all game |
| Impossible | **Deep6Central** (new preset): Fortress weights, plus r02's endgame weights (e8 c37 s1 v−24) blended in from 10 pieces to 6 | **depth 6 on every move** |

- **Why Hard is DeepFortress:** DeepFortressEndgame already switches to depth 6 in the endgame, so it would be too close
  to Impossible.
- **Deep6Central is left out of `ALL_PRESETS`,** so the "every preset plays a full game" test and the default tournament
  stay fast. That also means `findBuiltInSpec` (tuning configs) can't find it by name. Use `depth: 6` with its weights in
  a config instead.
- **Not yet measured:** how much stronger depth 6 for the whole game is than DeepFortressEndgame (depth 4, then depth 6
  from 10 pieces).

## Impossible against Hard in whole games (`e5a-impossible-vs-hard.json`, `e5a-output.txt`)
- **The bots:**
  - Impossible: Deep6Central's settings, "depth=6" in the output (a one-value depth grid, so the bot isn't called
    "Base");
  - Hard: DeepFortress.
- **The games:** 40 paired random 4-turn openings (seed 3501, at most 2 pieces of imbalance), each played with both
  colours. 80 games in 13.6 min (about 10 s per game with 3 workers). No game hit the turn limit.

| Bot | Score | ± | W-D-L | Decisive | ms/turn |
|---|---|---|---|---|---|
| **Impossible (depth 6 all game)** | **70.6%** | 10.0% | 37-39-4 | 90% | 691 |
| Hard (DeepFortress, depth 4) | 29.4% | | 4-39-37 | 10% | 13 |

**Split by who was ahead after the opening:**

| Impossible started | W-D-L |
|---|---|
| Ahead | 13-18-1 |
| Behind | 14-16-2 |
| Level | 10-5-1 |

**Findings:**
- **Impossible is clearly stronger than Hard.** 70.6% ± 10%, and it lost only 4 of 80 games.
- **Half the games are still drawn.** When something is decided, Impossible wins 9 times in 10.
- **It wins from behind as often as from ahead** (14 against 13), so the opening imbalance hardly matters at this gap in
  depth.
- **Speed:** 0.69 s per move on average with 3 games running at once, against 13 ms for Hard.
- **For comparison:** in stage 0, DeepFortressEndgame (depth 4, then 6 from 10 pieces) scored 55% ± 22% against
  DeepFortress over 20 games. That's too few games to say whether depth 6 on every move beats depth 6 only in the
  endgame. A direct Deep6Central against DeepFortressEndgame match would answer it.

## Summary so far (for a quick restart)
- **What helps at endgame depth 4:**
  - **centrality** as the main endgame term (about 15–75);
  - **small** edgeExposure (0–16);
  - strongPoints kept at its normal +5 or raised in the endgame;
  - vulnerability and lineExposure offsets near 0.
- **What hurts:**
  - edgeExposure above about 45;
  - negative edgeExposure or centrality;
  - pushing strongPoints negative in the endgame.
- **The current preset weights (e40 c20):** better than no endgame weights (54% against 50%), but they lose about twice as
  often from behind (Holds 58% against 77–88% for the leaders).
- **Best candidates so far** (each about 59–61% against DeepFortress at depth 4; they can't be separated from each other):
  - **r43:** e7 c21 s15 v−1 l2;
  - **r02:** e8 c37 s1 v−24;
  - **r17:** c73 s3 l−12;
  - **r09:** e12 c15 s−4 v16 l1;
  - the simple **C20** (c20 only) scores 58%.
- **Not yet tested:**
  - anything at depth 6 from endgame starts;
  - the thresholds (stage 4; the code is ready: `endgameStart`/`endgameFull`);
  - whole-game validation (stage 5).

## Appendix: every setting tested in round 1 (`e3a`, 48 games each against DeepFortress, endgame depth 4)
- **Weights:** these are the *endgame* additions on top of Fortress (m100 v30 s5 l5). e = edgeExposure, c = centrality,
  s = strongPoints, v = vulnerability, l = lineExposure.
- **Round 2 column:** that bot's score on round 2's 64 new starts (128 games). "dropped" means it wasn't carried forward.
- **Files:** the full results, including the per-opponent and ahead/behind records, are in
  `tuning/results/2026-11-14T17-49-20-e3a-screen-d4.json` and `…18-06-47-e3b-round2-d4.json`.

| Rank | Bot | Endgame weights (e c s v l) | Score | W-D-L | Converts | Holds | Round 2 |
|---|---|---|---|---|---|---|---|
| 1 | r43 | e7 c21 s15 v-1 l2 | 61.5% | 16-27-5 | 45.8% | 83.3% | 60.9% |
| 2 | r20 | e2 c1 s4 v0 l21 | 60.4% | 16-26-6 | 54.2% | 79.2% | 57.0% |
| 3 | C20 | e0 c20 s0 v0 l0 | 59.4% | 16-25-7 | 50.0% | 75.0% | 57.4% |
| 4 | r01 | e2 c1 s-2 v5 l17 | 59.4% | 14-29-5 | 37.5% | 83.3% | 57.0% |
| 5 | E40 | e40 c0 s0 v0 l0 | 58.3% | 17-22-9 | 50.0% | 66.7% | 57.8% |
| 6 | r02 | e8 c37 s1 v-24 l0 | 58.3% | 15-26-7 | 45.8% | 75.0% | 60.9% |
| 7 | r11 | e-3 c47 s0 v-20 l-1 | 58.3% | 17-22-9 | 54.2% | 66.7% | 59.0% |
| 8 | r46 | e23 c50 s-1 v2 l6 | 58.3% | 14-28-6 | 41.7% | 83.3% | 55.1% |
| 9 | r23 | e0 c4 s-1 v-3 l3 | 57.3% | 14-27-7 | 37.5% | 79.2% | 55.9% |
| 10 | r54 | e0 c10 s4 v-16 l-5 | 57.3% | 15-25-8 | 45.8% | 75.0% | 56.6% |
| 11 | r55 | e-3 c17 s9 v1 l-6 | 57.3% | 14-27-7 | 45.8% | 75.0% | 55.1% |
| 12 | Current l-5 | e40 c20 s0 v0 l-5 | 56.3% | 16-22-10 | 50.0% | 66.7% | 53.5% |
| 13 | r05 | e16 c7 s13 v26 l8 | 56.3% | 13-28-7 | 45.8% | 79.2% | 59.0% |
| 14 | r09 | e12 c15 s-4 v16 l1 | 56.3% | 16-22-10 | 58.3% | 66.7% | 60.5% |
| 15 | r17 | e0 c73 s3 v0 l-12 | 56.3% | 15-24-9 | 45.8% | 66.7% | 61.3% |
| 16 | r30 | e1 c-2 s7 v56 l1 | 56.3% | 12-30-6 | 41.7% | 79.2% | 53.1% |
| 17 | Current v+30 | e40 c20 s0 v30 l0 | 55.2% | 13-27-8 | 41.7% | 70.8% | 54.7% |
| 18 | r29 | e4 c31 s9 v3 l-1 | 55.2% | 14-25-9 | 50.0% | 66.7% | dropped |
| 19 | r42 | e5 c1 s-2 v2 l-10 | 55.2% | 13-27-8 | 37.5% | 70.8% | dropped |
| 20 | Current s-5 | e40 c20 s-5 v0 l0 | 54.2% | 17-18-13 | 58.3% | 54.2% | 52.0% |
| 21 | Current v-30 | e40 c20 s0 v-30 l0 | 54.2% | 16-20-12 | 54.2% | 66.7% | 53.9% |
| 22 | r36 | e-1 c41 s12 v-28 l5 | 54.2% | 12-28-8 | 37.5% | 70.8% | dropped |
| 23 | r45 | e0 c1 s-1 v-2 l2 | 54.2% | 13-26-9 | 45.8% | 62.5% | dropped |
| 24 | r49 | e29 c3 s17 v-19 l5 | 54.2% | 12-28-8 | 41.7% | 70.8% | dropped |
| 25 | r33 | e-2 c3 s2 v-11 l1 | 52.1% | 11-28-9 | 33.3% | 70.8% | dropped |
| 26 | r47 | e35 c-15 s7 v-7 l11 | 52.1% | 12-26-10 | 37.5% | 62.5% | dropped |
| 27 | Current | e40 c20 s0 v0 l0 | 51.0% | 13-23-12 | 37.5% | 58.3% | 55.1% |
| 28 | r07 | e-5 c64 s1 v75 l-15 | 51.0% | 11-27-10 | 37.5% | 62.5% | dropped |
| 29 | r26 | e-2 c-3 s3 v11 l0 | 51.0% | 10-29-9 | 33.3% | 66.7% | dropped |
| 30 | r32 | e3 c-1 s0 v0 l-2 | 51.0% | 10-29-9 | 33.3% | 70.8% | dropped |
| 31 | r38 | e1 c2 s0 v-4 l-19 | 51.0% | 10-29-9 | 29.2% | 66.7% | dropped |
| 32 | r41 | e9 c-7 s25 v62 l-8 | 51.0% | 7-35-6 | 25.0% | 79.2% | dropped |
| 33 | r53 | e11 c0 s-18 v-4 l0 | 51.0% | 11-27-10 | 33.3% | 70.8% | dropped |
| 34 | r04 | e0 c0 s11 v-6 l-3 | 50.0% | 8-32-8 | 25.0% | 75.0% | dropped |
| 35 | r13 | e27 c-1 s-13 v2 l25 | 50.0% | 10-28-10 | 37.5% | 66.7% | dropped |
| 36 | r27 | e15 c-1 s2 v-5 l-9 | 50.0% | 7-34-7 | 16.7% | 79.2% | dropped |
| 37 | r35 | e-12 c14 s29 v45 l3 | 50.0% | 8-32-8 | 25.0% | 75.0% | dropped |
| 38 | r44 | e21 c-2 s-8 v-8 l-6 | 50.0% | 10-28-10 | 33.3% | 66.7% | dropped |
| 39 | Base | e0 c0 s0 v0 l0 | 47.9% | 8-30-10 | 29.2% | 66.7% | 50.8% |
| 40 | r06 | e4 c-1 s-17 v1 l22 | 47.9% | 7-32-9 | 25.0% | 75.0% | dropped |
| 41 | r12 | e-4 c5 s-8 v22 l-17 | 47.9% | 5-36-7 | 16.7% | 75.0% | dropped |
| 42 | r21 | e-2 c-2 s5 v4 l16 | 47.9% | 8-30-10 | 25.0% | 70.8% | dropped |
| 43 | r22 | e-1 c0 s19 v7 l0 | 45.8% | 7-30-11 | 25.0% | 66.7% | dropped |
| 44 | r24 | e-5 c-3 s5 v41 l-4 | 45.8% | 8-28-12 | 25.0% | 62.5% | dropped |
| 45 | r48 | e-10 c8 s-3 v0 l0 | 45.8% | 7-30-11 | 16.7% | 62.5% | dropped |
| 46 | r52 | e0 c-7 s0 v19 l9 | 45.8% | 8-28-12 | 25.0% | 58.3% | dropped |
| 47 | r03 | e0 c0 s-5 v-14 l4 | 44.8% | 9-25-14 | 29.2% | 58.3% | dropped |
| 48 | r19 | e64 c2 s-2 v30 l-2 | 44.8% | 10-23-15 | 29.2% | 45.8% | dropped |
| 49 | r25 | e2 c-11 s1 v33 l1 | 44.8% | 6-31-11 | 20.8% | 62.5% | dropped |
| 50 | r56 | e40 c88 s0 v-9 l13 | 44.8% | 12-19-17 | 45.8% | 45.8% | dropped |
| 51 | r15 | e-9 c-10 s22 v9 l-3 | 43.8% | 6-30-12 | 20.8% | 62.5% | dropped |
| 52 | r51 | e-15 c11 s-10 v-2 l7 | 43.8% | 6-30-12 | 16.7% | 58.3% | dropped |
| 53 | r08 | e6 c-9 s-12 v14 l-1 | 40.6% | 5-29-14 | 16.7% | 58.3% | dropped |
| 54 | r34 | e2 c-18 s0 v6 l4 | 40.6% | 4-31-13 | 12.5% | 58.3% | dropped |
| 55 | r37 | e-8 c4 s-5 v3 l2 | 40.6% | 6-27-15 | 16.7% | 54.2% | dropped |
| 56 | r39 | e-7 c-4 s0 v12 l-6 | 38.5% | 3-31-14 | 12.5% | 58.3% | dropped |
| 57 | r18 | e-1 c0 s-15 v-1 l-1 | 37.5% | 4-28-16 | 12.5% | 50.0% | dropped |
| 58 | r31 | e52 c86 s-6 v-1 l28 | 37.5% | 8-20-20 | 33.3% | 41.7% | dropped |
| 59 | r40 | e49 c24 s1 v83 l-1 | 37.5% | 6-24-18 | 25.0% | 41.7% | dropped |
| 60 | r28 | e-15 c-5 s-7 v-3 l0 | 34.4% | 3-27-18 | 4.2% | 45.8% | dropped |
| 61 | r14 | e72 c6 s-1 v0 l-3 | 33.3% | 7-18-23 | 20.8% | 41.7% | dropped |
| 62 | r10 | e-18 c-15 s2 v0 l-14 | 32.3% | 1-29-18 | 4.2% | 50.0% | dropped |
| 63 | r50 | e87 c-5 s-1 v1 l11 | 25.0% | 2-20-26 | 8.3% | 29.2% | dropped |
| 64 | r16 | e79 c26 s-3 v8 l0 | 21.9% | 3-15-30 | 12.5% | 25.0% | dropped |
