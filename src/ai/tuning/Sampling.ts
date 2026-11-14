import { EvaluatorName, Weights } from '../presets.js';
import { Rng } from '../Search.js';

/**
 * The range each weight is searched over (material is always fixed at 100, since only the ratios matter).
 */
export type SearchRanges = Partial<Record<EvaluatorName, { min: number, max: number }>>;

/**
 * Spreads `count` points evenly over the ranges using a Latin hypercube: each weight's range is split into `count`
 * slices and every slice is used exactly once, so no region is left out by chance.
 *
 * Positions are spread on a signed log scale, so there are as many points between 1 and 10 as between 10 and 100,
 * and both positive and negative values are covered when the range allows.
 */
export function latinHypercube(count: number, ranges: SearchRanges, rng: Rng): Weights[] {
    const names = Object.keys(ranges) as EvaluatorName[];
    const columns = names.map(name => {
        const slices = Array.from({ length: count }, (_, i) => (i + rng()) / count);
        // Shuffle so that the slices of different weights are paired up randomly
        for (let i = slices.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [slices[i], slices[j]] = [slices[j], slices[i]];
        }
        return slices.map(u => fromUnit(u, ranges[name]!));
    });
    return Array.from({ length: count }, (_, i) => {
        const weights: Weights = { material: 100 };
        names.forEach((name, j) => weights[name] = columns[j][i]);
        return weights;
    });
}

/**
 * Maps 0..1 onto min..max using a signed log scale, rounded to a whole number.
 */
export function fromUnit(u: number, { min, max }: { min: number, max: number }): number {
    const negativeSpan = Math.log1p(Math.max(0, -min));
    const positiveSpan = Math.log1p(Math.max(0, max));
    const position = u * (negativeSpan + positiveSpan) - negativeSpan;
    const value = position < 0 ? -Math.expm1(-position) : Math.expm1(position);
    // `|| 0` turns -0 into 0
    return Math.round(value) || 0;
}
