// Writes the tuning configs for the endgame-weight screen (run from this folder after `npm run build:src`).
//   node gen.mjs lhs <out.json> --samples N --seed S --starts C --startSeed T [--endgameDepth D]
//       Base (no endgame weights) + fixed anchors + N Latin-hypercube settings of the endgame weights.
//   node gen.mjs top <out.json> --top K --starts C --startSeed T [--endgameDepth D] <results.json> [<results.json> ...]
//       The K best variants (pooling W/D/L over the given results files), plus Base and the anchors, on new starts.
// Endgame weights are added on top of Fortress's weights (v30 s5 l5), so negative values for the normal metrics
// switch them down or off in the endgame (e.g. strongPoints -5 switches strongPoints off).
import { readFileSync, writeFileSync } from 'fs';
import { latinHypercube } from '../../../dist/src/ai/tuning/Sampling.js';
import { seededRng } from '../../../dist/src/ai/random.js';

const [mode, out, ...rest] = process.argv.slice(2);
const flags = {};
const files = [];
for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = Number(rest[++i]);
    else files.push(rest[i]);
}
const endgameDepth = flags.endgameDepth ?? 4;

// The range each endgame weight is searched over (signed log scale, see Sampling.ts).
const RANGES = {
    edgeExposure: { min: -20, max: 100 },
    centrality: { min: -20, max: 100 },
    strongPoints: { min: -20, max: 30 },
    vulnerability: { min: -30, max: 90 },
    lineExposure: { min: -20, max: 30 },
};

const ANCHORS = [
    { name: 'Current', endgameWeights: { edgeExposure: 40, centrality: 20 } },
    { name: 'E40', endgameWeights: { edgeExposure: 40 } },
    { name: 'C20', endgameWeights: { centrality: 20 } },
    { name: 'Current s-5', endgameWeights: { edgeExposure: 40, centrality: 20, strongPoints: -5 } },
    { name: 'Current v-30', endgameWeights: { edgeExposure: 40, centrality: 20, vulnerability: -30 } },
    { name: 'Current v+30', endgameWeights: { edgeExposure: 40, centrality: 20, vulnerability: 30 } },
    { name: 'Current l-5', endgameWeights: { edgeExposure: 40, centrality: 20, lineExposure: -5 } },
];

// Drops zero weights so names and configs stay short.
const clean = w => Object.fromEntries(Object.entries(w).filter(([k, v]) => k !== 'material' && v !== 0));
const short = w => Object.entries(clean(w)).map(([k, v]) => `${k[0]}${v}`).join(' ') || 'none';

let variants;
if (mode === 'lhs') {
    const sampled = latinHypercube(flags.samples, RANGES, seededRng(flags.seed));
    variants = [
        ...ANCHORS,
        ...sampled.map((w, i) => ({ name: `r${String(i + 1).padStart(2, '0')} ${short(w)}`, endgameWeights: clean(w) })),
    ];
} else if (mode === 'top') {
    const pooled = new Map();
    for (const file of files) {
        for (const r of JSON.parse(readFileSync(file, 'utf8')).results.filter(r => r.isVariant)) {
            const p = pooled.get(r.name) ?? { name: r.name, endgameWeights: r.endgameWeights ?? {}, wins: 0, draws: 0, losses: 0 };
            p.wins += r.wins; p.draws += r.draws; p.losses += r.losses;
            pooled.set(r.name, p);
        }
    }
    const score = p => (p.wins + p.draws / 2) / (p.wins + p.draws + p.losses);
    const ranked = [...pooled.values()].filter(p => p.name !== 'Base').sort((a, b) => score(b) - score(a));
    const keep = ranked.slice(0, flags.top);
    for (const anchor of ANCHORS) if (!keep.some(k => k.name === anchor.name)) keep.push(anchor);
    console.log('Kept:', keep.map(k => `${k.name}${k.wins !== undefined ? ` (${(score(k) * 100).toFixed(1)}%)` : ''}`).join(' | '));
    variants = keep.map(({ name, endgameWeights }) => ({ name, endgameWeights }));
} else {
    throw new Error('Mode must be lhs or top');
}

const config = {
    mode: 'gauntlet',
    endgameStarts: { count: flags.starts, seed: flags.startSeed },
    opponents: ['DeepFortress'],
    // Base has no endgame weights, so it plays exactly like DeepFortress (a control that should score about 50%).
    base: { depth: 4, weights: { material: 100, vulnerability: 30, strongPoints: 5, lineExposure: 5 }, endgameWeights: {}, endgameDepth },
    variants,
};
writeFileSync(out, JSON.stringify(config, null, 2));
const bots = variants.length + 1;
console.log(`Wrote ${out}: ${bots} bots (including Base) x ${flags.starts} starts x 2 colours = ${bots * flags.starts * 2} games`);
