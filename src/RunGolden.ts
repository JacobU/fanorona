import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { BENCHMARK_POSITIONS_FILE, GOLDEN_FILE, GOLDEN_SEARCH_DEPTHS, GoldenEntry, computeGolden } from './ai/golden.js';
import { generateBenchmarkPositions, generateTestPositions } from './ai/testPositions.js';

// Saves the golden results (and the benchmark positions) from the current code. Run once, before any speed-ups,
// so that every later version of the code can be checked against the original answers.
// Usage: npm run golden [-- --force]

const force = process.argv.includes('--force');
for (const file of [GOLDEN_FILE, BENCHMARK_POSITIONS_FILE]) {
    if (existsSync(file) && !force) {
        console.error(`${file} already exists. The golden results should come from the original code, so they aren't`
            + ' overwritten unless you add --force.');
        process.exit(1);
    }
}

const start = performance.now();
const positions = generateTestPositions(1);
console.log(`Generated ${positions.length} test positions in ${((performance.now() - start) / 1000).toFixed(1)}s`);

const entries: GoldenEntry[] = [];
for (const position of positions) {
    entries.push(computeGolden(position, GOLDEN_SEARCH_DEPTHS));
    if (entries.length % 25 === 0) process.stdout.write(`  ${entries.length}/${positions.length}`);
}
console.log(` done in ${((performance.now() - start) / 1000).toFixed(1)}s`);

// One entry per line, so differences are easy to find
const header = {
    description: 'Answers from the original code, which every speed-up must reproduce exactly (see src/ai/golden.ts)',
    generated: new Date().toISOString(),
    searchDepths: GOLDEN_SEARCH_DEPTHS,
};
mkdirSync(dirname(GOLDEN_FILE), { recursive: true });
const headerJson = JSON.stringify(header);
writeFileSync(GOLDEN_FILE, `${headerJson.slice(0, -1)},\n"entries": [\n${entries.map(e => JSON.stringify(e)).join(',\n')}\n]}\n`);
console.log(`Saved ${entries.length} golden results to ${GOLDEN_FILE}`);

const bench = generateBenchmarkPositions(9);
writeFileSync(BENCHMARK_POSITIONS_FILE, JSON.stringify(bench, null, 1));
console.log(`Saved ${bench.openings.length} opening and ${bench.endgames.length} endgame benchmark positions to ${BENCHMARK_POSITIONS_FILE}`);
