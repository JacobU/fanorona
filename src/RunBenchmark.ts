import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import Board from './Board.js';
import { BENCHMARK_POSITIONS_FILE } from './ai/golden.js';
import { searchDepthFor } from './ai/endgame.js';
import { DeepFortress, DeepFortressEndgame } from './ai/presets.js';
import { seededRng } from './ai/random.js';
import { chooseMove, searchStats } from './ai/Search.js';
import { StoredPosition, boardFromPosition, sideToMove } from './ai/testPositions.js';

// Times the bots' searches on fixed positions, so each speed-up can be measured (see docs/performance-plan.md):
// - DeepFortress searching 4 turns ahead after each of 20 openings;
// - DeepFortressEndgame searching 6 turns ahead in 30 endgame positions (10 or fewer pieces).
// Runs on one thread, one search at a time, so close other heavy programs for steadier timings.
// Usage: npm run bench [-- --label <name>] [--openings-only | --endgames-only]
//   --label saves the results to docs/benchmarks/<name>.json

const args = process.argv.slice(2);
const labelIndex = args.indexOf('--label');
const label = labelIndex === -1 ? null : args[labelIndex + 1];

if (!existsSync(BENCHMARK_POSITIONS_FILE)) {
    console.error(`${BENCHMARK_POSITIONS_FILE} is missing. It is created by "npm run golden".`);
    process.exit(1);
}
const positions: { openings: StoredPosition[], endgames: StoredPosition[] } = JSON.parse(readFileSync(BENCHMARK_POSITIONS_FILE, 'utf8'));

interface Timing { name: string, ms: number, nodes: number }

function timeSearches(title: string, list: StoredPosition[], search: (board: Board) => void): Timing[] {
    process.stdout.write(`${title}:`);
    const timings: Timing[] = [];
    for (const position of list) {
        const board = boardFromPosition(position);
        const before = JSON.stringify(board.getFullStateForTesting());
        searchStats.nodes = 0;
        const start = performance.now();
        search(board);
        const ms = performance.now() - start;
        // A cheap safety check: the search must leave the board as it found it
        if (JSON.stringify(board.getFullStateForTesting()) !== before) {
            throw new Error(`The board changed while searching ${position.name}`);
        }
        timings.push({ name: position.name, ms, nodes: searchStats.nodes });
        process.stdout.write('.');
    }
    console.log();
    return timings;
}

function percentile(sorted: number[], p: number): number {
    return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function summarise(timings: Timing[]) {
    const ms = timings.map(t => t.ms).sort((a, b) => a - b);
    const totalMs = ms.reduce((a, b) => a + b, 0);
    const totalNodes = timings.reduce((a, t) => a + t.nodes, 0);
    const slowest = timings.reduce((a, b) => b.ms > a.ms ? b : a);
    return {
        positions: timings.length,
        totalSeconds: totalMs / 1000,
        meanMs: totalMs / timings.length,
        medianMs: percentile(ms, 0.5),
        p90Ms: percentile(ms, 0.9),
        worstMs: ms[ms.length - 1],
        worstPosition: slowest.name,
        nodes: totalNodes,
        nodesPerSecond: totalNodes / (totalMs / 1000),
    };
}

// Warm up the JIT compiler so the first timed search isn't penalised
const warmUp = boardFromPosition(positions.openings[0]);
chooseMove(warmUp, sideToMove(warmUp), DeepFortress.evaluator, 2, seededRng(1));

const results: Record<string, ReturnType<typeof summarise> & { timings: Timing[] }> = {};
if (!args.includes('--endgames-only')) {
    const timings = timeSearches(`DeepFortress, depth ${DeepFortress.depth}, ${positions.openings.length} openings`, positions.openings,
        board => chooseMove(board, sideToMove(board), DeepFortress.evaluator, DeepFortress.depth, seededRng(1)));
    results.openings = { ...summarise(timings), timings };
}
if (!args.includes('--openings-only')) {
    const timings = timeSearches(`DeepFortressEndgame, endgame depth, ${positions.endgames.length} endgames`, positions.endgames,
        board => chooseMove(board, sideToMove(board), DeepFortressEndgame.evaluator, searchDepthFor(DeepFortressEndgame, board), seededRng(1)));
    results.endgames = { ...summarise(timings), timings };
}

const format = (n: number, digits = 0) => n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
console.log();
console.log('Searches             Positions  Total s  Mean ms  Median ms  90% ms  Worst ms  Nodes        Nodes/s');
for (const [name, r] of Object.entries(results)) {
    console.log(`${name.padEnd(21)}${String(r.positions).padStart(9)}  ${format(r.totalSeconds, 1).padStart(7)}  ${format(r.meanMs).padStart(7)}`
        + `  ${format(r.medianMs).padStart(9)}  ${format(r.p90Ms).padStart(6)}  ${format(r.worstMs).padStart(8)}  ${format(r.nodes).padStart(11)}`
        + `  ${format(r.nodesPerSecond).padStart(9)}`);
}
for (const [name, r] of Object.entries(results)) console.log(`Slowest ${name} position: ${r.worstPosition}`);

if (label) {
    mkdirSync('docs/benchmarks', { recursive: true });
    const file = `docs/benchmarks/${label}.json`;
    writeFileSync(file, JSON.stringify({ label, date: new Date().toISOString(), results }, null, 1));
    console.log(`Saved to ${file}`);
}
