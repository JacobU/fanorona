// Shared helpers for the tuning campaign scratch scripts.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export const GAUNTLET = ['Lookahead', 'Fortress', 'AllRounder'];
export const TUNABLE = ['vulnerability', 'mobility', 'strongPoints', 'lineExposure'];
export const RANGES = {
    vulnerability: { min: 0, max: 250 },
    mobility: { min: 0, max: 10 },
    strongPoints: { min: -10, max: 40 },
    lineExposure: { min: -10, max: 80 },
};
const SHORT = { vulnerability: 'v', mobility: 'm', strongPoints: 's', lineExposure: 'l' };

// Every variant has material 100 and integer weights for the rest (missing = 0).
export function normalise(weights) {
    const w = { material: 100 };
    for (const key of TUNABLE) {
        const value = Math.round(weights[key] ?? 0);
        const { min, max } = RANGES[key];
        w[key] = Math.min(max, Math.max(min, value));
    }
    return w;
}

// A short name that is the same for the same weights, e.g. "v30 m0 s5 l5".
export function keyOf(weights, depth = 2) {
    const w = normalise(weights);
    return (depth !== 2 ? `d${depth} ` : '') + TUNABLE.map(k => `${SHORT[k]}${w[k]}`).join(' ');
}

export function loadResults(dir = join('tuning', 'results')) {
    let files;
    try { files = readdirSync(dir).filter(f => f.endsWith('.json')).sort(); } catch { return []; }
    return files.map(f => ({ file: f, ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
}

/**
 * Merges every run's results by weights (and depth), counting only games against the given opponents,
 * so scores from different rounds are comparable. Returns entries sorted best first.
 */
export function aggregate(runs, opponents = GAUNTLET, fileFilter = () => true) {
    const byKey = new Map();
    for (const run of runs) {
        if (!fileFilter(run.file)) continue;
        for (const r of run.results) {
            if (!r.weights || opponents.includes(r.name)) continue;
            const key = keyOf(r.weights, r.depth);
            let entry = byKey.get(key);
            if (!entry) {
                entry = { key, depth: r.depth, weights: normalise(r.weights), wins: 0, draws: 0, losses: 0, vs: {}, files: new Set() };
                byKey.set(key, entry);
            }
            for (const [opponent, record] of Object.entries(r.vs)) {
                if (!opponents.includes(opponent)) continue;
                entry.wins += record.wins; entry.draws += record.draws; entry.losses += record.losses;
                const v = (entry.vs[opponent] ??= { wins: 0, draws: 0, losses: 0 });
                v.wins += record.wins; v.draws += record.draws; v.losses += record.losses;
            }
            entry.files.add(run.file.replace(/^[\dT-]+-/, '').replace('.json', ''));
        }
    }
    const entries = [...byKey.values()].map(e => {
        const games = e.wins + e.draws + e.losses;
        const score = games ? (e.wins + e.draws / 2) / games : 0;
        return { ...e, games, score, margin: games ? 1.96 * Math.sqrt(score * (1 - score) / games) : 0, drawRate: games ? e.draws / games : 0 };
    }).filter(e => e.games > 0);
    entries.sort((a, b) => b.score - a.score);
    return entries;
}
