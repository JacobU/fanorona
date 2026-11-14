import { readFileSync, writeFileSync } from 'fs';
import { availableParallelism } from 'os';
import { EVALUATOR_NAMES } from './ai/presets.js';
import { DEFAULT_MAX_TURNS } from './ai/Tournament.js';
import { seededRng } from './ai/random.js';
import { findBuiltInSpec } from './ai/tuning/BotSpec.js';
import { GameJob, runGames } from './ai/tuning/GamePool.js';
import { generateOpenings } from './ai/tuning/Openings.js';
import { Sample, bootstrapWeights, fitLogistic, labelPositions, remapFeatures, toWeights } from './ai/tuning/Texel.js';

// Texel tuning in two steps:
//   npm run texel -- collect <data.json> [--games 600] [--bots Lookahead,Sentinel,...] [--opening-turns 4] [--seed 1] [--workers N]
//       Plays games between randomly paired bots (each from a different random opening) and records every position.
//   npm run texel -- fit <data.json> [--quiet-only] [--bootstrap 100]
//       Fits the weights that best predict the results, and saves the fit next to the data.

const [command, file, ...rest] = process.argv.slice(2);
const option = (flag: string, fallback?: string) => {
    const i = rest.indexOf(flag);
    return i === -1 ? fallback : rest[i + 1];
};
const DEFAULT_BOTS = ['Greedy', 'Guardian', 'Lookahead', 'Sentinel', 'Positional', 'Fortress'];

if (command === 'collect') {
    const games = Number(option('--games', '600'));
    const bots = (option('--bots', DEFAULT_BOTS.join(',')) as string).split(',').map(findBuiltInSpec);
    const openingTurns = Number(option('--opening-turns', '4'));
    const seed = Number(option('--seed', '1'));
    const workers = Number(option('--workers', String(Math.max(1, availableParallelism() - 1))));

    // Every game gets its own opening and a random pair of bots, so the positions are varied.
    // Openings may be quite one-sided here, which helps the fit learn how much material is worth.
    const rng = seededRng(seed);
    const openings = generateOpenings(games, openingTurns, seed, 6);
    const jobs: GameJob[] = openings.map(opening => ({
        white: bots[Math.floor(rng() * bots.length)],
        black: bots[Math.floor(rng() * bots.length)],
        maxTurns: DEFAULT_MAX_TURNS,
        opening,
        recordPositions: true,
    }));

    console.log(`Collecting positions from ${games} games between ${bots.map(b => b.name).join(', ')} (${workers} workers)`);
    const start = performance.now();
    let lastPrinted = 0;
    const results = await runGames(jobs, workers, (completed, total) => {
        if (completed === total || Date.now() - lastPrinted > 1000) {
            process.stdout.write(`\r  ${completed}/${total} games played`);
            lastPrinted = Date.now();
        }
    });
    console.log(` in ${((performance.now() - start) / 1000).toFixed(1)}s`);

    const samples = results.flatMap((r, game) => labelPositions(r.positions ?? [], r.result, game));
    const outcomes = { WHITE: 0, BLACK: 0, DRAW: 0 };
    for (const r of results) outcomes[r.result]++;
    writeFileSync(file, JSON.stringify({
        features: EVALUATOR_NAMES,
        bots: bots.map(b => b.name),
        games,
        openingTurns,
        seed,
        outcomes,
        // Compact form: f = features, r = result for the side to move, q = quiet, g = game number
        samples: samples.map(s => ({ f: s.features, r: s.result, q: s.quiet ? 1 : 0, g: s.game })),
    }));
    console.log(`Saved ${samples.length} positions (${samples.filter(s => s.quiet).length} quiet) to ${file}`);
    console.log(`Results: white won ${outcomes.WHITE}, black won ${outcomes.BLACK}, drawn ${outcomes.DRAW}`);
} else if (command === 'fit') {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const quietOnly = rest.includes('--quiet-only');
    const resamples = Number(option('--bootstrap', '100'));
    // The file lists the evaluator names its features were saved under, which may be an older set than today's
    const savedNames: string[] = data.features;
    const allSamples: Sample[] = data.samples.map((s: { f: number[], r: number, q: number, g: number }) => ({ features: remapFeatures(s.f, savedNames), result: s.r, quiet: s.q === 1, game: s.g }));
    const samples = quietOnly ? allSamples.filter(s => s.quiet) : allSamples;

    const constant = fitLogistic(samples, EVALUATOR_NAMES.map(() => false));
    const materialOnly = fitLogistic(samples, EVALUATOR_NAMES.map(name => name === 'material'));
    const full = fitLogistic(samples);
    const weights = toWeights(full.coefficients);
    const intervals = bootstrapWeights(samples, resamples);
    // How much worse the predictions get without each feature (bigger = more important)
    const importance = EVALUATOR_NAMES.map(name => fitLogistic(samples, EVALUATOR_NAMES.map(n => n !== name)).logLoss - full.logLoss);

    const pad = (text: string | number, width: number) => String(text).padEnd(width);
    console.log(`${samples.length} ${quietOnly ? 'quiet ' : ''}positions from ${new Set(samples.map(s => s.game)).size} games (${data.bots.join(', ')})`);
    console.log(`Log-loss: no features ${constant.logLoss.toFixed(4)}, material only ${materialOnly.logLoss.toFixed(4)}, all features ${full.logLoss.toFixed(4)}`);
    console.log(`Side-to-move intercept: ${full.intercept.toFixed(3)}\n`);
    console.log(pad('Feature', 15) + pad('Coefficient', 13) + pad('Weight', 9) + pad('95% range', 20) + 'Log-loss without it');
    EVALUATOR_NAMES.forEach((name, i) => {
        console.log(pad(name, 15) + pad(full.coefficients[i].toFixed(4), 13) + pad(weights[name]!, 9)
            + pad(`${intervals[i].low} to ${intervals[i].high}`, 20) + `+${importance[i].toFixed(5)}`);
    });

    const fitFile = file.replace(/\.json$/, '') + (quietOnly ? '-fit-quiet.json' : '-fit.json');
    writeFileSync(fitFile, JSON.stringify({ quietOnly, positions: samples.length, logLoss: { constant: constant.logLoss, materialOnly: materialOnly.logLoss, full: full.logLoss }, intercept: full.intercept, coefficients: full.coefficients, weights, intervals, importance }, null, 2));
    console.log(`\nSaved the fit to ${fitFile}`);
} else {
    console.log('Usage: npm run texel -- collect <data.json> [options]   or   npm run texel -- fit <data.json> [--quiet-only]');
}
