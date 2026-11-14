import { expect } from 'chai';
import Board from '../src/Board.js';
import { PieceType } from '../src/types.js';
import { vulnerability } from '../src/ai/evaluators.js';
import { findBestMoves, searchOptions, searchStats } from '../src/ai/Search.js';
import { GOLDEN_SEARCH_EVALUATOR, moveKey } from '../src/ai/golden.js';
import { boardFromPosition, sideToMove } from '../src/ai/testPositions.js';
import { expectBoardUnchanged } from './helpers/boardInvariance.js';
import { loadGolden } from './helpers/golden.js';
import { FULL_TESTS, sample } from './helpers/testMode.js';

const SIDES = [PieceType.WHITE, PieceType.BLACK];

describe('Counting capturable pieces quickly', () => {
    it('should count the pieces each side could capture', () => {
        // White at 4 can withdraw from 3 (moving to 5) or from 8 (moving to 0). Black can't capture anything.
        const board = new Board(3, 3, '000210002');
        expect(board.countCapturablePieces(PieceType.WHITE)).to.equal(2);
        expect(board.countCapturablePieces(PieceType.BLACK)).to.equal(0);
    });

    it('should count a piece only once when several moves could capture it', () => {
        // Black at 2 can be approached by white at 0 (moving to 1) and by white at 8 (moving up to 5)
        const board = new Board(3, 3, '102000001');
        expect(board.getCapturablePieces(PieceType.WHITE).size).to.equal(1);
        expect(board.countCapturablePieces(PieceType.WHITE)).to.equal(1);
    });

    it('should give the same answer when called repeatedly', () => {
        const board = new Board(3, 3, '000210002');
        for (let i = 0; i < 5; i++) {
            expect(board.countCapturablePieces(PieceType.WHITE)).to.equal(2);
        }
    });

    it('should match getCapturablePieces, and leave the board unchanged, in every test position', () => {
        for (const { position } of loadGolden().entries) {
            const board = boardFromPosition(position);
            for (const side of SIDES) {
                const count = expectBoardUnchanged(board, () => board.countCapturablePieces(side), position.name);
                expect(count, `${position.name} (${side === PieceType.WHITE ? 'white' : 'black'})`).to.equal(board.getCapturablePieces(side).size);
            }
        }
    });

    it('vulnerability should still give the golden values', () => {
        for (const entry of loadGolden().entries) {
            if (entry.evaluators === undefined) continue;
            const board = boardFromPosition(entry.position);
            expect(vulnerability(board, PieceType.WHITE), entry.position.name).to.equal(entry.evaluators.vulnerability.WHITE);
            expect(vulnerability(board, PieceType.BLACK), entry.position.name).to.equal(entry.evaluators.vulnerability.BLACK);
        }
    });
});

describe('Trying longer capture chains first inside the search', function () {
    this.timeout(FULL_TESTS ? 600_000 : 120_000);

    afterEach(() => {
        searchOptions.orderMoves = true;
    });

    it('should be switched on by default', () => {
        expect(searchOptions.orderMoves).to.be.true;
    });

    it('should find the same best score and the same tied-best moves (in the same order) as without it, visiting fewer positions', () => {
        const positions = loadGolden().entries.filter(e => e.search !== undefined).map(e => e.position);
        let nodesWithout = 0;
        let nodesWith = 0;
        for (const position of sample(positions, 3)) {
            const board = boardFromPosition(position);
            const results = [false, true].map(orderMoves => {
                searchOptions.orderMoves = orderMoves;
                searchStats.nodes = 0;
                const best = findBestMoves(board, sideToMove(board), GOLDEN_SEARCH_EVALUATOR, 3);
                if (orderMoves) nodesWith += searchStats.nodes; else nodesWithout += searchStats.nodes;
                return { score: best?.score ?? null, moves: best?.moves.map(m => moveKey(m.startIndex, m.move)) ?? [] };
            });
            expect(results[1], position.name).to.deep.equal(results[0]);
        }
        expect(nodesWith).to.be.lessThan(nodesWithout);
    });

    it('should leave the board unchanged', () => {
        for (const { position } of sample(loadGolden().entries.filter(e => e.search !== undefined), 6)) {
            const board = boardFromPosition(position);
            expectBoardUnchanged(board, () => findBestMoves(board, sideToMove(board), GOLDEN_SEARCH_EVALUATOR, 3), position.name);
        }
    });
});
