import { ALL_PRESETS, BotPreset, Weights, createPreset } from '../presets.js';
import { Contestant, RandomContestant, contestantFromPreset } from '../Tournament.js';

/**
 * A plain-data description of a bot. Unlike a BotPreset (which holds evaluator functions) this can be saved to
 * JSON and sent to worker threads.
 */
export type BotSpec =
    | { kind: 'search', name: string, depth: number, weights: Weights, endgameWeights?: Weights, endgameDepth?: number, endgameStart?: number, endgameFull?: number }
    | { kind: 'random', name: string };

export function specFromPreset(preset: BotPreset): BotSpec {
    const spec: BotSpec = { kind: 'search', name: preset.name, depth: preset.depth, weights: { ...preset.weights } };
    // Endgame settings are optional, so only add them when the preset has them.
    if (preset.endgameWeights !== undefined) spec.endgameWeights = { ...preset.endgameWeights };
    if (preset.endgameDepth !== undefined) spec.endgameDepth = preset.endgameDepth;
    if (preset.endgameStart !== undefined) spec.endgameStart = preset.endgameStart;
    if (preset.endgameFull !== undefined) spec.endgameFull = preset.endgameFull;
    return spec;
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

/**
 * Turns a search spec back into a preset (the reverse of specFromPreset), including any endgame settings.
 */
export function presetFromSpec(spec: Extract<BotSpec, { kind: 'search' }>): BotPreset {
    return createPreset(spec.name, spec.depth, spec.weights, '', {
        endgameWeights: spec.endgameWeights, endgameDepth: spec.endgameDepth, endgameStart: spec.endgameStart, endgameFull: spec.endgameFull,
    });
}

export function contestantFromSpec(spec: BotSpec): Contestant {
    if (spec.kind === 'random') {
        return { ...RandomContestant, name: spec.name };
    }
    return contestantFromPreset(presetFromSpec(spec));
}
