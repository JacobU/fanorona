// Writes a tuning config.
//   node gen.mjs sweep  <out.json>
//   node gen.mjs pairs  <out.json> '<{"vulnerability":[..],"mobility":[..],...}>'
//   node gen.mjs random <out.json> --top K --perturb N --sigma S --fresh M [--depth D] [--opponents A,B] [--games G] [--from substring]
//   node gen.mjs list   <out.json> '<[{weights},...]>' [--depth D] [--opponents A,B] [--games G]
import { writeFileSync } from 'fs';
import { GAUNTLET, TUNABLE, RANGES, normalise, keyOf, loadResults, aggregate } from './common.mjs';

const [mode, out, ...rest] = process.argv.slice(2);
const option = (flag, fallback) => {
    const i = rest.indexOf(flag);
    return i === -1 ? fallback : rest[i + 1];
};
const depth = Number(option('--depth', 2));
const opponents = option('--opponents', GAUNTLET.join(',')).split(',');
const games = Number(option('--games', 20));

const variants = new Map();
const add = (weights, d = depth) => {
    const w = normalise(weights);
    const name = keyOf(w, d);
    if (!variants.has(name)) variants.set(name, { name, depth: d, weights: w });
};

const gaussian = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
// A random non-zero value for a weight, spread evenly on a log scale (and sometimes negative where allowed).
const randomValue = key => {
    const { min, max } = RANGES[key];
    if (min < 0 && Math.random() < 0.15) return -Math.ceil(Math.random() * -min);
    return Math.max(1, Math.round(Math.exp(Math.random() * Math.log(max))));
};

if (mode === 'sweep') {
    const values = {
        vulnerability: [15, 30, 60, 120],
        mobility: [1, 2, 5, 10],
        strongPoints: [-10, 5, 10, 20, 40],
        lineExposure: [-10, 5, 10, 20, 40],
    };
    add({});
    for (const key of TUNABLE) for (const value of values[key]) add({ [key]: value });
} else if (mode === 'pairs') {
    const values = JSON.parse(rest[0]);
    for (let i = 0; i < TUNABLE.length; i++) {
        for (let j = i + 1; j < TUNABLE.length; j++) {
            const [a, b] = [TUNABLE[i], TUNABLE[j]];
            for (const va of values[a]) for (const vb of values[b]) add({ [a]: va, [b]: vb });
        }
    }
} else if (mode === 'random') {
    const top = Number(option('--top', 3));
    const perturbCount = Number(option('--perturb', 12));
    const sigma = Number(option('--sigma', 0.5));
    const fresh = Number(option('--fresh', 0));
    const from = option('--from', '');
    const leaders = aggregate(loadResults(), opponents, file => file.includes(from)).filter(e => e.depth === depth || depth !== 2).slice(0, top);
    console.log('Leaders:', leaders.map(l => `${l.key} (${(l.score * 100).toFixed(1)}%, n=${l.games})`).join(' | '));
    for (const leader of leaders) add(leader.weights);
    for (let i = 0; i < perturbCount; i++) {
        const leader = leaders[i % leaders.length];
        const w = { ...leader.weights };
        for (const key of TUNABLE) {
            const r = Math.random();
            if (w[key] === 0) {
                if (r < 0.25) w[key] = randomValue(key);
            } else if (r < 0.1) {
                w[key] = 0;
            } else if (r < 0.15) {
                w[key] = randomValue(key);
            } else {
                // Multiply by e^N(0, sigma), always moving by at least 1 so small weights can still change.
                const next = Math.round(w[key] * Math.exp(sigma * gaussian()));
                w[key] = next === w[key] ? w[key] + (Math.random() < 0.5 ? -1 : 1) : next;
            }
        }
        add(w);
    }
    for (let i = 0; i < fresh; i++) {
        const w = {};
        for (const key of TUNABLE) w[key] = Math.random() < 0.3 ? 0 : randomValue(key);
        add(w);
    }
} else if (mode === 'list') {
    for (const weights of JSON.parse(rest[0])) add(weights);
} else {
    throw new Error('Mode must be sweep, pairs, random or list');
}

// The base is played too (as "Base") because the config has no grid, so it's material only as a control.
const config = {
    mode: 'gauntlet',
    gamesPerPair: games,
    opponents,
    base: { depth, weights: { material: 100 } },
    variants: [...variants.values()].filter(v => v.name !== keyOf({}, depth)),
};
writeFileSync(out, JSON.stringify(config, null, 2));
console.log(`Wrote ${out}: ${config.variants.length + 1} bots (including Base) x ${opponents.length} opponents x ${games} games = ${(config.variants.length + 1) * opponents.length * games} games`);
