import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { availableParallelism } from 'os';
import { basename, join } from 'path';
import { EVALUATOR_NAMES, Weights } from './ai/presets.js';
import { BotSpec } from './ai/tuning/BotSpec.js';
import { DEFAULT_MAX_TURNS, GridKey, TuningConfig } from './ai/tuning/TuningConfig.js';
import { ParticipantResult, runTuning } from './ai/tuning/Tuner.js';

// Usage: npm run tune -- [configFile] [--games N] [--workers N]
// e.g.   npm run tune -- tuning/grid.json --games 40
// See the files in the tuning/ folder for what a config can contain. Results are saved to tuning/results/.

const args = process.argv.slice(2);
const takeOption = (flag: string): number | undefined => {
    const i = args.indexOf(flag);
    if (i === -1) return undefined;
    const value = parseInt(args[i + 1], 10);
    if (isNaN(value)) throw new Error(`${flag} needs a number.`);
    args.splice(i, 2);
    return value;
};
const gamesOverride = takeOption('--games');
const workers = takeOption('--workers') ?? Math.max(1, availableParallelism() - 1);
const configPath = args[0] ?? 'tuning/grid.json';

const config: TuningConfig = JSON.parse(readFileSync(configPath, 'utf8'));
if (gamesOverride !== undefined) config.gamesPerPair = gamesOverride;

const percent = (x: number) => `${(x * 100).toFixed(1)}%`;
const wholePercent = (x: number) => `${Math.round(x * 100)}%`;
const formatWeights = (spec: BotSpec) => spec.kind === 'random'
    ? 'random moves'
    : `depth ${spec.depth}: ` + EVALUATOR_NAMES.filter(n => (spec.weights[n] ?? 0) !== 0).map(n => `${n} ${spec.weights[n]}`).join(', ');

function printTable(rows: string[][]): void {
    const widths = rows[0].map((_, col) => Math.max(...rows.map(row => row[col].length)));
    for (const row of rows) console.log(row.map((cell, col) => cell.padEnd(widths[col] + 2)).join('').trimEnd());
}

console.log(`Tuning with ${basename(configPath)} (${config.mode ?? 'gauntlet'}, ${config.gamesPerPair ?? 20} games per pair, ${workers} worker${workers === 1 ? '' : 's'})`);

let lastPrinted = 0;
const result = await runTuning(config, workers, (completed, total) => {
    const now = Date.now();
    if (completed === total || now - lastPrinted > 1000) {
        process.stdout.write(`\r  ${completed}/${total} games played`);
        lastPrinted = now;
    }
});
console.log(` in ${(result.elapsedMs / 1000).toFixed(1)}s\n`);

const variants = result.participants.filter(p => p.isVariant);
const opponents = result.participants.filter(p => !p.isVariant);
const isGauntlet = (config.mode ?? 'gauntlet') === 'gauntlet';
const columns = isGauntlet ? opponents : result.participants;

// Ranking, with each bot's score against every opponent so you can see who it does well or badly against.
console.log('Score         = points per game (win 1, draw ½). ± is how much of that could be luck (95% confidence).');
console.log('Win/Draw/Loss = share of games with each result.');
console.log('Decisive      = share of the games with a winner that this bot won (ignores draws).\n');
const shown = isGauntlet ? variants : result.participants;
printTable([
    ['Bot', 'Score', '±', 'Win', 'Draw', 'Loss', 'Decisive', ...columns.map(c => `vs ${c.spec.name}`), 'ms/turn'],
    ...shown.map((p: ParticipantResult) => [
        p.spec.name,
        percent(p.score),
        percent(p.margin),
        wholePercent(p.winRate),
        wholePercent(p.drawRate),
        wholePercent(p.lossRate),
        p.decisiveWinRate === null ? '-' : wholePercent(p.decisiveWinRate),
        ...columns.map(c => {
            const r = p.vs[c.spec.name];
            if (!r) return '-';
            const games = r.wins + r.draws + r.losses;
            return percent((r.wins + r.draws / 2) / games);
        }),
        p.msPerTurn.toFixed(1),
    ]),
]);

// For a grid over two settings, show the scores as a table so you can see how the two interact.
const gridKeys = Object.keys(config.grid ?? {}) as GridKey[];
if (gridKeys.length === 2) {
    const [rowKey, columnKey] = gridKeys;
    const rowValues = config.grid![rowKey]!;
    const columnValues = config.grid![columnKey]!;
    const scoreOf = (rowValue: number, columnValue: number) => {
        const p = variants.find(v => v.spec.name === `${rowKey}=${rowValue} ${columnKey}=${columnValue}`);
        return p ? `${percent(p.score)} (draws ${wholePercent(p.drawRate)})` : '-';
    };
    console.log(`\nScore (and draw rate) by ${rowKey} (rows) and ${columnKey} (columns):`);
    printTable([
        [`${rowKey} \\ ${columnKey}`, ...columnValues.map(String)],
        ...rowValues.map(rowValue => [String(rowValue), ...columnValues.map(columnValue => scoreOf(rowValue, columnValue))]),
    ]);
}

// Each game is counted once for each of its two players, so halve the total.
const turnLimitDraws = result.participants.reduce((total, p) => total + p.turnLimitDraws, 0) / 2;
if (turnLimitDraws > 0) {
    console.log(`\nNote: ${turnLimitDraws} game(s) reached the ${config.maxTurns ?? DEFAULT_MAX_TURNS} turn safety limit and were counted as draws.`);
}

console.log('\nBots:');
for (const p of shown) console.log(`  ${p.spec.name}: ${formatWeights(p.spec)}`);

// Save everything so runs can be compared later.
const resultsDir = join('tuning', 'results');
mkdirSync(resultsDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const resultsPath = join(resultsDir, `${timestamp}-${basename(configPath, '.json')}.json`);
writeFileSync(resultsPath, JSON.stringify({
    date: new Date().toISOString(),
    configFile: configPath,
    config,
    totalGames: result.totalGames,
    elapsedMs: Math.round(result.elapsedMs),
    results: result.participants.map(p => ({
        name: p.spec.name,
        isVariant: p.isVariant,
        depth: p.spec.kind === 'search' ? p.spec.depth : null,
        weights: p.spec.kind === 'search' ? p.spec.weights : null as Weights | null,
        score: p.score,
        margin: p.margin,
        winRate: p.winRate,
        drawRate: p.drawRate,
        lossRate: p.lossRate,
        decisiveWinRate: p.decisiveWinRate,
        wins: p.wins,
        draws: p.draws,
        losses: p.losses,
        turnLimitDraws: p.turnLimitDraws,
        msPerTurn: p.msPerTurn,
        vs: p.vs,
    })),
}, null, 2));
console.log(`\nSaved results to ${resultsPath}`);
