import { expect } from 'chai';
import { GoldenEntry, computeGolden } from '../src/ai/golden.js';
import { PositionKind } from '../src/ai/testPositions.js';
import { loadGolden } from './helpers/golden.js';
import { FULL_TESTS, sample } from './helpers/testMode.js';

/**
 * The golden results were saved by `npm run golden` from the original code, before any speed-ups. Every speed-up must
 * give exactly the same answers: the same moves in the same order, the same capture sets, the same evaluator values,
 * and the same best score and tied-best moves from the search.
 */
describe('Golden results', function () {
    this.timeout(FULL_TESTS ? 900_000 : 120_000);

    let entries: GoldenEntry[] = [];
    // The same results worked out by the current code (without the searches, which are checked separately)
    let current: GoldenEntry[] = [];
    before(() => {
        entries = loadGolden().entries;
        current = entries.map(entry => computeGolden(entry.position, []));
    });

    /**
     * @returns the names of the positions where the current code gives a different answer.
     */
    function mismatches<T>(pick: (entry: GoldenEntry) => T): string[] {
        return entries.filter((entry, i) => JSON.stringify(pick(current[i])) !== JSON.stringify(pick(entry))).map(entry => entry.position.name);
    }

    it('should cover every kind of position', () => {
        expect(entries.length).to.be.at.least(250);
        const kinds: PositionKind[] = ['turn', 'endgame', 'midChain', 'finished', 'nearDraw', 'small'];
        for (const kind of kinds) {
            expect(entries.filter(e => e.position.kind === kind).length, kind).to.be.at.least(10);
        }
    });

    it('should generate the same complete moves, in the same order', () => {
        expect(mismatches(e => e.moves)).to.deep.equal([]);
    });

    it('should find the same capturable pieces', () => {
        expect(mismatches(e => e.capturable)).to.deep.equal([]);
    });

    it('should give the same evaluator values', () => {
        expect(mismatches(e => e.evaluators)).to.deep.equal([]);
    });

    it('should find the same best score and the same tied-best moves when searching', () => {
        const golden = loadGolden();
        const withSearch = entries.filter(e => e.search !== undefined);
        const different = sample(withSearch, 6)
            .filter(entry => JSON.stringify(computeGolden(entry.position, golden.searchDepths).search) !== JSON.stringify(entry.search))
            .map(entry => entry.position.name);
        expect(different).to.deep.equal([]);
    });
});
