# Search performance optimisation plan (TypeScript first)

Status: planned 2026-11-14. Implement one step at a time, reporting after each.

**Decisions on 2026-11-15:**
- **Doing Steps 0–3 only.**
- **The mobility evaluator was removed** (done), with the Strangler and AllRounder presets, and the browser bot is now
  Fortress. The other metrics are expected to cover what mobility measured. Step 4 isn't needed any more.
- **Not doing Step 5** (move ordering, iterative deepening with a work budget, the transposition table) **or Step 6**
  (bitboards or C++/WASM). Without Step 5 nothing caps how much work the search does, so the endgame depth-6 worst case
  only shrinks by however much faster Steps 1–3 make each position.

Steps 4–6 below are kept for reference.

## Progress and benchmark results
Run `npm run bench` for the timings, `npm test` for the quick checks and `npm run test:full` for every check. Results are
saved in `docs/benchmarks/`.

- **Step 0 (done 2026-11-15):**
  - The tools:
    - `Board.getFullStateForTesting()` and `tests/helpers/boardInvariance.ts`;
    - `findBestMoves` in `src/ai/Search.ts` (chooseMove picks from it) and the `searchStats.nodes` counter;
    - 300 fixed test positions (`src/ai/testPositions.ts`);
    - golden results from the original code, in `tests/golden/golden.json` (`npm run golden`, `src/ai/golden.ts`);
    - the benchmark, `src/RunBenchmark.ts`.
  - Quick tests take about 8 s and full tests about 18 s.
- **Step 1 (done 2026-11-15):** a neighbour table (`src/BoardTables.ts`) built once per board size from the cells' connections.
  It's used by `willMoveApproach`, `willMoveWithdraw`, `removeAttackedPieces`, the empty-neighbour helpers and
  `getConnectedIndexes`. The separate line tables weren't needed, because following the neighbour table walks a line.
  The typed-array copy of the pieces was moved to Step 3. About 1.4x faster, with identical node counts (same searches).
- **Step 2 (done 2026-11-15):** `piecesCapturedByMove` walks the line to list a move's captures without changing the board.
  `performMove` (via `removeAttackedPieces`) and `getCapturablePieces` both use it, so the capture rule is in one place.
  `getCapturablePieces` now only reads the board. It's checked against a copy of the original rule in
  `tests/captureWalk.test.ts` over every capture in the 300 test positions. Openings got about 1.45x faster and endgames
  about 1.07x faster.
  - Endgame profile after Step 2 (self time): getPossibleMovesForCell 19%, getPiecesThatPlayerCanMove 18%,
    buildMoveTreeForSinglePiece 18% (mostly saving and restoring the board), getCapturablePieces 7%, negamax 5%,
    lineExposure 4%, garbage collection 4%.
- **Step 2b (added and done 2026-11-15, after that profile):** `getPiecesThatPlayerCanMove`/`canPieceAttack` check each
  empty neighbour directly with the table instead of building move lists, and stop looking for paika-only pieces once one
  piece can attack. Checked against the plain rule in `tests/piecesThatCanMove.test.ts`. About 1.1x faster.

| Step | Openings: DeepFortress depth 4, 20 positions (median / 90% / worst ms) | Endgames: DeepFortressEndgame depth 6, 28 positions (median / 90% / worst ms) | Nodes (openings / endgames) |
|---|---|---|---|
| 0 (baseline) | 280 / 640 / 788 (6.3 s in total) | 220 / 2,630 / 3,883 (17.8 s in total) | 261,871 / 2,036,012 |
| 1 (lookup tables) | 195 / 449 / 557 (4.5 s in total) | 168 / 1,944 / 2,682 (12.9 s in total) | 261,871 / 2,036,012 |
| 2 (line-walk captures) | 138 / 344 / 391 (3.1 s in total) | 156 / 1,785 / 2,563 (12.1 s in total) | 261,871 / 2,036,012 |
| 2b (pieces that can move) | 117 / 304 / 339 (2.7 s in total) | 147 / 1,628 / 2,324 (11.1 s in total) | 261,871 / 2,036,012 |

Repeat runs vary by about 1–4%.


## Context
A depth-4 search takes about 340 ms per move with DeepFortress weights, and about 1.2 s with s030, which uses mobility.
The worst case for depth 6 in the endgame is 6–25 s. Profiling shows the time is spent on *how* the work is done,
not on the language:

| Share of time | Where it goes |
|---|---|
| 17% | `getCapturablePieces`: plays every capture on a copy of the board, then scans all 45 cells to see what disappeared |
| 12% | `performMove` |
| 17% | `willMoveApproach` / `willMoveWithdraw`: search a cell's connection list instead of looking it up directly |
| 10% | `getPiecesThatPlayerCanMove`: re-checks every cell, building temporary lists |
| 9% | `buildMoveTreeForSinglePiece`: saves and restores the whole board state at every step |
| ~5% | garbage collection: cleaning up all those temporary lists and board copies |

The decision is to optimise the TypeScript one step at a time, measuring each step, and to consider C++/WASM only if
the search is still too slow afterwards. The user wants to understand each change before it is implemented.

**Hard requirement:** after any search, move generation or evaluation, the board must be returned to exactly the
state it started in. Every step needs unit tests that prove this.

## Step 0: save the list, then build the safety net (before any optimisation)
1. **Save this list to memory** as a project memory (not possible while planning).
2. **A full-state snapshot for tests.** Add `Board.getFullStateForTesting()`. It returns everything in `saveBoardState()`
   plus `attackOrWithdraw`, which `saveBoardState` leaves out today. After the cache and Zobrist steps it also covers
   the cached counts and the hash. The tests compare against this, not just against `saveBoardState()`.
3. **A board-unchanged test helper** (`tests/helpers/boardInvariance.ts`). It takes a snapshot, runs an operation,
   then checks the snapshot is identical. It's run over many seeded positions:
   - positions from random games (openings plus random play), at turn boundaries;
   - positions in the middle of a capture chain;
   - small hand-built boards;
   - endgame positions and won/drawn positions.

   The operations: `getAllPossibleCompleteMoves`, `getCapturablePieces`, every evaluator, `chooseMove` at depths 1–4,
   `applyCompleteMove` followed by the undo, and later each new function such as make/unmake and the cache.
4. **Golden results from the current, known-correct code** (`tests/golden/*.json`, generated once by a script before
   any change). For about 300 seeded positions, record:
   - every complete move list;
   - the `getCapturablePieces` set for each side;
   - all seven evaluator values;
   - `chooseMove` at depth 2 and 3: the best score and the full set of tied-best moves (not the single pick, since
     ties are broken randomly).

   Every optimisation must reproduce these exactly. That proves it's faster *and* gives identical results.
5. **A benchmark script** (`src/RunBenchmark.ts`, `npm run bench`). It uses fixed openings (seed 9) and reports:
   - milliseconds per move at depth 4 for DeepFortress and s030;
   - positions visited by the search (a node counter in negamax);
   - depth-6 endgame timings (median, 90th percentile, worst).

   Results are recorded after every step.

## Step 1: lookup tables built once
- **Neighbours by direction:** each cell's neighbour in each of the 8 directions (or −1) in a 45×8 table. Because cell
  connections never change, `board[i].getCellConnections().some(c => c.index === x)` becomes a direct table lookup.
- **Line tables:** for each cell and direction, the list of cells along that line. Used later for walking captures.
- **Where they're used:** `willMoveApproach`, `willMoveWithdraw`, `removeAttackedPieces`, `canContinueAttackChain`,
  `hasLegalMove`, and `getEmptyNeighbouringCellsAsMoves`.
- **Typed arrays:** piece types move into a typed array, `Int8Array(45)`, alongside the `Cell` objects so the UI is unchanged.
- **Tests:** a test checks the tables match `Cell.getCellConnections()` for 3×3, 5×5 and 5×9 boards, plus the golden and
  board-unchanged tests.

## Step 2: compute captures by walking the line
- `getCapturablePieces` currently plays each capture on a copy (saving and restoring the whole state) and compares all 45
  cells. Instead, for each attacking move, walk from the target cell along the attack direction using the line table,
  collecting opponent pieces until the run breaks. That's exactly the rule in `removeAttackedPieces`.
- `removeAttackedPieces` itself is changed to use the same shared "pieces captured by this move" function, so the rule
  lives in one place.
- **Tests:** the capture set matches the golden results. A new test checks that the shared function equals the pieces
  `performMove` actually removes, over many random moves. The board is unchanged afterwards (this function only reads).

## Step 3: make/unmake moves instead of saving and restoring the whole board
- **The idea:** `makeMove` records what it changed on an undo stack (cells moved and captured, counts,
  `turnMoveIndexes`, `currentlyMovingPiece`, turn, no-capture counter). `unmakeMove` reverses exactly that. Full
  `saveBoardState`/`resetBoardState` copies are removed from the move tree builder and the search.
- **Scope:** `performMove` and `applyCompleteMove` (including `endTurn` for early stops) gain undo-recording versions.
  `buildMoveTreeForSinglePiece` and `negamax`/`chooseMove` use make → recurse → unmake. The public behaviour of
  `performMove` for the UI is unchanged.
- **Tests:**
  - unmake after make returns the full snapshot exactly. Tested after single steps, whole chains, early stops (`endTurn`),
    game-winning captures, the 60th no-capture turn (a draw), and nested make/make/unmake/unmake sequences;
  - golden and board-unchanged tests;
  - an "unmake in the wrong order" guard: debug builds check that the undo stack is empty at the end of each search.

## Step 4 (dropped: mobility was removed): count mobility without building full turns
- **The problem:** `mobility` currently builds both players' complete move trees and lists every path, only to count them.
- **The fix:** a counting function walks the same tree logic with make/unmake, adding 1 at each point where a turn could
  end (each leaf, and each point after a capture, because stopping early is allowed). It doesn't store the paths.
- **The count must be identical to today's,** because s030's −1 weight was tuned on this exact count. The golden mobility
  values enforce that.
- **Tests:** golden equality and board-unchanged.

## Step 5 (not doing): smarter search (fewer positions visited)
- **Move ordering:** in `negamax`, try captures first (more pieces captured first), then the best move from the previous,
  shallower search. Alpha-beta then prunes far more.
- **Iterative deepening with a work budget:** search depth 1, 2, 3, … until a node budget is used up, and play the result
  of the deepest *completed* depth. This is what fixes the endgame depth-6 worst case. It's capped by work, not time, so
  results stay repeatable regardless of machine load. Presets get an optional `nodeBudget`.
- **Transposition table with Zobrist hashing:** each (cell, piece) pair gets a fixed random 32-bit number, and the
  position's hash is the XOR of these, updated incrementally in make/unmake. Previously searched positions are looked up
  instead of being searched again. The key must include the side to move and the no-capture counter, because both change
  the value. Entries store depth, score and bound type, and the table is cleared between moves.
- **Tests:**
  - the best score and the set of tied-best moves match the golden results at depths 2–3, with and without each feature.
    These features must not change *what* is chosen, only how fast;
  - the incremental hash equals the hash recomputed from scratch after random make/unmake sequences;
  - board-unchanged tests;
  - the node count decreases (checked in the benchmark, not the unit tests).

## Step 6 (not doing): bitboards
- Store each side's pieces as bit sets (45 cells in two 32-bit numbers in JavaScript, since 64-bit `BigInt` is slow).
  Moves and captures then become bit shifts and masks.
- Only do this if steps 1–5 aren't enough. Also check whether that point is where to consider C++/WASM instead (native
  64-bit integers).

## Files to change
- `src/Board.ts`: tables, the shared capture walk, make/unmake, mobility counting, Zobrist hash.
- `src/Cell.ts`: unchanged (the UI still uses it).
- `src/ai/evaluators.ts`: mobility and vulnerability use the new Board methods.
- `src/ai/Search.ts`: make/unmake, ordering, iterative deepening, transposition table, node counter.
- `src/ai/presets.ts` and `src/ai/tuning/BotSpec.ts`: an optional `nodeBudget`.
- Tests: `tests/helpers/boardInvariance.ts`, `tests/golden/*`, `tests/performance-correctness.test.ts`, plus
  additions to the Board and AI tests.
- `src/RunBenchmark.ts` (new) and an `npm run bench` script.

## Verification for every step
1. `npm test` passes: all existing tests, plus golden equality, board-unchanged and the new unit tests.
2. Run the scratch move-tree consistency check (every generated move plays through `applyCompleteMove`) on 200 random games.
3. `npm run bench`: record ms per move, nodes and endgame worst case before and after the step. Report it to the user.
4. Run a short paired-opening match between the old and the new code (the same weights) to confirm they play equally well.
   Expect about 50%, since identical results only change speed.

## Process
Do one step at a time, in order. After each step, report the benchmark and test results and wait for the go-ahead before
starting the next (the user prefers checkpoints).

---

# Background: why each change helps, and how the board is kept unchanged

## Why TypeScript first and not C++/WASM
- **Translation alone:** converting the same algorithm to C++/WASM would make it about 2–4× faster. Typical gains are
  1.5–3×, and up to ~4× here because the code creates lots of short-lived lists and board copies, which C++ avoids
  cleaning up.
- **Algorithm fixes:** changing how the work is done, in TypeScript, would likely give 10–50×. The improvements multiply together.
- **What WASM costs:**
  - a second language and toolchain (Emscripten, or AssemblyScript as a TypeScript-like alternative);
  - the rules duplicated in C++, or the UI and tests calling into C++;
  - harder debugging.
- **What's fine with WASM:** it works in browsers and Node worker threads, and calls into it are cheap if the whole search
  runs inside it.
- **Decision:** optimise in TypeScript first. Consider porting only the search core if it's still too slow.

## The safety net
1. **A full-state snapshot.** `saveBoardState()` leaves out `attackOrWithdraw`, the approach-or-withdraw choice waiting to
   be applied, so checks based on it could miss a leak. `getFullStateForTesting()` captures every piece of game state.
   Every test takes a snapshot, runs a search, move generation or evaluation, and requires an identical snapshot afterwards.
   This runs over hundreds of seeded positions: turn boundaries, mid-chain, endgames, won and drawn positions.
2. **Golden results.** Before changing anything, the current (known-correct) code records its answers for about 300
   positions: every move list, every capture set, every metric value, and the best search score with the set of
   tied-best moves. Each optimised version must give exactly the same answers, which proves it's faster without changing
   behaviour.
3. **A benchmark:** ms per move and positions visited, on fixed positions, before and after each step.

## 1. Lookup tables
- **Now:** to check for an approach capture, `willMoveApproach` asks the destination cell for its connection list and
  searches it (`.some(...)`) for the target cell. That happens for every direction of every piece, thousands of times per
  search, but the answer never changes because the board's lines are fixed.
- **Change:** when the board is created, build a table such as "neighbour of cell 22 in direction UP is 13" (45 cells ×
  8 directions, −1 where there's no connection). Asking whether two cells are connected becomes one array lookup. A
  second table lists the cells along each line from each cell, for step 2.
- **Board-state risk:** none. The tables are built once and only read. A test checks they agree with
  `Cell.getCellConnections()` on 3×3, 5×5 and 5×9 boards.

## 2. Work out captures by walking the line
- **Now:** for every possible capture, `getCapturablePieces` (the vulnerability metric) saves the whole board, plays the
  move, compares all 45 cells to see what disappeared, then restores the whole board. That's 17% of the search time, the
  most expensive function in the profile.
- **Change:** the capture rule is "starting from the first opponent piece in the attack direction, take consecutive
  opponent pieces until the line breaks or the board ends". Walk that line with the line table and list the captured
  pieces without moving anything. `removeAttackedPieces` uses the same shared function, so the rule lives in one place.
- **Board-state risk:** the new version only reads the board, so it can't change it. That's safer than now, where a bug in
  the restore step could leak. A test checks the walk gives exactly the pieces `performMove` really removes, over thousands
  of random moves.

## 3. Make/unmake instead of save/restore
- **Now:** whenever the search or the move tree tries a move, it copies the *entire* state (45 cells, counts, turn, chain
  history), plays the move, then copies everything back. A move touches only a few cells, so most of that copying is
  wasted, and it also creates lots of work for the garbage collector.
- **Change:** `makeMove` records only what it changed on an undo stack: the piece that moved, the pieces captured, the old
  counts, turn and no-capture counter. `unmakeMove` reverses exactly that, in reverse order. This is how chess engines work.
- **Board-state risk:** this is the riskiest step, because one missed field means the board doesn't come back exactly, so
  it has the strictest tests:
  - make then unmake must restore the full snapshot after single steps, whole chains, early stops (`endTurn`),
    game-winning captures, the turn that triggers the 60-turn draw, and nested make/make/unmake/unmake sequences;
  - a guard checks the undo stack is empty when each search finishes. Anything left means a make wasn't undone.

## 4. Count mobility without building every turn
- **Now:** mobility builds both players' complete move trees, turns every path into a list, and then only counts them. It's
  why s030 takes 1.2 s per move at depth 4, against 0.34 s for DeepFortress.
- **Change:** walk the same tree with make/unmake and add 1 at every point where a turn could end (each end of a chain,
  and each point after a capture, since stopping early is allowed), without storing anything.
- **Requirement:** the count must be exactly the same as today, because s030's −1 mobility weight was tuned on this exact
  count. The golden values enforce this.

## 5. Smarter search (fewer positions visited)
- **Move ordering:** alpha-beta skips a branch once it's clear it can't beat one already found. It skips the most when the
  best move comes *first*. Trying captures first (biggest first), then the move that was best at the previous depth, often
  cuts the positions searched several times over.
- **Iterative deepening with a work budget:** search depth 1, then 2, then 3 and so on until a fixed number of positions
  has been examined, then play the move from the deepest search that finished. Simple endgames automatically get searched
  deeper, and lopsided positions (8 pieces vs 2, the 6–25 s cases) stop before getting slow. Capping by work rather than
  seconds keeps results repeatable regardless of machine load, which matters for tuning. A bonus: the previous depth's
  best move feeds the move ordering.
- **Transposition table:** the same position is often reached by different move orders. Each (cell, piece) combination gets
  a fixed random number, and a position's fingerprint is all of its numbers XORed together. Make and unmake update it with
  one XOR per change. Before searching a position, look it up; if it has already been searched deeply enough, reuse the
  score. The fingerprint must include whose turn it is and the no-capture counter, because the same pieces are worth
  something different 2 turns from a forced draw.
- **Risks:**
  - move ordering and the transposition table must not change *what* is chosen, only how fast. The tests check the best
    score and the set of equally best moves match the golden results, with each feature on and off;
  - the fingerprint updated move by move must equal the one recomputed from scratch after random make/unmake sequences;
  - iterative deepening with a budget *does* change behaviour, by design (deeper in easy positions), so it's opt-in per
    preset and doesn't change existing bots.

## 6. (Optional) Bitboards
- **The idea:** store each side's pieces as bits (45 cells in two 32-bit numbers). Whole-board questions become a few bit
  operations; for example, "which of my pieces have an empty neighbour to the right" is one shift and one AND.
- **Trade-off:** possibly another 5–10× faster, but it's a near-total rewrite of the board.
- **When:** only if steps 1–5 aren't enough. That's also the natural point to reconsider C++/WASM, which has native 64-bit
  integers.

## Profile this was based on (depth 4, DeepFortress weights, 6 positions, about 340 ms per move)
| Share of time | Function |
|---|---|
| 17.0% | `getCapturablePieces` |
| 11.8% | `performMove` |
| 9.8% | `willMoveApproach` |
| 9.7% | `getPiecesThatPlayerCanMove` |
| 8.6% | `buildMoveTreeForSinglePiece` |
| 7.3% | `getPossibleMovesForCell` |
| 6.9% | `willMoveWithdraw` |
| 4.6% | garbage collector |
| 3.9% | `lineExposure` |
| 3.8% | `getEmptyCellsThatHaventBeenVisited` |

s030 (with mobility) took about 1236 ms per move at depth 4. The depth-6 endgame search took a median of 424 ms, with a
worst case of 6.2 s on an idle machine and 24.7 s when competing for CPU.
