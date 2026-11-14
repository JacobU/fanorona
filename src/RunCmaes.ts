import { existsSync, readFileSync, writeFileSync } from 'fs';
import { availableParallelism } from 'os';
import { EvaluatorName, Weights } from './ai/presets.js';
import { DEFAULT_MAX_TURNS } from './ai/Tournament.js';
import { seededRng } from './ai/random.js';
import { BotSpec, findBuiltInSpec } from './ai/tuning/BotSpec.js';
import { CmaesState, createCmaes, samplePopulation, updateCmaes } from './ai/tuning/Cmaes.js';
import { generateOpenings } from './ai/tuning/Openings.js';
import { playPairings } from './ai/tuning/Tuner.js';

// Refines weights with CMA-ES, a few generations per run:
//   npm run cmaes -- <config.json> <state.json> [--workers N]
// Each generation samples `lambda` settings around the current mean and plays them (plus the mean itself and the
// reference setting) against the opponents on a fresh block of openings, with both colours. The settings' scores
// update the distribution. State is saved after every generation.

interface CmaesConfig {
    depth: number,
    seed: number,
    // The weights being tuned, in order. Every other weight comes from `fixed`.
    names: EvaluatorName[],
    // Optional multiplier per weight, so weights on very different scales can share one step size
    // (e.g. 0.1 for vulnerability means a search step of 10 changes vulnerability by 1)
    scales?: number[],
    fixed: Weights,
    start: number[],
    sigma: number,
    lambda: number,
    reference: { name: string, weights: Weights },
    opponents: string[],
    openingTurns: number,
    openingsPerGeneration: number,
    generationsPerRun: number,
}

interface GenerationRecord {
    generation: number,
    mean: number[],
    sigma: number,
    meanScore: number,
    referenceScore: number,
    bestScore: number,
    best: number[],
}

interface RunState {
    cmaes: CmaesState,
    openingsUsed: number,
    history: GenerationRecord[],
}

const [configPath, statePath, ...rest] = process.argv.slice(2);
const workersIndex = rest.indexOf('--workers');
const workers = workersIndex === -1 ? Math.max(1, availableParallelism() - 1) : Number(rest[workersIndex + 1]);
const config: CmaesConfig = JSON.parse(readFileSync(configPath, 'utf8'));
const state: RunState = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, 'utf8'))
    : { cmaes: createCmaes(config.start, config.sigma, config.lambda), openingsUsed: 0, history: [] };

const round1 = (x: number) => Math.round(x * 10) / 10;
const scaleOf = (i: number) => config.scales?.[i] ?? 1;
const toWeights = (point: number[]): Weights => {
    const weights: Weights = { ...config.fixed };
    config.names.forEach((name, i) => weights[name] = round1(point[i] * scaleOf(i)));
    return weights;
};
const describe = (point: number[]) => config.names.map((name, i) => `${name.slice(0, 1)}${round1(point[i] * scaleOf(i))}`).join(' ');
const opponents = config.opponents.map(findBuiltInSpec);
const rng = seededRng(config.seed + state.cmaes.generation * 7919);

for (let g = 0; g < config.generationsPerRun; g++) {
    const population = samplePopulation(state.cmaes, rng);
    const specs: BotSpec[] = [
        ...population.map((point, i): BotSpec => ({ kind: 'search', name: `p${i + 1}`, depth: config.depth, weights: toWeights(point) })),
        { kind: 'search', name: 'mean', depth: config.depth, weights: toWeights(state.cmaes.mean) },
        { kind: 'search', name: config.reference.name, depth: config.depth, weights: config.reference.weights },
    ];
    const allOpenings = generateOpenings(state.openingsUsed + config.openingsPerGeneration, config.openingTurns, config.seed);
    const openings = allOpenings.slice(state.openingsUsed);
    const pairs = specs.flatMap(s => opponents.map(o => [s, o] as [BotSpec, BotSpec]));

    const start = performance.now();
    const { participants } = await playPairings([...specs, ...opponents], pairs, 0, DEFAULT_MAX_TURNS, workers, undefined, openings);
    const scoreOf = (name: string) => participants.find(p => p.spec.name === name)!.score;
    const fitness = population.map((_, i) => scoreOf(`p${i + 1}`));
    const bestIndex = fitness.indexOf(Math.max(...fitness));

    const record: GenerationRecord = {
        generation: state.cmaes.generation + 1,
        mean: state.cmaes.mean.map(round1),
        sigma: round1(state.cmaes.sigma),
        meanScore: scoreOf('mean'),
        referenceScore: scoreOf(config.reference.name),
        bestScore: fitness[bestIndex],
        best: population[bestIndex].map(round1),
    };
    state.history.push(record);
    state.cmaes = updateCmaes(state.cmaes, population, fitness);
    state.openingsUsed += config.openingsPerGeneration;
    writeFileSync(statePath, JSON.stringify(state, null, 2));

    const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
    console.log(`Generation ${record.generation} (${((performance.now() - start) / 1000).toFixed(0)}s): mean ${describe(record.mean)} (σ ${record.sigma}) scored ${pct(record.meanScore)}, `
        + `${config.reference.name} ${pct(record.referenceScore)}, best sample ${describe(record.best)} ${pct(record.bestScore)}; `
        + `samples ${fitness.map(pct).join(' ')}`);
}

// Summary over all generations so far: how the mean compares with the reference on the same openings
const history = state.history;
const average = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
console.log(`\nAfter ${history.length} generations: next mean ${describe(state.cmaes.mean)} (σ ${round1(state.cmaes.sigma)})`);
console.log(`Average score over all generations: mean point ${(average(history.map(h => h.meanScore)) * 100).toFixed(1)}%, `
    + `${config.reference.name} ${(average(history.map(h => h.referenceScore)) * 100).toFixed(1)}%`);
