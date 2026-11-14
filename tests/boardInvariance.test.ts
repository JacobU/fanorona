import { expect } from 'chai';
import Board from '../src/Board.js';
import { AttackType, PieceType } from '../src/types.js';
import { EVALUATORS, EVALUATOR_NAMES } from '../src/ai/presets.js';
import { chooseMove, findBestMoves } from '../src/ai/Search.js';
import { GOLDEN_SEARCH_EVALUATOR } from '../src/ai/golden.js';
import { seededRng } from '../src/ai/random.js';
import { StoredPosition, boardFromPosition, sideToMove } from '../src/ai/testPositions.js';
import { expectBoardUnchanged } from './helpers/boardInvariance.js';
import { loadGolden } from './helpers/golden.js';
import { FULL_TESTS, sample } from './helpers/testMode.js';

const SIDES = [PieceType.WHITE, PieceType.BLACK];
const sideName = (side: PieceType) => side === PieceType.WHITE ? 'white' : 'black';

describe('Full board state snapshot', () => {
    it('should include everything saveBoardState does', () => {
        const board = new Board();
        expect(board.getFullStateForTesting()).to.deep.include(board.saveBoardState());
    });

    it('should include the pending approach-or-withdraw choice, which saveBoardState leaves out', () => {
        const board = new Board();
        const before = board.getFullStateForTesting();
        board.setAttackOrWithdraw(AttackType.WITHDRAW);
        expect(board.getFullStateForTesting().attackOrWithdraw).to.equal(AttackType.WITHDRAW);
        expect(board.getFullStateForTesting()).to.not.deep.equal(before);
    });

    it('should include the starting layout (used by reset) and the board size', () => {
        const state = new Board(3, 3, '210200201').getFullStateForTesting();
        expect(state.startingPiecePositions).to.deep.equal([2, 1, 0, 2, 0, 0, 2, 0, 1]);
        expect(state.rows).to.equal(3);
        expect(state.columns).to.equal(3);
    });

    it('should return copies, so changing the snapshot does not change the board', () => {
        const board = new Board();
        const state = board.getFullStateForTesting();
        state.positions[0] = PieceType.EMPTY;
        state.startingPiecePositions[0] = PieceType.EMPTY;
        state.turnMoveIndexes.push(3);
        const fresh = board.getFullStateForTesting();
        expect(fresh.positions[0]).to.equal(PieceType.BLACK);
        expect(fresh.startingPiecePositions[0]).to.equal(PieceType.BLACK);
        expect(fresh.turnMoveIndexes).to.deep.equal([]);
    });
});

describe('Board-unchanged helper', () => {
    it('should pass and return the result when the operation only reads the board', () => {
        const board = new Board();
        const moves = expectBoardUnchanged(board, () => board.getAllPossibleCompleteMoves(PieceType.WHITE), 'move generation');
        expect(moves.startIndexes.length).to.be.greaterThan(0);
    });

    it('should fail when the operation plays a move', () => {
        const board = new Board();
        const moves = board.getAllPossibleCompleteMoves(PieceType.WHITE);
        expect(() => expectBoardUnchanged(board, () => board.applyCompleteMove(moves.startIndexes[0], moves.moves[0][0]), 'a real move'))
            .to.throw('the board changed during a real move');
    });

    it('should fail when only the pending approach-or-withdraw choice is left behind', () => {
        const board = new Board();
        expect(() => expectBoardUnchanged(board, () => board.setAttackOrWithdraw(AttackType.APPROACH), 'a leaked choice'))
            .to.throw('the board changed');
    });
});

describe('findBestMoves', () => {
    it('should return every move tied for best, and chooseMove should pick one of them with the same score', () => {
        const board = new Board();
        const best = findBestMoves(board, PieceType.WHITE, GOLDEN_SEARCH_EVALUATOR, 2)!;
        expect(best.moves.length).to.be.greaterThan(0);
        const keys = best.moves.map(m => `${m.startIndex}:${m.move.moveIndexes.join(',')}`);
        for (const rng of [() => 0, () => 0.5, () => 0.999, seededRng(4)]) {
            const chosen = chooseMove(board, PieceType.WHITE, GOLDEN_SEARCH_EVALUATOR, 2, rng)!;
            expect(chosen.score).to.equal(best.score);
            expect(keys).to.include(`${chosen.startIndex}:${chosen.move.moveIndexes.join(',')}`);
        }
    });

    it('should return null when the player has no moves', () => {
        const board = new Board(3, 3, '222212222');
        expect(findBestMoves(board, PieceType.WHITE, GOLDEN_SEARCH_EVALUATOR, 2)).to.be.null;
    });

    it('should reject a depth below 1', () => {
        expect(() => findBestMoves(new Board(), PieceType.WHITE, GOLDEN_SEARCH_EVALUATOR, 0)).to.throw('at least 1');
    });
});

describe('The board is unchanged after searches, move generation and evaluation', function () {
    this.timeout(FULL_TESTS ? 900_000 : 120_000);

    // The ~300 fixed test positions saved with the golden results
    let atTurnBoundary: StoredPosition[] = [];
    let midChain: StoredPosition[] = [];
    before(() => {
        const positions = loadGolden().entries.map(entry => entry.position);
        atTurnBoundary = positions.filter(p => p.kind !== 'midChain');
        midChain = positions.filter(p => p.kind === 'midChain');
    });

    it('should have positions at turn boundaries and in the middle of capture chains', () => {
        expect(atTurnBoundary.length).to.be.greaterThan(200);
        expect(midChain.length).to.be.greaterThan(20);
    });

    it('move generation for both players', () => {
        for (const p of atTurnBoundary) {
            const board = boardFromPosition(p);
            for (const side of SIDES) {
                expectBoardUnchanged(board, () => board.getAllPossibleCompleteMoves(side), `${p.name}: moves for ${sideName(side)}`);
            }
        }
    });

    it('the possible moves of every piece', () => {
        for (const p of atTurnBoundary) {
            const board = boardFromPosition(p);
            const numCells = p.rows * p.columns;
            for (let i = 0; i < numCells; i++) {
                if (board.getPieceTypeAtIndex(i) === PieceType.EMPTY) continue;
                expectBoardUnchanged(board, () => board.getPossibleMovesForCell(i), `${p.name}: moves for the piece at ${i}`);
            }
        }
    });

    it('getCapturablePieces for both players', () => {
        for (const p of atTurnBoundary) {
            const board = boardFromPosition(p);
            for (const side of SIDES) {
                expectBoardUnchanged(board, () => board.getCapturablePieces(side), `${p.name}: capturable pieces for ${sideName(side)}`);
            }
        }
    });

    it('every evaluator from both points of view', () => {
        for (const p of atTurnBoundary) {
            const board = boardFromPosition(p);
            for (const name of EVALUATOR_NAMES) {
                for (const side of SIDES) {
                    expectBoardUnchanged(board, () => EVALUATORS[name](board, side), `${p.name}: ${name} for ${sideName(side)}`);
                }
            }
        }
    });

    it('applying every complete move and then restoring the saved state', () => {
        for (const p of atTurnBoundary) {
            const board = boardFromPosition(p);
            const side = sideToMove(board);
            const allMoves = board.getAllPossibleCompleteMoves(side);
            allMoves.startIndexes.forEach((startIndex, i) => {
                for (const move of allMoves.moves[i]) {
                    const saved = board.saveBoardState();
                    expectBoardUnchanged(board, () => {
                        board.applyCompleteMove(startIndex, move);
                        board.resetBoardState(saved);
                    }, `${p.name}: playing ${startIndex}:${move.moveIndexes.join(',')} and undoing it`);
                }
            });
        }
    });

    it('searches 1 and 2 turns ahead', () => {
        for (const p of sample(atTurnBoundary, 2)) {
            const board = boardFromPosition(p);
            for (const depth of [1, 2]) {
                expectBoardUnchanged(board, () => findBestMoves(board, sideToMove(board), GOLDEN_SEARCH_EVALUATOR, depth), `${p.name}: depth ${depth} search`);
            }
        }
    });

    it('searches 3 turns ahead', () => {
        for (const p of sample(atTurnBoundary, 6)) {
            const board = boardFromPosition(p);
            expectBoardUnchanged(board, () => findBestMoves(board, sideToMove(board), GOLDEN_SEARCH_EVALUATOR, 3), `${p.name}: depth 3 search`);
        }
    });

    it('searches 4 turns ahead (full tests only)', function () {
        if (!FULL_TESTS) this.skip();
        for (const p of atTurnBoundary.filter((_, i) => i % 5 === 0)) {
            const board = boardFromPosition(p);
            expectBoardUnchanged(board, () => findBestMoves(board, sideToMove(board), GOLDEN_SEARCH_EVALUATOR, 4), `${p.name}: depth 4 search`);
        }
    });

    it('chooseMove, which picks one of the best moves at random', () => {
        const rng = seededRng(5);
        for (const p of sample(atTurnBoundary, 10)) {
            const board = boardFromPosition(p);
            expectBoardUnchanged(board, () => chooseMove(board, sideToMove(board), GOLDEN_SEARCH_EVALUATOR, 2, rng), `${p.name}: chooseMove`);
        }
    });

    it('move generation in the middle of a capture chain', () => {
        for (const p of midChain) {
            const board = boardFromPosition(p);
            const side = sideToMove(board);
            const movingPiece = p.state.currentlyMovingPiece!;
            expectBoardUnchanged(board, () => board.getAllPossibleCompleteMoves(side), `${p.name}: moves`);
            expectBoardUnchanged(board, () => board.getPossibleMovesForCell(movingPiece), `${p.name}: moves for the moving piece`);
            expectBoardUnchanged(board, () => board.canEndTurn(), `${p.name}: canEndTurn`);
        }
    });

    it('ending a capture chain early and then restoring the saved state', () => {
        for (const p of midChain) {
            const board = boardFromPosition(p);
            const saved = board.saveBoardState();
            expectBoardUnchanged(board, () => {
                board.endTurn();
                board.resetBoardState(saved);
            }, `${p.name}: ending the turn and undoing it`);
        }
    });
});
