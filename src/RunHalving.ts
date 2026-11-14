import { existsSync, readFileSync, writeFileSync } from 'fs';
import { availableParallelism } from 'os';
import { EVALUATOR_NAMES, Weights } from './ai/presets.js';
import { DEFAULT_MAX_TURNS } from './ai/Tournament.js';
import { seededRng } from './ai/random.js';
import { BotSpec, findBuiltInSpec } from './ai/tuning/BotSpec.js';
import { generateOpenings } from './ai/tuning/Openings.js';
import { SearchRanges, latinHypercube } from './ai/tuning/Sampling.js';
import { playPairings } from './ai/tuning/Tuner.js';

// Searches the whole weight space with successive halving, one round per run:
//   npm run halving -- <config.json> <state.json> [--workers N]
// The first run spreads `samples` settings evenly over the ranges (plus any known `include` settings). Every run
// then plays one round against the opponents and keeps the best `keep` fraction, and each round the survivors
// play twice as many new openings (all survivors play the same openings, with both colours). Scores add up over
// all rounds played so far. State is saved after every round so the search can be stopped and resumed.

interface HalvingConfig {
    depth: number,
    samples: number,
    seed: number,
    ranges: SearchRanges,
    include?: { name: string, weights: Weights }[],
    opponents: string[],
    openingTurns: number,
    firstRoundOpenings: number,
    maxRounds: number,
    keep: number,
}

interface Candidate {
    name: string,
    weights: Weights,
    wins: number,
    draws: number,
    losses: number,
    vs: Record<string, { wins: number, draws: number, losses: number }>,
}

interface HalvingState {
    round: number,
    openingsUsed: number,
    candidates: Candidate[],
    eliminated: (Candidate & { round: number })[],
}

const [configPath, statePath, ...rest] = process.argv.slice(2);
const workersIndex = rest.indexOf('--workers');
const workers = workersIndex === -1 ? Math.max(1, availableParallelism() - 1) : Number(rest[workersIndex + 1]);
const config: HalvingConfig = JSON.parse(readFileSync(configPath, 'utf8'));

let state: HalvingState;
if (existsSync(statePath)) {
    state = JSON.parse(readFileSync(statePath, 'utf8'));
} else {
    const sampled = latinHypercube(config.samples, config.ranges, seededRng(config.seed));
    const fresh = (name: string, weights: Weights): Candidate => ({ name, weights, wins: 0, draws: 0, losses: 0, vs: {} });
    state = {
        round: 0,
        openingsUsed: 0,
        candidates: [
            ...(config.include ?? []).map(c => fresh(c.name, { material: 100, ...c.weights })),
            ...sampled.map((weights, i) => fresh(`s${String(i + 1).padStart(3, '0')}`, weights)),
        ],
        eliminated: [],
    };
}

const score = (c: Candidate) => {
    const games = c.wins + c.draws + c.losses;
    return games ? (c.wins + c.draws / 2) / games : 0;
};
const margin = (c: Candidate) => {
    const games = c.wins + c.draws + c.losses;
    const s = score(c);
    return games ? 1.96 * Math.sqrt(s * (1 - s) / games) : 0;
};
const describe = (w: Weights) => EVALUATOR_NAMES.filter(n => n !== 'material').map(n => `${n.slice(0, 1)}${w[n] ?? 0}`).join(' ');

// Play this round: every candidate plays the next block of openings against every opponent, with both colours.
const openingCount = config.firstRoundOpenings * 2 ** state.round;
const allOpenings = generateOpenings(state.openingsUsed + openingCount, config.openingTurns, config.seed);
const openings = allOpenings.slice(state.openingsUsed);
const candidateSpecs: BotSpec[] = state.candidates.map(c => ({ kind: 'search', name: c.name, depth: config.depth, weights: c.weights }));
const opponents = config.opponents.map(findBuiltInSpec);
const pairs: [BotSpec, BotSpec][] = candidateSpecs.flatMap(c => opponents.map(o => [c, o] as [BotSpec, BotSpec]));

console.log(`Round ${state.round + 1}: ${state.candidates.length} candidates x ${opponents.length} opponents x ${openingCount} openings x 2 colours = ${pairs.length * openingCount * 2} games (${workers} workers)`);
const start = performance.now();
let lastPrinted = 0;
const { participants } = await playPairings([...candidateSpecs, ...opponents], pairs, 0, DEFAULT_MAX_TURNS, workers, (completed, total) => {
    if (completed === total || Date.now() - lastPrinted > 2000) {
        process.stdout.write(`\r  ${completed}/${total} games played`);
        lastPrinted = Date.now();
    }
}, openings);
console.log(` in ${((performance.now() - start) / 1000).toFixed(1)}s\n`);

for (const candidate of state.candidates) {
    const p = participants.find(x => x.spec.name === candidate.name)!;
    candidate.wins += p.wins; candidate.draws += p.draws; candidate.losses += p.losses;
    for (const [opponent, record] of Object.entries(p.vs)) {
        const v = (candidate.vs[opponent] ??= { wins: 0, draws: 0, losses: 0 });
        v.wins += record.wins; v.draws += record.draws; v.losses += record.losses;
    }
}
state.openingsUsed += openingCount;
state.round++;

// Rank and keep the best fraction
state.candidates.sort((a, b) => score(b) - score(a));
const survivors = Math.max(1, Math.ceil(state.candidates.length * config.keep));
const isLastRound = state.round >= config.maxRounds;

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const rows = [['Rank', 'Name', 'Weights (v m s l)', 'Score', '±', 'W-D-L', ...config.opponents.map(o => `vs ${o}`)]];
state.candidates.forEach((c, i) => {
    if (i >= 12 && !(config.include ?? []).some(inc => inc.name === c.name)) return;
    rows.push([String(i + 1), c.name, describe(c.weights), pct(score(c)), pct(margin(c)), `${c.wins}-${c.draws}-${c.losses}`,
        ...config.opponents.map(o => { const v = c.vs[o]; const n = v.wins + v.draws + v.losses; return pct((v.wins + v.draws / 2) / n); })]);
});
const widths = rows[0].map((_, col) => Math.max(...rows.map(r => r[col].length)));
for (const r of rows) console.log(r.map((cell, col) => cell.padEnd(widths[col] + 2)).join('').trimEnd());
console.log(`(top 12 shown, plus the included known settings wherever they ranked; ${state.candidates.length} candidates this round)`);

const kept = isLastRound ? state.candidates : state.candidates.slice(0, survivors);
console.log(`\nWeight ranges among the ${kept.length} ${isLastRound ? 'finalists' : 'survivors'}:`);
for (const name of EVALUATOR_NAMES.filter(n => n !== 'material')) {
    const values = kept.map(c => c.weights[name] ?? 0).sort((a, b) => a - b);
    console.log(`  ${name.padEnd(14)} ${values[0]} to ${values[values.length - 1]} (median ${values[Math.floor(values.length / 2)]})`);
}

if (!isLastRound) {
    state.eliminated.push(...state.candidates.slice(survivors).map(c => ({ ...c, round: state.round })));
    state.candidates = kept;
}
writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log(`\nSaved state to ${statePath}${isLastRound ? ' (final round)' : `; next round: ${state.candidates.length} candidates x ${config.firstRoundOpenings * 2 ** state.round} openings`}`);
