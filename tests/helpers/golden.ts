import { existsSync, readFileSync } from 'fs';
import { GOLDEN_FILE, GoldenFile } from '../../src/ai/golden.js';

let cached: GoldenFile | null = null;

/**
 * Loads the golden results saved by `npm run golden` (from the original code, before any speed-ups).
 */
export function loadGolden(): GoldenFile {
    if (cached === null) {
        if (!existsSync(GOLDEN_FILE)) {
            throw new Error(`${GOLDEN_FILE} is missing. It is created once by "npm run golden".`);
        }
        cached = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8')) as GoldenFile;
    }
    return cached;
}
