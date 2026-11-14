/**
 * The slow, thorough versions of the board-unchanged and golden tests only run with `npm run test:full`
 * (or with the environment variable FULL_TESTS=1). `npm test` runs a sample of them so it stays quick.
 */
export const FULL_TESTS = process.env.npm_lifecycle_event === 'test:full' || process.env.FULL_TESTS === '1';

/**
 * @returns every item when running the full tests, otherwise every `step`th item.
 */
export function sample<T>(items: T[], step: number): T[] {
    return FULL_TESTS ? items : items.filter((_, i) => i % step === 0);
}
