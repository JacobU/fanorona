# Handoff: tuning the endgame bots (depth-6 searches)

This brief is for a new Claude Code session. It explains the project, what has been done so far, how the user likes to
work, and what the endgame tuning job is. Read it all before doing anything. Then confirm the plan with the user
(section 6) before running anything expensive.

Written 2026-11-15. The working copy is on `main`. The last commit is `9ecf6a9` ("End game bots and refactor"), and the
work since then (Steps 3–4 of the performance work, and the trapped-player rule) is still uncommitted. **Don't discard
or commit anything unless the user asks.**

---

## 1. How the user likes to work (follow these closely)

The project's memory folder (`~/.claude/projects/C--Users-kieren-Documents-programming-fanorona/memory/`) holds some of
these, and loads automatically. The full list:

- **Checkpoints before expensive stages.** Run a cheap stage, report the results, and **wait for the go-ahead** before
  starting the next expensive one. Never chain several long runs without reporting in between.
- **Report results as they arrive.** When a long run finishes a round or generation, summarise it straight away
  (tables, the key finding, what it means), while the next run goes ahead if already approved.
- **Explain in depth when results are surprising,** e.g. if they contradict earlier findings (such as the depth-2 results
  below). Say what differs, the likely cause, and how to check it.
- **Tuning is report-only.** **Never change presets or defaults without asking.** Propose changes and let the user decide.
- **Tests first.** For any code change, write the tests, show they fail, then write code that makes them pass. Never bend
  a test to fit the code. Only change an existing test when the behaviour it checks has deliberately changed, and say why.
- **Hard requirement: the board is unchanged after any search, move generation or evaluation.** Every code change in this
  area needs tests proving it (see `tests/helpers/boardInvariance.ts`).
- **Keep the user's prose comments** in the code, even if new code makes them look redundant.
- **Ask clarifying questions** with concrete options (AskUserQuestion), with a recommended option first. When numbers
  matter (game counts, weights, time budgets), check them with the user.
- **Explain before implementing** anything non-trivial, and give a recommendation rather than a long list of options.
- **Keep agents and answers to what was asked.** A yes/no question about the code is answered by reading the code, not by
  running experiments. Don't add extra experiments to an agent's brief unless the user asks.
- **Use config files and temporary files for tuning, rather than writing new code** where possible. Keep the configs,
  outputs and a REPORT.md in a campaign folder (section 5) so the work can be picked up at any time.
- **Long runs:** start them with the Bash tool's `run_in_background`, not with `&`, so you're told when they finish. All
  the runners save their state after each round or generation, so a run can be stopped and resumed.
- **British spelling** in code and docs (colour, optimise, behaviour).
- **Declined ideas:** the user has decided against iterative deepening with a work budget, transposition tables,
  bitboards and C++/WASM. Don't propose them again. If depth-6 timing really becomes a blocker, report the measurements
  and let the user decide.

---

## 2. The project

Fanorona, a board game, in TypeScript. It has a browser UI (`src/index.ts`, `src/fanorona.html`) and AI bots in
`src/ai/`. The board is 5×9 (45 cells), and each side starts with 22 pieces.

**Rules as implemented (`src/Board.ts`):**
- Captures by **approach** (moving towards an opponent piece along a line) or **withdrawal** (moving directly away from
  an adjacent one). They take the whole unbroken line of opponent pieces.
- **The first capture of a turn is compulsory**, but continuing a capture chain is **optional**: the player may stop
  after any capture. A chain can't revisit a cell or move twice in the same direction in a row. A non-capturing
  ("paika") move ends the turn.
- **Draw** after 60 turns in a row without a capture (`NO_CAPTURE_DRAW_TURNS`, `Winner.DRAW`).
- **A player who can't move at the start of their turn loses** (added 2026-11-15, in `Board.getWinner`).
- A player wins by capturing every opposing piece.

**Key AI files:**
| File | What it does |
|---|---|
| `src/ai/evaluators.ts` | The metrics, each written as "us minus them": `material`, `vulnerability` (pieces the opponent could capture on their first step, via the fast `Board.countCapturablePieces`), `strongPoints`, `lineExposure` (connected pairs), `edgeExposure` and `centrality` (endgame metrics) |
| `src/ai/presets.ts` | `EVALUATORS`, `Weights`, `createPreset(name, depth, weights, description, { endgameWeights, endgameDepth })`, and all presets |
| `src/ai/endgame.ts` | `ENDGAME_START_PIECES = 10`, `ENDGAME_FULL_PIECES = 6`, `endgameFactor`, `blendEndgame`, `searchDepthFor` |
| `src/ai/Search.ts` | `chooseMove` / `findBestMoves` / `negamax` (alpha-beta, strict cut-offs so every tied-best move is found, ties broken by an injected `rng`). Also `searchStats.nodes` and `searchOptions.orderMoves` |
| `src/ai/SearchBot.ts` | A bot that plays a preset, choosing the depth with `searchDepthFor` each turn |
| `src/ai/Tournament.ts` | `playGame(white, black, maxTurns, rng, opening, onTurnStart)` |
| `src/ai/tuning/*` | `BotSpec` (presets as data for worker threads), `TuningConfig`, `Tuner` (`runTuning`, `playPairings`), `GamePool` + `worker.ts` (parallel games), `Openings` (paired seeded openings), `Texel`, `Sampling` (Latin hypercube), `Cmaes` |

**The search is a correct minimax** (negamax with alpha-beta) at every depth, including depth 6. An agent checked this on
2026-11-15 against a plain minimax, with 0 disagreements over hundreds of positions at depths 1–6.

**Presets** (material is always 100):
| Preset | Depth | Weights | Endgame |
|---|---|---|---|
| Greedy | 1 | material | |
| Lookahead | 2 | material | |
| Guardian | 1 | + vulnerability 30 | |
| Sentinel / DeepSentinel | 2 / 4 | + vulnerability 30 | |
| Positional / DeepPositional | 2 / 4 | + strongPoints 5, lineExposure 5 | |
| Fortress / DeepFortress | 2 / 4 | vulnerability 30, strongPoints 5, lineExposure 5 | |
| FortressEndgame / DeepFortressEndgame | 2 / 4 | Fortress weights | `endgameWeights { edgeExposure: 40, centrality: 20 }`, `endgameDepth: 6` |

The browser game plays against **Fortress**. Strangler and AllRounder were deleted along with mobility (see 3.6).

---

## 3. History (what's been done, and what was learned)

### 3.1 Modular evaluation and search
`Board.getBestMoveSimple` (material only, 1 turn) was replaced by the modular evaluators, weighted sums and negamax above.
Ratings were removed from `Board`, and the bots moved to `src/ai/`.

### 3.2 Rule fixes
- Same-direction chain continuation (not allowed).
- A paika move can't be followed by a capture.
- `reset()` recounts the pieces.
- Optional chain continuation, including an "End turn" button in the UI. Bots treat every stopping point as a candidate move.
- The 60-turn no-capture draw.
- The trapped-player loss (2026-11-15).

### 3.3 Tuning tools
Run them with `npm run tune|tournament|texel|halving|cmaes`. The full config reference is in `tuning/README.md`.

- **`npm run tune -- <config.json> [--games N] [--workers N]`:** a gauntlet or round robin of variants built from `base`
  plus a `grid` or `variants`.
  - **Supports `endgameWeights` and `endgameDepth`** in `base` and `variants`.
  - Supports `"openings": { "count", "turns", "seed" }`: every pair plays the same seeded random openings, once with
    each colour.
  - Results go to `tuning/results/` (gitignored).
- **`npm run tournament -- [gamesPerPair] [names...] [--workers N]`:** a round robin of presets.
- **`npm run halving -- <config> <state>`:** successive halving over a Latin hypercube of weights, one round per run, and
  resumable.
- **`npm run cmaes -- <config> <state>`:** CMA-ES refinement, a few generations per run, and resumable.
- **`npm run texel -- collect|fit`:** Texel logistic fit.
- **Important limitation:** `RunHalving.ts` and `RunCmaes.ts` only build bots from `depth` + `weights`. They don't pass
  `endgameWeights`/`endgameDepth` yet (see `src/RunHalving.ts:84`, `src/RunCmaes.ts:74-76`). To tune endgame weights with
  them, they need a small extension (tests first, with the user's go-ahead).
- **The machine has 4 logical CPUs.** By default the runners use all but one (3 workers).

### 3.4 Tuning campaigns (in `tuning/campaigns/`; read the REPORT.md files for detail)
- **`2026-11-14-depth2/`, `2026-11-14-depth4/`:** the early results.
  - The depth-2 "tuned" weights crushed Fortress, but **this was an artefact**. Every game started from the standard
    position, so a few lines were replayed over and over.
  - **Lesson: always compare bots on varied, paired openings.**
  - At depth 4, weights mattered much less, and nothing clearly beat DeepFortress.
- **`2026-11-14-texel/`:** the proper global search, using paired 4-turn openings filtered to at most 2 pieces of imbalance.
  - **Texel:** its weights played worse (correlation, not causation; it overvalued strongPoints at 65).
  - **Successive halving:** 128 Latin-hypercube settings and 16,416 games. The best was **s030**: v−3 m−1 s12 l9 (60.3%
    against Fortress/AllRounder/Lookahead).
  - **CMA-ES:** couldn't beat s030.
  - **Mobility:** −1 was worth about 8 points at depth 2 (s030 with mobility 0 scored 56%, about the same as Fortress's
    weights at 56.8%).
  - **Since then, mobility has been removed** (3.6), so s030 as found can no longer be run. Without mobility it's
    v−3 s12 l9, which is no better than Fortress's weights at depth 2.
  - Large weights (≥60) are bad. Modest positive strongPoints and lineExposure are good.
- **Known metric flaw:** `strongPoints` counts corners as strong points (all even-numbered cells), but corners are among
  the worst squares in the endgame.

### 3.5 The endgame work (built by an agent, tests first, `tests/endgame.test.ts`)
- **`edgeExposure`:** opponent pieces on the edge minus ours, with corners counting 2.
- **`centrality`:** our pieces' distance from the nearest edge, minus theirs.
- **Blending:** the endgame weights are added on top of the normal ones, scaled by `endgameFactor`. That is 0 at 10 or
  more pieces (both colours combined), 0.25 at 9, 0.5 at 8, 0.75 at 7, and 1 at 6 or fewer.
- **Depth:** `endgameDepth` (6) is used once there are 10 or fewer pieces. The depth is chosen once per move, at the root.
- **Open concerns raised but not yet decided by the user:**
  1. **10 pieces arrives early.** Almost every game reaches 10 or fewer pieces by about turn 9–17 (Fortress against
     Fortress hits it at turn 11). So the "endgame" settings are active for about three-quarters of a typical game. The
     thresholds are module constants, not per-preset settings, so tuning them would need a code change.
  2. The endgame weights (edgeExposure 40, centrality 20) are **guesses**.
  3. The strongPoints corner flaw (above) works against the endgame metrics.

### 3.6 Performance work (2026-11-15; full details in `docs/performance-plan.md`)
- **Removed:** the `mobility` evaluator, and the Strangler and AllRounder presets. Old configs that use mobility are
  rejected. `RunTexel fit` maps old saved feature lists by name.
- **The safety net:**
  - `Board.getFullStateForTesting()`, a full snapshot including the undo depth;
  - `tests/helpers/boardInvariance.ts`;
  - 300 fixed test positions (`src/ai/testPositions.ts`);
  - golden results from the original code in `tests/golden/golden.json`. `npm run golden` refuses to overwrite them
    without `--force`, and that needs the user's approval.
  - `npm test` (quick, about 5 s) and `npm run test:full` (everything, about 10 s).
- **The speed-ups,** each proven to give identical results: lookup tables (`src/BoardTables.ts`), line-walk capture
  detection, allocation-free piece checks, make/unmake moves (`Board.makeCompleteMove` / `unmakeCompleteMove`), a fast
  `countCapturablePieces` for vulnerability, and trying longer capture chains first below the root.
- **The benchmark** (`npm run bench [-- --label name]`, positions in `tests/golden/benchmark-positions.json`, results in
  `docs/benchmarks/`):

| | Original | Now |
|---|---|---|
| DeepFortress depth 4, 20 openings: median / worst, total | 280 / 788 ms, 6.3 s | 25 / 108 ms, 0.7 s |
| DeepFortressEndgame depth 6, 28 endgames: median / 90th percentile / worst, total | 220 ms / 2.6 s / 3.9 s, 17.8 s | 73 / 765 / 985 ms, 5.2 s |

  Earlier, on other positions, single depth-6 searches took up to 6–25 s. Expect occasional slow moves in lopsided
  positions (e.g. 8 pieces against 2).

---

## 4. The job: tune the endgame bots with depth-6 searches

**The goal:** find good endgame settings (the endgame weights, and possibly the thresholds and base weights) for bots
that search 6 turns ahead once 10 or fewer pieces remain. Then show whether they beat the current presets (DeepFortress
and DeepFortressEndgame) in whole games.

### Suggested stages (agree them with the user first; report after each)
0. **Baseline and timing (cheap).**
   - Run `npm test` and `npm run test:full` to confirm everything is green.
   - Run a small match (e.g. `npm run tune` with `openings`, about 10 paired openings) between DeepFortressEndgame and
     DeepFortress. Measure the seconds per game and the ms per depth-6 move under 3 workers, then estimate how many
     games per hour are affordable.
   - **Report, and agree a game budget with the user.**
1. **Endgame starting positions (code; tests first; ask first).** The idea (already discussed with the user): play
   random or bot games from paired openings until 6–10 pieces remain, keeping positions where one side is 1–2 pieces
   ahead. Then measure how often the side that's ahead converts to a win, and how often the side that's behind holds the
   draw.
   - This tests endgame skill directly, instead of hoping it shows up in whole games.
   - The existing machinery plays games from an `Opening` (a list of complete moves applied from the start), so an
     endgame start can be represented as a longer move list. That needs a generator, e.g.
     `generateEndgameStarts(count, { maxPieces, imbalance }, seed)` in `src/ai/tuning/Openings.ts`, plus tests that
     check:
     - the starts are deterministic for a seed;
     - every start has the requested piece counts;
     - none is already finished;
     - both colours play each start.

     Check whether `generateOpenings`'s "even number of turns" rule matters here, given each start is played with both
     colours.
2. **Measure the current endgame bots from those starts (cheap to moderate).** Compare FortressEndgame and
   DeepFortressEndgame with Fortress and DeepFortress, and endgame weights {40, 20} with {0, 0}. Look at conversion
   rates, draw rates, and seconds per game.
3. **Tune the endgame weights.** Start with `npm run tune` `grid`/`variants` on `endgameWeights` (no code needed): e.g.
   edgeExposure × centrality, and possibly an endgame strongPoints offset to cancel the corner flaw. If a wider search is
   wanted, extend `RunHalving`/`RunCmaes` to carry `endgameWeights`/`endgameDepth` (tests first, with the user's
   go-ahead).
4. **(Optional, needs the user's decision) The thresholds.** Making `ENDGAME_START_PIECES`/`ENDGAME_FULL_PIECES`
   per-preset or per-spec settings (a code change) would allow testing e.g. 10→6 against 8→4 against 6→3.
5. **Whole-game validation.** Play the best endgame settings against DeepFortress and DeepFortressEndgame from paired
   4-turn openings, with enough games for a clear answer (a sequential test such as SPRT was planned earlier).
6. **Recommend preset changes** in a report, and let the user decide. Don't edit presets yourself.

### Practical notes
- **Depth 6 is the expensive part.** Use `--workers` to control parallelism, and keep the machine otherwise idle when
  timing. If a run is too slow, stop and report rather than cutting corners silently.
- **Paired openings everywhere** (`"openings": { "count": N, "turns": 4, "seed": S }`). Use fresh seeds for each new
  stage so you don't overfit to one set of openings.
- **Statistics:** the tune output shows a 95% "±". Treat differences smaller than that as noise. 4× the games halves the
  ±. Report the win/draw/loss counts as well as the scores, because endgame bots may differ mainly in draw rate.
- **Bot-vs-bot games are capped by `maxTurns`** (default 1000). Normally they end through the 60-turn no-capture draw.

---

## 5. Where to keep the work

- **The campaign folder:** create `tuning/campaigns/2026-11-<day>-endgame-depth6/` with:
  - each stage's config (`e0-baseline.json`, `e1-...`);
  - its printed output (`e0-output.txt`);
  - state files for resumable runners;
  - a **`REPORT.md`** that's updated after every stage. It should give the status, conditions, a results table per stage,
    findings, and next steps, following the style of `tuning/campaigns/2026-11-14-texel/REPORT.md`.
- **Running from the folder:** runners can be run from the campaign folder (e.g.
  `node ../../../dist/src/RunHalving.js cfg.json state.json` after `npm run build:src`), so results land next to the configs.
- **Memory:** update the project memory note on tuning
  (`memory/project_tuning_campaign_depth2.md` and the `MEMORY.md` index) to point at the new REPORT.md, so a later session
  can pick it up.
- **Code changes:** after any code change, run `npm test`, `npm run test:full` and `npm run build` (the browser bundle).
  The golden results and board-unchanged tests must still pass. If a deliberate rule or behaviour change alters the golden
  results, show the user exactly which positions changed and why before regenerating them with `npm run golden -- --force`.

---

## 6. First thing to do in the new session

1. Read this file, `tuning/README.md`, `tuning/campaigns/2026-11-14-texel/REPORT.md` and `docs/performance-plan.md`.
2. Run `npm test` to confirm the starting point.
3. Ask the user (with AskUserQuestion) to confirm:
   - the stages above;
   - the time and game budget;
   - whether to build the endgame starting positions (stage 1) or go straight to whole-game tuning;
   - which base weights to use for the endgame bots (Fortress's v30 s5 l5 is the current default; s030 without mobility
     is v−3 s12 l9);
   - whether thresholds are in scope.
4. Then run stage 0 and report.
