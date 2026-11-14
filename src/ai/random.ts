import { Rng } from './Search.js';

/**
 * A small, fast random number generator (mulberry32) that always produces the same sequence for the same seed.
 * Used so that tuning runs can be repeated exactly (e.g. the same set of openings every time).
 */
export function seededRng(seed: number): Rng {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
