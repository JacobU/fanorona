# Tuning bot weights

Run a config file:

```
npm run tune -- tuning/grid.json
npm run tune -- tuning/ablation.json --games 40     # override gamesPerPair
npm run tune -- tuning/sweep.json --workers 1       # run on a single thread
```

Games are spread over your CPU cores (all but one, unless you pass `--workers`). Each run prints a ranking
and saves the full results to `tuning/results/<date>-<config>.json` (this folder is gitignored).

## Config files

| Field | Default | Meaning |
|---|---|---|
| `mode` | `"gauntlet"` | `"gauntlet"`: each variant plays each opponent, variants don't play each other. `"roundRobin"`: everyone (variants and opponents) plays everyone. |
| `gamesPerPair` | `20` | Games per pairing. Colours alternate, so use an even number. |
| `maxTurns` | `1000` | Safety limit: a game is stopped and counted as a draw after this many turns. Games normally end long before this, because they're drawn after 60 turns without a capture (`NO_CAPTURE_DRAW_TURNS` in `src/Board.ts`). |
| `openings` | none | `{ "count", "turns", "seed" }`: every pair plays the same seeded random openings, once with each colour (2 × count games per pair; `gamesPerPair` is ignored). |
| `endgameStarts` | none | `{ "count", "seed", "minPieces": 6, "maxPieces": 9, "minImbalance": 1, "maxImbalance": 2 }`: like `openings`, but every game starts from an endgame position where one side is ahead (made by Fortress playing both sides from a few random turns). The output then also shows **Converts** (games won when starting ahead) and **Holds** (games not lost when starting behind). Use either `openings` or `endgameStarts`. |
| `opponents` | `[]` | Built-in bots to play against: `Random` or any preset name (`Greedy`, `Lookahead`, `Guardian`, `Sentinel`, `Positional`, `Fortress`, `DeepSentinel`, `DeepPositional`, `DeepFortress`, `FortressEndgame`, `DeepFortressEndgame`). |
| `base` | required | `{ "depth": 2, "weights": { ... } }`. The starting point for the grid and variants. Can also have `endgameWeights` (extra weights blended in as the board empties: none at 10+ pieces, in full at 6 or fewer) and `endgameDepth` (search depth once 10 or fewer pieces are left). `endgameStart` and `endgameFull` change those thresholds (10 and 6) for this bot. |
| `grid` | none | Lists of values to try, e.g. `{ "strongPoints": [0, 5, 15] }`. Every combination is tried on top of `base`. Keys can be any evaluator name or `depth`. |
| `variants` | none | Hand-picked bots, e.g. `{ "name": "No strongPoints", "weights": { "strongPoints": 0 } }`. Each one changes only the weights it lists (and likewise for `endgameWeights`, and `endgameDepth`, `endgameStart` and `endgameFull` if given). |

Weight names: `material`, `vulnerability`, `strongPoints`, `lineExposure`, `edgeExposure`, `centrality` (a missing or 0 weight
switches that evaluator off). The `mobility` evaluator has been removed (along with the Strangler and AllRounder presets),
so older configs in `campaigns/` that use it no longer run. Without a `grid`, `base` also plays, as `Base`.

## Reading the results

- **Score** is points per game: 1 for a win, ½ for a draw. 50% means evenly matched.
- **Win / Draw / Loss** are the share of games with each result. Two bots can have the same score in very
  different ways: 50% wins and 50% losses, or 100% draws.
- **Decisive** is the share of the games with a winner that the bot won (draws are ignored). A bot with a
  high Decisive but a high Draw rate wins when something happens, but often can't force anything to happen.
- **±** is how far the score could be off just by chance (95% confidence). If two bots' scores are closer
  together than their ± values, the difference might just be luck. Run more games to shrink it
  (4× the games halves the ±).
- **vs X** columns show the score against each opponent.
- With a two-key `grid`, a table shows the score (and draw rate) for each combination. If the best value of one setting
  changes depending on the other setting, the two interact.

## Example configs

- `grid.json`: vulnerability × strongPoints around the Fortress weights, to see how they interact.
- `sweep.json`: tries a range of values for one weight (strongPoints).
- `ablation.json`: Fortress with each metric switched off in turn, to see which ones are pulling their weight.
