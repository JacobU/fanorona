import { EVALUATOR_NAMES, EvaluatorName, Weights } from '../presets.js';
import { BotSpec } from './BotSpec.js';
import { EndgameStartOptions } from './Openings.js';

export type GridKey = EvaluatorName | 'depth';

/**
 * The contents of a tuning config file (see the tuning/ folder for examples).
 */
export interface TuningConfig {
    // 'gauntlet': every variant plays every opponent (variants don't play each other).
    // 'roundRobin': every variant and opponent plays every other one.
    mode?: 'gauntlet' | 'roundRobin',
    gamesPerPair?: number,
    // Play every pairing from the same set of random openings, once with each colour. When set, each pair plays
    // 2 × count games and gamesPerPair is ignored.
    openings?: { count: number, turns: number, seed?: number },
    // Play every pairing from the same set of endgame positions instead (see generateEndgameStarts), once with each
    // colour, so each bot plays every start once from the side that's ahead and once from the side that's behind.
    // Use either openings or endgameStarts, not both.
    endgameStarts?: { count: number, seed?: number } & Partial<EndgameStartOptions>,
    // Safety limit on game length (games normally end sooner through the no-capture draw rule).
    maxTurns?: number,
    // Built-in bots (preset names or 'Random') for the variants to play against.
    opponents?: string[],
    // The starting point that the grid and variants change. endgameWeights and endgameDepth are optional
    // (see BotPreset): extra weights blended in as the board empties, and a deeper search once few pieces are left.
    // endgameStart and endgameFull are the bot's own endgame thresholds (see endgame.ts).
    base: { depth?: number, weights: Weights, endgameWeights?: Weights, endgameDepth?: number, endgameStart?: number, endgameFull?: number },
    // Every combination of these values is tried, each applied on top of base.
    grid?: Partial<Record<GridKey, number[]>>,
    // Hand-picked variants, each applied on top of base. Weights listed here replace the base weight
    // (use 0 to switch an evaluator off).
    // endgameWeights are applied on top of the base endgameWeights in the same way.
    variants?: { name: string, depth?: number, weights?: Weights, endgameWeights?: Weights, endgameDepth?: number, endgameStart?: number, endgameFull?: number }[],
}

export const DEFAULT_GAMES_PER_PAIR = 20;
export { DEFAULT_MAX_TURNS } from '../Tournament.js';

/**
 * Builds the bots to test from a config. The base is included as "Base" unless there is a grid
 * (in which case the grid already covers it).
 */
export function buildVariants(config: TuningConfig): BotSpec[] {
    validateWeights(config.base.weights, 'base');
    validateWeights(config.base.endgameWeights ?? {}, 'base endgameWeights');
    const baseDepth = config.base.depth ?? 2;
    // Adds the base's endgame settings (overridden by the variant's) to a spec, leaving them out when neither has any.
    const withEndgame = (spec: BotSpec, variant: { endgameWeights?: Weights, endgameDepth?: number, endgameStart?: number, endgameFull?: number } = {}): BotSpec => {
        if (spec.kind !== 'search') return spec;
        if (config.base.endgameWeights !== undefined || variant.endgameWeights !== undefined) {
            spec.endgameWeights = { ...config.base.endgameWeights, ...variant.endgameWeights };
        }
        const endgameDepth = variant.endgameDepth ?? config.base.endgameDepth;
        if (endgameDepth !== undefined) spec.endgameDepth = endgameDepth;
        const endgameStart = variant.endgameStart ?? config.base.endgameStart;
        if (endgameStart !== undefined) spec.endgameStart = endgameStart;
        const endgameFull = variant.endgameFull ?? config.base.endgameFull;
        if (endgameFull !== undefined) spec.endgameFull = endgameFull;
        return spec;
    };
    const variants: BotSpec[] = [];

    const grid = config.grid ?? {};
    const gridKeys = Object.keys(grid) as GridKey[];
    for (const key of gridKeys) {
        if (key !== 'depth' && !EVALUATOR_NAMES.includes(key)) {
            throw new Error(`Unknown grid key "${key}". Choose from: depth, ${EVALUATOR_NAMES.join(', ')}`);
        }
        if (!Array.isArray(grid[key]) || grid[key]!.length === 0) {
            throw new Error(`Grid key "${key}" needs a non-empty list of values.`);
        }
    }

    if (gridKeys.length > 0) {
        for (const combination of cartesianProduct(gridKeys.map(key => grid[key]!))) {
            const weights: Weights = { ...config.base.weights };
            let depth = baseDepth;
            const nameParts: string[] = [];
            gridKeys.forEach((key, i) => {
                if (key === 'depth') depth = combination[i];
                else weights[key] = combination[i];
                nameParts.push(`${key}=${combination[i]}`);
            });
            variants.push(withEndgame({ kind: 'search', name: nameParts.join(' '), depth, weights }));
        }
    } else {
        variants.push(withEndgame({ kind: 'search', name: 'Base', depth: baseDepth, weights: { ...config.base.weights } }));
    }

    for (const variant of config.variants ?? []) {
        validateWeights(variant.weights ?? {}, variant.name);
        validateWeights(variant.endgameWeights ?? {}, `${variant.name} endgameWeights`);
        variants.push(withEndgame({
            kind: 'search',
            name: variant.name,
            depth: variant.depth ?? baseDepth,
            weights: { ...config.base.weights, ...variant.weights },
        }, variant));
    }

    const names = new Set<string>();
    for (const variant of variants) {
        if (names.has(variant.name)) throw new Error(`Two variants are called "${variant.name}".`);
        names.add(variant.name);
    }
    return variants;
}

function validateWeights(weights: Weights, where: string): void {
    for (const key of Object.keys(weights)) {
        if (!EVALUATOR_NAMES.includes(key as EvaluatorName)) {
            throw new Error(`Unknown evaluator "${key}" in ${where}. Choose from: ${EVALUATOR_NAMES.join(', ')}`);
        }
    }
}

function cartesianProduct(lists: number[][]): number[][] {
    return lists.reduce<number[][]>(
        (combinations, list) => combinations.flatMap(combination => list.map(value => [...combination, value])),
        [[]],
    );
}
