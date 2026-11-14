import { ALL_PRESETS, BotPreset, Weights, createPreset } from '../presets.js';
import { Contestant, RandomContestant, contestantFromPreset } from '../Tournament.js';

/**
 * A plain-data description of a bot. Unlike a BotPreset (which holds evaluator functions) this can be saved to
 * JSON and sent to worker threads.
 */
export type BotSpec =
    | { kind: 'search', name: string, depth: number, weights: Weights }
    | { kind: 'random', name: string };

export function specFromPreset(preset: BotPreset): BotSpec {
    return { kind: 'search', name: preset.name, depth: preset.depth, weights: { ...preset.weights } };
}

export const RANDOM_SPEC: BotSpec = { kind: 'random', name: 'Random' };

/**
 * @returns the spec for a built-in bot (any preset, or Random), matched case-insensitively.
 */
export function findBuiltInSpec(name: string): BotSpec {
    if (name.toLowerCase() === 'random') return RANDOM_SPEC;
    const preset = ALL_PRESETS.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (!preset) {
        throw new Error(`Unknown bot "${name}". Choose from: Random, ${ALL_PRESETS.map(p => p.name).join(', ')}`);
    }
    return specFromPreset(preset);
}

export function contestantFromSpec(spec: BotSpec): Contestant {
    if (spec.kind === 'random') {
        return { ...RandomContestant, name: spec.name };
    }
    return contestantFromPreset(createPreset(spec.name, spec.depth, spec.weights));
}
