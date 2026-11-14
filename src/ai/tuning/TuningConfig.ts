import { EVALUATOR_NAMES, EvaluatorName, Weights } from '../presets.js';
import { BotSpec } from './BotSpec.js';

export type GridKey = EvaluatorName | 'depth';

/**
 * The contents of a tuning config file (see the tuning/ folder for examples).
 */
export interface TuningConfig {
    // 'gauntlet': every variant plays every opponent (variants don't play each other).
    // 'roundRobin': every variant and opponent plays every other one.
    mode?: 'gauntlet' | 'roundRobin',
    gamesPerPair?: number,
    // Safety limit on game length (games normally end sooner through the no-capture draw rule).
    maxTurns?: number,
    // Built-in bots (preset names or 'Random') for the variants to play against.
    opponents?: string[],
    // The starting point that the grid and variants change.
    base: { depth?: number, weights: Weights },
    // Every combination of these values is tried, each applied on top of base.
    grid?: Partial<Record<GridKey, number[]>>,
    // Hand-picked variants, each applied on top of base. Weights listed here replace the base weight
    // (use 0 to switch an evaluator off).
    variants?: { name: string, depth?: number, weights?: Weights }[],
}

export const DEFAULT_GAMES_PER_PAIR = 20;
export { DEFAULT_MAX_TURNS } from '../Tournament.js';

/**
 * Builds the bots to test from a config. The base is included as "Base" unless there is a grid
 * (in which case the grid already covers it).
 */
export function buildVariants(config: TuningConfig): BotSpec[] {
    validateWeights(config.base.weights, 'base');
    const baseDepth = config.base.depth ?? 2;
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
            variants.push({ kind: 'search', name: nameParts.join(' '), depth, weights });
        }
    } else {
        variants.push({ kind: 'search', name: 'Base', depth: baseDepth, weights: { ...config.base.weights } });
    }

    for (const variant of config.variants ?? []) {
        validateWeights(variant.weights ?? {}, variant.name);
        variants.push({
            kind: 'search',
            name: variant.name,
            depth: variant.depth ?? baseDepth,
            weights: { ...config.base.weights, ...variant.weights },
        });
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
